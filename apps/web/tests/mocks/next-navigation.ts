/**
 * Test implementation of next/navigation for vitest.
 *
 * Aliased via vitest.config.ts resolve.alias so components that import
 * next/navigation get these implementations during unit tests. Provides
 * stateful router tracking so tests can assert navigation calls.
 */

let _pathname = '/';
let _search = '';
const _pushHistory: string[] = [];
const _replaceHistory: string[] = [];

/** Set the simulated current URL (call in beforeEach for routing tests). */
export function setCurrentPath(url: string) {
  const [pathname, search = ''] = url.split('?');
  _pathname = pathname;
  _search = search;
}

/** Returns all paths passed to router.push since last resetRouter(). */
export function getPushedPaths(): readonly string[] {
  return _pushHistory;
}

/** Returns all paths passed to router.replace since last resetRouter(). */
export function getReplacedPaths(): readonly string[] {
  return _replaceHistory;
}

let _params: Record<string, string> = {};

/** Set the simulated route params (call in test setup for dynamic routes). */
export function setParams(params: Record<string, string>) {
  _params = { ...params };
}

/** Reset router state between tests. */
export function resetRouter() {
  _pathname = '/';
  _search = '';
  _params = {};
  _pushHistory.length = 0;
  _replaceHistory.length = 0;
}

export function usePathname(): string {
  return _pathname;
}

export function useRouter() {
  return {
    push(url: string) {
      _pushHistory.push(url);
      const [p, s = ''] = url.split('?');
      _pathname = p;
      _search = s;
    },
    replace(url: string) {
      _replaceHistory.push(url);
      const [p, s = ''] = url.split('?');
      _pathname = p;
      _search = s;
    },
    back() {},
    forward() {},
    refresh() {},
    prefetch() {},
  };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(_search);
}

export function useParams(): Record<string, string> {
  return { ..._params };
}

export function redirect(path: string): never {
  _replaceHistory.push(path);
  _pathname = path;
  // In real Next.js this throws; in tests we just track it.
  throw new Error(`REDIRECT:${path}`);
}

export function notFound(): never {
  throw new Error('NOT_FOUND');
}
