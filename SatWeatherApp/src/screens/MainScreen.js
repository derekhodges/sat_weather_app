import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, TouchableOpacity, Text, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import * as ScreenOrientation from 'expo-screen-orientation';
import { captureRef } from 'react-native-view-shot';
import { useApp } from '../context/AppContext';
import { SatelliteImageViewer } from '../components/SatelliteImageViewer';
import { TopBar } from '../components/TopBar';
import { MenuSelector } from '../components/MenuSelector';
import { BottomControls } from '../components/BottomControls';
import { TimelineSlider } from '../components/TimelineSlider';
import { ColorScaleBar } from '../components/ColorScaleBar';
import { DomainMapSelector } from '../components/DomainMapSelector';
import { DrawingOverlay } from '../components/DrawingOverlay';
import { FavoritesMenu } from '../components/FavoritesMenu';
import ShareMenu from '../components/ShareMenu';
import { SettingsModal } from '../components/SettingsModal';
import {
  captureScreenshot,
  saveScreenshotToLibrary,
  shareImage,
  createAnimatedGif,
  saveGifToLibrary,
  shareGif,
} from '../utils/shareUtils';
import {
  getLatestImageUrl,
  generateTimestampArray,
  generateCODImageUrl,
  generateValidatedTimestampArray,
  formatTimestamp,
} from '../utils/imageService';
import { frameCache } from '../utils/frameCache';

export const MainScreen = () => {
  const {
    selectedSatellite,
    selectedDomain,
    selectedRGBProduct,
    selectedChannel,
    viewMode,
    currentImageUrl,
    setCurrentImageUrl,
    imageTimestamp,
    setImageTimestamp,
    setIsLoading,
    setError,
    isAnimating,
    toggleAnimation,
    availableTimestamps,
    setAvailableTimestamps,
    currentFrameIndex,
    setCurrentFrameIndex,
    isDrawingMode,
    setIsDrawingMode,
    clearDrawings,
    setUserLocation,
    savedHomeLocation,
    setShowFavoritesMenu,
    layoutOrientation,
    toggleOrientation,
    activeMenu,
    setActiveMenu,
    settings,
    toggleLocationMarker,
    showLocationMarker,
    showSettingsModal,
    setShowSettingsModal,
  } = useApp();

  const viewRef = useRef();
  const contentRef = useRef(); // Reference to content area (for screenshots without buttons)
  const satelliteImageViewerRef = useRef(); // Reference to SatelliteImageViewer for reset function
  const animationIntervalRef = useRef(null);
  const autoRefreshIntervalRef = useRef(null);
  const [showColorPickerFromButton, setShowColorPickerFromButton] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showBrandingOverlay, setShowBrandingOverlay] = useState(false); // For "Satellite Weather" text during capture
  const [contentDimensions, setContentDimensions] = useState({ width: 0, height: 0 }); // Track actual viewport size
  const [isRotating, setIsRotating] = useState(false); // Track rotation state
  const [forceContainForCapture, setForceContainForCapture] = useState(false); // Force contain mode during screenshot
  const [actualImageHeight, setActualImageHeight] = useState(null); // Track actual rendered image height for colorbar

  const isLandscape = layoutOrientation === 'landscape';

  // Listen for orientation changes with loading overlay to prevent jarring transitions
  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const orientation = event.orientationInfo.orientation;
      const isDeviceLandscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      // Check if we need to change orientation
      const needsChange =
        (isDeviceLandscape && layoutOrientation !== 'landscape') ||
        (!isDeviceLandscape && layoutOrientation !== 'portrait');

      if (needsChange) {
        // FIRST: Show loading overlay immediately
        setIsRotating(true);

        // SECOND: Wait one frame for overlay to render, THEN change layout
        requestAnimationFrame(() => {
          toggleOrientation();

          // THIRD: Wait for layout to stabilize, then hide overlay
          setTimeout(() => {
            setIsRotating(false);
          }, 350);
        });
      }
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, [layoutOrientation, toggleOrientation]);

  // Generate validated timestamps and prefetch frames
  useEffect(() => {
    let isMounted = true;

    const loadAndCacheFrames = async () => {
      const product = viewMode === 'rgb' ? selectedRGBProduct : selectedChannel;

      if (!product) {
        console.warn('loadAndCacheFrames: No product selected');
        return;
      }

      console.log('Loading and caching frames...');
      setIsLoading(true);
      setError(null);

      try {
        // Clear old cache for this product
        frameCache.clearForProduct(selectedDomain, product);

        // Generate validated timestamps (only frames that exist)
        const validFrames = await generateValidatedTimestampArray(
          selectedDomain,
          product,
          settings.frameCount,
          5
        );

        if (!isMounted) return;

        if (validFrames.length === 0) {
          console.error('No valid frames available');
          setError('No satellite images available for this selection');
          setIsLoading(false);
          return;
        }

        // Prefetch all frames into cache
        await frameCache.prefetchFrames(
          validFrames.map(f => ({
            url: f.url,
            domain: selectedDomain,
            product: product,
            timestamp: f.timestamp,
          }))
        );

        if (!isMounted) return;

        // Update available timestamps (only the validated ones)
        const timestamps = validFrames.map(f => f.timestamp);
        setAvailableTimestamps(timestamps);
        setCurrentFrameIndex(timestamps.length - 1); // Start with latest

        console.log(`Loaded ${timestamps.length} valid frames`);

        // Load the latest frame
        if (timestamps.length > 0) {
          loadImageForTimestamp(timestamps[timestamps.length - 1]);
        }
      } catch (error) {
        console.error('Error loading and caching frames:', error);
        if (isMounted) {
          setError('Failed to load satellite frames. Please try refreshing.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAndCacheFrames();

    return () => {
      isMounted = false;
    };
  }, [selectedDomain, selectedRGBProduct, selectedChannel, viewMode]);

  // Load image for current frame
  useEffect(() => {
    if (availableTimestamps.length > 0 && currentFrameIndex >= 0) {
      const timestamp = availableTimestamps[currentFrameIndex];
      loadImageForTimestamp(timestamp);
    }
  }, [currentFrameIndex, availableTimestamps]);

  // Animation loop
  useEffect(() => {
    // Always clear any existing interval first to prevent multiple timers
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    if (isAnimating) {
      console.log(`Starting animation with speed: ${settings.animationSpeed}ms per frame`);
      animationIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => {
          if (prev >= availableTimestamps.length - 1) {
            return 0; // Loop back to start
          }
          return prev + 1;
        });
      }, settings.animationSpeed);
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [isAnimating, availableTimestamps.length, settings.animationSpeed]);

  // Auto-refresh functionality
  useEffect(() => {
    // Always clear any existing interval first
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }

    if (settings.autoRefresh) {
      // Convert minutes to milliseconds
      const intervalMs = settings.autoRefreshInterval * 60 * 1000;
      console.log(`Auto-refresh enabled: refreshing every ${settings.autoRefreshInterval} minute(s)`);

      autoRefreshIntervalRef.current = setInterval(() => {
        console.log('Auto-refresh: Loading latest image...');
        loadImage();
      }, intervalMs);
    }

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [settings.autoRefresh, settings.autoRefreshInterval]);

  const loadImage = async () => {
    // Don't try to load if we don't have a product selected in RGB mode
    if (viewMode === 'rgb' && !selectedRGBProduct) {
      console.warn('Cannot load image: No RGB product selected yet');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const product = viewMode === 'rgb' ? selectedRGBProduct : selectedChannel;

      if (!product) {
        throw new Error('No product or channel selected');
      }

      const result = await getLatestImageUrl(selectedDomain, product);

      if (result) {
        setCurrentImageUrl(result.url);
        setImageTimestamp(result.timestamp);
      } else {
        throw new Error('Unable to load satellite image. Please try refreshing.');
      }
    } catch (error) {
      console.error('Error loading image:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadImageForTimestamp = (timestamp) => {
    const product = viewMode === 'rgb' ? selectedRGBProduct : selectedChannel;

    if (!product) {
      console.warn('loadImageForTimestamp: No product selected');
      return;
    }

    // Try to get from cache first
    const cachedUrl = frameCache.get(selectedDomain, product, timestamp);

    if (cachedUrl) {
      // Use cached URL - no loading delay!
      setCurrentImageUrl(cachedUrl);
      setImageTimestamp(timestamp);
      return;
    }

    // Fallback: generate URL if not in cache (shouldn't happen during normal operation)
    console.warn('Frame not in cache, generating URL:', timestamp);
    const url = generateCODImageUrl(selectedDomain, product, timestamp);

    if (!url) {
      console.error('loadImageForTimestamp: Failed to generate URL');
      setError('Unable to generate image URL. Please select a valid product.');
      return;
    }

    setCurrentImageUrl(url);
    setImageTimestamp(timestamp);
  };

  const handleRefresh = async () => {
    // Clear cache and reload
    const product = viewMode === 'rgb' ? selectedRGBProduct : selectedChannel;
    if (product) {
      frameCache.clearForProduct(selectedDomain, product);
    }

    // Reload current image
    await loadImage();

    // Trigger frame cache reload by re-running the effect
    // This will happen automatically since selectedDomain/product dependencies will trigger it
  };

  const handleLocationPress = async () => {
    // If location is already shown, just toggle it off
    if (showLocationMarker) {
      toggleLocationMarker();
      return;
    }

    // Otherwise, get location and show marker
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('Location permission denied');
        setError('Location permission is required to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
      toggleLocationMarker(); // Show the marker

      console.log(
        'Location set:',
        `Lat: ${location.coords.latitude.toFixed(4)}, Lon: ${location.coords.longitude.toFixed(4)}`
      );
    } catch (error) {
      console.error('Error getting location:', error);
      setError('Unable to get current location');
    }
  };

  const handleEditPress = () => {
    if (isDrawingMode) {
      // When turning off drawing mode, clear all drawings
      clearDrawings();
      setIsDrawingMode(false);
    } else {
      // When turning on drawing mode
      setIsDrawingMode(true);
    }
  };

  const handleEditLongPress = () => {
    // Long press shows color picker
    setShowColorPickerFromButton(true);
  };

  const handleSharePress = () => {
    // Open the share menu instead of directly sharing
    setShowShareMenu(true);
  };

  const handleSaveScreenshot = async () => {
    try {
      // Reset zoom/pan to default view INSTANTLY (no animation)
      if (satelliteImageViewerRef.current?.resetViewInstant) {
        satelliteImageViewerRef.current.resetViewInstant();
      }

      // Reset actual image height
      setActualImageHeight(null);

      // Force image to contain mode so it fits in viewport
      setForceContainForCapture(true);

      // Show branding overlay WITHOUT triggering loading state
      setShowBrandingOverlay(true);

      // Get actual image dimensions and calculate rendered height
      if (isLandscape && currentImageUrl) {
        const Image = require('react-native').Image;
        Image.getSize(
          currentImageUrl,
          (width, height) => {
            // Calculate rendered height based on aspect ratio
            const containerHeight = Dimensions.get('window').height - 150;
            const containerWidth = Dimensions.get('window').width - 100; // approximate, accounting for UI
            const imageAspectRatio = width / height;
            const containerAspectRatio = containerWidth / containerHeight;

            let renderedHeight;
            if (imageAspectRatio > containerAspectRatio) {
              // Image is wider - height will be constrained by container height
              renderedHeight = (containerWidth / imageAspectRatio);
            } else {
              // Image is taller - width will be constrained
              renderedHeight = containerHeight;
            }

            setActualImageHeight(Math.floor(renderedHeight));
          },
          (error) => {
            console.error('Error getting image size:', error);
            // Fallback to container height if we can't get image size
            setActualImageHeight(Dimensions.get('window').height - 150);
          }
        );
      }

      // Short delay to let overlay and layout changes render and measure image height
      await new Promise(resolve => setTimeout(resolve, 200));

      // Capture the content area - should now include image + UI elements
      const uri = await captureScreenshot(contentRef);

      // Reset contain mode and image height
      setForceContainForCapture(false);
      setActualImageHeight(null);

      // NOW show loading while saving
      setIsLoading(true);
      setShowBrandingOverlay(false);

      // Save to media library
      await saveScreenshotToLibrary(uri);

      setIsLoading(false);

      Alert.alert('Success', 'Screenshot saved to your photo library!');
    } catch (error) {
      console.error('Error saving screenshot:', error);
      setShowBrandingOverlay(false);
      setForceContainForCapture(false);
      setActualImageHeight(null);
      setIsLoading(false);
      setError(error.message || 'Unable to save screenshot');
    }
  };

  const handleShareImage = async () => {
    try {
      // Reset zoom/pan
      if (satelliteImageViewerRef.current?.resetViewInstant) {
        satelliteImageViewerRef.current.resetViewInstant();
      }

      // Reset actual image height
      setActualImageHeight(null);

      // Force image to contain mode so it fits in viewport
      setForceContainForCapture(true);

      // Show branding overlay WITHOUT triggering loading state
      setShowBrandingOverlay(true);

      // Get actual image dimensions and calculate rendered height
      if (isLandscape && currentImageUrl) {
        const Image = require('react-native').Image;
        Image.getSize(
          currentImageUrl,
          (width, height) => {
            // Calculate rendered height based on aspect ratio
            const containerHeight = Dimensions.get('window').height - 150;
            const containerWidth = Dimensions.get('window').width - 100;
            const imageAspectRatio = width / height;
            const containerAspectRatio = containerWidth / containerHeight;

            let renderedHeight;
            if (imageAspectRatio > containerAspectRatio) {
              renderedHeight = (containerWidth / imageAspectRatio);
            } else {
              renderedHeight = containerHeight;
            }

            setActualImageHeight(Math.floor(renderedHeight));
          },
          (error) => {
            console.error('Error getting image size:', error);
            setActualImageHeight(Dimensions.get('window').height - 150);
          }
        );
      }

      // Delay to let the overlay and layout changes render and measure image height
      await new Promise(resolve => setTimeout(resolve, 200));

      // Capture the content area
      const uri = await captureScreenshot(contentRef);

      // Reset contain mode and image height
      setForceContainForCapture(false);
      setActualImageHeight(null);

      // NOW show loading while sharing
      setIsLoading(true);
      setShowBrandingOverlay(false);

      // Share the image
      await shareImage(uri);

      setIsLoading(false);
    } catch (error) {
      console.error('Error sharing image:', error);
      setShowBrandingOverlay(false);
      setForceContainForCapture(false);
      setActualImageHeight(null);
      setIsLoading(false);
      setError(error.message || 'Unable to share image');
    }
  };

  const handleSaveGif = async () => {
    try {
      const frameCount = Math.min(availableTimestamps.length, 10);

      Alert.alert(
        'Create GIF',
        `This will create an animated GIF with ${frameCount} frames. It will take about 10-20 seconds to process.\n\nThe animation will play while capturing frames.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create GIF',
            onPress: async () => {
              try {
                // Reset zoom/pan to default view INSTANTLY
                if (satelliteImageViewerRef.current?.resetViewInstant) {
                  satelliteImageViewerRef.current.resetViewInstant();
                }

                // Reset actual image height
                setActualImageHeight(null);

                // Force image to contain mode
                setForceContainForCapture(true);

                // Show branding overlay WITHOUT loading state during capture
                setShowBrandingOverlay(true);

                // Get actual image dimensions and calculate rendered height
                if (isLandscape && currentImageUrl) {
                  const Image = require('react-native').Image;
                  Image.getSize(
                    currentImageUrl,
                    (width, height) => {
                      const containerHeight = Dimensions.get('window').height - 150;
                      const containerWidth = Dimensions.get('window').width - 100;
                      const imageAspectRatio = width / height;
                      const containerAspectRatio = containerWidth / containerHeight;

                      let renderedHeight;
                      if (imageAspectRatio > containerAspectRatio) {
                        renderedHeight = (containerWidth / imageAspectRatio);
                      } else {
                        renderedHeight = containerHeight;
                      }

                      setActualImageHeight(Math.floor(renderedHeight));
                    },
                    (error) => {
                      console.error('Error getting image size:', error);
                      setActualImageHeight(Dimensions.get('window').height - 150);
                    }
                  );
                }

                // Reset to first frame for consistent GIF capture
                setCurrentFrameIndex(0);
                await new Promise(resolve => setTimeout(resolve, 200));

                // Start animation if not already animating
                const wasAnimating = isAnimating;
                if (!wasAnimating) {
                  toggleAnimation();
                  // Wait for animation to start and first frame to load
                  await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Create GIF with progress tracking (captures frames while animating)
                const gifUri = await createAnimatedGif(
                  contentRef,
                  frameCount,
                  settings.animationSpeed,
                  (current, total, status) => {
                    console.log(status);
                  },
                  isLandscape
                );

                // Stop animation if we started it
                if (!wasAnimating) {
                  toggleAnimation();
                }

                setShowBrandingOverlay(false);
                setForceContainForCapture(false);
                setActualImageHeight(null);

                // NOW show loading while saving to library
                setIsLoading(true);

                // Save to library
                await saveGifToLibrary(gifUri);

                setIsLoading(false);

                Alert.alert(
                  'Success!',
                  'GIF saved to your photo library!'
                );
              } catch (error) {
                console.error('Error creating GIF:', error);
                setShowBrandingOverlay(false);
                setForceContainForCapture(false);
                setActualImageHeight(null);
                setIsLoading(false);
                setError(error.message || 'Unable to create GIF');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error preparing GIF creation:', error);
      setError(error.message);
    }
  };

  const handleShareGif = async () => {
    try {
      const frameCount = Math.min(availableTimestamps.length, 10);

      Alert.alert(
        'Create and Share GIF',
        `This will create an animated GIF with ${frameCount} frames. It will take about 10-20 seconds to process.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create GIF',
            onPress: async () => {
              try {
                // Reset zoom/pan to default view INSTANTLY
                if (satelliteImageViewerRef.current?.resetViewInstant) {
                  satelliteImageViewerRef.current.resetViewInstant();
                }

                // Reset actual image height
                setActualImageHeight(null);

                // Force image to contain mode
                setForceContainForCapture(true);

                // Show branding overlay WITHOUT loading state during capture
                setShowBrandingOverlay(true);

                // Get actual image dimensions and calculate rendered height
                if (isLandscape && currentImageUrl) {
                  const Image = require('react-native').Image;
                  Image.getSize(
                    currentImageUrl,
                    (width, height) => {
                      const containerHeight = Dimensions.get('window').height - 150;
                      const containerWidth = Dimensions.get('window').width - 100;
                      const imageAspectRatio = width / height;
                      const containerAspectRatio = containerWidth / containerHeight;

                      let renderedHeight;
                      if (imageAspectRatio > containerAspectRatio) {
                        renderedHeight = (containerWidth / imageAspectRatio);
                      } else {
                        renderedHeight = containerHeight;
                      }

                      setActualImageHeight(Math.floor(renderedHeight));
                    },
                    (error) => {
                      console.error('Error getting image size:', error);
                      setActualImageHeight(Dimensions.get('window').height - 150);
                    }
                  );
                }

                // Reset to first frame for consistent GIF capture
                setCurrentFrameIndex(0);
                await new Promise(resolve => setTimeout(resolve, 200));

                // Start animation if not already animating
                const wasAnimating = isAnimating;
                if (!wasAnimating) {
                  toggleAnimation();
                  // Wait for animation to start and first frame to load
                  await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Create GIF (captures frames while animating)
                const gifUri = await createAnimatedGif(
                  contentRef,
                  frameCount,
                  settings.animationSpeed,
                  (current, total, status) => {
                    console.log(status);
                  },
                  isLandscape
                );

                // Stop animation if we started it
                if (!wasAnimating) {
                  toggleAnimation();
                }

                setShowBrandingOverlay(false);
                setForceContainForCapture(false);
                setActualImageHeight(null);

                // NOW show loading while sharing
                setIsLoading(true);

                // Share the GIF
                await shareGif(gifUri);

                setIsLoading(false);
              } catch (error) {
                console.error('Error creating/sharing GIF:', error);
                setShowBrandingOverlay(false);
                setForceContainForCapture(false);
                setActualImageHeight(null);
                setIsLoading(false);
                setError(error.message || 'Unable to create or share GIF');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error preparing GIF share:', error);
      setError(error.message);
    }
  };

  const handleFlipOrientation = async () => {
    try {
      // Show loading overlay first
      setIsRotating(true);

      // Wait for overlay to render
      await new Promise(resolve => requestAnimationFrame(() => resolve()));

      if (layoutOrientation === 'portrait') {
        // Switch to landscape - lock to LANDSCAPE_LEFT which rotates phone counter-clockwise
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
        // Don't manually toggle - let the orientation change listener handle it
      } else {
        // Switch back to portrait
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        // Don't manually toggle - let the orientation change listener handle it
      }
    } catch (error) {
      console.error('Error changing orientation:', error);
      setError('Unable to change screen orientation');
      setIsRotating(false);
    }
  };

  const handleFavoritesPress = () => {
    setShowFavoritesMenu(true);
  };

  const handleResetView = () => {
    // Call the reset function on SatelliteImageViewer via ref
    if (satelliteImageViewerRef.current) {
      satelliteImageViewerRef.current.resetView();
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={isLandscape ? ['left', 'right', 'bottom'] : ['top', 'bottom']}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000"
        translucent={false}
      />
      <View style={styles.container} ref={viewRef}>
        {/* Top bar */}
        <TopBar
          onMenuPress={() => setShowSettingsModal(true)}
          onRefresh={handleRefresh}
          onFavoritesPress={handleFavoritesPress}
        />

        {/* Loading overlay during rotation to prevent jarring transitions */}
        {isRotating && (
          <View style={styles.rotationOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.rotationText}>Rotating...</Text>
          </View>
        )}

        <View style={{ flex: 1, opacity: isRotating ? 0 : 1 }}>
        {isLandscape ? (
          // Landscape layout: Image | Buttons (vertical) on right, with controls only as wide as image
          <View style={styles.landscapeMainContainer}>
            {/* Left column: image area with controls below - wrapped in capture ref */}
            <View style={styles.landscapeLeftColumn}>
              <View
                ref={contentRef}
                style={[
                  styles.landscapeCaptureWrapper,
                  forceContainForCapture && { flex: 0, alignSelf: 'flex-start' }
                ]}
                collapsable={false}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setContentDimensions({ width, height });
                }}
              >
                {/* Top info bar for screenshots */}
                {showBrandingOverlay && (
                  <View style={styles.topInfoBar}>
                    <Text style={styles.topInfoText}>
                      {selectedSatellite?.name || 'GOES-19'} {viewMode === 'rgb' ? selectedRGBProduct?.name : `Channel ${selectedChannel?.number}`} {selectedDomain?.name || 'Full Disk'}
                    </Text>
                  </View>
                )}

                {/* Image area with colorbar */}
                <View style={[
                  styles.landscapeImageArea,
                  forceContainForCapture && { alignItems: 'center' }
                ]}>
                  <View style={[
                    styles.landscapeContentColumn,
                    forceContainForCapture && {
                      height: Dimensions.get('window').height - 150, // account for top bar and info bars
                    }
                  ]}>
                    <View style={styles.content}>
                      <SatelliteImageViewer
                        ref={satelliteImageViewerRef}
                        forceContainMode={forceContainForCapture}
                      />
                      <DrawingOverlay
                        externalColorPicker={showColorPickerFromButton}
                        setExternalColorPicker={setShowColorPickerFromButton}
                      />
                    </View>
                  </View>

                  <ColorScaleBar
                    orientation="vertical"
                    matchImageHeight={forceContainForCapture}
                    height={forceContainForCapture && actualImageHeight ? actualImageHeight : null}
                  />
                </View>

                {/* Info bar with channel/product and timestamp */}
                <View style={styles.landscapeInfoBar}>
                  <Text style={styles.landscapeInfoText}>
                    {viewMode === 'rgb'
                      ? selectedRGBProduct?.name || 'RGB Product'
                      : selectedChannel
                      ? `Channel ${selectedChannel.number} - ${selectedChannel.description} (${selectedChannel.wavelength})`
                      : 'Select a channel or RGB product'}
                  </Text>
                  <Text style={styles.landscapeTimestamp}>
                    {formatTimestamp(imageTimestamp, settings.useLocalTime)}
                  </Text>
                </View>

                {/* Branding overlay for screenshots - shown below info bar */}
                {showBrandingOverlay && (
                  <View style={styles.brandingOverlay}>
                    <Text style={styles.brandingText}>Satellite Weather</Text>
                  </View>
                )}
              </View>

              {/* Bottom row: Menu buttons + Slider - NOT captured */}
              <View style={styles.landscapeBottomRow}>
                <TouchableOpacity
                  style={[styles.landscapeMenuButton, activeMenu === 'channel' && styles.menuButtonActive]}
                  onPress={() => setActiveMenu(activeMenu === 'channel' ? null : 'channel')}
                >
                  <Text style={styles.menuButtonText}>SELECT CHANNEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.landscapeMenuButton, activeMenu === 'rgb' && styles.menuButtonActive]}
                  onPress={() => setActiveMenu(activeMenu === 'rgb' ? null : 'rgb')}
                >
                  <Text style={styles.menuButtonText}>RGB</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.landscapeMenuButton, activeMenu === 'domain' && styles.menuButtonActive]}
                  onPress={() => setActiveMenu(activeMenu === 'domain' ? null : 'domain')}
                >
                  <Text style={styles.menuButtonText}>DOMAIN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.landscapeMenuButton, activeMenu === 'overlays' && styles.menuButtonActive]}
                  onPress={() => setActiveMenu(activeMenu === 'overlays' ? null : 'overlays')}
                >
                  <Text style={styles.menuButtonText}>OVERLAYS</Text>
                </TouchableOpacity>
                <Text style={styles.separator}>|</Text>
                <View style={styles.landscapeSliderContainer}>
                  <TimelineSlider orientation="horizontal" />
                </View>
              </View>
            </View>

            {/* Vertical Buttons on right - extends full height */}
            <BottomControls
              onLocationPress={handleLocationPress}
              onPlayPress={toggleAnimation}
              onEditPress={handleEditPress}
              onEditLongPress={handleEditLongPress}
              onSharePress={handleSharePress}
              onResetView={handleResetView}
              onFlipOrientation={handleFlipOrientation}
              orientation={layoutOrientation}
              isDrawingMode={isDrawingMode}
            />
          </View>
        ) : (
          // Portrait layout: Image → ColorBar → Menu Buttons → Slider → Icon Buttons
          <>
            {/* Content area for screenshot capture */}
            <View
              ref={contentRef}
              style={styles.captureArea}
              collapsable={false}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setContentDimensions({ width, height });
              }}
            >
              {/* Top info bar for screenshots */}
              {showBrandingOverlay && (
                <View style={styles.topInfoBar}>
                  <Text style={styles.topInfoText}>
                    {selectedSatellite?.name || 'GOES-19'} {viewMode === 'rgb' ? selectedRGBProduct?.name : `Channel ${selectedChannel?.number}`} {selectedDomain?.name || 'Full Disk'}
                  </Text>
                </View>
              )}

              <View style={styles.content}>
                <SatelliteImageViewer
                  ref={satelliteImageViewerRef}
                  forceContainMode={forceContainForCapture}
                />
                <DrawingOverlay
                  externalColorPicker={showColorPickerFromButton}
                  setExternalColorPicker={setShowColorPickerFromButton}
                />
              </View>

              <ColorScaleBar orientation="horizontal" />

              {/* Branding overlay for screenshots - positioned directly below colorbar */}
              {showBrandingOverlay && (
                <View style={styles.brandingOverlay}>
                  <Text style={styles.brandingText}>Satellite Weather</Text>
                </View>
              )}
            </View>

            {/* Menu buttons right beneath color bar */}
            <View style={styles.portraitMenuRow}>
              <TouchableOpacity
                style={[styles.portraitMenuButton, activeMenu === 'channel' && styles.menuButtonActive]}
                onPress={() => setActiveMenu(activeMenu === 'channel' ? null : 'channel')}
              >
                <Text style={styles.menuButtonText}>CHANNEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.portraitMenuButton, activeMenu === 'rgb' && styles.menuButtonActive]}
                onPress={() => setActiveMenu(activeMenu === 'rgb' ? null : 'rgb')}
              >
                <Text style={styles.menuButtonText}>RGB</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.portraitMenuButton, activeMenu === 'domain' && styles.menuButtonActive]}
                onPress={() => setActiveMenu(activeMenu === 'domain' ? null : 'domain')}
              >
                <Text style={styles.menuButtonText}>DOMAIN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.portraitMenuButton, activeMenu === 'overlays' && styles.menuButtonActive]}
                onPress={() => setActiveMenu(activeMenu === 'overlays' ? null : 'overlays')}
              >
                <Text style={styles.menuButtonText}>OVERLAYS</Text>
              </TouchableOpacity>
            </View>

            <TimelineSlider orientation="horizontal" />

            <BottomControls
              onLocationPress={handleLocationPress}
              onPlayPress={toggleAnimation}
              onEditPress={handleEditPress}
              onEditLongPress={handleEditLongPress}
              onSharePress={handleSharePress}
              onResetView={handleResetView}
              onFlipOrientation={handleFlipOrientation}
              orientation={layoutOrientation}
              isDrawingMode={isDrawingMode}
            />
          </>
        )}
        </View>

        {/* MenuSelector - shows menu buttons in portrait, panels in both modes */}
        <MenuSelector />

        {/* Domain map selector modal */}
        <DomainMapSelector />

        {/* Favorites menu */}
        <FavoritesMenu />

        {/* Share menu */}
        <ShareMenu
          visible={showShareMenu}
          onClose={() => setShowShareMenu(false)}
          isAnimating={isAnimating}
          onSaveScreenshot={handleSaveScreenshot}
          onShareImage={handleShareImage}
          onSaveGif={handleSaveGif}
          onShareGif={handleShareGif}
        />

        {/* Settings modal */}
        <SettingsModal
          visible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  portraitMenuRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  portraitMenuButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  landscapeMainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  landscapeLeftColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  landscapeCaptureWrapper: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  landscapeImageArea: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  landscapeContentColumn: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  landscapeBottomRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    height: 55,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  landscapeSliderContainer: {
    flex: 1,
  },
  landscapeMenuButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  menuButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  menuButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  separator: {
    color: '#666',
    fontSize: 14,
    marginHorizontal: 6,
  },
  captureArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  topInfoBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  topInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  brandingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  brandingText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  landscapeInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  landscapeInfoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  landscapeTimestamp: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 90,
    textAlign: 'right',
  },
  rotationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  rotationText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
});
