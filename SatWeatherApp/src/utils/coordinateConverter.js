/**
 * Coordinate conversion utilities for mapping geographic coordinates to screen positions
 */

import { ALL_REGIONS } from '../constants/regions';

/**
 * Convert geographic coordinates (lat/lon) to pixel position on an image
 *
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @param {Array} imageBounds - [west_lon, east_lon, south_lat, north_lat]
 * @param {Object} imageSize - { width, height } in pixels
 * @returns {Object} { x, y } position in pixels from top-left
 */
export const geoToPixel = (lon, lat, imageBounds, imageSize) => {
  const [westLon, eastLon, southLat, northLat] = imageBounds;
  const { width, height } = imageSize;

  // Calculate the position as a percentage of the image
  const xPercent = (lon - westLon) / (eastLon - westLon);
  const yPercent = (northLat - lat) / (northLat - southLat); // Inverted because y increases downward

  return {
    x: xPercent * width,
    y: yPercent * height,
  };
};

/**
 * Convert geographic coordinates to percentage position (0-100)
 * Useful for positioning elements with percentage-based styles
 *
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @param {Array} imageBounds - [west_lon, east_lon, south_lat, north_lat]
 * @returns {Object} { xPercent, yPercent } as percentages (0-100)
 */
export const geoToPercent = (lon, lat, imageBounds) => {
  const [westLon, eastLon, southLat, northLat] = imageBounds;

  const xPercent = ((lon - westLon) / (eastLon - westLon)) * 100;
  const yPercent = ((northLat - lat) / (northLat - southLat)) * 100; // Inverted

  return {
    xPercent: Math.max(0, Math.min(100, xPercent)),
    yPercent: Math.max(0, Math.min(100, yPercent)),
  };
};

/**
 * Get the position of a region's center on the map
 *
 * @param {string} regionId - Region identifier
 * @param {Array} mapBounds - Bounds of the background map image
 * @param {Object} containerSize - { width, height } of the container
 * @returns {Object} { x, y, visible } - pixel position and visibility flag
 */
export const getRegionPositionOnMap = (regionId, mapBounds, containerSize) => {
  const regionBounds = ALL_REGIONS[regionId];
  if (!regionBounds) {
    return { x: 0, y: 0, visible: false };
  }

  const [westLon, eastLon, southLat, northLat] = regionBounds;
  const centerLon = (westLon + eastLon) / 2;
  const centerLat = (southLat + northLat) / 2;

  const position = geoToPixel(centerLon, centerLat, mapBounds, containerSize);

  // Check if the region center is within the map bounds
  const [mapWest, mapEast, mapSouth, mapNorth] = mapBounds;
  const visible =
    centerLon >= mapWest &&
    centerLon <= mapEast &&
    centerLat >= mapSouth &&
    centerLat <= mapNorth;

  return {
    ...position,
    visible,
  };
};

/**
 * Get percentage-based position for a region's center
 *
 * @param {string} regionId - Region identifier
 * @param {Array} mapBounds - Bounds of the background map image
 * @returns {Object} { xPercent, yPercent, visible }
 */
export const getRegionPercentPosition = (regionId, mapBounds) => {
  const regionBounds = ALL_REGIONS[regionId];
  if (!regionBounds) {
    return { xPercent: 0, yPercent: 0, visible: false };
  }

  const [westLon, eastLon, southLat, northLat] = regionBounds;
  const centerLon = (westLon + eastLon) / 2;
  const centerLat = (southLat + northLat) / 2;

  const percentPos = geoToPercent(centerLon, centerLat, mapBounds);

  // Check if the region center is within the map bounds
  const [mapWest, mapEast, mapSouth, mapNorth] = mapBounds;
  const visible =
    centerLon >= mapWest &&
    centerLon <= mapEast &&
    centerLat >= mapSouth &&
    centerLat <= mapNorth;

  return {
    ...percentPos,
    visible,
  };
};

/**
 * Base map bounds for different satellite view types
 * These are approximate and should be replaced with exact bounds when available
 *
 * Format: [west_lon, east_lon, south_lat, north_lat]
 */
export const BASE_MAP_BOUNDS = {
  // Standard CONUS image bounds (what the actual satellite image covers)
  conus: [-128, -60, 23, 51],

  // Full disk image bounds (entire hemisphere view)
  full_disk: [-160, -40, -60, 60],

  // Satellite-specific views for region filtering
  // CONUS views - covers continental US
  conus_west: [-170, -100, 15, 55], // GOES-18 CONUS coverage
  conus_east: [-130, -60, 20, 55], // GOES-19 CONUS coverage

  // Full disk views - entire hemisphere
  full_disk_west: [-227, -47, -80, 80], // GOES-18 full disk
  full_disk_east: [-165, 15, -80, 80], // GOES-19 full disk
};

/**
 * Get all visible regions and their positions for a given map type
 *
 * @param {Array} regionIds - Array of region IDs to display
 * @param {string} mapType - Type of base map ('conus_west', 'conus_east', etc.)
 * @returns {Array} Array of { id, displayName, xPercent, yPercent, visible }
 */
export const getVisibleRegionPositions = (regionIds, mapType) => {
  const mapBounds = BASE_MAP_BOUNDS[mapType] || BASE_MAP_BOUNDS.conus_east;

  return regionIds
    .map((id) => {
      const position = getRegionPercentPosition(id, mapBounds);
      return {
        id,
        ...position,
      };
    })
    .filter((region) => region.visible);
};

/**
 * Check if a region is visible within the given map bounds
 *
 * @param {string} regionId - Region identifier
 * @param {Array} mapBounds - [west_lon, east_lon, south_lat, north_lat]
 * @returns {boolean} Whether the region center is visible
 */
export const isRegionVisible = (regionId, mapBounds) => {
  const regionBounds = ALL_REGIONS[regionId];
  if (!regionBounds) return false;

  const [westLon, eastLon, southLat, northLat] = regionBounds;
  const centerLon = (westLon + eastLon) / 2;
  const centerLat = (southLat + northLat) / 2;

  const [mapWest, mapEast, mapSouth, mapNorth] = mapBounds;

  return (
    centerLon >= mapWest &&
    centerLon <= mapEast &&
    centerLat >= mapSouth &&
    centerLat <= mapNorth
  );
};
