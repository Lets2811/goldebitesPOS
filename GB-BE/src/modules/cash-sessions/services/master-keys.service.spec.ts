import { BusinessRuleException } from '../../../common/exceptions';
import { MasterKeysService } from './master-keys.service';

describe('MasterKeysService', () => {
  const businessId = 'business-1';
  let db: { query: jest.Mock };
  let audit: { record: jest.Mock };
  let platformKey: string;
  let service: MasterKeysService;
  const previous = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      'a-test-encryption-key-of-enough-length';
  });
  afterAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = previous;
  });

  beforeEach(() => {
    platformKey = 'platform-wide-key';
    db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new MasterKeysService(
      db as never,
      {
        getOrThrow: () => ({ cashSession: { masterKey: platformKey } }),
      } as never,
      audit as never,
    );
  });

  it('falls back to the platform-wide key while the business has none', async () => {
    await expect(service.keyFor(businessId)).resolves.toBe('platform-wide-key');
  });

  it('has no key at all when neither exists', async () => {
    platformKey = '';
    await expect(service.keyFor(businessId)).resolves.toBeNull();
  });

  it('generates a readable key, stores it encrypted and returns it once', async () => {
    db.query.mockResolvedValue({ rows: [{ updated_at: new Date() }] });

    const result = await service.reset(businessId, 'platform-user-1');

    expect(result.key).toMatch(
      /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/,
    );
    const [, params] = db.query.mock.calls[0] as [string, string[]];
    expect(params[1]).not.toContain(result.key!);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESET',
        newValues: { generated: true },
      }),
    );
  });

  it("then uses the business's own key, not the platform's", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ updated_at: new Date() }] });
    const { key } = await service.reset(
      businessId,
      'platform-user-1',
      'MiClave-2026',
    );
    const [, params] = db.query.mock.calls[0] as [string, string[]];
    db.query.mockResolvedValue({
      rows: [{ key_encrypted: params[1], updated_at: new Date() }],
    });

    await expect(service.keyFor(businessId)).resolves.toBe(key);
    const status = await service.status(businessId, true, 'platform-user-1');
    expect(status).toMatchObject({
      hasOwnKey: true,
      usesPlatformKey: false,
      key: 'MiClave-2026',
    });
    expect(audit.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'REVEAL' }),
    );
  });

  it('refuses a key that is too short', async () => {
    await expect(
      service.reset(businessId, 'platform-user-1', 'corta'),
    ).rejects.toThrow(BusinessRuleException);
  });
});
