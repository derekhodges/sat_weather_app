/**
 * Test utility for geospatial data integration
 *
 * This helper provides sample geospatial data for testing the coordinate
 * display and data value interrogation features without needing server-side files.
 */

// Sample CONUS geodata for testing (plate_carree projection)
// Based on actual COD CONUS domain bounds
export const SAMPLE_CONUS_GEODATA = {
  bounds: {
    minLat: 24.0,
    maxLat: 50.0,
    minLon: -126.0,
    maxLon: -66.0,
  },
  projection: 'plate_carree',
  resolution: {
    width: 2500,  // Typical COD CONUS width
    height: 1500, // Typical COD CONUS height
  },
  dataValues: null, // No data grid for RGB products
  data_unit: '',
  data_name: '',
  polygons: [
    // Sample SPC-style outlook polygon over Oklahoma/Kansas
    {
      type: 'SLGT',
      coordinates: [
        [35.5, -99.0],
        [36.5, -98.0],
        [37.5, -96.5],
        [38.0, -95.0],
        [37.5, -94.0],
        [36.0, -94.5],
        [35.0, -96.0],
        [35.5, -99.0],
      ],
      properties: {
        name: 'Slight Risk',
        valid_time: 'Test',
      },
    },
  ],
  timestamp: null,
  isFallback: false,
  metadata: {
    source: 'test',
    product: 'Geocolor',
  },
};

// Sample Oklahoma geodata for testing
export const SAMPLE_OKLAHOMA_GEODATA = {
  bounds: {
    minLat: 33.5,
    maxLat: 37.0,
    minLon: -103.0,
    maxLon: -94.5,
  },
  projection: 'plate_carree',
  resolution: {
    width: 1600,  // Typical local domain width
    height: 900,  // Typical local domain height
  },
  // Sample brightness temperature data (10x16 grid, reduced for testing)
  dataValues: [
    [285.5, 286.2, 287.0, 288.1, 289.0, 290.2, 291.0, 292.5, 293.2, 294.0, 295.1, 296.0, 297.3, 298.0, 299.2, 300.0],
    [284.8, 285.5, 286.8, 287.5, 288.8, 289.5, 290.8, 291.5, 292.8, 293.5, 294.8, 295.5, 296.8, 297.5, 298.8, 299.5],
    [283.2, 284.5, 285.8, 286.5, 287.8, 288.5, 289.8, 290.5, 291.8, 292.5, 293.8, 294.5, 295.8, 296.5, 297.8, 298.5],
    [282.0, 283.2, 284.5, 285.8, 286.5, 287.8, 288.5, 289.8, 290.5, 291.8, 292.5, 293.8, 294.5, 295.8, 296.5, 297.8],
    [281.5, 282.8, 283.5, 284.8, 285.5, 286.8, 287.5, 288.8, 289.5, 290.8, 291.5, 292.8, 293.5, 294.8, 295.5, 296.8],
    [280.8, 281.5, 282.8, 283.5, 284.8, 285.5, 286.8, 287.5, 288.8, 289.5, 290.8, 291.5, 292.8, 293.5, 294.8, 295.5],
    [280.0, 280.8, 281.5, 282.8, 283.5, 284.8, 285.5, 286.8, 287.5, 288.8, 289.5, 290.8, 291.5, 292.8, 293.5, 294.8],
    [279.2, 280.0, 280.8, 281.5, 282.8, 283.5, 284.8, 285.5, 286.8, 287.5, 288.8, 289.5, 290.8, 291.5, 292.8, 293.5],
    [278.5, 279.2, 280.0, 280.8, 281.5, 282.8, 283.5, 284.8, 285.5, 286.8, 287.5, 288.8, 289.5, 290.8, 291.5, 292.8],
    [277.8, 278.5, 279.2, 280.0, 280.8, 281.5, 282.8, 283.5, 284.8, 285.5, 286.8, 287.5, 288.8, 289.5, 290.8, 291.5],
  ],
  data_unit: 'K',
  data_name: 'Brightness Temp',
  polygons: [],
  timestamp: null,
  isFallback: false,
  metadata: {
    source: 'test',
    product: 'Channel 13',
    channel: 13,
  },
};

// Sample Texas geodata
export const SAMPLE_TEXAS_GEODATA = {
  bounds: {
    minLat: 26.0,
    maxLat: 36.5,
    minLon: -106.5,
    maxLon: -93.5,
  },
  projection: 'plate_carree',
  resolution: {
    width: 1600,
    height: 1000,
  },
  dataValues: null,
  data_unit: '',
  data_name: '',
  polygons: [],
  timestamp: null,
  isFallback: false,
  metadata: {
    source: 'test',
    product: 'Geocolor',
  },
};

/**
 * Get sample geodata for a domain (for testing)
 * @param {string} domainId - Domain ID (conus, oklahoma, texas, etc.)
 * @returns {Object|null} Sample geodata
 */
export const getSampleGeodata = (domainId) => {
  const samples = {
    conus: SAMPLE_CONUS_GEODATA,
    oklahoma: SAMPLE_OKLAHOMA_GEODATA,
    texas: SAMPLE_TEXAS_GEODATA,
  };

  return samples[domainId] || null;
};

/**
 * Check if geodata is available and valid
 * @param {Object} geoData - Geospatial data object
 * @returns {Object} Status info
 */
export const getGeoDataStatus = (geoData) => {
  if (!geoData) {
    return {
      hasData: false,
      hasBounds: false,
      hasDataGrid: false,
      hasPolygons: false,
      projection: 'none',
      isFallback: true,
    };
  }

  return {
    hasData: true,
    hasBounds: !!geoData.bounds,
    hasDataGrid: !!(geoData.dataValues && Array.isArray(geoData.dataValues) && geoData.dataValues.length > 0),
    hasPolygons: !!(geoData.polygons && geoData.polygons.length > 0),
    projection: geoData.projection || 'plate_carree',
    isFallback: geoData.isFallback || false,
    gridSize: geoData.dataValues ? `${geoData.dataValues.length}x${geoData.dataValues[0]?.length || 0}` : 'none',
    polygonCount: geoData.polygons?.length || 0,
  };
};
