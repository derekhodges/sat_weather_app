import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DOMAINS, DOMAIN_TYPES } from '../constants/domains';
import { REGION_FILTERS, REGION_DISPLAY_NAMES, ALL_REGIONS } from '../constants/regions';
import { getSatelliteViewType } from '../constants/satellites';
import { getBaseMapImage } from '../utils/imageService';
import { getRegionPercentPosition, BASE_MAP_BOUNDS } from '../utils/coordinateConverter';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Categorize regions by size (width x height in degrees)
// REGIONAL: ~20x10+ degrees, LOCAL: ~10x6 degrees
const categorizeBySize = (regionId) => {
  const bounds = ALL_REGIONS[regionId];
  if (!bounds) return 'unknown';

  const [westLon, eastLon, southLat, northLat] = bounds;
  const width = Math.abs(eastLon - westLon);
  const height = Math.abs(northLat - southLat);

  // Hemisphere/very large views
  if (width > 100 || height > 50) return 'hemisphere';

  // CONUS-scale (full continental)
  if (width > 50 || height > 25) return 'conus';

  // Regional scale (~20-30 degrees wide, 15+ high)
  if (width >= 20 && height >= 10) return 'regional';

  // Local scale (~10x6 or smaller)
  return 'local';
};

// Get color for category
const getCategoryColor = (category) => {
  switch (category) {
    case 'regional':
      return '#2196F3'; // Blue for regional
    case 'local':
      return '#FF5722'; // Orange for local
    case 'offshore':
      return '#00BCD4'; // Cyan for offshore
    case 'international':
      return '#9C27B0'; // Purple for international
    case 'hemisphere':
      return '#4CAF50'; // Green for hemisphere
    default:
      return '#FF9800'; // Default orange
  }
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

  // Get the currently selected product (RGB or channel)
  const selectedProduct = productViewMode === 'rgb' ? selectedRGBProduct : selectedChannel;

  const [viewMode, setViewMode] = useState('menu'); // 'menu', 'regional', 'local'
  const [baseMapUrl, setBaseMapUrl] = useState(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const mapContainerRef = useRef(null);

  // Get regions filtered by size category
  const getRegionsByCategory = (category) => {
    const filterType = getSatelliteViewType(selectedSatellite, 'conus');
    const allRegionIds = REGION_FILTERS[filterType] || [];

    return allRegionIds.filter((id) => {
      const sizeCategory = categorizeBySize(id);
      if (category === 'regional') {
        return sizeCategory === 'regional';
      } else if (category === 'local') {
        return sizeCategory === 'local';
      }
      return false;
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

  // When view mode changes, load map if needed
  useEffect(() => {
    if (viewMode === 'regional' || viewMode === 'local') {
      loadBaseMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Handle domain/region selection
  const handleRegionSelect = (regionId) => {
    // Check if this region already exists in DOMAINS first
    const existingDomain = Object.values(DOMAINS).find(
      (d) => d.id === regionId || d.codName === regionId
    );

    if (existingDomain) {
      selectDomain(existingDomain);
      setShowDomainMap(false);
      setViewMode('menu');
      return;
    }

    // Create a domain object for the selected region from ALL_REGIONS
    const bounds = ALL_REGIONS[regionId];
    if (!bounds) {
      console.error('Unknown region:', regionId);
      return;
    }

    const [westLon, eastLon, southLat, northLat] = bounds;
    const displayName = REGION_DISPLAY_NAMES[regionId] || regionId;

    // Determine domain type based on size
    const sizeCategory = categorizeBySize(regionId);
    const domainType = sizeCategory === 'regional' ? DOMAIN_TYPES.REGIONAL : DOMAIN_TYPES.LOCAL;

    // Create a new domain object for this region
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

  // Calculate map container dimensions
  const onMapContainerLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setMapDimensions({ width, height });
  };

  // Render map with region dots
  const renderMapView = (category) => {
    const regionIds = getRegionsByCategory(category);
    const mapBounds = BASE_MAP_BOUNDS.conus;

    // Color for this category
    const categoryColor = category === 'regional' ? '#2196F3' : '#FF5722';

    return (
      <View style={styles.mapContainer}>
        {/* Header info */}
        <View style={styles.mapHeader}>
          <Text style={styles.mapHeaderText}>
            {category === 'regional' ? 'Regional Domains' : 'Local Domains'} ({regionIds.length}{' '}
            available)
          </Text>
          <Text style={styles.mapHeaderSubtext}>
            Satellite: {selectedSatellite?.name || 'GOES-19'} (
            {selectedSatellite?.location || 'East'})
          </Text>
        </View>

        {/* Map background with dots */}
        <View style={styles.mapWrapper} onLayout={onMapContainerLayout} ref={mapContainerRef}>
          {isLoadingMap ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={categoryColor} />
              <Text style={styles.loadingText}>Loading satellite image...</Text>
            </View>
          ) : baseMapUrl ? (
            <Image
              source={{ uri: baseMapUrl }}
              style={styles.mapImage}
              resizeMode="contain"
              onError={(e) => console.error('Image load error:', e.nativeEvent.error)}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.placeholderText}>CONUS View</Text>
            </View>
          )}

          {/* Region dots overlay - constrained to image bounds */}
          <View style={styles.dotsOverlay}>
            {regionIds.map((regionId) => {
              const position = getRegionPercentPosition(regionId, mapBounds);

              // Skip if out of bounds - constrain to image only
              if (!position.visible) return null;

              // Strict bounds check - dots must be within the image
              if (
                position.xPercent < 0 ||
                position.xPercent > 100 ||
                position.yPercent < 0 ||
                position.yPercent > 100
              ) {
                return null;
              }

              const displayName = REGION_DISPLAY_NAMES[regionId] || regionId;

              return (
                <TouchableOpacity
                  key={regionId}
                  style={[
                    styles.regionDot,
                    {
                      left: `${position.xPercent}%`,
                      top: `${position.yPercent}%`,
                    },
                  ]}
                  onPress={() => handleRegionSelect(regionId)}
                >
                  <View style={[styles.dot, { backgroundColor: categoryColor }]} />
                  <Text style={styles.dotLabel} numberOfLines={1}>
                    {displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.mapInstructions}>
          <Text style={styles.instructionsText}>Tap a dot to select that domain</Text>
        </View>
      </View>
    );
  };

  // Main menu view - direct access
  const renderMenuView = () => {
    const regionalCount = getRegionsByCategory('regional').length;
    const localCount = getRegionsByCategory('local').length;

    return (
      <View style={styles.menuContainer}>
        {/* Full Disk */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleRegionSelect('full_disk')}
        >
          <Ionicons name="globe" size={32} color="#4CAF50" />
          <Text style={styles.menuCardTitle}>Full Disk</Text>
          <Text style={styles.menuCardSubtitle}>Entire hemisphere view</Text>
        </TouchableOpacity>

        {/* CONUS */}
        <TouchableOpacity style={styles.menuCard} onPress={() => handleRegionSelect('conus')}>
          <Ionicons name="location" size={32} color="#FF9800" />
          <Text style={styles.menuCardTitle}>CONUS</Text>
          <Text style={styles.menuCardSubtitle}>Continental United States</Text>
        </TouchableOpacity>

        {/* Regional - Direct to map */}
        <TouchableOpacity style={styles.menuCard} onPress={() => setViewMode('regional')}>
          <Ionicons name="map" size={32} color="#2196F3" />
          <Text style={styles.menuCardTitle}>Regional</Text>
          <Text style={styles.menuCardSubtitle}>
            Select on map ({regionalCount} regions) →
          </Text>
        </TouchableOpacity>

        {/* Local - Direct to map */}
        <TouchableOpacity style={styles.menuCard} onPress={() => setViewMode('local')}>
          <Ionicons name="navigate" size={32} color="#FF5722" />
          <Text style={styles.menuCardTitle}>Local</Text>
          <Text style={styles.menuCardSubtitle}>Select on map ({localCount} areas) →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Get title based on view mode
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
        {/* Header */}
        <View style={styles.header}>
          {viewMode !== 'menu' && (
            <TouchableOpacity
              onPress={() => setViewMode('menu')}
              style={styles.backButton}
            >
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

        {/* Content */}
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
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  menuCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  menuCardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  menuCardSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
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
  mapHeaderSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  mapWrapper: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    position: 'relative',
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
    borderWidth: 2,
    borderColor: '#4CAF50',
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
    ...StyleSheet.absoluteFillObject,
  },
  regionDot: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    zIndex: 10,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    maxWidth: 100,
    textAlign: 'center',
  },
  mapInstructions: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
  },
});
