// Logger for AI Engine
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[AI-INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[AI-ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[AI-WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AI-DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
};