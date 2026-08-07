/**
 * Custom Playwright fixtures: every test derives unique identifiers (phone,
 * email, name, titles) from testInfo.testId so parallel workers never collide.
 * Mutating tests get a fresh user created before and cascade-deleted after —
 * including after failures. globalSetup re-seeds before each run, so
 * identifiers only need uniqueness within a run.
 */
import { test as base, type TestInfo } from '@playwright/test';
import {
  createTestProperty,
  createTestUser,
  deleteTestUser,
  type TestProperty,
  type TestUser,
} from './test-data';
import { getPool } from './test-helpers';

/**
 * Canonical seeded titles (apps/api/src/scripts/seed.ts) — the newest seeds
 * always sit on the first page and are never deleted mid-run, unlike
 * fixture properties owned by parallel tests.
 */
export const SEED_PROPERTY_TITLES = [
  'Modern 2BR Apartment in Al Olaya',
  'Cozy Studio Near Diplomatic Quarter',
] as const;

export interface UniqueData {
  /** Deterministic 8-digit suffix derived from the test id. */
  suffix: string;
  /** Unique E.164 phone: +966 + 50 + suffix (13 chars, passes PHONE_REGEX). */
  phone: string;
  /** Country-code dropdown value for the login/register forms. */
  countryCode: string;
  /** Local phone number (without country code) for the forms. */
  phoneLocal: string;
  /** Unique email for email-OTP flows. */
  email: string;
  /** Unique display name. */
  fullName: string;
  /** Unique property title prefix; append a purpose label when needed. */
  title(what: string): string;
}

function buildUniqueData(testInfo: TestInfo): UniqueData {
  const suffix = testInfo.testId.replace(/\D/g, '').slice(-8).padStart(8, '0');
  return {
    suffix,
    phone: `+96650${suffix}`,
    countryCode: '+966',
    phoneLocal: `50${suffix}`,
    email: `e2e-${suffix}@test.example.com`,
    fullName: `E2E User ${suffix}`,
    title: (what: string) => `E2E ${what} ${suffix}`,
  };
}

type Fixtures = {
  /** Per-test unique identifiers — the building block for every other fixture. */
  uniqueData: UniqueData;
  /** Fresh BROWSER user, owned and cleaned up by the test. */
  browserUser: TestUser;
  /** Fresh OWNER user, owned and cleaned up by the test. */
  ownerUser: TestUser;
  /** Fresh OWNER user plus one property they own (both cleaned up). */
  ownerWithProperty: { owner: TestUser; property: TestProperty };
  /**
   * The newest seeded properties — never deleted during a run; use these
   * instead of whatever card happens to be first in the grid.
   */
  seedProperties: Array<{ id: string; title: string }>;
};

export const test = base.extend<Fixtures>({
  uniqueData: async ({}, use, testInfo) => {
    await use(buildUniqueData(testInfo));
  },

  browserUser: async ({ uniqueData }, use) => {
    const user = await createTestUser({
      fullName: uniqueData.fullName,
      phone: uniqueData.phone,
      email: uniqueData.email,
      userType: 'BROWSER',
    });
    await use(user);
    await deleteTestUser(user.id);
  },

  // Fixture phone/email spaces are distinct (browser 50, owner 51,
  // owner-with-property 52) so createTestUser's pre-delete never wipes a
  // sibling fixture's user (and cascade-deletes its property).
  ownerUser: async ({ uniqueData }, use) => {
    const user = await createTestUser({
      fullName: uniqueData.fullName,
      phone: `+96651${uniqueData.suffix}`,
      email: `owner-${uniqueData.suffix}@test.example.com`,
      userType: 'OWNER',
    });
    await use(user);
    await deleteTestUser(user.id);
  },

  ownerWithProperty: async ({ uniqueData }, use) => {
    const owner = await createTestUser({
      fullName: uniqueData.fullName,
      phone: `+96652${uniqueData.suffix}`,
      email: `owner-prop-${uniqueData.suffix}@test.example.com`,
      userType: 'OWNER',
    });
    const property = await createTestProperty({
      ownerId: owner.id,
      title: uniqueData.title('Property'),
    });
    await use({ owner, property });
    await deleteTestUser(owner.id);
  },

  seedProperties: async ({}, use) => {
    const pool = getPool();
    const result = await pool.query<{ id: string; title: string }>(
      `SELECT id, title FROM properties WHERE title = ANY($1) ORDER BY created_at DESC`,
      [SEED_PROPERTY_TITLES as unknown as string[]],
    );
    await use(result.rows);
  },
});

export { expect } from '@playwright/test';
