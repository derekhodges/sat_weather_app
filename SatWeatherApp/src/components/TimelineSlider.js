import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';

export const TimelineSlider = ({ orientation = 'portrait' }) => {
  const { currentFrameIndex, availableTimestamps, setCurrentFrameIndex } =
    useApp();

  if (!availableTimestamps || availableTimestamps.length === 0) {
    return null;
  }

  // Round slider values to integers to ensure proper frame switching
  const handleValueChange = (value) => {
    const roundedValue = Math.round(value);
    if (roundedValue !== currentFrameIndex) {
      setCurrentFrameIndex(roundedValue);
    }
  };

  const isVertical = orientation === 'vertical';
  const isHorizontal = orientation === 'horizontal';

  if (isVertical) {
    // Vertical slider for landscape mode
    return (
      <View style={styles.containerVertical}>
        <View style={styles.verticalSliderWrapper}>
          <Slider
            style={styles.sliderVertical}
            minimumValue={0}
            maximumValue={Math.max(0, availableTimestamps.length - 1)}
            step={1}
            value={currentFrameIndex}
            onValueChange={handleValueChange}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="#555"
            thumbTintColor="#fff"
            {...(Platform.OS === 'ios' ? { thumbStyle: styles.thumbStyle } : {})}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Visual track background for better visibility */}
      <View style={styles.trackBackground} />
      <Slider
        style={[
          styles.slider,
          Platform.OS === 'android' && styles.sliderAndroid
        ]}
        minimumValue={0}
        maximumValue={Math.max(0, availableTimestamps.length - 1)}
        step={1}
        value={currentFrameIndex}
        onValueChange={handleValueChange}
        minimumTrackTintColor="#4A90E2"
        maximumTrackTintColor="#555"
        thumbTintColor="#fff"
        {...(Platform.OS === 'ios' ? { thumbStyle: styles.thumbStyle } : {})}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    position: 'relative',
    justifyContent: 'center',
  },
  trackBackground: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    alignSelf: 'center',
  },
  slider: {
    width: '100%',
    height: 60,
    zIndex: 10,
  },
  sliderAndroid: {
    // Scale up the slider on Android to make thumb bigger
    transform: [{ scaleY: 1.5 }],
  },
  containerVertical: {
    backgroundColor: '#1a1a1a',
    width: 80,
    paddingVertical: 16,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalSliderWrapper: {
    width: 300, // This will become the height after rotation
    height: 60,
    transform: [{ rotate: '-90deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderVertical: {
    width: 300,
    height: 60,
  },
  thumbStyle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
  },
});
