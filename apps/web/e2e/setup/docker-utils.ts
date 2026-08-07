/**
 * Docker Compose utilities for the E2E test suite.
 *
 * One place that owns starting, stopping, and health-checking the test
 * PostgreSQL container on :5433.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// e2e/setup -> repo root (where docker-compose.test.yml lives)
const COMPOSE_FILE = path.resolve(__dirname, '../../../../docker-compose.test.yml');

export const TEST_POSTGRES_HOST = 'localhost';
export const TEST_POSTGRES_PORT = 5433;

/**
 * Execute a docker compose command against the test compose file.
 *
 * Every call carries a timeout so a hung docker daemon fails the suite with
 * a clear error instead of blocking setup/teardown indefinitely.
 */
function dockerCompose(
  command: string,
  options: { silent?: boolean; timeoutMs?: number } = {},
): string {
  const cmd = `docker compose -f "${COMPOSE_FILE}" ${command}`;
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      timeout: options.timeoutMs ?? 120_000,
    });
    return result || '';
  } catch (error) {
    if (!options.silent) {
      console.error(`Docker compose command failed: ${cmd}`);
    }
    throw error;
  }
}

/**
 * Check whether the test Postgres container is already running.
 */
export function isTestEnvironmentRunning(): boolean {
  try {
    const result = dockerCompose('ps --format json', { silent: true });
    if (!result.trim()) return false;
    const containers = result
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    return containers.some(
      (c: { Name: string; State: string }) =>
        c.Name === 'maskany-postgres-test' && c.State === 'running',
    );
  } catch {
    return false;
  }
}

/**
 * Start the test Postgres container and wait for the healthcheck to pass
 * (`pg_isready`). Uses `up -d --wait`.
 */
export function startTestEnvironment(): void {
  console.log('🐳 Starting E2E test environment...');
  if (isTestEnvironmentRunning()) {
    console.log('✅ Test environment already running');
    return;
  }
  // `up -d --wait` must tolerate a cold-start image pull on fresh CI
  // machines, so it gets a longer budget than the default 120s.
  dockerCompose('up -d --wait', { timeoutMs: 300_000 });
  console.log(
    `✅ Test environment ready (PostgreSQL: ${TEST_POSTGRES_HOST}:${TEST_POSTGRES_PORT})`,
  );
}

/**
 * Stop the test Postgres container and remove its volume.
 */
export function stopTestEnvironment(): void {
  console.log('🛑 Stopping E2E test environment...');
  try {
    dockerCompose('down -v', { silent: true });
    console.log('✅ Test environment stopped');
  } catch {
    console.warn('⚠️  Failed to stop test environment (may not have been running)');
  }
}
