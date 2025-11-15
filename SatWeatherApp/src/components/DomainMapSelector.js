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
const MAP_ASPECT_RATIO = 1.6; // Approximate aspect ratio for satellite images

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

  const [viewMode, setViewMode] = useState('menu'); // 'menu', 'map_conus', 'map_fulldisk'
  const [baseMapUrl, setBaseMapUrl] = useState(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [selectedCategory, setSelectedCategory] = useState(null); // For filtering within map view
  const mapContainerRef = useRef(null);

  // Determine satellite view type based on satellite and current view
  const getSatelliteFilterType = (viewType) => {
    return getSatelliteViewType(selectedSatellite, viewType);
  };

  // Get regions for the current view
  const getAvailableRegions = (viewType) => {
    const filterType = getSatelliteFilterType(viewType);
    const regionIds = REGION_FILTERS[filterType] || [];
    return regionIds;
  };

  // Load the base map image
  const loadBaseMap = async (viewType) => {
    setIsLoadingMap(true);
    try {
      const result = await getBaseMapImage(viewType, selectedProduct);
      if (result) {
        setBaseMapUrl(result.url);
      }
    } catch (error) {
      console.error('Failed to load base map:', error);
    } finally {
      setIsLoadingMap(false);
    }
  };

  // When view mode changes, load appropriate map
  useEffect(() => {
    if (viewMode === 'map_conus') {
      loadBaseMap('conus');
    } else if (viewMode === 'map_fulldisk') {
      loadBaseMap('full_disk');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]); // Only re-load when view mode changes

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
      setSelectedCategory(null);
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

    // Create a new domain object for this region
    const newDomain = {
      id: regionId,
      name: displayName,
      type: DOMAIN_TYPES.LOCAL, // Default to local for custom regions
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
    setSelectedCategory(null);
  };

  // Categorize regions for easier navigation
  const categorizeRegions = (regionIds) => {
    const categories = {
      states: [],
      regions: [],
      offshore: [],
      international: [],
      other: [],
    };

    regionIds.forEach((id) => {
      // States and small areas
      if (
        [
          'washington',
          'oregon',
          'nor_cal',
          'so_cal',
          'nevada',
          'arizona',
          'utah',
          'idaho',
          'wyoming',
          'colorado',
          'oklahoma',
          'kansas',
          'nebraska',
          'minnesota',
          'iowa',
          'missouri',
          'arkansas',
          'wisconsin',
          'illinois',
          'michigan',
          'indiana',
          'tennessee',
          'mississippi',
          'pennsylvania',
          'north_dakota',
          'south_dakota',
          'cal_oregon',
          'north_baja',
          'north_idaho',
          'east_montana',
          'north_new_mexico',
          'south_new_mexico',
          'west_texas',
          'south_texas',
          'east_texas',
          'gulf_coast',
          'south_alabama',
          'north_florida',
          'south_florida',
          'ohio_valley',
          'southern_appalachia',
          'east_great_lakes',
          'i95_corridor',
          'east_carolina',
          'north_new_england',
          'south_new_england',
        ].includes(id)
      ) {
        categories.states.push(id);
      }
      // Larger regional areas
      else if (
        [
          'conus',
          'conus_west',
          'northwest',
          'northeast',
          'southwest',
          'southeast',
          'north_central',
          'south_central',
          'east_central',
          'north_rockies',
          'great_lakes',
          'southern_rockies',
        ].includes(id)
      ) {
        categories.regions.push(id);
      }
      // Offshore and marine
      else if (
        [
          'northwest_offshore',
          'cal_offshore',
          'baja_offshore',
          'gulf_america',
          'se_coast',
          'east_coast',
          'east_pacific',
          'atlantic',
          'gulf_of_alaska',
          'ec_pacific',
        ].includes(id)
      ) {
        categories.offshore.push(id);
      }
      // International/Caribbean
      else if (
        [
          'puerto_rico',
          'bermuda',
          'jamaica',
          'bahamas',
          'cancun',
          'carribean',
          'carribean_north',
          'windward_islands',
          'cape_verde',
          'cape_verde_zoomed',
          'windward_east',
          'mexico_north',
          'baja_south',
          'south_america',
          'andian_states',
          'brazil',
          'chili_argentina',
          'british_columbia',
          'alberta_saskatchewan',
          'manitoba_ontario',
          'quebec',
          'newfound_labrador',
          'nova_scotia',
          'alaska',
          'se_alaska',
          'central_alaska',
          'fairbanks',
          'hawaii',
          'hawaii_zoom',
        ].includes(id)
      ) {
        categories.international.push(id);
      }
      // Hemisphere views
      else if (
        [
          'north_hemisphere_w',
          'north_hemisphere_e',
          'south_hemisphere_w',
          'south_hemisphere_e',
          'se_pacific_large',
        ].includes(id)
      ) {
        categories.other.push(id);
      } else {
        categories.other.push(id);
      }
    });

    return categories;
  };

  // Calculate map container dimensions
  const onMapContainerLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setMapDimensions({ width, height });
  };

  // Render category filter buttons
  const renderCategoryFilters = (viewType) => {
    const regionIds = getAvailableRegions(viewType);
    const categories = categorizeRegions(regionIds);

    const availableCategories = Object.entries(categories)
      .filter(([, ids]) => ids.length > 0)
      .map(([name]) => name);

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          style={[styles.categoryButton, selectedCategory === null && styles.categoryButtonActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.categoryButtonText,
              selectedCategory === null && styles.categoryButtonTextActive,
            ]}
          >
            All ({regionIds.length})
          </Text>
        </TouchableOpacity>
        {availableCategories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategory === category && styles.categoryButtonTextActive,
              ]}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)} ({categories[category].length})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render map with region dots
  const renderMapView = (viewType) => {
    const filterType = getSatelliteFilterType(viewType);
    const regionIds = getAvailableRegions(viewType);
    // Use the base map bounds for the actual displayed image
    // The filter type determines which regions to show, but the map bounds
    // should match the actual satellite image being displayed
    const mapBounds = BASE_MAP_BOUNDS[viewType] || BASE_MAP_BOUNDS[filterType] || BASE_MAP_BOUNDS.conus;

    // Filter by category if selected
    let displayRegionIds = regionIds;
    if (selectedCategory) {
      const categories = categorizeRegions(regionIds);
      displayRegionIds = categories[selectedCategory] || [];
    }

    return (
      <View style={styles.mapContainer}>
        {/* Category filters */}
        {renderCategoryFilters(viewType)}

        {/* Map background with dots */}
        <View style={styles.mapWrapper} onLayout={onMapContainerLayout} ref={mapContainerRef}>
          {isLoadingMap ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
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
              <Text style={styles.placeholderText}>
                {viewType === 'full_disk' ? 'Full Disk View' : 'CONUS View'}
              </Text>
            </View>
          )}

          {/* Region dots overlay */}
          <View style={styles.dotsOverlay}>
            {displayRegionIds.map((regionId) => {
              const position = getRegionPercentPosition(regionId, mapBounds);

              // Skip if out of bounds
              if (!position.visible) return null;

              // Skip if position is too far outside (with some padding)
              if (
                position.xPercent < -5 ||
                position.xPercent > 105 ||
                position.yPercent < -5 ||
                position.yPercent > 105
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
                  <View style={styles.dot} />
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
          <Text style={styles.instructionsText}>
            Tap a dot to select that region • {displayRegionIds.length} regions available
          </Text>
          <Text style={styles.satelliteInfo}>
            Satellite: {selectedSatellite?.name || 'GOES-19'} (
            {selectedSatellite?.location || 'East'})
          </Text>
        </View>
      </View>
    );
  };

  // Main menu view
  const renderMenuView = () => {
    return (
      <View style={styles.menuContainer}>
        {/* Full Disk */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleRegionSelect('full_disk')}
        >
          <Ionicons name="globe" size={32} color="#2196F3" />
          <Text style={styles.menuCardTitle}>Full Disk</Text>
          <Text style={styles.menuCardSubtitle}>Entire hemisphere view</Text>
        </TouchableOpacity>

        {/* CONUS - Select on Map */}
        <TouchableOpacity style={styles.menuCard} onPress={() => setViewMode('map_conus')}>
          <Ionicons name="map" size={32} color="#4CAF50" />
          <Text style={styles.menuCardTitle}>CONUS Regions</Text>
          <Text style={styles.menuCardSubtitle}>
            Select on map ({getAvailableRegions('conus').length} regions) →
          </Text>
        </TouchableOpacity>

        {/* Full Disk - Select on Map */}
        <TouchableOpacity style={styles.menuCard} onPress={() => setViewMode('map_fulldisk')}>
          <Ionicons name="earth" size={32} color="#FF9800" />
          <Text style={styles.menuCardTitle}>Full Disk Regions</Text>
          <Text style={styles.menuCardSubtitle}>
            Select on map ({getAvailableRegions('full_disk').length} regions) →
          </Text>
        </TouchableOpacity>

        {/* Quick access to common domains */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.quickAccessTitle}>Quick Access</Text>
          <View style={styles.quickAccessButtons}>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => handleRegionSelect('conus')}
            >
              <Text style={styles.quickButtonText}>CONUS</Text>
            </TouchableOpacity>
            {Object.values(DOMAINS)
              .filter((d) => d.type === DOMAIN_TYPES.LOCAL)
              .slice(0, 3)
              .map((domain) => (
                <TouchableOpacity
                  key={domain.id}
                  style={styles.quickButton}
                  onPress={() => selectDomain(domain)}
                >
                  <Text style={styles.quickButtonText}>{domain.name}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </View>
    );
  };

  // Get title based on view mode
  const getTitle = () => {
    switch (viewMode) {
      case 'map_conus':
        return 'Select CONUS Region';
      case 'map_fulldisk':
        return 'Select Full Disk Region';
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
        setSelectedCategory(null);
      }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {viewMode !== 'menu' && (
            <TouchableOpacity
              onPress={() => {
                setViewMode('menu');
                setSelectedCategory(null);
              }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setShowDomainMap(false);
              setViewMode('menu');
              setSelectedCategory(null);
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
        {viewMode === 'map_conus' && renderMapView('conus')}
        {viewMode === 'map_fulldisk' && renderMapView('full_disk')}
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
  quickAccessSection: {
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  quickAccessTitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  quickAccessButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  quickButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  categoryScroll: {
    maxHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#333',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
  },
  categoryButtonText: {
    color: '#ccc',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
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
    backgroundColor: '#FF5722',
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
  satelliteInfo: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
});
