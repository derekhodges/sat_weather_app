# User Feedback Section - Quick Implementation Guide

## Overview
This guide outlines how to add a feedback section to the Satellite Weather App, leveraging existing error tracking infrastructure.

## Option 1: Add to SettingsModal (RECOMMENDED)

### 1. Create Feedback Service
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/services/feedbackService.js`

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { trackEvent } from './analytics';

const FEEDBACK_QUEUE_KEY = '@feedback_queue';

export const submitFeedback = async (feedback) => {
  // Track event
  trackEvent('feedback_submitted', {
    category: feedback.category,
    has_attachment: !!feedback.errorLogs,
  });

  // Queue locally
  try {
    const queued = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
    const queue = queued ? JSON.parse(queued) : [];
    queue.push({
      ...feedback,
      timestamp: new Date().toISOString(),
      id: `feedback_${Date.now()}`,
    });
    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to queue feedback:', error);
  }

  // Try to submit to Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('user_feedback').insert([{
        message: feedback.message,
        category: feedback.category,
        error_logs: feedback.errorLogs,
        session_id: feedback.sessionId,
        subscription_tier: feedback.tier,
        created_at: new Date().toISOString(),
      }]);

      if (!error) {
        // Remove from queue on success
        await clearFeedbackQueue();
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }
};

export const getFeedbackQueue = async () => {
  try {
    const queued = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
    return queued ? JSON.parse(queued) : [];
  } catch (error) {
    console.error('Failed to get feedback queue:', error);
    return [];
  }
};

export const clearFeedbackQueue = async () => {
  try {
    await AsyncStorage.removeItem(FEEDBACK_QUEUE_KEY);
  } catch (error) {
    console.error('Failed to clear feedback queue:', error);
  }
};
```

### 2. Extend AppContext
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/context/AppContext.js`

Add to state:
```javascript
// Add to AppProvider component:
const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [feedbackCategory, setFeedbackCategory] = useState('general');
const [feedbackMessage, setFeedbackMessage] = useState('');

// Add to context value:
showFeedbackModal,
setShowFeedbackModal,
feedbackCategory,
setFeedbackCategory,
feedbackMessage,
setFeedbackMessage,
```

### 3. Add Feedback Section to SettingsModal
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/components/SettingsModal.js`

Add after existing sections (before closing ScrollView):

```javascript
{/* Feedback Section */}
<View style={styles.settingsSection}>
  <Text style={styles.settingsSectionTitle}>Feedback & Support</Text>
  
  <TouchableOpacity 
    style={styles.feedbackButton}
    onPress={() => {
      setShowFeedbackModal(true);
    }}
  >
    <Ionicons name="mail" size={20} color="#fff" style={{ marginRight: 8 }} />
    <Text style={styles.feedbackButtonText}>Send Us Your Feedback</Text>
    <Ionicons name="chevron-forward" size={20} color="#999" />
  </TouchableOpacity>
  
  <Text style={styles.feedbackDescription}>
    Help us improve by sharing bug reports, feature requests, or general feedback
  </Text>
</View>

{/* Feedback Modal */}
<FeedbackModal 
  visible={showFeedbackModal}
  onClose={() => setShowFeedbackModal(false)}
/>
```

### 4. Create FeedbackModal Component
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/components/FeedbackModal.js`

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { submitFeedback } from '../services/feedbackService';
import { getErrorLogs } from '../services/analytics';

export const FeedbackModal = ({ visible, onClose }) => {
  const { feedbackMessage, setFeedbackMessage, feedbackCategory, setFeedbackCategory } = useApp();
  const { subscriptionTier } = useAuth();
  const [includeErrors, setIncludeErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert('Error', 'Please enter your feedback');
      return;
    }

    setIsSubmitting(true);
    try {
      const errorLogs = includeErrors ? await getErrorLogs() : null;
      
      await submitFeedback({
        message: feedbackMessage,
        category: feedbackCategory,
        errorLogs: errorLogs,
        sessionId: 'session_id_here', // Get from context
        tier: subscriptionTier,
      });

      Alert.alert('Success', 'Thank you! Your feedback has been sent.');
      setFeedbackMessage('');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'bug', label: 'Bug Report', icon: 'bug' },
    { id: 'feature', label: 'Feature Request', icon: 'lightbulb' },
    { id: 'general', label: 'General Feedback', icon: 'chatbubbles' },
    { id: 'other', label: 'Other', icon: 'help-circle' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Send Feedback</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {/* Category Selection */}
          <Text style={styles.sectionTitle}>Type of Feedback</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  feedbackCategory === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setFeedbackCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={24}
                  color={feedbackCategory === cat.id ? '#fff' : '#aaa'}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    feedbackCategory === cat.id && styles.categoryLabelActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Message Input */}
          <Text style={styles.sectionTitle}>Your Message</Text>
          <TextInput
            style={styles.input}
            placeholder="Tell us what you think..."
            placeholderTextColor="#666"
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          {/* Error Logs Toggle */}
          {feedbackCategory === 'bug' && (
            <View style={styles.optionsSection}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setIncludeErrors(!includeErrors)}
              >
                <Ionicons
                  name={includeErrors ? 'checkbox' : 'checkbox-outline'}
                  size={20}
                  color="#2196F3"
                />
                <Text style={styles.optionText}>Include recent error logs (helps us debug)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Send Feedback</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Your feedback helps us improve. All submissions are reviewed by our team.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  categoryLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#262626',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  optionsSection: {
    marginVertical: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionText: {
    color: '#ccc',
    marginLeft: 12,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
});
```

### 5. Create Supabase Table
Run this SQL in Supabase dashboard:

```sql
CREATE TABLE user_feedback (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  subscription_tier VARCHAR(50),
  session_id VARCHAR(100),
  error_logs JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE,
  response TEXT,
  response_date TIMESTAMP
);

CREATE INDEX feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX feedback_category ON user_feedback(category);
```

## Option 2: Standalone FeedbackModal

If you prefer separate feedback UI outside of settings, create:
`/home/user/sat_weather_app/SatWeatherApp/src/components/FeedbackModal.js` (standalone)

Then trigger from menu button in TopBar or MainScreen.

## Integration Checklist

- [ ] Create `feedbackService.js`
- [ ] Extend `AppContext.js` with feedback state
- [ ] Create `FeedbackModal.js` component
- [ ] Add feedback section to `SettingsModal.js` OR create standalone modal
- [ ] Create Supabase `user_feedback` table
- [ ] Test feedback submission (online and offline)
- [ ] Add feedback menu item to TopBar if standalone
- [ ] Test error log attachment
- [ ] Add to `.env` feature flags if needed

## Error Tracking Enhancement

Extend analytics.js with:

```javascript
// Add to analytics.js

export const trackError = (error, source, context = {}) => {
  logError(error, source, {
    timestamp: new Date().toISOString(),
    user_action: context.action,
    screen: context.screen,
    component: context.component,
    ...context
  });
};

export const getRecentErrors = async (limit = 5) => {
  const errors = await getErrorLogs();
  return errors.slice(-limit);
};
```

## Testing

```javascript
// Test in MainScreen or dev component
import { submitFeedback } from '../services/feedbackService';

const testFeedback = async () => {
  await submitFeedback({
    message: 'Test feedback',
    category: 'bug',
    errorLogs: null,
    sessionId: 'test_session',
    tier: 'free',
  });
};
```

## Files Modified/Created Summary

```
NEW:
- src/services/feedbackService.js
- src/components/FeedbackModal.js

MODIFIED:
- src/context/AppContext.js (add feedback state)
- src/components/SettingsModal.js (add feedback section)
- Backend: Create user_feedback table in Supabase
```

