import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useApp } from '../context/AppContext';
import { DOMAIN_TYPES } from '../constants/domains';

/**
 * BoundaryOverlay component
 *
 * Renders boundary overlays on top of satellite imagery.
 * Supports multiple overlay types: state lines, counties, rivers, roads, etc.
 * Uses COD's boundary images which are transparent PNGs that align with their satellite products.
 *
 * TODO: Switch to AWS-hosted boundaries when available
 */
export const BoundaryOverlay = ({ scale, translateX, translateY, displayMode }) => {
  const { selectedDomain, overlayStates } = useApp();

  if (!selectedDomain) {
    return null;
  }

  // Map of overlay IDs to their filename patterns and base URLs
  const overlayConfig = {
    state_lines: { filename: 'map', baseUrl: 'weather.cod.edu', ext: 'png' },
    county_lines: { filename: 'counties', baseUrl: 'weather.cod.edu', ext: 'png' },
    nws_cwa: { filename: 'cwa', baseUrl: 'weather.cod.edu', ext: 'png' },
    latlon: { filename: 'latlon', baseUrl: 'weather.cod.edu', ext: 'png' },
    rivers: { filename: 'rivers', baseUrl: 'weather.cod.edu', ext: 'png' },
    usint: { filename: 'usint', baseUrl: 'weather.cod.edu', ext: 'png' },
    ushw: { filename: 'ushw', baseUrl: 'weather.cod.edu', ext: 'png' },
    usstrd: { filename: 'usstrd', baseUrl: 'weather.cod.edu', ext: 'png' },
    cities: { filename: 'id', baseUrl: 'climate.cod.edu', ext: 'gif' },
  };

  // Get list of enabled overlays with proper null checking
  const enabledOverlays = Object.keys(overlayConfig).filter(
    overlayId => overlayStates?.[overlayId]?.enabled === true
  );

  if (enabledOverlays.length === 0 || !overlayStates) {
    return null;
  }

  // Determine the wrapper style based on display mode (match satellite image)
  const imageWrapperStyle = displayMode === 'cover'
    ? [styles.overlayContainer, styles.overlayContainerCover]
    : styles.overlayContainer;

  // Generate the boundary image URL based on domain type and overlay type
  const getBoundaryUrl = (overlayId) => {
    const domainType = selectedDomain.type;
    const codName = selectedDomain.codName;
    const config = overlayConfig[overlayId];

    if (!config) return null;

    // For full disk, we don't have boundary overlays
    if (domainType === DOMAIN_TYPES.FULL_DISK) {
      return null;
    }

    const { filename, baseUrl, ext } = config;

    // For CONUS
    if (domainType === DOMAIN_TYPES.CONUS) {
      // Cities use climate.cod.edu and satellite_r path
      if (baseUrl === 'climate.cod.edu') {
        return `https://${baseUrl}/data/satellite_r/continental/${codName}/maps/${codName}_${filename}.${ext}`;
      }
      return `https://${baseUrl}/data/satellite/continental/${codName}/maps/${codName}_${filename}.${ext}`;
    }

    // For regional domains
    if (domainType === DOMAIN_TYPES.REGIONAL) {
      // Cities use climate.cod.edu and satellite_r path
      if (baseUrl === 'climate.cod.edu') {
        return `https://${baseUrl}/data/satellite_r/regional/${codName}/maps/${codName}_${filename}.${ext}`;
      }
      return `https://${baseUrl}/data/satellite/regional/${codName}/maps/${codName}_${filename}.${ext}`;
    }

    // For local domains
    if (domainType === DOMAIN_TYPES.LOCAL) {
      // Cities use climate.cod.edu and satellite_r path
      if (baseUrl === 'climate.cod.edu') {
        return `https://${baseUrl}/data/satellite_r/local/${codName}/maps/${codName}_${filename}.${ext}`;
      }
      return `https://${baseUrl}/data/satellite/local/${codName}/maps/${codName}_${filename}.${ext}`;
    }

    return null;
  };

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
    <Animated.View
      style={[StyleSheet.absoluteFill, animatedStyle]}
      pointerEvents="none"
    >
      <View style={imageWrapperStyle}>
        {enabledOverlays.map((overlayId) => {
          const url = getBoundaryUrl(overlayId);
          if (!url) return null;

          return (
            <Image
              key={overlayId}
              source={{ uri: url }}
              style={styles.boundaryImage}
              resizeMode="contain"
              fadeDuration={0}
              onError={(error) => {
                console.warn(
                  `Boundary overlay '${overlayId}' load error:`,
                  error.nativeEvent?.error || 'Unknown error'
                );
              }}
            />
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    width: '100%',
    height: '100%',
  },
  overlayContainerCover: {
    width: '200%',
    height: '200%',
  },
  boundaryImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});
