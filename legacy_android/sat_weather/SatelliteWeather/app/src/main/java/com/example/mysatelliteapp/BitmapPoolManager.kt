package com.example.mysatelliteapp

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import android.util.LruCache
import java.util.concurrent.ConcurrentHashMap

/**
 * Manages a pool of bitmaps to reduce allocations and prevent GC
 */
object BitmapPoolManager {
    private const val TAG = "BitmapPoolManager"

    // Calculate maximum memory to use (1/4 of available memory)
    private val maxMemory = Runtime.getRuntime().maxMemory() / 4

    // Track all active bitmaps to prevent them from being garbage collected
    private val activeBitmaps = ConcurrentHashMap<String, Bitmap>()

    // Cache for bitmap reuse
    private val inactiveBitmaps = ConcurrentHashMap<Int, MutableList<Bitmap>>()

    // Maximum number of bitmaps to keep in each size bucket
    private const val MAX_BITMAPS_PER_SIZE = 2

    /**
     * Create or get a bitmap from the pool
     */
    fun getBitmap(width: Int, height: Int, config: Bitmap.Config = Bitmap.Config.RGB_565): Bitmap {
        val key = getBucketKey(width, height)
        val list = inactiveBitmaps[key]

        // Try to reuse a bitmap of this size
        if (list != null && list.isNotEmpty()) {
            synchronized(list) {
                if (list.isNotEmpty()) {
                    try {
                        val bitmap = list.removeAt(list.size - 1)
                        if (!bitmap.isRecycled) {
                            // Clear the bitmap
                            bitmap.eraseColor(0)
                            Log.d(TAG, "Reused bitmap: $width x $height")
                            return bitmap
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error reusing bitmap: ${e.message}")
                    }
                }
            }
        }

        // Create a new bitmap if we couldn't reuse one
        try {
            Log.d(TAG, "Created new bitmap: $width x $height")
            return Bitmap.createBitmap(width, height, config)
        } catch (e: OutOfMemoryError) {
            // If we're out of memory, try to free some
            clearCaches()
            System.gc()

            // Try again with a smaller size if needed
            return try {
                Log.d(TAG, "Retrying with smaller bitmap after OOM")
                Bitmap.createBitmap(width / 2, height / 2, config)
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to create bitmap even after clearing caches", e2)
                // Last resort, create a very small bitmap
                Bitmap.createBitmap(10, 10, config)
            }
        }
    }

    /**
     * Mark a bitmap as active to prevent GC
     */
    fun markActive(key: String, bitmap: Bitmap) {
        if (bitmap.isRecycled) return

        val existing = activeBitmaps.put(key, bitmap)
        // Recycle previous bitmap if it's different
        if (existing != null && existing != bitmap && !existing.isRecycled) {
            // Instead of recycling, return it to the pool
            recycleBitmap(existing)
        }

        Log.d(TAG, "Marked active: $key (${bitmap.width}x${bitmap.height}), Active count: ${activeBitmaps.size}")
    }

    /**
     * Mark a bitmap as inactive
     */
    fun markInactive(key: String) {
        val bitmap = activeBitmaps.remove(key)
        if (bitmap != null && !bitmap.isRecycled) {
            // Return to pool instead of recycling
            returnBitmapToPool(bitmap)
            Log.d(TAG, "Marked inactive: $key, Active count: ${activeBitmaps.size}")
        }
    }

    /**
     * Return a bitmap to the pool for future reuse
     */
    private fun returnBitmapToPool(bitmap: Bitmap) {
        if (bitmap.isRecycled) return

        val key = getBucketKey(bitmap.width, bitmap.height)
        var list = inactiveBitmaps[key]

        if (list == null) {
            list = ArrayList()
            inactiveBitmaps[key] = list
        }

        synchronized(list) {
            // Only keep a certain number of bitmaps per size
            if (list.size < MAX_BITMAPS_PER_SIZE) {
                list.add(bitmap)
                Log.d(TAG, "Returned to pool: ${bitmap.width}x${bitmap.height}")
            } else {
                // Too many in this bucket, recycle it
                bitmap.recycle()
                Log.d(TAG, "Recycled (pool full): ${bitmap.width}x${bitmap.height}")
            }
        }
    }

    /**
     * Recycle a bitmap completely
     */
    fun recycleBitmap(bitmap: Bitmap) {
        if (!bitmap.isRecycled) {
            bitmap.recycle()
            Log.d(TAG, "Recycled bitmap: ${bitmap.width}x${bitmap.height}")
        }
    }

    /**
     * Get a bucket key for bitmap size
     */
    private fun getBucketKey(width: Int, height: Int): Int {
        // Round to nearest power of 2 to increase reuse chances
        val w = nearestPowerOf2(width)
        val h = nearestPowerOf2(height)
        return (w shl 16) or h
    }

    /**
     * Find nearest power of 2 for a number
     */
    private fun nearestPowerOf2(n: Int): Int {
        var v = n
        v--
        v = v or (v shr 1)
        v = v or (v shr 2)
        v = v or (v shr 4)
        v = v or (v shr 8)
        v = v or (v shr 16)
        v++
        return v
    }

    /**
     * Clear all caches
     */
    fun clearCaches() {
        // Don't recycle active bitmaps

        // Recycle inactive bitmaps
        for (list in inactiveBitmaps.values) {
            synchronized(list) {
                for (bitmap in list) {
                    if (!bitmap.isRecycled) {
                        bitmap.recycle()
                    }
                }
                list.clear()
            }
        }
        inactiveBitmaps.clear()

        Log.d(TAG, "Cleared bitmap caches, still active: ${activeBitmaps.size}")
    }

    /**
     * Get stats for debugging
     */
    fun getStats(): String {
        val activeBitmapCount = activeBitmaps.size
        var inactiveBitmapCount = 0

        for (list in inactiveBitmaps.values) {
            synchronized(list) {
                inactiveBitmapCount += list.size
            }
        }

        return "Bitmaps - Active: $activeBitmapCount, Pooled: $inactiveBitmapCount"
    }
}