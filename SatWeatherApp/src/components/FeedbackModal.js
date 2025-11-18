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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { submitFeedback, FeedbackCategory } from '../services/feedbackService';
import { useAuth } from '../context/AuthContext';

export const FeedbackModal = ({ visible, onClose }) => {
  const { user } = useAuth();

  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState(FeedbackCategory.GENERAL);
  const [includeErrorLogs, setIncludeErrorLogs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: FeedbackCategory.BUG_REPORT, label: 'Bug Report', icon: 'bug-outline' },
    { value: FeedbackCategory.FEATURE_REQUEST, label: 'Feature Request', icon: 'bulb-outline' },
    { value: FeedbackCategory.PERFORMANCE, label: 'Performance', icon: 'speedometer-outline' },
    { value: FeedbackCategory.UI_UX, label: 'UI/UX', icon: 'color-palette-outline' },
    { value: FeedbackCategory.GENERAL, label: 'General', icon: 'chatbox-outline' },
  ];

  const handleSubmit = async () => {
    // Validate message
    if (!message.trim()) {
      Alert.alert('Required Field', 'Please enter your feedback message.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitFeedback({
        message,
        category,
        email: email.trim() || null,
        includeErrorLogs,
        userId: user?.id || null,
      });

      if (result.success || result.queued) {
        Alert.alert(
          'Thank You!',
          result.message || 'Your feedback has been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setMessage('');
                setCategory(FeedbackCategory.GENERAL);
                setIncludeErrorLogs(false);
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('Submission Failed', result.message || 'Please try again later.');
      }
    } catch (error) {
      console.error('[FEEDBACK_MODAL] Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (message.trim()) {
      Alert.alert(
        'Discard Feedback?',
        'Your feedback will not be saved.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setMessage('');
              setCategory(FeedbackCategory.GENERAL);
              setIncludeErrorLogs(false);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCancel}
            disabled={isSubmitting}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Send Feedback</Text>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.categoryContainer}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryButton,
                      category === cat.value && styles.categoryButtonActive,
                    ]}
                    onPress={() => setCategory(cat.value)}
                    disabled={isSubmitting}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={20}
                      color={category === cat.value ? '#fff' : '#999'}
                    />
                    <Text
                      style={[
                        styles.categoryButtonText,
                        category === cat.value && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Message Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Your Feedback <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what you think or describe any issues you're experiencing..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
              <Text style={styles.characterCount}>
                {message.length} characters
              </Text>
            </View>

            {/* Email Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Email (optional)
              </Text>
              <Text style={styles.sectionDescription}>
                Provide your email if you'd like us to follow up with you
              </Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </View>

            {/* Include Error Logs */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIncludeErrorLogs(!includeErrorLogs)}
                disabled={isSubmitting}
              >
                <View style={styles.checkbox}>
                  {includeErrorLogs && (
                    <Ionicons name="checkmark" size={18} color="#2196F3" />
                  )}
                </View>
                <View style={styles.checkboxContent}>
                  <Text style={styles.checkboxLabel}>
                    Include recent error logs
                  </Text>
                  <Text style={styles.checkboxDescription}>
                    Help us debug issues faster by including technical details
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Info Note */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#4A90E2" />
              <Text style={styles.infoText}>
                Your feedback helps us improve the app. Device and app information
                will be included automatically.
              </Text>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!message.trim() || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!message.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Send Feedback</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    height: 60,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  required: {
    color: '#FF6B6B',
  },
  sectionDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  messageInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#333',
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  checkboxDescription: {
    color: '#999',
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
    marginTop: 8,
    marginBottom: 16,
  },
  infoText: {
    color: '#999',
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 10,
    flex: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
