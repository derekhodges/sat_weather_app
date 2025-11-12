import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';

export const LocationMarker = () => {
  const { userLocation, showLocationMarker } = useApp();

  // Don't show if not enabled or no location
  if (!showLocationMarker || !userLocation) {
    return null;
  }

  // For now, we'll display a centered reticule
  // A proper implementation would convert GPS coords to pixel position
  // based on the satellite image's projection and bounds
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.reticule}>
        {/* Horizontal line */}
        <View style={styles.horizontalLine} />
        {/* Vertical line */}
        <View style={styles.verticalLine} />
        {/* Center circle */}
        <View style={styles.centerCircle}>
          <View style={styles.innerCircle} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticule: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalLine: {
    position: 'absolute',
    width: 60,
    height: 2,
    backgroundColor: '#00FF00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  verticalLine: {
    position: 'absolute',
    width: 2,
    height: 60,
    backgroundColor: '#00FF00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  centerCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00FF00',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  innerCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF00',
  },
});
