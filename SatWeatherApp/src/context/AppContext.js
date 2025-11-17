import React, { createContext, useContext, useState, useEffect } from 'react';
import { LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import { DEFAULT_SATELLITE } from '../constants/satellites';
import { DEFAULT_DOMAIN } from '../constants/domains';
import { DEFAULT_RGB_PRODUCT } from '../constants/products';
import { DEFAULT_CHANNEL } from '../constants/satellites';
import { OVERLAYS } from '../constants/overlays';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeJSONParse, validateSettings, validateFavorite, validateArray } from '../utils/validation';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Satellite and product selection
  const [selectedSatellite, setSelectedSatellite] = useState(DEFAULT_SATELLITE);
  const [selectedDomain, setSelectedDomain] = useState(DEFAULT_DOMAIN);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedRGBProduct, setSelectedRGBProduct] = useState(DEFAULT_RGB_PRODUCT);
  const [viewMode, setViewMode] = useState('rgb'); // 'rgb' or 'channel'

  // Image state
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageTimestamp, setImageTimestamp] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false); // Track if any image has loaded
  const [isImageReadyForOverlays, setIsImageReadyForOverlays] = useState(false); // Track if current image is ready for overlays

  // Animation
  const [isAnimating, setIsAnimating] = useState(false);
  const [availableTimestamps, setAvailableTimestamps] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  // Overlays
  const [overlayStates, setOverlayStates] = useState(OVERLAYS);

  // Drawing mode
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#FF0000');
  const [drawings, setDrawings] = useState([]);

  // Inspector mode
  const [isInspectorMode, setIsInspectorMode] = useState(false);
  const [inspectorValue, setInspectorValue] = useState(null);
  const [crosshairPosition, setCrosshairPosition] = useState(null); // {x, y} coordinates for crosshair
  const [imageContainerRef, setImageContainerRef] = useState(null); // Ref to image container for pixel sampling

  // Geospatial data
  const [currentGeoData, setCurrentGeoData] = useState(null); // Current frame's geospatial metadata
  const [showVectorOverlays, setShowVectorOverlays] = useState(true); // Toggle for vector overlays (SPC outlooks, warnings)
  const [actualImageSize, setActualImageSize] = useState(null); // Actual loaded image dimensions {width, height}
  const [inspectorCoordinates, setInspectorCoordinates] = useState(null); // {lat, lon} at crosshair position
  const [inspectorDataValue, setInspectorDataValue] = useState(null); // Data value at crosshair (brightness temp, etc.)

  // Image transform state (zoom/pan) - needed for coordinate calculations
  const [currentImageTransform, setCurrentImageTransform] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Location
  const [userLocation, setUserLocation] = useState(null);
  const [savedHomeLocation, setSavedHomeLocation] = useState(null);
  const [showLocationMarker, setShowLocationMarker] = useState(false);

  // UI state
  const [activeMenu, setActiveMenu] = useState(null); // 'channel', 'rgb', 'domain', 'overlays', 'settings'
  const [showDomainMap, setShowDomainMap] = useState(false);
  const [domainMapMode, setDomainMapMode] = useState(null); // 'regional' or 'local'
  const [layoutOrientation, setLayoutOrientation] = useState('portrait'); // 'portrait' or 'landscape'

  // Favorites
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesMenu, setShowFavoritesMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Settings
  const [settings, setSettings] = useState({
    animationSpeed: 500, // ms per frame (industry standard)
    endDwellDuration: 1500, // ms to pause on last frame before looping
    frameCount: 12, // number of frames to load
    frameSkip: 0, // number of frames to skip (0-12)
    imageDisplayMode: 'contain', // 'contain' or 'cover'
    autoRefresh: false, // auto-refresh latest image
    autoRefreshInterval: 5, // minutes
    showColorScale: true, // show color scale bar
    defaultDomain: DEFAULT_DOMAIN,
    defaultViewMode: 'rgb', // 'rgb' or 'channel'
    defaultProduct: DEFAULT_RGB_PRODUCT, // can be RGB product or channel
    useLocalTime: false, // false = UTC, true = local time
    channelDisplayMode: 'list', // 'list' or 'grid'
  });

  // Load saved preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  // Load default view from settings on app startup
  useEffect(() => {
    if (settings.defaultDomain && settings.defaultProduct) {
      // Only apply defaults if we're still on the initial default values
      // This prevents overriding user changes after app startup
      const isStillOnDefaults =
        selectedDomain?.id === DEFAULT_DOMAIN?.id &&
        ((viewMode === 'rgb' && selectedRGBProduct?.id === DEFAULT_RGB_PRODUCT?.id) ||
         (viewMode === 'channel' && selectedChannel?.number === DEFAULT_CHANNEL?.number));

      if (isStillOnDefaults) {
        console.log('Loading saved default view:', settings.defaultViewMode, settings.defaultProduct?.name || settings.defaultProduct?.number);
        setSelectedDomain(settings.defaultDomain);
        setViewMode(settings.defaultViewMode);

        if (settings.defaultViewMode === 'rgb') {
          setSelectedRGBProduct(settings.defaultProduct);
        } else {
          setSelectedChannel(settings.defaultProduct);
        }
      }
    }
  }, [settings.defaultDomain, settings.defaultProduct, settings.defaultViewMode]);

  const loadPreferences = async () => {
    // Load home location
    try {
      const savedHome = await AsyncStorage.getItem('homeLocation');
      if (savedHome) {
        try {
          setSavedHomeLocation(JSON.parse(savedHome));
        } catch (parseError) {
          console.error('Error parsing saved home location:', parseError);
          // Clear corrupted data
          await AsyncStorage.removeItem('homeLocation');
        }
      }
    } catch (error) {
      console.error('Error loading home location:', error);
    }

    // Load favorites with validation
    try {
      const savedFavorites = await AsyncStorage.getItem('favorites');
      if (savedFavorites) {
        const parseResult = safeJSONParse(savedFavorites);
        if (parseResult.success && Array.isArray(parseResult.data)) {
          // Validate each favorite
          const validation = validateArray(parseResult.data, validateFavorite);
          if (validation.errors.length > 0) {
            console.warn('[VALIDATION] Some favorites invalid:', validation.errors);
          }
          // Only load valid favorites
          setFavorites(validation.validItems);
          // Save cleaned data back
          if (validation.validItems.length !== parseResult.data.length) {
            await AsyncStorage.setItem('favorites', JSON.stringify(validation.validItems));
          }
        } else {
          console.error('Error parsing saved favorites:', parseResult.error);
          await AsyncStorage.removeItem('favorites');
        }
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }

    // Load settings with validation
    try {
      const savedSettings = await AsyncStorage.getItem('settings');
      if (savedSettings) {
        const parseResult = safeJSONParse(savedSettings, validateSettings);
        if (parseResult.success || parseResult.data) {
          const parsed = parseResult.data;
          // Migrate old default (500ms) to new default (800ms)
          if (parsed.animationSpeed === 500) {
            parsed.animationSpeed = 800;
            console.log('Migrated animation speed from 500ms to 800ms');
          }
          // Merge with defaults to ensure new settings are applied
          const defaultSettings = {
            animationSpeed: 800,
            frameCount: 12,
            frameSkip: 0,
            imageDisplayMode: 'contain',
            autoRefresh: false,
            autoRefreshInterval: 5,
            showColorScale: true,
            defaultDomain: DEFAULT_DOMAIN,
            defaultViewMode: 'rgb',
            defaultProduct: DEFAULT_RGB_PRODUCT,
            useLocalTime: false,
            channelDisplayMode: 'list',
          };
          const mergedSettings = { ...defaultSettings, ...parsed };
          setSettings(mergedSettings);
          // Save migrated/validated settings back to storage
          await AsyncStorage.setItem('settings', JSON.stringify(mergedSettings));
        } else {
          console.error('Error parsing saved settings:', parseResult.error);
          await AsyncStorage.removeItem('settings');
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      await AsyncStorage.setItem('settings', JSON.stringify(updatedSettings));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      // Notify user that settings failed to save
      Alert.alert(
        'Settings Error',
        'Failed to save your settings. Your changes may not persist after closing the app. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  // Set current view as home/default
  const setAsHome = async () => {
    try {
      const newHomeSettings = {
        defaultDomain: selectedDomain,
        defaultViewMode: viewMode,
        defaultProduct: viewMode === 'rgb' ? selectedRGBProduct : selectedChannel,
      };
      await updateSettings(newHomeSettings);
      console.log('Set current view as home:', newHomeSettings);
      return true;
    } catch (error) {
      console.error('Error setting home view:', error);
      return false;
    }
  };

  const toggleLocationMarker = () => {
    setShowLocationMarker(prev => !prev);
  };

  const toggleVectorOverlays = () => {
    setShowVectorOverlays(prev => !prev);
  };

  const clearGeoData = () => {
    setCurrentGeoData(null);
    setInspectorCoordinates(null);
    setInspectorDataValue(null);
  };

  // SECURITY: Clear all user location data (for privacy/logout)
  const clearUserLocationData = async () => {
    console.log('[PRIVACY] Clearing all user location data');
    setUserLocation(null);
    setSavedHomeLocation(null);
    setShowLocationMarker(false);
    try {
      await AsyncStorage.removeItem('homeLocation');
    } catch (error) {
      console.error('Error clearing saved home location:', error);
    }
  };

  const saveHomeLocation = async (location) => {
    try {
      await AsyncStorage.setItem('homeLocation', JSON.stringify(location));
      setSavedHomeLocation(location);
    } catch (error) {
      console.error('Error saving home location:', error);
    }
  };

  const toggleOverlay = (overlayId) => {
    setOverlayStates(prev => ({
      ...prev,
      [overlayId]: {
        ...prev[overlayId],
        enabled: !prev[overlayId].enabled,
      },
    }));
  };

  const addDrawing = (drawing) => {
    // Limit drawing points to prevent memory issues (max 10,000 points per drawing)
    const MAX_POINTS_PER_DRAWING = 10000;
    const MAX_DRAWINGS = 100;

    let limitedDrawing = drawing;
    if (drawing.path && drawing.path.length > MAX_POINTS_PER_DRAWING) {
      console.warn(`[DRAWING] Truncating drawing from ${drawing.path.length} to ${MAX_POINTS_PER_DRAWING} points`);
      limitedDrawing = {
        ...drawing,
        path: drawing.path.slice(-MAX_POINTS_PER_DRAWING), // Keep most recent points
      };
    }

    setDrawings(prev => {
      const newDrawings = [...prev, limitedDrawing];
      // Remove oldest drawings if we exceed the limit
      if (newDrawings.length > MAX_DRAWINGS) {
        console.warn(`[DRAWING] Removing ${newDrawings.length - MAX_DRAWINGS} oldest drawing(s) to stay within limit`);
        return newDrawings.slice(-MAX_DRAWINGS);
      }
      return newDrawings;
    });
  };

  const clearDrawings = () => {
    setDrawings([]);
  };

  const toggleAnimation = () => {
    setIsAnimating(prev => !prev);
  };

  const selectDomain = (domain) => {
    setSelectedDomain(domain);
    setActiveMenu(null);
    setShowDomainMap(false);
    // Reset overlay readiness when domain changes - overlays will wait for image to load
    setIsImageReadyForOverlays(false);
    // Stop animation and reset to most recent frame when domain changes
    if (isAnimating) {
      setIsAnimating(false);
    }
    // setCurrentFrameIndex will be updated to latest in MainScreen's useEffect
  };

  const selectRGBProduct = (product) => {
    setSelectedRGBProduct(product);
    setViewMode('rgb');
    setActiveMenu(null);
  };

  const selectChannel = (channel) => {
    setSelectedChannel(channel);
    setViewMode('channel');
    setActiveMenu(null);
  };

  const toggleOrientation = () => {
    // Instant transition - no animation to avoid janky jumping
    setLayoutOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  // Generate display name for current view
  const generateFavoriteName = () => {
    const domainName = selectedDomain?.name || 'Unknown';
    let productName = 'Unknown';

    if (viewMode === 'rgb' && selectedRGBProduct) {
      productName = selectedRGBProduct.name;
    } else if (viewMode === 'channel' && selectedChannel) {
      productName = `Channel ${selectedChannel.number}`;
    }

    // Check if any overlays are enabled
    const enabledOverlays = Object.entries(overlayStates)
      .filter(([_, overlay]) => overlay.enabled)
      .map(([_, overlay]) => overlay.name);

    if (enabledOverlays.length > 0) {
      return `${productName} - ${domainName} (${enabledOverlays.join(', ')})`;
    }

    return `${productName} - ${domainName}`;
  };

  // Add current view to favorites
  const addToFavorites = async () => {
    try {
      // Check if we already have 10 favorites
      if (favorites.length >= 10) {
        console.warn('Maximum of 10 favorites reached');
        Alert.alert(
          'Favorites Limit Reached',
          'You can save a maximum of 10 favorites. Please remove an existing favorite before adding a new one.',
          [{ text: 'OK' }]
        );
        return false;
      }

      const newFavorite = {
        id: Date.now().toString(),
        name: generateFavoriteName(),
        domain: selectedDomain,
        product: viewMode === 'rgb' ? selectedRGBProduct : selectedChannel,
        viewMode: viewMode,
        overlays: { ...overlayStates },
      };

      const updatedFavorites = [...favorites, newFavorite];
      setFavorites(updatedFavorites);
      await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));

      console.log('Added to favorites:', newFavorite.name);
      return true;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      return false;
    }
  };

  // Remove a favorite
  const removeFavorite = async (favoriteId) => {
    try {
      const updatedFavorites = favorites.filter(fav => fav.id !== favoriteId);
      setFavorites(updatedFavorites);
      await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
      console.log('Removed favorite:', favoriteId);
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      return false;
    }
  };

  // Load a favorite
  const loadFavorite = (favorite) => {
    try {
      setSelectedDomain(favorite.domain);

      if (favorite.viewMode === 'rgb') {
        setSelectedRGBProduct(favorite.product);
        setViewMode('rgb');
      } else {
        setSelectedChannel(favorite.product);
        setViewMode('channel');
      }

      // Restore overlay states
      setOverlayStates(favorite.overlays);

      // Close menus
      setActiveMenu(null);
      setShowFavoritesMenu(false);

      console.log('Loaded favorite:', favorite.name);
    } catch (error) {
      console.error('Error loading favorite:', error);
    }
  };

  const value = {
    // State
    selectedSatellite,
    selectedDomain,
    selectedChannel,
    selectedRGBProduct,
    viewMode,
    currentImageUrl,
    imageTimestamp,
    isLoading,
    error,
    hasLoadedOnce,
    isImageReadyForOverlays,
    isAnimating,
    availableTimestamps,
    currentFrameIndex,
    overlayStates,
    isDrawingMode,
    drawingColor,
    drawings,
    isInspectorMode,
    inspectorValue,
    crosshairPosition,
    imageContainerRef,
    currentGeoData,
    showVectorOverlays,
    actualImageSize,
    inspectorCoordinates,
    inspectorDataValue,
    currentImageTransform,
    userLocation,
    savedHomeLocation,
    showLocationMarker,
    activeMenu,
    showDomainMap,
    domainMapMode,
    layoutOrientation,
    favorites,
    showFavoritesMenu,
    showSettingsModal,
    settings,

    // Actions
    setSelectedSatellite,
    selectDomain,
    selectChannel,
    selectRGBProduct,
    setCurrentImageUrl,
    setImageTimestamp,
    setIsLoading,
    setError,
    setHasLoadedOnce,
    setIsImageReadyForOverlays,
    toggleAnimation,
    setAvailableTimestamps,
    setCurrentFrameIndex,
    toggleOverlay,
    setIsDrawingMode,
    setDrawingColor,
    addDrawing,
    clearDrawings,
    setIsInspectorMode,
    setInspectorValue,
    setCrosshairPosition,
    setImageContainerRef,
    setCurrentGeoData,
    setShowVectorOverlays,
    toggleVectorOverlays,
    setActualImageSize,
    setInspectorCoordinates,
    setInspectorDataValue,
    setCurrentImageTransform,
    clearGeoData,
    setUserLocation,
    saveHomeLocation,
    toggleLocationMarker,
    setActiveMenu,
    setShowDomainMap,
    setDomainMapMode,
    setViewMode,
    setShowFavoritesMenu,
    setShowSettingsModal,
    setShowSubscriptionModal,
    showSubscriptionModal,
    toggleOrientation,
    addToFavorites,
    removeFavorite,
    loadFavorite,
    generateFavoriteName,
    updateSettings,
    setAsHome,
    clearUserLocationData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
