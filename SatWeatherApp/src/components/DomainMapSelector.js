import React, { useState, useRef, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
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
import { generateCODImageUrl, generateCurrentTimestamp } from '../utils/imageService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_CONTAINER_HEIGHT = SCREEN_HEIGHT - 160; // Leave room for header and instructions

export const DomainMapSelector = () => {
  const {
    showDomainMap,
    setShowDomainMap,
    selectDomain,
    selectedRGBProduct,
    selectedChannel,
    viewMode,
  } = useApp();

  const [selectorMode, setSelectorMode] = useState('menu'); // 'menu', 'regional', 'local'
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });

  // Zoom/pan state
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Refs for gesture handlers
  const panRef = useRef();
  const pinchRef = useRef();

  // Load CONUS map image when entering regional/local view
  useEffect(() => {
    if (selectorMode === 'regional' || selectorMode === 'local') {
      loadConusMapImage();
    }
  }, [selectorMode, selectedRGBProduct, selectedChannel, viewMode]);

  // Reset zoom when changing modes
  useEffect(() => {
    if (selectorMode === 'menu') {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [selectorMode]);

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
      const timestamp = generateCurrentTimestamp();

      const url = generateCODImageUrl(conusDomain, currentProduct, timestamp);
      if (url) {
        setMapImageUrl(url);
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
    setSelectorMode('menu');
  };

  const handleRegionSelect = (regionKey) => {
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
  };

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

  // Gesture handlers for zoom/pan
  const pinchHandler = useAnimatedGestureHandler({
    onStart: () => {
      savedScale.value = scale.value;
    },
    onActive: (event) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
    },
    onEnd: () => {
      savedScale.value = scale.value;
    },
  });

  const panHandler = useAnimatedGestureHandler({
    onStart: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
    onActive: (event) => {
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
    },
    onEnd: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
  });

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
    const regions = selectorMode === 'local' ? CATEGORIZED_REGIONS.local : CATEGORIZED_REGIONS.regional;

    // Calculate the actual rendered image size (accounting for resizeMode="contain")
    if (containerDimensions.width === 0 || mapDimensions.width === 0) {
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

    return regions.map((regionKey) => {
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

      const color = generateRegionColor(regionKey);

      return (
        <TouchableOpacity
          key={regionKey}
          style={[
            styles.regionDotContainer,
            {
              left: adjustedX - 12,
              top: adjustedY - 12,
            },
          ]}
          onPress={() => handleRegionSelect(regionKey)}
          activeOpacity={0.7}
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
              pointerEvents="none"
            />
          )}
          {/* Center dot */}
          <View style={[styles.regionDot, { backgroundColor: color }]} />
        </TouchableOpacity>
      );
    });
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
          <PanGestureHandler
            ref={panRef}
            simultaneousHandlers={pinchRef}
            onGestureEvent={panHandler}
            minPointers={1}
            maxPointers={2}
          >
            <Animated.View style={styles.gestureContainer}>
              <PinchGestureHandler
                ref={pinchRef}
                simultaneousHandlers={panRef}
                onGestureEvent={pinchHandler}
              >
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
                  {/* Overlay dots on top of the map */}
                  <View style={styles.dotsOverlay}>{renderRegionDots()}</View>
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        )}

        {/* Map controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.controlButton} onPress={resetZoom}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.controlButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapInstructions}>
          <Text style={styles.instructionsText}>
            Pinch to zoom, drag to pan. Tap a dot to select that region.
          </Text>
          <Text style={styles.instructionsSubtext}>
            {selectorMode === 'local'
              ? `${CATEGORIZED_REGIONS.local.length} local regions available`
              : `${CATEGORIZED_REGIONS.regional.length} regional areas available`}
          </Text>
        </View>
      </View>
    );
  };

  const renderMenuView = () => {
    return (
      <View style={styles.menuContainer}>
        {/* Full Disk */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleDomainSelect(DOMAINS.FULL_DISK)}
        >
          <Ionicons name="globe" size={32} color="#2196F3" />
          <Text style={styles.menuCardTitle}>Full Disk</Text>
          <Text style={styles.menuCardSubtitle}>Entire hemisphere view</Text>
        </TouchableOpacity>

        {/* CONUS */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleDomainSelect(DOMAINS.CONUS)}
        >
          <Ionicons name="location" size={32} color="#2196F3" />
          <Text style={styles.menuCardTitle}>CONUS</Text>
          <Text style={styles.menuCardSubtitle}>Continental United States</Text>
        </TouchableOpacity>

        {/* Mesoscale 1 */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleDomainSelect(DOMAINS.MESOSCALE_1)}
        >
          <Ionicons name="scan" size={32} color="#FF9800" />
          <Text style={styles.menuCardTitle}>Mesoscale 1</Text>
          <Text style={styles.menuCardSubtitle}>Dynamic mesoscale domain</Text>
        </TouchableOpacity>

        {/* Mesoscale 2 */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleDomainSelect(DOMAINS.MESOSCALE_2)}
        >
          <Ionicons name="scan" size={32} color="#FF9800" />
          <Text style={styles.menuCardTitle}>Mesoscale 2</Text>
          <Text style={styles.menuCardSubtitle}>Dynamic mesoscale domain</Text>
        </TouchableOpacity>

        {/* Regional - Select on Map */}
        <TouchableOpacity style={styles.menuCard} onPress={() => setSelectorMode('regional')}>
          <Ionicons name="map" size={32} color="#4CAF50" />
          <Text style={styles.menuCardTitle}>Regional</Text>
          <Text style={styles.menuCardSubtitle}>Select on map</Text>
        </TouchableOpacity>

        {/* Local - Select on Map */}
        <TouchableOpacity style={styles.menuCard} onPress={() => setSelectorMode('local')}>
          <Ionicons name="navigate" size={32} color="#4CAF50" />
          <Text style={styles.menuCardTitle}>Local</Text>
          <Text style={styles.menuCardSubtitle}>Select on map</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const getTitle = () => {
    switch (selectorMode) {
      case 'regional':
        return 'Select Regional Domain';
      case 'local':
        return 'Select Local Domain';
      default:
        return 'Select Domain';
    }
  };

  return (
    <Modal
      visible={showDomainMap}
      animationType="slide"
      onRequestClose={() => {
        setShowDomainMap(false);
        setSelectorMode('menu');
      }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {selectorMode !== 'menu' && (
            <TouchableOpacity
              onPress={() => setSelectorMode('menu')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setShowDomainMap(false);
              setSelectorMode('menu');
            }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{getTitle()}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        {selectorMode === 'menu' ? renderMenuView() : renderMapView()}
      </View>
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
  backButton: {
    padding: 8,
    position: 'absolute',
    left: 8,
    zIndex: 10,
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
  menuContainer: {
    flex: 1,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'flex-start',
  },
  menuCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    width: '48%',
    marginBottom: 12,
  },
  menuCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  menuCardSubtitle: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  gestureContainer: {
    flex: 1,
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
