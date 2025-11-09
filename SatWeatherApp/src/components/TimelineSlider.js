import React from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';

export const TimelineSlider = () => {
  const { currentFrameIndex, availableTimestamps, setCurrentFrameIndex } =
    useApp();

  if (!availableTimestamps || availableTimestamps.length === 0) {
    return null;
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
    paddingVertical: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
