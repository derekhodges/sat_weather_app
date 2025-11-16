import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useApp } from '../context/AppContext';
import { DOMAINS } from '../constants/domains';
import {
  ALL_REGIONS,
  CATEGORIZED_REGIONS,
  getRegionCenter,
  geoToMapPosition,
  regionBoundsToMapRect,
  generateRegionColor,
  getRegionSize,
} from '../constants/regions';
import { getLatestImageUrl } from '../utils/imageService';

// Note: DOMAINS is used in loadConusMapImage

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_CONTAINER_HEIGHT = SCREEN_HEIGHT - 160; // Leave room for header and instructions

export const DomainMapSelector = () => {
  const {
    showDomainMap,
    setShowDomainMap,
    domainMapMode,
    setDomainMapMode,
    selectDomain,
    selectedRGBProduct,
    selectedChannel,
    viewMode,
    selectedSatellite,
  } = useApp();

  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [useGoesWest, setUseGoesWest] = useState(false); // Default to GOES East (current satellite)

  // Store computed dot positions for hit testing
  const dotPositionsRef = useRef([]);

  // Zoom/pan state
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Initialize satellite selection based on current satellite when modal opens
  useEffect(() => {
    if (showDomainMap && domainMapMode) {
      // Default to GOES West if current satellite is GOES-18, otherwise GOES East
      const isWest = selectedSatellite?.id === 'goes18' || selectedSatellite?.id === 'goes-west';
      setUseGoesWest(isWest);
    }
  }, [showDomainMap, domainMapMode, selectedSatellite]);

  // Load CONUS map image when modal opens or satellite toggle changes
  useEffect(() => {
    if (showDomainMap && domainMapMode) {
      loadConusMapImage();
    }
  }, [showDomainMap, domainMapMode, selectedRGBProduct, selectedChannel, viewMode, useGoesWest]);

  // Reset zoom when modal closes
  useEffect(() => {
    if (!showDomainMap) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      setMapImageUrl(null);
      setMapDimensions({ width: 0, height: 0 });
      setContainerDimensions({ width: 0, height: 0 });
      setImageOffset({ x: 0, y: 0 });
    }
  }, [showDomainMap]);

  // Recalculate image offset when container or image dimensions change
  useEffect(() => {
    if (containerDimensions.width > 0 && mapDimensions.width > 0) {
      const containerAspect = containerDimensions.width / containerDimensions.height;
      const imageAspect = mapDimensions.width / mapDimensions.height;

      let offsetX, offsetY;

      if (imageAspect > containerAspect) {
        // Image is wider - will have letterboxing on top/bottom
        const renderedHeight = containerDimensions.width / imageAspect;
        offsetX = 0;
        offsetY = (containerDimensions.height - renderedHeight) / 2;
      } else {
        // Image is taller - will have letterboxing on left/right
        const renderedWidth = containerDimensions.height * imageAspect;
        offsetX = (containerDimensions.width - renderedWidth) / 2;
        offsetY = 0;
      }

      setImageOffset({ x: offsetX, y: offsetY });
    }
  }, [containerDimensions, mapDimensions]);

  const loadConusMapImage = async () => {
    setIsLoadingMap(true);
    try {
      // Create a CONUS domain object for URL generation
      const conusDomain = DOMAINS.CONUS;
      const currentProduct = viewMode === 'rgb' ? selectedRGBProduct : selectedChannel;

      // Get validated URL that actually exists
      const result = await getLatestImageUrl(conusDomain, currentProduct, 12);
      if (result && result.url) {
        setMapImageUrl(result.url);
      }
    } catch (error) {
      console.error('Error loading CONUS map:', error);
    } finally {
      setIsLoadingMap(false);
    }
  };

  const handleDomainSelect = (domain) => {
    selectDomain(domain);
    setShowDomainMap(false);
    setDomainMapMode(null);
  };

  const handleRegionSelect = useCallback((regionKey) => {
    // Create a domain object for the selected region
    const regionBounds = ALL_REGIONS[regionKey];
    const { width, height } = getRegionSize(regionKey);
    const isLocal = width * height <= 70;

    const domain = {
      id: regionKey,
      name: regionKey
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      type: isLocal ? 'local' : 'regional',
      codName: regionKey,
      description: `${regionKey} region`,
      bounds: {
        minLat: regionBounds[2],
        maxLat: regionBounds[3],
        minLon: regionBounds[0],
        maxLon: regionBounds[1],
      },
    };

    handleDomainSelect(domain);
  }, [handleDomainSelect]);

  const handleImageLoad = (event) => {
    const { width: sourceWidth, height: sourceHeight } = event.nativeEvent.source;
    setMapDimensions({ width: sourceWidth, height: sourceHeight });

    // Calculate the actual rendered size and offset when using resizeMode="contain"
    if (containerDimensions.width > 0 && containerDimensions.height > 0) {
      const containerAspect = containerDimensions.width / containerDimensions.height;
      const imageAspect = sourceWidth / sourceHeight;

      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (imageAspect > containerAspect) {
        // Image is wider - will have letterboxing on top/bottom
        renderedWidth = containerDimensions.width;
        renderedHeight = containerDimensions.width / imageAspect;
        offsetX = 0;
        offsetY = (containerDimensions.height - renderedHeight) / 2;
      } else {
        // Image is taller - will have letterboxing on left/right
        renderedHeight = containerDimensions.height;
        renderedWidth = containerDimensions.height * imageAspect;
        offsetX = (containerDimensions.width - renderedWidth) / 2;
        offsetY = 0;
      }

      setImageOffset({ x: offsetX, y: offsetY });
    }
  };

  const handleContainerLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerDimensions({ width, height });
  };

  // Check if a tap hit a dot and handle selection
  const checkDotHit = useCallback((tapX, tapY) => {
    // Transform tap coordinates back to unzoomed/unpanned space
    // The tap is in screen space, but dots are in transformed space
    // Reverse the transform: first undo scale, then undo translate
    const currentScale = scale.value;
    const currentTranslateX = translateX.value;
    const currentTranslateY = translateY.value;

    // The center of the container is the transform origin
    const containerCenterX = containerDimensions.width / 2;
    const containerCenterY = containerDimensions.height / 2;

    // Convert tap from screen space to content space
    // 1. Offset by translation
    // 2. Scale from center
    const contentX = (tapX - containerCenterX - currentTranslateX) / currentScale + containerCenterX;
    const contentY = (tapY - containerCenterY - currentTranslateY) / currentScale + containerCenterY;

    // Check each dot position
    const hitRadius = 20; // Tap tolerance in content space
    for (const dot of dotPositionsRef.current) {
      const dx = contentX - dot.x;
      const dy = contentY - dot.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= hitRadius) {
        handleRegionSelect(dot.regionKey);
        return;
      }
    }
  }, [containerDimensions, handleRegionSelect, scale, translateX, translateY]);

  // Gesture handlers for zoom/pan using new Gesture API
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const maxTranslateX = ((scale.value - 1) * SCREEN_WIDTH) / 2;
      const maxTranslateY = ((scale.value - 1) * MAP_CONTAINER_HEIGHT) / 2;

      translateX.value = Math.max(
        -maxTranslateX,
        Math.min(maxTranslateX, savedTranslateX.value + event.translationX)
      );
      translateY.value = Math.max(
        -maxTranslateY,
        Math.min(maxTranslateY, savedTranslateY.value + event.translationY)
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Tap gesture for selecting dots - only fires if pan/pinch don't consume the touch
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      'worklet';
      runOnJS(checkDotHit)(event.x, event.y);
    });

  // Race between pan/pinch and tap - pan/pinch take priority if movement detected
  const composedGesture = Gesture.Race(
    Gesture.Simultaneous(panGesture, pinchGesture),
    tapGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const resetZoom = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const renderRegionDots = () => {
    const regions = domainMapMode === 'local' ? CATEGORIZED_REGIONS.local : CATEGORIZED_REGIONS.regional;

    // Calculate the actual rendered image size (accounting for resizeMode="contain")
    if (containerDimensions.width === 0 || mapDimensions.width === 0) {
      dotPositionsRef.current = [];
      return null; // Wait for dimensions to be calculated
    }

    const containerAspect = containerDimensions.width / containerDimensions.height;
    const imageAspect = mapDimensions.width / mapDimensions.height;

    let renderedWidth, renderedHeight;

    if (imageAspect > containerAspect) {
      // Image is wider - letterboxing on top/bottom
      renderedWidth = containerDimensions.width;
      renderedHeight = containerDimensions.width / imageAspect;
    } else {
      // Image is taller - letterboxing on left/right
      renderedHeight = containerDimensions.height;
      renderedWidth = containerDimensions.height * imageAspect;
    }

    // Build dot positions for hit testing
    const newDotPositions = [];

    const dots = regions.map((regionKey) => {
      const center = getRegionCenter(regionKey);
      if (!center) return null;

      // Convert geographic center to position relative to rendered image
      const position = geoToMapPosition(center.lon, center.lat, renderedWidth, renderedHeight);

      // Get region bounds for the border/rectangle
      const rect = regionBoundsToMapRect(regionKey, renderedWidth, renderedHeight);

      // Adjust position for letterboxing offset
      const adjustedX = position.x + imageOffset.x;
      const adjustedY = position.y + imageOffset.y;

      // Skip if position is outside the visible CONUS area (with some margin)
      if (
        position.x < -50 ||
        position.x > renderedWidth + 50 ||
        position.y < -50 ||
        position.y > renderedHeight + 50
      ) {
        return null;
      }

      // Store position for hit testing
      newDotPositions.push({
        regionKey,
        x: adjustedX,
        y: adjustedY,
      });

      const color = generateRegionColor(regionKey);

      return (
        <View
          key={regionKey}
          style={[
            styles.regionDotContainer,
            {
              left: adjustedX - 12,
              top: adjustedY - 12,
            },
          ]}
        >
          {/* Show coverage rectangle as border */}
          {rect && (
            <View
              style={[
                styles.coverageRect,
                {
                  left: rect.left - position.x + 12,
                  top: rect.top - position.y + 12,
                  width: rect.width,
                  height: rect.height,
                  borderColor: color,
                },
              ]}
            />
          )}
          {/* Center dot */}
          <View style={[styles.regionDot, { backgroundColor: color }]} />
        </View>
      );
    });

    // Update dot positions ref for hit testing
    dotPositionsRef.current = newDotPositions;

    return dots;
  };

  const renderMapView = () => {
    return (
      <View style={styles.mapContainer} onLayout={handleContainerLayout}>
        {isLoadingMap ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        ) : (
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.mapImageContainer, animatedStyle]}>
              {mapImageUrl && (
                <Image
                  source={{ uri: mapImageUrl }}
                  style={styles.mapImage}
                  resizeMode="contain"
                  onLoad={handleImageLoad}
                  onError={(error) => {
                    console.error('Failed to load map image:', error);
                    setMapImageUrl(null);
                  }}
                />
              )}
              {/* Overlay dots on top of the map - pointerEvents none ensures gestures work everywhere */}
              <View style={styles.dotsOverlay} pointerEvents="none">
                {renderRegionDots()}
              </View>
            </Animated.View>
          </GestureDetector>
        )}

        {/* Map controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.controlButton} onPress={resetZoom}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.controlButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { marginTop: 8 }]}
            onPress={() => setUseGoesWest(!useGoesWest)}
          >
            <Ionicons name="swap-horizontal" size={20} color="#fff" />
            <Text style={styles.controlButtonText}>{useGoesWest ? 'West' : 'East'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapInstructions}>
          <Text style={styles.instructionsText}>
            Pinch to zoom, drag to pan. Tap a dot to select that region.
          </Text>
          <Text style={styles.instructionsSubtext}>
            {domainMapMode === 'local'
              ? `${CATEGORIZED_REGIONS.local.length} local regions available`
              : `${CATEGORIZED_REGIONS.regional.length} regional areas available`}
          </Text>
        </View>
      </View>
    );
  };

  const getTitle = () => {
    return domainMapMode === 'local' ? 'Select Local Domain' : 'Select Regional Domain';
  };

  return (
    <Modal
      visible={showDomainMap && domainMapMode !== null}
      animationType="slide"
      onRequestClose={() => {
        setShowDomainMap(false);
        setDomainMapMode(null);
      }}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setShowDomainMap(false);
              setDomainMapMode(null);
            }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{getTitle()}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content - directly show map */}
        {renderMapView()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    height: 60,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapImageContainer: {
    flex: 1,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  dotsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  regionDotContainer: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  coverageRect: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 100,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
  },
  mapInstructions: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  instructionsSubtext: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
