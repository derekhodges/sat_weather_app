import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import UPNG from 'upng-js';

/**
 * Captures a screenshot of the content view (excluding buttons and status bar)
 * @param {Object} contentRef - Reference to the content view to capture
 * @returns {Promise<string>} URI of the captured image
 */
export const captureScreenshot = async (contentRef) => {
  try {
    const uri = await captureRef(contentRef, {
      format: 'png',
      quality: 1.0,
    });
    return uri;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
};

/**
 * Saves a screenshot to the device's media library
 * @param {string} uri - URI of the image to save
 * @returns {Promise<void>}
 */
export const saveScreenshotToLibrary = async (uri) => {
  try {
    // Request permissions (only asks once, then remembers)
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    // Just save the asset - don't try to create album (avoids repeated permission prompts)
    const asset = await MediaLibrary.createAssetAsync(uri);

    return asset;
  } catch (error) {
    console.error('Error saving screenshot:', error);
    throw error;
  }
};

/**
 * Shares an image using the native share dialog
 * @param {string} uri - URI of the image to share
 * @returns {Promise<void>}
 */
export const shareImage = async (uri) => {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share Satellite Weather Image',
    });
  } catch (error) {
    console.error('Error sharing image:', error);
    throw error;
  }
};

/**
 * Helper function to decode PNG image to RGBA pixel data using UPNG.js (pure JS, no Node dependencies)
 * @param {string} uri - URI of the PNG image
 * @returns {Promise<{data: Uint8Array, width: number, height: number}>}
 */
const decodePngToRgba = async (uri) => {
  try {
    // Read PNG file as base64
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode PNG using UPNG (pure JavaScript, no Node dependencies)
    const decoded = UPNG.decode(bytes.buffer);

    // Convert to RGBA format
    const rgba = UPNG.toRGBA8(decoded)[0]; // Get first frame as RGBA8

    return {
      data: new Uint8Array(rgba), // RGBA pixel data
      width: decoded.width,
      height: decoded.height,
    };
  } catch (error) {
    console.error('Error decoding PNG:', error);
    throw error;
  }
};

/**
 * Creates an animated GIF from captured frames
 * @param {Object} contentRef - Reference to the content view to capture
 * @param {number} frameCount - Number of frames to capture
 * @param {number} delay - Delay between frames in milliseconds
 * @param {Function} progressCallback - Optional callback for progress (current, total, status)
 * @returns {Promise<string>} URI of the created GIF file
 */
export const createAnimatedGif = async (
  contentRef,
  frameCount = 10,
  delay = 500,
  progressCallback = null
) => {
  try {
    console.log(`Starting GIF creation: ${frameCount} frames at ${delay}ms interval`);

    // Reduce size for faster processing
    const gifWidth = 400;
    const gifHeight = 400;

    // Step 1: Capture all frames
    if (progressCallback) progressCallback(0, frameCount, 'Capturing frames...');

    const frameUris = [];
    for (let i = 0; i < frameCount; i++) {
      const uri = await captureRef(contentRef, {
        format: 'png',
        quality: 0.8,
        width: gifWidth,
        height: gifHeight,
      });

      frameUris.push(uri);
      console.log(`Captured frame ${i + 1}/${frameCount}`);

      if (progressCallback) {
        progressCallback(i + 1, frameCount, `Captured ${i + 1}/${frameCount} frames`);
      }

      // Wait for next frame
      if (i < frameCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Step 2: Process frames and create GIF
    if (progressCallback) progressCallback(frameCount, frameCount, 'Creating GIF...');

    const gif = GIFEncoder();

    for (let i = 0; i < frameUris.length; i++) {
      const frameUri = frameUris[i];

      // Decode PNG to RGBA
      const { data: rgbaData, width, height } = await decodePngToRgba(frameUri);

      // Quantize colors to 256-color palette
      const palette = quantize(rgbaData, 256);

      // Apply palette to get indexed colors
      const indexedData = applyPalette(rgbaData, palette);

      // Add frame to GIF
      gif.writeFrame(indexedData, width, height, {
        palette,
        delay: Math.round(delay / 10), // Convert ms to centiseconds
      });

      console.log(`Processed frame ${i + 1}/${frameUris.length} for GIF`);

      if (progressCallback) {
        progressCallback(
          i + 1,
          frameUris.length,
          `Encoding frame ${i + 1}/${frameUris.length}`
        );
      }
    }

    gif.finish();

    // Step 3: Save GIF to file
    if (progressCallback) progressCallback(frameCount, frameCount, 'Saving GIF...');

    const gifBuffer = gif.bytes();

    // Convert to base64 for React Native file system
    // Process in chunks to avoid stack overflow with large arrays
    const chunkSize = 8192;
    let binaryString = '';
    for (let i = 0; i < gifBuffer.length; i += chunkSize) {
      const chunk = gifBuffer.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const gifBase64 = btoa(binaryString);

    const gifUri = `${FileSystem.cacheDirectory}satellite_animation_${Date.now()}.gif`;

    await FileSystem.writeAsStringAsync(gifUri, gifBase64, {
      encoding: 'base64',
    });

    console.log(`GIF created successfully: ${gifUri}`);
    return gifUri;
  } catch (error) {
    console.error('Error creating GIF:', error);
    throw error;
  }
};

/**
 * Saves a GIF to the device's media library
 * @param {string} uri - URI of the GIF file
 * @returns {Promise<void>}
 */
export const saveGifToLibrary = async (uri) => {
  try {
    // Request permissions (only asks once, then remembers)
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    // Just save the asset - don't try to create album (avoids repeated permission prompts)
    const asset = await MediaLibrary.createAssetAsync(uri);

    return asset;
  } catch (error) {
    console.error('Error saving GIF to library:', error);
    throw error;
  }
};

/**
 * Shares a GIF using the native share dialog
 * @param {string} uri - URI of the GIF file
 * @returns {Promise<void>}
 */
export const shareGif = async (uri) => {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/gif',
      dialogTitle: 'Share Satellite Weather Animation',
    });
  } catch (error) {
    console.error('Error sharing GIF:', error);
    throw error;
  }
};

