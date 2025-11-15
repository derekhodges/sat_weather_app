/**
 * Frame Cache - Handles prefetching and caching of satellite frames
 * Eliminates black flashes during animation by keeping frames in memory
 */

import { Image } from 'react-native';

class FrameCache {
  constructor() {
    this.cache = new Map(); // Map<cacheKey, imageData>
    this.prefetchPromises = new Map(); // Track ongoing prefetches
  }

  /**
   * Generate a unique cache key for a frame
   */
  generateCacheKey(domain, product, timestamp) {
    const domainName = domain?.codName || domain;
    const productName = product?.codName || product?.number?.toString() || product;
    return `${domainName}_${productName}_${timestamp}`;
  }

  /**
   * Get a frame from cache
   */
  get(domain, product, timestamp) {
    const key = this.generateCacheKey(domain, product, timestamp);
    return this.cache.get(key);
  }

  /**
   * Check if a frame is cached
   */
  has(domain, product, timestamp) {
    const key = this.generateCacheKey(domain, product, timestamp);
    return this.cache.has(key);
  }

  /**
   * Cache a frame
   */
  set(domain, product, timestamp, imageData) {
    const key = this.generateCacheKey(domain, product, timestamp);
    this.cache.set(key, imageData);
  }

  /**
   * Prefetch a single frame
   * Returns the URL if successful, null if frame doesn't exist
   */
  async prefetchFrame(url, domain, product, timestamp) {
    const key = this.generateCacheKey(domain, product, timestamp);

    // Return cached version if already available
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Return ongoing prefetch promise if exists
    if (this.prefetchPromises.has(key)) {
      return this.prefetchPromises.get(key);
    }

    // Start new prefetch
    const prefetchPromise = (async () => {
      try {
        // First check if the image exists using HEAD request
        const headResponse = await fetch(url, { method: 'HEAD' });
        if (!headResponse.ok) {
          console.log(`Frame not available: ${timestamp}`);
          this.prefetchPromises.delete(key);
          return null;
        }

        // Image exists, now prefetch it into React Native's native cache
        // This ensures it's fully loaded and ready for instant display
        await Image.prefetch(url);

        // Cache the URL for quick lookup
        this.cache.set(key, url);
        this.prefetchPromises.delete(key);
        return url;
      } catch (error) {
        console.warn(`Failed to prefetch frame ${timestamp}:`, error.message);
        this.prefetchPromises.delete(key);
        return null;
      }
    })();

    this.prefetchPromises.set(key, prefetchPromise);
    return prefetchPromise;
  }

  /**
   * Prefetch multiple frames with smart prioritization
   * Strategy: newest first (current frame), then oldest (loop start), then work backwards
   * This ensures smooth playback when animation starts
   * Returns array of successfully prefetched frames with their timestamps
   */
  async prefetchFrames(frames) {
    if (frames.length === 0) return [];

    console.log(`Prefetching ${frames.length} frames with smart prioritization...`);

    // Prioritize frames for optimal user experience:
    // 1. Newest frame (index length-1) - shown immediately
    // 2. Oldest frame (index 0) - needed when loop restarts
    // 3. Rest in reverse order (length-2, length-3, ..., 1) - animation order
    const priorityOrder = [];

    if (frames.length > 0) {
      // Newest frame first (most important - displayed immediately)
      priorityOrder.push(frames[frames.length - 1]);
    }

    if (frames.length > 1) {
      // Oldest frame second (important - loop restart point)
      priorityOrder.push(frames[0]);
    }

    // Add remaining frames in reverse order (working backwards from newest)
    for (let i = frames.length - 2; i >= 1; i--) {
      priorityOrder.push(frames[i]);
    }

    // Prefetch in batches of 3 to balance speed vs network load
    const batchSize = 3;
    const results = [];

    for (let i = 0; i < priorityOrder.length; i += batchSize) {
      const batch = priorityOrder.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async ({ url, domain, product, timestamp }) => {
          const result = await this.prefetchFrame(url, domain, product, timestamp);
          return { timestamp, url: result, success: result !== null };
        })
      );
      results.push(...batchResults);
    }

    const successful = results.filter(r => r.success);
    console.log(`Successfully prefetched ${successful.length}/${frames.length} frames`);

    return results;
  }

  /**
   * Clear cache for a specific domain/product combination
   */
  clearForProduct(domain, product) {
    const domainName = domain?.codName || domain;
    const productName = product?.codName || product?.number?.toString() || product;
    const prefix = `${domainName}_${productName}_`;

    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        cleared++;
      }
    }

    console.log(`Cleared ${cleared} cached frames for ${domainName}/${productName}`);
  }

  /**
   * Clear all cached frames
   */
  clearAll() {
    const size = this.cache.size;
    this.cache.clear();
    this.prefetchPromises.clear();
    console.log(`Cleared all ${size} cached frames`);
  }

  /**
   * Remove frames older than specified timestamp
   */
  removeOldFrames(domain, product, oldestTimestamp) {
    const domainName = domain?.codName || domain;
    const productName = product?.codName || product?.number?.toString() || product;
    const prefix = `${domainName}_${productName}_`;

    let removed = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        const timestamp = key.split('_').pop();
        if (timestamp < oldestTimestamp) {
          this.cache.delete(key);
          removed++;
        }
      }
    }

    if (removed > 0) {
      console.log(`Removed ${removed} old frames (before ${oldestTimestamp})`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const frameCache = new FrameCache();
