import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_SATELLITE } from '../constants/satellites';
import { DEFAULT_DOMAIN } from '../constants/domains';
import { DEFAULT_RGB_PRODUCT } from '../constants/products';
import { DEFAULT_CHANNEL } from '../constants/satellites';
import { OVERLAYS } from '../constants/overlays';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Location
  const [userLocation, setUserLocation] = useState(null);
  const [savedHomeLocation, setSavedHomeLocation] = useState(null);

  // UI state
  const [activeMenu, setActiveMenu] = useState(null); // 'channel', 'rgb', 'domain', 'overlays'
  const [showDomainMap, setShowDomainMap] = useState(false);

  // Load saved preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedHome = await AsyncStorage.getItem('homeLocation');
      if (savedHome) {
        setSavedHomeLocation(JSON.parse(savedHome));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
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
    isAnimating,
    availableTimestamps,
    currentFrameIndex,
    overlayStates,
    isDrawingMode,
    drawingColor,
    drawings,
    userLocation,
    savedHomeLocation,
    activeMenu,
    showDomainMap,

    // Actions
    setSelectedSatellite,
    selectDomain,
    selectChannel,
    selectRGBProduct,
    setCurrentImageUrl,
    setImageTimestamp,
    setIsLoading,
    setError,
    toggleAnimation,
    setAvailableTimestamps,
    setCurrentFrameIndex,
    toggleOverlay,
    setIsDrawingMode,
    setDrawingColor,
    addDrawing,
    clearDrawings,
    setUserLocation,
    saveHomeLocation,
    setActiveMenu,
    setShowDomainMap,
    setViewMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
