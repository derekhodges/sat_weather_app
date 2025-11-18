/**
 * Feedback Service
 *
 * Handles user feedback submission including bug reports, feature requests,
 * and general feedback. Integrates with analytics service to attach error logs.
 */

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { getErrorLogs, trackEvent } from './analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FEEDBACK_STORAGE_KEY = '@sat_weather_feedback_queue';
const MAX_QUEUED_FEEDBACK = 20;

/**
 * Feedback categories
 */
export const FeedbackCategory = {
  BUG_REPORT: 'bug_report',
  FEATURE_REQUEST: 'feature_request',
  GENERAL: 'general',
  PERFORMANCE: 'performance',
  UI_UX: 'ui_ux',
};

/**
 * Get device information for feedback context
 */
const getDeviceInfo = () => {
  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    // For more detailed device info, expo-device can be added later if needed
  };
};

/**
 * Submit feedback to Supabase
 * @param {Object} feedbackData - Feedback information
 * @param {string} feedbackData.message - User's feedback message
 * @param {string} feedbackData.category - Feedback category
 * @param {string} feedbackData.email - Optional user email for follow-up
 * @param {boolean} feedbackData.includeErrorLogs - Whether to attach error logs
 * @param {string} feedbackData.userId - Optional user ID if authenticated
 * @returns {Promise<Object>} Result object with success status
 */
export const submitFeedback = async ({
  message,
  category = FeedbackCategory.GENERAL,
  email = null,
  includeErrorLogs = false,
  userId = null,
}) => {
  try {
    // Validate required fields
    if (!message || message.trim().length === 0) {
      throw new Error('Feedback message is required');
    }

    // Get device info
    const deviceInfo = getDeviceInfo();

    // Get error logs if requested
    let errorLogs = null;
    if (includeErrorLogs) {
      const logs = await getErrorLogs();
      // Only include recent errors (last 10)
      errorLogs = logs.slice(-10);
    }

    // Prepare feedback payload
    const feedbackPayload = {
      message: message.trim(),
      category,
      email: email?.trim() || null,
      user_id: userId,
      platform: deviceInfo.platform,
      platform_version: deviceInfo.platformVersion?.toString() || null,
      error_logs: errorLogs,
      app_version: '1.0.0', // TODO: Get from app.json or package.json
      submitted_at: new Date().toISOString(),
    };

    // Track feedback submission event
    trackEvent('feedback_submitted', {
      category,
      has_email: !!email,
      includes_errors: includeErrorLogs,
      error_count: errorLogs?.length || 0,
    });

    // If Supabase is configured, send directly
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('user_feedback')
        .insert([feedbackPayload])
        .select();

      if (error) {
        throw error;
      }

      console.log('[FEEDBACK] Submitted successfully:', data?.[0]?.id);

      return {
        success: true,
        id: data?.[0]?.id,
        message: 'Thank you for your feedback!',
      };
    } else {
      // Queue locally if Supabase not configured
      await queueFeedbackLocally(feedbackPayload);

      console.log('[FEEDBACK] Queued locally (Supabase not configured)');

      return {
        success: true,
        queued: true,
        message: 'Feedback saved locally. It will be submitted when connection is available.',
      };
    }
  } catch (error) {
    console.error('[FEEDBACK] Submission failed:', error);

    // Try to queue locally as fallback
    try {
      await queueFeedbackLocally({
        message,
        category,
        email,
        error_logs: includeErrorLogs ? await getErrorLogs() : null,
        submitted_at: new Date().toISOString(),
        platform: Platform.OS,
      });

      return {
        success: false,
        queued: true,
        error: error.message,
        message: 'Feedback saved locally. It will be submitted when connection is available.',
      };
    } catch (queueError) {
      return {
        success: false,
        queued: false,
        error: error.message,
        message: 'Failed to submit feedback. Please try again later.',
      };
    }
  }
};

/**
 * Queue feedback locally when submission fails or Supabase is not configured
 */
const queueFeedbackLocally = async (feedbackData) => {
  try {
    const existingQueue = await getQueuedFeedback();
    const updatedQueue = [...existingQueue, feedbackData].slice(-MAX_QUEUED_FEEDBACK);
    await AsyncStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error('[FEEDBACK] Failed to queue locally:', error);
    throw error;
  }
};

/**
 * Get queued feedback
 * @returns {Promise<Array>} Array of queued feedback
 */
export const getQueuedFeedback = async () => {
  try {
    const queueJson = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('[FEEDBACK] Failed to retrieve queued feedback:', error);
    return [];
  }
};

/**
 * Retry submitting queued feedback
 * Call this when network connection is restored
 */
export const retryQueuedFeedback = async () => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase not configured' };
  }

  try {
    const queuedFeedback = await getQueuedFeedback();

    if (queuedFeedback.length === 0) {
      return { success: true, count: 0, message: 'No queued feedback' };
    }

    let successCount = 0;
    const failedFeedback = [];

    for (const feedback of queuedFeedback) {
      try {
        const { error } = await supabase
          .from('user_feedback')
          .insert([feedback]);

        if (error) {
          throw error;
        }

        successCount++;
      } catch (error) {
        console.error('[FEEDBACK] Failed to submit queued feedback:', error);
        failedFeedback.push(feedback);
      }
    }

    // Update queue with only failed items
    await AsyncStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(failedFeedback));

    return {
      success: true,
      count: successCount,
      failed: failedFeedback.length,
      message: `Submitted ${successCount} queued feedback items`,
    };
  } catch (error) {
    console.error('[FEEDBACK] Failed to retry queued feedback:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Clear queued feedback
 */
export const clearQueuedFeedback = async () => {
  try {
    await AsyncStorage.removeItem(FEEDBACK_STORAGE_KEY);
  } catch (error) {
    console.error('[FEEDBACK] Failed to clear queued feedback:', error);
  }
};

/**
 * Get feedback statistics (for debugging/admin)
 */
export const getFeedbackStats = async () => {
  const queuedFeedback = await getQueuedFeedback();

  return {
    queued_count: queuedFeedback.length,
    categories: queuedFeedback.reduce((acc, feedback) => {
      acc[feedback.category] = (acc[feedback.category] || 0) + 1;
      return acc;
    }, {}),
  };
};
