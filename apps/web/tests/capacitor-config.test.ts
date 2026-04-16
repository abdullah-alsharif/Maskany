import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import capacitorConfig from '../capacitor.config';

const packageRoot = resolve(__dirname, '..');

const readJson = (relativePath: string): Record<string, unknown> => {
  const contents = readFileSync(resolve(packageRoot, relativePath), 'utf8');
  return JSON.parse(contents) as Record<string, unknown>;
};

describe('Capacitor configuration', () => {
  it('exports the Maskany app identity', () => {
    expect(capacitorConfig.appId).toBe('com.maskany.app');
    expect(capacitorConfig.appName).toBe('Maskany');
  });

  it('points webDir at the Next.js out directory', () => {
    expect(capacitorConfig.webDir).toBe('out');
  });

  it('configures a localhost dev server URL with cleartext traffic', () => {
    expect(capacitorConfig.server).toBeDefined();
    expect(capacitorConfig.server?.url).toBe('http://localhost:5173');
    expect(capacitorConfig.server?.cleartext).toBe(true);
    expect(capacitorConfig.server?.androidScheme).toBe('https');
  });

  it('configures the SplashScreen plugin to auto-hide after app load', () => {
    const splash = capacitorConfig.plugins?.SplashScreen;
    expect(splash).toBeDefined();
    expect(splash?.launchAutoHide).toBe(true);
    expect(typeof splash?.launchShowDuration).toBe('number');
    expect(splash?.backgroundColor).toBe('#fdfcfa');
  });

  it('configures the StatusBar plugin with light content and iOS overlay', () => {
    const statusBar = capacitorConfig.plugins?.StatusBar;
    expect(statusBar).toBeDefined();
    expect(statusBar?.style).toBe('LIGHT');
    expect(statusBar?.overlaysWebView).toBe(true);
  });

  it('configures the Keyboard plugin with resize mode and scroll behavior', () => {
    const keyboard = capacitorConfig.plugins?.Keyboard;
    expect(keyboard).toBeDefined();
    expect(keyboard?.resize).toBe('body');
    expect(keyboard?.resizeOnFullScreen).toBe(true);
  });

  it('sets iOS content inset to always to keep content clear of safe areas', () => {
    expect(capacitorConfig.ios?.contentInset).toBe('always');
  });
});

describe('@maskany/web Capacitor package metadata', () => {
  it('declares Capacitor runtime and plugin dev dependencies', () => {
    const pkg = readJson('package.json') as { devDependencies?: Record<string, string> };
    const deps = pkg.devDependencies ?? {};
    for (const name of [
      '@capacitor/core',
      '@capacitor/cli',
      '@capacitor/status-bar',
      '@capacitor/splash-screen',
      '@capacitor/keyboard',
      '@capacitor/haptics',
    ]) {
      expect(deps[name], `missing Capacitor dependency ${name}`).toBeTypeOf('string');
    }
  });

  it('declares cap:add, cap:sync, and cap:open scripts', () => {
    const pkg = readJson('package.json') as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    expect(scripts['cap:add']).toContain('cap add');
    expect(scripts['cap:sync']).toContain('cap sync');
    expect(scripts['cap:open']).toContain('cap open');
  });
});
