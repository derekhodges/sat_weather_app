import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { formatTimestamp } from '../utils/imageService';

export const ColorScaleBar = () => {
  const { selectedChannel, selectedRGBProduct, viewMode, imageTimestamp } =
    useApp();

  return (
    <View style={styles.container}>
      {/* Info row */}
      <View style={styles.infoRow}>
        <Text style={styles.channelInfo} numberOfLines={1}>
          {viewMode === 'rgb'
            ? selectedRGBProduct?.name || 'RGB Product'
            : selectedChannel
            ? `Channel ${selectedChannel.number} - ${selectedChannel.description} (${selectedChannel.wavelength})`
            : 'Select a channel or RGB product'}
        </Text>
        <Text style={styles.timestamp}>
          {formatTimestamp(imageTimestamp)}
        </Text>
      </View>

      {/* Color gradient bar */}
      <View style={styles.gradientBar}>
        {/* Simple gradient representation */}
        {[...Array(50)].map((_, i) => {
          const hue = (i / 50) * 240; // Blue to red
          return (
            <View
              key={i}
              style={[
                styles.gradientSegment,
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
});
