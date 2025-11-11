import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
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
  } = useApp();

  const viewRef = useRef();
  const animationIntervalRef = useRef(null);

  // Get screen dimensions for rotation
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

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

  const handleFlipOrientation = () => {
    toggleOrientation();
  };

  const handleFavoritesPress = () => {
    setShowFavoritesMenu(true);
  };

  const isLandscape = layoutOrientation === 'landscape';

  // Calculate rotation transform for landscape mode
  const getContainerStyle = () => {
    if (!isLandscape) {
      return styles.container;
    }

    // When rotated 90 degrees counter-clockwise (to the left), we need to:
    // 1. Rotate the container -90deg
    // 2. Translate it to the correct position
    // 3. Swap width/height so it fits the rotated space
    const translateX = (screenWidth - screenHeight) / 2;
    const translateY = (screenHeight - screenWidth) / 2;

    return [
      styles.container,
      {
        transform: [
          { translateX },
          { translateY },
          { rotate: '-90deg' },
        ],
        width: screenHeight,
        height: screenWidth,
      },
    ];
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000"
        translucent={false}
      />
      <View style={getContainerStyle()} ref={viewRef}>
        {/* Top bar (appears on left in landscape) */}
        <TopBar
          onMenuPress={() => {}}
          onRefresh={handleRefresh}
          onFavoritesPress={handleFavoritesPress}
        />

        {/* Main content area */}
        <View style={styles.content}>
          {/* Image viewer */}
          <SatelliteImageViewer />
          {isDrawingMode && <DrawingOverlay />}
        </View>

        {/* Color scale bar (appears below image in portrait, on bottom/right side in landscape) */}
        <ColorScaleBar orientation="horizontal" />

        {/* Menu selector */}
        <MenuSelector />

        {/* Bottom controls (appears at bottom in portrait, right side in landscape) */}
        <BottomControls
          onLocationPress={handleLocationPress}
          onPlayPress={toggleAnimation}
          onEditPress={handleEditPress}
          onSharePress={handleSharePress}
          onFlipOrientation={handleFlipOrientation}
          orientation={layoutOrientation}
        />

        {/* Timeline slider */}
        <TimelineSlider orientation={layoutOrientation} />

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
});
