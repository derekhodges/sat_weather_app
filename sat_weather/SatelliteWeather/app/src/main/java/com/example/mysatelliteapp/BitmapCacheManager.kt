package com.example.mysatelliteapp

import android.graphics.Bitmap
import android.util.Log
import android.util.LruCache
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.lang.ref.WeakReference

/**
 * A memory-efficient bitmap cache that manages image lifecycle
 * to prevent premature garbage collection and memory leaks
 */
class BitmapCacheManager(maxMemoryPercentage: Float = 0.25f) {
    private val TAG = "BitmapCacheManager"

    // Calculate cache size based on available memory
    private val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
    private val cacheSize = (maxMemory * maxMemoryPercentage).toInt()

    // Strong references to actively used bitmaps
    private val bitmapCache = object : LruCache<String, Bitmap>(cacheSize) {
        override fun sizeOf(key: String, bitmap: Bitmap): Int {
            // Size in kilobytes
            return bitmap.byteCount / 1024
        }

        override fun entryRemoved(
            evicted: Boolean,
            key: String,
            oldValue: Bitmap,
            newValue: Bitmap?
        ) {
            if (evicted && !oldValue.isRecycled) {
                // Move to temporary cache before recycling
                temporaryCache[key] = WeakReference(oldValue)
                Log.d(TAG, "Moved bitmap to temporary cache: $key")
            }
        }
    }

    // Weak references to recently evicted bitmaps
    // This gives us a chance to recover them if they're needed again quickly
    private val temporaryCache = mutableMapOf<String, WeakReference<Bitmap>>()

    // Track which bitmaps are currently in use (being displayed)
    private val activeBitmaps = mutableSetOf<String>()

    // Mutex for thread safety
    private val mutex = Mutex()

    /**
     * Put a bitmap in the cache
     */
    suspend fun putBitmap(key: String, bitmap: Bitmap) {
        mutex.withLock {
            // Check if we already have this bitmap
            val existing = getBitmapLocked(key)
            if (existing != null && existing != bitmap) {
                // Don't store duplicate bitmaps
                if (!existing.isRecycled) {
                    Log.d(TAG, "Replacing existing bitmap for $key")
                }
            }

            // Store in main cache
            bitmapCache.put(key, bitmap)
            Log.d(TAG, "Added bitmap to cache: $key, Cache size: ${bitmapCache.size()}/${cacheSize}KB")
        }
    }

    /**
     * Mark a bitmap as active (being displayed)
     */
    suspend fun markActive(key: String) {
        mutex.withLock {
            activeBitmaps.add(key)

            // If it's in temp cache, move back to main cache
            val tempRef = temporaryCache[key]
            if (tempRef != null) {
                val bitmap = tempRef.get()
                if (bitmap != null && !bitmap.isRecycled) {
                    bitmapCache.put(key, bitmap)
                    temporaryCache.remove(key)
                    Log.d(TAG, "Recovered bitmap from temporary cache: $key")
                }
            }
        }
    }

    /**
     * Mark a bitmap as inactive (no longer displayed)
     */
    suspend fun markInactive(key: String) {
        mutex.withLock {
            activeBitmaps.remove(key)
        }
    }

    /**
     * Get a bitmap from the cache
     */
    suspend fun getBitmap(key: String): Bitmap? {
        return mutex.withLock {
            getBitmapLocked(key)
        }
    }

    /**
     * Get a bitmap while holding the lock (internal use)
     */
    private fun getBitmapLocked(key: String): Bitmap? {
        // First check main cache
        var bitmap = bitmapCache.get(key)

        // If not found, check temporary cache
        if (bitmap == null) {
            val tempRef = temporaryCache[key]
            if (tempRef != null) {
                bitmap = tempRef.get()
                if (bitmap != null && !bitmap.isRecycled) {
                    // Move back to main cache
                    bitmapCache.put(key, bitmap)
                    temporaryCache.remove(key)
                    Log.d(TAG, "Recovered bitmap from temporary cache: $key")
                }
            }
        }

        return bitmap
    }

    /**
     * Remove and recycle a bitmap from the cache
     */
    suspend fun removeBitmap(key: String) {
        mutex.withLock {
            // Remove from active list
            activeBitmaps.remove(key)

            // Remove from main cache
            val bitmap = bitmapCache.remove(key)

            // Remove from temporary cache
            val tempRef = temporaryCache.remove(key)
            val tempBitmap = tempRef?.get()

            // Recycle main bitmap if it exists and isn't already recycled
            if (bitmap != null && !bitmap.isRecycled) {
                bitmap.recycle()
                Log.d(TAG, "Recycled bitmap: $key")
            }

            // Recycle temp bitmap if it exists, isn't already recycled, and isn't the same as main
            if (tempBitmap != null && tempBitmap != bitmap && !tempBitmap.isRecycled) {
                tempBitmap.recycle()
            }
        }
    }

    /**
     * Checks if a bitmap exists in the cache
     */
    suspend fun containsBitmap(key: String): Boolean {
        return mutex.withLock {
            bitmapCache.get(key) != null || temporaryCache[key]?.get() != null
        }
    }

    /**
     * Clear all bitmaps from the cache
     */
    suspend fun clearCache() {
        mutex.withLock {
            // Clear active bitmaps list
            activeBitmaps.clear()

            // Get all bitmaps from main cache
            val bitmapsToRecycle = mutableListOf<Bitmap>()
            for (i in 0 until bitmapCache.size()) {
                val key = bitmapCache.snapshot().keys.elementAtOrNull(i) ?: continue
                val bitmap = bitmapCache.get(key)
                if (bitmap != null) {
                    bitmapsToRecycle.add(bitmap)
                }
            }

            // Clear main cache
            bitmapCache.evictAll()

            // Get all bitmaps from temporary cache
            for ((_, ref) in temporaryCache) {
                val bitmap = ref.get()
                if (bitmap != null) {
                    bitmapsToRecycle.add(bitmap)
                }
            }

            // Clear temporary cache
            temporaryCache.clear()

            // Recycle all bitmaps
            for (bitmap in bitmapsToRecycle) {
                if (!bitmap.isRecycled) {
                    bitmap.recycle()
                }
            }

            Log.d(TAG, "Cleared all bitmaps from cache")
        }
    }

    /**
     * Get cache statistics
     */
    suspend fun getCacheStats(): String {
        return mutex.withLock {
            "Cache: ${bitmapCache.size()}/${cacheSize}KB, " +
                    "Temp: ${temporaryCache.size}, " +
                    "Active: ${activeBitmaps.size}"
        }
    }
}