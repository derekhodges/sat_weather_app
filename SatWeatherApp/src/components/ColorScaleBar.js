import React, { useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { formatTimestamp } from '../utils/imageService';
import { shouldShowColorbar, mapGradientToValue, analyzePixelColor } from '../utils/colorbarUtils';

const ColorScaleBarComponent = ({ orientation = 'horizontal', matchImageHeight = false, height = null }) => {
  const { selectedChannel, selectedRGBProduct, viewMode, imageTimestamp, settings, isInspectorMode } =
    useApp();

  const isVertical = orientation === 'vertical';

  // Touch handling for colorbar sampling
  const [touchValue, setTouchValue] = useState(null);
  const gradientBarRef = useRef(null);

  // Memoize gradient segments to prevent recreation on every render
  // MUST be before any conditional returns (Rules of Hooks)
  const gradientSegments = useMemo(() => {
    return [...Array(50)].map((_, i) => {
      const hue = (i / 50) * 240; // Blue to red
      return (
        <View
          key={i}
          style={[
            isVertical ? styles.gradientSegmentVertical : styles.gradientSegment,
            { backgroundColor: `hsl(${240 - hue}, 100%, 50%)` },
          ]}
        />
      );
    });
  }, [isVertical]);

  // Check if colorbar should be displayed for current product/channel
  const showColorbar = shouldShowColorbar(viewMode, selectedChannel, selectedRGBProduct);

  // Handle touch on colorbar - only active in inspector mode
  const handleColorbarTouch = (event) => {
    if (!isInspectorMode) return;

    const { locationX, locationY } = event.nativeEvent;

    // Calculate percentage based on orientation
    gradientBarRef.current?.measure((x, y, width, height) => {
      const percentage = isVertical
        ? (locationY / height) * 100
        : (locationX / width) * 100;

      // Get the color at this position
      const hue = 240 - (percentage / 100 * 240); // Blue to red
      const r = Math.round(hslToRgb(hue / 360, 1, 0.5)[0]);
      const g = Math.round(hslToRgb(hue / 360, 1, 0.5)[1]);
      const b = Math.round(hslToRgb(hue / 360, 1, 0.5)[2]);

      // Get product for analysis
      const product = viewMode === 'channel' ? selectedChannel : selectedRGBProduct;

      // Analyze the color
      const analysis = analyzePixelColor(r, g, b, viewMode, product);

      setTouchValue({
        x: locationX,
        y: locationY,
        percentage,
        ...analysis,
      });
    });
  };

  const handleTouchEnd = () => {
    setTouchValue(null);
  };

  // HSL to RGB conversion helper
  const hslToRgb = (h, s, l) => {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r * 255, g * 255, b * 255];
  };

  // Don't render colorbar if it shouldn't be shown for this product/channel
  if (!showColorbar) {
    return null;
  }

  return (
    <View style={[
      isVertical ? styles.containerVertical : styles.container,
      height !== null && isVertical && { height }
    ]}>
      {/* Info section - only show in horizontal (portrait) mode */}
      {!isVertical && (
        <View style={styles.infoRow}>
          <Text style={styles.channelInfo} numberOfLines={1}>
            {viewMode === 'rgb'
              ? selectedRGBProduct?.name || 'RGB Product'
              : selectedChannel
              ? `Channel ${selectedChannel.number} - ${selectedChannel.description} (${selectedChannel.wavelength})`
              : 'Select a channel or RGB product'}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(imageTimestamp, settings.useLocalTime)}
          </Text>
        </View>
      )}

      {/* Color gradient bar */}
      <View
        ref={gradientBarRef}
        style={isVertical ? styles.gradientBarVertical : styles.gradientBar}
        onStartShouldSetResponder={() => isInspectorMode}
        onResponderGrant={handleColorbarTouch}
        onResponderMove={handleColorbarTouch}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
      >
        {gradientSegments}

        {/* Touch value tooltip */}
        {touchValue && (
          <View
            style={[
              styles.touchTooltip,
              isVertical
                ? { top: touchValue.y - 30, left: 25 }
                : { left: touchValue.x - 60, top: -40 }
            ]}
            pointerEvents="none"
          >
            <Text style={styles.touchTooltipText}>{touchValue.label}</Text>
            {touchValue.description && (
              <Text style={styles.touchTooltipDescription}>{touchValue.description}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

// Memoize component to prevent unnecessary rerenders
export const ColorScaleBar = React.memo(ColorScaleBarComponent);

const styles = StyleSheet.create({
  // Horizontal (portrait) styles
  container: {
    backgroundColor: '#1a1a1a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  channelInfo: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 90,
    textAlign: 'right',
  },
  gradientBar: {
    flexDirection: 'row',
    height: 24,
  },
  gradientSegment: {
    flex: 1,
  },

  // Vertical (landscape) styles - just the gradient bar
  containerVertical: {
    backgroundColor: '#1a1a1a',
    width: 20,
    flexDirection: 'column',
  },
  infoVertical: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  channelInfoVertical: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 11,
  },
  timestampVertical: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  gradientBarVertical: {
    flexDirection: 'column',
    flex: 1,
    width: '100%',
  },
  gradientSegmentVertical: {
    flex: 1,
    width: '100%',
  },

  // Touch tooltip styles
  touchTooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00ff00',
    minWidth: 120,
    maxWidth: 220,
    zIndex: 1000,
  },
  touchTooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  touchTooltipDescription: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 12,
  },
});
