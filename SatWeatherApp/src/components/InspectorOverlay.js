import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';

/**
 * InspectorOverlay - Displays color analysis information when in inspector mode
 * Shows a floating tooltip with temperature/value information at the touch point
 */
export const InspectorOverlay = () => {
  const { isInspectorMode, inspectorValue } = useApp();

  // Don't render anything if not in inspector mode or no value selected
  if (!isInspectorMode || !inspectorValue) {
    return null;
  }

  const { x, y, label, color } = inspectorValue;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Crosshair at touch point */}
      <View style={[styles.crosshairVertical, { left: x }]} />
      <View style={[styles.crosshairHorizontal, { top: y }]} />

      {/* Info tooltip */}
      <View style={[
        styles.tooltip,
        {
          left: x + 10,
          top: y + 10,
        }
      ]}>
        {/* Color swatch */}
        {color && (
          <View style={[styles.colorSwatch, { backgroundColor: color }]} />
        )}

        {/* Value text */}
        <Text style={styles.tooltipText}>{label}</Text>
      </View>

      {/* Instruction text at top of screen */}
      <View style={styles.instructionContainer}>
        <Text style={styles.instructionText}>
          Inspector Mode - Tap image to analyze colors
        </Text>
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
    zIndex: 1000, // Above image but below menus
  },
  crosshairVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#00ff00',
    opacity: 0.7,
  },
  crosshairHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#00ff00',
    opacity: 0.7,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff00',
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
    marginRight: 8,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  instructionContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
