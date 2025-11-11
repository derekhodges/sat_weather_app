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

  const isLandscape = orientation === 'landscape';

  return (
    <View style={isLandscape ? styles.containerLandscape : styles.container}>
      <Slider
        style={isLandscape ? styles.sliderLandscape : styles.slider}
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
  containerLandscape: {
    backgroundColor: '#1a1a1a',
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  sliderLandscape: {
    width: '100%',
    height: 40,
  },
});
