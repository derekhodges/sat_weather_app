import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export const BottomControls = ({
  onLocationPress,
  onPlayPress,
  onEditPress,
  onSharePress,
  onFlipOrientation,
  orientation = 'portrait',
}) => {
  const { isAnimating, isDrawingMode } = useApp();
  const isLandscape = orientation === 'landscape';

  return (
    <View style={isLandscape ? styles.containerLandscape : styles.container}>
      {/* Satellite/Change satellite button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          // Will be handled by top bar satellite selector
        }}
      >
        <MaterialCommunityIcons name="satellite-variant" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Location button */}
      <TouchableOpacity style={styles.button} onPress={onLocationPress}>
        <Ionicons name="location" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Play/Pause button */}
      <TouchableOpacity style={styles.button} onPress={onPlayPress}>
        <Ionicons
          name={isAnimating ? 'pause' : 'play'}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>

      {/* Edit/Draw button */}
      <TouchableOpacity
        style={[styles.button, isDrawingMode && styles.activeButton]}
        onPress={onEditPress}
      >
        <Ionicons name="brush" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity style={styles.button} onPress={onSharePress}>
        <Ionicons name="share-social" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Flip orientation button */}
      <TouchableOpacity style={styles.button} onPress={onFlipOrientation}>
        <MaterialCommunityIcons name="phone-rotate-landscape" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  containerLandscape: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  button: {
    padding: 10,
    borderRadius: 8,
  },
  activeButton: {
    backgroundColor: '#2196F3',
  },
});
