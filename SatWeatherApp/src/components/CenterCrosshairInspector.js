import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { analyzePixelColor } from '../utils/colorbarUtils';
import { estimateColorFromCoordinates } from '../utils/pixelSampler';

/**
 * CenterCrosshairInspector - RadarScope-style center crosshair
 * Shows a fixed crosshair in the center with continuous value readout
 * Updates as the user pans the image
 */
export const CenterCrosshairInspector = () => {
  const {
    isInspectorMode,
    viewMode,
    selectedChannel,
    selectedRGBProduct,
    currentImageUrl,
  } = useApp();

  const [centerValue, setCenterValue] = useState(null);
  const samplingInterval = useRef(null);

  // Get screen dimensions
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Center coordinates
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;

  // Sample the center pixel continuously
  useEffect(() => {
    if (!isInspectorMode || !currentImageUrl) {
      setCenterValue(null);
      if (samplingInterval.current) {
        clearInterval(samplingInterval.current);
      }
      return;
    }

    // Function to sample center
    const sampleCenter = () => {
      const product = viewMode === 'channel' ? selectedChannel : selectedRGBProduct;

      // Estimate color at center based on coordinate
      // For vertical gradient (IR channels), center is mid-range temperature
      const estimatedColor = estimateColorFromCoordinates(
        centerX,
        centerY,
        screenHeight,
        viewMode,
        product
      );

      // Analyze the color
      const analysis = analyzePixelColor(
        estimatedColor.r,
        estimatedColor.g,
        estimatedColor.b,
        viewMode,
        product
      );

      setCenterValue({
        label: analysis.label,
        description: analysis.description,
        color: analysis.color,
      });
    };

    // Sample immediately
    sampleCenter();

    // Sample periodically (every 500ms) to catch pan updates
    samplingInterval.current = setInterval(sampleCenter, 500);

    return () => {
      if (samplingInterval.current) {
        clearInterval(samplingInterval.current);
      }
    };
  }, [isInspectorMode, viewMode, selectedChannel, selectedRGBProduct, currentImageUrl, centerX, centerY, screenHeight]);

  // Don't render if inspector mode is off
  if (!isInspectorMode) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Center crosshair */}
      <View style={styles.crosshairContainer}>
        {/* Horizontal line */}
        <View style={styles.crosshairHorizontal}>
          <View style={styles.crosshairLineLeft} />
          <View style={styles.crosshairGap} />
          <View style={styles.crosshairLineRight} />
        </View>

        {/* Vertical line */}
        <View style={styles.crosshairVertical}>
          <View style={styles.crosshairLineTop} />
          <View style={styles.crosshairGap} />
          <View style={styles.crosshairLineBottom} />
        </View>

        {/* Center dot */}
        <View style={styles.centerDot} />
      </View>

      {/* Value display box */}
      {centerValue && (
        <View style={styles.valueBox}>
          <View style={styles.valueBoxHeader}>
            <View style={[styles.colorIndicator, { backgroundColor: centerValue.color }]} />
            <Text style={styles.valueLabel}>{centerValue.label}</Text>
          </View>
          {centerValue.description && (
            <Text style={styles.valueDescription}>{centerValue.description}</Text>
          )}
        </View>
      )}

      {/* Instruction text */}
      <View style={styles.instructionContainer}>
        <Text style={styles.instructionText}>
          Center Crosshair - Pan to analyze
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
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairContainer: {
    position: 'absolute',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairHorizontal: {
    position: 'absolute',
    width: 60,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  crosshairVertical: {
    position: 'absolute',
    width: 2,
    height: 60,
    flexDirection: 'column',
    alignItems: 'center',
  },
  crosshairLineLeft: {
    width: 20,
    height: 2,
    backgroundColor: '#00ff00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  crosshairLineRight: {
    width: 20,
    height: 2,
    backgroundColor: '#00ff00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  crosshairLineTop: {
    width: 2,
    height: 20,
    backgroundColor: '#00ff00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  crosshairLineBottom: {
    width: 2,
    height: 20,
    backgroundColor: '#00ff00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  crosshairGap: {
    width: 20,
    height: 20,
  },
  centerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00ff00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  valueBox: {
    position: 'absolute',
    top: -90, // Above the crosshair
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff00',
    minWidth: 180,
    maxWidth: 280,
  },
  valueBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 3,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  valueLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  valueDescription: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 14,
  },
  instructionContainer: {
    position: 'absolute',
    top: 10,
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
