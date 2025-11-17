/**
 * Tutorial Overlay Component
 *
 * Provides an interactive walkthrough of the app's features.
 * Shows on first launch and accessible from Settings.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackTutorialStep } from '../services/analytics';

const TUTORIAL_COMPLETED_KEY = '@tutorial_completed';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Satellite Weather',
    description:
      'View real-time GOES satellite imagery of Earth. This tutorial will show you how to use the key features.',
    icon: '🛰️',
  },
  {
    id: 'products',
    title: 'RGB Products & Channels',
    description:
      'Tap RGB to view composite images (like Geocolor), or CHANNEL to see individual satellite bands. Different views help identify clouds, fires, fog, and more.',
    icon: '🌈',
    highlight: 'rgb_button',
  },
  {
    id: 'domains',
    title: 'View Different Regions',
    description:
      'Tap DOMAIN to switch between Full Disk (entire hemisphere), Continental US, or Regional/Local views. Pro users can access high-resolution local domains.',
    icon: '🌍',
    highlight: 'domain_button',
  },
  {
    id: 'overlays',
    title: 'Add Weather Overlays',
    description:
      'Tap OVERLAYS to add state/county boundaries, cities, roads, and weather data like NWS warnings, lightning, and radar (Pro features).',
    icon: '📍',
    highlight: 'overlays_button',
  },
  {
    id: 'animation',
    title: 'Animate Images',
    description:
      'Use the timeline slider to scrub through recent images. Press the play button to animate and see weather patterns move over time.',
    icon: '▶️',
    highlight: 'play_button',
  },
  {
    id: 'zoom_pan',
    title: 'Zoom & Pan',
    description:
      'Pinch to zoom into details. Drag to pan around. Double-tap to reset the view. The reset button (↺) also resets zoom and position.',
    icon: '🔍',
  },
  {
    id: 'location',
    title: 'Find Your Location',
    description:
      'Tap the location button (📍) to show your current position on the satellite image. Great for tracking weather near you.',
    icon: '📍',
    highlight: 'location_button',
  },
  {
    id: 'drawing',
    title: 'Draw & Annotate',
    description:
      'Tap the pencil button to draw on the image. Long-press to change colors. Useful for marking storm features or sharing observations.',
    icon: '✏️',
    highlight: 'draw_button',
  },
  {
    id: 'sharing',
    title: 'Share & Save',
    description:
      'Tap the share button to save screenshots or create animated GIFs of the satellite loop. Share your finds with friends!',
    icon: '📤',
    highlight: 'share_button',
  },
  {
    id: 'settings',
    title: 'Customize Your Experience',
    description:
      'Access Settings from the menu (☰) to adjust animation speed, frame count, display preferences, and manage your subscription.',
    icon: '⚙️',
    highlight: 'menu_button',
  },
  {
    id: 'subscription',
    title: 'Unlock More Features',
    description:
      'Free users get Geocolor and Channel 13 with basic overlays. Upgrade to Pro for all products, channels, and advanced overlays. Pro Plus adds radar and more!',
    icon: '⭐',
  },
  {
    id: 'complete',
    title: "You're Ready!",
    description:
      'Start exploring satellite imagery! You can access this tutorial anytime from Settings. Enjoy tracking weather from space!',
    icon: '🚀',
  },
];

export const TutorialOverlay = ({ visible, onClose, startFromBeginning = true }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (visible && startFromBeginning) {
      setCurrentStep(0);
    }
  }, [visible, startFromBeginning]);

  const handleNext = () => {
    trackTutorialStep(TUTORIAL_STEPS[currentStep].id, 'next');
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    trackTutorialStep(TUTORIAL_STEPS[currentStep].id, 'previous');
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    trackTutorialStep(TUTORIAL_STEPS[currentStep].id, 'skip');
    handleComplete();
  };

  const handleComplete = async () => {
    trackTutorialStep('complete', 'finished');
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    } catch (error) {
      console.error('Failed to save tutorial completion:', error);
    }
    onClose();
  };

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            {TUTORIAL_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentStep && styles.progressDotActive,
                  index < currentStep && styles.progressDotCompleted,
                ]}
              />
            ))}
          </View>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView contentContainerStyle={styles.contentContainer}>
              <Text style={styles.icon}>{step.icon}</Text>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.description}>{step.description}</Text>

              {/* Step counter */}
              <Text style={styles.stepCounter}>
                {currentStep + 1} of {TUTORIAL_STEPS.length}
              </Text>
            </ScrollView>
          </View>

          {/* Navigation buttons */}
          <View style={styles.buttonContainer}>
            {!isFirstStep && (
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePrevious}>
                <Text style={styles.secondaryButtonText}>Previous</Text>
              </TouchableOpacity>
            )}

            {isFirstStep && (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
                <Text style={styles.secondaryButtonText}>Skip Tutorial</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, isLastStep && styles.completeButton]}
              onPress={handleNext}
            >
              <Text style={styles.primaryButtonText}>
                {isLastStep ? 'Get Started' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Check if tutorial should be shown (first launch)
 */
export const shouldShowTutorial = async () => {
  try {
    const completed = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
    return completed !== 'true';
  } catch (error) {
    console.error('Failed to check tutorial status:', error);
    return false;
  }
};

/**
 * Reset tutorial (for testing or user request)
 */
export const resetTutorial = async () => {
  try {
    await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
  } catch (error) {
    console.error('Failed to reset tutorial:', error);
  }
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: Math.min(screenWidth - 40, 400),
    maxHeight: screenHeight * 0.7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
    marginHorizontal: 3,
  },
  progressDotActive: {
    backgroundColor: '#4A90E2',
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: '#2196F3',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  stepCounter: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 6,
  },
  completeButton: {
    backgroundColor: '#27ae60',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6,
  },
  secondaryButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TutorialOverlay;
