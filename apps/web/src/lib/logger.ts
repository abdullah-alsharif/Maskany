interface LogContext {
  [key: string]: unknown;
}

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function formatEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  return entry;
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const entry = formatEntry(level, message, context);

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry));
      break;
    case 'warn':
      console.warn(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info(message: string, context?: LogContext): void {
    write('info', message, context);
  },
  warn(message: string, context?: LogContext): void {
    write('warn', message, context);
  },
  error(message: string, context?: LogContext): void {
    write('error', message, context);
  },
};
