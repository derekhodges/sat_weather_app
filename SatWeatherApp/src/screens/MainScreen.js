import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
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
import {
  getLatestImageUrl,
  generateTimestampArray,
  generateCODImageUrl,
} from '../utils/imageService';

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
  } = useApp();

  const viewRef = useRef();
  const animationIntervalRef = useRef(null);

  // Load initial image
  useEffect(() => {
    loadImage();
  }, [selectedDomain, selectedRGBProduct, selectedChannel, viewMode]);

  // Generate timestamps for animation
  useEffect(() => {
    const timestamps = generateTimestampArray(20, 5); // 5-minute intervals
    setAvailableTimestamps(timestamps);
    setCurrentFrameIndex(timestamps.length - 1); // Start with latest
  }, [selectedDomain, selectedRGBProduct, viewMode]);

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

    const url = generateCODImageUrl(selectedDomain, product, timestamp);

    if (!url) {
      console.error('loadImageForTimestamp: Failed to generate URL');
      setError('Unable to generate image URL. Please select a valid product.');
      return;
    }

    setCurrentImageUrl(url);
    setImageTimestamp(timestamp);
  };

  const handleRefresh = () => {
    loadImage();
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
    // Suggest rotating the device to landscape mode
    console.log('Flip orientation: Rotate device for best viewing experience');
    // Could add a toast notification here instead
  };

  const handleFavoritesPress = () => {
    console.log('Favorites feature coming soon');
    // Could add a toast notification here instead
  };

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

        {/* Main content */}
        <View style={styles.content}>
          <SatelliteImageViewer />
          {isDrawingMode && <DrawingOverlay />}
        </View>

        {/* Color scale bar */}
        <ColorScaleBar />

        {/* Menu selector */}
        <MenuSelector />

        {/* Bottom controls */}
        <BottomControls
          onLocationPress={handleLocationPress}
          onPlayPress={toggleAnimation}
          onEditPress={handleEditPress}
          onSharePress={handleSharePress}
          onFlipOrientation={handleFlipOrientation}
        />

        {/* Timeline slider */}
        <TimelineSlider />

        {/* Domain map selector modal */}
        <DomainMapSelector />
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
