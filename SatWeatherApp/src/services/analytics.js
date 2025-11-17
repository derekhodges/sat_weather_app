/**
 * Analytics and Error Logging Service
 *
 * Tracks user behavior, feature usage, and logs errors for debugging.
 * Uses a simple in-memory queue that can be flushed to your backend or
 * integrated with services like Mixpanel, Amplitude, or Firebase Analytics.
 *
 * For production, replace the mock implementation with your preferred analytics provider.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Analytics event queue
let eventQueue = [];
const MAX_QUEUE_SIZE = 100;
const FLUSH_INTERVAL_MS = 60000; // 1 minute
let flushIntervalId = null;

// Error log storage
const ERROR_LOG_KEY = '@sat_weather_error_log';
const MAX_ERROR_LOGS = 50;

// Session tracking
let sessionId = null;
let sessionStartTime = null;

/**
 * Initialize analytics service
 * Call this once when the app starts (in App.js)
 */
export const initAnalytics = async () => {
  // Generate session ID
  sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStartTime = Date.now();

  // Track app open
  trackEvent('app_opened', {
    platform: Platform.OS,
    version: Platform.Version,
    timestamp: new Date().toISOString(),
  });

  // Start periodic flush
  if (flushIntervalId) clearInterval(flushIntervalId);
  flushIntervalId = setInterval(flushEvents, FLUSH_INTERVAL_MS);

  console.log('[ANALYTICS] Initialized with session:', sessionId);
};

/**
 * Shutdown analytics (call on app close)
 */
export const shutdownAnalytics = async () => {
  if (flushIntervalId) {
    clearInterval(flushIntervalId);
    flushIntervalId = null;
  }

  // Track session end
  const sessionDuration = Date.now() - sessionStartTime;
  trackEvent('app_closed', {
    session_duration_ms: sessionDuration,
    session_duration_minutes: Math.round(sessionDuration / 60000),
  });

  // Final flush
  await flushEvents();
};

/**
 * Track an analytics event
 * @param {string} eventName - Name of the event
 * @param {Object} properties - Additional event properties
 */
export const trackEvent = (eventName, properties = {}) => {
  const event = {
    name: eventName,
    timestamp: Date.now(),
    session_id: sessionId,
    properties: {
      ...properties,
      platform: Platform.OS,
    },
  };

  eventQueue.push(event);

  // Trim queue if too large
  if (eventQueue.length > MAX_QUEUE_SIZE) {
    eventQueue = eventQueue.slice(-MAX_QUEUE_SIZE);
  }

  // Log in development
  if (__DEV__) {
    console.log(`[ANALYTICS] ${eventName}`, properties);
  }
};

/**
 * Track screen view
 * @param {string} screenName - Name of the screen
 */
export const trackScreenView = (screenName) => {
  trackEvent('screen_view', { screen_name: screenName });
};

/**
 * Track feature usage
 * @param {string} featureName - Name of the feature used
 * @param {Object} details - Additional details
 */
export const trackFeatureUsage = (featureName, details = {}) => {
  trackEvent('feature_used', { feature: featureName, ...details });
};

/**
 * Track subscription-related events
 * @param {string} action - Action taken (view_plans, upgrade_prompt, subscribe, etc.)
 * @param {Object} details - Additional details
 */
export const trackSubscriptionEvent = (action, details = {}) => {
  trackEvent('subscription', { action, ...details });
};

/**
 * Track errors with context
 * @param {Error|string} error - The error object or message
 * @param {string} context - Where the error occurred
 * @param {Object} additionalInfo - Extra debugging info
 */
export const logError = async (error, context, additionalInfo = {}) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    context,
    message: error.message || error.toString(),
    stack: error.stack || null,
    platform: Platform.OS,
    platform_version: Platform.Version,
    ...additionalInfo,
  };

  // Track as analytics event
  trackEvent('error', {
    context,
    message: errorLog.message,
  });

  // Store locally for later retrieval
  try {
    const existingLogs = await getErrorLogs();
    const updatedLogs = [...existingLogs, errorLog].slice(-MAX_ERROR_LOGS);
    await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
  } catch (storageError) {
    console.error('[ANALYTICS] Failed to store error log:', storageError);
  }

  // Always log to console
  console.error(`[ERROR] ${context}:`, error);
};

/**
 * Get stored error logs
 * @returns {Promise<Array>} Array of error log objects
 */
export const getErrorLogs = async () => {
  try {
    const logsJson = await AsyncStorage.getItem(ERROR_LOG_KEY);
    return logsJson ? JSON.parse(logsJson) : [];
  } catch (error) {
    console.error('[ANALYTICS] Failed to retrieve error logs:', error);
    return [];
  }
};

/**
 * Clear error logs
 */
export const clearErrorLogs = async () => {
  try {
    await AsyncStorage.removeItem(ERROR_LOG_KEY);
  } catch (error) {
    console.error('[ANALYTICS] Failed to clear error logs:', error);
  }
};

/**
 * Flush event queue to backend
 * Replace this with your actual analytics backend integration
 */
export const flushEvents = async () => {
  if (eventQueue.length === 0) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  try {
    // TODO: Replace with actual backend call
    // Example with a REST API:
    // await fetch('https://your-analytics-backend.com/events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     events: eventsToSend,
    //     app_version: '1.0.0',
    //   }),
    // });

    // For now, just log in development
    if (__DEV__) {
      console.log(`[ANALYTICS] Would flush ${eventsToSend.length} events to backend`);
    }

    // Store locally as backup
    await storeEventsLocally(eventsToSend);
  } catch (error) {
    // Re-add events to queue on failure
    eventQueue = [...eventsToSend, ...eventQueue].slice(-MAX_QUEUE_SIZE);
    console.error('[ANALYTICS] Failed to flush events:', error);
  }
};

/**
 * Store events locally as backup
 */
const storeEventsLocally = async (events) => {
  try {
    const key = `@analytics_events_${Date.now()}`;
    await AsyncStorage.setItem(key, JSON.stringify(events));

    // Clean up old stored events (keep last 10 batches)
    const allKeys = await AsyncStorage.getAllKeys();
    const analyticsKeys = allKeys.filter(k => k.startsWith('@analytics_events_'));
    if (analyticsKeys.length > 10) {
      const keysToRemove = analyticsKeys.sort().slice(0, -10);
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (error) {
    console.error('[ANALYTICS] Failed to store events locally:', error);
  }
};

/**
 * Get analytics summary for debugging
 * @returns {Object} Summary of analytics data
 */
export const getAnalyticsSummary = async () => {
  const errorLogs = await getErrorLogs();
  return {
    session_id: sessionId,
    session_start: sessionStartTime ? new Date(sessionStartTime).toISOString() : null,
    session_duration_minutes: sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 60000) : 0,
    queued_events: eventQueue.length,
    stored_errors: errorLogs.length,
    recent_errors: errorLogs.slice(-5),
  };
};

// Common tracking helpers

/**
 * Track domain selection
 */
export const trackDomainSelection = (domain) => {
  trackFeatureUsage('domain_selection', {
    domain_id: domain?.id || domain?.name || 'unknown',
    domain_type: domain?.type || 'unknown',
  });
};

/**
 * Track product/channel selection
 */
export const trackProductSelection = (product, viewMode) => {
  trackFeatureUsage('product_selection', {
    product_id: product?.id || product?.number || 'unknown',
    product_name: product?.name || 'unknown',
    view_mode: viewMode,
  });
};

/**
 * Track animation usage
 */
export const trackAnimationUsage = (isPlaying, frameCount) => {
  trackFeatureUsage('animation', {
    action: isPlaying ? 'play' : 'stop',
    frame_count: frameCount,
  });
};

/**
 * Track share action
 */
export const trackShare = (type) => {
  trackFeatureUsage('share', { type }); // screenshot, gif, etc.
};

/**
 * Track overlay toggle
 */
export const trackOverlayToggle = (overlayId, enabled) => {
  trackFeatureUsage('overlay_toggle', {
    overlay_id: overlayId,
    enabled,
  });
};

/**
 * Track upgrade prompt shown
 */
export const trackUpgradePromptShown = (feature) => {
  trackSubscriptionEvent('upgrade_prompt_shown', { feature });
};

/**
 * Track subscription screen opened
 */
export const trackSubscriptionScreenOpened = () => {
  trackSubscriptionEvent('screen_opened');
};

/**
 * Track purchase attempt
 */
export const trackPurchaseAttempt = (tier, period) => {
  trackSubscriptionEvent('purchase_attempt', { tier, period });
};

/**
 * Track purchase success
 */
export const trackPurchaseSuccess = (tier, period) => {
  trackSubscriptionEvent('purchase_success', { tier, period });
};

/**
 * Track tutorial interaction
 */
export const trackTutorialStep = (step, action) => {
  trackFeatureUsage('tutorial', { step, action });
};
