import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useApp } from '../context/AppContext';

export const SatelliteImageViewer = () => {
  const { currentImageUrl, isLoading, error } = useApp();

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

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      // Limit scale
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
      }
      savedScale.value = scale.value;
    });

  // Pan gesture for panning
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Combined gesture
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Handle URL changes - load into inactive slot and swap when ready
  useEffect(() => {
    if (!currentImageUrl) return;

    // First load - initialize slot A
    if (!imageSlotA && !imageSlotB) {
      setImageSlotA(currentImageUrl);
      setActiveSlot('A');
      opacityA.value = 1;
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
    setImageALoaded(true);
    if (imageSlotA === currentImageUrl && activeSlot !== 'A') {
      // This is the new image, make it active
      setActiveSlot('A');
      opacityA.value = withTiming(1, { duration: 0 });
      opacityB.value = withTiming(0, { duration: 0 });
    }
  };

  const handleImageBLoad = () => {
    setImageBLoaded(true);
    if (imageSlotB === currentImageUrl && activeSlot !== 'B') {
      // This is the new image, make it active
      setActiveSlot('B');
      opacityB.value = withTiming(1, { duration: 0 });
      opacityA.value = withTiming(0, { duration: 0 });
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

  // Reset zoom/pan
  const resetView = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // Expose reset function (will be used by parent via ref or context)
  React.useImperativeHandle(
    useRef(),
    () => ({
      resetView,
    }),
    []
  );

  if (isLoading) {
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

  // Show loading indicator during first load (both slots empty)
  const isFirstLoad = !imageSlotA && !imageSlotB;
  const showLoadingOverlay = isLoading || isFirstLoad;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          {/* Image Slot A */}
          {imageSlotA && (
            <Animated.View style={[styles.imageWrapper, animatedStyleA]}>
              <Image
                source={{ uri: imageSlotA }}
                style={styles.image}
                resizeMode="contain"
                onLoad={handleImageALoad}
                onError={(error) => {
                  console.error('Image A load error:', error);
                }}
              />
            </Animated.View>
          )}

          {/* Image Slot B */}
          {imageSlotB && (
            <Animated.View style={[styles.imageWrapper, animatedStyleB]}>
              <Image
                source={{ uri: imageSlotB }}
                style={styles.image}
                resizeMode="contain"
                onLoad={handleImageBLoad}
                onError={(error) => {
                  console.error('Image B load error:', error);
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
  );
};

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
  image: {
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
