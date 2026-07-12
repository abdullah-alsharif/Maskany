import pino from 'pino';

export const pinoInstance = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token'],
    censor: '[REDACTED]',
  },
});

function format(args: unknown[]): [string, ...unknown[]] {
  const msg = typeof args[0] === 'string' ? (args.shift() as string) : '';
  return [msg, ...args];
}

function wrap(instance: pino.Logger) {
  return {
    info: (...args: unknown[]) => {
      const [msg, ...rest] = format(args);
      instance.info(rest.length > 0 ? { args: rest } : undefined, msg);
    },
    warn: (...args: unknown[]) => {
      const [msg, ...rest] = format(args);
      instance.warn(rest.length > 0 ? { args: rest } : undefined, msg);
    },
    error: (...args: unknown[]) => {
      const [msg, ...rest] = format(args);
      instance.error(rest.length > 0 ? { args: rest } : undefined, msg);
    },
  };
}

export const logger = wrap(pinoInstance);
