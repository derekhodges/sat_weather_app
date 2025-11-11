import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Platform, TouchableOpacity, Text } from 'react-native';
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
    setUserLocation,
    savedHomeLocation,
    setShowFavoritesMenu,
    layoutOrientation,
    toggleOrientation,
    setActiveMenu,
  } = useApp();

  const viewRef = useRef();
  const animationIntervalRef = useRef(null);

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
    setIsDrawingMode(!isDrawingMode);
  };

  const handleSharePress = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        console.warn('Sharing not available');
        setError('Sharing is not available on this device');
        return;
      }

      // Capture the current view
      const uri = await captureRef(viewRef, {
        format: 'jpg',
        quality: 0.9,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share Satellite Image',
      });
    } catch (error) {
      console.error('Error sharing:', error);
      setError('Unable to share image');
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
          // Landscape layout: ColorBar | Image | Buttons (vertical) + bottom menu/slider row
          <>
            <View style={styles.landscapeMainRow}>
              {/* Vertical ColorBar on left */}
              <ColorScaleBar orientation="vertical" />

              {/* Image in center */}
              <View style={styles.landscapeImageArea}>
                <SatelliteImageViewer />
                {isDrawingMode && <DrawingOverlay />}
              </View>

              {/* Vertical Buttons on right */}
              <BottomControls
                onLocationPress={handleLocationPress}
                onPlayPress={toggleAnimation}
                onEditPress={handleEditPress}
                onSharePress={handleSharePress}
                onFlipOrientation={handleFlipOrientation}
                orientation={layoutOrientation}
              />
            </View>

            {/* Bottom row: Menu items + Slider */}
            <View style={styles.landscapeBottomRow}>
              {/* Menu buttons */}
              <View style={styles.landscapeMenuButtons}>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setActiveMenu('channel')}
                >
                  <Text style={styles.menuButtonText}>CHANNEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setActiveMenu('rgb')}
                >
                  <Text style={styles.menuButtonText}>RGB</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setActiveMenu('domain')}
                >
                  <Text style={styles.menuButtonText}>DOMAIN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setActiveMenu('overlays')}
                >
                  <Text style={styles.menuButtonText}>OVERLAYS</Text>
                </TouchableOpacity>
                <Text style={styles.separator}>|</Text>
              </View>
              <View style={styles.landscapeSliderContainer}>
                <TimelineSlider orientation="horizontal" />
              </View>
            </View>
          </>
        ) : (
          // Portrait layout: standard vertical stacking
          <>
            <View style={styles.content}>
              <SatelliteImageViewer />
              {isDrawingMode && <DrawingOverlay />}
            </View>

            <ColorScaleBar orientation="horizontal" />

            {/* Menu buttons row */}
            <View style={styles.portraitMenuRow}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setActiveMenu('channel')}
              >
                <Text style={styles.menuButtonText}>CHANNEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setActiveMenu('rgb')}
              >
                <Text style={styles.menuButtonText}>RGB</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setActiveMenu('domain')}
              >
                <Text style={styles.menuButtonText}>DOMAIN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setActiveMenu('overlays')}
              >
                <Text style={styles.menuButtonText}>OVERLAYS</Text>
              </TouchableOpacity>
            </View>

            <TimelineSlider orientation="horizontal" />

            <BottomControls
              onLocationPress={handleLocationPress}
              onPlayPress={toggleAnimation}
              onEditPress={handleEditPress}
              onSharePress={handleSharePress}
              onFlipOrientation={handleFlipOrientation}
              orientation={layoutOrientation}
            />
          </>
        )}

        {/* Menu selector */}
        <MenuSelector />

        {/* Domain map selector modal */}
        <DomainMapSelector />

        {/* Favorites menu */}
        <FavoritesMenu />
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
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  landscapeMainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  landscapeImageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeBottomRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    height: 60,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  landscapeMenuButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  landscapeSliderContainer: {
    flex: 1,
    marginLeft: 12,
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
});
