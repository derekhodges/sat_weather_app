/**
 * Projection Utilities - Convert between geographic coordinates and pixel coordinates
 * Supports Mercator and Plate Carree (equirectangular) projections
 */

/**
 * Convert latitude/longitude to pixel coordinates
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {Object} bounds - Geographic bounds {minLat, maxLat, minLon, maxLon}
 * @param {Object} imageSize - Image dimensions {width, height}
 * @param {string} projection - Projection type ('mercator' or 'plate_carree')
 * @returns {Object} Pixel coordinates {x, y}
 */
export const latLonToPixel = (lat, lon, bounds, imageSize, projection = 'plate_carree') => {
  if (!bounds || !imageSize) {
    console.warn('latLonToPixel: Missing bounds or imageSize');
    return null;
  }

  const { minLat, maxLat, minLon, maxLon } = bounds;
  const { width, height } = imageSize;

  // Calculate x coordinate (longitude to pixel) - same for both projections
  const lonRange = maxLon - minLon;
  const x = ((lon - minLon) / lonRange) * width;

  let y;

  if (projection === 'mercator') {
    // Mercator projection - latitude is non-linear
    const latToMercatorY = (latitude) => {
      const latRad = (latitude * Math.PI) / 180;
      return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    };

    const minY = latToMercatorY(maxLat); // Top of image (higher lat = smaller Y in Mercator)
    const maxY = latToMercatorY(minLat); // Bottom of image
    const pointY = latToMercatorY(lat);

    // Normalize to pixel coordinates (top = 0, bottom = height)
    y = ((pointY - minY) / (maxY - minY)) * height;
  } else {
    // Plate Carree (equirectangular) - linear latitude mapping
    const latRange = maxLat - minLat;
    // Y increases downward, but latitude increases upward
    y = ((maxLat - lat) / latRange) * height;
  }

  return { x, y };
};

/**
 * Convert pixel coordinates to latitude/longitude
 * @param {number} x - X pixel coordinate
 * @param {number} y - Y pixel coordinate
 * @param {Object} bounds - Geographic bounds {minLat, maxLat, minLon, maxLon}
 * @param {Object} imageSize - Image dimensions {width, height}
 * @param {string} projection - Projection type ('mercator' or 'plate_carree')
 * @returns {Object} Geographic coordinates {lat, lon}
 */
export const pixelToLatLon = (x, y, bounds, imageSize, projection = 'plate_carree') => {
  if (!bounds || !imageSize) {
    console.warn('pixelToLatLon: Missing bounds or imageSize');
    return null;
  }

  const { minLat, maxLat, minLon, maxLon } = bounds;
  const { width, height } = imageSize;

  // Calculate longitude (pixel to longitude) - same for both projections
  const lonRange = maxLon - minLon;
  const lon = minLon + (x / width) * lonRange;

  let lat;

  if (projection === 'mercator') {
    // Mercator projection - inverse calculation
    const latToMercatorY = (latitude) => {
      const latRad = (latitude * Math.PI) / 180;
      return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    };

    const mercatorYToLat = (mercY) => {
      return (Math.atan(Math.sinh(mercY)) * 180) / Math.PI;
    };

    const minY = latToMercatorY(maxLat);
    const maxY = latToMercatorY(minLat);

    // Convert pixel Y to Mercator Y
    const normalizedY = y / height;
    const mercY = minY + normalizedY * (maxY - minY);

    lat = mercatorYToLat(mercY);
  } else {
    // Plate Carree (equirectangular) - linear latitude mapping
    const latRange = maxLat - minLat;
    lat = maxLat - (y / height) * latRange;
  }

  return { lat, lon };
};

/**
 * Convert an array of lat/lon coordinates to pixel coordinates
 * @param {Array} coordinates - Array of [lat, lon] pairs
 * @param {Object} bounds - Geographic bounds
 * @param {Object} imageSize - Image dimensions
 * @param {string} projection - Projection type
 * @returns {Array} Array of {x, y} objects
 */
export const coordinatesToPixels = (coordinates, bounds, imageSize, projection = 'plate_carree') => {
  if (!coordinates || !Array.isArray(coordinates)) {
    return [];
  }

  return coordinates.map(([lat, lon]) => latLonToPixel(lat, lon, bounds, imageSize, projection));
};

/**
 * Check if a lat/lon point is within the given bounds
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} bounds - Geographic bounds
 * @returns {boolean}
 */
export const isPointInBounds = (lat, lon, bounds) => {
  if (!bounds) return false;

  const { minLat, maxLat, minLon, maxLon } = bounds;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
};

/**
 * Get the appropriate sample rate for data based on zoom level and image size
 * This helps with performance when displaying large data grids
 * @param {Object} imageSize - Image dimensions {width, height}
 * @param {number} zoomLevel - Current zoom level (1.0 = normal, 2.0 = 2x zoom, etc.)
 * @param {Object} options - Additional options
 * @returns {number} Sample rate (1 = every pixel, 2 = every other pixel, etc.)
 */
export const getDataSampleRate = (imageSize, zoomLevel = 1.0, options = {}) => {
  const {
    maxPointsPerAxis = 200, // Maximum points to sample per axis
    minSampleRate = 1, // Never sample more than every pixel
    maxSampleRate = 16, // Never sample less than every 16th pixel
  } = options;

  if (!imageSize) return 4;

  const { width, height } = imageSize;
  const maxDimension = Math.max(width, height);

  // Calculate base sample rate based on image size
  let sampleRate = Math.ceil(maxDimension / maxPointsPerAxis);

  // Adjust for zoom - when zoomed in, we want more detail
  sampleRate = Math.ceil(sampleRate / zoomLevel);

  // Clamp to min/max
  sampleRate = Math.max(minSampleRate, Math.min(maxSampleRate, sampleRate));

  return sampleRate;
};

/**
 * Sample a 2D data grid at a given rate
 * @param {Array} dataGrid - 2D array of data values [row][col]
 * @param {number} sampleRate - Sample every Nth pixel
 * @returns {Array} Sampled data with indices [{row, col, value}, ...]
 */
export const sampleDataGrid = (dataGrid, sampleRate = 1) => {
  if (!dataGrid || !Array.isArray(dataGrid) || dataGrid.length === 0) {
    return [];
  }

  const sampledData = [];
  const numRows = dataGrid.length;
  const numCols = dataGrid[0].length;

  for (let row = 0; row < numRows; row += sampleRate) {
    for (let col = 0; col < numCols; col += sampleRate) {
      if (dataGrid[row] && dataGrid[row][col] !== undefined) {
        sampledData.push({
          row,
          col,
          value: dataGrid[row][col],
        });
      }
    }
  }

  return sampledData;
};

/**
 * Get data value at specific pixel coordinates from a 2D grid
 * @param {Array} dataGrid - 2D array of data values
 * @param {number} x - X pixel coordinate
 * @param {number} y - Y pixel coordinate
 * @param {Object} imageSize - Image dimensions
 * @returns {number|null} Data value at that point
 */
export const getDataAtPixel = (dataGrid, x, y, imageSize) => {
  if (!dataGrid || !imageSize) return null;

  const { width, height } = imageSize;
  const numRows = dataGrid.length;
  const numCols = dataGrid[0]?.length || 0;

  // Map pixel coordinates to grid indices
  const col = Math.floor((x / width) * numCols);
  const row = Math.floor((y / height) * numRows);

  // Bounds check
  if (row < 0 || row >= numRows || col < 0 || col >= numCols) {
    return null;
  }

  return dataGrid[row]?.[col] ?? null;
};

/**
 * Format latitude for display
 * @param {number} lat - Latitude in degrees
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted latitude string (e.g., "35.5°N")
 */
export const formatLatitude = (lat, decimals = 2) => {
  if (lat === null || lat === undefined) return '--';
  const absLat = Math.abs(lat).toFixed(decimals);
  const direction = lat >= 0 ? 'N' : 'S';
  return `${absLat}°${direction}`;
};

/**
 * Format longitude for display
 * @param {number} lon - Longitude in degrees
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted longitude string (e.g., "97.5°W")
 */
export const formatLongitude = (lon, decimals = 2) => {
  if (lon === null || lon === undefined) return '--';
  const absLon = Math.abs(lon).toFixed(decimals);
  const direction = lon >= 0 ? 'E' : 'W';
  return `${absLon}°${direction}`;
};

/**
 * Format lat/lon pair for display
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted coordinate string
 */
export const formatCoordinates = (lat, lon, decimals = 2) => {
  return `${formatLatitude(lat, decimals)}, ${formatLongitude(lon, decimals)}`;
};
