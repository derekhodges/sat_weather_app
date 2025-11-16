import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { latLonToPixel, isPointInBounds, formatCoordinates, extractGeoGrids } from '../utils/projection';

export const LocationMarker = () => {
  const {
    userLocation,
    showLocationMarker,
    currentGeoData,
    actualImageSize,
    isImageReadyForOverlays,
  } = useApp();

  // Calculate marker position based on geospatial data
  const markerPosition = useMemo(() => {
    if (!userLocation || !currentGeoData || !actualImageSize || !isImageReadyForOverlays) {
      return null;
    }

    const { bounds, projection } = currentGeoData;

    if (!bounds) {
      return null;
    }

    // Check if user location is within domain bounds
    const isInBounds = isPointInBounds(
      userLocation.coords.latitude,
      userLocation.coords.longitude,
      bounds
    );

    if (!isInBounds) {
      console.log('[LOCATION] User location is outside domain bounds');
      return { outOfBounds: true };
    }

    // Extract geo grids for geostationary projection
    const geoGrids = extractGeoGrids(currentGeoData);

    // Convert lat/lon to pixel coordinates within the image
    const pixelCoords = latLonToPixel(
      userLocation.coords.latitude,
      userLocation.coords.longitude,
      bounds,
      actualImageSize,
      projection || 'plate_carree',
      geoGrids
    );

    if (!pixelCoords) {
      return null;
    }

    // Convert image pixel coordinates to screen percentage
    // This gives us position relative to the image container
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;

    const xPercent = (pixelCoords.x / actualImageSize.width) * 100;
    const yPercent = (pixelCoords.y / actualImageSize.height) * 100;

    console.log(`[LOCATION] Marker at: ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}% (${formatCoordinates(userLocation.coords.latitude, userLocation.coords.longitude)})`);

    return {
      xPercent,
      yPercent,
      outOfBounds: false,
    };
  }, [userLocation, currentGeoData, actualImageSize, isImageReadyForOverlays]);

  // Don't show if not enabled or no location
  if (!showLocationMarker || !userLocation) {
    return null;
  }

  // Show out-of-bounds message if location is outside domain
  if (markerPosition?.outOfBounds) {
    return (
      <View style={styles.outOfBoundsContainer} pointerEvents="none">
        <View style={styles.outOfBoundsMessage}>
          <Text style={styles.outOfBoundsText}>
            Your location is outside this domain
          </Text>
        </View>
      </View>
    );
  }

  // If we have calculated position, use it; otherwise center on screen
  const positionStyle = markerPosition
    ? {
        left: `${markerPosition.xPercent}%`,
        top: `${markerPosition.yPercent}%`,
        transform: [{ translateX: -30 }, { translateY: -30 }], // Center the 60x60 reticule
      }
    : {};

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.reticule, positionStyle]}>
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
  outOfBoundsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
  },
  outOfBoundsMessage: {
    backgroundColor: 'rgba(255, 100, 100, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff6666',
  },
  outOfBoundsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  reticule: {
    position: 'absolute',
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
