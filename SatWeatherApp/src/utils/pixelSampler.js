/**
 * Pixel sampling utilities for inspector mode
 * Uses react-native-view-shot to sample pixel colors from the satellite image
 */

import { captureRef } from 'react-native-view-shot';

/**
 * Sample pixel color at a specific point in the image
 *
 * This captures a small region around the tap point and extracts the center pixel color
 *
 * @param {object} imageRef - Reference to the Image component
 * @param {number} x - X coordinate (relative to image)
 * @param {number} y - Y coordinate (relative to image)
 * @param {number} imageWidth - Width of the displayed image
 * @param {number} imageHeight - Height of the displayed image
 * @returns {Promise<{r, g, b}>} - RGB color values
 */
export const samplePixelColor = async (imageRef, x, y, imageWidth, imageHeight) => {
  try {
    // Capture a small region around the tap point (5x5 pixels)
    // This is faster than capturing the whole image
    const sampleSize = 5;
    const halfSize = Math.floor(sampleSize / 2);

    // Ensure coordinates are within bounds
    const sampleX = Math.max(halfSize, Math.min(x, imageWidth - halfSize));
    const sampleY = Math.max(halfSize, Math.min(y, imageHeight - halfSize));

    // Capture the entire image (we'll process it to get the pixel)
    // Note: captureRef doesn't support region capture, so we capture full image
    const uri = await captureRef(imageRef, {
      format: 'png',
      quality: 1.0,
      result: 'data-uri',
    });

    // Parse the data URI to get pixel data
    // For now, we'll return a placeholder since we need to decode the image
    // In a real implementation, you'd use expo-image-manipulator or similar

    // Placeholder: Extract color from data URI
    const color = await extractColorFromDataURI(uri, sampleX, sampleY, imageWidth, imageHeight);

    return color;
  } catch (error) {
    console.error('Error sampling pixel:', error);
    throw error;
  }
};

/**
 * Extract RGB color from a data URI at specific coordinates
 * This is a simplified version - in production you'd use expo-image-manipulator
 *
 * @param {string} dataURI - Base64 encoded image data URI
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Promise<{r, g, b}>} - RGB values
 */
const extractColorFromDataURI = async (dataURI, x, y, width, height) => {
  // This is a simplified implementation
  // In a real app, you would:
  // 1. Use expo-image-manipulator to decode the image
  // 2. Extract pixel data at the specified coordinates
  // 3. Return the RGB values

  // For now, return a placeholder that indicates we need the actual implementation
  // The calling code will fall back to coordinate-based estimation
  return null;
};

/**
 * Alternative: Sample using canvas (requires expo-gl or react-native-canvas)
 * This is more complex but allows true pixel reading
 */
export const samplePixelWithCanvas = async (imageUri, x, y) => {
  // TODO: Implement canvas-based sampling if needed
  // This would require adding expo-gl or react-native-canvas as a dependency
  throw new Error('Canvas-based sampling not yet implemented');
};

/**
 * Fallback: Estimate color based on coordinate and product type
 * Uses the colorbar gradient as an approximation
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} height - Image height
 * @param {string} viewMode - 'rgb' or 'channel'
 * @param {object} product - Current product
 * @returns {{r, g, b, estimated: true}}
 */
export const estimateColorFromCoordinates = (x, y, height, viewMode, product) => {
  // Simple vertical gradient estimation
  // Blue (cold/top) to Red (warm/bottom) for IR channels
  const percentage = (y / height) * 100;

  if (viewMode === 'channel' && product?.type === 'infrared') {
    // Use IR colorbar gradient (blue to red)
    const hue = 240 - (percentage / 100 * 240); // 240 (blue) to 0 (red)

    // Convert HSL to RGB
    const rgb = hslToRgb(hue / 360, 1, 0.5);

    return {
      r: rgb[0],
      g: rgb[1],
      b: rgb[2],
      estimated: true
    };
  }

  // For RGB products, we can't estimate well, so return middle gray
  return {
    r: 128,
    g: 128,
    b: 128,
    estimated: true
  };
};

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
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

  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255)
  ];
}
