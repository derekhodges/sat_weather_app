import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';

/**
 * GeoDataDebugInfo - Debug component to show current geospatial data status
 * Shows projection type, bounds, grid info, and whether test data is loaded
 * Enable by uncommenting in SatelliteImageViewer
 */
export const GeoDataDebugInfo = () => {
  const { currentGeoData, actualImageSize } = useApp();

  if (!currentGeoData) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>GeoData: Not loaded</Text>
      </View>
    );
  }

  const {
    bounds,
    projection,
    isFallback,
    lat_grid,
    lon_grid,
    dataValues,
    data_unit,
    metadata,
  } = currentGeoData;

  const hasLatLonGrid = !!(lat_grid && lon_grid);
  const gridSize = hasLatLonGrid
    ? `${lat_grid.length}x${lat_grid[0]?.length}`
    : 'N/A';

  const hasDataGrid = !!(dataValues && Array.isArray(dataValues) && dataValues.length > 0);
  const dataGridSize = hasDataGrid
    ? `${dataValues.length}x${dataValues[0]?.length}`
    : 'N/A';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        GeoData: {metadata?.testMode ? 'TEST MODE' : 'Server'}
      </Text>

      <Text style={styles.label}>
        Projection: <Text style={styles.value}>{projection}</Text>
      </Text>

      <Text style={styles.label}>
        Fallback: <Text style={styles.value}>{isFallback ? 'Yes' : 'No'}</Text>
      </Text>

      {bounds && (
        <Text style={styles.label}>
          Bounds: <Text style={styles.value}>
            {bounds.minLat.toFixed(2)}° to {bounds.maxLat.toFixed(2)}°N,{' '}
            {Math.abs(bounds.maxLon).toFixed(2)}° to {Math.abs(bounds.minLon).toFixed(2)}°W
          </Text>
        </Text>
      )}

      <Text style={styles.label}>
        Lat/Lon Grid: <Text style={styles.value}>
          {hasLatLonGrid ? `${gridSize}` : 'None'}
        </Text>
      </Text>

      <Text style={styles.label}>
        Data Grid: <Text style={styles.value}>
          {hasDataGrid ? `${dataGridSize} (${data_unit || 'unknown'})` : 'None'}
        </Text>
      </Text>

      {actualImageSize && (
        <Text style={styles.label}>
          Image: <Text style={styles.value}>
            {actualImageSize.width}x{actualImageSize.height}
          </Text>
        </Text>
      )}

      {metadata?.source && (
        <Text style={styles.label}>
          Source: <Text style={styles.value}>{metadata.source}</Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
    maxWidth: 280,
  },
  title: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  label: {
    color: '#888',
    fontSize: 9,
    marginBottom: 2,
  },
  value: {
    color: '#fff',
    fontWeight: '600',
  },
});
