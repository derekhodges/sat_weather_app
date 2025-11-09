package com.example.mysatelliteapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class ImageDataFetcher(private val context: Context) {
    private val TAG = "ImageDataFetcher"
    
    // Local test image path (Android-accessible location on device/emulator)
    private val localTestImagePath = "/sdcard/goes_19_conus/"
    
    // Future AWS image URL patterns
    private val awsImageBaseUrl = "https://your-aws-bucket.s3.amazonaws.com/goes-19/"
    
    /**
     * Load a satellite image for the given parameters
     * Currently uses local test images, will switch to AWS pre-processed images later
     */
    suspend fun loadSatelliteImage(
        domain: SatelliteDomain,
        channel: SatelliteChannel,
        timestamp: String? = null
    ): Bitmap? = withContext(Dispatchers.IO) {
        try {
            // For now, use local test images
            loadLocalTestImage(domain, channel)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load satellite image", e)
            null
        }
    }

    /**
     * Load an RGB composite image for the given parameters
     */
    suspend fun loadRGBImage(
        domain: SatelliteDomain,
        product: RGBProduct,
        region: String? = null,
        timestamp: String? = null
    ): Bitmap? = withContext(Dispatchers.IO) {
        try {
            loadLocalRGBImage(domain, product, region)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load RGB image", e)
            null
        }
    }
    
    /**
     * Load RGB composite image from local folder structure
     * Path pattern: /conus/geocolor/ or /conus/geocolor/wyoming/
     */
    private suspend fun loadLocalRGBImage(
        domain: SatelliteDomain,
        product: RGBProduct,
        region: String? = null
    ): Bitmap? = withContext(Dispatchers.IO) {
        try {
            // All RGB data is stored under conus folder structure
            val domainFolder = "conus"

            // Determine region: use explicit region param, or domain.id for regional domains
            val regionFolder = region ?: if (domain.isRegional) domain.id else null

            // Build path: /conus/geocolor/ or /conus/geocolor/southwest/
            val basePath = "$localTestImagePath$domainFolder/${product.folderName}/"
            val imagePath = if (regionFolder != null) {
                File("$basePath$regionFolder/")
            } else {
                File(basePath)
            }

            Log.d(TAG, "Looking for RGB images in: ${imagePath.absolutePath}")

            if (!imagePath.exists()) {
                Log.w(TAG, "RGB image directory doesn't exist: ${imagePath.absolutePath}")
                return@withContext null
            }

            // Find the most recent image file
            return@withContext loadMostRecentImageFromDirectory(imagePath, product, domainFolder, regionFolder)

        } catch (e: Exception) {
            Log.e(TAG, "Error loading local RGB image", e)
            null
        }
    }

    /**
     * Load the most recent RGB image from a directory
     * Expected filename pattern: GOES19_conus_geocolor_conus_20251106_183804.png
     */
    private fun loadMostRecentImageFromDirectory(
        directory: File,
        product: RGBProduct,
        domainFolder: String,
        region: String?
    ): Bitmap? {
        try {
            val imageFiles = directory.listFiles { file ->
                file.isFile && (
                    file.name.lowercase().endsWith(".png") ||
                    file.name.lowercase().endsWith(".jpg") ||
                    file.name.lowercase().endsWith(".jpeg")
                ) && (
                    file.name.lowercase().contains(product.folderName) ||
                    file.name.lowercase().contains(domainFolder)
                )
            }

            if (imageFiles.isNullOrEmpty()) {
                Log.w(TAG, "No RGB image files found in ${directory.absolutePath}")
                return null
            }

            // Get the most recently modified file
            val latestFile = imageFiles.maxByOrNull { it.lastModified() }

            Log.d(TAG, "Loading RGB image: ${latestFile?.name} (${latestFile?.lastModified()})")

            return latestFile?.let { loadBitmapFromFile(it) }

        } catch (e: Exception) {
            Log.e(TAG, "Error loading RGB image from directory", e)
            return null
        }
    }

    /**
     * Load test image from local Windows path
     */
    private suspend fun loadLocalTestImage(
        domain: SatelliteDomain,
        channel: SatelliteChannel
    ): Bitmap? = withContext(Dispatchers.IO) {
        try {
            // All channel data is stored under conus folder structure
            val domainFolder = "conus"

            val channelFolder = "channel_c${String.format("%02d", channel.number)}"

            // For regional domains, add region subfolder
            // For CONUS domain, files are directly in channel folder
            val basePath = "$localTestImagePath$domainFolder/$channelFolder/"
            val testImageDir = if (domain.isRegional) {
                // Regional domains: conus/channel_c13/southwest/
                File(basePath + domain.id + "/")
            } else if (domain == SatelliteDomain.CONUS) {
                // CONUS domain: conus/channel_c13/
                File(basePath)
            } else {
                // Other domains (full_disk, mesoscale) - not implemented yet
                File(basePath)
            }

            Log.d(TAG, "Looking for test images in: ${testImageDir.absolutePath}")

            if (!testImageDir.exists()) {
                Log.w(TAG, "Test image directory doesn't exist: ${testImageDir.absolutePath}")
                return@withContext null
            }

            return@withContext loadImageFromDirectory(testImageDir, channel.number)

        } catch (e: Exception) {
            Log.e(TAG, "Error loading local test image", e)
            null
        }
    }
    
    /**
     * Load the most recent image file from a directory
     */
    private fun loadImageFromDirectory(directory: File, channelNumber: Int): Bitmap? {
        try {
            val imageFiles = directory.listFiles { file ->
                file.isFile && (
                    file.name.lowercase().endsWith(".png") ||
                    file.name.lowercase().endsWith(".jpg") ||
                    file.name.lowercase().endsWith(".jpeg")
                ) && (
                    file.name.contains("channel_c${String.format("%02d", channelNumber)}") ||
                    file.name.contains("ch${String.format("%02d", channelNumber)}") ||
                    file.name.contains("_${channelNumber}_") ||
                    // If no channel-specific naming, just get any image
                    channelNumber == 13 // Default to any image for channel 13
                )
            }
            
            if (imageFiles.isNullOrEmpty()) {
                Log.w(TAG, "No suitable image files found in ${directory.absolutePath}")
                // Fallback: try to load any image file
                val anyImageFiles = directory.listFiles { file ->
                    file.isFile && (
                        file.name.lowercase().endsWith(".png") ||
                        file.name.lowercase().endsWith(".jpg") ||
                        file.name.lowercase().endsWith(".jpeg")
                    )
                }
                
                if (!anyImageFiles.isNullOrEmpty()) {
                    val latestFile = anyImageFiles.maxByOrNull { it.lastModified() }
                    Log.d(TAG, "Using fallback image: ${latestFile?.name}")
                    return loadBitmapFromFile(latestFile!!)
                }
                
                return null
            }
            
            // Get the most recently modified file
            val latestFile = imageFiles.maxByOrNull { it.lastModified() }
            
            Log.d(TAG, "Loading image: ${latestFile?.name}")
            
            return latestFile?.let { loadBitmapFromFile(it) }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error loading image from directory", e)
            return null
        }
    }
    
    /**
     * Load bitmap from file with error handling
     */
    private fun loadBitmapFromFile(file: File): Bitmap? {
        return try {
            FileInputStream(file).use { inputStream ->
                BitmapFactory.decodeStream(inputStream)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error decoding bitmap from file: ${file.name}", e)
            null
        }
    }
    
    /**
     * Future method to load images from AWS (not implemented yet)
     */
    private suspend fun loadAwsImage(
        domain: SatelliteDomain,
        channel: SatelliteChannel,
        timestamp: String
    ): Bitmap? = withContext(Dispatchers.IO) {
        // TODO: Implement AWS image loading
        // This will download pre-processed images from your AWS pipeline
        Log.d(TAG, "AWS image loading not yet implemented")
        null
    }
    
    /**
     * Get list of available timestamps for a domain/channel combination
     * Currently returns dummy data for local testing
     */
    suspend fun getAvailableTimestamps(
        domain: SatelliteDomain,
        channel: SatelliteChannel
    ): List<String> = withContext(Dispatchers.IO) {
        // For now, return dummy timestamps
        // Later this will query AWS for available pre-processed images
        val currentTime = System.currentTimeMillis()
        val timestamps = mutableListOf<String>()
        val dateFormat = SimpleDateFormat("yyyyMMdd_HHmm", Locale.US)
        dateFormat.timeZone = TimeZone.getTimeZone("UTC")
        
        // Generate dummy timestamps for the last 12 hours
        for (i in 0..48) {
            val time = currentTime - (i * 15 * 60 * 1000) // 15 minute intervals
            timestamps.add(dateFormat.format(Date(time)))
        }
        
        return@withContext timestamps
    }
    
    /**
     * Check if local test images are available
     */
    fun hasLocalTestImages(): Boolean {
        val testDir = File(localTestImagePath)
        return testDir.exists() && testDir.isDirectory
    }

    /**
     * Scan for available RGB products in the local folder structure
     * Returns a map of domain -> list of available RGB products
     */
    fun scanAvailableRGBProducts(): Map<SatelliteDomain, List<RGBProduct>> {
        val availableProducts = mutableMapOf<SatelliteDomain, MutableList<RGBProduct>>()

        try {
            val basePath = File(localTestImagePath)
            if (!basePath.exists()) {
                Log.w(TAG, "Base path doesn't exist: $localTestImagePath")
                return emptyMap()
            }

            // Scan each domain folder
            val domainMap = mapOf(
                "conus" to SatelliteDomain.CONUS,
                "full_disk" to SatelliteDomain.FULL_DISK,
                "mesoscale_1" to SatelliteDomain.MESOSCALE_1,
                "mesoscale_2" to SatelliteDomain.MESOSCALE_2
            )

            for ((folderName, domain) in domainMap) {
                val domainFolder = File(basePath, folderName)
                if (!domainFolder.exists()) continue

                // Check for each RGB product folder
                for (product in RGBProduct.values()) {
                    val productFolder = File(domainFolder, product.folderName)
                    if (productFolder.exists() && productFolder.isDirectory) {
                        // Check if there are any image files
                        val hasImages = productFolder.listFiles()?.any { file ->
                            file.isFile && (
                                file.name.lowercase().endsWith(".png") ||
                                file.name.lowercase().endsWith(".jpg") ||
                                file.name.lowercase().endsWith(".jpeg")
                            )
                        } ?: false

                        if (hasImages) {
                            availableProducts.getOrPut(domain) { mutableListOf() }.add(product)
                            Log.d(TAG, "Found ${product.displayName} for ${domain.displayName}")
                        }
                    }
                }
            }

            Log.d(TAG, "Scan complete: Found RGB products for ${availableProducts.size} domains")

        } catch (e: Exception) {
            Log.e(TAG, "Error scanning for RGB products", e)
        }

        return availableProducts
    }

    /**
     * Scan for available regions within an RGB product
     * Example: geocolor might have "wyoming", "texas", etc. subfolders
     */
    fun scanAvailableRegions(domain: SatelliteDomain, product: RGBProduct): List<String> {
        val regions = mutableListOf<String>()

        try {
            val domainFolder = when (domain) {
                SatelliteDomain.CONUS -> "conus"
                SatelliteDomain.FULL_DISK -> "full_disk"
                SatelliteDomain.MESOSCALE_1 -> "mesoscale_1"
                SatelliteDomain.MESOSCALE_2 -> "mesoscale_2"
                else -> "conus"
            }

            val productPath = File("$localTestImagePath$domainFolder/${product.folderName}/")
            if (!productPath.exists()) return emptyList()

            // List all subdirectories
            productPath.listFiles { file -> file.isDirectory }?.forEach { regionFolder ->
                val hasImages = regionFolder.listFiles()?.any { file ->
                    file.isFile && (
                        file.name.lowercase().endsWith(".png") ||
                        file.name.lowercase().endsWith(".jpg") ||
                        file.name.lowercase().endsWith(".jpeg")
                    )
                } ?: false

                if (hasImages) {
                    regions.add(regionFolder.name)
                    Log.d(TAG, "Found region: ${regionFolder.name} for ${product.displayName}")
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error scanning for regions", e)
        }

        return regions.sorted()
    }
}