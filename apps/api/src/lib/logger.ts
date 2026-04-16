import pino from 'pino';

const pinoInstance = pino({
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

export const logger = {
  info: (...args: unknown[]) => {
    const [msg, ...rest] = format(args);
    pinoInstance.info(rest.length > 0 ? { args: rest } : undefined, msg);
  },
  warn: (...args: unknown[]) => {
    const [msg, ...rest] = format(args);
    pinoInstance.warn(rest.length > 0 ? { args: rest } : undefined, msg);
  },
  error: (...args: unknown[]) => {
    const [msg, ...rest] = format(args);
    pinoInstance.error(rest.length > 0 ? { args: rest } : undefined, msg);
  },
};
