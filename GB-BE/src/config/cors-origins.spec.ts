import { PHONE_APP_ORIGINS, corsOrigins } from './cors-origins';

describe('corsOrigins', () => {
  it('answers the configured sites and the phone apps', () => {
    expect(corsOrigins('https://staging.goldenbites.net')).toEqual([
      'https://staging.goldenbites.net',
      ...PHONE_APP_ORIGINS,
    ]);
  });

  it('reads a comma-separated list, ignoring spaces and repeats', () => {
    expect(
      corsOrigins(
        'http://localhost:5173, https://localhost,,https://goldenbites.net',
      ),
    ).toEqual([
      'http://localhost:5173',
      'https://localhost',
      'https://goldenbites.net',
      'http://localhost',
      'capacitor://localhost',
    ]);
  });

  it('answers any origin with "*"', () => {
    expect(corsOrigins('*')).toBe(true);
  });
});
