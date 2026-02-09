import { format } from 'node:util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function serializeUnknown(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeUnknown);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, serializeUnknown(inner)])
    );
  }

  return value;
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: serializeUnknown(context) } : {}),
  };

  const serialized = `${JSON.stringify(payload)}\n`;
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(serialized);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};

let consoleBridgeInstalled = false;

export function installConsoleBridge(): void {
  if (consoleBridgeInstalled) {
    return;
  }
  consoleBridgeInstalled = true;

  const bridge = (method: 'log' | 'info' | 'warn' | 'error' | 'debug', level: LogLevel) => {
    console[method] = (...args: unknown[]) => {
      logger[level]('console_bridge', {
        method,
        formatted: format(...args),
        args: args.map((arg) => serializeUnknown(arg)),
      });
    };
  };

  bridge('log', 'info');
  bridge('info', 'info');
  bridge('warn', 'warn');
  bridge('error', 'error');
  bridge('debug', 'debug');
}

export default logger;
