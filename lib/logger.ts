type LogLevel = 'error' | 'warn' | 'info' | 'debug';

class Logger {
  private static instance: Logger;
  
  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  error(message: string, ...args: any[]) {
    console.error(message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(message, ...args);
  }

  info(message: string, ...args: any[]) {
    // Only log info if explicitly enabled
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log(message, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    // Only log debug if explicitly enabled
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.debug(message, ...args);
    }
  }

  api(statusCode: number, message: string, ...args: any[]) {
    // Only log non-200 status codes
    if (statusCode >= 400) {
      this.error(`[API] ${message}`, ...args);
    } else if (statusCode >= 300) {
      this.warn(`[API] ${message}`, ...args);
    } else {
      // For 200s, only log if debug is enabled
      this.debug(`[API] ${message}`, ...args);
    }
  }
}

const logger = Logger.getInstance();
export default logger; 