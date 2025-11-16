/**
 * Projection Utilities - Convert between geographic coordinates and pixel coordinates
 * Supports Mercator, Plate Carree (equirectangular), and Geostationary projections
 */

/**
 * Convert latitude/longitude to pixel coordinates
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {Object} bounds - Geographic bounds {minLat, maxLat, minLon, maxLon}
 * @param {Object} imageSize - Image dimensions {width, height}
 * @param {string} projection - Projection type ('mercator', 'plate_carree', or 'geostationary')
 * @param {Object} geoGrids - For geostationary: {lat_grid, lon_grid} 2D arrays
 * @returns {Object} Pixel coordinates {x, y}
 */
export const latLonToPixel = (lat, lon, bounds, imageSize, projection = 'plate_carree', geoGrids = null) => {
  if (!bounds || !imageSize) {
    console.warn('latLonToPixel: Missing bounds or imageSize');
    return null;
  }

  const { minLat, maxLat, minLon, maxLon } = bounds;
  const { width, height } = imageSize;

  if (projection === 'geostationary' && geoGrids) {
    // Geostationary projection - search grid for closest lat/lon match
    return latLonToPixelGeostationary(lat, lon, geoGrids, imageSize);
  }

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
 * @param {string} projection - Projection type ('mercator', 'plate_carree', or 'geostationary')
 * @param {Object} geoGrids - For geostationary: {lat_grid, lon_grid} 2D arrays
 * @returns {Object} Geographic coordinates {lat, lon}
 */
export const pixelToLatLon = (x, y, bounds, imageSize, projection = 'plate_carree', geoGrids = null) => {
  if (!bounds || !imageSize) {
    console.warn('pixelToLatLon: Missing bounds or imageSize');
    return null;
  }

  const { minLat, maxLat, minLon, maxLon } = bounds;
  const { width, height } = imageSize;

  if (projection === 'geostationary' && geoGrids) {
    // Geostationary projection - look up from grid
    return pixelToLatLonGeostationary(x, y, geoGrids, imageSize);
  }

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

/**
 * Convert pixel coordinates to lat/lon using geostationary grid lookup
 * @param {number} x - X pixel coordinate
 * @param {number} y - Y pixel coordinate
 * @param {Object} geoGrids - {lat_grid, lon_grid} 2D arrays
 * @param {Object} imageSize - Image dimensions {width, height}
 * @returns {Object} Geographic coordinates {lat, lon}
 */
export const pixelToLatLonGeostationary = (x, y, geoGrids, imageSize) => {
  if (!geoGrids || !geoGrids.lat_grid || !geoGrids.lon_grid) {
    console.warn('pixelToLatLonGeostationary: Missing lat/lon grids');
    return null;
  }

  const { lat_grid, lon_grid } = geoGrids;
  const { width, height } = imageSize;

  const gridRows = lat_grid.length;
  const gridCols = lat_grid[0]?.length || 0;

  if (gridRows === 0 || gridCols === 0) {
    return null;
  }

  // Map pixel coordinates to grid indices (with interpolation)
  const gridX = (x / width) * (gridCols - 1);
  const gridY = (y / height) * (gridRows - 1);

  // Get integer indices for bilinear interpolation
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = Math.min(x0 + 1, gridCols - 1);
  const y1 = Math.min(y0 + 1, gridRows - 1);

  // Calculate interpolation weights
  const wx = gridX - x0;
  const wy = gridY - y0;

  // Bounds check
  if (y0 < 0 || y0 >= gridRows || x0 < 0 || x0 >= gridCols) {
    return null;
  }

  // Bilinear interpolation for lat
  const lat00 = lat_grid[y0][x0];
  const lat01 = lat_grid[y0][x1];
  const lat10 = lat_grid[y1][x0];
  const lat11 = lat_grid[y1][x1];

  const lat = (1 - wx) * (1 - wy) * lat00 +
              wx * (1 - wy) * lat01 +
              (1 - wx) * wy * lat10 +
              wx * wy * lat11;

  // Bilinear interpolation for lon
  const lon00 = lon_grid[y0][x0];
  const lon01 = lon_grid[y0][x1];
  const lon10 = lon_grid[y1][x0];
  const lon11 = lon_grid[y1][x1];

  const lon = (1 - wx) * (1 - wy) * lon00 +
              wx * (1 - wy) * lon01 +
              (1 - wx) * wy * lon10 +
              wx * wy * lon11;

  return { lat, lon };
};

/**
 * Convert lat/lon to pixel coordinates using geostationary grid search
 * Uses nearest-neighbor search in the grid
 * @param {number} targetLat - Target latitude
 * @param {number} targetLon - Target longitude
 * @param {Object} geoGrids - {lat_grid, lon_grid} 2D arrays
 * @param {Object} imageSize - Image dimensions {width, height}
 * @returns {Object} Pixel coordinates {x, y}
 */
export const latLonToPixelGeostationary = (targetLat, targetLon, geoGrids, imageSize) => {
  if (!geoGrids || !geoGrids.lat_grid || !geoGrids.lon_grid) {
    console.warn('latLonToPixelGeostationary: Missing lat/lon grids');
    return null;
  }

  const { lat_grid, lon_grid } = geoGrids;
  const { width, height } = imageSize;

  const gridRows = lat_grid.length;
  const gridCols = lat_grid[0]?.length || 0;

  if (gridRows === 0 || gridCols === 0) {
    return null;
  }

  // Find the grid cell containing or closest to the target lat/lon
  // This is a simple search - could be optimized with spatial indexing
  let minDist = Infinity;
  let bestRow = 0;
  let bestCol = 0;

  // Sample every few points for speed (grid is already reduced)
  const step = 1; // Check every point since grid is already sampled

  for (let row = 0; row < gridRows; row += step) {
    for (let col = 0; col < gridCols; col += step) {
      const gridLat = lat_grid[row][col];
      const gridLon = lon_grid[row][col];

      // Calculate distance (simple Euclidean in lat/lon space)
      const dist = Math.sqrt(
        Math.pow(gridLat - targetLat, 2) +
        Math.pow(gridLon - targetLon, 2)
      );

      if (dist < minDist) {
        minDist = dist;
        bestRow = row;
        bestCol = col;
      }
    }
  }

  // Convert grid indices back to pixel coordinates
  const x = (bestCol / (gridCols - 1)) * width;
  const y = (bestRow / (gridRows - 1)) * height;

  return { x, y };
};

/**
 * Create geo grids object from geoData
 * @param {Object} geoData - Full geospatial data object
 * @returns {Object|null} Geo grids {lat_grid, lon_grid} or null
 */
export const extractGeoGrids = (geoData) => {
  if (!geoData) return null;

  if (geoData.lat_grid && geoData.lon_grid) {
    return {
      lat_grid: geoData.lat_grid,
      lon_grid: geoData.lon_grid,
    };
  }

  return null;
};
