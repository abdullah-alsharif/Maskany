/**
 * Custom Playwright fixtures for the Maskany E2E suite.
 *
 * Follows a strict isolation pattern: every test derives
 * its own unique identifiers (phone, email, name, titles) from
 * `testInfo.testId`, so parallel workers can never collide on the unique
 * phone/email indexes or on per-user state. Mutating tests get a fresh
 * `browserUser` / `ownerUser` that is created before the test and deleted
 * (cascade) after it — including after failures.
 *
 * Because `globalSetup` truncates and re-seeds the database before every
 * run, identifiers only need to be unique within a single run; `testId`
 * gives us that, and the idempotent `createTestUser` covers retries.
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
 * Canonical seeded property titles (apps/api/src/scripts/seed.ts). The seed
 * gives them deterministic `created_at` (array order = newest first) and
 * stable titles, so the two newest seeds always sit on the first page of
 * the home grid — even while parallel fixture tests create and delete
 * their own (newer) properties. Tests that click "the first card" must use
 * these instead, otherwise they can pick up a fixture property that is
 * deleted mid-test by its owner's teardown.
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
   * The newest seeded properties (never deleted during a run). Tests that
   * need a stable property to click/favorite should use these instead of
   * whatever card happens to be first in the grid.
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

  // Owner fixtures use a different phone/email space than the browser user
  // (same test id): when a test needs BOTH (e.g. reviews), `createTestUser`'s
  // idempotent "delete existing row with this phone" must not wipe the other
  // fixture's user (and cascade-delete its property).
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
      phone: `+96651${uniqueData.suffix}`,
      email: `owner-${uniqueData.suffix}@test.example.com`,
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
