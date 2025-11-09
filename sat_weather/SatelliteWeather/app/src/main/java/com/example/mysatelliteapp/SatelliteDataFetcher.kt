package com.example.mysatelliteapp

import android.util.Log
import com.amazonaws.ClientConfiguration
import com.amazonaws.auth.AWSCredentials
import com.amazonaws.regions.Region
import com.amazonaws.services.s3.AmazonS3Client
import com.amazonaws.services.s3.model.GetObjectRequest
import com.amazonaws.services.s3.model.ListObjectsV2Request
import com.amazonaws.services.s3.model.S3Object
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import kotlin.text.contains

class SatelliteDataFetcher {
    private val TAG = "SatelliteDataFetcher"

    // Configure client with improved timeouts and retry policy
    private val clientConfig = ClientConfiguration().apply {
        connectionTimeout = 30000 // 30 seconds
        socketTimeout = 60000 // 60 seconds
        maxErrorRetry = 5 // Retry up to 5 times
    }

    // Use AmazonS3Client with explicit null for AWSCredentials to ensure anonymous access
    private val s3Client = AmazonS3Client(null as AWSCredentials?, clientConfig)

    // THREDDS base URL for GOES-16 data
    private val threddsBaseUrl = "https://thredds.ucar.edu/thredds/catalog/satellite/goes/east/grb/ABI/CONUS"


    // Initialize client
    init {
        s3Client.setRegion(Region.getRegion("us-east-1"))
        s3Client.setEndpoint("s3.amazonaws.com")
    }

    /**
     * List mesoscale files directly from THREDDS
     */
    fun listMesoscaleFiles(domain: SatelliteDomain, channelNumber: Int): List<String> {
        val domainCode = if (domain == SatelliteDomain.MESOSCALE_1) "M1" else "M2"
        val channelStr = String.format("%02d", channelNumber)

        Log.d(TAG, "Listing mesoscale files for domain: ${domain.id}, channel: $channelNumber")

        try {
            // Try current directory first
            val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            val year = cal.get(Calendar.YEAR)
            val month = cal.get(Calendar.MONTH) + 1
            val day = cal.get(Calendar.DAY_OF_MONTH)
            val dateStr = String.format("%04d%02d%02d", year, month, day)

            var threddsUrl = "https://thredds.ucar.edu/thredds/catalog/satellite/goes/east/grb/ABI/" +
                    "${domain.pathName}/Channel${channelStr}/${dateStr}/catalog.html"

            Log.d(TAG, "Requesting THREDDS catalog: $threddsUrl")

            // Open connection to the catalog
            val url = URL(threddsUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 30000
            connection.readTimeout = 60000

            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                // Try today's date if current fails
                val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
                val year = cal.get(Calendar.YEAR)
                val month = cal.get(Calendar.MONTH) + 1
                val day = cal.get(Calendar.DAY_OF_MONTH)
                val dateStr = String.format("%04d%02d%02d", year, month, day)

                threddsUrl = "https://thredds.ucar.edu/thredds/catalog/satellite/goes/east/grb/ABI/" +
                        "${domain.pathName}/Channel${channelStr}/${dateStr}/catalog.html"

                Log.d(TAG, "Trying date-based catalog: $threddsUrl")

                // Try the date-based URL
                val dateUrl = URL(threddsUrl)
                val dateConnection = dateUrl.openConnection() as HttpURLConnection
                dateConnection.connectTimeout = 30000
                dateConnection.readTimeout = 60000

                if (dateConnection.responseCode != HttpURLConnection.HTTP_OK) {
                    Log.e(TAG, "Failed to get THREDDS catalog: HTTP ${dateConnection.responseCode}")
                    return emptyList()
                }

                // Read the catalog HTML
                val catalogHtml = dateConnection.inputStream.bufferedReader().use { it.readText() }

                // More flexible regex pattern for all channels
                val fileRegex = "OR_ABI-L1b-RadM\\d-M\\dC0*${channelNumber}_G19_s\\d+_e\\d+_c\\d+\\.nc".toRegex()
                val matches = fileRegex.findAll(catalogHtml)

                val files = matches.map { it.value }.toList().distinct()

                // Sort by timestamp (descending) and take most recent 5
                val sortedFiles = files.sortedByDescending {
                    val timeRegex = "_s(\\d+)_".toRegex()
                    timeRegex.find(it)?.groupValues?.get(1) ?: ""
                }.take(5)

                Log.d(TAG, "Found ${sortedFiles.size} mesoscale files")

                // Create proper NCSS URLs - CHANGED to include /grid/
                return sortedFiles.map { filename ->
                    "https://thredds.ucar.edu/thredds/ncss/grid/satellite/goes/east/grb/ABI/" +
                            "${domain.pathName}/Channel${channelStr}/${dateStr}/${filename}"
                }
            }

            // Process the current directory catalog
            val catalogHtml = connection.inputStream.bufferedReader().use { it.readText() }

            // More flexible regex pattern for all channels
            val fileRegex = "OR_ABI-L1b-RadM\\d-M\\dC0*${channelNumber}_G19_s\\d+_e\\d+_c\\d+\\.nc".toRegex()
            val matches = fileRegex.findAll(catalogHtml)

            val files = matches.map { it.value }.toList().distinct()

            // Sort by timestamp (descending) and take most recent 5
            val sortedFiles = files.sortedByDescending {
                val timeRegex = "_s(\\d+)_".toRegex()
                timeRegex.find(it)?.groupValues?.get(1) ?: ""
            }.take(5)

            Log.d(TAG, "Found ${sortedFiles.size} mesoscale files")

            // Create proper NCSS URLs - CHANGED to include /grid/
            return sortedFiles.map { filename ->
                "https://thredds.ucar.edu/thredds/ncss/grid/satellite/goes/east/grb/ABI/" +
                        "${domain.pathName}/Channel${channelStr}/current/${filename}"
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching mesoscale files: ${e.message}")
            return emptyList()
        }
    }

    /**
     * Download a mesoscale file using THREDDS NCSS
     */
    fun fetchMesoscaleFile(ncssUrl: String, outputFile: File): Boolean {
        Log.d(TAG, "Downloading mesoscale file using NCSS: $ncssUrl")

        try {
            // Make parent directory if needed
            outputFile.parentFile?.mkdirs()

            // Remove any existing file
            if (outputFile.exists()) {
                outputFile.delete()
            }

            // Replace 'ncss/satellite' with 'ncss/grid/satellite' if needed
            val correctedUrl = if (!ncssUrl.contains("/grid/")) {
                ncssUrl.replace("/ncss/satellite/", "/ncss/grid/satellite/")
            } else {
                ncssUrl
            }

            // From the example URL, add parameters
            val fullUrl = "$correctedUrl?var=Rad&north=60&west=-140&east=-50&south=15&horizStride=1&vertStride=1&accept=netcdf4-classic&addLatLon=true"

            Log.d(TAG, "Full NCSS URL: $fullUrl")

            // Open connection
            val url = URL(fullUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 30000
            connection.readTimeout = 60000
            connection.requestMethod = "GET"

            // Check if successful
            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.e(TAG, "NCSS download failed: HTTP $responseCode")
                return false
            }

            // Download the file
            val inputStream = connection.inputStream

            outputFile.outputStream().use { output ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalRead = 0

                while (inputStream.read(buffer).also { bytesRead = it } > 0) {
                    output.write(buffer, 0, bytesRead)
                    totalRead += bytesRead
                }

                Log.d(TAG, "Downloaded $totalRead bytes from NCSS")
            }

            // Close connection
            inputStream.close()
            connection.disconnect()

            // Verify download
            if (!outputFile.exists() || outputFile.length() == 0L) {
                Log.e(TAG, "Downloaded file is empty or missing")
                return false
            }

            Log.d(TAG, "Successfully downloaded mesoscale file: ${outputFile.length()} bytes")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error downloading mesoscale file: ${e.message}")
            return false
        }
    }

    fun fetchRegionalData(filePath: String, outputFile: File, region: Array<Float>): Boolean {
        Log.d(TAG, "Fetching regional data for bounds: ${region[0]},${region[1]},${region[2]},${region[3]}")

        try {
            // Make parent directory if needed
            outputFile.parentFile?.mkdirs()

            // Remove any existing file
            if (outputFile.exists()) {
                outputFile.delete()
            }

            // Extract filename from the path
            val fileName = filePath.substring(filePath.lastIndexOf('/') + 1)

            // Extract channel number from filename
            val channelMatch = "C(\\d+)_G19".toRegex().find(fileName)
            val channel = channelMatch?.groupValues?.get(1)?.padStart(2, '0') ?: "13"

            // Create the base URL for THREDDS NCSS
            val ncssBaseUrl = "https://thredds.ucar.edu/thredds/ncss/grid/satellite/goes/east/grb/ABI/CONUS"

            // Construct URL for current data, this more closely matches the server structure
            val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            val year = cal.get(Calendar.YEAR)
            val month = cal.get(Calendar.MONTH) + 1
            val day = cal.get(Calendar.DAY_OF_MONTH)
            val dateStr = String.format("%04d%02d%02d", year, month, day)

            val fullUrl = "$ncssBaseUrl/Channel$channel/${dateStr}/$fileName" +
                    "?var=Rad" +
                    "&north=${region[1]}" +    // maxLat
                    "&west=${region[2]}" +     // minLon
                    "&east=${region[3]}" +     // maxLon
                    "&south=${region[0]}" +    // minLat
                    "&horizStride=1&vertStride=1" +
                    "&accept=netcdf4-classic&addLatLon=true"

            Log.d(TAG, "Regional NCSS URL: $fullUrl")

            // Open connection
            val url = URL(fullUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 30000
            connection.readTimeout = 60000
            connection.requestMethod = "GET"

            // Check if successful
            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.e(TAG, "Regional download failed: HTTP $responseCode")

                // Try alternative URL format if first attempt fails
                val altUrl = "$ncssBaseUrl/Channel$channel/$fileName" +
                        "?var=Rad" +
                        "&north=${region[1]}" +
                        "&west=${region[2]}" +
                        "&east=${region[3]}" +
                        "&south=${region[0]}" +
                        "&horizStride=1&vertStride=1" +
                        "&accept=netcdf4-classic&addLatLon=true"

                Log.d(TAG, "Trying alternative URL: $altUrl")

                val altConnection = URL(altUrl).openConnection() as HttpURLConnection
                altConnection.connectTimeout = 30000
                altConnection.readTimeout = 60000
                altConnection.requestMethod = "GET"

                if (altConnection.responseCode != HttpURLConnection.HTTP_OK) {
                    Log.e(TAG, "Alternative regional download failed: HTTP ${altConnection.responseCode}")
                    return false
                }

                // Download the file from alternative URL
                downloadFile(altConnection, outputFile)
                altConnection.disconnect()
            } else {
                // Download the file
                downloadFile(connection, outputFile)
                connection.disconnect()
            }

            // Verify download
            if (!outputFile.exists() || outputFile.length() == 0L) {
                Log.e(TAG, "Downloaded file is empty or missing")
                return false
            }

            Log.d(TAG, "Successfully downloaded regional data: ${outputFile.length()} bytes")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error downloading regional data: ${e.message}")
            return false
        }
    }

    // Helper function to download file from connection
    private fun downloadFile(connection: HttpURLConnection, outputFile: File) {
        val inputStream = connection.inputStream
        outputFile.outputStream().use { output ->
            val buffer = ByteArray(8192)
            var bytesRead: Int
            var totalRead = 0

            while (inputStream.read(buffer).also { bytesRead = it } > 0) {
                output.write(buffer, 0, bytesRead)
                totalRead += bytesRead
            }

            Log.d(TAG, "Downloaded $totalRead bytes for regional data")
        }
        inputStream.close()
    }

    /**
     * Fetch a file with subsetting when possible (for high-res channels)
     * Uses THREDDS for subsetting or S3 as fallback
     */
    fun fetchFile(bucket: String, key: String, outputFile: File, domain: SatelliteDomain, needsMapping: Boolean = false): Boolean {
        // Check if this is a channel that would benefit from subsetting
        val isHighResChannel = isHighResolutionChannel(key)
        val isMesoscale = domain == SatelliteDomain.MESOSCALE_1 || domain == SatelliteDomain.MESOSCALE_2

        Log.d(TAG, "Fetching file: $key (high-res channel: $isHighResChannel, mesoscale: $isMesoscale, needsMapping: $needsMapping)")

        // For mesoscale, always go direct to S3
        if (isMesoscale) {
            return fetchFromS3(bucket, key, outputFile)
        }

        // If mapping is needed, always use THREDDS
        if (needsMapping) {
            val success = fetchSubsettedFile(key, outputFile, domain)
            if (success) {
                return true
            }
            // If THREDDS fails, fall back to S3
            Log.d(TAG, "THREDDS with mapping failed, falling back to S3")
        }

        // Attempt THREDDS subsetting for high-res channels in other domains
        if (isHighResChannel) {
            val success = fetchSubsettedFile(key, outputFile, domain)
            if (success) {
                return true
            }
            // If THREDDS fails, fall back to S3
            Log.d(TAG, "THREDDS subsetting failed, falling back to S3")
        }

        // Use direct S3 download as fallback
        return fetchFromS3(bucket, key, outputFile)
    }

    /**
     * Check if this is a high-resolution channel (1-6)
     */
    private fun isHighResolutionChannel(key: String): Boolean {
        // Check for channel markers in the file name
        for (i in 1..6) {
            if (key.contains("C0${i}_G19") || key.contains("-M6C0${i}_G19")) {
                return true
            }
        }
        return false
    }

    private fun getThreddsBaseUrl(domain: SatelliteDomain): String {
        return "https://thredds.ucar.edu/thredds/catalog/satellite/goes/east/grb/ABI/${domain.pathName}"
    }

    /**
     * Calculate appropriate downsampling factor based on domain and channel
     */
    private fun calculateDownsampleFactor(domain: SatelliteDomain, channelNumber: Int): Int {
        // Start with domain's default downsample factor
        var factor = domain.downsampleFactor

        // Adjust based on channel resolution (channels 1-6 are higher resolution)
        if (channelNumber <= 6) {
            factor *= 2
        }

        // Full disk needs more aggressive downsampling
        if (domain == SatelliteDomain.FULL_DISK) {
            factor *= 2
        }

        return factor
    }

    /**
     * Fetch a subsetted file using THREDDS NetCDF Subset Service
     */
    fun fetchSubsettedFile(key: String, outputFile: File, domain: SatelliteDomain): Boolean {
        // Extract channel number from key
        val channelRegex = "C(\\d+)_G19".toRegex()
        val channelMatch = channelRegex.find(key)
        val channel = channelMatch?.groupValues?.get(1) ?: return false

        // Parse filename from the key
        val fileNameRegex = "OR_.*\\.nc".toRegex()
        val fileNameMatch = fileNameRegex.find(key)
        val fileName = fileNameMatch?.value ?: return false

        // Use CONUS base path for all domains - this is the key change
        val channelPath = "Channel$channel"

        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH) + 1
        val day = cal.get(Calendar.DAY_OF_MONTH)
        val dateStr = String.format("%04d%02d%02d", year, month, day)

        val ncssBaseUrl = "https://thredds.ucar.edu/thredds/ncss/grid/satellite/goes/east/grb/ABI/CONUS/${channelPath}/${dateStr}/${fileName}"

        Log.d(TAG, "NCSS base URL: $ncssBaseUrl")

        // Calculate appropriate downsampling factor
        val downsampleFactor = when {
            domain == SatelliteDomain.FULL_DISK -> 1
            domain == SatelliteDomain.CONUS -> 1
            domain.isRegional -> 1
            else -> 16
        } * (if (channel.toInt() <= 6) 2 else 1)

        // Set geographic bounds based on domain
        val bounds = when (domain) {
            SatelliteDomain.FULL_DISK -> {
                // Use wide bounds but not global
                arrayOf(10.0f, 60.0f, -150.0f, -50.0f)
            }
            SatelliteDomain.CONUS -> {
                // Standard CONUS bounds
                arrayOf(20.0f, 50.0f, -130.0f, -65.0f)
            }
            else -> {
                // For regional domains, use their defined bounds
                domain.regionBounds ?: arrayOf(20.0f, 50.0f, -130.0f, -65.0f)
            }
        }

        // File handling code
        outputFile.parentFile?.mkdirs()
        if (outputFile.exists()) {
            outputFile.delete()
        }

        try {
            // Build URL with bounds parameters
            val ncssUrl = ncssBaseUrl.plus(
                "?var=Rad" +
                        "&north=${bounds[1]}" +
                        "&west=${bounds[2]}" +
                        "&east=${bounds[3]}" +
                        "&south=${bounds[0]}" +
                        "&horizStride=$downsampleFactor" +
                        "&vertStride=$downsampleFactor" +
                        "&addLatLon=true" +
                        "&accept=netcdf4-classic"
            )

            Log.d(TAG, "Complete NCSS URL: $ncssUrl")

            // Connection code
            val url = URL(ncssUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 30000
            connection.readTimeout = 60000
            connection.requestMethod = "GET"

            // Check response
            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.e(TAG, "THREDDS error: HTTP $responseCode")
                return false
            }

            // Download file
            val inputStream = connection.inputStream
            outputFile.outputStream().use { output ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalRead = 0

                while (inputStream.read(buffer).also { bytesRead = it } > 0) {
                    output.write(buffer, 0, bytesRead)
                    totalRead += bytesRead
                }

                Log.d(TAG, "Downloaded $totalRead bytes from THREDDS")
            }

            // Cleanup
            inputStream.close()
            connection.disconnect()

            // Verify download
            if (!outputFile.exists() || outputFile.length() == 0L) {
                Log.e(TAG, "Downloaded file is empty or missing")
                return false
            }

            Log.d(TAG, "Successfully downloaded from THREDDS: ${outputFile.length()} bytes")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error fetching from THREDDS: ${e.message}")
            return false
        }
    }

    /**
     * Fallback method to fetch from S3 directly
     */
    private fun fetchFromS3(bucket: String, key: String, outputFile: File): Boolean {
        Log.d(TAG, "Fetching from S3: $bucket/$key")

        // Make parent directory if needed
        outputFile.parentFile?.mkdirs()

        // Remove any existing file
        if (outputFile.exists()) {
            outputFile.delete()
        }

        var attempt = 1
        var success = false

        while (attempt <= 3 && !success) {
            var s3Object: S3Object? = null
            var inputStream: InputStream? = null

            try {
                Log.d(TAG, "S3 download attempt $attempt for $key")

                // Get the S3 object
                val request = GetObjectRequest(bucket, key)
                s3Object = s3Client.getObject(request)

                // Get file size
                val fileSize = s3Object.objectMetadata.contentLength
                Log.d(TAG, "S3 file size: $fileSize bytes")

                // Get the input stream
                inputStream = s3Object.objectContent

                // Save to file
                outputFile.outputStream().use { output ->
                    val buffer = ByteArray(8192)
                    var readBytes = 0
                    var totalBytes = 0L

                    while (true) {
                        readBytes = inputStream.read(buffer)
                        if (readBytes <= 0) break

                        output.write(buffer, 0, readBytes)
                        totalBytes += readBytes
                    }

                    Log.d(TAG, "Downloaded $totalBytes bytes from S3")
                }

                // Verify file
                if (outputFile.exists() && outputFile.length() > 0) {
                    Log.d(TAG, "S3 download successful: ${outputFile.length()} bytes")
                    success = true
                } else {
                    Log.e(TAG, "S3 download failed: File empty or missing")
                }

            } catch (e: Exception) {
                Log.e(TAG, "Error in S3 download attempt $attempt: ${e.message}")
            } finally {
                // Clean up resources
                try { inputStream?.close() } catch (e: Exception) {}
                try { s3Object?.close() } catch (e: Exception) {}

                // Retry if failed
                if (!success && attempt < 3) {
                    Thread.sleep(1000L * attempt)
                }

                attempt++
            }
        }

        return success
    }

    /**
     * List files in S3 bucket (we still use S3 for listing)
     */
    fun listFiles(bucket: String, prefix: String, domain: SatelliteDomain): List<String> {
        Log.d(TAG, "Listing files with prefix: $prefix in bucket: $bucket for domain: ${domain.id}")


        val allObjects = mutableListOf<String>()
        var continuationToken: String? = null

        // Implement retry logic
        for (attempt in 1..3) {
            try {
                var objectsRetrieved = false

                do {
                    val request = ListObjectsV2Request()
                        .withBucketName(bucket)
                        .withPrefix(prefix)
                        .withContinuationToken(continuationToken)
                        .withMaxKeys(1000) // Maximum allowed by S3
                        .withFetchOwner(false) // Skip owner info for efficiency

                    val result = s3Client.listObjectsV2(request)
                    objectsRetrieved = true

                    // Add all object keys to our result list
                    allObjects.addAll(result.objectSummaries.map { it.key })

                    // Update continuation token for next request
                    continuationToken = result.nextContinuationToken

                    // Continue until we've processed all objects or we have enough
                    if (allObjects.size >= 50) break
                } while (result.isTruncated)

                // If we successfully retrieved objects, we can break the retry loop
                if (objectsRetrieved) break

            } catch (e: Exception) {
                Log.e(TAG, "Error listing files (attempt $attempt/3): $prefix", e)
                if (attempt == 3) return emptyList() // Return empty list after final attempt

                // Exponential backoff between retries
                Thread.sleep(attempt * 1000L)
            }
        }

        val domainCode = when(domain) {
            SatelliteDomain.FULL_DISK -> "RadF"
            SatelliteDomain.CONUS -> "RadC"
            SatelliteDomain.MESOSCALE_1 -> "RadM1"
            SatelliteDomain.MESOSCALE_2 -> "RadM2"
            else -> "RadC"  // Regional views use CONUS data
        }

        val ncFiles = allObjects.filter { it.endsWith(".nc") && it.contains(domainCode) }

        // Debug all NC files found
        Log.d(TAG, "Found ${ncFiles.size} .nc files in $bucket/$prefix for domain ${domain.id}")

        // Show sample filenames for debugging
        if (ncFiles.isNotEmpty()) {
            Log.d(TAG, "Sample files: ${ncFiles.take(3).joinToString()}")
        }

        return ncFiles
    }

    /**
     * Helper method to parse timestamp from filename
     */
    fun parseS3ObjectDate(key: String): String? {
        // GOES-16 filenames follow a pattern like: OR_ABI-L1b-RadC-M6C13_G19_s20230011206174_e20230011208550_c20230011209005.nc
        val regex = "_s(\\d{14})".toRegex()
        val match = regex.find(key)
        return match?.groupValues?.get(1)
    }
}