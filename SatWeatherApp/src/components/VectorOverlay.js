import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Polygon, Polyline, Circle, G } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { latLonToPixel, coordinatesToPixels } from '../utils/projection';
import { getRiskLevelColor, getRiskLevelStrokeWidth } from '../utils/geoDataService';

/**
 * VectorOverlay component
 *
 * Renders vector graphics (polygons, polylines, points) on top of satellite imagery.
 * Uses geospatial data to convert lat/lon coordinates to pixel positions.
 * Stays synchronized with image transforms (zoom, pan).
 */
export const VectorOverlay = ({ scale, translateX, translateY, displayMode, imageSize }) => {
  const { isImageReadyForOverlays, currentGeoData, showVectorOverlays } = useApp();

  // Convert geospatial polygons to SVG polygon points
  const svgPolygons = useMemo(() => {
    if (!currentGeoData || !currentGeoData.polygons || !imageSize || !currentGeoData.bounds) {
      return [];
    }

    const { polygons, bounds, projection } = currentGeoData;

    return polygons.map((polygon, index) => {
      if (!polygon.coordinates || polygon.coordinates.length === 0) {
        return null;
      }

      // Convert lat/lon coordinates to pixel coordinates
      const pixelCoords = coordinatesToPixels(
        polygon.coordinates,
        bounds,
        imageSize,
        projection || 'plate_carree'
      );

      // Filter out any null coordinates
      const validCoords = pixelCoords.filter(coord => coord !== null);

      if (validCoords.length < 3) {
        return null;
      }

      // Convert to SVG polygon points string "x1,y1 x2,y2 x3,y3 ..."
      const pointsString = validCoords.map(({ x, y }) => `${x},${y}`).join(' ');

      return {
        id: `polygon_${index}`,
        points: pointsString,
        type: polygon.type,
        properties: polygon.properties,
        color: getRiskLevelColor(polygon.type),
        strokeWidth: getRiskLevelStrokeWidth(polygon.type),
      };
    }).filter(Boolean);
  }, [currentGeoData, imageSize]);

  // Determine the wrapper style based on display mode (match satellite image)
  const containerStyle = displayMode === 'cover'
    ? [styles.overlayContainer, styles.overlayContainerCover]
    : styles.overlayContainer;

  // Apply the same transform as the satellite image so overlays stay aligned
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Don't render if not ready or no data
  if (!isImageReadyForOverlays || !showVectorOverlays || !currentGeoData || svgPolygons.length === 0 || !imageSize) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.imageContainer, animatedStyle]}>
        <View style={containerStyle}>
          <Svg
            width={imageSize.width}
            height={imageSize.height}
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            style={styles.svgContainer}
          >
            <G>
              {svgPolygons.map((polygon) => (
                <Polygon
                  key={polygon.id}
                  points={polygon.points}
                  fill={polygon.color}
                  fillOpacity={0.3}
                  stroke={polygon.color}
                  strokeWidth={polygon.strokeWidth}
                  strokeOpacity={0.9}
                />
              ))}
            </G>
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
};

/**
 * PointOverlay component
 *
 * Renders point markers (like location dots) at specific lat/lon coordinates.
 * Used for placing domain markers, home location, etc.
 */
export const PointOverlay = ({ scale, translateX, translateY, displayMode, imageSize, points = [] }) => {
  const { isImageReadyForOverlays, currentGeoData } = useApp();

  // Convert lat/lon points to pixel coordinates
  const svgPoints = useMemo(() => {
    if (!points || points.length === 0 || !imageSize) {
      return [];
    }

    // Get bounds from geo data or use provided bounds
    const bounds = currentGeoData?.bounds;
    const projection = currentGeoData?.projection || 'plate_carree';

    if (!bounds) {
      return [];
    }

    return points.map((point, index) => {
      const pixelCoord = latLonToPixel(
        point.lat,
        point.lon,
        bounds,
        imageSize,
        projection
      );

      if (!pixelCoord) {
        return null;
      }

      return {
        id: point.id || `point_${index}`,
        x: pixelCoord.x,
        y: pixelCoord.y,
        color: point.color || '#00ff00',
        radius: point.radius || 6,
        label: point.label || '',
      };
    }).filter(Boolean);
  }, [points, imageSize, currentGeoData]);

  // Determine the wrapper style
  const containerStyle = displayMode === 'cover'
    ? [styles.overlayContainer, styles.overlayContainerCover]
    : styles.overlayContainer;

  // Apply the same transform as the satellite image
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  if (!isImageReadyForOverlays || svgPoints.length === 0 || !imageSize) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.imageContainer, animatedStyle]}>
        <View style={containerStyle}>
          <Svg
            width={imageSize.width}
            height={imageSize.height}
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            style={styles.svgContainer}
          >
            <G>
              {svgPoints.map((point) => (
                <Circle
                  key={point.id}
                  cx={point.x}
                  cy={point.y}
                  r={point.radius}
                  fill={point.color}
                  fillOpacity={0.8}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              ))}
            </G>
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainerCover: {
    width: '200%',
    height: '200%',
  },
  svgContainer: {
    position: 'absolute',
  },
});

export default VectorOverlay;
