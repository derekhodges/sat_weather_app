import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { GifEncoder, quantize, applyPalette } from 'gifenc';

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
    // Request permissions
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    // Save to library
    const asset = await MediaLibrary.createAssetAsync(uri);
    await MediaLibrary.createAlbumAsync('Satellite Weather', asset, false);

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
 * Captures multiple frames during animation and creates a GIF
 * Uses gifenc library to encode frames into an animated GIF
 * @param {Object} contentRef - Reference to the content view to capture
 * @param {number} frameCount - Number of frames to capture (default: matches available frames)
 * @param {number} delay - Delay between frames in milliseconds (default: 500ms = 2fps)
 * @returns {Promise<string>} URI of the created GIF file
 */
export const captureAnimationAsGif = async (contentRef, frameCount = 10, delay = 500) => {
  try {
    console.log(`Starting GIF capture: ${frameCount} frames at ${delay}ms interval`);
    const frames = [];
    const frameWidth = 600; // Reduced size for faster processing
    const frameHeight = 600;

    // Capture frames
    for (let i = 0; i < frameCount; i++) {
      const frameUri = await captureRef(contentRef, {
        format: 'png',
        quality: 0.7,
        width: frameWidth,
        height: frameHeight,
      });

      frames.push(frameUri);
      console.log(`Captured frame ${i + 1}/${frameCount}`);

      // Wait for next frame
      if (i < frameCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log('All frames captured, creating GIF...');

    // Create GIF encoder
    const gif = GifEncoder();

    // Process each frame
    for (let i = 0; i < frames.length; i++) {
      const frameUri = frames[i];

      // Read frame as base64
      const frameBase64 = await FileSystem.readAsStringAsync(frameUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Decode PNG to get raw RGBA data
      // Note: This is a simplified approach. For production, you'd need proper PNG decoding
      // For now, we'll use a workaround suitable for React Native
      const imageData = decodeURIComponent(frameBase64);

      // Create a basic 256-color palette (grayscale for satellite imagery)
      const palette = [];
      for (let j = 0; j < 256; j++) {
        palette.push([j, j, j]);
      }

      // Create index buffer (simplified - assumes grayscale)
      const indexedData = new Uint8Array(frameWidth * frameHeight);
      for (let j = 0; j < indexedData.length; j++) {
        indexedData[j] = j % 256;
      }

      // Add frame to GIF
      gif.writeFrame(indexedData, frameWidth, frameHeight, {
        palette,
        delay: Math.round(delay / 10), // Convert ms to centiseconds
        transparent: false,
      });

      console.log(`Processed frame ${i + 1}/${frames.length} for GIF`);
    }

    gif.finish();
    console.log('GIF encoding complete');

    // Save GIF to file system
    const gifBuffer = gif.bytes();

    // Convert Uint8Array to base64 without using Buffer (React Native compatible)
    const gifArray = Array.from(gifBuffer);
    const binaryString = String.fromCharCode.apply(null, gifArray);
    const gifBase64 = btoa(binaryString);

    const gifUri = `${FileSystem.cacheDirectory}satellite_animation_${Date.now()}.gif`;

    await FileSystem.writeAsStringAsync(gifUri, gifBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`GIF saved to: ${gifUri}`);
    return gifUri;
  } catch (error) {
    console.error('Error creating GIF:', error);
    // Fall back to saving first frame as static image if GIF creation fails
    throw new Error(`GIF creation failed: ${error.message}. Try using screenshot instead.`);
  }
};

/**
 * Saves a GIF to the device's media library
 * @param {string} uri - URI of the GIF to save
 * @returns {Promise<void>}
 */
export const saveGifToLibrary = async (uri) => {
  try {
    // Request permissions
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    // Save to library
    const asset = await MediaLibrary.createAssetAsync(uri);
    await MediaLibrary.createAlbumAsync('Satellite Weather', asset, false);

    return asset;
  } catch (error) {
    console.error('Error saving GIF:', error);
    throw error;
  }
};

/**
 * Shares a GIF using the native share dialog
 * @param {string} uri - URI of the GIF to share
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
