import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DOMAINS, DOMAIN_TYPES } from '../constants/domains';
import { REGION_FILTERS, REGION_DISPLAY_NAMES, ALL_REGIONS } from '../constants/regions';
import { getSatelliteViewType } from '../constants/satellites';
import { getBaseMapImage } from '../utils/imageService';
import { BASE_MAP_BOUNDS } from '../utils/coordinateConverter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Colors for different regions - cycle through these
const REGION_COLORS = [
  '#FF5722', // Deep Orange
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#03A9F4', // Light Blue
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#CDDC39', // Lime
  '#FFEB3B', // Yellow
  '#FFC107', // Amber
  '#FF9800', // Orange
  '#795548', // Brown
  '#607D8B', // Blue Grey
];

// Categorize regions by size (width x height in degrees)
const categorizeBySize = (regionId) => {
  const bounds = ALL_REGIONS[regionId];
  if (!bounds) return 'unknown';

  const [westLon, eastLon, southLat, northLat] = bounds;
  const width = Math.abs(eastLon - westLon);
  const height = Math.abs(northLat - southLat);

  // Regional scale (~20-30 degrees wide, 10+ high)
  if (width >= 20 && height >= 10) return 'regional';

  // Local scale (~10x6 or smaller)
  return 'local';
};

// Convert geo coordinates to percentage position on image
const geoToImagePercent = (lon, lat, imageBounds) => {
  const [westLon, eastLon, southLat, northLat] = imageBounds;
  const xPercent = ((lon - westLon) / (eastLon - westLon)) * 100;
  const yPercent = ((northLat - lat) / (northLat - southLat)) * 100;
  return { xPercent, yPercent };
};

export const DomainMapSelector = () => {
  const {
    showDomainMap,
    setShowDomainMap,
    selectDomain,
    selectedSatellite,
    selectedRGBProduct,
    selectedChannel,
    viewMode: productViewMode,
  } = useApp();

  const selectedProduct = productViewMode === 'rgb' ? selectedRGBProduct : selectedChannel;

  const [viewMode, setViewMode] = useState('menu'); // 'menu', 'regional', 'local'
  const [baseMapUrl, setBaseMapUrl] = useState(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const imageRef = useRef(null);

  // Get regions filtered by size category
  const getRegionsByCategory = (category) => {
    const filterType = getSatelliteViewType(selectedSatellite, 'conus');
    const allRegionIds = REGION_FILTERS[filterType] || [];

    return allRegionIds.filter((id) => {
      const sizeCategory = categorizeBySize(id);
      return sizeCategory === category;
    });
  };

  // Load the base map image
  const loadBaseMap = async () => {
    setIsLoadingMap(true);
    try {
      const result = await getBaseMapImage('conus', selectedProduct);
      if (result) {
        setBaseMapUrl(result.url);
      }
    } catch (error) {
      console.error('Failed to load base map:', error);
    } finally {
      setIsLoadingMap(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'regional' || viewMode === 'local') {
      loadBaseMap();
    }
  }, [viewMode]);

  const handleRegionSelect = (regionId) => {
    const existingDomain = Object.values(DOMAINS).find(
      (d) => d.id === regionId || d.codName === regionId
    );

    if (existingDomain) {
      selectDomain(existingDomain);
      setShowDomainMap(false);
      setViewMode('menu');
      return;
    }

    const bounds = ALL_REGIONS[regionId];
    if (!bounds) {
      console.error('Unknown region:', regionId);
      return;
    }

    const [westLon, eastLon, southLat, northLat] = bounds;
    const displayName = REGION_DISPLAY_NAMES[regionId] || regionId;
    const sizeCategory = categorizeBySize(regionId);
    const domainType = sizeCategory === 'regional' ? DOMAIN_TYPES.REGIONAL : DOMAIN_TYPES.LOCAL;

    const newDomain = {
      id: regionId,
      name: displayName,
      type: domainType,
      codName: regionId,
      description: displayName,
      bounds: {
        minLat: southLat,
        maxLat: northLat,
        minLon: westLon,
        maxLon: eastLon,
      },
    };
    selectDomain(newDomain);
    setShowDomainMap(false);
    setViewMode('menu');
  };

  // Handle image layout to get actual image dimensions
  const onImageLoad = (event) => {
    const { width, height } = event.nativeEvent.source;
    // Calculate the actual rendered size while maintaining aspect ratio
    if (imageRef.current) {
      imageRef.current.measure((x, y, w, h, pageX, pageY) => {
        // The image uses resizeMode="contain", so we need to calculate the actual image area
        const containerAspect = w / h;
        const imageAspect = width / height;

        let actualWidth, actualHeight, offsetX, offsetY;

        if (imageAspect > containerAspect) {
          // Image is wider than container - full width, partial height
          actualWidth = w;
          actualHeight = w / imageAspect;
          offsetX = 0;
          offsetY = (h - actualHeight) / 2;
        } else {
          // Image is taller than container - full height, partial width
          actualHeight = h;
          actualWidth = h * imageAspect;
          offsetX = (w - actualWidth) / 2;
          offsetY = 0;
        }

        setImageLayout({
          width: actualWidth,
          height: actualHeight,
          x: offsetX,
          y: offsetY,
        });
      });
    }
  };

  // Render region dot with rectangle bounds
  const renderRegionMarker = (regionId, index, mapBounds) => {
    const regionBounds = ALL_REGIONS[regionId];
    if (!regionBounds) return null;

    const [westLon, eastLon, southLat, northLat] = regionBounds;
    const centerLon = (westLon + eastLon) / 2;
    const centerLat = (southLat + northLat) / 2;

    // Get center position
    const centerPos = geoToImagePercent(centerLon, centerLat, mapBounds);

    // Check if center is within image bounds
    if (
      centerPos.xPercent < 0 ||
      centerPos.xPercent > 100 ||
      centerPos.yPercent < 0 ||
      centerPos.yPercent > 100
    ) {
      return null;
    }

    // Get rectangle corners
    const topLeft = geoToImagePercent(westLon, northLat, mapBounds);
    const bottomRight = geoToImagePercent(eastLon, southLat, mapBounds);

    // Clamp rectangle to image bounds
    const rectLeft = Math.max(0, Math.min(100, topLeft.xPercent));
    const rectTop = Math.max(0, Math.min(100, topLeft.yPercent));
    const rectRight = Math.max(0, Math.min(100, bottomRight.xPercent));
    const rectBottom = Math.max(0, Math.min(100, bottomRight.yPercent));

    const rectWidth = rectRight - rectLeft;
    const rectHeight = rectBottom - rectTop;

    // Get color for this region
    const color = REGION_COLORS[index % REGION_COLORS.length];
    const displayName = REGION_DISPLAY_NAMES[regionId] || regionId;

    return (
      <React.Fragment key={regionId}>
        {/* Rectangle showing region bounds */}
        <View
          style={[
            styles.regionRect,
            {
              left: `${rectLeft}%`,
              top: `${rectTop}%`,
              width: `${rectWidth}%`,
              height: `${rectHeight}%`,
              borderColor: color,
            },
          ]}
          pointerEvents="none"
        />
        {/* Dot at center */}
        <TouchableOpacity
          style={[
            styles.regionDot,
            {
              left: `${centerPos.xPercent}%`,
              top: `${centerPos.yPercent}%`,
            },
          ]}
          onPress={() => handleRegionSelect(regionId)}
        >
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.dotLabel} numberOfLines={1}>
            {displayName}
          </Text>
        </TouchableOpacity>
      </React.Fragment>
    );
  };

  // Render map with region dots
  const renderMapView = (category) => {
    const regionIds = getRegionsByCategory(category);
    const mapBounds = BASE_MAP_BOUNDS.conus;

    return (
      <View style={styles.mapContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapHeaderText}>
            {category === 'regional' ? 'Regional Domains' : 'Local Domains'} ({regionIds.length})
          </Text>
        </View>

        <View style={styles.mapWrapper}>
          {isLoadingMap ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading satellite image...</Text>
            </View>
          ) : baseMapUrl ? (
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom={true}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent={true}
            >
              <View style={styles.imageContainer}>
                <Image
                  ref={imageRef}
                  source={{ uri: baseMapUrl }}
                  style={styles.mapImage}
                  resizeMode="contain"
                  onLoad={onImageLoad}
                  onError={(e) => console.error('Image load error:', e.nativeEvent.error)}
                />
                {/* Overlay dots only on the image area */}
                <View
                  style={[
                    styles.dotsOverlay,
                    {
                      left: imageLayout.x,
                      top: imageLayout.y,
                      width: imageLayout.width || '100%',
                      height: imageLayout.height || '100%',
                    },
                  ]}
                >
                  {regionIds.map((regionId, index) =>
                    renderRegionMarker(regionId, index, mapBounds)
                  )}
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.placeholderText}>CONUS View</Text>
            </View>
          )}
        </View>

        <View style={styles.mapInstructions}>
          <Text style={styles.instructionsText}>
            Pinch to zoom • Drag to pan • Tap a dot to select
          </Text>
        </View>
      </View>
    );
  };

  // Main menu view with all 6 options
  const renderMenuView = () => {
    const regionalCount = getRegionsByCategory('regional').length;
    const localCount = getRegionsByCategory('local').length;

    return (
      <View style={styles.menuContainer}>
        {/* Full Disk - Direct select */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleRegionSelect('full_disk')}
        >
          <Ionicons name="globe" size={24} color="#4CAF50" />
          <Text style={styles.menuItemText}>Full Disk</Text>
        </TouchableOpacity>

        {/* CONUS - Direct select */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleRegionSelect('conus')}
        >
          <Ionicons name="map-outline" size={24} color="#FF9800" />
          <Text style={styles.menuItemText}>CONUS</Text>
        </TouchableOpacity>

        {/* Regional - Opens map */}
        <TouchableOpacity style={styles.menuItem} onPress={() => setViewMode('regional')}>
          <Ionicons name="map" size={24} color="#2196F3" />
          <Text style={styles.menuItemText}>Regional ({regionalCount})</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* Local - Opens map */}
        <TouchableOpacity style={styles.menuItem} onPress={() => setViewMode('local')}>
          <Ionicons name="navigate" size={24} color="#E91E63" />
          <Text style={styles.menuItemText}>Local ({localCount})</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* Meso1 - Direct select */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => selectDomain(DOMAINS.MESOSCALE_1)}
        >
          <Ionicons name="scan" size={24} color="#9C27B0" />
          <Text style={styles.menuItemText}>Mesoscale 1</Text>
        </TouchableOpacity>

        {/* Meso2 - Direct select */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => selectDomain(DOMAINS.MESOSCALE_2)}
        >
          <Ionicons name="scan-outline" size={24} color="#673AB7" />
          <Text style={styles.menuItemText}>Mesoscale 2</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const getTitle = () => {
    switch (viewMode) {
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
        setViewMode('menu');
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          {viewMode !== 'menu' && (
            <TouchableOpacity onPress={() => setViewMode('menu')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setShowDomainMap(false);
              setViewMode('menu');
            }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{getTitle()}</Text>
          <View style={{ width: 40 }} />
        </View>

        {viewMode === 'menu' && renderMenuView()}
        {viewMode === 'regional' && renderMapView('regional')}
        {viewMode === 'local' && renderMapView('local')}
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
    justifyContent: 'center',
  },
  menuItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  menuItemText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  mapHeader: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  mapHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapWrapper: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    minHeight: '100%',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1a3a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#ccc',
    marginTop: 16,
    fontSize: 14,
  },
  dotsOverlay: {
    position: 'absolute',
  },
  regionRect: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
    opacity: 0.6,
  },
  regionDot: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    zIndex: 10,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  dotLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    maxWidth: 80,
    textAlign: 'center',
  },
  mapInstructions: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 11,
    textAlign: 'center',
  },
});
