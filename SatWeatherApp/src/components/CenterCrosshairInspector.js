import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { analyzePixelColor } from '../utils/colorbarUtils';
import { estimateColorFromCoordinates, samplePixelColor } from '../utils/pixelSampler';
import { pixelToLatLon, formatCoordinates, getDataAtPixel, extractGeoGrids } from '../utils/projection';

/**
 * CenterCrosshairInspector - RadarScope-style center crosshair
 * Shows a fixed crosshair in the center with continuous value readout
 * Updates as the user pans the image
 *
 * Now supports ACTUAL pixel sampling from the satellite image!
 * Falls back to estimation if sampling fails.
 *
 * Enhanced with geospatial coordinates and data value display.
 */
export const CenterCrosshairInspector = () => {
  const {
    isInspectorMode,
    viewMode,
    selectedChannel,
    selectedRGBProduct,
    currentImageUrl,
    crosshairPosition,
    setCrosshairPosition,
    selectedDomain,
    imageContainerRef,
    currentGeoData,
    actualImageSize,
    setInspectorCoordinates,
    setInspectorDataValue,
    currentImageTransform,
  } = useApp();

  const [centerValue, setCenterValue] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [dataValue, setDataValue] = useState(null);

  // Get screen dimensions
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Initialize crosshair at center when inspector mode is first activated
  useEffect(() => {
    if (isInspectorMode && !crosshairPosition) {
      setCrosshairPosition({
        x: screenWidth / 2,
        y: screenHeight / 2,
      });
    }
  }, [isInspectorMode, crosshairPosition, screenWidth, screenHeight]);

  // Clear inspector value when domain or channel changes
  useEffect(() => {
    setCenterValue(null);
    // Re-sample after a brief delay to let new image load
    const timer = setTimeout(() => {
      if (isInspectorMode && crosshairPosition) {
        // Trigger a re-sample by clearing and re-setting
        setCenterValue(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedDomain, selectedChannel, selectedRGBProduct, viewMode]);

  // Use crosshair position from context, or default to center
  const crosshairX = crosshairPosition?.x ?? screenWidth / 2;
  const crosshairY = crosshairPosition?.y ?? screenHeight / 2;

  // Calculate geographic coordinates at crosshair position
  useEffect(() => {
    if (!isInspectorMode || !currentGeoData || !actualImageSize) {
      setCoordinates(null);
      setDataValue(null);
      setInspectorCoordinates(null);
      setInspectorDataValue(null);
      return;
    }

    const { bounds, projection, dataValues, data_unit, data_name } = currentGeoData;

    if (!bounds) {
      setCoordinates(null);
      return;
    }

    // Convert screen crosshair position to image pixel position
    // ACCOUNTING FOR ZOOM AND PAN TRANSFORMS
    const { scale = 1, translateX = 0, translateY = 0 } = currentImageTransform || {};

    // Step 1: Get crosshair position relative to screen center
    const screenCenterX = screenWidth / 2;
    const screenCenterY = screenHeight / 2;
    const relX = crosshairX - screenCenterX;
    const relY = crosshairY - screenCenterY;

    // Step 2: Apply inverse transform (undo translation and scale)
    const transformedRelX = (relX - translateX) / scale;
    const transformedRelY = (relY - translateY) / scale;

    // Step 3: Convert back to absolute screen position (as if not zoomed)
    const untransformedScreenX = transformedRelX + screenCenterX;
    const untransformedScreenY = transformedRelY + screenCenterY;

    // Step 4: Map to image pixel coordinates
    const imageX = (untransformedScreenX / screenWidth) * actualImageSize.width;
    const imageY = (untransformedScreenY / screenHeight) * actualImageSize.height;

    console.log(`[INSPECTOR] Transform: scale=${scale.toFixed(2)}, tx=${translateX.toFixed(1)}, ty=${translateY.toFixed(1)}`);
    console.log(`[INSPECTOR] Screen (${crosshairX.toFixed(0)}, ${crosshairY.toFixed(0)}) -> Image (${imageX.toFixed(0)}, ${imageY.toFixed(0)})`);

    // Validate image coordinates are within bounds
    if (imageX < 0 || imageX >= actualImageSize.width || imageY < 0 || imageY >= actualImageSize.height) {
      console.log(`[INSPECTOR] Crosshair outside image bounds`);
      setCoordinates(null);
      setInspectorCoordinates(null);
      setDataValue(null);
      setInspectorDataValue(null);
      return;
    }

    // Extract geo grids for geostationary projection
    const geoGrids = extractGeoGrids(currentGeoData);

    // Convert pixel to lat/lon
    const coords = pixelToLatLon(
      imageX,
      imageY,
      bounds,
      actualImageSize,
      projection || 'plate_carree',
      geoGrids
    );

    if (coords) {
      setCoordinates(coords);
      setInspectorCoordinates(coords);
      console.log(`[INSPECTOR] Coordinates: ${formatCoordinates(coords.lat, coords.lon)}`);

      // Get data value if available
      if (dataValues && Array.isArray(dataValues)) {
        const value = getDataAtPixel(dataValues, imageX, imageY, actualImageSize);
        if (value !== null) {
          const dataInfo = {
            value,
            unit: data_unit || '',
            name: data_name || 'Value',
          };
          setDataValue(dataInfo);
          setInspectorDataValue(dataInfo);
          console.log(`[INSPECTOR] Data value: ${value} ${data_unit || ''}`);
        } else {
          setDataValue(null);
          setInspectorDataValue(null);
        }
      } else {
        setDataValue(null);
        setInspectorDataValue(null);
      }
    } else {
      setCoordinates(null);
      setInspectorCoordinates(null);
    }
  }, [isInspectorMode, crosshairX, crosshairY, currentGeoData, actualImageSize, screenWidth, screenHeight, currentImageTransform]);

  // Sample when crosshair moves or image changes
  useEffect(() => {
    if (!isInspectorMode || !currentImageUrl) {
      setCenterValue(null);
      return;
    }

    // Function to sample at crosshair position
    const sampleCrosshair = async () => {
      const product = viewMode === 'channel' ? selectedChannel : selectedRGBProduct;

      console.log(`[INSPECTOR] Sampling at crosshair (${crosshairX.toFixed(1)}, ${crosshairY.toFixed(1)})`);

      let sampledColor = null;

      // Try to sample actual pixel color if we have a reference to the image container
      if (imageContainerRef && imageContainerRef.current) {
        try {
          sampledColor = await samplePixelColor(
            imageContainerRef.current,
            crosshairX,
            crosshairY,
            screenWidth,
            screenHeight
          );
          if (sampledColor) {
            console.log('[INSPECTOR] Successfully sampled pixel');
          }
        } catch (error) {
          console.log('[INSPECTOR] Pixel sampling failed, falling back to estimation:', error);
        }
      } else {
        console.log('[INSPECTOR] No image container ref available, using estimation');
      }

      // Fall back to estimation if sampling failed or not available
      if (!sampledColor) {
        console.log('[INSPECTOR] Using coordinate-based estimation');
        sampledColor = estimateColorFromCoordinates(
          crosshairX,
          crosshairY,
          screenHeight,
          viewMode,
          product
        );
      }

      console.log(`[INSPECTOR] Color: RGB(${sampledColor.r}, ${sampledColor.g}, ${sampledColor.b}), sampled=${sampledColor.sampled || false}`);

      // Analyze the color
      const analysis = analyzePixelColor(
        sampledColor.r,
        sampledColor.g,
        sampledColor.b,
        viewMode,
        product
      );

      console.log(`[INSPECTOR] Analysis: ${analysis.label} - ${analysis.description}`);

      setCenterValue({
        label: analysis.label,
        description: analysis.description,
        color: analysis.color,
        sampled: sampledColor.sampled || false, // Track if we actually sampled or estimated
      });
    };

    // Sample when crosshair moves or image changes
    sampleCrosshair();

  }, [isInspectorMode, viewMode, selectedChannel, selectedRGBProduct, currentImageUrl, crosshairX, crosshairY, screenHeight, imageContainerRef]);

  // Don't render if inspector mode is off
  if (!isInspectorMode) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Crosshair at tap position */}
      <View style={[styles.crosshairContainer, { left: crosshairX - 30, top: crosshairY - 30 }]}>
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

      {/* Fixed value display box in bottom right corner */}
      {(centerValue || coordinates || dataValue) && (
        <View style={styles.valueBoxBottomRight}>
          {/* Coordinates display */}
          {coordinates && (
            <View style={styles.coordinatesContainer}>
              <Text style={styles.coordinatesLabel}>
                {formatCoordinates(coordinates.lat, coordinates.lon)}
              </Text>
            </View>
          )}

          {/* Data value display (brightness temp, etc.) */}
          {dataValue && (
            <View style={styles.dataValueContainer}>
              <Text style={styles.dataValueLabel}>
                {dataValue.name}: {dataValue.value.toFixed(1)} {dataValue.unit}
              </Text>
            </View>
          )}

          {/* Pixel color analysis */}
          {centerValue && (
            <View style={styles.valueBoxHeader}>
              <View style={[styles.colorIndicator, { backgroundColor: centerValue.color }]} />
              <View style={styles.valueTextContainer}>
                <Text style={styles.valueLabel}>{centerValue.label}</Text>
                {centerValue.description && (
                  <Text style={styles.valueDescription}>{centerValue.description}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Instruction text */}
      <View style={styles.instructionContainer}>
        <Text style={styles.instructionText}>
          Inspector Mode - Tap to reposition crosshair
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
  valueBoxBottomRight: {
    position: 'absolute',
    bottom: 10, // Just above the bottom edge, near where timestamp shows
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#00ff00',
    minWidth: 160,
    maxWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  valueBoxHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  coordinatesContainer: {
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 6,
  },
  coordinatesLabel: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  dataValueContainer: {
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 6,
  },
  dataValueLabel: {
    color: '#ffcc00',
    fontSize: 12,
    fontWeight: '600',
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 3,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#fff',
    marginTop: 1,
  },
  valueTextContainer: {
    flex: 1,
  },
  valueLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  valueDescription: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 13,
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
