import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
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
import { BoundaryOverlay } from './BoundaryOverlay';
import { VectorOverlay } from './VectorOverlay';
import { GeoDataDebugInfo } from './GeoDataDebugInfo';

// Enable/disable debug info overlay - set to true for testing
const SHOW_GEODATA_DEBUG = false;

export const SatelliteImageViewer = forwardRef((props, ref) => {
  const { forceContainMode = false, onImageLoad } = props;
  const {
    currentImageUrl,
    isLoading,
    error,
    settings,
    hasLoadedOnce,
    setHasLoadedOnce,
    isImageReadyForOverlays,
    setIsImageReadyForOverlays,
    isInspectorMode,
    setCrosshairPosition,
    setImageContainerRef,
    actualImageSize,
    setCurrentImageTransform,
  } = useApp();

  // Ref for the entire container (used for tap gestures)
  const containerRef = useRef(null);

  // Ref for ONLY the image container (for pixel sampling)
  // This excludes overlays like LocationMarker and CenterCrosshairInspector
  // so we sample the actual satellite image, not the green crosshairs
  const imageOnlyRef = useRef(null);

  // Track mounted state to prevent RAF callbacks on unmounted component
  const isMountedRef = useRef(true);
  const rafIdsRef = useRef([]);

  // Cleanup RAF callbacks on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Cancel all pending RAF callbacks
      rafIdsRef.current.forEach(id => cancelAnimationFrame(id));
      rafIdsRef.current = [];
    };
  }, []);

  // Expose the image-only ref via context for pixel sampling
  useEffect(() => {
    if (setImageContainerRef) {
      setImageContainerRef(imageOnlyRef);
    }
  }, [setImageContainerRef]);

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

  // Get screen dimensions for bounds checking - update on orientation change
  const [screenDimensions, setScreenDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  });

  // Listen for dimension changes (orientation changes)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions({
        width: window.width,
        height: window.height,
      });
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const screenWidth = screenDimensions.width;
  const screenHeight = screenDimensions.height;

  // For cover mode, we want the image to be larger so it can extend beyond the viewport
  // This allows panning to see all parts without cropping
  // forceContainMode overrides this for screenshots
  const effectiveDisplayMode = useMemo(
    () => forceContainMode ? 'contain' : settings.imageDisplayMode,
    [forceContainMode, settings.imageDisplayMode]
  );

  // Helper function to constrain translation based on current scale
  const constrainTranslation = (x, y, currentScale) => {
    'worklet';

    // For contain mode, image fits in screen, so allow moderate panning to see all parts
    // For cover mode, image is 200% size (extends 50% beyond each edge), need full panning
    const imageSize = effectiveDisplayMode === 'cover' ? 2 : 1;

    // Calculate maximum allowed translation based on zoom level
    // When zoomed in, allow more panning. When zoomed out, still allow some panning.
    // For contain mode: allow panning up to 50% of screen to see edges
    // For cover mode: image extends 50% beyond each edge, so need 50% pan to see all
    const basePanAllowance = 0.5;
    const maxOffsetX = (screenWidth * (currentScale - 1) * imageSize) / 2 + (screenWidth * basePanAllowance);
    const maxOffsetY = (screenHeight * (currentScale - 1) * imageSize) / 2 + (screenHeight * basePanAllowance);

    // Constrain to bounds
    const constrainedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, x));
    const constrainedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, y));

    return { x: constrainedX, y: constrainedY };
  };

  // Update transform state in context (for coordinate calculations)
  const updateTransformState = (s, tx, ty) => {
    setCurrentImageTransform({
      scale: s,
      translateX: tx,
      translateY: ty,
    });
  };

  // Throttle transform updates during gestures (16ms = ~60fps)
  const lastUpdateTime = useRef(0);
  const throttledUpdateTransform = (s, tx, ty) => {
    const now = Date.now();
    if (now - lastUpdateTime.current > 16) {
      lastUpdateTime.current = now;
      setCurrentImageTransform({
        scale: s,
        translateX: tx,
        translateY: ty,
      });
    }
  };

  // Pinch gesture for zoom - more responsive with faster spring config
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      // Limit scale during gesture
      scale.value = Math.max(1, Math.min(5, newScale));
      // Update transform state in real-time (throttled)
      runOnJS(throttledUpdateTransform)(scale.value, translateX.value, translateY.value);
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

      // Report transform state to context for coordinate calculations
      runOnJS(updateTransformState)(scale.value, translateX.value, translateY.value);
    });

  // Pan gesture for panning - more responsive with immediate feedback
  // DISABLED when inspector mode is active to allow inspecting corners
  const panGesture = Gesture.Pan()
    .enabled(!isInspectorMode)
    .onUpdate((event) => {
      const newX = savedTranslateX.value + event.translationX;
      const newY = savedTranslateY.value + event.translationY;

      // Apply constraints during panning for immediate feedback
      const constrained = constrainTranslation(newX, newY, scale.value);
      translateX.value = constrained.x;
      translateY.value = constrained.y;
      // Update transform state in real-time (throttled)
      runOnJS(throttledUpdateTransform)(scale.value, translateX.value, translateY.value);
    })
    .onEnd(() => {
      // Save final constrained position
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      // Report transform state to context for coordinate calculations
      runOnJS(updateTransformState)(scale.value, translateX.value, translateY.value);
    });

  // Tap gesture for inspector mode - set crosshair position
  // ONLY active when inspector mode is on
  // CRITICAL: This needs to be on the outer container to get SCREEN coordinates
  const tapGesture = Gesture.Tap()
    .enabled(isInspectorMode)
    .onEnd((event) => {
      if (isInspectorMode) {
        'worklet';
        // These are screen coordinates since tap is on outer container
        const screenX = event.x;
        const screenY = event.y;

        console.log(`[TAP] Screen tap at (${screenX}, ${screenY})`);

        // Store screen coordinates for crosshair display and sampling
        runOnJS(setCrosshairPosition)({
          x: screenX,
          y: screenY,
        });
      }
    });

  // Combined gesture for pinch and pan (not tap - tap is separate)
  const zoomPanGesture = Gesture.Simultaneous(
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
  const handleImageALoad = (event) => {
    if (imageSlotA === currentImageUrl) {
      setHasLoadedOnce(true); // Mark that we've loaded an image
      // Mark image as ready for overlays to render
      if (!isImageReadyForOverlays) {
        setIsImageReadyForOverlays(true);
      }
      // Call the onImageLoad callback with image dimensions
      if (onImageLoad && event?.nativeEvent?.source) {
        onImageLoad(event);
      }
      if (activeSlot === 'A') {
        // First load case - make visible instantly
        opacityA.value = 1;
        // CRITICAL: Wait for the opacity change to actually render on screen
        // before removing the loading overlay (prevents black flash)
        const rafId1 = requestAnimationFrame(() => {
          const rafId2 = requestAnimationFrame(() => {
            if (isMountedRef.current) {
              setImageALoaded(true);
            }
          });
          rafIdsRef.current.push(rafId2);
        });
        rafIdsRef.current.push(rafId1);
      } else {
        setImageALoaded(true);
        // CRITICAL: To prevent black flicker, we use a two-step process:
        // Step 1: Make the new image fully visible INSTANTLY (no animation)
        // Step 2: THEN fade out the old image
        // This ensures both images overlap briefly, so there's never a gap

        // Step 1: Make new image fully opaque immediately
        opacityA.value = 1;

        // Step 2: After new image is visible, fade out the old image
        const rafId = requestAnimationFrame(() => {
          if (isMountedRef.current) {
            setActiveSlot('A');
            opacityB.value = withTiming(0, { duration: 100 });
          }
        });
        rafIdsRef.current.push(rafId);
      }
    }
  };

  const handleImageBLoad = (event) => {
    if (imageSlotB === currentImageUrl) {
      setHasLoadedOnce(true); // Mark that we've loaded an image
      // Mark image as ready for overlays to render
      if (!isImageReadyForOverlays) {
        setIsImageReadyForOverlays(true);
      }
      // Call the onImageLoad callback with image dimensions
      if (onImageLoad && event?.nativeEvent?.source) {
        onImageLoad(event);
      }
      if (activeSlot === 'B') {
        // First load case (rare) - just make visible instantly
        opacityB.value = 1;
        // CRITICAL: Wait for the opacity change to actually render on screen
        // before removing the loading overlay (prevents black flash)
        const rafId1 = requestAnimationFrame(() => {
          const rafId2 = requestAnimationFrame(() => {
            if (isMountedRef.current) {
              setImageBLoaded(true);
            }
          });
          rafIdsRef.current.push(rafId2);
        });
        rafIdsRef.current.push(rafId1);
      } else {
        setImageBLoaded(true);
        // CRITICAL: To prevent black flicker, we use a two-step process:
        // Step 1: Make the new image fully visible INSTANTLY (no animation)
        // Step 2: THEN fade out the old image
        // This ensures both images overlap briefly, so there's never a gap

        // Step 1: Make new image fully opaque immediately
        opacityB.value = 1;

        // Step 2: After new image is visible, fade out the old image
        const rafId = requestAnimationFrame(() => {
          if (isMountedRef.current) {
            setActiveSlot('B');
            opacityA.value = withTiming(0, { duration: 100 });
          }
        });
        rafIdsRef.current.push(rafId);
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
    // Update transform state in context
    updateTransformState(1, 0, 0);
  };

  // Reset zoom/pan instantly (for screenshots)
  const resetViewInstant = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    // Update transform state in context
    updateTransformState(1, 0, 0);
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
    <GestureDetector gesture={tapGesture}>
      <View ref={containerRef} style={styles.container} collapsable={false}>
        {/* Image-only view for pixel sampling - NO overlays inside this */}
        <View
          ref={imageOnlyRef}
          style={StyleSheet.absoluteFill}
          collapsable={false}
        >
          <GestureDetector gesture={zoomPanGesture}>
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
        </View>

        {/* Overlays rendered OUTSIDE the pixel sampling ref */}
        {/* Boundary overlay - must be rendered before location marker to stay below it */}
        <BoundaryOverlay
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          displayMode={effectiveDisplayMode}
        />

        {/* Vector overlay for polygons (SPC outlooks, warnings, etc.) */}
        <VectorOverlay
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          displayMode={effectiveDisplayMode}
          imageSize={actualImageSize}
        />

        {/* Location marker overlay */}
        <LocationMarker />

        {/* Debug info for geospatial data - shows projection, bounds, grid info */}
        {SHOW_GEODATA_DEBUG && <GeoDataDebugInfo />}
      </View>
    </GestureDetector>
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
