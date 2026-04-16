/**
 * Cross-package Vitest workspace configuration.
 *
 * Running `pnpm vitest` from the repo root executes the test suites of both
 * the API (node environment) and web (happy-dom environment) packages. Each
 * package owns its runtime configuration via `vitest.config.ts`.
 */
export default ['apps/api/vitest.config.ts', 'apps/web/vitest.config.ts'];
