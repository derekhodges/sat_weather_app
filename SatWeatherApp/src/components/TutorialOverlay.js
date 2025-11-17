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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackTutorialStep } from '../services/analytics';

const TUTORIAL_COMPLETED_KEY = '@tutorial_completed';

// Helper component to render an icon inline with text
const IconInline = ({ library, name, size = 16 }) => (
  <View style={{ width: size, height: size, marginHorizontal: 2 }}>
    {library === 'Ionicons' ? (
      <Ionicons name={name} size={size} color="#4A90E2" />
    ) : (
      <MaterialCommunityIcons name={name} size={size} color="#4A90E2" />
    )}
  </View>
);

// Helper component to render description with inline icons
const DescriptionWithIcons = ({ parts }) => {
  return (
    <Text style={styles.description}>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <Text key={index}>{part}</Text>;
        } else {
          // It's an icon
          return (
            <Text key={index}>
              <IconInline library={part.library} name={part.name} size={18} />
            </Text>
          );
        }
      })}
    </Text>
  );
};

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Satellite Weather',
    description: 'View real-time GOES satellite imagery. This tutorial covers the key features.',
    icon: { library: 'MaterialCommunityIcons', name: 'satellite-variant', emoji: '🛰️' },
  },
  {
    id: 'satellite',
    title: 'Select Your Satellite',
    description: 'Tap the satellite name at the top to switch between GOES-East and GOES-West.',
    icon: { library: 'Ionicons', name: 'radio', emoji: '📡' },
  },
  {
    id: 'products',
    title: 'RGB Products & Channels',
    description: 'Tap RGB for composite images (Geocolor, etc.) or CHANNEL for individual bands. Different channels identify details about clouds, fires, fog, and more.',
    icon: { library: 'Ionicons', name: 'apps', emoji: '🌈' },
  },
  {
    id: 'domains',
    title: 'View Different Regions',
    description: 'Tap DOMAIN to switch between:\n\n• Full Disk (entire hemisphere)\n• CONUS (full CONUS, regional, and local views)\n• Mesoscale Domains\n\nLocal views are for Pro and Pro Plus plans.',
    icon: { library: 'Ionicons', name: 'earth', emoji: '🌍' },
  },
  {
    id: 'overlays',
    title: 'Add Weather Overlays',
    description: 'Tap OVERLAY to add boundaries and weather data. Pro users can add lightning and NWS warnings. Pro Plus adds MRMS radar data.',
    icon: { library: 'Ionicons', name: 'map', emoji: '🗺️' },
  },
  {
    id: 'animation',
    title: 'Animate Images',
    descriptionParts: [
      'Drag the timeline slider to scrub through frames. Tap ',
      { library: 'Ionicons', name: 'play' },
      ' to animate.',
    ],
    icon: { library: 'Ionicons', name: 'play', emoji: '▶️' },
  },
  {
    id: 'zoom_pan',
    title: 'Zoom & Pan',
    descriptionParts: [
      'Pinch to zoom. Drag to pan. Tap ',
      { library: 'MaterialCommunityIcons', name: 'image-filter-center-focus' },
      ' to reset zoom.',
    ],
    icon: { library: 'Ionicons', name: 'search', emoji: '🔍' },
  },
  {
    id: 'refresh',
    title: 'Refresh Data',
    descriptionParts: [
      'Tap ',
      { library: 'Ionicons', name: 'refresh' },
      ' to refresh and load the latest satellite images.',
    ],
    icon: { library: 'Ionicons', name: 'refresh', emoji: '↻' },
  },
  {
    id: 'location',
    title: 'Find Your Location',
    descriptionParts: [
      'Tap ',
      { library: 'Ionicons', name: 'location' },
      ' to show your current position on the image.',
    ],
    icon: { library: 'Ionicons', name: 'location', emoji: '📍' },
  },
  {
    id: 'inspector',
    title: 'Inspect Pixel Values',
    descriptionParts: [
      'Tap ',
      { library: 'MaterialCommunityIcons', name: 'eyedropper' },
      ' to enter inspector mode. Tap anywhere to see coordinates and data values.',
    ],
    icon: { library: 'MaterialCommunityIcons', name: 'eyedropper', emoji: '💧' },
  },
  {
    id: 'favorites',
    title: 'Save Favorites',
    descriptionParts: [
      'Tap ',
      { library: 'Ionicons', name: 'star' },
      ' to save your current view for quick access later.',
    ],
    icon: { library: 'Ionicons', name: 'star', emoji: '⭐' },
  },
  {
    id: 'drawing',
    title: 'Draw & Annotate',
    descriptionParts: [
      'Tap ',
      { library: 'Ionicons', name: 'brush' },
      ' to draw on the image. Long-press to change colors.',
    ],
    icon: { library: 'Ionicons', name: 'brush', emoji: '🖌️' },
  },
  {
    id: 'orientation',
    title: 'Flip Orientation',
    descriptionParts: [
      'Tap ',
      { library: 'MaterialCommunityIcons', name: 'phone-rotate-landscape' },
      ' to switch between portrait and landscape modes.',
    ],
    icon: { library: 'MaterialCommunityIcons', name: 'phone-rotate-landscape', emoji: '🔄' },
  },
  {
    id: 'sharing',
    title: 'Share & Save',
    descriptionParts: [
      'Tap ',
      { library: 'Ionicons', name: 'share-social' },
      ' to save screenshots or create animated GIFs.',
    ],
    icon: { library: 'Ionicons', name: 'share-social', emoji: '📤' },
  },
  {
    id: 'settings',
    title: 'Customize Settings',
    descriptionParts: [
      'Tap ',
      { library: 'Ionicons', name: 'menu' },
      ' then Settings to adjust animation speed, frame count, and more.',
    ],
    icon: { library: 'Ionicons', name: 'settings', emoji: '⚙️' },
  },
  {
    id: 'subscription',
    title: 'Subscription Tiers',
    description: 'Free: Geocolor + Channel 13\n\nPro: All RGB products, all channels, weather overlays\n\nPro Plus: Everything plus MRMS radar products',
    icon: { library: 'Ionicons', name: 'diamond', emoji: '💎' },
  },
  {
    id: 'complete',
    title: "You're Ready!",
    description: 'Access this tutorial anytime from Settings → Help & Support.',
    icon: { library: 'Ionicons', name: 'rocket', emoji: '🚀' },
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

  // Render the icon component
  const IconComponent = step.icon.library === 'Ionicons' ? Ionicons : MaterialCommunityIcons;

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
              <View style={styles.iconContainer}>
                <IconComponent name={step.icon.name} size={48} color="#4A90E2" />
              </View>
              <Text style={styles.title}>{step.title}</Text>
              {step.descriptionParts ? (
                <DescriptionWithIcons parts={step.descriptionParts} />
              ) : (
                <Text style={styles.description}>{step.description}</Text>
              )}

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
  iconContainer: {
    marginBottom: 16,
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
