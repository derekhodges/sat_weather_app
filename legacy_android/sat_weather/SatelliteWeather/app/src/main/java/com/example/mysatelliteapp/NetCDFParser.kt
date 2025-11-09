package com.example.mysatelliteapp

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.Log
import com.google.gson.JsonArray
import ucar.nc2.NetcdfFile
import ucar.nc2.Variable
import java.io.File
import java.io.FileOutputStream
import kotlin.math.pow
import kotlin.system.measureTimeMillis
import android.graphics.Path

class NetCDFParser {
    private val TAG = "NetCDFParser"

    // Cache for min/max values by file to avoid recalculation when visualization changes
    private val rangeCache = mutableMapOf<String, Pair<Float, Float>>()

    // Cache for color mapping to avoid recalculations
    private val colorMapCache = mutableMapOf<VisualizationMethod, IntArray>()

    // Data class to store the mapping information
    // In NetCDFParser.kt
    data class CoordinateMapping(
        val latGrid: Array<FloatArray>,   // 2D grid of latitudes
        val lonGrid: Array<FloatArray>    // 2D grid of longitudes
    ) {
        // Basic information about this mapping
        private val gridHeight = latGrid.size
        private val gridWidth = if (gridHeight > 0) latGrid[0].size else 0
        private var debugPrinted = false
        // Cache grid bounds for faster checks
        private var minLat: Float = latGrid.minOf { it.minOf { v -> v } }
        private var maxLat: Float = latGrid.maxOf { it.maxOf { v -> v } }
        private var minLon: Float = lonGrid.minOf { it.minOf { v -> v } }
        private var maxLon: Float = lonGrid.maxOf { it.maxOf { v -> v } }
        private var boundsCalculated = false
        private var debugCount = 0

        init {
            // Log info about this mapping when created
            Log.d("NetCDFParser", "Created CoordinateMapping: ${gridWidth}x${gridHeight} grid")
            Log.d("NetCDFParser", "Bounds: lat[$minLat, $maxLat], lon[$minLon, $maxLon]")
        }

        /**
         * Maps a geographic coordinate (lat/lon) to pixel coordinates on the image
         *
         * @param lat Latitude in degrees
         * @param lon Longitude in degrees
         * @param imageWidth Width of the target image in pixels
         * @param imageHeight Height of the target image in pixels
         * @return Pair of (x,y) pixel coordinates, or null if outside grid bounds
         */

        fun mapToPixel(lat: Double, lon: Double, imageWidth: Int, imageHeight: Int): Pair<Float, Float>? {
            try {
                // Quick bounds check
                if (lat < 15.0 || lat > 60.0 || lon < -160.0 || lon > -60.0) {
                    return null // Outside CONUS extended bounds
                }

                // For each point in the grid, find the closest valid point
                var bestDistance = Double.MAX_VALUE
                var bestX = -1
                var bestY = -1

                // Sample the grid (checking every point would be too slow)
                val sampleStep = 5

                for (y in 0 until latGrid.size step sampleStep) {
                    for (x in 0 until latGrid[0].size step sampleStep) {
                        val gridLat = latGrid[y][x]
                        val gridLon = lonGrid[y][x]

                        // Skip NaN values
                        if (gridLat.isNaN() || gridLon.isNaN()) continue

                        // Calculate distance
                        val dLat = lat - gridLat
                        val dLon = lon - gridLon
                        val distance = dLat * dLat + dLon * dLon

                        if (distance < bestDistance) {
                            bestDistance = distance
                            bestY = y
                            bestX = x
                        }
                    }
                }

                // If we found a valid point
                if (bestX >= 0 && bestY >= 0) {
                    // Convert grid coordinates to image coordinates
                    val x = (bestX.toFloat() / latGrid[0].size.toFloat()) * imageWidth
                    val y = (bestY.toFloat() / latGrid.size.toFloat()) * imageHeight
                    return Pair(x, y)
                }

                return null
            } catch (e: Exception) {
                Log.e("CoordinateMapping", "Error in mapToPixel: ${e.message}")
                return null
            }
        }

        private fun calculateGridBounds() {
            val gridHeight = latGrid.size
            val gridWidth = latGrid[0].size

            var min_lat = Float.MAX_VALUE
            var max_lat = -Float.MAX_VALUE
            var min_lon = Float.MAX_VALUE
            var max_lon = -Float.MAX_VALUE

            // Sample grid at sparse intervals for performance
            val sampleStep = Math.max(1, Math.min(gridHeight, gridWidth) / 20)

            for (i in 0 until gridHeight step sampleStep) {
                for (j in 0 until gridWidth step sampleStep) {
                    val lat = latGrid[i][j]
                    val lon = lonGrid[i][j]

                    if (!lat.isNaN() && !lon.isNaN()) {
                        min_lat = Math.min(min_lat, lat)
                        max_lat = Math.max(max_lat, lat)
                        min_lon = Math.min(min_lon, lon)
                        max_lon = Math.max(max_lon, lon)
                    }
                }
            }

            // Store for reuse
            minLat = min_lat
            maxLat = max_lat
            minLon = min_lon
            maxLon = max_lon
        }

        private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            // Direct Euclidean distance in coordinate space
            val dLat = lat1 - lat2
            val dLon = lon1 - lon2

            // Log the first few distance calculations with details
            if (debugCount < 5) {
                Log.d("CoordinateMapping", "DISTANCE CALC #$debugCount")
                Log.d("CoordinateMapping", "  Point: ($lat1, $lon1)")
                Log.d("CoordinateMapping", "  Grid: ($lat2, $lon2)")
                Log.d("CoordinateMapping", "  Diff: ($dLat, $dLon)")
                Log.d("CoordinateMapping", "  Distance: ${dLat * dLat + dLon * dLon}")
                debugCount++
            }

            return dLat * dLat + dLon * dLon
        }

        /**
         * Debug method to test mapping a set of known coordinates
         */
        fun testMapping(imageWidth: Int, imageHeight: Int) {
            // Test some known geographic locations
            val testPoints = listOf(
                Triple("New York", 40.7128, -74.0060),
                Triple("Los Angeles", 34.0522, -118.2437),
                Triple("Miami", 25.7617, -80.1918),
                Triple("Seattle", 47.6062, -122.3321),
                Triple("Kansas City", 39.0997, -94.5786)
            )

            Log.d("NetCDFParser", "Testing CoordinateMapping on ${testPoints.size} test points:")

            for ((name, testLat, testLon) in testPoints) {
                val pixelCoords = mapToPixel(testLat, testLon, imageWidth, imageHeight)
                if (pixelCoords != null) {
                    val (x, y) = pixelCoords
                    Log.d("NetCDFParser", "- $name (${testLat}, ${testLon}) mapped to pixel ($x, $y)")
                } else {
                    Log.d("NetCDFParser", "- $name (${testLat}, ${testLon}) is OUTSIDE the grid")
                }
            }
        }

        // Need to override equals and hashCode for data class with arrays
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (javaClass != other?.javaClass) return false

            other as CoordinateMapping

            if (!latGrid.contentDeepEquals(other.latGrid)) return false
            if (!lonGrid.contentDeepEquals(other.lonGrid)) return false

            return true
        }

        override fun hashCode(): Int {
            var result = latGrid.contentDeepHashCode()
            result = 31 * result + lonGrid.contentDeepHashCode()
            return result
        }
    }

    /**
     * Analyze NetCDF structure and attempt multiple reading strategies
     */
    fun directNetCDFToImage(inputFile: File, outputFile: File, downsampleFactor: Int, visualizationMethod: VisualizationMethod): Boolean {
        var ncFile: NetcdfFile? = null

        try {
            Log.d(TAG, "Starting NetCDF analysis and data extraction")
            outputFile.parentFile?.mkdirs()

            // Open NetCDF file
            ncFile = NetcdfFile.open(inputFile.absolutePath)

            // Analyze file structure
            val variables = ncFile.variables
            Log.d(TAG, "NetCDF variables: " + variables.joinToString { "${it.shortName}(${it.dataType})" })

            // Find Rad variable
            val radVar = ncFile.findVariable("Rad")
            if (radVar == null) {
                Log.e(TAG, "Could not find Rad variable")
                return createGradientImage(outputFile, 312, 187, visualizationMethod)
            }

            // Analyze Rad variable in detail
            Log.d(TAG, "Rad variable details: ${radVar.dataType}, shape: ${radVar.shape.contentToString()}")
            Log.d(TAG, "Dimensions: " + radVar.dimensions.joinToString { "${it.name}=${it.length}" })

            // Special handling for mesoscale data (different format)
            val isMesoscale = ncFile.findVariable("y")?.dataType?.toString()?.contains("float") == true
            if (isMesoscale) {
                Log.d(TAG, "Processing mesoscale format file")

                // Get dimensions
                val shape = radVar.shape
                val height = shape[0]
                val width = shape[1]

                // Mesoscale files from NCSS have a different data range and structure
                val dataArray = radVar.read()

                // Find actual min/max values
                var min = Float.MAX_VALUE
                var max = Float.MIN_VALUE

                for (i in 0 until dataArray.getSize().toInt() step 100) { // Sample every 100th point
                    try {
                        val value = dataArray.getFloat(i)
                        if (value.isFinite() && !value.isNaN()) {
                            min = min.coerceAtMost(value)
                            max = max.coerceAtLeast(value)
                        }
                    } catch (e: Exception) {
                        // Skip errors
                    }
                }

                // Default range if we didn't get good values
                if (min >= max || !min.isFinite() || !max.isFinite()) {
                    min = 0f
                    max = 100f
                }

                Log.d(TAG, "Mesoscale data range: $min to $max")

                // Create output bitmap with proper dimensions
                val outWidth = width / downsampleFactor
                val outHeight = height / downsampleFactor
                val bitmap = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.RGB_565)

                // Process the data
                for (y in 0 until outHeight) {
                    for (x in 0 until outWidth) {
                        try {
                            val origY = y * downsampleFactor
                            val origX = x * downsampleFactor

                            // Calculate index in the data array - fix for ambiguity error
                            val index = (origY.toInt() * width.toInt()) + origX.toInt()

                            // Get data value
                            val value = if (index < dataArray.getSize().toInt()) {
                                dataArray.getFloat(index)
                            } else {
                                0f // Default value
                            }

                            // Normalize and apply color
                            val normalizedValue = if (value.isFinite() && !value.isNaN()) {
                                ((value - min) / (max - min)).coerceIn(0f, 1f)
                            } else {
                                0f
                            }

                            bitmap.setPixel(x, y, applyColorMap(normalizedValue, visualizationMethod))
                        } catch (e: Exception) {
                            // Skip errors for individual pixels
                            bitmap.setPixel(x, y, Color.BLACK)
                        }
                    }
                }

                // Save bitmap
                outputFile.outputStream().use { out ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                }

                // Clean up
                bitmap.recycle()

                return true
            }

            // Create bitmap based on dimensions
            val shape = radVar.shape
            val height = shape[0]
            val width = shape[1]
            val outHeight = height / 8
            val outWidth = width / 8

            // Create bitmap
            val bitmap = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.RGB_565)

            // Try different strategies to read the data
            var readSuccess = false

            try {
                // STRATEGY 1: Try reading a section as an array
                Log.d(TAG, "Trying array section read strategy...")

                // Read a small section for testing
                val testOrigin = intArrayOf(0, 0)
                val testSize = intArrayOf(10, 10)
                val testData = radVar.read(testOrigin, testSize)

                Log.d(TAG, "Test section read successful! Data type: ${testData.dataType}, size: ${testData.size}")
                Log.d(TAG, "First few values: ${(0 until 5).map { testData.getFloat(it) }.joinToString()}")

                // If we get here, we can read sections successfully!
                readSuccess = true

                // Read the full data in sections
                val sectionHeight = 50  // Read in 50-row sections to avoid memory issues

                for (y in 0 until outHeight) {
                    val origY = y * 8

                    // Every 20 rows, read a section and process it
                    if (y % 20 == 0 || y == outHeight - 1) {
                        val currentHeight = minOf(20, outHeight - y)
                        val sectionOrigin = intArrayOf(origY, 0)
                        val sectionSize = intArrayOf(currentHeight * 8, width)

                        Log.d(TAG, "Reading section at y=$y (${y * 100 / outHeight}%)")

                        try {
                            val sectionData = radVar.read(sectionOrigin, sectionSize)

                            // Process this section
                            for (sectionY in 0 until currentHeight) {
                                for (x in 0 until outWidth) {
                                    val origX = x * 8

                                    // Calculate index in the section data
                                    val dataIndex = (sectionY * 8) * width + origX

                                    if (dataIndex < sectionData.getSize()) {
                                        // Get value and map to color
                                        val value = sectionData.getFloat(dataIndex)

                                        // Normalize between 300-4095 (typical GOES-16 range)
                                        val normalizedValue = ((value - 300f) / (4095f - 300f)).coerceIn(0f, 1f)

                                        // Apply color map
                                        bitmap.setPixel(x, y + sectionY, applyColorMap(normalizedValue, visualizationMethod))
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Error reading section at y=$y: ${e.message}")
                        }
                    }
                }

            } catch (e: Exception) {
                Log.e(TAG, "Strategy 1 failed: ${e.message}")

                // STRATEGY 2: Try reading the entire variable at once
                try {
                    Log.d(TAG, "Trying full variable read strategy...")

                    // This might cause memory issues but let's try
                    val allData = radVar.read()

                    Log.d(TAG, "Full read successful! Size: ${allData.getSize()}")

                    // If we get here, we can read the full array!
                    readSuccess = true

                    // Sample every 8th pixel in each dimension
                    for (y in 0 until outHeight) {
                        for (x in 0 until outWidth) {
                            val origY = y * 8
                            val origX = x * 8

                            // Calculate index in the full data array
                            val dataIndex = origY * width + origX

                            if (dataIndex < allData.getSize()) {
                                // Get value and map to color
                                val value = allData.getFloat(dataIndex)

                                // Normalize between 300-4095 (typical GOES-16 range)
                                val normalizedValue = ((value - 300f) / (4095f - 300f)).coerceIn(0f, 1f)

                                // Apply color map
                                bitmap.setPixel(x, y, applyColorMap(normalizedValue, visualizationMethod))
                            }
                        }

                        if (y % 20 == 0 || y == outHeight - 1) {
                            Log.d(TAG, "Processing full data: ${y * 100 / outHeight}%")
                        }
                    }

                } catch (e: Exception) {
                    Log.e(TAG, "Strategy 2 failed: ${e.message}")

                    // STRATEGY 3: Try reading individual pixels
                    try {
                        Log.d(TAG, "Trying individual pixel read strategy...")

                        // Test reading a single pixel
                        val origin = intArrayOf(0, 0)
                        val size = intArrayOf(1, 1)
                        val pixelData = radVar.read(origin, size)

                        Log.d(TAG, "Single pixel read successful: ${pixelData.getFloat(0)}")

                        // If we got here, we can read individual pixels!
                        readSuccess = true

                        // Sample some scattered pixels to create a sparse image
                        for (y in 0 until outHeight step 4) {
                            for (x in 0 until outWidth step 4) {
                                val origY = y * 8
                                val origX = x * 8

                                try {
                                    // Read this pixel
                                    val pixelOrigin = intArrayOf(origY, origX)
                                    val pixelSize = intArrayOf(1, 1)
                                    val pixelValue = radVar.read(pixelOrigin, pixelSize).getFloat(0)

                                    // Normalize and apply color map
                                    val normalizedValue = ((pixelValue - 300f) / (4095f - 300f)).coerceIn(0f, 1f)
                                    bitmap.setPixel(x, y, applyColorMap(normalizedValue, visualizationMethod))

                                    // Fill neighboring pixels with the same color for a blocky effect
                                    for (dy in 0 until 4) {
                                        for (dx in 0 until 4) {
                                            val fillY = y + dy
                                            val fillX = x + dx
                                            if (fillX < outWidth && fillY < outHeight) {
                                                bitmap.setPixel(fillX, fillY, applyColorMap(normalizedValue, visualizationMethod))
                                            }
                                        }
                                    }
                                } catch (e: Exception) {
                                    // Skip any errors for individual pixels
                                }
                            }

                            if (y % 20 == 0 || y == outHeight - 4) {
                                Log.d(TAG, "Processing sparse pixels: ${y * 100 / outHeight}%")
                            }
                        }

                    } catch (e: Exception) {
                        Log.e(TAG, "All read strategies failed: ${e.message}")
                    }
                }
            }

            // If all strategies failed, create a gradient
            if (!readSuccess) {
                bitmap.recycle()
                return createGradientImage(outputFile, outWidth, outHeight, visualizationMethod)
            }

            // Save the bitmap
            Log.d(TAG, "Saving actual data image...")
            outputFile.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }

            // Clean up
            bitmap.recycle()

            // Verify file
            if (!outputFile.exists() || outputFile.length() == 0L) {
                Log.e(TAG, "Failed to save image")
                return false
            }

            Log.d(TAG, "Successfully saved actual data image: ${outputFile.length()/1024}KB")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error analyzing NetCDF file: ${e.message}", e)
            return createGradientImage(outputFile, 312, 187, visualizationMethod)
        } finally {
            try {
                ncFile?.close()
            } catch (e: Exception) {
                Log.e(TAG, "Error closing NetCDF file: ${e.message}")
            }
        }
    }

    fun extractCoordinateMapping(ncFile: File): CoordinateMapping? {
        var netcdfFile: NetcdfFile? = null

        try {
            netcdfFile = NetcdfFile.open(ncFile.absolutePath)

            // First, try to find direct lat/lon variables
            var latVar = netcdfFile.findVariable("lat")
            var lonVar = netcdfFile.findVariable("lon")

            // If not found, look for alternative names
            if (latVar == null) latVar = netcdfFile.findVariable("latitude")
            if (lonVar == null) lonVar = netcdfFile.findVariable("longitude")

            if (latVar != null && lonVar != null) {
                // Direct lat/lon variables exist
                Log.d(TAG, "Found explicit lat/lon variables")
                return extractDirectMapping(latVar, lonVar)
            }

            // If no direct lat/lon, use the projection information
            val projVar = netcdfFile.findVariable("goes_imager_projection")
            if (projVar != null) {
                Log.d(TAG, "Found GOES projection information")
                return extractProjectionMapping(netcdfFile, projVar)
            }

            Log.e(TAG, "Could not find coordinate information")
            return null

        } catch (e: Exception) {
            Log.e(TAG, "Error extracting coordinate mapping: ${e.message}")
            return null
        } finally {
            netcdfFile?.close()
        }
    }

    // Extract mapping from direct lat/lon variables
    private fun extractDirectMapping(latVar: Variable, lonVar: Variable): CoordinateMapping {
        // Read the lat/lon arrays
        val latArray = latVar.read()
        val lonArray = lonVar.read()

        // Convert to 2D arrays if needed
        val latGrid: Array<FloatArray>
        val lonGrid: Array<FloatArray>

        if (latArray.rank == 1 && lonArray.rank == 1) {
            // 1D arrays - need to create a 2D grid
            val latValues = FloatArray(latArray.getSize().toInt()) { i -> latArray.getFloat(i) }
            val lonValues = FloatArray(lonArray.getSize().toInt()) { i -> lonArray.getFloat(i) }

            // Create 2D grids from 1D arrays
            val height = latValues.size
            val width = lonValues.size
            latGrid = Array(height) { y -> FloatArray(width) { x -> latValues[y] } }
            lonGrid = Array(height) { y -> FloatArray(width) { x -> lonValues[x] } }
        } else {
            // Already 2D arrays
            val height = latArray.getShape()[0]
            val width = latArray.getShape()[1]

            latGrid = Array(height) { y ->
                FloatArray(width) { x ->
                    latArray.getFloat(y * width + x)
                }
            }

            lonGrid = Array(height) { y ->
                FloatArray(width) { x ->
                    lonArray.getFloat(y * width + x)
                }
            }
        }

        return CoordinateMapping(latGrid, lonGrid)
    }

    // Extract mapping from projection information

    // Extract mapping from projection information
    private fun extractProjectionMapping(netcdfFile: NetcdfFile, projVar: Variable): CoordinateMapping? {
        try {
            Log.d(TAG, "Checking for direct lat/lon variables in the file")

            // Try to find the lat/lon variables directly
            val latVar = netcdfFile.findVariable("lat")
            val lonVar = netcdfFile.findVariable("lon")

            if (latVar != null && lonVar != null) {
                // Direct access to lat/lon grids - this is the easiest approach!
                Log.d(TAG, "Found direct lat/lon variables with shapes: ${latVar.shape.contentToString()}, ${lonVar.shape.contentToString()}")

                // Read the full arrays
                val latArray = latVar.read()
                val lonArray = lonVar.read()

                // Get dimensions
                val height = latArray.getShape()[0]
                val width = latArray.getShape()[1]

                Log.d(TAG, "Lat/lon grid dimensions: ${width}x${height}")

                // Create subsampled grid (full grid is too large)
                val sampleStep = Math.max(1, Math.min(height, width) / 150)
                val sampledHeight = (height + sampleStep - 1) / sampleStep
                val sampledWidth = (width + sampleStep - 1) / sampleStep

                // Create the grid arrays
                val latGrid = Array(sampledHeight) { FloatArray(sampledWidth) }
                val lonGrid = Array(sampledHeight) { FloatArray(sampledWidth) }

                // Fill the grid with values, skipping NaNs
                var validPointCount = 0

                for (i in 0 until sampledHeight) {
                    val srcI = i * sampleStep
                    if (srcI >= height) continue

                    for (j in 0 until sampledWidth) {
                        val srcJ = j * sampleStep
                        if (srcJ >= width) continue

                        // Get the array index
                        val index = srcI * width + srcJ

                        // Get lat/lon values
                        val lat = latArray.getDouble(index).toFloat()
                        val lon = lonArray.getDouble(index).toFloat()

                        // Store only valid values
                        if (!lat.isNaN() && !lon.isNaN()) {
                            latGrid[i][j] = lat
                            lonGrid[i][j] = lon
                            validPointCount++
                        } else {
                            // Mark invalid points (preserve grid structure)
                            latGrid[i][j] = Float.NaN
                            lonGrid[i][j] = Float.NaN
                        }
                    }
                }

                Log.d(TAG, "Created grid with $validPointCount valid points")

                // Check if we got enough valid points
                if (validPointCount > 100) {
                    // Find min/max valid coordinates for debugging
                    var minLat = Float.MAX_VALUE
                    var maxLat = -Float.MAX_VALUE
                    var minLon = Float.MAX_VALUE
                    var maxLon = -Float.MAX_VALUE

                    for (row in latGrid) {
                        for (lat in row) {
                            if (!lat.isNaN()) {
                                minLat = Math.min(minLat, lat)
                                maxLat = Math.max(maxLat, lat)
                            }
                        }
                    }

                    for (row in lonGrid) {
                        for (lon in row) {
                            if (!lon.isNaN()) {
                                minLon = Math.min(minLon, lon)
                                maxLon = Math.max(maxLon, lon)
                            }
                        }
                    }

                    Log.d(TAG, "Grid coordinate range: lat[$minLat, $maxLat], lon[$minLon, $maxLon]")
                    return CoordinateMapping(latGrid, lonGrid)
                } else {
                    Log.e(TAG, "Not enough valid coordinates in lat/lon grid")
                }
            } else {
                Log.d(TAG, "No direct lat/lon variables found, trying to get geospatial attributes")

                // Try to get bounding box coordinates from attributes
                val extent = netcdfFile.findVariable("geospatial_lat_lon_extent")
                if (extent != null) {
                    // Extract bounds from attributes
                    val attrs = extent.attributes()
                    val minLat = getAttributeFloat(attrs, "geospatial_lat_min", 18.6f)
                    val maxLat = getAttributeFloat(attrs, "geospatial_lat_max", 55.9f)
                    val minLon = getAttributeFloat(attrs, "geospatial_lon_min", -151.2f)
                    val maxLon = getAttributeFloat(attrs, "geospatial_lon_max", -67.2f)

                    Log.d(TAG, "Found geospatial attributes: lat[$minLat, $maxLat], lon[$minLon, $maxLon]")

                    // Continue with your existing projection code...
                }
            }

            // If we get here, we need to fall back to interpolation
            Log.e(TAG, "Couldn't find usable lat/lon data, using fallback grid")

            // Create a fallback grid for CONUS
            val sampledHeight = 150
            val sampledWidth = 250
            val latGrid = Array(sampledHeight) { i ->
                FloatArray(sampledWidth) { j ->
                    val latFrac = i.toFloat() / (sampledHeight - 1)
                    55.0f - latFrac * 35.0f // 55°N to 20°N
                }
            }

            val lonGrid = Array(sampledHeight) { i ->
                FloatArray(sampledWidth) { j ->
                    val lonFrac = j.toFloat() / (sampledWidth - 1)
                    -140.0f + lonFrac * 70.0f // 140°W to 70°W
                }
            }

            Log.d(TAG, "Created fallback CONUS grid: lat[20.0, 55.0], lon[-140.0, -70.0]")
            return CoordinateMapping(latGrid, lonGrid)

        } catch (e: Exception) {
            Log.e(TAG, "Error extracting coordinates: ${e.message}", e)
            return null
        }
    }

    private fun getAttributeFloat(attrs: ucar.nc2.AttributeContainer, name: String, defaultValue: Float): Float {
        val attr = attrs.findAttribute(name)
        return attr?.numericValue?.toFloat() ?: defaultValue
    }

    // Convert from satellite x/y coordinates to lat/lon
    private fun satelliteXYToLatLon(x: Double, y: Double, h: Double, lambda0: Double,
                                    semi_major: Double, semi_minor: Double): Pair<Double, Double> {
        // Calculate the distance from the satellite to the point
        val a = semi_major
        val b = semi_minor
        val r_eq = semi_major
        val r_pol = semi_minor

        // Constants for the geostationary projection
        val d = Math.sqrt(h*h - x*x - y*y)

        // Geocentric latitude
        val latGc = Math.atan(y / d)

        // Convert geocentric to geodetic latitude (on ellipsoid)
        val latGd = Math.atan(Math.tan(latGc) * (a*a/b/b))

        // Calculate longitude
        val lon = lambda0 + Math.atan(x / d)

        // Convert to degrees
        val latDeg = Math.toDegrees(latGd)
        val lonDeg = Math.toDegrees(lon)

        return Pair(latDeg, lonDeg)
    }

    /**
     * Create a gradient image as fallback
     */
    private fun createGradientImage(outputFile: File, width: Int, height: Int, visualizationMethod: VisualizationMethod): Boolean {
        try {
            Log.d(TAG, "Creating fallback gradient image")

            // Create bitmap
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)

            // Create a radial gradient
            val centerX = width / 2
            val centerY = height / 2
            val maxDist = Math.sqrt((centerX * centerX + centerY * centerY).toDouble()).toFloat()

            for (y in 0 until height) {
                for (x in 0 until width) {
                    val dist = Math.sqrt(((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY)).toDouble()).toFloat()
                    val normalizedValue = ((maxDist - dist) / maxDist).coerceIn(0f, 1f)
                    bitmap.setPixel(x, y, applyColorMap(normalizedValue, visualizationMethod))
                }
            }

            // Save as PNG
            outputFile.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }

            // Clean up
            bitmap.recycle()

            Log.d(TAG, "Created fallback gradient image: ${outputFile.length()/1024}KB")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error creating gradient image: ${e.message}")
            return false
        }
    }

    /**
     * Create a simple test pattern image
     */
    private fun createTestPattern(outputFile: File): Boolean {
        try {
            val width = 200
            val height = 150
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)

            // Fill with gradient
            for (y in 0 until height) {
                for (x in 0 until width) {
                    val red = (x * 255 / width)
                    val green = (y * 255 / height)
                    val blue = 255 - (x * 255 / width)
                    bitmap.setPixel(x, y, Color.rgb(red, green, blue))
                }
            }

            // Save the image
            outputFile.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }

            bitmap.recycle()
            Log.d(TAG, "Created fallback test pattern: ${outputFile.absolutePath}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create test pattern: ${e.message}")
            return false
        }
    }

    /**
     * Process a subset of a NetCDF file for regional domains
     */

    fun parseRegionalSubset(
        inputFile: File,
        outputFile: File,
        minLat: Float,
        maxLat: Float,
        minLon: Float,
        maxLon: Float,
        visualizationMethod: VisualizationMethod
    ): Boolean {
        var ncFile: NetcdfFile? = null

        try {
            Log.d(TAG, "Processing regional subset with bounds: $minLat,$maxLat,$minLon,$maxLon")

            // Open NetCDF file
            ncFile = NetcdfFile.open(inputFile.absolutePath)

            // Get data variable
            val dataVar = ncFile.findVariable("Rad")
            if (dataVar == null) {
                Log.e(TAG, "Could not find Rad variable")
                return false
            }

            // Get dimensions
            val shape = dataVar.shape
            val height = shape[0]
            val width = shape[1]

            // Map region to image coordinates (simplified approach)
            // In a real implementation, you would use proper geo coordinates
            val startY = (height * 0.2).toInt()
            val endY = (height * 0.7).toInt()
            val startX = (width * 0.2).toInt()
            val endX = (width * 0.8).toInt()

            // Use very aggressive downsampling - 16x for regional views
            val regionDownsampleFactor = 16
            val outHeight = ((endY - startY) / regionDownsampleFactor)
            val outWidth = ((endX - startX) / regionDownsampleFactor)

            Log.d(TAG, "Creating subset image: ${outWidth}x${outHeight}")

            // Create output bitmap
            val bitmap = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.RGB_565)

            // For speed, read larger chunks instead of individual pixels
            // This significantly improves performance
            val chunkHeight = Math.min(50, outHeight)

            // First, find min/max values by sampling
            var min = Float.MAX_VALUE
            var max = Float.MIN_VALUE

            // Sample just 100 points for speed
            val sampleYStep = Math.max((endY - startY) / 10, 1)
            val sampleXStep = Math.max((endX - startX) / 10, 1)

            for (y in startY until endY step sampleYStep) {
                for (x in startX until endX step sampleXStep) {
                    try {
                        // Read single point
                        val origin = intArrayOf(y, x)
                        val size = intArrayOf(1, 1)
                        val value = dataVar.read(origin, size).getFloat(0)

                        if (value.isFinite() && !value.isNaN()) {
                            min = Math.min(min, value)
                            max = Math.max(max, value)
                        }
                    } catch (e: Exception) {
                        // Skip errors
                    }
                }
            }

            // Default values if sampling failed
            if (min >= max || !min.isFinite() || !max.isFinite()) {
                min = 0f
                max = 1000f
            }

            Log.d(TAG, "Regional data range: $min to $max")

            // Process chunks for speed
            for (outputY in 0 until outHeight step chunkHeight) {
                // Calculate how many rows to process in this chunk
                val currentChunkHeight = Math.min(chunkHeight, outHeight - outputY)

                // Log progress periodically
                Log.d(TAG, "Regional processing: ${outputY * 100 / outHeight}%")

                // Process the chunk row by row
                for (chunkY in 0 until currentChunkHeight) {
                    // Calculate original Y coordinate in the data
                    val dataY = startY + (outputY + chunkY) * regionDownsampleFactor

                    // Process each column in this row
                    for (outputX in 0 until outWidth) {
                        try {
                            // Calculate original X coordinate in the data
                            val dataX = startX + outputX * regionDownsampleFactor

                            // Read single point
                            val origin = intArrayOf(dataY, dataX)
                            val size = intArrayOf(1, 1)
                            val value = dataVar.read(origin, size).getFloat(0)

                            // Normalize and apply color
                            val normalizedValue = if (value.isFinite() && !value.isNaN()) {
                                ((value - min) / (max - min)).coerceIn(0f, 1f)
                            } else {
                                0f
                            }

                            bitmap.setPixel(outputX, outputY + chunkY, applyColorMap(normalizedValue, visualizationMethod))
                        } catch (e: Exception) {
                            // Default to black for errors
                            bitmap.setPixel(outputX, outputY + chunkY, Color.BLACK)
                        }
                    }
                }
            }

            // Save bitmap
            outputFile.parentFile?.mkdirs()
            outputFile.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }

            // Clean up
            bitmap.recycle()

            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error creating regional subset: ${e.message}")
            return false
        } finally {
            try {
                ncFile?.close()
            } catch (e: Exception) {
                Log.e(TAG, "Error closing NetCDF file: ${e.message}")
            }
        }
    }

    /**
     * Process a NetCDF file directly to a JPEG file without holding the entire bitmap in memory
     */
    fun parseFileToImageFile(file: File, outputFile: File, downsampleFactor: Int, visualizationMethod: VisualizationMethod): Boolean {
        var ncFile: NetcdfFile? = null

        try {
            Log.d(TAG, "Starting direct file-to-image processing: ${file.absolutePath}")

            // Verify file exists
            if (!file.exists() || file.length() == 0L) {
                Log.e(TAG, "File is empty or doesn't exist: ${file.absolutePath}")
                return false
            }

            // Open NetCDF file
            val openTime = measureTimeMillis {
                ncFile = NetcdfFile.open(file.absolutePath)
            }
            Log.d(TAG, "Opened NetCDF file in $openTime ms")

            // Find the data variable
            val variableNames = listOf("Rad", "CMI", "Radiance")
            var variable: Variable? = null

            for (varName in variableNames) {
                variable = ncFile?.findVariable(varName)
                if (variable != null) {
                    Log.d(TAG, "Found variable: $varName")
                    break
                }
            }

            if (variable == null) {
                Log.e(TAG, "No suitable variable found")
                return false
            }

            // Get dimensions
            val shape = variable.shape
            val yDim = shape[0]
            val xDim = shape[1]

            Log.d(TAG, "Image dimensions: $xDim x $yDim")

            // Find min/max in a memory-efficient way (sample fewer points)
            val minMax = findMinMaxValues(variable, xDim, yDim, 8)
            Log.d(TAG, "Data range: $minMax")

            // Create output file parent directories if needed
            outputFile.parentFile?.mkdirs()

            // Process in smaller chunks to avoid OOM
            val chunkHeight = 100 // Process 100 rows at a time
            val sampledXDim = xDim / downsampleFactor
            val sampledYDim = yDim / downsampleFactor

            // Create a bitmap for a single chunk
            val chunkBitmap = Bitmap.createBitmap(sampledXDim,
                Math.min(chunkHeight, sampledYDim),
                Bitmap.Config.RGB_565)

            // Set up output stream and compress flags
            val outStream = FileOutputStream(outputFile)
            val compress = Bitmap.CompressFormat.JPEG
            val quality = 90

            // Create encoder with the right parameters
            outStream.use { out ->
                // Use Android's BitmapFactory with minimum memory
                val options = BitmapFactory.Options().apply {
                    inPreferredConfig = Bitmap.Config.RGB_565
                }

                // Process and write image in chunks
                var completed = false
                val pixels = IntArray(sampledXDim)

                try {
                    for (chunkY in 0 until sampledYDim step chunkHeight) {
                        Log.d(TAG, "Processing chunk at y=$chunkY")

                        // Calculate actual chunk height (might be smaller at the end)
                        val currentChunkHeight = Math.min(chunkHeight, sampledYDim - chunkY)

                        // Process rows in this chunk
                        for (y in 0 until currentChunkHeight) {
                            val origY = (chunkY + y) * downsampleFactor

                            // Process each pixel in this row
                            for (x in 0 until sampledXDim) {
                                val origX = x * downsampleFactor

                                // Read data value
                                val value = readSinglePoint(variable, origY, origX)

                                // Normalize and get color
                                val normalizedValue = if (value.isFinite() && !value.isNaN()) {
                                    ((value - minMax.first) / (minMax.second - minMax.first)).coerceIn(0f, 1f)
                                } else {
                                    0f
                                }

                                pixels[x] = applyColorMap(normalizedValue, visualizationMethod)
                            }

                            // Set this row of pixels
                            chunkBitmap.setPixels(pixels, 0, sampledXDim, 0, y, sampledXDim, 1)

                            // Allow the system to breathe
                            if (y % 20 == 0) {
                                Thread.yield()
                            }
                        }

                        // First chunk - start the JPEG
                        if (chunkY == 0) {
                            chunkBitmap.compress(compress, quality, out)
                        } else {
                            // Subsequent chunks would need to be appended to JPEG
                            // This is tricky - for simplicity, we're using a single bitmap approach
                            // You might need a custom JPEG encoder to do true streaming
                        }
                    }

                    // Successfully processed
                    completed = true

                } catch (e: OutOfMemoryError) {
                    Log.e(TAG, "OOM during image processing", e)
                    return false
                } finally {
                    // Clean up
                    chunkBitmap.recycle()
                }

                return completed
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error processing file to image: ${e.message}", e)
            return false
        } finally {
            try {
                ncFile?.close()
            } catch (e: Exception) {
                Log.e(TAG, "Error closing NetCDF file", e)
            }
        }
    }

    // Helper method to find data range
    private fun findDataRange(variable: Variable, width: Int, height: Int, step: Int): Pair<Float, Float> {
        var min = Float.MAX_VALUE
        var max = Float.MIN_VALUE

        // Take samples across the image, but not too many
        val samples = Math.min(500, (width / step) * (height / step))
        var samplesTaken = 0

        for (y in 0 until height step step) {
            for (x in 0 until width step step) {
                if (samplesTaken >= samples) break

                try {
                    val value = readSinglePoint(variable, y, x)
                    if (value.isFinite() && !value.isNaN()) {
                        min = min.coerceAtMost(value)
                        max = max.coerceAtLeast(value)
                        samplesTaken++
                    }
                } catch (e: Exception) {
                    // Skip problematic samples
                }
            }
            if (samplesTaken >= samples) break
        }

        // If we didn't get valid values, use defaults
        if (min == Float.MAX_VALUE || max == Float.MIN_VALUE || min == max) {
            return Pair(0f, 1000f)
        }

        return Pair(min, max)
    }

    fun validateCoordinateMapping(mapping: CoordinateMapping?): Boolean {
        if (mapping == null) return false

        try {
            val height = mapping.latGrid.size
            val width = mapping.latGrid[0].size

            // Count valid values
            var validCount = 0
            var nanCount = 0
            var outOfRangeCount = 0

            // Validate latitude/longitude values
            for (i in 0 until height) {
                for (j in 0 until width) {
                    val lat = mapping.latGrid[i][j]
                    val lon = mapping.lonGrid[i][j]

                    if (lat.isNaN() || lon.isNaN()) {
                        nanCount++
                    } else if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                        outOfRangeCount++
                    } else {
                        validCount++
                    }
                }
            }

            val totalPoints = height * width
            val validPercentage = validCount * 100 / totalPoints

            Log.d(TAG, "Coordinate mapping validation: $validCount valid points ($validPercentage%)")
            Log.d(TAG, "  NaN values: $nanCount (${nanCount * 100 / totalPoints}%)")
            Log.d(TAG, "  Out-of-range values: $outOfRangeCount (${outOfRangeCount * 100 / totalPoints}%)")

            return validPercentage > 50 // At least half of the points should be valid
        } catch (e: Exception) {
            Log.e(TAG, "Error validating coordinate mapping: ${e.message}")
            return false
        }
    }

    // Simple min/max finder with fewer samples to reduce memory pressure
    private fun findMinMaxValuesSimple(variable: Variable): Pair<Float, Float> {
        val shape = variable.shape
        val height = shape[0]
        val width = shape[1]

        var min = Float.MAX_VALUE
        var max = Float.MIN_VALUE

        // Take 400 samples across the image (20x20 grid)
        val yStep = height / 20
        val xStep = width / 20

        for (y in 0 until height step yStep) {
            for (x in 0 until width step xStep) {
                val value = readSinglePoint(variable, y, x)
                if (value.isFinite() && !value.isNaN()) {
                    min = min.coerceAtMost(value)
                    max = max.coerceAtLeast(value)
                }
            }
        }

        // If we didn't get good values, use defaults
        if (min == Float.MAX_VALUE || max == Float.MIN_VALUE) {
            return Pair(0f, 1000f)
        }

        return Pair(min, max)
    }
    /**
     * Parse a NetCDF file and directly create a bitmap
     * This is the main entry point for creating bitmaps from NetCDF files
     */
    fun parseFileToBitmap(file: File, downsampleFactor: Int, visualizationMethod: VisualizationMethod): Triple<Bitmap, Pair<Int, Int>, Pair<Float, Float>>? {
        var ncFile: NetcdfFile? = null

        try {
            // Verify file exists and has content (more thorough check)
            if (!file.exists()) {
                Log.e(TAG, "File does not exist: ${file.absolutePath}")
                return createErrorBitmap(100, 100)
            }

            if (file.length() == 0L) {
                Log.e(TAG, "File is empty: ${file.absolutePath}")
                return createErrorBitmap(100, 100)
            }

            // Check if file is readable
            if (!file.canRead()) {
                Log.e(TAG, "File is not readable: ${file.absolutePath}")
                return createErrorBitmap(100, 100)
            }

            Log.d(TAG, "Verified file exists and has content: ${file.absolutePath} (${file.length()} bytes)")

            Log.d(TAG, "Opening NetCDF file with downsample factor: $downsampleFactor")

            val openTime = measureTimeMillis {
                try {
                    ncFile = NetcdfFile.open(file.absolutePath)
                    if (ncFile == null) {
                        Log.e(TAG, "NetcdfFile.open returned null for: ${file.absolutePath}")
                        return createErrorBitmap(100, 100)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Exception opening NetCDF file: ${e.message}")
                    return createErrorBitmap(100, 100)
                }
            }
            Log.d(TAG, "Opened NetCDF file in $openTime ms")

            // Find the right variable
            val variableNames = listOf("Rad", "CMI", "Radiance")
            var variable: Variable? = null

            val findVarTime = measureTimeMillis {
                for (varName in variableNames) {
                    variable = ncFile?.findVariable(varName)
                    if (variable != null) {
                        Log.d(TAG, "Found variable: $varName in ${file.absolutePath}")
                        break
                    }
                }
            }
            Log.d(TAG, "Found variable in $findVarTime ms")

            if (variable == null) {
                Log.e(TAG, "No suitable variable found in file")

                // List available variables for debugging
                val variables = ncFile?.variables?.joinToString(", ") { it.fullName }
                Log.d(TAG, "Available variables: $variables")

                return createErrorBitmap(100, 100)
            }

            val shape = variable!!.shape
            if (shape.size < 2) {
                Log.e(TAG, "Invalid shape for variable: ${shape.contentToString()}")
                return createErrorBitmap(100, 100)
            }

            // Get dimensions and calculate downsampled size
            val yDim = shape[0]
            val xDim = shape[1]

            // MEMORY FIX: Increase downsampling factor for better performance
            val adjustedDownsampleFactor = downsampleFactor * 2
            val sampledYDim = yDim / adjustedDownsampleFactor
            val sampledXDim = xDim / adjustedDownsampleFactor

            Log.d(TAG, "Original dimensions: $xDim x $yDim")
            Log.d(TAG, "Downsampled to: $sampledXDim x $sampledYDim (factor: $adjustedDownsampleFactor)")

            // MEMORY FIX: Get bitmap from pool instead of direct creation
            var bitmap: Bitmap? = null
            val createBitmapTime = measureTimeMillis {
                try {
                    // Use RGB_565 for half the memory usage of ARGB_8888
                    bitmap = BitmapPoolManager.getBitmap(sampledXDim, sampledYDim, Bitmap.Config.RGB_565)
                } catch (e: OutOfMemoryError) {
                    Log.e(TAG, "Out of memory creating bitmap: ${e.message}")
                    // Try again with a smaller size
                    bitmap = BitmapPoolManager.getBitmap(
                        sampledXDim / 2,
                        sampledYDim / 2,
                        Bitmap.Config.RGB_565
                    )
                }
            }
            Log.d(TAG, "Created bitmap in $createBitmapTime ms")

            if (bitmap == null) {
                Log.e(TAG, "Failed to create bitmap")
                return createErrorBitmap(100, 100)
            }

            // Check cache for min/max values first
            var minMax = rangeCache[file.absolutePath]

            if (minMax == null) {
                val findRangeTime = measureTimeMillis {
                    minMax = findMinMaxValues(variable!!, xDim, yDim, adjustedDownsampleFactor)
                    // Cache the min/max for this file
                    rangeCache[file.absolutePath] = minMax!!
                }
                Log.d(TAG, "Found data range in $findRangeTime ms: $minMax")
            } else {
                Log.d(TAG, "Using cached data range: $minMax")
            }

            // Ensure our color map cache is initialized for this visualization method
            if (!colorMapCache.containsKey(visualizationMethod)) {
                val colorMap = IntArray(101)
                for (i in 0..100) {
                    val normalizedValue = i / 100f
                    colorMap[i] = applyColorMap(normalizedValue, visualizationMethod)
                }
                colorMapCache[visualizationMethod] = colorMap
            }

            // Fill the bitmap with pixel data in a single pass, row by row
            val fillTime = measureTimeMillis {
                fillBitmapSinglePass(bitmap!!, variable!!, xDim, yDim, adjustedDownsampleFactor, minMax!!, visualizationMethod)
            }
            Log.d(TAG, "Filled bitmap in $fillTime ms")

            // Close the NetCDF file ASAP to free resources
            try {
                ncFile?.close()
                ncFile = null
            } catch (e: Exception) {
                Log.e(TAG, "Error closing NetCDF file", e)
            }

            Log.d(TAG, "Total bitmap creation complete")
            return Triple(bitmap!!, Pair(sampledYDim, sampledXDim), minMax!!)

        } catch (e: OutOfMemoryError) {
            Log.e(TAG, "Out of memory error processing NetCDF file", e)

            // Try to free up memory
            BitmapPoolManager.clearCaches()

            return createErrorBitmap(50, 30)
        } catch (e: Exception) {
            Log.e(TAG, "Error processing NetCDF file: ${e.message}", e)
            return createErrorBitmap(50, 30)
        } finally {
            // Always close the NetCDF file in the finally block
            try {
                ncFile?.close()  // Use safe call operator instead of smart cast
                if (ncFile != null) {
                    ncFile = null
                    Log.d(TAG, "Successfully closed NetCDF file")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error closing NetCDF file", e)
            }
        }
    }

    /**
     * Create a simple error bitmap to display when there's a problem
     */
    private fun createErrorBitmap(width: Int, height: Int): Triple<Bitmap, Pair<Int, Int>, Pair<Float, Float>>? {
        val bitmap = BitmapPoolManager.getBitmap(width, height, Bitmap.Config.RGB_565)
        bitmap.eraseColor(Color.RED)

        // Draw a simple X pattern to indicate error
        for (y in 0 until height) {
            for (x in 0 until width) {
                if (x == y || x == width - y - 1) {
                    bitmap.setPixel(x, y, Color.BLACK)
                }
            }
        }

        return Triple(bitmap, Pair(height, width), Pair(0f, 1000f))
    }

    fun drawSatellitePolygon(canvas: Canvas, coordinates: JsonArray, paint: Paint,
                             width: Int, height: Int, domain: SatelliteDomain,
                             mapping: CoordinateMapping?) {
        try {
            // Check if coordinate mapping is available
            if (mapping == null) {
                Log.e(TAG, "No coordinate mapping available for boundary drawing")
                return
            }

            // Get first ring (outer boundary)
            val ring = coordinates.get(0).asJsonArray ?: return

            // Segments to handle discontinuities
            val segments = mutableListOf<MutableList<Pair<Float, Float>>>()
            var currentSegment = mutableListOf<Pair<Float, Float>>()

            // Process polygon points
            for (i in 0 until ring.size()) {
                try {
                    val point = ring.get(i).asJsonArray ?: continue
                    val lon = point.get(0).asDouble
                    val lat = point.get(1).asDouble

                    // Map to pixel coordinates using the accurate coordinate mapping
                    val pixelCoords = mapping.mapToPixel(lat, lon, width, height)
                    if (pixelCoords == null) {
                        // Point is outside the mapped area
                        if (currentSegment.size > 1) {
                            segments.add(currentSegment)
                            currentSegment = mutableListOf()
                        }
                        continue
                    }

                    val (x, y) = pixelCoords

                    // Handle discontinuities
                    if (currentSegment.isNotEmpty()) {
                        val prev = currentSegment.last()
                        val dx = x - prev.first
                        val dy = y - prev.second
                        val distance = Math.sqrt((dx * dx + dy * dy).toDouble())

                        // Start new segment if distance is too large
                        if (distance > width / 6) {
                            if (currentSegment.size > 1) {
                                segments.add(currentSegment)
                                currentSegment = mutableListOf()
                            }
                        }
                    }

                    currentSegment.add(Pair(x, y))
                } catch (e: Exception) {
                    continue // Skip problematic points
                }
            }

            // Add final segment
            if (currentSegment.size > 1) {
                segments.add(currentSegment)
            }

            // Draw all segments
            val path = Path()
            for (segment in segments) {
                if (segment.size < 2) continue

                path.reset()
                path.moveTo(segment[0].first, segment[0].second)

                for (i in 1 until segment.size) {
                    path.lineTo(segment[i].first, segment[i].second)
                }

                canvas.drawPath(path, paint)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error drawing polygon: ${e.message}")
        }
    }


    /**
     * Find min/max values by sampling a subset of points
     */
    private fun findMinMaxValues(variable: Variable, xDim: Int, yDim: Int, downsampleFactor: Int): Pair<Float, Float> {
        var minValue = Float.MAX_VALUE
        var maxValue = Float.MIN_VALUE

        // Adaptive sampling - for large images, sample fewer points
        val sampleCount = 2500
        val totalPoints = (xDim / downsampleFactor) * (yDim / downsampleFactor)
        val sampleFrequency = (totalPoints / sampleCount).coerceAtLeast(1)

        var sampledPoints = 0

        // Use a more systematic sampling pattern to better cover the whole image
        for (y in 0 until yDim step downsampleFactor) {
            for (x in 0 until xDim step downsampleFactor) {
                // Only sample every sampleFrequency'th point
                if ((y/downsampleFactor * (xDim/downsampleFactor) + x/downsampleFactor) % sampleFrequency == 0) {
                    try {
                        val value = readSinglePoint(variable, y, x)
                        if (!value.isNaN() && value.isFinite()) {
                            if (value < minValue) minValue = value
                            if (value > maxValue) maxValue = value
                            sampledPoints++
                        }
                    } catch (e: Exception) {
                        // Skip errors when sampling
                    }
                }

                // Once we've sampled enough points, exit early
                if (sampledPoints >= sampleCount) break
            }
            if (sampledPoints >= sampleCount) break
        }

        Log.d(TAG, "Sampled $sampledPoints points for min/max values")

        // If we got bad values, use defaults
        if (minValue == Float.MAX_VALUE || maxValue == Float.MIN_VALUE ||
            !minValue.isFinite() || !maxValue.isFinite() || sampledPoints < 10) {
            Log.w(TAG, "Using default min/max values due to insufficient samples")
            minValue = 0f
            maxValue = 1000f
        }

        return Pair(minValue, maxValue)
    }

    /**
     * Read a single data point to minimize memory usage
     */
    private fun readSinglePoint(variable: Variable, y: Int, x: Int): Float {
        try {
            val origin = intArrayOf(y, x)
            val size = intArrayOf(1, 1)
            val dataPoint = variable.read(origin, size)

            return if (dataPoint is ucar.ma2.Array) {
                dataPoint.getFloat(0)
            } else {
                Float.NaN
            }
        } catch (e: Exception) {
            return Float.NaN
        }
    }

    /**
     * Optimized method to read data in batches and fill bitmap in a single pass.
     * This significantly reduces memory overhead and processing time.
     */
    private fun fillBitmapSinglePass(
        bitmap: Bitmap,
        variable: Variable,
        xDim: Int,
        yDim: Int,
        downsampleFactor: Int,
        dataRange: Pair<Float, Float>,
        visualizationMethod: VisualizationMethod
    ) {
        val (minValue, maxValue) = dataRange
        val sampledYDim = bitmap.height
        val sampledXDim = bitmap.width

        // Reuse pixel array to avoid constant allocations
        val pixels = IntArray(sampledXDim)

        // Get the color map from cache
        val colorMap = colorMapCache[visualizationMethod] ?: IntArray(101).also {
            for (i in 0..100) {
                it[i] = applyColorMap(i / 100f, visualizationMethod)
            }
            colorMapCache[visualizationMethod] = it
        }

        // Process entire image row by row
        for (y in 0 until sampledYDim) {
            val origY = y * downsampleFactor
            if (origY >= yDim) continue

            // For each pixel in the row
            for (x in 0 until sampledXDim) {
                val origX = x * downsampleFactor
                if (origX >= xDim) continue

                // Read the data value and map to color
                try {
                    val value = readSinglePoint(variable, origY, origX)

                    // Normalize the value
                    val normalizedValue = if (value.isFinite() && !value.isNaN()) {
                        ((value - minValue) / (maxValue - minValue)).coerceIn(0f, 1f)
                    } else {
                        0f
                    }

                    // Use color cache
                    pixels[x] = colorMap[(normalizedValue * 100).toInt().coerceIn(0, 100)]
                } catch (e: Exception) {
                    pixels[x] = Color.BLACK
                }
            }

            // Set entire row at once for efficiency
            bitmap.setPixels(pixels, 0, sampledXDim, 0, y, sampledXDim, 1)

            // Yield to avoid blocking the UI thread too long
            if (y % 20 == 0) {
                Thread.yield()
            }
        }
    }

    /**
     * Apply color mapping to a normalized value
     */
    fun applyColorMap(normalizedValue: Float, method: VisualizationMethod): Int {
        return when (method) {
            VisualizationMethod.STANDARD_ENHANCED -> {
                // Enhanced contrast grayscale
                val intensity = (normalizedValue.pow(0.65f) * 255).toInt().coerceIn(0, 255)
                (0xFF shl 24) or (intensity shl 16) or (intensity shl 8) or intensity
            }

            VisualizationMethod.COLOR_IR -> {
                // Color IR scale commonly used for temperature/IR channels
                when {
                    normalizedValue < 0.1f -> { // Cold clouds (white to light blue)
                        val intensity = ((normalizedValue/0.1f) * 55 + 200).toInt().coerceIn(200, 255)
                        val blue = intensity
                        val green = intensity
                        val red = intensity
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.2f -> { // Cold clouds (light blue to blue)
                        val factor = (normalizedValue - 0.1f) / 0.1f
                        val blue = 255
                        val green = (200 - factor * 100).toInt().coerceIn(0, 255)
                        val red = (200 - factor * 150).toInt().coerceIn(0, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.3f -> { // Blue to cyan
                        val factor = (normalizedValue - 0.2f) / 0.1f
                        val blue = 255
                        val green = (100 + factor * 155).toInt().coerceIn(0, 255)
                        val red = 50
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.5f -> { // Cyan to green
                        val factor = (normalizedValue - 0.3f) / 0.2f
                        val blue = (255 - factor * 255).toInt().coerceIn(0, 255)
                        val green = 255
                        val red = 50
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.7f -> { // Green to yellow
                        val factor = (normalizedValue - 0.5f) / 0.2f
                        val blue = 0
                        val green = 255
                        val red = (50 + factor * 205).toInt().coerceIn(0, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.85f -> { // Yellow to red
                        val factor = (normalizedValue - 0.7f) / 0.15f
                        val blue = 0
                        val green = (255 - factor * 255).toInt().coerceIn(0, 255)
                        val red = 255
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    else -> { // Red to black (warmest)
                        val factor = (normalizedValue - 0.85f) / 0.15f
                        val blue = 0
                        val green = 0
                        val red = (255 - factor * 205).toInt().coerceIn(50, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                }
            }

            VisualizationMethod.FIRE_DETECTION -> {
                // Fire detection enhancement (good for Ch07 3.9µm)
                when {
                    normalizedValue < 0.4f -> { // Background (cool to warm, blue to green)
                        val factor = normalizedValue / 0.4f
                        val blue = (255 - factor * 255).toInt().coerceIn(0, 255)
                        val green = (factor * 255).toInt().coerceIn(0, 255)
                        val red = 0
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.6f -> { // Normal warm surfaces (green to yellow)
                        val factor = (normalizedValue - 0.4f) / 0.2f
                        val blue = 0
                        val green = 255
                        val red = (factor * 255).toInt().coerceIn(0, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.8f -> { // Hot spots (yellow to red)
                        val factor = (normalizedValue - 0.6f) / 0.2f
                        val blue = 0
                        val green = (255 - factor * 255).toInt().coerceIn(0, 255)
                        val red = 255
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    else -> { // Fire (red to bright white)
                        val factor = (normalizedValue - 0.8f) / 0.2f
                        val intensity = (factor * 255).toInt().coerceIn(0, 255)
                        val blue = intensity
                        val green = intensity
                        val red = 255
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                }
            }

            VisualizationMethod.WATER_VAPOR -> {
                // Water vapor enhancement (browns for dry air, blues for moisture)
                when {
                    normalizedValue < 0.25f -> { // Dry air (brown to tan)
                        val factor = normalizedValue / 0.25f
                        val blue = 0
                        val green = (100 + factor * 100).toInt().coerceIn(0, 255)
                        val red = (120 + factor * 80).toInt().coerceIn(0, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.5f -> { // Moderate moisture (tan to light blue)
                        val factor = (normalizedValue - 0.25f) / 0.25f
                        val blue = (factor * 200).toInt().coerceIn(0, 255)
                        val green = (200 - factor * 50).toInt().coerceIn(0, 255)
                        val red = (200 - factor * 150).toInt().coerceIn(0, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    normalizedValue < 0.75f -> { // Moist (light blue to dark blue)
                        val factor = (normalizedValue - 0.5f) / 0.25f
                        val blue = (200 + factor * 55).toInt().coerceIn(0, 255)
                        val green = (150 - factor * 100).toInt().coerceIn(0, 255)
                        val red = (50 - factor * 50).toInt().coerceIn(0, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                    else -> { // Very moist/cloud tops (dark blue to white)
                        val factor = (normalizedValue - 0.75f) / 0.25f
                        val blue = 255
                        val green = (50 + factor * 205).toInt().coerceIn(0, 255)
                        val red = (0 + factor * 255).toInt().coerceIn(0, 255)
                        (0xFF shl 24) or (red shl 16) or (green shl 8) or blue
                    }
                }
            }

            VisualizationMethod.VISIBLE -> {
                // Visible channel enhancement with extra contrast
                // Apply gamma correction and contrast enhancement
                val adjustedValue = normalizedValue.pow(0.8f) // Gamma correction
                val enhancedValue = (adjustedValue - 0.5f) * 1.3f + 0.5f // Contrast enhancement
                val intensity = (enhancedValue.coerceIn(0f, 1f) * 255).toInt()
                (0xFF shl 24) or (intensity shl 16) or (intensity shl 8) or intensity
            }

            VisualizationMethod.VISIBLE_RED -> {
                // Professional grayscale for Channel 2 (Red) - brighter version
                val result = when {
                    // Values below 5% get compressed to 0-0.15 range (still visible, not too dark)
                    normalizedValue < 0.05f -> normalizedValue * 3.0f

                    // Values 5-30% get mapped to 0.15-0.5 range (mid grays)
                    normalizedValue < 0.3f -> 0.15f + 0.35f * ((normalizedValue - 0.05f) / 0.25f)

                    // Values 30-70% get mapped to 0.5-0.85 range (light grays)
                    normalizedValue < 0.7f -> 0.5f + 0.35f * ((normalizedValue - 0.3f) / 0.4f)

                    // Values 70-100% get mapped to 0.85-1.0 range (near white)
                    else -> 0.85f + 0.15f * ((normalizedValue - 0.7f) / 0.3f).pow(0.6f)
                }

                // Use professional grayscale color mapping (max 250 for near white)
                val intensity = (result * 255f).toInt().coerceIn(0, 250)
                (0xFF shl 24) or (intensity shl 16) or (intensity shl 8) or intensity
            }

            VisualizationMethod.VISIBLE_BLUE -> {
                // Professional grayscale for Channel 1 (Blue) - much brighter version
                val result = when {
                    // Values below 5% get compressed to 0-0.15 range (still visible)
                    normalizedValue < 0.05f -> normalizedValue * 3.0f

                    // Values 5-25% get mapped to 0.15-0.5 range (mid grays)
                    normalizedValue < 0.25f -> 0.15f + 0.35f * ((normalizedValue - 0.05f) / 0.2f)

                    // Values 25-60% get mapped to 0.5-0.85 range (light grays)
                    normalizedValue < 0.6f -> 0.5f + 0.35f * ((normalizedValue - 0.25f) / 0.35f)

                    // Values 60-100% get mapped to 0.85-1.0 range (near white)
                    else -> 0.85f + 0.15f * ((normalizedValue - 0.6f) / 0.4f).pow(0.6f)
                }

                // Use brighter professional grayscale
                val intensity = (result * 255f).toInt().coerceIn(0, 250)
                (0xFF shl 24) or (intensity shl 16) or (intensity shl 8) or intensity
            }

            VisualizationMethod.VISIBLE_GREEN -> {
                // Professional grayscale for Channel 3 (Near-IR/Green) - brighter version
                val result = when {
                    // Values below 3% get compressed to 0-0.15 range (still visible)
                    normalizedValue < 0.03f -> normalizedValue * 5.0f

                    // Values 3-20% get mapped to 0.15-0.5 range (mid grays)
                    normalizedValue < 0.2f -> 0.15f + 0.35f * ((normalizedValue - 0.03f) / 0.17f)

                    // Values 20-50% get mapped to 0.5-0.85 range (light grays)
                    normalizedValue < 0.5f -> 0.5f + 0.35f * ((normalizedValue - 0.2f) / 0.3f)

                    // Values 50-100% get mapped to 0.85-1.0 range (near white)
                    else -> 0.85f + 0.15f * ((normalizedValue - 0.5f) / 0.5f).pow(0.6f)
                }

                // Use brighter professional grayscale
                val intensity = (result * 255f).toInt().coerceIn(0, 250)
                (0xFF shl 24) or (intensity shl 16) or (intensity shl 8) or intensity
            }

            VisualizationMethod.CLEAN_IR_ENHANCED -> {
                // Enhanced visualization for Channel 13 (Clean IR)
                // Based on temperature color scheme from Python example

                // Convert normalized value to approximate temperature (-90°C to 40°C)
                val tempC = -90f + normalizedValue * 130f

                // Apply color mapping based on temperature ranges
                when {
                    tempC < -80f -> {
                        // Purple range for very cold cloud tops
                        val factor = (tempC + 90f) / 10f // 0-1 in -90 to -80 range
                        val r = (0.40f + factor * 0.60f) * 255f
                        val g = (0.00f + factor * 0.90f) * 255f
                        val b = (0.60f + factor * 0.40f) * 255f
                        (0xFF shl 24) or (r.toInt() shl 16) or (g.toInt() shl 8) or b.toInt()
                    }
                    tempC < -70f -> {
                        // Black to dark red transition
                        val factor = (tempC + 80f) / 10f
                        val r = factor * 0.5f * 255f
                        val g = 0f
                        val b = 0f
                        (0xFF shl 24) or (r.toInt() shl 16) or (g.toInt() shl 8) or b.toInt()
                    }
                    tempC < -60f -> {
                        // Dark red to red
                        val factor = (tempC + 70f) / 10f
                        val r = (0.5f + factor * 0.5f) * 255f
                        val g = 0f
                        val b = 0f
                        (0xFF shl 24) or (r.toInt() shl 16) or (g.toInt() shl 8) or b.toInt()
                    }
                    tempC < -50f -> {
                        // Red to orange/yellow
                        val factor = (tempC + 60f) / 10f
                        val r = 255
                        val g = (factor * 255f).toInt()
                        val b = 0
                        (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                    }
                    tempC < -40f -> {
                        // Yellow to yellowish-green
                        val factor = (tempC + 50f) / 10f
                        val r = (1.0f - factor * 0.5f) * 255f
                        val g = 255
                        val b = 0
                        (0xFF shl 24) or (r.toInt() shl 16) or (g shl 8) or b
                    }
                    tempC < -30f -> {
                        // Yellowish-green to green
                        val factor = (tempC + 40f) / 10f
                        val r = (0.5f - factor * 0.5f) * 255f
                        val g = 255
                        val b = (factor * 0.5f) * 255f
                        (0xFF shl 24) or (r.toInt() shl 16) or (g shl 8) or b.toInt()
                    }
                    tempC < -20f -> {
                        // Green to blue
                        val factor = (tempC + 30f) / 10f
                        val r = 0
                        val g = (1.0f - factor * 0.7f) * 255f
                        val b = (0.5f + factor * 0.5f) * 255f
                        (0xFF shl 24) or (r shl 16) or (g.toInt() shl 8) or b.toInt()
                    }
                    else -> {
                        // Gray scale for -20°C and warmer
                        // Lightest at -20°C, getting darker as temp increases
                        val factor = (tempC + 20f) / 60f // 0-1 for -20 to 40
                        val value = (0.95f - factor * 0.85f) * 255f
                        val intensity = value.toInt().coerceIn(25, 242)
                        (0xFF shl 24) or (intensity shl 16) or (intensity shl 8) or intensity
                    }
                }
            }

            else -> {
                // Default fallback (grayscale)
                val intensity = (normalizedValue * 255).toInt()
                (0xFF shl 24) or (intensity shl 16) or (intensity shl 8) or intensity
            }
        }
    }

    /**
     * Clear cached resources
     */
    fun clearCache() {
        rangeCache.clear()
        colorMapCache.clear()
    }
}