import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useApp } from '../context/AppContext';
import { DOMAIN_TYPES } from '../constants/domains';

/**
 * BoundaryOverlay component
 *
 * Renders boundary overlays (state lines, county lines, cities) on top of satellite imagery.
 * Uses COD's boundary images which are transparent PNGs that align with their satellite products.
 *
 * TODO: Switch to AWS-hosted boundaries when available
 */
export const BoundaryOverlay = ({ scale, translateX, translateY }) => {
  const { selectedDomain, overlayStates } = useApp();

  // Check if any boundary overlays are enabled
  const showStateBoundaries = overlayStates?.state_lines?.enabled || false;
  const showCountyBoundaries = overlayStates?.county_lines?.enabled || false;

  // For now, we only support the map overlay which includes state boundaries
  // County and city overlays will be added later
  const shouldShowOverlay = showStateBoundaries || showCountyBoundaries;

  if (!shouldShowOverlay || !selectedDomain) {
    return null;
  }

  // Generate the boundary image URL based on domain type
  const getBoundaryUrl = () => {
    const domainType = selectedDomain.type;
    const codName = selectedDomain.codName;

    // For full disk, we don't have boundary overlays
    if (domainType === DOMAIN_TYPES.FULL_DISK) {
      return null;
    }

    // For continental domains (CONUS, REGIONAL)
    if (domainType === DOMAIN_TYPES.CONUS || domainType === DOMAIN_TYPES.REGIONAL) {
      return `https://weather.cod.edu/data/satellite/continental/${codName}/maps/${codName}_map.png`;
    }

    // For local domains
    if (domainType === DOMAIN_TYPES.LOCAL) {
      return `https://weather.cod.edu/data/satellite/local/${codName}/maps/${codName}_map.png`;
    }

    return null;
  };

  const boundaryUrl = getBoundaryUrl();

  if (!boundaryUrl) {
    return null;
  }

  // Apply the same transform as the satellite image so boundaries stay aligned
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      <Image
        source={{ uri: boundaryUrl }}
        style={styles.boundaryImage}
        resizeMode="contain"
        fadeDuration={0}
        onError={(error) => {
          console.warn('Boundary overlay load error:', error.nativeEvent?.error || 'Unknown error');
        }}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  boundaryImage: {
    width: '100%',
    height: '100%',
  },
});
