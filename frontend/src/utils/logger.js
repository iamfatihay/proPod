/**
 * Logger utility that conditionally logs based on environment
 * In prod, logs are disabled to improve performance and security
 */

const isDev = __DEV__;

class Logger {
    static log(...args) {
        if (isDev) {
            console.log(...args);
        }
    }

    static warn(...args) {
        if (isDev) {
            console.warn(...args);
        }
    }

    static error(...args) {
        // Always log errors, even in prod
        console.error(...args);
    }

    static info(...args) {
        if (isDev) {
            console.info(...args);
        }
    }

    static debug(...args) {
        if (isDev) {
            console.log("[DEBUG]", ...args);
        }
    }
}

export default Logger;
