import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { formatTimestamp } from '../utils/imageService';

export const ColorScaleBar = ({ orientation = 'horizontal' }) => {
  const { selectedChannel, selectedRGBProduct, viewMode, imageTimestamp } =
    useApp();

  const isVertical = orientation === 'vertical';

  return (
    <View style={isVertical ? styles.containerVertical : styles.container}>
      {/* Info section */}
      <View style={isVertical ? styles.infoVertical : styles.infoRow}>
        <Text
          style={isVertical ? styles.channelInfoVertical : styles.channelInfo}
          numberOfLines={isVertical ? 3 : 1}
        >
          {viewMode === 'rgb'
            ? selectedRGBProduct?.name || 'RGB Product'
            : selectedChannel
            ? `Channel ${selectedChannel.number} - ${selectedChannel.description} (${selectedChannel.wavelength})`
            : 'Select a channel or RGB product'}
        </Text>
        <Text style={isVertical ? styles.timestampVertical : styles.timestamp}>
          {formatTimestamp(imageTimestamp)}
        </Text>
      </View>

      {/* Color gradient bar */}
      <View style={isVertical ? styles.gradientBarVertical : styles.gradientBar}>
        {/* Simple gradient representation */}
        {[...Array(50)].map((_, i) => {
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
        })}
      </View>
    </View>
  );
};

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

  // Vertical (landscape) styles
  containerVertical: {
    backgroundColor: '#1a1a1a',
    width: 80,
    flexDirection: 'column',
  },
  infoVertical: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  channelInfoVertical: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  timestampVertical: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    transform: [{ rotate: '-90deg' }],
    width: 90,
  },
  gradientBarVertical: {
    flexDirection: 'column',
    flex: 1,
    width: 24,
    alignSelf: 'center',
  },
  gradientSegmentVertical: {
    flex: 1,
    width: '100%',
  },
});
