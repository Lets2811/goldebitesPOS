import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { PushNotificationsRepository } from './push-notifications.repository';

/** What the phone shows; the service worker (GB/public/sw.js) reads it. */
export interface PushMessage {
  title: string;
  body: string;
  /** Notifications with the same tag replace each other. */
  tag: string;
  /** Where tapping the notification takes the user. */
  url: string;
  /** Stays on screen until the user acts on it (a call, not a chat message). */
  requireInteraction?: boolean;
}

export type NativePlatform = 'android' | 'ios';

/** Firebase's answers for a token that will never work again: it is forgotten. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * The Android notification channel of a message: how the phone rings. The
 * app creates them (GB/src/lib/native/native-push.ts) with the same ids.
 */
export function androidChannelFor(message: PushMessage): string {
  if (message.tag.startsWith('call-')) return 'calls';
  return message.requireInteraction ? 'deliveries' : 'messages';
}

/** What Firebase delivers to one phone of the installed app. */
export function toNativeMessage(token: string, message: PushMessage): Message {
  return {
    token,
    notification: { title: message.title, body: message.body },
    // Read by the app when the notification is tapped.
    data: { url: message.url, tag: message.tag },
    android: {
      priority: 'high',
      ttl: 300_000,
      collapseKey: message.tag.slice(0, 64),
      notification: {
        channelId: androidChannelFor(message),
        tag: message.tag,
        sound: 'default',
        defaultVibrateTimings: true,
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-collapse-id': message.tag.slice(0, 64),
      },
      payload: { aps: { sound: 'default', threadId: message.tag } },
    },
  };
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Notifications to users' phones (couriers): they arrive with the phone
 * locked or the app closed.
 * - Web Push, for the web app: on Android any Chrome tab can subscribe; on
 *   iPhone only the app added to the home screen (iOS 16.4+). Off without
 *   VAPID keys.
 * - Firebase Cloud Messaging, for the installed phone app (Android/iPhone).
 *   Off without FCM_SERVICE_ACCOUNT.
 * Off, sending is a no-op: the apps still alert while open.
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly publicKey: string;
  private readonly enabled: boolean;
  /** Firebase, for the installed phone apps; null when not configured. */
  private readonly firebase: App | null;

  constructor(
    private readonly repository: PushNotificationsRepository,
    configService: ConfigService,
  ) {
    this.publicKey = configService.get<string>('VAPID_PUBLIC_KEY') ?? '';
    const privateKey = configService.get<string>('VAPID_PRIVATE_KEY') ?? '';
    const subject =
      configService.get<string>('VAPID_SUBJECT') ||
      'mailto:soporte@goldenbites.net';
    this.enabled = this.publicKey !== '' && privateKey !== '';
    if (this.enabled) {
      webpush.setVapidDetails(subject, this.publicKey, privateKey);
    }
    this.firebase = this.startFirebase(
      configService.get<string>('FCM_SERVICE_ACCOUNT') ?? '',
    );
  }

  private startFirebase(serviceAccountBase64: string): App | null {
    if (!serviceAccountBase64) return null;
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, 'base64').toString('utf8'),
      ) as { project_id: string; client_email: string; private_key: string };
      return initializeApp(
        {
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
          }),
        },
        'golden-bites-push',
      );
    } catch (error) {
      this.logger.error(
        'FCM_SERVICE_ACCOUNT is not a valid service account (base64 JSON): push to the phone apps is off',
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /** `nativeEnabled`: whether the installed phone apps can register for push. */
  getPublicKey(): {
    enabled: boolean;
    publicKey: string;
    nativeEnabled: boolean;
  } {
    return {
      enabled: this.enabled,
      publicKey: this.enabled ? this.publicKey : '',
      nativeEnabled: this.firebase !== null,
    };
  }

  /** The installed app on this phone receives this user's notifications. */
  async registerNativeToken(
    userId: string,
    businessId: string,
    token: string,
    platform: NativePlatform,
  ): Promise<void> {
    await this.repository.upsertNativeToken({
      userId,
      businessId,
      token,
      platform,
    });
  }

  async unregisterNativeToken(userId: string, token: string): Promise<void> {
    await this.repository.removeNativeToken(userId, token);
  }

  async subscribe(
    userId: string,
    businessId: string,
    subscription: PushSubscriptionInput,
    userAgent: string | null,
  ): Promise<void> {
    await this.repository.upsert({
      userId,
      businessId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.repository.remove(userId, endpoint);
  }

  /**
   * Sends to every device of the user, browsers and installed apps. Never
   * throws: a notification must not break what triggered it. Returns how many
   * devices accepted it.
   */
  async sendToUser(userId: string, message: PushMessage): Promise<number> {
    const [web, native] = await Promise.all([
      this.sendWeb(userId, message),
      this.sendNative(userId, message),
    ]);
    return web + native;
  }

  private async sendNative(
    userId: string,
    message: PushMessage,
  ): Promise<number> {
    if (!this.firebase) return 0;
    try {
      const tokens = await this.repository.findNativeTokensForUser(userId);
      if (tokens.length === 0) return 0;
      const result = await getMessaging(this.firebase).sendEach(
        tokens.map((row) => toNativeMessage(row.token, message)),
      );
      await Promise.all(
        result.responses.map(async (response, index) => {
          const row = tokens[index];
          if (response.success) {
            await this.repository.touchNativeToken(row.id);
            return;
          }
          const code = response.error?.code ?? '';
          // The app was uninstalled or the token expired: forget it.
          if (DEAD_TOKEN_CODES.has(code)) {
            await this.repository.removeNativeTokenById(row.id);
          } else {
            this.logger.warn(
              `Push to the phone app failed (${code || 'unknown'})`,
            );
          }
        }),
      );
      return result.successCount;
    } catch (error) {
      this.logger.error(
        'Could not send push to the phone apps',
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  private async sendWeb(userId: string, message: PushMessage): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const subscriptions = await this.repository.findForUser(userId);
      const results = await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              JSON.stringify(message),
              {
                TTL: 300,
                urgency: 'high',
                topic: message.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, ''),
              },
            );
            await this.repository.touch(subscription.id);
            return true;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // The device unsubscribed or the subscription expired: forget it.
            if (status === 404 || status === 410) {
              await this.repository.removeById(subscription.id);
            } else {
              this.logger.warn(
                `Push to ${subscription.endpoint.slice(0, 60)}… failed (${status ?? 'network'})`,
              );
            }
            return false;
          }
        }),
      );
      return results.filter(Boolean).length;
    } catch (error) {
      this.logger.error(
        'Could not send push notifications',
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }
}
