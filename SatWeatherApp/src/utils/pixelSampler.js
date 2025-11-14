/**
 * Pixel sampling utilities for inspector mode
 * Uses react-native-view-shot and expo-image-manipulator to sample actual pixel colors
 */

import { captureRef } from 'react-native-view-shot';
import * as ImageManipulator from 'expo-image-manipulator';
import UPNG from 'upng-js';

/**
 * Sample pixel color at a specific point in the image view
 *
 * This captures the image view and extracts the actual RGB color at the tap point
 *
 * @param {object} viewRef - Reference to the image container view
 * @param {number} x - X coordinate (screen coordinates)
 * @param {number} y - Y coordinate (screen coordinates)
 * @param {number} screenWidth - Screen width in pixels
 * @param {number} screenHeight - Screen height in pixels
 * @returns {Promise<{r, g, b, sampled: true}>} - RGB color values
 */
export const samplePixelColor = async (viewRef, x, y, screenWidth, screenHeight) => {
  try {
    console.log(`[PIXEL SAMPLE] Starting sample at screen coords (${x.toFixed(1)}, ${y.toFixed(1)})`);
    console.log(`[PIXEL SAMPLE] Screen dimensions: ${screenWidth}x${screenHeight}`);

    // Step 1: Capture the entire view as a PNG
    // CRITICAL: Force capture to be screen-sized so tap coordinates map directly
    // Without this, zoomed views capture at higher resolution causing coordinate mismatch
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1.0,
      result: 'tmpfile',
      width: Math.round(screenWidth),   // Force screen width
      height: Math.round(screenHeight), // Force screen height
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
 * Uses UPNG library for proper PNG decoding
 *
 * @param {string} base64 - Base64 encoded PNG data (without data URI prefix)
 * @returns {Promise<{r, g, b}>} - RGB values
 */
const extractRGBFromSinglePixelPNG = async (base64) => {
  try {
    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`[PNG DECODE] Decoding PNG, size: ${bytes.length} bytes`);

    // Use UPNG to decode the PNG
    const png = UPNG.decode(bytes.buffer);

    console.log(`[PNG DECODE] PNG decoded: ${png.width}x${png.height}, ${png.depth} bit, frames: ${png.frames?.length || 'N/A'}`);

    // Convert to RGBA - this returns an array of Uint8Arrays (one per frame)
    const rgbaFrames = UPNG.toRGBA8(png);

    console.log(`[PNG DECODE] RGBA frames: ${rgbaFrames.length}, first frame type: ${rgbaFrames[0]?.constructor.name}, length: ${rgbaFrames[0]?.length}`);

    const rgba = new Uint8Array(rgbaFrames[0]); // Get first frame as Uint8Array

    console.log(`[PNG DECODE] RGBA array length: ${rgba.length}, values: [${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]}]`);

    // RGBA is a Uint8Array with 4 bytes per pixel (R, G, B, A)
    // For a 1x1 image, we just need the first pixel
    const r = rgba[0];
    const g = rgba[1];
    const b = rgba[2];
    const a = rgba[3];

    console.log(`[PNG DECODE] Pixel color: RGB(${r}, ${g}, ${b}), Alpha: ${a}`);

    // Validate we got real values
    if (r === undefined || g === undefined || b === undefined) {
      throw new Error(`Invalid RGB values: r=${r}, g=${g}, b=${b}`);
    }

    return { r, g, b };

  } catch (error) {
    console.error('[PNG DECODE] Error extracting RGB from PNG:', error);
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
