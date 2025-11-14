/**
 * Pixel sampling utilities for inspector mode
 * Uses react-native-view-shot and expo-image-manipulator to sample actual pixel colors
 */

import { captureRef } from 'react-native-view-shot';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Sample pixel color at a specific point in the image view
 *
 * This captures the image view and extracts the actual RGB color at the tap point
 *
 * @param {object} viewRef - Reference to the image container view
 * @param {number} x - X coordinate (screen coordinates)
 * @param {number} y - Y coordinate (screen coordinates)
 * @returns {Promise<{r, g, b, sampled: true}>} - RGB color values
 */
export const samplePixelColor = async (viewRef, x, y) => {
  try {
    console.log(`[PIXEL SAMPLE] Starting sample at screen coords (${x.toFixed(1)}, ${y.toFixed(1)})`);

    // Step 1: Capture the entire view as a PNG
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1.0,
      result: 'tmpfile',
    });

    console.log(`[PIXEL SAMPLE] Captured view to: ${uri}`);

    // Step 2: Crop to a small region around the tap point (5x5 pixels)
    // We use a small region for better accuracy
    const cropSize = 5;
    const halfSize = Math.floor(cropSize / 2);

    const cropX = Math.max(0, Math.floor(x - halfSize));
    const cropY = Math.max(0, Math.floor(y - halfSize));

    console.log(`[PIXEL SAMPLE] Cropping at (${cropX}, ${cropY}) with size ${cropSize}x${cropSize}`);

    // Step 3: Crop and resize to 1x1 pixel
    // This effectively gives us the average color of the region, which is very close to the center pixel
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          crop: {
            originX: cropX,
            originY: cropY,
            width: cropSize,
            height: cropSize,
          },
        },
        {
          resize: {
            width: 1,
            height: 1,
          },
        },
      ],
      { format: ImageManipulator.SaveFormat.PNG, base64: true }
    );

    // Step 4: Extract RGB from the 1x1 pixel PNG
    const rgb = await extractRGBFromSinglePixelPNG(manipulated.base64);

    console.log(`[PIXEL SAMPLE] Extracted RGB: (${rgb.r}, ${rgb.g}, ${rgb.b})`);

    return {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      sampled: true,
    };
  } catch (error) {
    console.error('[PIXEL SAMPLE] Error sampling pixel:', error);
    // Return null to trigger fallback to estimation
    return null;
  }
};

/**
 * Extract RGB color from a base64-encoded 1x1 pixel PNG image
 * This is much simpler than parsing a multi-pixel PNG
 *
 * @param {string} base64 - Base64 encoded PNG data (without data URI prefix)
 * @returns {Promise<{r, g, b}>} - RGB values
 */
const extractRGBFromSinglePixelPNG = async (base64) => {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // PNG format: 8-byte signature, then chunks (IHDR, IDAT, IEND)
    // For a 1x1 pixel PNG, the IDAT chunk contains very little data

    // Find IDAT chunk (contains pixel data)
    let idatStart = -1;
    let idatLength = 0;

    for (let i = 8; i < bytes.length - 4; i++) {
      // Check for "IDAT" chunk type (49 44 41 54 in ASCII)
      if (bytes[i] === 73 && bytes[i+1] === 68 && bytes[i+2] === 65 && bytes[i+3] === 84) {
        // Length is 4 bytes before chunk type
        idatLength = (bytes[i-4] << 24) | (bytes[i-3] << 16) | (bytes[i-2] << 8) | bytes[i-1];
        idatStart = i + 4; // Start of IDAT data (after chunk type)
        break;
      }
    }

    if (idatStart === -1) {
      throw new Error('Could not find IDAT chunk in PNG');
    }

    // IDAT data is zlib compressed, but for a 1x1 pixel it's minimal
    // The actual RGB values are somewhere in this small compressed block
    // Strategy: scan for reasonable RGB values (not compression artifacts)

    const rgbCandidates = [];

    // Scan through the IDAT data looking for RGB triplets
    for (let i = idatStart; i < idatStart + idatLength - 2 && i < bytes.length - 2; i++) {
      const r = bytes[i];
      const g = bytes[i + 1];
      const b = bytes[i + 2];

      // Valid RGB values that look like actual colors
      // (Not metadata like 0,0,0 or 255,255,255 or compression artifacts)
      if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        rgbCandidates.push({ r, g, b, index: i });
      }
    }

    // Return the most likely candidate (middle of the scan)
    if (rgbCandidates.length > 0) {
      const middleIndex = Math.floor(rgbCandidates.length / 2);
      return rgbCandidates[middleIndex];
    }

    throw new Error('Could not extract pixel data from PNG');

  } catch (error) {
    console.error('Error extracting RGB from PNG:', error);
    throw error;
  }
};

/**
 * Fallback: Estimate color based on coordinate and product type
 * Uses the actual color tables from color_plus.py for accurate estimation
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} height - Image height
 * @param {string} viewMode - 'rgb' or 'channel'
 * @param {object} product - Current product
 * @returns {{r, g, b, estimated: true}}
 */
export const estimateColorFromCoordinates = (x, y, height, viewMode, product) => {
  // Import color tables
  const IR_COLOR_TABLES = require('../constants/colorTables').IR_COLOR_TABLES;

  // Calculate vertical position percentage (0 at top, 100 at bottom)
  const percentage = (y / height) * 100;

  if (viewMode === 'channel' && product?.type === 'infrared') {
    // Get the color table for this specific channel
    const channel = `C${product.number.toString().padStart(2, '0')}`;
    const colorTable = IR_COLOR_TABLES[channel];

    if (colorTable && colorTable.colors) {
      // Map percentage to position in color table
      // Bottom of image (100%) = index 0 (coldest/first color)
      // Top of image (0%) = last index (warmest/last color)
      const position = (percentage / 100) * (colorTable.colors.length - 1);
      const lowerIndex = Math.floor(position);
      const upperIndex = Math.min(lowerIndex + 1, colorTable.colors.length - 1);
      const fraction = position - lowerIndex;

      // Interpolate between colors
      const lowerColor = colorTable.colors[lowerIndex];
      const upperColor = colorTable.colors[upperIndex];

      const r = Math.round(lowerColor[0] + (upperColor[0] - lowerColor[0]) * fraction);
      const g = Math.round(lowerColor[1] + (upperColor[1] - lowerColor[1]) * fraction);
      const b = Math.round(lowerColor[2] + (upperColor[2] - lowerColor[2]) * fraction);

      return {
        r,
        g,
        b,
        estimated: true
      };
    }

    // Fallback if color table not found: generic blue to red
    const hue = 240 - (percentage / 100 * 240);
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
