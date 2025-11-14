import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  Text,
  Dimensions,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useApp } from '../context/AppContext';
import { LocationMarker } from './LocationMarker';

export const SatelliteImageViewer = forwardRef((props, ref) => {
  const { forceContainMode = false } = props;
  const {
    currentImageUrl,
    isLoading,
    error,
    settings,
    hasLoadedOnce,
    setHasLoadedOnce,
  } = useApp();

  // Dual image state to prevent black flicker
  // We keep two images and swap between them
  const [imageSlotA, setImageSlotA] = useState(null);
  const [imageSlotB, setImageSlotB] = useState(null);
  const [activeSlot, setActiveSlot] = useState('A'); // 'A' or 'B'
  const [imageALoaded, setImageALoaded] = useState(false);
  const [imageBLoaded, setImageBLoaded] = useState(false);

  // Opacity for crossfade
  const opacityA = useSharedValue(1);
  const opacityB = useSharedValue(0);

  // Zoom and pan state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Get screen dimensions for bounds checking
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // For cover mode, we want the image to be larger so it can extend beyond the viewport
  // This allows panning to see all parts without cropping
  // forceContainMode overrides this for screenshots
  const effectiveDisplayMode = forceContainMode ? 'contain' : settings.imageDisplayMode;

  // Helper function to constrain translation based on current scale
  const constrainTranslation = (x, y, currentScale) => {
    'worklet';

    // For contain mode, image fits in screen, so constrain more tightly
    // For cover mode, image is 200% size, so allow more movement
    const imageSize = effectiveDisplayMode === 'cover' ? 2 : 1;

    // Calculate maximum allowed translation based on zoom level
    // When zoomed in, allow more panning. When zoomed out, constrain more.
    // The idea: don't let more than 20% of the image go off screen
    const maxOffsetX = (screenWidth * (currentScale - 1) * imageSize) / 2 + (screenWidth * 0.2);
    const maxOffsetY = (screenHeight * (currentScale - 1) * imageSize) / 2 + (screenHeight * 0.2);

    // Constrain to bounds
    const constrainedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, x));
    const constrainedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, y));

    return { x: constrainedX, y: constrainedY };
  };

  // Pinch gesture for zoom - more responsive with faster spring config
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      // Limit scale during gesture
      scale.value = Math.max(1, Math.min(5, newScale));
    })
    .onEnd(() => {
      // Limit scale and apply spring for smooth finish
      if (scale.value < 1) {
        scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      } else if (scale.value > 5) {
        scale.value = withSpring(5, { damping: 20, stiffness: 300 });
      }
      savedScale.value = scale.value;

      // After zoom, constrain translation to keep image on screen
      const constrained = constrainTranslation(translateX.value, translateY.value, scale.value);
      if (constrained.x !== translateX.value || constrained.y !== translateY.value) {
        translateX.value = withSpring(constrained.x, { damping: 20, stiffness: 300 });
        translateY.value = withSpring(constrained.y, { damping: 20, stiffness: 300 });
        savedTranslateX.value = constrained.x;
        savedTranslateY.value = constrained.y;
      }
    });

  // Pan gesture for panning - more responsive with immediate feedback
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newX = savedTranslateX.value + event.translationX;
      const newY = savedTranslateY.value + event.translationY;

      // Apply constraints during panning for immediate feedback
      const constrained = constrainTranslation(newX, newY, scale.value);
      translateX.value = constrained.x;
      translateY.value = constrained.y;
    })
    .onEnd(() => {
      // Save final constrained position
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Combined gesture for pinch and pan
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture
  );

  // Handle URL changes - load into inactive slot and swap when ready
  useEffect(() => {
    if (!currentImageUrl) return;

    // First load - initialize slot A with opacity 0
    // It will become visible when handleImageALoad fires
    if (!imageSlotA && !imageSlotB) {
      setImageSlotA(currentImageUrl);
      setActiveSlot('A');
      opacityA.value = 0; // Start invisible, will become visible when loaded
      opacityB.value = 0;
      return;
    }

    // Subsequent loads - use inactive slot
    if (activeSlot === 'A') {
      // Load into slot B
      setImageBLoaded(false);
      setImageSlotB(currentImageUrl);
    } else {
      // Load into slot A
      setImageALoaded(false);
      setImageSlotA(currentImageUrl);
    }
  }, [currentImageUrl]);

  // Handle image load callbacks
  const handleImageALoad = () => {
    if (imageSlotA === currentImageUrl) {
      setHasLoadedOnce(true); // Mark that we've loaded an image
      if (activeSlot === 'A') {
        // First load case - make visible instantly
        opacityA.value = 1;
        // CRITICAL: Wait for the opacity change to actually render on screen
        // before removing the loading overlay (prevents black flash)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setImageALoaded(true);
          });
        });
      } else {
        setImageALoaded(true);
        // CRITICAL: To prevent black flicker, we use a two-step process:
        // Step 1: Make the new image fully visible INSTANTLY (no animation)
        // Step 2: THEN fade out the old image
        // This ensures both images overlap briefly, so there's never a gap

        // Step 1: Make new image fully opaque immediately
        opacityA.value = 1;

        // Step 2: After new image is visible, fade out the old image
        requestAnimationFrame(() => {
          setActiveSlot('A');
          opacityB.value = withTiming(0, { duration: 100 });
        });
      }
    }
  };

  const handleImageBLoad = () => {
    if (imageSlotB === currentImageUrl) {
      setHasLoadedOnce(true); // Mark that we've loaded an image
      if (activeSlot === 'B') {
        // First load case (rare) - just make visible instantly
        opacityB.value = 1;
        // CRITICAL: Wait for the opacity change to actually render on screen
        // before removing the loading overlay (prevents black flash)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setImageBLoaded(true);
          });
        });
      } else {
        setImageBLoaded(true);
        // CRITICAL: To prevent black flicker, we use a two-step process:
        // Step 1: Make the new image fully visible INSTANTLY (no animation)
        // Step 2: THEN fade out the old image
        // This ensures both images overlap briefly, so there's never a gap

        // Step 1: Make new image fully opaque immediately
        opacityB.value = 1;

        // Step 2: After new image is visible, fade out the old image
        requestAnimationFrame(() => {
          setActiveSlot('B');
          opacityA.value = withTiming(0, { duration: 100 });
        });
      }
    }
  };

  // Animated styles for transform (zoom/pan)
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Animated styles for opacity (crossfade)
  const animatedStyleA = useAnimatedStyle(() => {
    return {
      opacity: opacityA.value,
    };
  });

  const animatedStyleB = useAnimatedStyle(() => {
    return {
      opacity: opacityB.value,
    };
  });

  // Reset zoom/pan - smooth timing animation without bounce
  const resetView = () => {
    scale.value = withTiming(1, { duration: 300 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 300 });
    translateY.value = withTiming(0, { duration: 300 });
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // Reset zoom/pan instantly (for screenshots)
  const resetViewInstant = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // Expose reset functions via ref for parent component
  useImperativeHandle(ref, () => ({
    resetView,
    resetViewInstant,
  }));

  if (isLoading && !hasLoadedOnce) {
    // Only show global loading screen if we've never loaded any images
    // This prevents the loading screen from showing during orientation changes
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading satellite data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!currentImageUrl) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoText}>Select a satellite view to begin</Text>
      </View>
    );
  }

  // Show loading indicator until at least one image has actually LOADED
  // (not just assigned to a slot)
  const isFirstLoad = !hasLoadedOnce;
  const showLoadingOverlay = isFirstLoad;

  const imageWrapperStyle = effectiveDisplayMode === 'cover'
    ? [styles.imageWrapper, styles.imageWrapperCover]
    : styles.imageWrapper;

  const imageStyle = effectiveDisplayMode === 'cover'
    ? [styles.image, styles.imageCover]
    : styles.image;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          {/* Image Slot A */}
          {imageSlotA && (
            <Animated.View style={[imageWrapperStyle, animatedStyleA]}>
              <Image
                source={{ uri: imageSlotA }}
                style={imageStyle}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={handleImageALoad}
                onError={(error) => {
                  console.warn('Image A load error:', error.nativeEvent?.error || 'Unknown error');
                }}
              />
            </Animated.View>
          )}

          {/* Image Slot B */}
          {imageSlotB && (
            <Animated.View style={[imageWrapperStyle, animatedStyleB]}>
              <Image
                source={{ uri: imageSlotB }}
                style={imageStyle}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={handleImageBLoad}
                onError={(error) => {
                  console.warn('Image B load error:', error.nativeEvent?.error || 'Unknown error');
                }}
              />
            </Animated.View>
          )}

          {/* Loading overlay for first load */}
          {showLoadingOverlay && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading satellite data...</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Location marker overlay */}
      <LocationMarker />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapperCover: {
    width: '200%',
    height: '200%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageCover: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  infoText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
});
