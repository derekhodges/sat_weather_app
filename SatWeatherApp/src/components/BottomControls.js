import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export const BottomControls = ({
  onInspectorPress,
  onLocationPress,
  onPlayPress,
  onEditPress,
  onEditLongPress,
  onSharePress,
  onFlipOrientation,
  onResetView,
  orientation = 'portrait',
  isDrawingMode,
  isInspectorMode,
}) => {
  const { isAnimating } = useApp();
  const isLandscape = orientation === 'landscape';
  const iconSize = isLandscape ? 20 : 24;
  const buttonStyle = isLandscape ? styles.buttonVertical : styles.button;

  return (
    <View style={isLandscape ? styles.containerVertical : styles.container}>
      {/* Inspector button - analyze colors on image */}
      <TouchableOpacity
        style={[buttonStyle, isInspectorMode && styles.activeButton]}
        onPress={onInspectorPress}
      >
        <MaterialCommunityIcons name="eyedropper" size={iconSize} color="#fff" />
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
        onLongPress={onEditLongPress}
        delayLongPress={500}
      >
        <Ionicons name="brush" size={iconSize} color="#fff" />
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity style={buttonStyle} onPress={onSharePress}>
        <Ionicons name="share-social" size={iconSize} color="#fff" />
      </TouchableOpacity>

      {/* Reset zoom/pan button */}
      <TouchableOpacity style={buttonStyle} onPress={onResetView}>
        <MaterialCommunityIcons name="image-filter-center-focus" size={iconSize} color="#fff" />
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    width: 56,
  },
  button: {
    padding: 10,
    borderRadius: 8,
  },
  buttonVertical: {
    padding: 6,
    borderRadius: 6,
    marginVertical: 1,
  },
  activeButton: {
    backgroundColor: '#2196F3',
  },
});
