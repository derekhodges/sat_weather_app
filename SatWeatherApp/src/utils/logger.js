/**
 * Production-safe logging utility
 *
 * SECURITY/PERFORMANCE: Console.log statements cause 5-10% slowdown on low-end devices
 * and can leak sensitive information in production logs. This utility:
 * - Disables all logging in production builds
 * - Provides structured logging with categories
 * - Automatically filters sensitive data
 */

// Check if we're in development mode
const __DEV__ = process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_APP_ENV !== 'production';

// Sensitive keys that should never be logged
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apiKey', 'latitude', 'longitude', 'coords'];

/**
 * Sanitize object to remove sensitive data before logging
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
const sanitize = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const sanitized = {};
  for (const key in data) {
    if (SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object') {
      sanitized[key] = sanitize(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
};

/**
 * Logger object with category-based methods
 * All methods are no-ops in production
 */
const logger = {
  // Standard logging
  log: __DEV__ ? console.log.bind(console) : () => {},
  info: __DEV__ ? console.info.bind(console) : () => {},
  warn: __DEV__ ? console.warn.bind(console) : () => {},
  error: console.error.bind(console), // Always log errors, even in production
  debug: __DEV__ ? console.debug.bind(console) : () => {},

  // Category-specific logging with auto-sanitization
  location: __DEV__
    ? (...args) => console.log('[LOCATION]', ...args.map(sanitize))
    : () => {},

  cache: __DEV__
    ? (...args) => console.log('[CACHE]', ...args)
    : () => {},

  network: __DEV__
    ? (...args) => console.log('[NETWORK]', ...args)
    : () => {},

  geo: __DEV__
    ? (...args) => console.log('[GEO]', ...args)
    : () => {},

  inspector: __DEV__
    ? (...args) => console.log('[INSPECTOR]', ...args)
    : () => {},

  auth: __DEV__
    ? (...args) => console.log('[AUTH]', ...args.map(sanitize))
    : () => {},

  autoRefresh: __DEV__
    ? (...args) => console.log('[AUTO-REFRESH]', ...args)
    : () => {},

  privacy: __DEV__
    ? (...args) => console.log('[PRIVACY]', ...args.map(sanitize))
    : () => {},

  // Performance tracking (always enabled but rate-limited)
  perf: (() => {
    let lastPerfLog = 0;
    return (label, ...args) => {
      const now = Date.now();
      if (now - lastPerfLog > 1000) { // Rate limit to once per second
        lastPerfLog = now;
        if (__DEV__) {
          console.log(`[PERF] ${label}`, ...args);
        }
      }
    };
  })(),
};

export default logger;
export { __DEV__, sanitize };
