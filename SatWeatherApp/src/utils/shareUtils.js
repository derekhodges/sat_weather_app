import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

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
 * Captures all animation frames and saves them as individual images to photo library
 * This allows users to create videos/GIFs using their device's built-in tools
 * @param {Object} contentRef - Reference to the content view to capture
 * @param {number} frameCount - Number of frames to capture
 * @param {number} delay - Delay between frames in milliseconds (default: 500ms)
 * @param {Function} progressCallback - Optional callback for progress updates (frameNum, totalFrames)
 * @returns {Promise<Array>} Array of saved media library assets
 */
export const captureAndSaveAnimationFrames = async (
  contentRef,
  frameCount = 10,
  delay = 500,
  progressCallback = null
) => {
  try {
    console.log(`Starting animation frame capture: ${frameCount} frames at ${delay}ms interval`);

    // Request permissions first
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    const assets = [];

    // Capture and save each frame
    for (let i = 0; i < frameCount; i++) {
      // Capture current frame
      const frameUri = await captureRef(contentRef, {
        format: 'png',
        quality: 0.9,
      });

      // Save immediately to media library
      const asset = await MediaLibrary.createAssetAsync(frameUri);
      assets.push(asset);

      console.log(`Saved frame ${i + 1}/${frameCount}`);

      // Call progress callback if provided
      if (progressCallback) {
        progressCallback(i + 1, frameCount);
      }

      // Wait for next frame (except on last frame)
      if (i < frameCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Create an album for the frames
    try {
      const albumName = `Satellite Weather Animation ${new Date().toLocaleDateString()}`;
      await MediaLibrary.createAlbumAsync(albumName, assets[0], false);

      // Add remaining assets to the album
      const albums = await MediaLibrary.getAlbumsAsync();
      const targetAlbum = albums.find(album => album.title === albumName);

      if (targetAlbum) {
        for (let i = 1; i < assets.length; i++) {
          await MediaLibrary.addAssetsToAlbumAsync([assets[i]], targetAlbum, false);
        }
      }
    } catch (albumError) {
      console.warn('Could not create album, but frames were saved:', albumError);
    }

    console.log(`All ${frameCount} frames saved successfully`);
    return assets;
  } catch (error) {
    console.error('Error capturing animation frames:', error);
    throw error;
  }
};

/**
 * Shares the current frame as an image
 * (Renamed from shareGif for clarity - now shares current visible frame)
 * @param {Object} contentRef - Reference to the content view to capture
 * @returns {Promise<void>}
 */
export const shareCurrentFrame = async (contentRef) => {
  try {
    // Capture the current frame
    const uri = await captureScreenshot(contentRef);

    // Share it
    await shareImage(uri);
  } catch (error) {
    console.error('Error sharing current frame:', error);
    throw error;
  }
};
