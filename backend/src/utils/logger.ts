const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

type LogLevel = keyof typeof LOG_LEVELS;

const getTimestamp = (): string => new Date().toISOString();

const colorize = (level: LogLevel, message: string): string => {
  const colors: Record<LogLevel, string> = {
    error: "\x1b[31m", // Red
    warn: "\x1b[33m",  // Yellow
    info: "\x1b[36m",  // Cyan
    debug: "\x1b[35m", // Magenta
  };
  const reset = "\x1b[0m";
  return `${colors[level]}[${level.toUpperCase()}]${reset} ${message}`;
};

const log = (level: LogLevel, message: string, ...args: unknown[]): void => {
  const timestamp = getTimestamp();
  const formattedMessage = `${timestamp} ${colorize(level, message)}`;

  if (args.length > 0) {
    console[level === "debug" ? "log" : level](formattedMessage, ...args);
  } else {
    console[level === "debug" ? "log" : level](formattedMessage);
  }
};

export const logger = {
  error: (message: string, ...args: unknown[]) => log("error", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
};
