import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type pino from 'pino';
import pinoHttp from 'pino-http';

export interface CreateRequestLoggerOptions {
  logger: pino.Logger;
}

export function createRequestLogger({ logger }: CreateRequestLoggerOptions) {
  return pinoHttp({
    logger,
    genReqId: (req: IncomingMessage) => {
      const id = randomUUID();
      (req as unknown as { requestId: string }).requestId = id;
      (req as IncomingMessage & { res?: ServerResponse }).res?.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel(_req: IncomingMessage, res: ServerResponse, err?: Error) {
      if (err) return 'error';
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage(_req: IncomingMessage, res: ServerResponse, responseTime: number) {
      return `request completed ${res.statusCode} ${responseTime}ms`;
    },
    customSuccessObject(_req: IncomingMessage, res: ServerResponse, val: Record<string, unknown>) {
      const responseTime = val.responseTime as number;
      if (responseTime > 500) {
        val.slow = true;
      }
      return val;
    },
    customErrorMessage(_req: IncomingMessage, _res: ServerResponse, err: Error) {
      return `request error ${err.message}`;
    },
    customAttributeKeys: {
      reqId: 'requestId',
    },
    serializers: {
      req: (req: IncomingMessage) => ({
        method: req.method,
        url: req.url,
        id: req.id,
        hostname: req.headers.host,
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
      }),
    },
  });
}
