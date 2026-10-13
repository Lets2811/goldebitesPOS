import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthTokens } from '../modules/auth/domain/auth.types';
import {
  AuthService,
  RequestMetadata,
} from '../modules/auth/services/auth.service';
import { UserRow } from '../modules/users/domain/user.interface';
import { UsersService } from '../modules/users/services/users.service';

/**
 * Prints a long-lived access token for a user, for trying the API from
 * Postman or curl without signing in every fifteen minutes.
 *
 *   npm run dev:token -- <email> [duration]      duration defaults to 365d
 *
 * Development only. The token is the one a login would issue — same role,
 * permissions, modules and branch, read at this moment — only its expiry is
 * longer. It is signed with this machine's JWT_ACCESS_SECRET, so it is worth
 * exactly as much as that secret is private: it works wherever the same
 * secret is used and nowhere else. It cannot be revoked short of changing
 * the secret, and it does not pick up later changes to the user's role.
 */
const [email, duration = '365d'] = process.argv.slice(2);

/** The login's own token builder, so the token cannot drift from what a real sign-in carries. */
interface TokenIssuer {
  issueTokens(user: UserRow, meta: RequestMetadata): Promise<AuthTokens>;
}

async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to issue a long-lived token when NODE_ENV=production.',
    );
  }
  if (!email) {
    throw new Error(
      'Usage: npm run dev:token -- <email> [duration, e.g. 365d]',
    );
  }

  // The app reads its configuration when the context is created, below.
  process.env.JWT_ACCESS_EXPIRES_IN = duration;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const users = await app
      .get(UsersService, { strict: false })
      .findRawByEmailAcrossBusinesses(email);
    if (users.length === 0) {
      throw new Error(`No active user with the email "${email}".`);
    }
    if (users.length > 1) {
      console.error(
        `"${email}" exists in ${users.length} businesses; using the first (${users[0].business_id}).`,
      );
    }

    const issuer = app.get<TokenIssuer>(AuthService, { strict: false });
    const { accessToken } = await issuer.issueTokens(users[0], {
      userAgent: 'dev-token script',
    });

    console.error(`Token for ${email}, valid for ${duration}:\n`);
    console.log(accessToken);
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
