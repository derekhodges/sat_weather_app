import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, TouchableOpacity, Text, Dimensions, Alert } from 'react-native';
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
} from '../utils/imageService';
import { frameCache } from '../utils/frameCache';

export const MainScreen = () => {
  const {
    selectedDomain,
    selectedRGBProduct,
    selectedChannel,
    viewMode,
    setCurrentImageUrl,
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
  } = useApp();

  const viewRef = useRef();
  const contentRef = useRef(); // Reference to content area (for screenshots without buttons)
  const animationIntervalRef = useRef(null);
  const [showColorPickerFromButton, setShowColorPickerFromButton] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showBrandingOverlay, setShowBrandingOverlay] = useState(false); // For "Satellite Weather" text during capture

  // Listen for orientation changes to sync layout
  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const orientation = event.orientationInfo.orientation;
      const isDeviceLandscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      // Sync layout orientation with device orientation
      if (isDeviceLandscape && layoutOrientation !== 'landscape') {
        toggleOrientation();
      } else if (!isDeviceLandscape && layoutOrientation !== 'portrait') {
        toggleOrientation();
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
          12,
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
    if (isAnimating) {
      animationIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => {
          if (prev >= availableTimestamps.length - 1) {
            return 0; // Loop back to start
          }
          return prev + 1;
        });
      }, 500); // 500ms per frame = 2 fps
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [isAnimating, availableTimestamps]);

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
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('Location permission denied');
        setError('Location permission is required to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);

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
      setIsLoading(true);
      setShowBrandingOverlay(true);

      // Delay to let the overlay render and ensure content is ready
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture the content area (excluding buttons)
      const uri = await captureScreenshot(contentRef);

      // Save to media library
      await saveScreenshotToLibrary(uri);

      setShowBrandingOverlay(false);
      setIsLoading(false);

      Alert.alert('Success', 'Screenshot saved to your photo library!');
    } catch (error) {
      console.error('Error saving screenshot:', error);
      setShowBrandingOverlay(false);
      setIsLoading(false);
      setError(error.message || 'Unable to save screenshot');
    }
  };

  const handleShareImage = async () => {
    try {
      setIsLoading(true);
      setShowBrandingOverlay(true);

      // Delay to let the overlay render and ensure content is ready
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture the content area
      const uri = await captureScreenshot(contentRef);

      setShowBrandingOverlay(false);

      // Share the image
      await shareImage(uri);

      setIsLoading(false);
    } catch (error) {
      console.error('Error sharing image:', error);
      setShowBrandingOverlay(false);
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
                setIsLoading(true);
                setShowBrandingOverlay(true);

                // Start animation if not already animating
                const wasAnimating = isAnimating;
                if (!wasAnimating) {
                  toggleAnimation();
                  // Wait for animation to start
                  await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Create GIF with progress tracking
                const gifUri = await createAnimatedGif(
                  contentRef,
                  frameCount,
                  500,
                  (current, total, status) => {
                    console.log(status);
                  }
                );

                // Stop animation if we started it
                if (!wasAnimating) {
                  toggleAnimation();
                }

                // Save to library
                await saveGifToLibrary(gifUri);

                setShowBrandingOverlay(false);
                setIsLoading(false);

                Alert.alert(
                  'Success!',
                  'GIF saved to your photo library!'
                );
              } catch (error) {
                console.error('Error creating GIF:', error);
                setShowBrandingOverlay(false);
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
                setIsLoading(true);
                setShowBrandingOverlay(true);

                // Start animation if not already animating
                const wasAnimating = isAnimating;
                if (!wasAnimating) {
                  toggleAnimation();
                  // Wait for animation to start
                  await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Create GIF
                const gifUri = await createAnimatedGif(
                  contentRef,
                  frameCount,
                  500,
                  (current, total, status) => {
                    console.log(status);
                  }
                );

                // Stop animation if we started it
                if (!wasAnimating) {
                  toggleAnimation();
                }

                setShowBrandingOverlay(false);

                // Share the GIF
                await shareGif(gifUri);

                setIsLoading(false);
              } catch (error) {
                console.error('Error creating/sharing GIF:', error);
                setShowBrandingOverlay(false);
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
      if (layoutOrientation === 'portrait') {
        // Switch to landscape - lock to LANDSCAPE_LEFT which rotates phone counter-clockwise
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
        toggleOrientation();
      } else {
        // Switch back to portrait
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        toggleOrientation();
      }
    } catch (error) {
      console.error('Error changing orientation:', error);
      setError('Unable to change screen orientation');
    }
  };

  const handleFavoritesPress = () => {
    setShowFavoritesMenu(true);
  };

  const isLandscape = layoutOrientation === 'landscape';

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={isLandscape ? ['left', 'right'] : ['top', 'bottom']}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000"
        translucent={false}
      />
      <View style={styles.container} ref={viewRef}>
        {/* Top bar */}
        <TopBar
          onMenuPress={() => {}}
          onRefresh={handleRefresh}
          onFavoritesPress={handleFavoritesPress}
        />

        {isLandscape ? (
          // Landscape layout: Image | Buttons (vertical) + bottom menu/slider row
          <>
            <View style={styles.landscapeMainRow}>
              {/* Image - takes full space with ref for capture */}
              <View ref={contentRef} style={styles.landscapeImageArea} collapsable={false}>
                <SatelliteImageViewer />
                <DrawingOverlay
                  externalColorPicker={showColorPickerFromButton}
                  setExternalColorPicker={setShowColorPickerFromButton}
                />

                {/* Branding overlay for screenshots */}
                {showBrandingOverlay && (
                  <View style={styles.brandingOverlay}>
                    <Text style={styles.brandingText}>Satellite Weather</Text>
                  </View>
                )}
              </View>

              {/* Vertical Buttons on right */}
              <BottomControls
                onLocationPress={handleLocationPress}
                onPlayPress={toggleAnimation}
                onEditPress={handleEditPress}
                onEditLongPress={handleEditLongPress}
                onSharePress={handleSharePress}
                onFlipOrientation={handleFlipOrientation}
                orientation={layoutOrientation}
                isDrawingMode={isDrawingMode}
              />
            </View>

            {/* Bottom row: Menu buttons + Slider */}
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
          </>
        ) : (
          // Portrait layout: Image → ColorBar → Menu Buttons → Slider → Icon Buttons
          <>
            {/* Content area for screenshot capture */}
            <View ref={contentRef} style={styles.captureArea} collapsable={false}>
              <View style={styles.content}>
                <SatelliteImageViewer />
                <DrawingOverlay
                  externalColorPicker={showColorPickerFromButton}
                  setExternalColorPicker={setShowColorPickerFromButton}
                />
              </View>

              <ColorScaleBar orientation="horizontal" />

              {/* Branding overlay for screenshots */}
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
                <Text style={styles.menuButtonText}>SELECT CHANNEL</Text>
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
              onFlipOrientation={handleFlipOrientation}
              orientation={layoutOrientation}
              isDrawingMode={isDrawingMode}
            />
          </>
        )}

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
  landscapeMainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  landscapeImageArea: {
    flex: 1,
    backgroundColor: '#000',
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
  brandingOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  brandingText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
});
