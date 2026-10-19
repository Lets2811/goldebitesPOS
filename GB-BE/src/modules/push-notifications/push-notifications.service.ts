import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
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

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Web Push to users' phones (couriers): it arrives with the phone locked or
 * the app closed. On Android any Chrome tab can subscribe; on iPhone only the
 * app added to the home screen (iOS 16.4+). Without VAPID keys configured
 * push is off and sending is a no-op: the apps still alert while open.
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly publicKey: string;
  private readonly enabled: boolean;

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
  }

  getPublicKey(): { enabled: boolean; publicKey: string } {
    return {
      enabled: this.enabled,
      publicKey: this.enabled ? this.publicKey : '',
    };
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
   * Sends to every device of the user. Never throws: a notification must not
   * break what triggered it. Returns how many devices accepted it.
   */
  async sendToUser(userId: string, message: PushMessage): Promise<number> {
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
