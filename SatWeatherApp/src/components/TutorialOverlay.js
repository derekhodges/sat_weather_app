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
    id: 'satellite',
    title: 'Select Your Satellite',
    description:
      'Tap the satellite name at the top (e.g., GOES-East) to switch between GOES-East, GOES-West, and other satellites. Each covers different parts of the world.',
    icon: '📡',
  },
  {
    id: 'products',
    title: 'RGB Products & Channels',
    description:
      'Tap RGB to view composite images (like Geocolor), or CHNL to see individual satellite bands. Different views help identify clouds, fires, fog, and more.',
    icon: '🌈',
  },
  {
    id: 'domains',
    title: 'View Different Regions',
    description:
      'Tap DOMAIN to switch between Full Disk (entire hemisphere), CONUS, or regional views. Pro users can access high-resolution mesoscale domains.',
    icon: '🌍',
  },
  {
    id: 'overlays',
    title: 'Add Weather Overlays',
    description:
      'Tap OVLY to add boundaries and weather data. Pro users get state/county lines, cities, roads, and NWS warnings. Pro Plus adds MRMS radar products.',
    icon: '🗺️',
  },
  {
    id: 'animation',
    title: 'Animate Images',
    description:
      'Use the timeline slider to scrub through recent images. Tap ▶️ to animate and watch weather patterns evolve over time.',
    icon: '▶️',
  },
  {
    id: 'zoom_pan',
    title: 'Zoom & Pan',
    description:
      'Pinch to zoom into details. Drag to pan around. Tap the ⊕ button to reset zoom to fit the full image on screen.',
    icon: '🔍',
  },
  {
    id: 'refresh',
    title: 'Refresh Data',
    description:
      'Tap the ↻ button to refresh and load the latest satellite images. Use this to get the most current data.',
    icon: '↻',
  },
  {
    id: 'location',
    title: 'Find Your Location',
    description:
      'Tap the ⊕ crosshair button to show your current position on the satellite image. Great for tracking weather near you.',
    icon: '⊕',
  },
  {
    id: 'inspector',
    title: 'Inspect Pixel Values',
    description:
      'Tap the ? button to enter inspector mode. Tap anywhere on the image to see coordinates and data values at that point.',
    icon: '❓',
  },
  {
    id: 'favorites',
    title: 'Save Favorites',
    description:
      'Tap the ☆ button to save your current view (satellite, domain, product) as a favorite for quick access later.',
    icon: '⭐',
  },
  {
    id: 'drawing',
    title: 'Draw & Annotate',
    description:
      'Tap the ✏️ pencil button to draw on the image. Long-press to change colors. Mark storm features or highlight observations.',
    icon: '✏️',
  },
  {
    id: 'orientation',
    title: 'Flip Orientation',
    description:
      'Tap the 📱 phone flip button to switch between portrait and landscape modes. Landscape gives you more image viewing area.',
    icon: '🔄',
  },
  {
    id: 'sharing',
    title: 'Share & Save',
    description:
      'Tap the share button to save screenshots or create animated GIFs. Share your weather observations with others!',
    icon: '📤',
  },
  {
    id: 'settings',
    title: 'Customize Settings',
    description:
      'Tap ☰ then Settings to adjust animation speed, frame count, auto-refresh, and manage your subscription.',
    icon: '⚙️',
  },
  {
    id: 'subscription',
    title: 'Subscription Tiers',
    description:
      'Free: Geocolor + Channel 13. Pro: All RGB products, all channels, weather overlays. Pro Plus: Everything plus MRMS radar products!',
    icon: '💎',
  },
  {
    id: 'complete',
    title: "You're Ready!",
    description:
      'Start exploring! Access this tutorial anytime from Settings → Help & Support. Enjoy tracking weather from space!',
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
    maxHeight: 300,
    minHeight: 200,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
    color: '#fff',
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
    color: '#888',
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
