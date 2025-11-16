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
    currentImageTransform,
  } = useApp();

  // Calculate marker position based on geospatial data
  const markerPosition = useMemo(() => {
    // Debug logging for missing dependencies
    if (!userLocation) {
      console.log('[LOCATION] No user location set');
      return null;
    }
    if (!currentGeoData) {
      console.log('[LOCATION] No geo data loaded');
      return null;
    }
    if (!actualImageSize) {
      console.log('[LOCATION] No image size available');
      return null;
    }
    if (!isImageReadyForOverlays) {
      console.log('[LOCATION] Image not ready for overlays');
      return null;
    }

    const { bounds, projection } = currentGeoData;

    if (!bounds) {
      return null;
    }

    // userLocation is the coords object directly (has latitude, longitude properties)
    const userLat = userLocation.latitude;
    const userLon = userLocation.longitude;

    if (userLat === undefined || userLon === undefined) {
      console.warn('[LOCATION] Invalid user location:', userLocation);
      return null;
    }

    // Check if user location is within domain bounds
    const isInBounds = isPointInBounds(userLat, userLon, bounds);

    if (!isInBounds) {
      console.log('[LOCATION] User location is outside domain bounds');
      return { outOfBounds: true };
    }

    // Extract geo grids for geostationary projection
    const geoGrids = extractGeoGrids(currentGeoData);

    // Convert lat/lon to pixel coordinates within the image
    const pixelCoords = latLonToPixel(
      userLat,
      userLon,
      bounds,
      actualImageSize,
      projection || 'plate_carree',
      geoGrids
    );

    if (!pixelCoords) {
      return null;
    }

    // Get screen dimensions
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;

    // Get current transform (zoom/pan)
    const { scale = 1, translateX = 0, translateY = 0 } = currentImageTransform || {};

    // Convert image pixel coordinates to ABSOLUTE screen position
    // accounting for current zoom/pan transform AND letterboxing

    // Step 1: Calculate the actual displayed size of the image (accounting for letterboxing)
    // When using resizeMode="contain", the image is scaled to fit while maintaining aspect ratio
    const imageAspect = actualImageSize.width / actualImageSize.height;
    const screenAspect = screenWidth / screenHeight;

    let displayedWidth, displayedHeight;

    if (imageAspect > screenAspect) {
      // Image is wider than screen (letterboxing on top/bottom)
      displayedWidth = screenWidth;
      displayedHeight = screenWidth / imageAspect;
    } else {
      // Image is taller than screen (letterboxing on sides)
      displayedHeight = screenHeight;
      displayedWidth = screenHeight * imageAspect;
    }

    // Step 2: Get pixel position relative to image center
    const imageCenterX = actualImageSize.width / 2;
    const imageCenterY = actualImageSize.height / 2;
    const relImageX = pixelCoords.x - imageCenterX;
    const relImageY = pixelCoords.y - imageCenterY;

    // Step 3: Convert to screen space using the DISPLAYED size (not screen size)
    const imageToDisplayX = displayedWidth / actualImageSize.width;
    const imageToDisplayY = displayedHeight / actualImageSize.height;
    const displayRelX = relImageX * imageToDisplayX;
    const displayRelY = relImageY * imageToDisplayY;

    // Step 4: Apply zoom/pan transform and add screen center offset
    const screenCenterX = screenWidth / 2;
    const screenCenterY = screenHeight / 2;
    const finalScreenX = displayRelX * scale + translateX + screenCenterX;
    const finalScreenY = displayRelY * scale + translateY + screenCenterY;

    console.log(`[LOCATION] Marker at screen: (${finalScreenX.toFixed(1)}, ${finalScreenY.toFixed(1)}) (${formatCoordinates(userLat, userLon)})`);
    console.log(`[LOCATION] Display size: ${displayedWidth.toFixed(0)}x${displayedHeight.toFixed(0)}, scale=${scale.toFixed(2)}`);

    return {
      screenX: finalScreenX,
      screenY: finalScreenY,
      outOfBounds: false,
    };
  }, [userLocation, currentGeoData, actualImageSize, isImageReadyForOverlays, currentImageTransform]);

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
        left: markerPosition.screenX - 30, // Center the 60x60 reticule
        top: markerPosition.screenY - 30,
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
