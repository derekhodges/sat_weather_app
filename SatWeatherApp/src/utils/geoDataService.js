/**
 * Geospatial Data Service
 * Handles loading and caching of geospatial metadata files that accompany satellite images
 *
 * Metadata files include:
 * - Geographic bounds (min/max lat/lon)
 * - Image resolution (width/height)
 * - Projection type
 * - Optional data grid (brightness temp, etc.)
 * - Optional polygon overlays (SPC outlooks, warnings, etc.)
 */

import { generateCODImageUrl } from './imageService';

// In-memory cache for geospatial data with TTL support
const geoDataCache = new Map();

// Cache entry metadata for LRU/TTL
const cacheMetadata = new Map();

// Maximum cache size (number of entries)
const MAX_CACHE_SIZE = 50;

// Cache TTL in milliseconds (30 minutes)
const CACHE_TTL_MS = 30 * 60 * 1000;

// Cleanup interval reference
let cleanupIntervalId = null;

/**
 * Start periodic cache cleanup (runs every 10 minutes)
 * Automatically removes expired entries and enforces LRU eviction
 */
export const startCacheCleanup = () => {
  if (cleanupIntervalId) return; // Already running

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    const expiredKeys = [];

    // Find expired entries
    for (const [key, metadata] of cacheMetadata.entries()) {
      if (now - metadata.timestamp > CACHE_TTL_MS) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    expiredKeys.forEach(key => {
      geoDataCache.delete(key);
      cacheMetadata.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`[GEODATA] TTL cleanup: removed ${expiredKeys.length} expired entries`);
    }

    // Also enforce size limit
    cleanupCache();
  }, 10 * 60 * 1000); // Every 10 minutes

  console.log('[GEODATA] Cache cleanup timer started');
};

/**
 * Stop periodic cache cleanup
 */
export const stopCacheCleanup = () => {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[GEODATA] Cache cleanup timer stopped');
  }
};

/**
 * Generate URL for geospatial metadata file
 * Follows same naming convention as image files but with .json extension
 * @param {Object} domain - Domain configuration
 * @param {Object} product - Product configuration
 * @param {string} timestamp - Timestamp string (YYYYMMDD.HHMMSS)
 * @returns {string} URL to metadata file
 */
export const generateGeoDataUrl = (domain, product, timestamp) => {
  // Generate the image URL first
  const imageUrl = generateCODImageUrl(domain, product, timestamp);

  if (!imageUrl) {
    console.warn('generateGeoDataUrl: Could not generate base URL');
    return null;
  }

  // Replace .jpg extension with .json
  const geoDataUrl = imageUrl.replace(/\.jpg$/, '.json');

  return geoDataUrl;
};

/**
 * Generate cache key for geospatial data
 * @param {Object} domain - Domain configuration
 * @param {Object} product - Product configuration
 * @param {string} timestamp - Timestamp string
 * @returns {string} Cache key
 */
const generateCacheKey = (domain, product, timestamp) => {
  const domainId = domain?.id || 'unknown';
  const productId = product?.id || product?.number || 'unknown';
  return `${domainId}_${productId}_${timestamp}`;
};

/**
 * Clean up cache if it exceeds maximum size
 * Uses LRU (Least Recently Used) eviction based on access time
 */
const cleanupCache = () => {
  if (geoDataCache.size > MAX_CACHE_SIZE) {
    const deleteCount = geoDataCache.size - MAX_CACHE_SIZE;

    // Sort by last access time (oldest first)
    const sortedEntries = Array.from(cacheMetadata.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    // Delete oldest entries
    for (let i = 0; i < deleteCount && i < sortedEntries.length; i++) {
      const key = sortedEntries[i][0];
      geoDataCache.delete(key);
      cacheMetadata.delete(key);
    }

    console.log(`[GEODATA] LRU cleanup: removed ${deleteCount} entries`);
  }
};

/**
 * Fetch geospatial metadata for a specific frame
 * @param {Object} domain - Domain configuration
 * @param {Object} product - Product configuration
 * @param {string} timestamp - Timestamp string
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} Geospatial data object or null if not available
 */
export const fetchGeoData = async (domain, product, timestamp, options = {}) => {
  const {
    timeout = 10000,
    useCache = true,
    fallbackToDomainBounds = true,
  } = options;

  if (!domain || !product || !timestamp) {
    console.warn('fetchGeoData: Missing required parameters');
    return null;
  }

  const cacheKey = generateCacheKey(domain, product, timestamp);

  // Check cache first
  if (useCache && geoDataCache.has(cacheKey)) {
    // Update last access time for LRU
    if (cacheMetadata.has(cacheKey)) {
      cacheMetadata.get(cacheKey).lastAccess = Date.now();
    }
    console.log('GeoData cache hit:', cacheKey);
    return geoDataCache.get(cacheKey);
  }

  const url = generateGeoDataUrl(domain, product, timestamp);

  if (!url) {
    return fallbackToDomainBounds ? createFallbackGeoData(domain) : null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`GeoData not found at ${url}, using fallback`);
      const fallbackData = fallbackToDomainBounds ? createFallbackGeoData(domain) : null;

      // Cache the fallback too to avoid repeated requests
      if (useCache && fallbackData) {
        geoDataCache.set(cacheKey, fallbackData);
        cacheMetadata.set(cacheKey, { timestamp: Date.now(), lastAccess: Date.now() });
        cleanupCache();
      }

      return fallbackData;
    }

    const geoData = await response.json();

    // Validate the structure
    const validatedData = validateGeoData(geoData, domain);

    // Cache the result
    if (useCache && validatedData) {
      geoDataCache.set(cacheKey, validatedData);
      cacheMetadata.set(cacheKey, { timestamp: Date.now(), lastAccess: Date.now() });
      cleanupCache();
    }

    console.log('GeoData loaded successfully:', cacheKey);
    return validatedData;

  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('GeoData fetch timeout:', url);
    } else {
      console.warn('GeoData fetch error:', error.message);
    }

    return fallbackToDomainBounds ? createFallbackGeoData(domain) : null;
  }
};

/**
 * Create fallback geospatial data from domain bounds
 * Used when metadata file is not available
 * @param {Object} domain - Domain configuration
 * @returns {Object|null} Fallback geospatial data
 */
export const createFallbackGeoData = (domain) => {
  if (!domain || !domain.bounds) {
    console.warn('createFallbackGeoData: Domain has no bounds');
    return null;
  }

  return {
    bounds: {
      minLat: domain.bounds.minLat,
      maxLat: domain.bounds.maxLat,
      minLon: domain.bounds.minLon,
      maxLon: domain.bounds.maxLon,
    },
    projection: 'plate_carree', // Default projection
    resolution: null, // Unknown - will be determined from actual image
    dataValues: null, // No data grid available
    polygons: [], // No overlay polygons
    timestamp: null,
    isFallback: true, // Flag to indicate this is fallback data
  };
};

/**
 * Validate and normalize geospatial data structure
 * @param {Object} geoData - Raw geospatial data from JSON
 * @param {Object} domain - Domain configuration for fallback
 * @returns {Object} Validated geospatial data
 */
const validateGeoData = (geoData, domain) => {
  const validated = {
    bounds: null,
    projection: 'plate_carree',
    resolution: null,
    dataValues: null,
    data_unit: '',
    data_name: '',
    polygons: [],
    timestamp: null,
    isFallback: false,
    lat_grid: null,
    lon_grid: null,
    metadata: {},
  };

  // Validate bounds
  if (geoData.bounds) {
    validated.bounds = {
      minLat: Number(geoData.bounds.min_lat ?? geoData.bounds.minLat),
      maxLat: Number(geoData.bounds.max_lat ?? geoData.bounds.maxLat),
      minLon: Number(geoData.bounds.min_lon ?? geoData.bounds.minLon),
      maxLon: Number(geoData.bounds.max_lon ?? geoData.bounds.maxLon),
    };
  } else if (domain?.bounds) {
    validated.bounds = { ...domain.bounds };
  }

  // Validate projection - now includes geostationary
  if (geoData.projection) {
    const proj = geoData.projection.toLowerCase();
    const validProjections = ['mercator', 'plate_carree', 'equirectangular', 'geostationary'];
    if (validProjections.includes(proj)) {
      validated.projection = proj === 'equirectangular' ? 'plate_carree' : proj;
    } else {
      validated.projection = 'plate_carree';
    }
  }

  // Validate resolution
  if (geoData.resolution) {
    validated.resolution = {
      width: Number(geoData.resolution.width),
      height: Number(geoData.resolution.height),
    };
  }

  // Validate data values (2D grid)
  if (geoData.data_values || geoData.dataValues) {
    const dataGrid = geoData.data_values || geoData.dataValues;
    if (Array.isArray(dataGrid) && Array.isArray(dataGrid[0])) {
      validated.dataValues = dataGrid;
    }
  }

  // Validate data unit and name
  validated.data_unit = geoData.data_unit || '';
  validated.data_name = geoData.data_name || '';

  // Validate lat/lon grids for geostationary projection
  if (geoData.lat_grid && Array.isArray(geoData.lat_grid) && Array.isArray(geoData.lat_grid[0])) {
    validated.lat_grid = geoData.lat_grid;
  }
  if (geoData.lon_grid && Array.isArray(geoData.lon_grid) && Array.isArray(geoData.lon_grid[0])) {
    validated.lon_grid = geoData.lon_grid;
  }

  // Validate polygons
  if (Array.isArray(geoData.polygons)) {
    validated.polygons = geoData.polygons.map(polygon => ({
      type: polygon.type || 'UNKNOWN',
      coordinates: Array.isArray(polygon.coordinates) ? polygon.coordinates : [],
      properties: polygon.properties || {},
    }));
  }

  // Timestamp
  validated.timestamp = geoData.timestamp || null;

  // Metadata
  if (geoData.metadata && typeof geoData.metadata === 'object') {
    validated.metadata = geoData.metadata;
  }

  return validated;
};

/**
 * Prefetch geospatial data for multiple frames
 * @param {Object} domain - Domain configuration
 * @param {Object} product - Product configuration
 * @param {Array} timestamps - Array of timestamp strings
 * @param {Object} options - Fetch options
 * @returns {Promise<Map>} Map of timestamp -> geoData
 */
export const prefetchGeoData = async (domain, product, timestamps, options = {}) => {
  const {
    batchSize = 3,
    timeout = 10000,
  } = options;

  const results = new Map();

  if (!timestamps || timestamps.length === 0) {
    return results;
  }

  console.log(`Prefetching geospatial data for ${timestamps.length} frames...`);

  // Process in batches to avoid overwhelming network
  for (let i = 0; i < timestamps.length; i += batchSize) {
    const batch = timestamps.slice(i, i + batchSize);

    const batchPromises = batch.map(async (timestamp) => {
      const geoData = await fetchGeoData(domain, product, timestamp, {
        timeout,
        useCache: true,
        fallbackToDomainBounds: true,
      });

      return { timestamp, geoData };
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach(({ timestamp, geoData }) => {
      results.set(timestamp, geoData);
    });
  }

  console.log(`Prefetched geospatial data: ${results.size}/${timestamps.length} frames`);

  return results;
};

/**
 * Clear the geospatial data cache
 */
export const clearGeoDataCache = () => {
  geoDataCache.clear();
  cacheMetadata.clear();
  console.log('GeoData cache cleared');
};

/**
 * Get current cache size
 * @returns {number} Number of cached entries
 */
export const getGeoDataCacheSize = () => {
  return geoDataCache.size;
};

/**
 * Get polygon risk level color
 * @param {string} riskType - Risk type (MRGL, SLGT, ENH, MDT, HIGH)
 * @returns {string} Color string
 */
export const getRiskLevelColor = (riskType) => {
  const colors = {
    MRGL: '#00e600',     // Dark green
    MARGINAL: '#00e600',
    SLGT: '#f4d90e',     // Yellow
    SLIGHT: '#f4d90e',
    ENH: '#e69500',      // Orange
    ENHANCED: '#e69500',
    MDT: '#ff0000',      // Red
    MODERATE: '#ff0000',
    HIGH: '#ff00ff',     // Magenta
    UNKNOWN: '#888888',  // Gray
  };

  return colors[riskType?.toUpperCase()] || colors.UNKNOWN;
};

/**
 * Get polygon stroke width based on risk level
 * @param {string} riskType - Risk type
 * @returns {number} Stroke width in pixels
 */
export const getRiskLevelStrokeWidth = (riskType) => {
  const widths = {
    MRGL: 2,
    SLGT: 2.5,
    ENH: 3,
    MDT: 3.5,
    HIGH: 4,
  };

  return widths[riskType?.toUpperCase()] || 2;
};

/**
 * Load geodata from bundled JSON files
 * Place your geodata files in src/data/samples/ with naming: {domain}_geodata.json
 * @param {string} domainId - Domain ID (conus, oklahoma, texas, etc.)
 * @returns {Object|null} Validated geodata or null
 */
export const loadTestGeoData = (domainId) => {
  // Import geodata based on domain
  // Using require for static analysis compatibility
  try {
    let geoData = null;

    // Normalize domain ID for matching
    const normalizedId = domainId?.toLowerCase();

    // Load geodata for this domain
    // ADD MORE DOMAINS HERE as you create geodata files:
    if (normalizedId === 'conus') {
      geoData = require('../data/samples/conus_geodata.json');
    } else if (normalizedId === 'oklahoma') {
      geoData = require('../data/samples/oklahoma_geodata.json');
    }
    // Example for adding more domains:
    // else if (normalizedId === 'texas') {
    //   geoData = require('../data/samples/texas_geodata.json');
    // }
    // else if (normalizedId === 'greatplains') {
    //   geoData = require('../data/samples/greatplains_geodata.json');
    // }

    if (geoData) {
      console.log(`[GEODATA] Loaded geodata for ${domainId}`);
      const validated = validateGeoData(geoData, null);
      validated.isFallback = false;
      validated.metadata = {
        ...validated.metadata,
        loadedAt: new Date().toISOString(),
      };
      return validated;
    }

    console.log(`[GEODATA] No geodata file for ${domainId}, using domain bounds`);
    return null;
  } catch (error) {
    console.warn(`[GEODATA] Error loading geodata for ${domainId}:`, error.message);
    return null;
  }
};

/**
 * Check if test mode is enabled
 * Can be controlled via AppContext or environment
 * @returns {boolean}
 */
let testModeEnabled = false;

export const enableTestMode = () => {
  testModeEnabled = true;
  console.log('[TEST] Test mode enabled - using local sample data');
};

export const disableTestMode = () => {
  testModeEnabled = false;
  console.log('[TEST] Test mode disabled');
};

export const isTestModeEnabled = () => testModeEnabled;
