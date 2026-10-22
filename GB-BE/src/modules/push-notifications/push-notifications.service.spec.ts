import { ConfigService } from '@nestjs/config';
import {
  PushNotificationsService,
  androidChannelFor,
  toNativeMessage,
  type PushMessage,
} from './push-notifications.service';

const sendEach = jest.fn();
jest.mock('firebase-admin/app', () => ({
  cert: jest.fn((value: unknown) => value),
  initializeApp: jest.fn(() => ({ name: 'golden-bites-push' })),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({ sendEach })),
}));

const serviceAccount = Buffer.from(
  JSON.stringify({
    project_id: 'golden-bites',
    client_email: 'push@golden-bites.iam.gserviceaccount.com',
    private_key: 'key',
  }),
).toString('base64');

const chat: PushMessage = {
  title: 'Mensaje del cliente · ABC234',
  body: 'Ya estoy afuera',
  tag: 'chat-delivery-1',
  url: '/domiciliario',
};

describe('PushNotificationsService', () => {
  let repository: Record<string, jest.Mock>;

  function build(env: Record<string, string>) {
    const config = {
      get: (key: string) => env[key],
    } as unknown as ConfigService;
    return new PushNotificationsService(repository as never, config);
  }

  beforeEach(() => {
    sendEach.mockReset();
    repository = {
      findForUser: jest.fn().mockResolvedValue([]),
      findNativeTokensForUser: jest.fn().mockResolvedValue([
        { id: 't1', token: 'token-1' },
        { id: 't2', token: 'token-2' },
      ]),
      touchNativeToken: jest.fn().mockResolvedValue(undefined),
      removeNativeTokenById: jest.fn().mockResolvedValue(undefined),
      upsertNativeToken: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('rings a call, a new delivery and a message on their own Android channels', () => {
    expect(
      androidChannelFor({ ...chat, tag: 'call-d1', requireInteraction: true }),
    ).toBe('calls');
    expect(
      androidChannelFor({
        ...chat,
        tag: 'assigned-d1',
        requireInteraction: true,
      }),
    ).toBe('deliveries');
    expect(androidChannelFor(chat)).toBe('messages');
  });

  it('tells the app where a tapped notification leads', () => {
    const message = toNativeMessage('token-1', chat);

    expect(message).toMatchObject({
      token: 'token-1',
      notification: { title: chat.title, body: chat.body },
      data: { url: '/domiciliario', tag: 'chat-delivery-1' },
      android: { priority: 'high', notification: { channelId: 'messages' } },
    });
  });

  it('sends nothing to the phone apps without Firebase configured', async () => {
    const service = build({});

    expect(service.getPublicKey().nativeEnabled).toBe(false);
    expect(await service.sendToUser('courier-1', chat)).toBe(0);
    expect(sendEach).not.toHaveBeenCalled();
  });

  it('sends to every phone of the user and forgets a phone whose app was uninstalled', async () => {
    const service = build({ FCM_SERVICE_ACCOUNT: serviceAccount });
    sendEach.mockResolvedValue({
      successCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });

    const devices = await service.sendToUser('courier-1', chat);

    expect(service.getPublicKey().nativeEnabled).toBe(true);
    expect(devices).toBe(1);
    expect(sendEach).toHaveBeenCalledWith([
      expect.objectContaining({ token: 'token-1' }),
      expect.objectContaining({ token: 'token-2' }),
    ]);
    expect(repository.touchNativeToken).toHaveBeenCalledWith('t1');
    expect(repository.removeNativeTokenById).toHaveBeenCalledWith('t2');
  });

  it('never throws when Firebase fails', async () => {
    const service = build({ FCM_SERVICE_ACCOUNT: serviceAccount });
    sendEach.mockRejectedValue(new Error('network'));

    await expect(service.sendToUser('courier-1', chat)).resolves.toBe(0);
  });

  it('keeps push to the phone apps off when the service account is not valid', () => {
    const service = build({ FCM_SERVICE_ACCOUNT: 'not base64 json' });

    expect(service.getPublicKey().nativeEnabled).toBe(false);
  });
});
