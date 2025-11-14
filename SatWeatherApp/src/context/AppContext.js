import React, { createContext, useContext, useState, useEffect } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { DEFAULT_SATELLITE } from '../constants/satellites';
import { DEFAULT_DOMAIN } from '../constants/domains';
import { DEFAULT_RGB_PRODUCT } from '../constants/products';
import { DEFAULT_CHANNEL } from '../constants/satellites';
import { OVERLAYS } from '../constants/overlays';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Location
  const [userLocation, setUserLocation] = useState(null);
  const [savedHomeLocation, setSavedHomeLocation] = useState(null);
  const [showLocationMarker, setShowLocationMarker] = useState(false);

  // UI state
  const [activeMenu, setActiveMenu] = useState(null); // 'channel', 'rgb', 'domain', 'overlays', 'settings'
  const [showDomainMap, setShowDomainMap] = useState(false);
  const [layoutOrientation, setLayoutOrientation] = useState('portrait'); // 'portrait' or 'landscape'

  // Favorites
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesMenu, setShowFavoritesMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings
  const [settings, setSettings] = useState({
    animationSpeed: 800, // ms per frame
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
    try {
      const savedHome = await AsyncStorage.getItem('homeLocation');
      if (savedHome) {
        setSavedHomeLocation(JSON.parse(savedHome));
      }

      const savedFavorites = await AsyncStorage.getItem('favorites');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }

      const savedSettings = await AsyncStorage.getItem('settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
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
        };
        const mergedSettings = { ...defaultSettings, ...parsed };
        setSettings(mergedSettings);
        // Save migrated settings back to storage
        await AsyncStorage.setItem('settings', JSON.stringify(mergedSettings));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      await AsyncStorage.setItem('settings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
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
    setDrawings(prev => [...prev, drawing]);
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
    userLocation,
    savedHomeLocation,
    showLocationMarker,
    activeMenu,
    showDomainMap,
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
    setUserLocation,
    saveHomeLocation,
    toggleLocationMarker,
    setActiveMenu,
    setShowDomainMap,
    setViewMode,
    setShowFavoritesMenu,
    setShowSettingsModal,
    toggleOrientation,
    addToFavorites,
    removeFavorite,
    loadFavorite,
    generateFavoriteName,
    updateSettings,
    setAsHome,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
