import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { formatTimestamp } from '../utils/imageService';

const ColorScaleBarComponent = ({ orientation = 'horizontal', matchImageHeight = false, height = null }) => {
  const { selectedChannel, selectedRGBProduct, viewMode, imageTimestamp, settings } =
    useApp();

  const isVertical = orientation === 'vertical';

  // Memoize gradient segments to prevent recreation on every render
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
      <View style={isVertical ? styles.gradientBarVertical : styles.gradientBar}>
        {gradientSegments}
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
});
