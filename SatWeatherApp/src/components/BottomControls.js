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
  const iconSize = isLandscape ? 22 : 24;
  const buttonStyle = isLandscape ? styles.buttonVertical : styles.button;

  return (
    <View style={isLandscape ? styles.containerVertical : styles.container}>
      {/* Satellite/Change satellite button */}
      <TouchableOpacity
        style={buttonStyle}
        onPress={() => {
          // Will be handled by top bar satellite selector
        }}
      >
        <MaterialCommunityIcons name="satellite-variant" size={iconSize} color="#fff" />
      </TouchableOpacity>

      {/* Location button */}
      <TouchableOpacity style={buttonStyle} onPress={onLocationPress}>
        <Ionicons name="location" size={iconSize} color="#fff" />
      </TouchableOpacity>

      {/* Play/Pause button */}
      <TouchableOpacity style={buttonStyle} onPress={onPlayPress}>
        <Ionicons
          name={isAnimating ? 'pause' : 'play'}
          size={iconSize}
          color="#fff"
        />
      </TouchableOpacity>

      {/* Edit/Draw button */}
      <TouchableOpacity
        style={[buttonStyle, isDrawingMode && styles.activeButton]}
        onPress={onEditPress}
      >
        <Ionicons name="brush" size={iconSize} color="#fff" />
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity style={buttonStyle} onPress={onSharePress}>
        <Ionicons name="share-social" size={iconSize} color="#fff" />
      </TouchableOpacity>

      {/* Flip orientation button */}
      <TouchableOpacity style={buttonStyle} onPress={onFlipOrientation}>
        <MaterialCommunityIcons name="phone-rotate-landscape" size={iconSize} color="#fff" />
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
  containerVertical: {
    flexDirection: 'column',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    width: 60,
  },
  button: {
    padding: 10,
    borderRadius: 8,
  },
  buttonVertical: {
    padding: 8,
    borderRadius: 8,
    marginVertical: 2,
  },
  activeButton: {
    backgroundColor: '#2196F3',
  },
});
