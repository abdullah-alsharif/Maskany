import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';

describe('server.ts bootstrap', () => {
  const originalPort = process.env.PORT;
  let httpServer: Server | undefined;

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('starts the HTTP server on the configured PORT', async () => {
    process.env.PORT = '0';

    const mod = await import('../src/server.js');
    httpServer = mod.httpServer;

    await new Promise<void>((resolve) => {
      if (httpServer?.listening) {
        resolve();
        return;
      }
      httpServer?.once('listening', () => resolve());
    });

    const address = httpServer.address() as AddressInfo | null;
    expect(address).not.toBeNull();
    expect(address?.port).toBeGreaterThan(0);
  });
});
