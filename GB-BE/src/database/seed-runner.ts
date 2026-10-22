import 'reflect-metadata';
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from '../common/constants/permissions.constants';
import { SYSTEM_ROLES } from '../common/constants/roles.constants';
import { DatabaseService } from './database.service';
import { BranchesService } from '../modules/branches/services/branches.service';
import { BusinessesService } from '../modules/businesses/services/businesses.service';
import { RolesService } from '../modules/roles/services/roles.service';
import { UsersService } from '../modules/users/services/users.service';
import { createScriptClient } from './scripts/db-client';
import * as bcrypt from 'bcrypt';

const SEEDS_DIR = join(__dirname, '..', '..', 'database', 'seeds');

const GOLDEN_BITES_BUSINESS_NAME = 'Golden Bites';
const GOLDEN_BITES_ADMIN_EMAIL = 'admin@goldenbites.local';
const GOLDEN_BITES_ADMIN_PASSWORD = 'ChangeMe123!';

/**
 * The first account of the Golden Bites team, for the Admin app. It is not a
 * restaurant user: platform accounts live in platform_users, apart from every
 * business (see migration 088).
 */
const PLATFORM_ADMIN_EMAIL = 'superadmin@goldenbitespos.local';
const PLATFORM_ADMIN_PASSWORD = 'ChangeMe123!';

async function runSqlSeeds(): Promise<void> {
  const client = createScriptClient();
  await client.connect();

  try {
    let files: string[] = [];
    try {
      files = readdirSync(SEEDS_DIR)
        .filter((file) => file.endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      console.log('No seeds directory found, skipping SQL seeds.');
      return;
    }

    if (files.length === 0) {
      console.log('No SQL seed files found in database/seeds.');
      return;
    }

    for (const file of files) {
      console.log(`SEEDING ${file}...`);
      const content = readFileSync(join(SEEDS_DIR, file), 'utf-8');
      await client.query('BEGIN');
      try {
        await client.query(content);
        await client.query('COMMIT');
        console.log(`DONE    ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`FAILED  ${file}`);
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

/** Idempotent: inserts missing permission codes and keeps module/description in sync with PERMISSIONS. */
async function seedPermissionsCatalog(db: DatabaseService): Promise<void> {
  for (const permission of PERMISSIONS) {
    await db.query(
      `INSERT INTO permissions (code, module, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description`,
      [permission.code, permission.module, permission.description],
    );
  }
  console.log(`Permissions catalog up to date (${PERMISSIONS.length} codes).`);
}

/**
 * Bootstraps the Golden Bites business itself: business, main branch, the
 * system role catalog (via BusinessesService, which provisions roles as
 * part of business creation) and a SUPER_ADMIN dev user. The business/branch/
 * admin are only created once, but the permission sync below always runs so
 * that system roles created by an earlier version of DEFAULT_ROLE_PERMISSIONS
 * pick up newly added permission codes on every `npm run seed`.
 */
async function seedGoldenBites(
  db: DatabaseService,
  businessesService: BusinessesService,
  branchesService: BranchesService,
  rolesService: RolesService,
  usersService: UsersService,
): Promise<void> {
  // By name OR by its admin: a business renamed after seeding (staging's demo
  // restaurant) must not get a second "Golden Bites" with the default password.
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM businesses WHERE name = $1
     UNION ALL
     SELECT business_id FROM users WHERE lower(email) = lower($2)
     LIMIT 1`,
    [GOLDEN_BITES_BUSINESS_NAME, GOLDEN_BITES_ADMIN_EMAIL],
  );

  let businessId: string;

  if (existing.rows.length > 0) {
    businessId = existing.rows[0].id;
    console.log(
      `"${GOLDEN_BITES_BUSINESS_NAME}" already exists, skipping creation.`,
    );
  } else {
    const business = await businessesService.create({
      name: GOLDEN_BITES_BUSINESS_NAME,
      currency: 'COP',
      timezone: 'America/Bogota',
    });
    businessId = business.id;
    console.log(`Created business "${business.name}" (${business.id}).`);

    const branch = await branchesService.create({
      businessId: business.id,
      name: 'Sede Principal',
    });
    console.log(`Created branch "${branch.name}" (${branch.id}).`);

    const roles = await rolesService.findAllForBusiness(business.id);
    console.log(
      `Provisioned ${roles.length} system roles: ${SYSTEM_ROLES.join(', ')}.`,
    );

    const superAdminRole = roles.find((role) => role.name === 'SUPER_ADMIN');
    if (!superAdminRole) {
      throw new Error(
        'SUPER_ADMIN role was not provisioned for the new business.',
      );
    }

    await usersService.create(business.id, {
      firstName: 'Admin',
      lastName: 'Golden Bites',
      email: GOLDEN_BITES_ADMIN_EMAIL,
      password: GOLDEN_BITES_ADMIN_PASSWORD,
      roleId: superAdminRole.id,
      branchId: branch.id,
    });

    console.log(
      '\n=================================================================',
    );
    console.log('  Dev admin user created:');
    console.log(`    email:    ${GOLDEN_BITES_ADMIN_EMAIL}`);
    console.log(`    password: ${GOLDEN_BITES_ADMIN_PASSWORD}`);
    console.log(
      '  CHANGE THIS PASSWORD before using the system outside development.',
    );
    console.log(
      '=================================================================\n',
    );
  }

  await syncSystemRolePermissions(businessId, rolesService);
}

/**
 * The first account of POS-ADMIN (the Golden Bites team's Admin), when there
 * is none yet: POS-ADMIN needs an account to sign in with before it can do
 * anything (bootstrap problem). Seeded here because this seed is what every
 * deploy already runs against the shared database.
 */
async function seedPlatformAdmin(db: DatabaseService): Promise<void> {
  const existing = await db.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM platform_users',
  );
  const created =
    Number(existing.rows[0].count) === 0 &&
    (
      await db.query(
        `INSERT INTO platform_users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, 'Super', 'Admin')`,
        [PLATFORM_ADMIN_EMAIL, await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 12)],
      )
    ).rowCount > 0;
  if (!created) {
    console.log('Platform accounts already exist, skipping creation.');
    return;
  }
  console.log(
    '\n=================================================================',
  );
  console.log('  Platform account (Admin app) created:');
  console.log(`    email:    ${PLATFORM_ADMIN_EMAIL}`);
  console.log(`    password: ${PLATFORM_ADMIN_PASSWORD}`);
  console.log(
    '  CHANGE THIS PASSWORD before using the system outside development.',
  );
  console.log(
    '=================================================================\n',
  );
}

/** Re-applies DEFAULT_ROLE_PERMISSIONS to every system role, granting any newly added codes. */
async function syncSystemRolePermissions(
  businessId: string,
  rolesService: RolesService,
): Promise<void> {
  const roles = await rolesService.findAllForBusiness(businessId);
  let syncedCount = 0;

  for (const roleName of SYSTEM_ROLES) {
    const role = roles.find((r) => r.name === roleName);
    if (!role) {
      continue;
    }
    await rolesService.setPermissions(
      businessId,
      role.id,
      DEFAULT_ROLE_PERMISSIONS[roleName],
    );
    syncedCount += 1;
  }

  console.log(`Synced permissions for ${syncedCount} system role(s).`);
}

async function run(): Promise<void> {
  await runSqlSeeds();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const db = app.get(DatabaseService);
    await seedPermissionsCatalog(db);
    await seedPlatformAdmin(db);
    await seedGoldenBites(
      db,
      app.get(BusinessesService),
      app.get(BranchesService),
      app.get(RolesService),
      app.get(UsersService),
    );
    console.log('Seeding complete.');
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(
    'Seed run failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
