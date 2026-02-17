type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_PRIORITIES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LEVEL: LogLevel = 'info';

function normalizeLevel(value: string | undefined): LogLevel {
  if (!value) return DEFAULT_LEVEL;
  const lowered = value.toLowerCase();
  if (lowered === 'debug' || lowered === 'info' || lowered === 'warn' || lowered === 'error') {
    return lowered;
  }
  return DEFAULT_LEVEL;
}

const configuredLevel = normalizeLevel(process.env.BUN_SERVER_LOG_LEVEL ?? process.env.LOG_LEVEL);

function canLog(level: LogLevel) {
  return LOG_PRIORITIES[level] >= LOG_PRIORITIES[configuredLevel];
}

function stringifyMeta(meta?: Record<string, unknown>) {
  if (!meta || Object.keys(meta).length === 0) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' {"meta":"unserializable"}';
  }
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!canLog(level)) return;

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${stringifyMeta(meta)}`;

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};

