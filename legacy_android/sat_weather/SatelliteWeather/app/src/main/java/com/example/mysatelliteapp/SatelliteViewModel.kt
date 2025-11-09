package com.example.mysatelliteapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Bitmap.Config
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Log
import androidx.lifecycle.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.*
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonArray
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ucar.nc2.NetcdfFile
import ucar.nc2.Variable
import java.io.InputStreamReader
import kotlin.math.cos
import kotlin.math.sin

// Channel information class to hold metadata about GOES bands
data class SatelliteChannel(
    val id: String,
    val number: Int,
    val name: String,
    val description: String,
    val wavelength: String,
    val defaultVisualization: VisualizationMethod,
    val isHighResolution: Boolean = number <= 6 // Visible bands are high-res
)

// Frame class to hold processed bitmap and metadata
data class SatelliteFrame(
    val bitmap: Bitmap,
    val timestamp: String,
    val filePath: String,
    val dimensions: Pair<Int, Int>,
    val dataRange: Pair<Float, Float>
)

class SatelliteViewModel(val cacheDir: File) : ViewModel() {
    private val fetcher = SatelliteDataFetcher()
    private val imageFetcher = ImageDataFetcher(appContext!!)
    private val parser = NetCDFParser()
    private val TAG = "SatelliteViewModel"
    
    // Flag to control which loading method to use
    private val useImageLoading = true // Set to true to use pre-processed images

    private val imageDir by lazy { File(cacheDir, "processed_images").apply { mkdirs() } }
    private val processingQueue = LinkedBlockingQueue<String>()
    private var processingJob: Job? = null

    // UI display state
    private val _currentBitmap = MutableStateFlow<Bitmap?>(null)
    val bitmap: StateFlow<Bitmap?> = _currentBitmap

    // Metadata about the image
    private val _dimensions = MutableStateFlow<Pair<Int, Int>?>(null)
    val dimensions: StateFlow<Pair<Int, Int>?> = _dimensions

    // Loading and error states
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    // File tracking - now supporting multiple files
    private val _currentFile = MutableStateFlow<String?>(null)
    val currentFile: StateFlow<String?> = _currentFile

    private val _currentFiles = MutableStateFlow<List<String>>(emptyList())
    val currentFiles: StateFlow<List<String>> = _currentFiles

    // Time information from the current file
    private val _currentTimestamp = MutableStateFlow<String>("--:-- UTC")
    val currentTimestamp: StateFlow<String> = _currentTimestamp

    // Channel selection
    private val _availableChannels = MutableStateFlow<List<SatelliteChannel>>(emptyList())
    val availableChannels: StateFlow<List<SatelliteChannel>> = _availableChannels

    private val _selectedChannel = MutableStateFlow<SatelliteChannel?>(null)
    val selectedChannel: StateFlow<SatelliteChannel?> = _selectedChannel

    // Data range for visualization (still useful for UI)
    private val _dataRange = MutableStateFlow<Pair<Float, Float>?>(null)
    val dataRange: StateFlow<Pair<Float, Float>?> = _dataRange

    // Current visualization method
    private var currentVisualizationMethod: VisualizationMethod = VisualizationMethod.COLOR_IR

    // S3 bucket for GOES-16 data
    private val bucket = "noaa-goes19"

    // Default time format for display
    private val timeFormatter = SimpleDateFormat("HH:mm z", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    // Current frame index for animation/slider
    private val _currentFrameIndex = MutableStateFlow(0)
    val currentFrameIndex: StateFlow<Int> = _currentFrameIndex

    // Animation state
    private val _isAnimating = MutableStateFlow(false)
    val isAnimating: StateFlow<Boolean> = _isAnimating

    // Background frame loading progress
    private val _backgroundLoadingProgress = MutableStateFlow(0f)
    val backgroundLoadingProgress: StateFlow<Float> = _backgroundLoadingProgress

    // Cache for processed frames - key is file path
    private val processedFrames = mutableMapOf<String, SatelliteFrame>()
    private val framesMutex = Mutex()

    // MEMORY FIX: Add strong reference map for active bitmaps to prevent GC
    private val activeBitmaps = mutableMapOf<String, Bitmap>()
    private val activeBitmapsMutex = Mutex()

    // Simple file cache with a map and a mutex to synchronize access
    private val fileCache = mutableMapOf<String, File>()
    private val fileCacheMutex = Mutex()

    // Track which files are being downloaded/processed to avoid duplicate work
    private val processingFiles = mutableSetOf<String>()
    private val processingMutex = Mutex()

    // Flag to track initialization
    private val isInitialized = AtomicBoolean(false)

    // Background loading job
    private var backgroundLoadingJob: Job? = null

    // Animation job
    private var animationJob: Job? = null

    val boundaryOverlay = MutableStateFlow<Bitmap?>(null)
    private val _boundaryOverlay = MutableStateFlow<Bitmap?>(null)
    val boundaries: StateFlow<Bitmap?> = _boundaryOverlay
    private var countriesGeoJson: JsonObject? = null
    private var statesGeoJson: JsonObject? = null
    private var countiesGeoJson: JsonObject? = null

    // Add an explicit timestamp map to store timestamps for all frames
    private val frameTimestamps = mutableMapOf<String, String>()

    private val _availableDomains = MutableStateFlow<List<SatelliteDomain>>(
        listOf(
            SatelliteDomain.FULL_DISK,
            SatelliteDomain.CONUS,
            SatelliteDomain.MESOSCALE_1,
            SatelliteDomain.MESOSCALE_2,
            SatelliteDomain.NORTHWEST,
            SatelliteDomain.NORTHEAST,
            SatelliteDomain.SOUTHWEST,
            SatelliteDomain.SOUTHEAST,
            SatelliteDomain.OKLAHOMA,
            SatelliteDomain.TEXAS
        )
    )

    val availableDomains: StateFlow<List<SatelliteDomain>> = _availableDomains

    private val _selectedDomain = MutableStateFlow<SatelliteDomain>(SatelliteDomain.CONUS)
    val selectedDomain: StateFlow<SatelliteDomain> = _selectedDomain
    private var currentCoordinateMapping: NetCDFParser.CoordinateMapping? = null

    companion object {
        var appContext: Context? = null  // Keep your existing code

        // Constants for GOES-16 satellite
        const val SATELLITE_HEIGHT = 35786.0 // km above equator
        const val SATELLITE_LONGITUDE = -75.2 // degrees west (GOES-East)
        const val EARTH_RADIUS = 6378.137 // km Earth equatorial radius
        const val EARTH_FLATTENING = 0.00335281 // WGS84 flattening parameter
    }


    // Setup available channels
    init {
        // Setup available channels
        setupChannels()

        // Set initial channel to Band 13 (Clean IR)
        val initialChannel = _availableChannels.value.find { it.number == 13 }
        _selectedChannel.value = initialChannel

        // Make sure visualization method is correctly set
        currentVisualizationMethod = initialChannel?.defaultVisualization ?: VisualizationMethod.CLEAN_IR_ENHANCED

        // Add this line to load boundary data
        loadBoundaryData()

        // Start the sequential processor
        startImageProcessor()

        // Initialize in a coroutine to ensure proper setup
        viewModelScope.launch {
            delay(500) // Short delay to ensure UI is ready
            isInitialized.set(true)
            startFetchingData(initialLoadOnly = true)
        }

    }

    private fun loadBoundaryData() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val context = appContext
                if (context == null) {
                    Log.e(TAG, "App context not initialized")
                    return@launch
                }

                // Load simplified boundary data from assets
                val gson = Gson()

                try {
                    // Load countries
                    context.assets.open("countries_simplified.geojson").use { stream ->
                        val reader = InputStreamReader(stream)
                        val jsonString = reader.readText()
                        Log.d(TAG, "Countries GeoJSON sample: ${jsonString.take(200)}...")
                        countriesGeoJson = gson.fromJson(jsonString, JsonObject::class.java)

                        // Validate structure - check for GeometryCollection
                        if (countriesGeoJson?.has("geometries") == true) {
                            Log.d(TAG, "Countries GeoJSON loaded as GeometryCollection with ${countriesGeoJson?.getAsJsonArray("geometries")?.size() ?: 0} geometries")
                        } else if (countriesGeoJson?.has("features") == true) {
                            Log.d(TAG, "Countries GeoJSON loaded as FeatureCollection with ${countriesGeoJson?.getAsJsonArray("features")?.size() ?: 0} features")
                        } else {
                            Log.e(TAG, "Countries GeoJSON loaded but has invalid structure")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to load countries: ${e.message}", e)
                }

                try {
                    // Load US states
                    context.assets.open("us_states_simplified.geojson").use { stream ->
                        val reader = InputStreamReader(stream)
                        val jsonString = reader.readText()
                        Log.d(TAG, "States GeoJSON sample: ${jsonString.take(200)}...")
                        statesGeoJson = gson.fromJson(jsonString, JsonObject::class.java)

                        // Validate structure - check for GeometryCollection
                        if (statesGeoJson?.has("geometries") == true) {
                            Log.d(TAG, "States GeoJSON loaded as GeometryCollection with ${statesGeoJson?.getAsJsonArray("geometries")?.size() ?: 0} geometries")
                        } else if (statesGeoJson?.has("features") == true) {
                            Log.d(TAG, "States GeoJSON loaded as FeatureCollection with ${statesGeoJson?.getAsJsonArray("features")?.size() ?: 0} features")
                        } else {
                            Log.e(TAG, "States GeoJSON loaded but has invalid structure")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to load states: ${e.message}", e)
                }

                try {
                    // Only load counties for regional views
                    if (_selectedDomain.value.isRegional) {
                        context.assets.open("us_counties_simplified.geojson").use { stream ->
                            val reader = InputStreamReader(stream)
                            countiesGeoJson = gson.fromJson(reader, JsonObject::class.java)

                            // Validate structure - check for GeometryCollection
                            if (countiesGeoJson?.has("geometries") == true) {
                                Log.d(TAG, "Counties GeoJSON loaded as GeometryCollection with ${countiesGeoJson?.getAsJsonArray("geometries")?.size() ?: 0} geometries")
                            } else if (countiesGeoJson?.has("features") == true) {
                                Log.d(TAG, "Counties GeoJSON loaded as FeatureCollection with ${countiesGeoJson?.getAsJsonArray("features")?.size() ?: 0} features")
                            } else {
                                Log.e(TAG, "Counties GeoJSON loaded but has invalid structure")
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to load counties: ${e.message}", e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in loadBoundaryData: ${e.message}", e)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()

        // Cancel any ongoing jobs
        backgroundLoadingJob?.cancel()
        animationJob?.cancel()
        processingJob?.cancel()

        // Clean up bitmaps to prevent memory leaks
        _currentBitmap.value?.recycle()
        _currentBitmap.value = null

        viewModelScope.launch {
            framesMutex.withLock {
                for (frame in processedFrames.values) {
                    if (!frame.bitmap.isRecycled) {
                        frame.bitmap.recycle()
                    }
                }
                processedFrames.clear()
            }

            // MEMORY FIX: Clear active bitmap cache too
            activeBitmapsMutex.withLock {
                activeBitmaps.clear()
            }
        }

        // Delete all temporary files and clear the cache
        viewModelScope.launch(Dispatchers.IO) {
            fileCacheMutex.withLock {
                fileCache.values.forEach {
                    try {
                        if (it.exists()) it.delete()
                    } catch (e: Exception) {
                        Log.e(TAG, "Error deleting temp file: ${it.absolutePath}")
                    }
                }
                fileCache.clear()
            }

            // Clear image directory
            try {
                imageDir.listFiles()?.forEach { it.delete() }
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing image directory", e)
            }
        }
    }

    fun selectDomain(domain: SatelliteDomain) {
        if (_selectedDomain.value.id != domain.id) {
            Log.d(TAG, "Switching domain from ${_selectedDomain.value.id} to ${domain.id}")

            // Cancel any existing jobs
            backgroundLoadingJob?.cancel()
            animationJob?.cancel()

            // Stop animation if it's running
            if (_isAnimating.value) {
                _isAnimating.value = false
            }

            viewModelScope.launch {
                // Show loading state immediately
                _isLoading.value = true
                _currentBitmap.value = null

                // Clear frame cache when changing domains
                clearFrameCache()

                // Update selected domain
                _selectedDomain.value = domain

                // Reset current frame index
                _currentFrameIndex.value = 0

                // Reset files list
                _currentFiles.value = emptyList()
                _currentFile.value = null

                // Force the file cache to be cleared too
                fileCacheMutex.withLock {
                    fileCache.forEach { (_, file) ->
                        try {
                            if (file.exists()) file.delete()
                        } catch (e: Exception) {
                            Log.e(TAG, "Error deleting cached file: ${e.message}")
                        }
                    }
                    fileCache.clear()
                }

                // Load data for new domain
                startFetchingData(initialLoadOnly = true)
            }
        }
    }

    private fun debugCoordinateMapping(mapping: NetCDFParser.CoordinateMapping, width: Int, height: Int) {
        // Test well-known locations
        val testPoints = listOf(
            Triple("New York", 40.7128, -74.0060),
            Triple("Miami", 25.7617, -80.1918),
            Triple("Los Angeles", 34.0522, -118.2437),
            Triple("Seattle", 47.6062, -122.3321)
        )

        Log.d(TAG, "Testing coordinate mapping with image size: ${width}x${height}")

        for ((name, lat, lon) in testPoints) {
            val pixelCoords = mapping.mapToPixel(lat, lon, width, height)
            Log.d(TAG, "Test point '$name' (${lat}, ${lon}) mapped to: $pixelCoords")
        }
    }

    private fun setupChannels() {
        val channels = listOf(
            SatelliteChannel("C01", 1, "Blue", "Visible - Blue", "0.47 μm", VisualizationMethod.VISIBLE_BLUE),
            SatelliteChannel("C02", 2, "Red", "Visible - Red", "0.64 μm", VisualizationMethod.VISIBLE_RED),
            SatelliteChannel("C03", 3, "Near-IR", "Near IR - Vegetation", "0.86 μm", VisualizationMethod.VISIBLE_GREEN),
            SatelliteChannel("C04", 4, "Cirrus", "Near IR - Cirrus", "1.37 μm", VisualizationMethod.STANDARD_ENHANCED),
            SatelliteChannel("C05", 5, "Snow/Ice", "Near IR - Snow/Ice", "1.6 μm", VisualizationMethod.STANDARD_ENHANCED),
            SatelliteChannel("C06", 6, "Cloud Part.", "Near IR - Cloud Particle", "2.2 μm", VisualizationMethod.STANDARD_ENHANCED),
            SatelliteChannel("C07", 7, "SW IR", "IR - Shortwave", "3.9 μm", VisualizationMethod.FIRE_DETECTION),
            SatelliteChannel("C08", 8, "Upper WV", "IR - Upper-Level Water Vapor", "6.2 μm", VisualizationMethod.WATER_VAPOR),
            SatelliteChannel("C09", 9, "Mid WV", "IR - Mid-Level Water Vapor", "6.9 μm", VisualizationMethod.WATER_VAPOR),
            SatelliteChannel("C10", 10, "Low WV", "IR - Lower-level Water Vapor", "7.3 μm", VisualizationMethod.WATER_VAPOR),
            SatelliteChannel("C11", 11, "Cloud", "IR - Cloud-Top Phase", "8.4 μm", VisualizationMethod.COLOR_IR),
            SatelliteChannel("C12", 12, "Ozone", "IR - Ozone", "9.6 μm", VisualizationMethod.COLOR_IR),
            SatelliteChannel("C13", 13, "Clean IR", "IR - Clean Longwave Window", "10.3 μm", VisualizationMethod.CLEAN_IR_ENHANCED),
            SatelliteChannel("C14", 14, "IR LW", "IR - Longwave Window", "11.2 μm", VisualizationMethod.COLOR_IR),
            SatelliteChannel("C15", 15, "Dirty IR", "IR - Dirty Longwave Window", "12.3 μm", VisualizationMethod.COLOR_IR),
            SatelliteChannel("C16", 16, "CO2", "IR - CO2 Longwave", "13.3 μm", VisualizationMethod.COLOR_IR)
        )
        _availableChannels.value = channels
    }

    private fun startImageProcessor() {
        processingJob?.cancel()
        processingJob = viewModelScope.launch(Dispatchers.IO) {
            while (isActive) {
                try {
                    val filePath = processingQueue.poll(100, TimeUnit.MILLISECONDS)
                    if (filePath != null) {
                        processFileToImage(filePath)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error in image processor", e)
                }
            }
        }
    }

    // Create a function to generate boundaries based on domain
    private fun generateBoundaries(domain: SatelliteDomain, width: Int, height: Int) {
        viewModelScope.launch(Dispatchers.Default) {
            try {
                Log.d(TAG, "Generating boundaries for ${domain.displayName}: ${width}x${height}")

                // Create overlay bitmap with transparent background
                val overlay = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(overlay)

                // Draw boundaries
                drawGeostatinaryBoundaries(canvas, width, height)

                // Count non-empty pixels for debugging
                val nonEmptyPixels = countNonEmptyPixels(overlay)

                // Update both StateFlows to ensure the UI reflects changes
                withContext(Dispatchers.Main) {
                    _boundaryOverlay.value = overlay
                    boundaryOverlay.value = overlay

                    Log.d(TAG, "Boundary overlay updated: ${width}x${height}, non-empty pixels: $nonEmptyPixels")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error generating boundary overlay: ${e.message}", e)
            }
        }
    }

    // Helper to verify boundaries are being drawn at all
    private fun countNonEmptyPixels(bitmap: Bitmap): Int {
        var count = 0
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        for (pixel in pixels) {
            if (pixel != 0) count++
        }
        return count
    }


    // Create a simple test pattern to verify overlay display
    private fun createTestBoundaryPattern() {
        val currentBitmap = _currentBitmap.value ?: return
        val width = currentBitmap.width
        val height = currentBitmap.height

        val testOverlay = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(testOverlay)

        // Draw a grid pattern
        val paint = Paint().apply {
            color = Color.WHITE
            alpha = 255
            strokeWidth = 2f
            style = Paint.Style.STROKE
            isAntiAlias = true
        }

        // Draw grid lines
        for (x in 0 until width step 20) {
            canvas.drawLine(x.toFloat(), 0f, x.toFloat(), height.toFloat(), paint)
        }
        for (y in 0 until height step 20) {
            canvas.drawLine(0f, y.toFloat(), width.toFloat(), y.toFloat(), paint)
        }

        // Draw diagonal lines
        canvas.drawLine(0f, 0f, width.toFloat(), height.toFloat(), paint)
        canvas.drawLine(width.toFloat(), 0f, 0f, height.toFloat(), paint)

        // Update both StateFlows
        viewModelScope.launch(Dispatchers.Main) {
            _boundaryOverlay.value = testOverlay
            boundaryOverlay.value = testOverlay
            Log.d(TAG, "Test boundary pattern created")
        }
    }

    /**
     * Implements a proper GOES geostationary satellite projection
     * Based on the satellite's fixed viewing position
     */
    private fun drawGeostatinaryBoundaries(canvas: Canvas, width: Int, height: Int) {
        try {
            Log.d(TAG, "Drawing boundaries for image size: ${width}x${height}")

            // Create visible paint for country boundaries
            val countryPaint = Paint().apply {
                color = Color.YELLOW
                alpha = 200
                strokeWidth = 1.5f
                style = Paint.Style.STROKE
                isAntiAlias = true
            }

            // Create visible paint for state boundaries
            val statePaint = Paint().apply {
                color = Color.CYAN
                alpha = 180
                strokeWidth = 1.0f
                style = Paint.Style.STROKE
                isAntiAlias = true
            }

            // Process boundaries
            if (countriesGeoJson?.has("geometries") == true) {
                Log.d(TAG, "Processing country geometries")
                drawGeometries(canvas, countriesGeoJson!!.getAsJsonArray("geometries"),
                    countryPaint, width, height, _selectedDomain.value)
            }

            if (statesGeoJson?.has("geometries") == true) {
                Log.d(TAG, "Processing state geometries")
                drawGeometries(canvas, statesGeoJson!!.getAsJsonArray("geometries"),
                    statePaint, width, height, _selectedDomain.value)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error drawing boundaries: ${e.message}", e)
        }
    }

    private fun drawLatLonLine(canvas: Canvas, startLon: Double, startLat: Double,
                               endLon: Double, endLat: Double, paint: Paint, width: Int, height: Int) {
        try {
            // Draw a line from (startLon, startLat) to (endLon, endLat)
            // Use many segments to account for curvature
            val segments = 20
            var lastPoint: Pair<Float, Float>? = null

            for (i in 0..segments) {
                val fraction = i.toDouble() / segments
                val lon = startLon + (endLon - startLon) * fraction
                val lat = startLat + (endLat - startLat) * fraction

                val point = projectGoesCoordinate(lon, lat, width, height, _selectedDomain.value)

                if (!point.first.isNaN() && !point.second.isNaN() &&
                    point.first >= 0 && point.first <= width &&
                    point.second >= 0 && point.second <= height) {

                    if (lastPoint != null) {
                        canvas.drawLine(
                            lastPoint.first, lastPoint.second,
                            point.first, point.second,
                            paint
                        )
                    }
                    lastPoint = point
                } else {
                    // Start a new segment if we hit an invalid point
                    lastPoint = null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error drawing lat/lon line: ${e.message}")
        }
    }

    // Draw city markers for reference points
    private fun drawCityMarkers(canvas: Canvas, width: Int, height: Int) {
        try {
            val cityPaint = Paint().apply {
                color = Color.RED
                style = Paint.Style.FILL
                isAntiAlias = true
            }

            val textPaint = Paint().apply {
                color = Color.WHITE
                textSize = 10f
                isAntiAlias = true
                setShadowLayer(2f, 1f, 1f, Color.BLACK)
            }

            // Major US cities with lon/lat coordinates
            val cities = mapOf(
                "Miami" to Pair(-80.19, 25.76),
                "NYC" to Pair(-74.01, 40.71),
                "Chicago" to Pair(-87.63, 41.88),
                "Dallas" to Pair(-96.80, 32.78),
                "Denver" to Pair(-104.99, 39.74),
                "LA" to Pair(-118.24, 34.05),
                "Seattle" to Pair(-122.33, 47.61)
            )

            // Draw each city as a point with label
            for ((name, coords) in cities) {
                val (lon, lat) = coords
                val point = projectGoesCoordinate(lon, lat, width, height, _selectedDomain.value)

                if (!point.first.isNaN() && !point.second.isNaN() &&
                    point.first >= 0 && point.first <= width &&
                    point.second >= 0 && point.second <= height) {

                    // Draw a red dot
                    canvas.drawCircle(point.first, point.second, 3f, cityPaint)

                    // Draw the city name
                    canvas.drawText(name, point.first + 4f, point.second + 4f, textPaint)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error drawing city markers: ${e.message}")
        }
    }

    fun debugBoundaries() {
        viewModelScope.launch {
            try {
                val currentBitmap = _currentBitmap.value
                if (currentBitmap == null) {
                    Log.d(TAG, "No image loaded yet for debugging boundaries")
                    return@launch
                }

                // Simply log information about the current state rather than creating a new overlay
                Log.d(TAG, "Debug boundaries: image size=${currentBitmap.width}x${currentBitmap.height}")
                Log.d(TAG, "Current coordinate mapping available: ${currentCoordinateMapping != null}")

                if (currentCoordinateMapping != null) {
                    val gridSize = "${currentCoordinateMapping!!.latGrid.size}x${currentCoordinateMapping!!.latGrid[0].size}"
                    Log.d(TAG, "Coordinate mapping grid size: $gridSize")

                    // Test a few known points
                    val testPoints = listOf(
                        Pair(40.0, -74.0), // New York area
                        Pair(34.0, -118.0), // Los Angeles area
                        Pair(25.0, -80.0)  // Miami area
                    )

                    for ((lat, lon) in testPoints) {
                        val pixelCoords = currentCoordinateMapping!!.mapToPixel(lat, lon, currentBitmap.width, currentBitmap.height)
                        Log.d(TAG, "Test mapping: lat=$lat, lon=$lon -> pixel coords=${pixelCoords?.first}, ${pixelCoords?.second}")
                    }
                }

                // Count non-empty pixels in current overlay for verification
                val overlay = boundaryOverlay.value
                if (overlay != null) {
                    val nonEmptyPixels = countNonEmptyPixels(overlay)
                    Log.d(TAG, "Current boundary overlay: ${overlay.width}x${overlay.height}, non-empty pixels: $nonEmptyPixels")
                } else {
                    Log.d(TAG, "No boundary overlay currently available")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in debugBoundaries: ${e.message}", e)
            }
        }
    }

    private fun drawGeometries(canvas: Canvas, geometries: JsonArray, paint: Paint,
                               width: Int, height: Int, domain: SatelliteDomain) {

        // Track a sample point through the transformation
        val samplePointIndex = 0  // First geometry
        val sampleRingIndex = 0   // First ring
        val samplePointPos = 0    // First point

        // Debug counter
        var pointsProcessed = 0
        var pointsDrawn = 0
        var totalGeometries = geometries.size()

        // Loop through all geometries
        for (i in 0 until totalGeometries) {
            try {
                val geometry = geometries.get(i).asJsonObject
                val type = geometry.get("type")?.asString ?: continue

                when (type) {
                    "Polygon" -> {
                        val coordinates = geometry.getAsJsonArray("coordinates")
                        if (coordinates != null) {
                            // Debug sample point if it matches our target
                            if (i == samplePointIndex) {
                                Log.d(TAG, "SAMPLE GEOMETRY DEBUG (Polygon #$i) ======")
                                debugGeometryCoordinates(coordinates, sampleRingIndex, samplePointPos, width, height)
                            }

                            // Use coordinate mapping when available
                            if (currentCoordinateMapping != null) {
                                // Track how many points are successfully mapped
                                val pointsBefore = pointsDrawn
                                parser.drawSatellitePolygon(canvas, coordinates, paint, width, height, domain, currentCoordinateMapping)
                                // This needs implementation in your parser class
                                pointsDrawn += trackPointsDrawn(coordinates)
                                Log.d(TAG, "Polygon #$i: Processed with coordinate mapping, drew ${pointsDrawn - pointsBefore} points")
                            } else {
                                drawSimplePolygon(canvas, coordinates, paint, width, height, domain)
                            }
                        }
                    }
                    "MultiPolygon" -> {
                        val polys = geometry.getAsJsonArray("coordinates")
                        if (polys != null) {
                            for (j in 0 until polys.size()) {
                                val polygon = polys.get(j).asJsonArray
                                if (polygon != null) {
                                    // Same logic as above - prioritize coordinate mapping
                                    if (currentCoordinateMapping != null) {
                                        parser.drawSatellitePolygon(canvas, polygon, paint, width, height, domain, currentCoordinateMapping)
                                    } else {
                                        Log.w(TAG, "Falling back to simple polygon for multipolygon $i,$j - no coordinate mapping available")
                                        drawSimplePolygon(canvas, polygon, paint, width, height, domain)
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error processing geometry #$i: ${e.message}")
                continue
            }
        }
        Log.d(TAG, "Draw geometries summary: $pointsDrawn points drawn out of $pointsProcessed processed")
    }

    // Helper method to debug a specific geometry point
    private fun debugGeometryCoordinates(coordinates: JsonArray, ringIndex: Int, pointPos: Int,
                                         width: Int, height: Int) {
        try {
            if (coordinates.size() <= ringIndex) {
                Log.d(TAG, "Ring index $ringIndex is out of bounds (max: ${coordinates.size()-1})")
                return
            }

            val ring = coordinates.get(ringIndex).asJsonArray
            if (ring.size() <= pointPos) {
                Log.d(TAG, "Point position $pointPos is out of bounds in ring $ringIndex (max: ${ring.size()-1})")
                return
            }

            val point = ring.get(pointPos).asJsonArray
            if (point.size() < 2) {
                Log.d(TAG, "Invalid point format at ring $ringIndex, pos $pointPos")
                return
            }

            val lon = point.get(0).asDouble
            val lat = point.get(1).asDouble

            Log.d(TAG, "Sample point: lat=$lat, lon=$lon")

            // Test different mapping methods
            val mappedPixel = currentCoordinateMapping?.mapToPixel(lat, lon, width, height)
            Log.d(TAG, "  Mapped with coordinate mapping: $mappedPixel")

            val projectGoesPixel = projectGoesCoordinate(lon, lat, width, height, _selectedDomain.value)
            Log.d(TAG, "  Mapped with projectGoesCoordinate: $projectGoesPixel")

            val simpleX = simpleProjectX(lon, width)
            val simpleY = simpleProjectY(lat, height)
            Log.d(TAG, "  Mapped with simple projection: ($simpleX, $simpleY)")
        } catch (e: Exception) {
            Log.e(TAG, "Error debugging geometry coordinates: ${e.message}")
        }
    }

    // Helper to estimate how many points were drawn
    private fun trackPointsDrawn(coordinates: JsonArray): Int {
        var count = 0
        try {
            for (i in 0 until coordinates.size()) {
                val ring = coordinates.get(i).asJsonArray ?: continue
                count += ring.size()
            }
        } catch (e: Exception) {
            // Ignore errors
        }
        return count
    }

    private fun drawSimplePolygon(canvas: Canvas, coordinates: JsonArray, paint: Paint,
                                  width: Int, height: Int, domain: SatelliteDomain) {
        try {
            // Get first ring (outer boundary)
            val ring = coordinates.get(0).asJsonArray ?: return

            val path = Path()
            var pathStarted = false

            // Process polygon points
            for (i in 0 until ring.size()) {
                try {
                    val point = ring.get(i).asJsonArray ?: continue
                    val lon = point.get(0).asDouble
                    val lat = point.get(1).asDouble

                    // Use simple projection that always works regardless of satellite data
                    val x = simpleProjectX(lon, width)
                    val y = simpleProjectY(lat, height)

                    if (!x.isNaN() && !y.isNaN()) {
                        if (!pathStarted) {
                            path.moveTo(x, y)
                            pathStarted = true
                        } else {
                            path.lineTo(x, y)
                        }
                    }
                } catch (e: Exception) {
                    continue // Skip problematic points
                }
            }

            if (pathStarted) {
                path.close()
                canvas.drawPath(path, paint)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error drawing simple polygon: ${e.message}")
        }
    }

    // Modified boundary drawing using coordinate mapping
    private fun drawSatellitePolygon(canvas: Canvas, coordinates: JsonArray, paint: Paint,
                                     width: Int, height: Int, domain: SatelliteDomain) {
        try {
            // Skip if no coordinate mapping
            val mapping = currentCoordinateMapping
            if (mapping == null) {
                Log.w(TAG, "No coordinate mapping available for boundary drawing")
                // Instead of returning, use the simple drawing as fallback
                drawSimplePolygon(canvas, coordinates, paint, width, height, domain)
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


    // Get projection parameters based on domain
    private fun getDomainProjectionParams(domain: SatelliteDomain, width: Int, height: Int): Quad<Float, Float, Float, Float> {
        // Returns (xScale, yScale, xOffset, yOffset)
        return when (domain) {
            SatelliteDomain.FULL_DISK -> {
                Quad(width/2f, height/2f, width/2f, height/2f)
            }
            SatelliteDomain.CONUS -> {
                // Adjusted for the standard CONUS view
                val scale = width / 0.28f
                Quad(scale, scale, width/2f, height/2f)
            }
            SatelliteDomain.MESOSCALE_1, SatelliteDomain.MESOSCALE_2 -> {
                // Mesoscale domains need different scaling
                val scale = width / 0.15f
                Quad(scale, scale, width/2f, height/2f)
            }
            else -> {
                // Regional views
                val scale = width / 0.12f
                Quad(scale, scale, width/2f, height/2f)
            }
        }
    }

    // Improved GOES-16 specific projection
    private fun projectGoesCoordinate(lon: Double, lat: Double, width: Int, height: Int, domain: SatelliteDomain): Pair<Float, Float> {
        try {
            // GOES-16 satellite constants (realistic values)
            val satLon = -75.2  // GOES-East positioned at 75.2°W
            val satHeight = 35786.0  // Satellite height in km
            val earthRadius = 6378.1  // Earth radius in km

            // Convert lat/lon to radians
            val latRad = Math.toRadians(lat)
            val lonRad = Math.toRadians(lon - satLon)  // Longitude relative to satellite

            // Geocentric coordinates (account for Earth's curvature)
            val cosLat = Math.cos(latRad)
            val sinLat = Math.sin(latRad)
            val cosLon = Math.cos(lonRad)
            val sinLon = Math.sin(lonRad)

            // Calculate 3D position relative to satellite
            val x = earthRadius * cosLat * sinLon
            val y = earthRadius * sinLat
            val z = earthRadius * cosLat * cosLon - (satHeight + earthRadius)

            // Check if point is visible from satellite (behind Earth's limb)
            if (z >= 0) return Pair(Float.NaN, Float.NaN)

            // Project onto satellite view plane
            val k = -satHeight / z
            val projX = x * k
            val projY = y * k

            // Apply different scaling/positioning based on domain
            when (domain) {
                SatelliteDomain.CONUS -> {
                    // For CONUS view - THESE VALUES ARE CRITICAL
                    // The issue was with these scaling parameters
                    val scaleX = width / 0.31  // Adjusted from previous value
                    val scaleY = height / 0.18  // Adjusted from previous value

                    // These offset values center the projection in the viewport
                    val offsetX = width * 0.53  // Slightly right of center
                    val offsetY = height * 0.46  // Slightly above center

                    val pixelX = (projX * scaleX + offsetX).toFloat()
                    val pixelY = (projY * scaleY + offsetY).toFloat()

                    return Pair(pixelX, pixelY)
                }
                SatelliteDomain.FULL_DISK -> {
                    // Full disk scaling
                    val scaleX = width / 0.15
                    val scaleY = height / 0.15
                    val offsetX = width / 2
                    val offsetY = height / 2

                    val pixelX = (projX * scaleX + offsetX).toFloat()
                    val pixelY = (projY * scaleY + offsetY).toFloat()

                    return Pair(pixelX, pixelY)
                }
                else -> {
                    // Regional views
                    val (scale, offsetX, offsetY) = when (domain) {
                        SatelliteDomain.NORTHWEST -> Triple(width / 0.10, width * 0.35, height * 0.35)
                        SatelliteDomain.NORTHEAST -> Triple(width / 0.10, width * 0.65, height * 0.35)
                        SatelliteDomain.SOUTHWEST -> Triple(width / 0.10, width * 0.35, height * 0.65)
                        SatelliteDomain.SOUTHEAST -> Triple(width / 0.10, width * 0.65, height * 0.65)
                        SatelliteDomain.OKLAHOMA -> Triple(width / 0.06, width * 0.50, height * 0.50)
                        SatelliteDomain.TEXAS -> Triple(width / 0.08, width * 0.50, height * 0.60)
                        else -> Triple(width / 0.10, width * 0.50, height * 0.50)
                    }

                    val scaleX = scale
                    val scaleY = scale

                    val pixelX = (projX * scaleX + offsetX).toFloat()
                    val pixelY = (projY * scaleY + offsetY).toFloat()

                    return Pair(pixelX, pixelY)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Projection error: ${e.message}")
            return Pair(Float.NaN, Float.NaN)
        }
    }

    // Helper class for returning four values
    data class Quad<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

    /**
     * Get scaling factors specific to each domain to properly fit the image
     */
    private fun getDomainScaleFactors(domain: SatelliteDomain, width: Int, height: Int):
            Quad<Double, Double, Double, Double> {
        // Returns (xScale, yScale, xOffset, yOffset)
        when (domain) {
            SatelliteDomain.FULL_DISK -> {
                // Full disk needs to fit the entire Earth disk
                return Quad(width / 0.15, height / 0.15, width / 2.0, height / 2.0)
            }
            SatelliteDomain.CONUS -> {
                // CONUS is a zoomed section
                return Quad(width / 0.06, height / 0.06, width / 2.0, height / 2.0)
            }
            else -> {
                // Regional views
                val bounds = domain.regionBounds
                if (bounds != null) {
                    return Quad(width / 0.02, height / 0.02, width / 2.0, height / 2.0)
                }
                // Default
                return Quad(width / 0.1, height / 0.1, width / 2.0, height / 2.0)
            }
        }
    }

    /**
     * Project a lat/lon point to x/y coordinates using geostationary satellite projection
     * Returns a Pair of x,y coordinates in normalized space (-0.075 to 0.075 range)
     */
    private fun projectGeostationary(lon: Double, lat: Double, satelliteHeight: Double,
                                     satelliteLongitude: Double, semiMajorAxis: Double,
                                     semiMinorAxis: Double): Pair<Double, Double> {
        // Convert to radians
        val lambda = Math.toRadians(lon - satelliteLongitude) // Longitude from satellite
        val phi = Math.toRadians(lat) // Latitude

        // Calculate geocentric latitude (adjusts for Earth's ellipsoidal shape)
        val geocentricLat = Math.atan(Math.tan(phi) * (semiMinorAxis / semiMajorAxis) *
                (semiMinorAxis / semiMajorAxis))

        // Calculate distances
        val rEarth = semiMajorAxis / Math.sqrt(1.0 - (1.0 - (semiMinorAxis/semiMajorAxis) *
                (semiMinorAxis/semiMajorAxis)) * Math.sin(geocentricLat) * Math.sin(geocentricLat))

        // Point coordinates relative to satellite
        val x = rEarth * Math.cos(geocentricLat) * Math.sin(lambda)
        val y = rEarth * Math.sin(geocentricLat)
        val z = rEarth * Math.cos(geocentricLat) * Math.cos(lambda) - (satelliteHeight + semiMajorAxis)

        // Project to satellite view
        val denominator = satelliteHeight + z
        if (denominator <= 0) {
            // Point not visible from satellite
            return Pair(Double.NaN, Double.NaN)
        }

        // Normalize the projected coordinates (-0.075 to 0.075 range for typical view)
        val projX = x / denominator * 0.075
        val projY = y / denominator * 0.075

        return Pair(projX, projY)
    }

    private fun drawCountryBoundaries(canvas: Canvas, width: Int, height: Int) {
        val paint = Paint().apply {
            color = Color.WHITE
            alpha = 255
            strokeWidth = 2f
            style = Paint.Style.STROKE
            isAntiAlias = true
        }

        if (countriesGeoJson == null) {
            Log.w(TAG, "Countries GeoJSON not loaded")
            return
        }

        try {
            // Check if this is a GeometryCollection format
            if (countriesGeoJson?.has("geometries") == true) {
                val geometries = countriesGeoJson?.getAsJsonArray("geometries")
                if (geometries == null) {
                    Log.w(TAG, "No geometries found in countries GeoJSON")
                    return
                }

                for (i in 0 until geometries.size()) {
                    try {
                        val geometry = geometries.get(i).asJsonObject
                        val type = geometry?.get("type")?.asString

                        when (type) {
                            "Polygon" -> {
                                val coordinates = geometry.getAsJsonArray("coordinates")
                                if (coordinates != null) {
                                    drawPolygon(canvas, coordinates, paint, width, height)
                                }
                            }
                            "MultiPolygon" -> {
                                val coordinates = geometry.getAsJsonArray("coordinates")
                                if (coordinates != null) {
                                    for (j in 0 until coordinates.size()) {
                                        val polygon = coordinates.get(j).asJsonArray
                                        if (polygon != null) {
                                            drawPolygon(canvas, polygon, paint, width, height)
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error processing geometry: ${e.message}")
                        continue
                    }
                }
            }
            // Check if this is a FeatureCollection format
            else if (countriesGeoJson?.has("features") == true) {
                val features = countriesGeoJson?.getAsJsonArray("features")
                if (features == null) {
                    Log.w(TAG, "No features found in countries GeoJSON")
                    return
                }

                for (i in 0 until features.size()) {
                    try {
                        val feature = features.get(i).asJsonObject
                        val geometry = feature?.getAsJsonObject("geometry")
                        if (geometry == null) continue

                        val type = geometry.get("type")?.asString

                        when (type) {
                            "Polygon" -> {
                                val coordinates = geometry.getAsJsonArray("coordinates")
                                if (coordinates != null) {
                                    drawPolygon(canvas, coordinates, paint, width, height)
                                }
                            }
                            "MultiPolygon" -> {
                                val coordinates = geometry.getAsJsonArray("coordinates")
                                if (coordinates != null) {
                                    for (j in 0 until coordinates.size()) {
                                        val polygon = coordinates.get(j).asJsonArray
                                        if (polygon != null) {
                                            drawPolygon(canvas, polygon, paint, width, height)
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error processing feature: ${e.message}")
                        continue
                    }
                }
            } else {
                Log.w(TAG, "Unknown GeoJSON format for countries")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error drawing country boundaries: ${e.message}", e)
        }
    }

    private fun drawStateBoundaries(canvas: Canvas, width: Int, height: Int) {
        val paint = Paint().apply {
            color = Color.WHITE
            alpha = 255
            strokeWidth = 1.5f
            style = Paint.Style.STROKE
            isAntiAlias = true
        }

        if (statesGeoJson == null) {
            Log.w(TAG, "States GeoJSON not loaded")
            return
        }

        try {
            // Check if this is a GeometryCollection format
            if (statesGeoJson?.has("geometries") == true) {
                val geometries = statesGeoJson?.getAsJsonArray("geometries")
                if (geometries == null) {
                    Log.w(TAG, "No geometries found in states GeoJSON")
                    return
                }

                for (i in 0 until geometries.size()) {
                    try {
                        val geometry = geometries.get(i).asJsonObject
                        val type = geometry?.get("type")?.asString

                        when (type) {
                            "Polygon" -> {
                                val coordinates = geometry.getAsJsonArray("coordinates")
                                if (coordinates != null) {
                                    drawPolygon(canvas, coordinates, paint, width, height)
                                }
                            }
                            "MultiPolygon" -> {
                                val coordinates = geometry.getAsJsonArray("coordinates")
                                if (coordinates != null) {
                                    for (j in 0 until coordinates.size()) {
                                        val polygon = coordinates.get(j).asJsonArray
                                        if (polygon != null) {
                                            drawPolygon(canvas, polygon, paint, width, height)
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error processing geometry: ${e.message}")
                        continue
                    }
                }
            }
            // Check if this is a FeatureCollection format
            else if (statesGeoJson?.has("features") == true) {
                val features = statesGeoJson?.getAsJsonArray("features")
                if (features == null) {
                    Log.w(TAG, "No features found in states GeoJSON")
                    return
                }

                // Process each state - same code as before
                // [Rest of the existing feature processing code]
            } else {
                Log.w(TAG, "Unknown GeoJSON format for states")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error drawing state boundaries: ${e.message}", e)
        }
    }

    private fun drawCountyBoundaries(canvas: Canvas, width: Int, height: Int) {
        val paint = Paint().apply {
            color = Color.WHITE
            alpha = 255
            strokeWidth = 2f
            style = Paint.Style.STROKE
            isAntiAlias = true
        }

        // Only draw counties for the current region's bounds
        val domain = _selectedDomain.value
        val bounds = domain.regionBounds

        try {
            // Get features array safely
            val features = countiesGeoJson?.getAsJsonArray("features")
            if (features == null) {
                Log.w(TAG, "No features found in counties GeoJSON")
                return
            }

            // Process each county
            for (i in 0 until features.size()) {
                try {
                    val feature = features.get(i).asJsonObject

                    // Check if county is in current region bounds before drawing
                    if (bounds != null && !isFeatureInBounds(feature, bounds)) {
                        continue // Skip counties outside the region
                    }

                    val geometry = feature?.getAsJsonObject("geometry") ?: continue
                    val type = geometry.get("type")?.asString ?: continue

                    when (type) {
                        "Polygon" -> {
                            val coordinates = geometry.getAsJsonArray("coordinates")
                            if (coordinates != null) {
                                drawPolygon(canvas, coordinates, paint, width, height)
                            }
                        }
                        "MultiPolygon" -> {
                            val polygons = geometry.getAsJsonArray("coordinates")
                            if (polygons != null) {
                                for (j in 0 until polygons.size()) {
                                    val polygon = polygons.get(j).asJsonArray
                                    if (polygon != null) {
                                        drawPolygon(canvas, polygon, paint, width, height)
                                    }
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    // Skip this feature and continue with others
                    Log.w(TAG, "Error processing county feature: ${e.message}")
                    continue
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error drawing county boundaries: ${e.message}", e)
        }
    }

    private fun drawPolygon(canvas: Canvas, coordinates: JsonArray, paint: Paint, width: Int, height: Int) {
        try {
            // Skip empty coordinates
            if (coordinates.size() == 0) return

            // Get first ring (outer boundary)
            val ring = coordinates.get(0)
            if (!ring.isJsonArray) return

            val ringArray = ring.asJsonArray
            if (ringArray.size() < 3) return // Need at least 3 points for a polygon

            val path = Path()
            var pathStarted = false
            var lastX = 0f
            var lastY = 0f

            // Process all points and build the path
            for (i in 0 until ringArray.size()) {
                try {
                    val point = ringArray.get(i)
                    if (!point.isJsonArray) continue

                    val pointArray = point.asJsonArray
                    if (pointArray.size() < 2) continue

                    val lon = pointArray.get(0).asDouble
                    val lat = pointArray.get(1).asDouble

                    // Simple scaling approach that preserves the satellite's perspective distortion
                    val x = simpleProjectX(lon, width)
                    val y = simpleProjectY(lat, height)

                    // Skip invalid points
                    if (x.isNaN() || y.isNaN() || x.isInfinite() || y.isInfinite()) {
                        continue
                    }

                    // Start path with first valid point
                    if (!pathStarted) {
                        path.moveTo(x, y)
                        pathStarted = true
                        lastX = x
                        lastY = y
                    } else {
                        // Add line segment to the path - only if the distance isn't too large
                        // This helps prevent long horizontal or vertical lines across the image
                        val deltaX = x - lastX
                        val deltaY = y - lastY
                        val distance = Math.sqrt((deltaX * deltaX + deltaY * deltaY).toDouble())

                        // Only connect points that are relatively close - prevents strange lines across image
                        if (distance < width / 4) { // Adjust this threshold as needed
                            path.lineTo(x, y)
                            lastX = x
                            lastY = y
                        } else {
                            // For distant points, start a new sub-path
                            path.moveTo(x, y)
                            lastX = x
                            lastY = y
                        }
                    }
                } catch (e: Exception) {
                    // Skip problematic points
                    Log.d(TAG, "Error processing point: ${e.message}")
                    continue
                }
            }

            if (pathStarted) {
                path.close()
                canvas.drawPath(path, paint)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error drawing polygon: ${e.message}")
        }
    }

    // Simpler projection functions
    private fun simpleProjectX(lon: Double, width: Int): Float {
        val domain = _selectedDomain.value

        // GOES-16 is at 75.2° W longitude
        val satelliteLon = -75.2

        when (domain) {
            SatelliteDomain.FULL_DISK -> {
                // For full disk, use a simple non-linear transformation
                // that exaggerates distortion further from satellite longitude

                // Normalize longitude difference from satellite
                val lonDiff = lon - satelliteLon

                // Apply a simple non-linear function that increases distortion at edges
                // This is a simplified approximation
                val normalizedX = 0.5 + (lonDiff / 180.0) * (0.7 + 0.3 * Math.abs(lonDiff) / 180.0)

                return (normalizedX * width).toFloat().coerceIn(0f, width.toFloat())
            }
            SatelliteDomain.CONUS -> {
                // CONUS boundaries - approximate for GOES-16
                val minLon = -130.0
                val maxLon = -65.0

                // Apply a simple scaling with minor non-linearity for satellite perspective
                val normalizedX = (lon - minLon) / (maxLon - minLon)
                // Add slight non-linearity based on distance from satellite longitude
                val distortion = 0.15 * Math.pow((lon - satelliteLon) / (maxLon - minLon), 2.0)
                val adjustedX = normalizedX + distortion * Math.signum(lon - satelliteLon)

                return (adjustedX * width).toFloat().coerceIn(0f, width.toFloat())
            }
            else -> {
                // For regional views, use simple linear scaling with region bounds
                val bounds = domain.regionBounds
                if (bounds != null) {
                    val minLon = bounds[2].toDouble()
                    val maxLon = bounds[3].toDouble()

                    val normalizedX = (lon - minLon) / (maxLon - minLon)
                    return (normalizedX * width).toFloat().coerceIn(0f, width.toFloat())
                }

                // Default fallback
                return ((lon + 180.0) / 360.0 * width).toFloat().coerceIn(0f, width.toFloat())
            }
        }
    }

    private fun simpleProjectY(lat: Double, height: Int): Float {
        val domain = _selectedDomain.value

        when (domain) {
            SatelliteDomain.FULL_DISK -> {
                // For full disk, use a simple non-linear transformation for Earth curvature
                // Simplified version of perspective projection

                // This gives a basic approximation of the satellite view distortion
                // Equator is at 0.5*height, with increasing compression toward the poles
                val normalizedY = 0.5 - 0.5 * Math.sin(Math.toRadians(lat))

                return (normalizedY * height).toFloat().coerceIn(0f, height.toFloat())
            }
            SatelliteDomain.CONUS -> {
                // CONUS boundaries
                val minLat = 24.0
                val maxLat = 50.0

                // Simple linear mapping for latitude
                val normalizedY = 1.0 - (lat - minLat) / (maxLat - minLat)

                return (normalizedY * height).toFloat().coerceIn(0f, height.toFloat())
            }
            else -> {
                // For regional views, use simple linear scaling with region bounds
                val bounds = domain.regionBounds
                if (bounds != null) {
                    val minLat = bounds[0].toDouble()
                    val maxLat = bounds[1].toDouble()

                    val normalizedY = 1.0 - (lat - minLat) / (maxLat - minLat)
                    return (normalizedY * height).toFloat().coerceIn(0f, height.toFloat())
                }

                // Default fallback
                return ((90.0 - lat) / 180.0 * height).toFloat().coerceIn(0f, height.toFloat())
            }
        }
    }

    // Check if a feature is within the regional bounds
    private fun isFeatureInBounds(feature: JsonObject, bounds: Array<Float>): Boolean {
        // Extract feature centroid or bounding box from feature properties
        // This is a simplification - real implementation would be more precise
        val props = feature.getAsJsonObject("properties")
        if (props.has("CENTROID_X") && props.has("CENTROID_Y")) {
            val lon = props.get("CENTROID_X").asFloat
            val lat = props.get("CENTROID_Y").asFloat
            return (lat >= bounds[0] && lat <= bounds[1] &&
                    lon >= bounds[2] && lon <= bounds[3])
        }
        return true  // Default to showing if we can't determine
    }

    // Project longitude to X coordinate with proper geostationary perspective
    private fun projectLongitudeToX(lon: Double, width: Int): Float {
        val domain = _selectedDomain.value

        // GOES-16 satellite position (75°W)
        val satelliteLongitude = -75.0

        when (domain) {
            SatelliteDomain.FULL_DISK -> {
                // For full disk, use true geostationary projection
                val lambda = Math.toRadians(lon - satelliteLongitude)
                val cosLat = Math.cos(Math.toRadians(0.0)) // For simplicity, use equator

                // Calculate x position using geostationary projection formula
                // For a point to be visible: -π/2 < λcos(φ) < π/2
                if (Math.abs(lambda * cosLat) > Math.PI / 2) {
                    return Float.NaN // Point is not visible from satellite
                }

                // Convert to normalized coordinate (0-1 range)
                val x = 0.5 + Math.tan(lambda * cosLat) / Math.PI

                // Scale to image width
                return (x * width).toFloat()
            }
            SatelliteDomain.CONUS -> {
                // For CONUS, use a modified projection that accounts for satellite view
                val minLon = -130.0
                val maxLon = -65.0

                // Calculate angular distance from satellite meridian
                val lambda = Math.toRadians(lon - satelliteLongitude)
                val cosLat = Math.cos(Math.toRadians(35.0)) // Approximate middle latitude of CONUS

                // Normalize using non-linear scaling to account for satellite perspective
                val x = (Math.tan(lambda * cosLat) - Math.tan(Math.toRadians(minLon - satelliteLongitude) * cosLat)) /
                        (Math.tan(Math.toRadians(maxLon - satelliteLongitude) * cosLat) -
                                Math.tan(Math.toRadians(minLon - satelliteLongitude) * cosLat))

                // Scale to image width
                return (x * width).toFloat().coerceIn(0f, width.toFloat())
            }
            else -> {
                // For regional views, use region bounds with perspective adjustment
                val bounds = domain.regionBounds
                if (bounds != null) {
                    val minLon = bounds[2].toDouble()
                    val maxLon = bounds[3].toDouble()
                    val midLat = (bounds[0] + bounds[1]) / 2.0

                    // Calculate angular distance from satellite
                    val lambda = Math.toRadians(lon - satelliteLongitude)
                    val cosLat = Math.cos(Math.toRadians(midLat))

                    // Normalize using non-linear scaling for this region
                    val x = (Math.tan(lambda * cosLat) - Math.tan(Math.toRadians(minLon - satelliteLongitude) * cosLat)) /
                            (Math.tan(Math.toRadians(maxLon - satelliteLongitude) * cosLat) -
                                    Math.tan(Math.toRadians(minLon - satelliteLongitude) * cosLat))

                    // Scale to image width with bounds checking
                    return (x * width).toFloat().coerceIn(0f, width.toFloat())
                } else {
                    // Default fallback
                    val x = ((lon + 180.0) / 360.0 * width).toFloat()
                    return x.coerceIn(0f, width.toFloat())
                }
            }
        }
    }

    // Project latitude to Y coordinate with proper geostationary perspective
    private fun projectLatitudeToY(lat: Double, height: Int): Float {
        val domain = _selectedDomain.value

        // GOES-16 satellite position (75°W, 0°N, 35786km altitude)
        val satelliteLongitude = -75.0
        val satelliteHeight = 35786.0 // km above Earth's surface
        val earthRadius = 6371.0 // km

        when (domain) {
            SatelliteDomain.FULL_DISK -> {
                // Convert latitude to radians
                val phi = Math.toRadians(lat)

                // Calculate normalized y position for geostationary view
                // This accounts for the curvature as seen from geostationary orbit

                // A geostationary projection requires complex math to be exact, but
                // we can use a simpler approximation since we're just drawing boundaries

                // Project as if satellite is directly above the equator at the meridian
                // y = 0.5 - 0.5 * sin(φ) * (1 + h/R) / (1 + (h/R) * cos(φ))
                // where h is satellite height and R is Earth radius

                val hOverR = satelliteHeight / earthRadius
                val y = 0.5 - 0.5 * Math.sin(phi) * (1 + hOverR) / (1 + hOverR * Math.cos(phi))

                // Scale to image height
                return (y * height).toFloat().coerceIn(0f, height.toFloat())
            }
            SatelliteDomain.CONUS -> {
                // For CONUS, use a modified projection specific to this region
                val minLat = 24.0
                val maxLat = 50.0

                // Apply non-linear transformation to account for satellite view
                val phi = Math.toRadians(lat)
                val minPhi = Math.toRadians(minLat)
                val maxPhi = Math.toRadians(maxLat)

                // Calculate satellite-perspective y coordinate
                val hOverR = satelliteHeight / earthRadius
                val y = (Math.sin(phi) * (1 + hOverR) / (1 + hOverR * Math.cos(phi)) -
                        Math.sin(minPhi) * (1 + hOverR) / (1 + hOverR * Math.cos(minPhi))) /
                        (Math.sin(maxPhi) * (1 + hOverR) / (1 + hOverR * Math.cos(maxPhi)) -
                                Math.sin(minPhi) * (1 + hOverR) / (1 + hOverR * Math.cos(minPhi)))

                // Invert Y axis (0 at top, height at bottom)
                return ((1 - y) * height).toFloat().coerceIn(0f, height.toFloat())
            }
            else -> {
                // For regional views, use region bounds with perspective adjustment
                val bounds = domain.regionBounds
                if (bounds != null) {
                    val minLat = bounds[0].toDouble()
                    val maxLat = bounds[1].toDouble()

                    // Apply non-linear transformation for satellite view
                    val phi = Math.toRadians(lat)
                    val minPhi = Math.toRadians(minLat)
                    val maxPhi = Math.toRadians(maxLat)

                    // Calculate satellite-perspective y coordinate
                    val hOverR = satelliteHeight / earthRadius
                    val y = (Math.sin(phi) * (1 + hOverR) / (1 + hOverR * Math.cos(phi)) -
                            Math.sin(minPhi) * (1 + hOverR) / (1 + hOverR * Math.cos(minPhi))) /
                            (Math.sin(maxPhi) * (1 + hOverR) / (1 + hOverR * Math.cos(maxPhi)) -
                                    Math.sin(minPhi) * (1 + hOverR) / (1 + hOverR * Math.cos(minPhi)))

                    // Invert Y axis (0 at top, height at bottom)
                    return ((1 - y) * height).toFloat().coerceIn(0f, height.toFloat())
                } else {
                    // Default fallback
                    return ((90.0 - lat) / 180.0 * height).toFloat().coerceIn(0f, height.toFloat())
                }
            }
        }
    }

    /**
     * Get a NetCDF file from the cache
     */
    private suspend fun getFileFromCache(filePath: String): File? {
        var file: File? = null
        fileCacheMutex.withLock {
            file = fileCache[filePath]
        }

        if (file == null || !file!!.exists()) {
            // Download the file if not in cache
            file = downloadFile(filePath)
        }

        return file
    }

    /**
     * Download a file from S3 and add to cache
     */

    private suspend fun downloadFile(filePath: String): File? {
        try {
            // Create a temporary file
            val tempFileName = "sat_${System.currentTimeMillis()}.nc"
            val tempFile = File(cacheDir, tempFileName)

            Log.d(TAG, "Downloading file: $filePath")

            // Determine download method based on domain
            val domain = _selectedDomain.value
            val downloadSuccess = withContext(Dispatchers.IO) {
                when {
                    // Mesoscale domains use NCSS directly
                    domain == SatelliteDomain.MESOSCALE_1 || domain == SatelliteDomain.MESOSCALE_2 -> {
                        if (filePath.contains("thredds") || filePath.contains("ncss")) {
                            // Direct NCSS URL
                            fetcher.fetchMesoscaleFile(filePath, tempFile)
                        } else {
                            // S3 path
                            fetcher.fetchFile(bucket, filePath, tempFile, domain, needsMapping = true)
                        }
                    }

                    // Regional domains use NCSS with bounds
                    domain.isRegional && domain.regionBounds != null -> {
                        fetcher.fetchRegionalData(filePath, tempFile, domain.regionBounds!!)
                    }

                    // CONUS and Full Disk domains always need mapping for proper boundaries
                    domain == SatelliteDomain.CONUS || domain == SatelliteDomain.FULL_DISK -> {
                        fetcher.fetchFile(bucket, filePath, tempFile, domain, needsMapping = true)
                    }

                    // Other domains use standard S3 download
                    else -> fetcher.fetchFile(bucket, filePath, tempFile, domain, needsMapping = true)
                }
            }

            if (!downloadSuccess || !tempFile.exists()) {
                Log.e(TAG, "Failed to download file: $filePath")
                return null
            }

            // Add to file cache
            fileCacheMutex.withLock {
                // Manage cache size
                if (fileCache.size >= 5) {
                    val oldestKey = fileCache.keys.firstOrNull { it != filePath }
                    if (oldestKey != null) {
                        val oldFile = fileCache[oldestKey]
                        fileCache.remove(oldestKey)

                        // Only delete if not in use by any frame
                        var inUse = false
                        framesMutex.withLock {
                            inUse = processedFrames.any { it.value.filePath == oldestKey }
                        }

                        if (!inUse && oldFile?.exists() == true) {
                            oldFile.delete()
                        }
                    }
                }

                fileCache[filePath] = tempFile
            }

            return tempFile
        } catch (e: Exception) {
            Log.e(TAG, "Error downloading file: ${e.message}", e)
            return null
        }
    }

    /**
     * Get a unique image filename for a NetCDF file path
     */
    private fun getImageFileForPath(filePath: String): File {
        val channel = _selectedChannel.value?.id ?: "unknown"
        val visualization = currentVisualizationMethod.name.lowercase()

        // Create a hash from the path for uniqueness
        val hash = filePath.hashCode().toString(16)

        // Extract timestamp from path if possible
        val timestamp = extractTimestampForFile(filePath) ?: "unknown"

        // Create filename: channel_visualization_timestamp_hash.jpg
        val filename = "${channel}_${visualization}_${timestamp}_${hash}.jpg"

        return File(imageDir, filename)
    }

    /**
     * Extract timestamp in a format suitable for filenames
     */
    private fun extractTimestampForFile(filename: String): String? {
        val regex = "_s(\\d{4})(\\d{3})(\\d{2})(\\d{2})".toRegex()
        val matchResult = regex.find(filename) ?: return null

        val (year, dayOfYear, hour, minute) = matchResult.destructured
        return "${year}${dayOfYear}${hour}${minute}"
    }


    /**
     * Save a bitmap to a JPEG file
     */
    private fun saveImageToFile(bitmap: Bitmap, file: File) {
        try {
            // Make parent directories if they don't exist
            file.parentFile?.mkdirs()

            // If file exists, delete it
            if (file.exists()) {
                file.delete()
            }

            FileOutputStream(file).use { out ->
                // Save as JPEG with 90% quality for good balance between size and quality
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
                out.flush()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error saving image to file: ${e.message}", e)
        }
    }

    /**
     * Load an image from a file
     */
    private fun loadImageFromFile(file: File) {
        try {
            if (!file.exists()) {
                Log.e(TAG, "Image file doesn't exist: ${file.absolutePath}")
                return
            }

            // Extract timestamp from filename
            val timestamp = extractTimestamp(file.name) ?: "--:-- UTC"

            // Load the bitmap
            val options = BitmapFactory.Options().apply {
                inPreferredConfig = Bitmap.Config.RGB_565 // Use RGB_565 for memory efficiency
            }

            val bitmap = BitmapFactory.decodeFile(file.absolutePath, options)
                ?: throw IOException("Failed to decode bitmap from file")

            // Get dimensions
            val dimensions = Pair(bitmap.height, bitmap.width)

            // Create a frame object
            val filePath = _currentFile.value ?: ""
            val frame = SatelliteFrame(
                bitmap = bitmap,
                timestamp = timestamp,
                filePath = filePath,
                dimensions = dimensions,
                dataRange = Pair(0f, 1000f) // Default data range
            )

            // Update UI
            _currentBitmap.value = bitmap
            _currentTimestamp.value = timestamp
            _dimensions.value = dimensions
            _dataRange.value = Pair(0f, 1000f) // Default data range

            // Store in cache
            runBlocking {
                framesMutex.withLock {
                    processedFrames[filePath] = frame
                }

                // MEMORY FIX: Store reference to active bitmap
                activeBitmapsMutex.withLock {
                    activeBitmaps[filePath] = bitmap
                }
            }

            // Update loading state
            _isLoading.value = false

        } catch (e: Exception) {
            Log.e(TAG, "Error loading image from file: ${e.message}", e)
            _errorMessage.value = "Error loading image: ${e.message}"
            _isLoading.value = false
        }
    }


    // Helper method to create a placeholder image when processing fails
// Helper method to create a placeholder image when processing fails
    private fun createPlaceholderImageForDomain(outputFile: File, domain: SatelliteDomain, visualizationMethod: VisualizationMethod) {
        // Set appropriate dimensions based on domain
        val width = when (domain) {
            SatelliteDomain.FULL_DISK -> 678
            SatelliteDomain.CONUS -> 312
            SatelliteDomain.MESOSCALE_1, SatelliteDomain.MESOSCALE_2 -> 250
            else -> 200 // Regional views
        }

        val height = when (domain) {
            SatelliteDomain.FULL_DISK -> 678
            SatelliteDomain.CONUS -> 187
            SatelliteDomain.MESOSCALE_1, SatelliteDomain.MESOSCALE_2 -> 250
            else -> 150 // Regional views
        }

        try {
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)

            // Create a simple gradient using the parser's color map
            for (y in 0 until height) {
                val normalizedY = y.toFloat() / height

                for (x in 0 until width) {
                    val normalizedX = x.toFloat() / width
                    val normalizedValue = (normalizedX + normalizedY) / 2

                    bitmap.setPixel(x, y, parser.applyColorMap(normalizedValue, visualizationMethod))
                }
            }

            // Create parent directories if needed
            outputFile.parentFile?.mkdirs()

            // Save the image
            outputFile.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }

            // Clean up
            bitmap.recycle()

            Log.d(TAG, "Created placeholder image for ${domain.id}: ${width}x${height}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create placeholder image: ${e.message}")
        }
    }

    /**
     * Notify UI that an image is ready
     */
    private fun notifyImageReady(filePath: String, imageFile: File) {
        try {
            val currentFilePath = _currentFile.value

            // Make sure the file exists and has content
            if (!imageFile.exists() || imageFile.length() == 0L) {
                Log.e(TAG, "Image file doesn't exist or is empty: ${imageFile.absolutePath}")
                return
            }

            // Check if this is the current file
            if (filePath == currentFilePath) {
                Log.d(TAG, "Loading image for current display: ${imageFile.absolutePath}")

                // Load the bitmap on a background thread
                viewModelScope.launch(Dispatchers.IO) {
                    try {
                        // Use BitmapFactory options to check for decoder problems
                        val options = BitmapFactory.Options().apply {
                            inJustDecodeBounds = true  // Just check bounds first
                        }
                        BitmapFactory.decodeFile(imageFile.absolutePath, options)

                        if (options.outWidth <= 0 || options.outHeight <= 0) {
                            Log.e(TAG, "Invalid image dimensions: ${options.outWidth}x${options.outHeight}")
                            return@launch
                        }

                        // Now actually load the bitmap
                        options.inJustDecodeBounds = false
                        options.inPreferredConfig = Bitmap.Config.RGB_565

                        val bitmap = BitmapFactory.decodeFile(imageFile.absolutePath, options)
                        if (bitmap == null) {
                            Log.e(TAG, "Failed to decode bitmap")
                            return@launch
                        }

                        // Extract timestamp
                        val timestamp = extractTimestamp(filePath) ?: "--:-- UTC"

                        // Update UI on main thread
                        withContext(Dispatchers.Main) {
                            _currentBitmap.value = bitmap
                            _currentTimestamp.value = timestamp
                            _dimensions.value = Pair(bitmap.height, bitmap.width)
                            _isLoading.value = false

                            Log.d(TAG, "Successfully updated UI with image: ${bitmap.width}x${bitmap.height}")

                            // Store in frame cache for animation
                            framesMutex.withLock {
                                processedFrames[filePath] = SatelliteFrame(
                                    bitmap = bitmap,
                                    timestamp = timestamp,
                                    filePath = filePath,
                                    dimensions = Pair(bitmap.height, bitmap.width),
                                    dataRange = Pair(0f, 1000f) // Default range
                                )
                            }

                            // ADD THIS CODE HERE - Now that we have the bitmap and coordinate mapping
                            val bitmap = _currentBitmap.value
                            if (bitmap != null && currentCoordinateMapping != null) {
                                // Now we have both the coordinate mapping and image dimensions
                                debugCoordinateMapping(currentCoordinateMapping!!, bitmap.width, bitmap.height)
                            }

                            // IMPORTANT: Generate boundaries with the correct image dimensions
                            if (bitmap != null) {
                                generateBoundaries(_selectedDomain.value, bitmap.width, bitmap.height)
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error loading image: ${e.message}", e)
                    }
                }
            } else {
                Log.d(TAG, "Image ready but not for current view: $filePath")
            }

            // Update progress in any case
            viewModelScope.launch {
                updateBackgroundProgress()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error notifying image ready: ${e.message}", e)
        }
    }

    /**
     * Update background loading progress
     */
    private fun updateBackgroundProgress() {
        viewModelScope.launch {
            val files = _currentFiles.value
            if (files.isEmpty()) return@launch

            var processedCount = 0

            // Count processed files (either as frames or images)
            for (filePath in files) {
                val imageFile = getImageFileForPath(filePath)
                val frameProcessed = framesMutex.withLock { processedFrames.containsKey(filePath) }

                if (frameProcessed || imageFile.exists()) {
                    processedCount++
                }
            }

            _backgroundLoadingProgress.value = processedCount.toFloat() / files.size
        }
    }

    // When showing a frame, use the image file instead of reprocessing
    // Update this method in your SatelliteViewModel class
    fun showFrame(index: Int) {
        val files = _currentFiles.value
        if (files.isEmpty() || index < 0 || index >= files.size) return

        _currentFrameIndex.value = index
        val filePath = files[index]
        _currentFile.value = filePath

        // Get timestamp from our map, or extract it if not available
        val timestamp = frameTimestamps[filePath] ?: extractTimestamp(filePath) ?: "--:-- UTC"
        // Store it for future reference
        frameTimestamps[filePath] = timestamp

        // Set the timestamp immediately (before frame loading)
        _currentTimestamp.value = timestamp

        // Check if we already have the frame in memory
        var frameAvailable = false
        var frame: SatelliteFrame? = null

        runBlocking {
            framesMutex.withLock {
                frame = processedFrames[filePath]
                frameAvailable = frame != null
            }
        }

        if (frameAvailable && frame != null) {
            // Frame already in memory, just update UI
            _currentBitmap.value = frame!!.bitmap
            _dimensions.value = frame!!.dimensions
            _dataRange.value = frame!!.dataRange

            // MEMORY FIX: Mark as active
            runBlocking {
                activeBitmapsMutex.withLock {
                    activeBitmaps[filePath] = frame!!.bitmap
                }
            }

            return
        }

        // Get the image file
        val imageFile = getImageFileForPath(filePath)

        if (imageFile.exists()) {
            // Instead of loadImageFromFile, use our enhanced method
            viewModelScope.launch {
                loadFileAsFrame(filePath, true)
            }
        } else {
            // Queue for processing if not already in queue
            if (!processingQueue.contains(filePath)) {
                processingQueue.add(filePath)
            }

            // Show loading state
            _isLoading.value = true
        }
    }

    fun selectChannel(channel: SatelliteChannel) {
        if (_selectedChannel.value?.id != channel.id) {
            Log.d(TAG, "Switching channel from ${_selectedChannel.value?.id} to ${channel.id}")

            // Cancel any existing jobs
            backgroundLoadingJob?.cancel()
            animationJob?.cancel()

            // Stop animation if it's running
            if (_isAnimating.value) {
                _isAnimating.value = false
            }

            viewModelScope.launch {
                // Show loading state immediately
                _isLoading.value = true
                _currentBitmap.value = null

                // Clear frame cache when changing channels
                clearFrameCache()

                // Update selected channel
                _selectedChannel.value = channel
                currentVisualizationMethod = channel.defaultVisualization

                // Reset current frame index
                _currentFrameIndex.value = 0

                // Reset files list
                _currentFiles.value = emptyList()
                _currentFile.value = null

                // Force the file cache to be cleared too
                fileCacheMutex.withLock {
                    fileCache.forEach { (_, file) ->
                        try {
                            if (file.exists()) file.delete()
                        } catch (e: Exception) {
                            Log.e(TAG, "Error deleting cached file: ${e.message}")
                        }
                    }
                    fileCache.clear()
                }

                // Load data for new channel
                startFetchingData(initialLoadOnly = true)
            }
        }
    }

    /**
     * Load an RGB composite product (like GeoColor)
     */
    fun loadRGBProduct(product: RGBProduct, region: String? = null) {
        Log.d(TAG, "Loading RGB product: ${product.displayName}, region: ${region ?: "none"}")

        // Cancel any existing jobs
        backgroundLoadingJob?.cancel()
        animationJob?.cancel()

        // Stop animation if it's running
        if (_isAnimating.value) {
            _isAnimating.value = false
        }

        viewModelScope.launch {
            // Show loading state
            _isLoading.value = true
            _currentBitmap.value = null

            try {
                val domain = _selectedDomain.value
                val bitmap = imageFetcher.loadRGBImage(domain, product, region)

                if (bitmap != null) {
                    _currentBitmap.value = bitmap
                    _dimensions.value = Pair(bitmap.height, bitmap.width)
                    _errorMessage.value = null
                    Log.d(TAG, "Successfully loaded ${product.displayName} image: ${bitmap.width}x${bitmap.height}")
                } else {
                    _errorMessage.value = "Failed to load ${product.displayName} image"
                    Log.e(TAG, "Failed to load ${product.displayName}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading RGB product", e)
                _errorMessage.value = "Error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Scan and log available RGB products
     */
    fun scanRGBProducts() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val availableProducts = imageFetcher.scanAvailableRGBProducts()
                Log.d(TAG, "=== Available RGB Products ===")
                availableProducts.forEach { (domain, products) ->
                    Log.d(TAG, "${domain.displayName}:")
                    products.forEach { product ->
                        Log.d(TAG, "  - ${product.displayName}")
                        // Check for regions
                        val regions = imageFetcher.scanAvailableRegions(domain, product)
                        if (regions.isNotEmpty()) {
                            Log.d(TAG, "    Regions: ${regions.joinToString(", ")}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error scanning RGB products", e)
            }
        }
    }

    fun updateVisualization(method: VisualizationMethod) {
        if (currentVisualizationMethod == method) return

        currentVisualizationMethod = method

        // Stop animation if it's running
        if (_isAnimating.value) {
            _isAnimating.value = false
            animationJob?.cancel()
        }

        // Need to clear and rebuild frame cache with new visualization
        viewModelScope.launch {
            clearFrameCache()

            _isLoading.value = true

            try {
                // First get the current file to process immediately
                val currentPath = _currentFile.value
                if (currentPath != null) {
                    // Queue for processing with high priority
                    processingQueue.remove(currentPath)  // Remove if already in queue
                    processingQueue.add(currentPath)     // Add to front of queue
                }

                // Now start background processing of the rest
                startBackgroundFrameLoading()

            } catch (e: Exception) {
                Log.e(TAG, "Error updating visualization: ${e.message}")
                _errorMessage.value = "Error updating visualization: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    // Get live data path based on current time
    private fun getDataPath(): String {
        val domain = _selectedDomain.value

        // Calculate the current time minus a lag to ensure data is available
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))

        // Adjust lag based on domain (full disk updates less frequently)
        val lagMinutes = when(domain) {
            SatelliteDomain.FULL_DISK -> 60  // Full disk has 15-minute cadence
            SatelliteDomain.CONUS -> 30     // CONUS has 5-minute cadence
            SatelliteDomain.MESOSCALE_1, SatelliteDomain.MESOSCALE_2 -> 5  // Mesoscale has 1-minute cadence
            else -> 30  // Default for regional views that use CONUS
        }

        // Subtract lag minutes to ensure data availability
        cal.add(Calendar.MINUTE, -lagMinutes)

        val year = cal.get(Calendar.YEAR)
        val dayOfYear = cal.get(Calendar.DAY_OF_YEAR)
        val hour = cal.get(Calendar.HOUR_OF_DAY)

        // Format as ABI-L1b-Rad{domain identifier}/YYYY/DOY/HH/
        val domainCode = when(domain) {
            SatelliteDomain.FULL_DISK -> "F"
            SatelliteDomain.CONUS -> "C"
            SatelliteDomain.MESOSCALE_1 -> "M1"
            SatelliteDomain.MESOSCALE_2 -> "M2"
            else -> "C"  // Regional views use CONUS data
        }

        return String.format("ABI-L1b-Rad%s/%04d/%03d/%02d/", domainCode, year, dayOfYear, hour)
    }

    // Get an older data path (1 hour older) in case current data is not available
    private fun getOlderDataPath(): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))

        // Subtract 90 minutes to get data from previous hour
        cal.add(Calendar.MINUTE, -90)

        val year = cal.get(Calendar.YEAR)
        val dayOfYear = cal.get(Calendar.DAY_OF_YEAR)
        val hour = cal.get(Calendar.HOUR_OF_DAY)

        return String.format("ABI-L1b-RadC/%04d/%03d/%02d/", year, dayOfYear, hour)
    }

    // For backward compatibility with previous code
    fun loadFileAtIndex(index: Int) {
        showFrame(index)
    }

    // Toggle animation on/off
    fun toggleAnimation() {
        if (_isAnimating.value) {
            // Stop animation
            _isAnimating.value = false
            animationJob?.cancel()
            return
        }

        // Check if we have frames to animate
        val files = _currentFiles.value
        if (files.size <= 1) return

        // Make sure all frames are being processed
        ensureAllFramesProcessing()

        // Start animation
        _isAnimating.value = true
        startAnimationLoop()
    }

    /**
     * Ensure all frames are being processed
     */
    private fun ensureAllFramesProcessing() {
        val files = _currentFiles.value
        if (files.isEmpty()) return

        for (filePath in files) {
            val imageFile = getImageFileForPath(filePath)

            // If image doesn't exist and not in queue, add to queue
            if (!imageFile.exists() && !processingQueue.contains(filePath)) {
                processingQueue.add(filePath)
            }
        }
    }

    // Start animation loop to play from oldest to newest (instead of newest to oldest)
    private fun startAnimationLoop() {
        animationJob?.cancel()

        animationJob = viewModelScope.launch {
            val animationDelay = 250L // milliseconds between frames

            while (isActive && _isAnimating.value) {
                val files = _currentFiles.value
                if (files.isEmpty()) break

                val currentIndex = _currentFrameIndex.value
                // Change to decrement instead of increment (to move backward in time)
                val nextIndex = if (currentIndex > 0) currentIndex - 1 else files.size - 1

                // Check if the next frame is available
                val nextFilePath = files[nextIndex]
                val imageFile = getImageFileForPath(nextFilePath)

                // Make sure timestamp is set even if frame isn't loaded yet
                val timestamp = frameTimestamps[nextFilePath] ?: extractTimestamp(nextFilePath) ?: "--:-- UTC"
                frameTimestamps[nextFilePath] = timestamp

                var frameAvailable = false
                framesMutex.withLock {
                    frameAvailable = processedFrames.containsKey(nextFilePath)
                }

                if (frameAvailable || imageFile.exists()) {
                    // Show next frame
                    showFrame(nextIndex)
                    delay(animationDelay)
                } else {
                    // Wait for the frame to be processed
                    delay(100)
                }
            }
        }
    }

    // Check if background loading is active
    private fun isBackgroundLoadingActive(): Boolean {
        return backgroundLoadingJob?.isActive == true
    }

    // Clear frame cache
    private suspend fun clearFrameCache() {
        // Clear frame cache in memory
        framesMutex.withLock {
            processedFrames.clear()
        }

        processingMutex.withLock {
            processingFiles.clear()
        }

        activeBitmapsMutex.withLock {
            activeBitmaps.clear()
        }

        // Clear the current bitmap and show loading state
        withContext(Dispatchers.Main) {
            _currentBitmap.value = null
            _isLoading.value = true
        }

        // Delete image files for previous channel
        withContext(Dispatchers.IO) {
            try {
                // Only delete images for the previous channel, not all images
                val channelId = _selectedChannel.value?.id ?: return@withContext
                val pattern = "${channelId}_".lowercase()

                imageDir.listFiles()?.forEach { file ->
                    if (file.name.lowercase().contains(pattern)) {
                        Log.d(TAG, "Deleting image file for previous channel: ${file.name}")
                        file.delete()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing image files: ${e.message}")
            }
        }

        // Reset background loading progress
        _backgroundLoadingProgress.value = 0f

        // Cancel any pending processing
        processingQueue.clear()
    }

    private fun getDomainSuffix(domain: SatelliteDomain): String {
        return when(domain) {
            SatelliteDomain.FULL_DISK -> "F"
            SatelliteDomain.CONUS -> "C"
            SatelliteDomain.MESOSCALE_1 -> "M1"
            SatelliteDomain.MESOSCALE_2 -> "M2"
            else -> "C"  // Regional views use CONUS data
        }
    }

    // Start fetching data - with option for initial load only
    fun startFetchingData(initialLoadOnly: Boolean = false) {
        // Make sure we're initialized
        if (!isInitialized.get()) {
            Log.d(TAG, "ViewModel not fully initialized yet, delaying fetch")
            viewModelScope.launch {
                delay(1000)
                if (isInitialized.get()) {
                    startFetchingData(initialLoadOnly)
                }
            }
            return
        }

        val channel = _selectedChannel.value ?: return
        val domain = _selectedDomain.value

        // Cancel any existing background loading
        backgroundLoadingJob?.cancel()

        viewModelScope.launch {
            try {
                _isLoading.value = true
                _errorMessage.value = null

                // Check if we should use image loading instead of NetCDF processing
                if (useImageLoading) {
                    Log.d(TAG, "Using image loading mode - loading single local image only")

                    // Load pre-processed image directly
                    loadImageAsFrame(channel, domain, setAsCurrent = true)

                    // For local testing, don't generate dummy files or timestamps
                    // Just use the single loaded image
                    _currentFiles.value = emptyList()
                    _currentFrameIndex.value = 0
                    frameTimestamps.clear()

                    _isLoading.value = false
                    return@launch
                }

                // Special handling for mesoscale domains
                if (domain == SatelliteDomain.MESOSCALE_1 || domain == SatelliteDomain.MESOSCALE_2) {
                    val files = withContext(Dispatchers.IO) {
                        fetcher.listMesoscaleFiles(domain, channel.number)
                    }

                    if (files.isEmpty()) {
                        _errorMessage.value = "No mesoscale data found for channel ${channel.name}. Try a different channel."
                        _isLoading.value = false
                        return@launch
                    }

                    _currentFiles.value = files
                    Log.d(TAG, "Found ${files.size} mesoscale files for channel ${channel.id}")

                    // Extract and store timestamps for all files
                    files.forEach { filePath ->
                        val timestamp = extractTimestamp(filePath) ?: "--:-- UTC"
                        frameTimestamps[filePath] = timestamp
                    }

                    // Process just the first file immediately if initial load only
                    if (initialLoadOnly && files.isNotEmpty()) {
                        // Add to processing queue with high priority
                        processingQueue.remove(files[0])  // Remove if already exists
                        processingQueue.add(files[0])     // Add to queue

                        // Set as current file and update timestamp
                        _currentFile.value = files[0]
                        _currentTimestamp.value = frameTimestamps[files[0]] ?: "--:-- UTC"
                    } else {
                        // Otherwise start background loading of all files
                        startBackgroundFrameLoading()
                    }

                    return@launch
                }

                // Regular handling for non-mesoscale domains
                val basePath = getDataPath()
                Log.d(TAG, "Looking for files in: $basePath with channel ${channel.id} for domain ${domain.id}")

                val files = withContext(Dispatchers.IO) {
                    // For regional domains, use CONUS domain files
                    val searchDomain = if (domain.isRegional) SatelliteDomain.CONUS else domain
                    fetcher.listFiles(bucket, basePath, searchDomain)
                        .filter {
                            // Filter by channel
                            val domainCode = if (domain.isRegional) "C" else getDomainSuffix(domain)
                            it.contains("Rad${domainCode}-M6${channel.id}_") ||
                                    it.contains("Rad${domainCode}-M3${channel.id}_")
                        }
                        .sortedByDescending { it }
                        .take(5) // Get up to 5 files
                }

                if (files.isEmpty()) {
                    // Try an older hour if no files found
                    val olderPath = getOlderDataPath()
                    Log.d(TAG, "No files found, checking older path: $olderPath with channel ${channel.id} for domain ${domain.id}")

                    val olderFiles = withContext(Dispatchers.IO) {
                        // For regional domains, use CONUS domain files
                        val searchDomain = if (domain.isRegional) SatelliteDomain.CONUS else domain
                        fetcher.listFiles(bucket, olderPath, searchDomain)
                            .filter {
                                // Filter by channel
                                val domainCode = if (domain.isRegional) "C" else getDomainSuffix(domain)
                                it.contains("Rad${domainCode}-M6${channel.id}_") ||
                                        it.contains("Rad${domainCode}-M3${channel.id}_")
                            }
                            .sortedByDescending { it }
                            .take(5)
                    }

                    if (olderFiles.isNotEmpty()) {
                        _currentFiles.value = olderFiles
                        Log.d(TAG, "Found ${olderFiles.size} files in older path for channel ${channel.id}")

                        // Extract and store timestamps for all files
                        olderFiles.forEach { filePath ->
                            val timestamp = extractTimestamp(filePath) ?: "--:-- UTC"
                            frameTimestamps[filePath] = timestamp
                        }

                        // Process just the first file immediately if initial load only
                        if (initialLoadOnly && olderFiles.isNotEmpty()) {
                            // Add to processing queue with high priority
                            processingQueue.remove(olderFiles[0])  // Remove if already exists
                            processingQueue.add(olderFiles[0])     // Add to queue

                            // Set as current file and update timestamp
                            _currentFile.value = olderFiles[0]
                            _currentTimestamp.value = frameTimestamps[olderFiles[0]] ?: "--:-- UTC"
                        } else {
                            // Otherwise start background loading of all files
                            startBackgroundFrameLoading()
                        }
                        return@launch
                    }

                    _errorMessage.value = "No data files found for channel ${channel.name}. Try a different channel."
                    _isLoading.value = false
                    return@launch
                }

                _currentFiles.value = files
                Log.d(TAG, "Found ${files.size} files for channel ${channel.id}")

                // Extract and store timestamps for all files
                files.forEach { filePath ->
                    val timestamp = extractTimestamp(filePath) ?: "--:-- UTC"
                    frameTimestamps[filePath] = timestamp
                }

                // Process just the first file immediately if initial load only
                if (initialLoadOnly && files.isNotEmpty()) {
                    // Add to processing queue with high priority
                    processingQueue.remove(files[0])  // Remove if already exists
                    processingQueue.add(files[0])     // Add to queue

                    // Set as current file and update timestamp
                    _currentFile.value = files[0]
                    _currentTimestamp.value = frameTimestamps[files[0]] ?: "--:-- UTC"
                } else {
                    // Otherwise start background loading of all files
                    startBackgroundFrameLoading()
                }
            } catch (e: Exception) {
                _errorMessage.value = "Error: ${e.message}"
                Log.e(TAG, "Error in startFetchingData", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    // New method to load pre-processed images instead of NetCDF files
    private suspend fun loadImageAsFrame(
        channel: SatelliteChannel,
        domain: SatelliteDomain,
        timestamp: String? = null,
        setAsCurrent: Boolean = true
    ) {
        try {
            Log.d(TAG, "Loading image for channel ${channel.number}, domain ${domain.id}")
            
            // Load the bitmap from the image fetcher
            val bitmap = imageFetcher.loadSatelliteImage(domain, channel, timestamp)
            
            if (bitmap != null) {
                Log.d(TAG, "Successfully loaded image: ${bitmap.width}x${bitmap.height}")
                
                // Generate a timestamp if not provided
                val actualTimestamp = timestamp ?: SimpleDateFormat("yyyy-MM-dd HH:mm:ss 'UTC'", Locale.US)
                    .apply { timeZone = TimeZone.getTimeZone("UTC") }
                    .format(Date())
                
                // Create a frame object
                val filePath = "image_${domain.id}_ch${channel.number}_$actualTimestamp"
                val frame = SatelliteFrame(
                    bitmap = bitmap,
                    timestamp = actualTimestamp,
                    filePath = filePath,
                    dimensions = Pair(bitmap.height, bitmap.width),
                    dataRange = Pair(0f, 255f) // For pre-processed images
                )
                
                if (setAsCurrent) {
                    // Update UI on main thread
                    withContext(Dispatchers.Main) {
                        _currentBitmap.value = bitmap
                        _currentTimestamp.value = actualTimestamp
                        _currentFile.value = filePath
                        _dimensions.value = Pair(bitmap.height, bitmap.width)
                        _dataRange.value = Pair(0f, 255f)
                        
                        Log.d(TAG, "Successfully updated UI with image: ${bitmap.width}x${bitmap.height}")
                    }
                }
                
                // Store in frame cache
                framesMutex.withLock {
                    processedFrames[filePath] = frame
                }
                
                // Generate boundaries with the correct image dimensions
                if (setAsCurrent) {
                    generateBoundaries(domain, bitmap.width, bitmap.height)
                }
                
            } else {
                Log.e(TAG, "Failed to load image for channel ${channel.number}, domain ${domain.id}")
                _errorMessage.value = "Failed to load satellite image"
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error loading image as frame", e)
            _errorMessage.value = "Error loading image: ${e.message}"
        }
    }

    // Add this method to your SatelliteViewModel class
    private suspend fun processFileToFrame(
        file: File,
        filePath: String,
        visualizationMethod: VisualizationMethod,
        setAsCurrent: Boolean = true
    ) {
        if (!file.exists() || file.length() == 0L) {
            Log.e(TAG, "Invalid file for processing: ${file.absolutePath}")
            return
        }

        try {
            // Extract timestamp from filename
            val timestamp = extractTimestamp(filePath) ?: "--:-- UTC"

            // Determine proper downsampling based on channel type
            val channel = _selectedChannel.value ?: return
            val downsampleFactor = if (channel.isHighResolution) 32 else 16

            // Create a placeholder bitmap if this will be displayed
            var placeholderBitmap: Bitmap? = null
            if (setAsCurrent) {
                placeholderBitmap = BitmapPoolManager.getBitmap(100, 60, Bitmap.Config.RGB_565)
                placeholderBitmap.eraseColor(Color.DKGRAY)
                _currentBitmap.value = placeholderBitmap
                _currentTimestamp.value = timestamp
                _currentFile.value = filePath

                // Give the UI time to update
                delay(100)
            }

            // First, extract coordinate mapping before processing the image
            // This is crucial for proper boundary display
            val coordinateMapping = withContext(Dispatchers.IO) {
                try {
                    Log.d(TAG, "Extracting coordinate mapping from: ${file.absolutePath}")
                    parser.extractCoordinateMapping(file)
                } catch (e: Exception) {
                    Log.e(TAG, "Error extracting coordinate mapping: ${e.message}", e)
                    null
                }
            }

            if (coordinateMapping != null) {
                Log.d(TAG, "Successfully extracted coordinate mapping from file")
                currentCoordinateMapping = coordinateMapping

                // We can't debug with image dimensions yet since we don't have the bitmap
                // Will do that later when the image is processed
            } else {
                Log.w(TAG, "Failed to extract coordinate mapping from file")
            }

            // Process the file to a bitmap
            val result = withContext(Dispatchers.Default) {
                parser.parseFileToBitmap(file, downsampleFactor, visualizationMethod)
            }

            if (result != null) {
                val (bitmap, dimensions, dataRange) = result

                // Now that we have the bitmap dimensions, test coordinate mapping if available
                if (coordinateMapping != null) {
                    // Test with a few known points using the actual bitmap dimensions
                    val testPoints = listOf(
                        Triple("New York", 40.7128, -74.0060),
                        Triple("Miami", 25.7617, -80.1918)
                    )

                    for ((name, lat, lon) in testPoints) {
                        val pixelCoords = coordinateMapping.mapToPixel(lat, lon, bitmap.width, bitmap.height)
                        Log.d(TAG, "Test point '$name' (${lat}, ${lon}) mapped to: $pixelCoords")
                    }
                }

                // Create a frame object
                val frame = SatelliteFrame(bitmap, timestamp, filePath, dimensions, dataRange)

                // Store in cache
                framesMutex.withLock {
                    processedFrames[filePath] = frame
                }

                // Mark bitmap as active if it's current
                if (setAsCurrent) {
                    BitmapPoolManager.markActive(filePath, bitmap)
                }

                // Update UI if needed
                if (setAsCurrent) {
                    _currentBitmap.value = bitmap
                    _dimensions.value = dimensions
                    _dataRange.value = dataRange

                    // Generate boundary overlay with the current coordinate mapping
                    // passing the actual bitmap dimensions
                    generateBoundaries(_selectedDomain.value, bitmap.width, bitmap.height)

                    // Return placeholder to pool instead of recycling
                    if (placeholderBitmap != null && placeholderBitmap != bitmap) {
                        BitmapPoolManager.recycleBitmap(placeholderBitmap)
                    }
                }

                Log.d(TAG, "Processed frame for $filePath: ${bitmap.width}x${bitmap.height}")
            } else {
                Log.e(TAG, "Failed to process file: $filePath")
                if (setAsCurrent) {
                    _errorMessage.value = "Failed to process satellite data"
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing file to frame: ${e.message}", e)
            if (setAsCurrent) {
                _errorMessage.value = "Error processing satellite data: ${e.message}"
            }
        }
    }

    // Start background loading of all frames
    private fun startBackgroundFrameLoading() {
        // Cancel any existing job
        backgroundLoadingJob?.cancel()

        backgroundLoadingJob = viewModelScope.launch {
            try {
                val files = _currentFiles.value
                if (files.isEmpty()) return@launch

                // Reset progress
                _backgroundLoadingProgress.value = 0f

                // Process files as frames rather than just queueing for image processing
                for (i in 0 until files.size) {
                    val filePath = files[i]

                    // Check if already processed
                    val alreadyProcessed = framesMutex.withLock {
                        processedFrames.containsKey(filePath)
                    }

                    if (!alreadyProcessed) {
                        // Process as frame to extract coordinate mapping
                        val file = getFileFromCache(filePath)
                        if (file != null) {
                            processFileToFrame(file, filePath, currentVisualizationMethod, i == 0)
                        } else {
                            // Fall back to queue if file not available
                            if (!processingQueue.contains(filePath)) {
                                processingQueue.add(filePath)
                            }
                        }
                    }

                    // Update progress
                    _backgroundLoadingProgress.value = (i + 1).toFloat() / files.size
                }

                Log.d(TAG, "Background loading complete with coordinate extraction")

            } catch (e: Exception) {
                Log.e(TAG, "Error in background loading: ${e.message}")
            }
        }
    }

    // Process a downloaded file into a frame - keep for backward compatibility
    private fun processFileToImage(filePath: String) {
        var ncFile: File? = null

        try {
            // Check if we're already processing this file
            var isProcessing = false
            runBlocking {
                processingMutex.withLock {
                    isProcessing = processingFiles.contains(filePath)
                    if (!isProcessing) {
                        processingFiles.add(filePath)
                    }
                }
            }

            if (isProcessing) {
                Log.d(TAG, "Already processing $filePath, skipping")
                return
            }

            // Get the NetCDF file
            runBlocking {
                ncFile = getFileFromCache(filePath)
            }

            if (ncFile == null) {
                Log.e(TAG, "Failed to get NetCDF file: $filePath")
                return
            }

            // Create a unique image filename
            val imageFile = getImageFileForPath(filePath)

            // Check if already processed
            if (imageFile.exists() && imageFile.length() > 0) {
                Log.d(TAG, "Image already exists: ${imageFile.name}")

                // Try to extract coordinate mapping even for existing images
                runBlocking {
                    val mapping = withContext(Dispatchers.IO) {
                        parser.extractCoordinateMapping(ncFile!!)
                    }

                    if (mapping != null) {
                        Log.d(TAG, "Successfully extracted coordinate mapping from existing image file")
                        currentCoordinateMapping = mapping
                    }
                }

                // Verify the image is valid
                val testBitmap = BitmapFactory.decodeFile(imageFile.absolutePath)
                if (testBitmap != null) {
                    testBitmap.recycle()

                    // Notify UI that image is ready
                    notifyImageReady(filePath, imageFile)
                    return
                } else {
                    Log.w(TAG, "Existing image is invalid, will regenerate")
                    imageFile.delete()
                }
            }

            Log.d(TAG, "Starting image generation for $filePath")

            // Extract coordinate mapping before image processing
            runBlocking {
                val mapping = withContext(Dispatchers.IO) {
                    parser.extractCoordinateMapping(ncFile!!)
                }

                if (mapping != null) {
                    Log.d(TAG, "Successfully extracted coordinate mapping from file")
                    currentCoordinateMapping = mapping
                } else {
                    Log.w(TAG, "Failed to extract coordinate mapping from file")
                }
            }

            // For regional domains, the download is already subsetted, so we use simpler processing
            val domain = _selectedDomain.value
            var success = false

            // Process based on domain type
            if (domain.isRegional) {
                // For regional domains, we've already subsetted at download time
                // Just process like a normal image
                success = parser.directNetCDFToImage(
                    ncFile!!,
                    imageFile,
                    2, // Low downsample factor since already subsetted
                    currentVisualizationMethod
                )
            } else {
                // Standard processing for non-regional domains
                success = parser.directNetCDFToImage(
                    ncFile!!,
                    imageFile,
                    2, // Use a moderate downsample factor
                    currentVisualizationMethod
                )
            }

            if (success) {
                Log.d(TAG, "Successfully created image for $filePath")

                // Notify UI that image is ready
                notifyImageReady(filePath, imageFile)
            } else {
                Log.e(TAG, "Failed to create image for $filePath")

                // Create a placeholder image
                createPlaceholderImageForDomain(imageFile, domain, currentVisualizationMethod)
                notifyImageReady(filePath, imageFile)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error processing file to image: ${e.message}", e)
        } finally {
            // Mark as no longer processing
            runBlocking {
                processingMutex.withLock {
                    processingFiles.remove(filePath)
                }
            }
        }
    }

    private fun extractCoordinateMapping(ncFile: File): NetCDFParser.CoordinateMapping? {
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
            try {
                netcdfFile?.close()
            } catch (e: Exception) {
                Log.e(TAG, "Error closing NetCDF file: ${e.message}")
            }
        }
    }

    // Extract mapping from direct lat/lon variables
    private fun extractDirectMapping(latVar: Variable, lonVar: Variable): NetCDFParser.CoordinateMapping? {
        try {
            // Read the lat/lon arrays
            val latArray = latVar.read()
            val lonArray = lonVar.read()

            // Convert to 2D arrays if needed
            val latGrid: Array<FloatArray>
            val lonGrid: Array<FloatArray>

            // Fix: rank is a property, not a method
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

            return NetCDFParser.CoordinateMapping(latGrid, lonGrid)
        } catch (e: Exception) {
            Log.e(TAG, "Error in extractDirectMapping: ${e.message}")
            return null
        }
    }

    // Extract mapping from projection information
    // Add this inside your NetCDFParser class
    // Place this inside your NetCDFParser class
    private fun extractProjectionMapping(netcdfFile: NetcdfFile, projVar: Variable): NetCDFParser.CoordinateMapping? {
        try {
            Log.d(TAG, "Extracting GOES-16 projection parameters...")

            // Get projection attributes
            val attrs = projVar.attributes()

            // Extract key parameters
            val h = findAttributeDouble(attrs, "perspective_point_height", 35786023.0)
            val lambda0 = findAttributeDouble(attrs, "longitude_of_projection_origin", -75.0)
            val semi_major = findAttributeDouble(attrs, "semi_major_axis", 6378137.0)
            val semi_minor = findAttributeDouble(attrs, "semi_minor_axis", 6356752.31414)

            Log.d(TAG, "Projection parameters: h=$h, lambda0=$lambda0, semi_major=$semi_major, semi_minor=$semi_minor")

            // Get the x and y coordinate variables
            val xVar = netcdfFile.findVariable("x")
            val yVar = netcdfFile.findVariable("y")

            if (xVar == null || yVar == null) {
                Log.e(TAG, "Missing x/y variables needed for projection")
                return null
            }

            // Read x and y values (satellite fixed grid coordinates)
            val xArray = xVar.read()
            val yArray = yVar.read()
            val xValues = FloatArray(xArray.getSize().toInt()) { i -> xArray.getFloat(i) }
            val yValues = FloatArray(yArray.getSize().toInt()) { i -> yArray.getFloat(i) }

            Log.d(TAG, "X range: ${xValues.firstOrNull()} to ${xValues.lastOrNull()}")
            Log.d(TAG, "Y range: ${yValues.firstOrNull()} to ${yValues.lastOrNull()}")

            // Create a simplified grid (GOES images are very large)
            val samplingFactor = 10
            val sampledHeight = (yValues.size + samplingFactor - 1) / samplingFactor
            val sampledWidth = (xValues.size + samplingFactor - 1) / samplingFactor

            val latGrid = Array(sampledHeight) { FloatArray(sampledWidth) }
            val lonGrid = Array(sampledHeight) { FloatArray(sampledWidth) }

            // Fill the grid with lat/lon values
            for (i in 0 until sampledHeight) {
                val y_idx = i * samplingFactor
                if (y_idx >= yValues.size) continue

                for (j in 0 until sampledWidth) {
                    val x_idx = j * samplingFactor
                    if (x_idx >= xValues.size) continue

                    // GOES-16 fixed grid values are in radians
                    // Need to convert to meters, then to lat/lon
                    val xRad = xValues[x_idx]
                    val yRad = yValues[y_idx]

                    // Convert from radians to meters (using the formula from GOES-16 docs)
                    val xKm = semi_major * xRad
                    val yKm = semi_major * yRad

                    // Convert to lat/lon using satellite view geometry
                    val (lat, lon) = satelliteXYToLatLon(xKm, yKm, h, Math.toRadians(lambda0), semi_major, semi_minor)

                    latGrid[i][j] = lat.toFloat()
                    lonGrid[i][j] = lon.toFloat()
                }
            }

            // Validate the grid
            val minLat = latGrid.flatMap { it.asIterable() }.filter { !it.isNaN() }.minOrNull() ?: Float.NaN
            val maxLat = latGrid.flatMap { it.asIterable() }.filter { !it.isNaN() }.maxOrNull() ?: Float.NaN
            val minLon = lonGrid.flatMap { it.asIterable() }.filter { !it.isNaN() }.minOrNull() ?: Float.NaN
            val maxLon = lonGrid.flatMap { it.asIterable() }.filter { !it.isNaN() }.maxOrNull() ?: Float.NaN

            Log.d(TAG, "Created coordinate grid: lat[$minLat, $maxLat], lon[$minLon, $maxLon]")

            return NetCDFParser.CoordinateMapping(latGrid, lonGrid)
        } catch (e: Exception) {
            Log.e(TAG, "Error in extractProjectionMapping: ${e.message}", e)
            return null
        }
    }

    // Helper method to get attribute values (add this method to NetCDFParser if it doesn't exist)
    private fun findAttributeDouble(attrs: ucar.nc2.AttributeContainer, name: String, defaultValue: Double): Double {
        val attr = attrs.findAttribute(name)
        return attr?.numericValue?.toDouble() ?: defaultValue
    }

    // Convert from satellite x/y coordinates to lat/lon
    private fun satelliteXYToLatLon(x: Double, y: Double, h: Double, lambda0: Double,
                                    semi_major: Double, semi_minor: Double): Pair<Double, Double> {
        try {
            // Calculate the geocentric distance to the point
            val a_squared = x * x + y * y
            val b = h
            val c = h * h - a_squared

            // Make sure the point is visible from the satellite
            if (c <= 0) {
                return Pair(Double.NaN, Double.NaN)  // Point behind Earth's limb
            }

            val r_squared = a_squared + c
            val r = Math.sqrt(r_squared)
            val d = Math.sqrt(h * h - a_squared)

            // Geocentric latitude
            val latGc = Math.atan(y / d)

            // Convert geocentric to geodetic latitude (on ellipsoid)
            val flattening = 1.0 - (semi_minor / semi_major)
            val e_squared = 2.0 * flattening - flattening * flattening
            val latGd = Math.atan(Math.tan(latGc) / (1.0 - e_squared))

            // Calculate longitude
            val lon = lambda0 + Math.atan(x / d)

            // Convert to degrees
            val latDeg = Math.toDegrees(latGd)
            val lonDeg = Math.toDegrees(lon)

            return Pair(latDeg, lonDeg)
        } catch (e: Exception) {
            Log.e(TAG, "Error in satelliteXYToLatLon: ${e.message}")
            return Pair(Double.NaN, Double.NaN)
        }
    }

    // Load a file and convert it to a frame - keep for backward compatibility
    // Add this helper method to your SatelliteViewModel class
    private suspend fun loadFileAsFrame(filePath: String, setAsCurrent: Boolean = true) {
        val file = getFileFromCache(filePath)

        if (file != null && file.exists() && file.length() > 0) {
            // Use our enhanced method instead of just processing the image
            processFileToFrame(file, filePath, currentVisualizationMethod, setAsCurrent)
        } else {
            Log.e(TAG, "Invalid file for frame processing: ${filePath}")
        }
    }

    // Create a simple placeholder bitmap to show while loading
    private fun createPlaceholderBitmap(width: Int, height: Int): Bitmap {
        val bitmap = BitmapPoolManager.getBitmap(width, height, Bitmap.Config.RGB_565)
        bitmap.eraseColor(Color.DKGRAY)
        return bitmap
    }

    // Extract human-readable timestamp from filename
    fun extractTimestamp(filename: String): String? {
        // GOES-16 filenames follow a pattern like: OR_ABI-L1b-RadC-M6C13_G16_s20230011206174_e20230011208550_c20230011209005.nc

        val regex = "_s(\\d{4})(\\d{3})(\\d{2})(\\d{2})(\\d{2})".toRegex()
        val matchResult = regex.find(filename) ?: return null

        val (year, dayOfYear, hour, minute, second) = matchResult.destructured

        val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        calendar.set(Calendar.YEAR, year.toInt())
        calendar.set(Calendar.DAY_OF_YEAR, dayOfYear.toInt())
        calendar.set(Calendar.HOUR_OF_DAY, hour.toInt())
        calendar.set(Calendar.MINUTE, minute.toInt())
        calendar.set(Calendar.SECOND, second.toInt())

        return timeFormatter.format(calendar.time)
    }

    // Get a specific frame directly
    fun getFrame(index: Int): SatelliteFrame? {
        val files = _currentFiles.value
        if (files.isEmpty() || index < 0 || index >= files.size) return null

        val filePath = files[index]
        return processedFrames[filePath]
    }

    // Navigate to next frame
    fun nextFrame() {
        val currentIndex = _currentFrameIndex.value
        val files = _currentFiles.value

        if (files.isEmpty()) return

        val nextIndex = (currentIndex + 1) % files.size
        showFrame(nextIndex)
    }

    fun getMemoryStats(): String {
        val runtime = Runtime.getRuntime()
        val usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024
        val maxMemory = runtime.maxMemory() / 1024 / 1024
        val bitmapStats = BitmapPoolManager.getStats()
        return "Memory: $usedMemory/$maxMemory MB | $bitmapStats"
    }

    // Navigate to previous frame
    fun previousFrame() {
        val currentIndex = _currentFrameIndex.value
        val files = _currentFiles.value

        if (files.isEmpty()) return

        val prevIndex = if (currentIndex > 0) currentIndex - 1 else files.size - 1
        showFrame(prevIndex)
    }

    // Start loading all frames for animation
    fun prepareAnimation() {
        if (!isBackgroundLoadingActive()) {
            startBackgroundFrameLoading()
        }
    }
}