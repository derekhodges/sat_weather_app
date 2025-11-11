import React from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';

export const TimelineSlider = ({ orientation = 'portrait' }) => {
  const { currentFrameIndex, availableTimestamps, setCurrentFrameIndex } =
    useApp();

  if (!availableTimestamps || availableTimestamps.length === 0) {
    return null;
  }

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
            onValueChange={setCurrentFrameIndex}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="#555"
            thumbTintColor="#fff"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={Math.max(0, availableTimestamps.length - 1)}
        step={1}
        value={currentFrameIndex}
        onValueChange={setCurrentFrameIndex}
        minimumTrackTintColor="#fff"
        maximumTrackTintColor="#555"
        thumbTintColor="#fff"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  containerVertical: {
    backgroundColor: '#1a1a1a',
    width: 60,
    paddingVertical: 16,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalSliderWrapper: {
    width: 300, // This will become the height after rotation
    height: 40,
    transform: [{ rotate: '-90deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderVertical: {
    width: 300,
    height: 40,
  },
});
