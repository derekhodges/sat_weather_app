import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';
import { useApp } from '../context/AppContext';

const CustomSlider = ({
  minimumValue = 0,
  maximumValue = 1,
  step = 0,
  value = 0,
  onValueChange,
  minimumTrackTintColor = '#4A90E2',
  maximumTrackTintColor = '#555',
  thumbTintColor = '#fff',
  thumbSize = 32,
  trackHeight = 6,
  style,
}) => {
  const pan = useRef(new Animated.Value(0)).current;
  const trackWidthRef = useRef(0);
  const containerLeftRef = useRef(0);
  const currentValueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const isTouchingRef = useRef(false);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  const valueToPosition = (val) => {
    const width = trackWidthRef.current;
    if (maximumValue === minimumValue || width === 0) return 0;
    return ((val - minimumValue) / (maximumValue - minimumValue)) * width;
  };

  const positionToValue = (pos) => {
    const width = trackWidthRef.current;
    if (width === 0) return currentValueRef.current;
    let val = (pos / width) * (maximumValue - minimumValue) + minimumValue;
    val = Math.max(minimumValue, Math.min(maximumValue, val));
    if (step > 0) {
      val = Math.round(val / step) * step;
    }
    return val;
  };

  const halfThumb = thumbSize / 2;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isTouchingRef.current = true;
        
        const touchX = evt.nativeEvent.pageX - containerLeftRef.current - halfThumb;
        const clampedPos = Math.max(0, Math.min(trackWidthRef.current, touchX));
        const newValue = positionToValue(clampedPos);
        
        if (newValue === currentValueRef.current) {
          return;
        }
        
        currentValueRef.current = newValue;
        pan.setValue(valueToPosition(newValue));
        onValueChangeRef.current?.(newValue);
      },
      onPanResponderMove: (evt) => {
        const touchX = evt.nativeEvent.pageX - containerLeftRef.current - halfThumb;
        const clampedPos = Math.max(0, Math.min(trackWidthRef.current, touchX));
        const newValue = positionToValue(clampedPos);
        
        // Always show snapped position, not raw touch position
        pan.setValue(valueToPosition(newValue));
        
        if (newValue !== currentValueRef.current) {
          currentValueRef.current = newValue;
          onValueChangeRef.current?.(newValue);
        }
      },
      onPanResponderRelease: () => {
        isTouchingRef.current = false;
      },
    })
  ).current;

  useEffect(() => {
    if (isTouchingRef.current) return;
    if (value !== currentValueRef.current) {
      currentValueRef.current = value;
      pan.setValue(valueToPosition(value));
    }
  }, [value]);

  const containerRef = useRef(null);

  const onLayout = () => {
    containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
      containerLeftRef.current = pageX;
      trackWidthRef.current = width - thumbSize;
      currentValueRef.current = value;
      pan.setValue(valueToPosition(value));
    });
  };

  return (
    <View 
      ref={containerRef}
      style={[styles.sliderContainer, { height: thumbSize }, style]} 
      onLayout={onLayout} 
      {...panResponder.panHandlers}
    >
      <View style={[styles.trackContainer, { left: halfThumb, right: halfThumb, height: trackHeight }]}>
        <View style={[styles.track, { backgroundColor: maximumTrackTintColor, height: trackHeight, borderRadius: trackHeight / 2 }]} />
        <Animated.View
          style={[
            styles.filledTrack,
            {
              backgroundColor: minimumTrackTintColor,
              height: trackHeight,
              borderRadius: trackHeight / 2,
              width: pan,
            },
          ]}
        />
      </View>
      <Animated.View
        style={[
          styles.thumb,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: thumbTintColor,
            transform: [{ translateX: pan }],
          },
        ]}
      />
    </View>
  );
};

export const TimelineSlider = ({ orientation = 'portrait' }) => {
  const { currentFrameIndex, availableTimestamps, setCurrentFrameIndex } = useApp();

  if (!availableTimestamps || availableTimestamps.length === 0) {
    return null;
  }

  const handleValueChange = (value) => {
    const roundedValue = Math.round(value);
    if (roundedValue !== currentFrameIndex) {
      setCurrentFrameIndex(roundedValue);
    }
  };

  const isVertical = orientation === 'vertical';

  if (isVertical) {
    return (
      <View style={styles.containerVertical}>
        <View style={styles.verticalSliderWrapper}>
          <CustomSlider
            style={styles.sliderVertical}
            minimumValue={0}
            maximumValue={Math.max(0, availableTimestamps.length - 1)}
            step={1}
            value={currentFrameIndex}
            onValueChange={handleValueChange}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="#555"
            thumbTintColor="#fff"
            thumbSize={32}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomSlider
        minimumValue={0}
        maximumValue={Math.max(0, availableTimestamps.length - 1)}
        step={1}
        value={currentFrameIndex}
        onValueChange={handleValueChange}
        minimumTrackTintColor="#4A90E2"
        maximumTrackTintColor="#555"
        thumbTintColor="#fff"
        thumbSize={32}
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
    justifyContent: 'center',
  },
  containerVertical: {
    backgroundColor: '#1a1a1a',
    width: 80,
    paddingVertical: 2,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalSliderWrapper: {
    width: 300,
    height: 40,
    transform: [{ rotate: '-90deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderVertical: {
    width: 300,
  },
  sliderContainer: {
    justifyContent: 'center',
  },
  trackContainer: {
    position: 'absolute',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
  },
  filledTrack: {
    position: 'absolute',
  },
  thumb: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
