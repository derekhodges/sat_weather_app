package com.example.mysatelliteapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModelProvider
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d("MainActivity", "Storage permission granted")
        } else {
            Log.w("MainActivity", "Storage permission denied")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request storage permission
        requestStoragePermission()

        SatelliteViewModel.appContext = applicationContext
        val factory = SatelliteViewModelFactory(this.cacheDir)
        val viewModel = ViewModelProvider(this, factory)[SatelliteViewModel::class.java]

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    SatelliteScreen(viewModel)
                }
            }
        }
    }

    private fun requestStoragePermission() {
        val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_IMAGES
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }

        when {
            ContextCompat.checkSelfPermission(
                this,
                permission
            ) == PackageManager.PERMISSION_GRANTED -> {
                Log.d("MainActivity", "Storage permission already granted")
            }
            else -> {
                requestPermissionLauncher.launch(permission)
            }
        }
    }
}

// Visualization Method enum
enum class VisualizationMethod {
    STANDARD_ENHANCED,
    COLOR_IR,
    FIRE_DETECTION,
    WATER_VAPOR,
    VISIBLE,
    VISIBLE_RED,     // New: Specialized for Channel 2 (Red)
    VISIBLE_BLUE,    // New: Specialized for Channel 1 (Blue)
    VISIBLE_GREEN,   // New: Specialized for Channel 3 (Near-IR/Green)
    CLEAN_IR_ENHANCED // New: Enhanced visualization for Channel 13
}

private const val TAG = "SatelliteScreen"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SatelliteScreen(viewModel: SatelliteViewModel) {
    // UI state variables
    val bitmap = viewModel.bitmap.collectAsState().value
    val dimensions = viewModel.dimensions.collectAsState().value
    val isLoading = viewModel.isLoading.collectAsState().value
    val errorMessage = viewModel.errorMessage.collectAsState().value
    val timestamp = viewModel.currentTimestamp.collectAsState().value
    val selectedChannel = viewModel.selectedChannel.collectAsState().value
    val dataRange = viewModel.dataRange.collectAsState().value
    val files = viewModel.currentFiles.collectAsState().value
    val currentFrameIndex = viewModel.currentFrameIndex.collectAsState().value
    val isAnimating = viewModel.isAnimating.collectAsState().value
    val backgroundLoadingProgress = viewModel.backgroundLoadingProgress.collectAsState().value
    val boundaryBitmap = viewModel.boundaries.collectAsState().value

    // Visualization options
    var visualizationMethod by remember {
        mutableStateOf(selectedChannel?.defaultVisualization ?: VisualizationMethod.COLOR_IR)
    }

    // Update visualization when channel changes
    LaunchedEffect(selectedChannel) {
        selectedChannel?.let {
            visualizationMethod = it.defaultVisualization
        }
    }

    LaunchedEffect(bitmap) {
        // Debug boundaries whenever a new image is loaded
        if (bitmap != null) {
            viewModel.debugBoundaries()
        }
    }

    // Test: Load RGB products on startup
    LaunchedEffect(Unit) {
        // Scan for available RGB products
        viewModel.scanRGBProducts()

        // Try to load geocolor for CONUS
        viewModel.loadRGBProduct(RGBProduct.GEOCOLOR, region = null)
    }

    LaunchedEffect(currentFrameIndex) {
        // Force UI to update timestamp when frame changes
        val index = currentFrameIndex
        val files = files
        if (files.isNotEmpty() && index >= 0 && index < files.size) {
            val filePath = files[index]
            viewModel.extractTimestamp(filePath)?.let { time ->
                // This should cause the UI to update
                // No direct assignment needed as it will flow through State
            }
        }
    }

    // Drawer state
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    // Zoom and pan state
    var scale by remember { mutableStateOf(1f) }
    var offsetX by remember { mutableStateOf(0f) }
    var offsetY by remember { mutableStateOf(0f) }

    // Channel selector state
    var showChannelSelector by remember { mutableStateOf(false) }

    // Visualization selector state
    var showVisualizationSelector by remember { mutableStateOf(false) }

    // Domain selector state
    var showDomainSelector by remember { mutableStateOf(false) }

    // Satellite selector state
    var showSatelliteSelector by remember { mutableStateOf(false) }

    // Region selector state
    var showRegionSelector by remember { mutableStateOf(false) }

    val formattedTimestamp = remember(timestamp) {
        // Ensure timestamp is properly formatted and refreshed when it changes
        if (timestamp.isEmpty()) "--:-- UTC" else timestamp
    }

    // Main UI with drawer layout
    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            // Navigation drawer content
            ModalDrawerSheet(
                drawerContainerColor = Color(0xFF1A1A1A),
                windowInsets = WindowInsets(0)
            ) {
                DrawerContent()
            }
        }
    ) {
        // Main content
        Scaffold(
            containerColor = Color.Black,
            topBar = {
                Surface(
                    color = Color(0xFF1A1A1A),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .padding(horizontal = 4.dp)
                    ) {
                        // Menu button
                        IconButton(
                            onClick = {
                                scope.launch {
                                    drawerState.open()
                                }
                            },
                            modifier = Modifier.align(Alignment.CenterStart)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Menu,
                                contentDescription = "Menu",
                                tint = Color.White
                            )
                        }

                        // Title - simplified to only show satellite and domain
                        Text(
                            text = "GOES-19 ${viewModel.selectedDomain.collectAsState().value.displayName}",
                            color = Color.White,
                            fontSize = 18.sp,
                            modifier = Modifier.align(Alignment.Center)
                        )

                        // Right side buttons
                        Row(
                            modifier = Modifier.align(Alignment.CenterEnd),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            // Region selector button
                            IconButton(
                                onClick = { 
                                    showRegionSelector = !showRegionSelector
                                    if (showRegionSelector) {
                                        showChannelSelector = false
                                        showDomainSelector = false
                                        showVisualizationSelector = false
                                        showSatelliteSelector = false
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.LocationOn,
                                    contentDescription = "Select Region",
                                    tint = Color.White
                                )
                            }
                            
                            // Refresh button
                            IconButton(
                                onClick = { viewModel.startFetchingData(initialLoadOnly = false) }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "Refresh Data",
                                    tint = Color.White
                                )
                            }
                        }
                    }
                }
            },
            bottomBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1A1A1A))
                ) {
                    // Color scale with integrated channel info and timestamp
                    EnhancedColorScaleBar(
                        method = visualizationMethod,
                        channel = selectedChannel,
                        timestamp = formattedTimestamp  // Use formattedTimestamp here
                    )

                    // Main selector buttons row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0x88000000))
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Channel selector button
                        Text(
                            text = "SELECT CHANNEL",
                            color = Color.White,
                            fontSize = 14.sp,
                            modifier = Modifier.clickable {
                                showChannelSelector = !showChannelSelector
                                if (showChannelSelector) {
                                    showVisualizationSelector = false
                                    showDomainSelector = false
                                    showSatelliteSelector = false
                                }
                            }
                        )

                        // Domain selector button (replacing visualization)
                        Text(
                            text = "SELECT DOMAIN",
                            color = Color.White,
                            fontSize = 14.sp,
                            modifier = Modifier.clickable {
                                showDomainSelector = !showDomainSelector
                                if (showDomainSelector) {
                                    showChannelSelector = false
                                    showVisualizationSelector = false
                                    showSatelliteSelector = false
                                }
                            }
                        )
                    }

                    // Channel selector panel
                    AnimatedVisibility(
                        visible = showChannelSelector,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF262626))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "SELECT SATELLITE CHANNEL",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            // Group channels by type
                            val visibleChannels = viewModel.availableChannels.collectAsState().value.filter { it.number <= 6 }
                            val infraredChannels = viewModel.availableChannels.collectAsState().value.filter { it.number > 6 }

                            Text(
                                text = "Visible & Near-IR Channels",
                                color = Color.White,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )

                            // Visible channels row 1 (CH 1-3)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                visibleChannels.take(3).forEach { channel ->
                                    ChannelButton(
                                        channel = channel,
                                        selected = selectedChannel?.id == channel.id,
                                        onClick = {
                                            viewModel.selectChannel(channel)
                                            showChannelSelector = false
                                        }
                                    )
                                }
                            }

                            // Visible channels row 2 (CH 4-6)
                            if (visibleChannels.size > 3) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceEvenly
                                ) {
                                    visibleChannels.drop(3).forEach { channel ->
                                        ChannelButton(
                                            channel = channel,
                                            selected = selectedChannel?.id == channel.id,
                                            onClick = {
                                                viewModel.selectChannel(channel)
                                                showChannelSelector = false
                                            }
                                        )
                                    }
                                }
                            }

                            Text(
                                text = "Infrared Channels",
                                color = Color.White,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
                            )

                            // IR channels grid (display in rows of 3)
                            val irRows = infraredChannels.chunked(3)

                            irRows.forEach { rowChannels ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceEvenly
                                ) {
                                    rowChannels.forEach { channel ->
                                        ChannelButton(
                                            channel = channel,
                                            selected = selectedChannel?.id == channel.id,
                                            onClick = {
                                                viewModel.selectChannel(channel)
                                                showChannelSelector = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Domain selector panel
                    AnimatedVisibility(
                        visible = showDomainSelector,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF262626))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "SELECT DOMAIN",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            // Main domain options
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                DomainButton(
                                    name = "Full Disk",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.FULL_DISK,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.FULL_DISK)
                                        showDomainSelector = false
                                    }
                                )

                                DomainButton(
                                    name = "CONUS",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.CONUS,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.CONUS)
                                        showDomainSelector = false
                                    }
                                )
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                DomainButton(
                                    name = "Mesoscale 1",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.MESOSCALE_1,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.MESOSCALE_1)
                                        showDomainSelector = false
                                    }
                                )

                                DomainButton(
                                    name = "Mesoscale 2",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.MESOSCALE_2,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.MESOSCALE_2)
                                        showDomainSelector = false
                                    }
                                )
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Regional/State/Local options
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                DomainButton(
                                    name = "Northwest",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.NORTHWEST,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.NORTHWEST)
                                        showDomainSelector = false
                                    }
                                )

                                DomainButton(
                                    name = "Northeast",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.NORTHEAST,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.NORTHEAST)
                                        showDomainSelector = false
                                    }
                                )
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                DomainButton(
                                    name = "Southwest",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.SOUTHWEST,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.SOUTHWEST)
                                        showDomainSelector = false
                                    }
                                )

                                // Southeast
                                DomainButton(
                                    name = "Southeast",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.SOUTHEAST,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.SOUTHEAST)
                                        showDomainSelector = false
                                    }
                                )
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                // Oklahoma
                                DomainButton(
                                    name = "Oklahoma",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.OKLAHOMA,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.OKLAHOMA)
                                        showDomainSelector = false
                                    }
                                )

                                // Texas
                                DomainButton(
                                    name = "Texas",
                                    selected = viewModel.selectedDomain.collectAsState().value == SatelliteDomain.TEXAS,
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.TEXAS)
                                        showDomainSelector = false
                                    }
                                )
                            }
                        }
                    }

                    // Region selector panel
                    AnimatedVisibility(
                        visible = showRegionSelector,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF262626))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "SELECT REGION TYPE",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            Text(
                                text = "Choose the type of domain for GOES East satellite:",
                                color = Color.LightGray,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            // Region type options
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                RegionTypeButton(
                                    name = "CONUS",
                                    description = "Continental US",
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.CONUS)
                                        showRegionSelector = false
                                    }
                                )

                                RegionTypeButton(
                                    name = "Regional",
                                    description = "Regional Views",
                                    onClick = {
                                        // For now, default to showing domain selector
                                        showRegionSelector = false
                                        showDomainSelector = true
                                    }
                                )
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                RegionTypeButton(
                                    name = "Local",
                                    description = "Mesoscale Domains",
                                    onClick = {
                                        // Default to Mesoscale 1
                                        viewModel.selectDomain(SatelliteDomain.MESOSCALE_1)
                                        showRegionSelector = false
                                    }
                                )

                                RegionTypeButton(
                                    name = "Full Disk",
                                    description = "Entire Hemisphere",
                                    onClick = {
                                        viewModel.selectDomain(SatelliteDomain.FULL_DISK)
                                        showRegionSelector = false
                                    }
                                )
                            }
                        }
                    }

                    // Visualization selector panel
                    AnimatedVisibility(
                        visible = showVisualizationSelector,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF262626))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "SELECT VISUALIZATION",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                VisualizationButton(
                                    name = "Standard",
                                    selected = visualizationMethod == VisualizationMethod.STANDARD_ENHANCED,
                                    onClick = {
                                        visualizationMethod = VisualizationMethod.STANDARD_ENHANCED
                                        showVisualizationSelector = false
                                        viewModel.updateVisualization(VisualizationMethod.STANDARD_ENHANCED)
                                    }
                                )

                                VisualizationButton(
                                    name = "Color IR",
                                    selected = visualizationMethod == VisualizationMethod.COLOR_IR,
                                    onClick = {
                                        visualizationMethod = VisualizationMethod.COLOR_IR
                                        showVisualizationSelector = false
                                        viewModel.updateVisualization(VisualizationMethod.COLOR_IR)
                                    }
                                )

                                VisualizationButton(
                                    name = "Fire",
                                    selected = visualizationMethod == VisualizationMethod.FIRE_DETECTION,
                                    onClick = {
                                        visualizationMethod = VisualizationMethod.FIRE_DETECTION
                                        showVisualizationSelector = false
                                        viewModel.updateVisualization(VisualizationMethod.FIRE_DETECTION)
                                    }
                                )
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                VisualizationButton(
                                    name = "Water Vapor",
                                    selected = visualizationMethod == VisualizationMethod.WATER_VAPOR,
                                    onClick = {
                                        visualizationMethod = VisualizationMethod.WATER_VAPOR
                                        showVisualizationSelector = false
                                        viewModel.updateVisualization(VisualizationMethod.WATER_VAPOR)
                                    }
                                )

                                VisualizationButton(
                                    name = "Visible",
                                    selected = visualizationMethod == VisualizationMethod.VISIBLE,
                                    onClick = {
                                        visualizationMethod = VisualizationMethod.VISIBLE
                                        showVisualizationSelector = false
                                        viewModel.updateVisualization(VisualizationMethod.VISIBLE)
                                    }
                                )

                                if (selectedChannel?.number == 13) {
                                    VisualizationButton(
                                        name = "Enhanced IR",
                                        selected = visualizationMethod == VisualizationMethod.CLEAN_IR_ENHANCED,
                                        onClick = {
                                            visualizationMethod = VisualizationMethod.CLEAN_IR_ENHANCED
                                            showVisualizationSelector = false
                                            viewModel.updateVisualization(VisualizationMethod.CLEAN_IR_ENHANCED)
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // Satellite selector panel
                    AnimatedVisibility(
                        visible = showSatelliteSelector,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF262626))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "SELECT SATELLITE",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                SatelliteButton(
                                    name = "GOES-19",
                                    location = "East",
                                    selected = true,
                                    onClick = {
                                        showSatelliteSelector = false
                                    }
                                )

                                SatelliteButton(
                                    name = "GOES-17",
                                    location = "West",
                                    selected = false,
                                    onClick = {
                                        showSatelliteSelector = false
                                    }
                                )

                                SatelliteButton(
                                    name = "GOES-18",
                                    location = "West",
                                    selected = false,
                                    onClick = {
                                        showSatelliteSelector = false
                                    }
                                )
                            }
                        }
                    }

                    // Bottom controls with icons
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        // Location button
                        IconButton(onClick = { /* TODO */ }) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = "Location",
                                tint = Color.White
                            )
                        }

                        // Selector button (for satellite)
                        IconButton(onClick = {
                            showSatelliteSelector = !showSatelliteSelector
                            if (showSatelliteSelector) {
                                showChannelSelector = false
                                showDomainSelector = false
                                showVisualizationSelector = false
                            }
                        }) {
                            Icon(
                                imageVector = Icons.Default.Satellite,
                                contentDescription = "Select Satellite",
                                tint = Color.White
                            )
                        }

                        // Animation button with loading progress
                        Box(
                            contentAlignment = Alignment.Center
                        ) {
                            // Play/Pause button
                            IconButton(onClick = {
                                viewModel.toggleAnimation()
                            }) {
                                Icon(
                                    imageVector = if (isAnimating) Icons.Default.Pause else Icons.Default.PlayArrow,
                                    contentDescription = if (isAnimating) "Pause" else "Play",
                                    tint = Color.White
                                )
                            }

                            // Loading progress indicator when frames are loading
                            if (backgroundLoadingProgress > 0f && backgroundLoadingProgress < 1f) {
                                CircularProgressIndicator(
                                    progress = backgroundLoadingProgress,
                                    modifier = Modifier.size(40.dp),
                                    color = Color.White.copy(alpha = 0.5f),
                                    strokeWidth = 2.dp
                                )
                            }
                        }

                        // Visualization selector button (replacing refresh)
                        IconButton(onClick = {
                            showVisualizationSelector = !showVisualizationSelector
                            if (showVisualizationSelector) {
                                showChannelSelector = false
                                showDomainSelector = false
                                showSatelliteSelector = false
                            }
                        }) {
                            Icon(
                                imageVector = Icons.Default.Palette,
                                contentDescription = "Visualization",
                                tint = Color.White
                            )
                        }

                        // Reset view button
                        IconButton(
                            onClick = {
                                scale = 1f
                                offsetX = 0f
                                offsetY = 0f
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.ZoomOutMap,
                                contentDescription = "Reset View",
                                tint = Color.White
                            )
                        }
                    }

                    // Timeline slider
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                    ) {
                        // Slider
                        if (files.isNotEmpty()) {
                            val sliderPosition = if (files.size > 1) {
                                // Invert slider position: 0 = oldest (high index), 1 = newest (index 0)
                                1f - (currentFrameIndex.toFloat() / (files.size - 1).coerceAtLeast(1))
                            } else {
                                1f
                            }

                            Slider(
                                value = sliderPosition,
                                onValueChange = {
                                    if (files.isNotEmpty() && files.size > 1) {
                                        // Convert slider value to frame index (inverted)
                                        val newIndex = ((1f - it) * (files.size - 1)).roundToInt().coerceIn(0, files.size - 1)
                                        viewModel.showFrame(newIndex)
                                    }
                                },
                                enabled = files.size > 1,
                                modifier = Modifier.fillMaxWidth(),
                                colors = SliderDefaults.colors(
                                    thumbColor = Color.White,
                                    activeTrackColor = Color.White,
                                    inactiveTrackColor = Color.DarkGray,
                                    disabledThumbColor = Color.Gray,
                                    disabledActiveTrackColor = Color.DarkGray,
                                    disabledInactiveTrackColor = Color.DarkGray
                                )
                            )
                        } else {
                            // Empty slider placeholder
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(20.dp)
                            )
                        }
                    }
                }
            }
        ) { paddingValues ->
            // Main content area with satellite image - taking more vertical space
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .background(Color.Black),
                contentAlignment = Alignment.Center
            ) {
                // Satellite image with zoom/pan
                bitmap?.let { img ->
                    // Calculate sizes and aspect ratios
                    val imageWidth = img.width
                    val imageHeight = img.height
                    val imageAspectRatio = imageWidth.toFloat() / imageHeight.toFloat()

                    // Calculate screen size in dp
                    val screenWidth = with(LocalDensity.current) {
                        LocalConfiguration.current.screenWidthDp.dp.toPx()
                    }
                    val screenHeight = with(LocalDensity.current) {
                        // Adjust for the padding values
                        val topPadding = paddingValues.calculateTopPadding().toPx()
                        val bottomPadding = paddingValues.calculateBottomPadding().toPx()
                        LocalConfiguration.current.screenHeightDp.dp.toPx() - topPadding - bottomPadding
                    }

                    // We want to fill the height completely
                    val scaleFactor = screenHeight / imageHeight

                    // Calculate the resulting width when scaled to fill height
                    val scaledWidth = imageWidth * scaleFactor

                    // This is how much wider than the screen the scaled image will be
                    val horizontalOverflow = scaledWidth - screenWidth

                    // Image box that's taller than it is wide
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .wrapContentWidth()
                            .horizontalScroll(rememberScrollState())
                            .pointerInput(Unit) {
                                detectTransformGestures { _, pan, zoom, _ ->
                                    scale = (scale * zoom).coerceIn(0.5f, 3f)
                                    offsetX += pan.x
                                    offsetY += pan.y
                                }
                            }
                    ) {
                        Image(
                            bitmap = img.asImageBitmap(),
                            contentDescription = "Satellite Image",
                            contentScale = ContentScale.FillHeight,
                            modifier = Modifier
                                .fillMaxHeight()
                                .width(with(LocalDensity.current) { scaledWidth.toDp() })
                                .graphicsLayer(
                                    scaleX = scale,
                                    scaleY = scale,
                                    translationX = offsetX - horizontalOverflow / 2,
                                    translationY = offsetY
                                )
                        )

                        // Then on top, the boundary overlay
                        viewModel.boundaryOverlay.collectAsState().value?.let { boundaries ->
                            Image(
                                bitmap = boundaries.asImageBitmap(),
                                contentDescription = "Geographic Boundaries",
                                contentScale = ContentScale.FillHeight,
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .width(with(LocalDensity.current) { scaledWidth.toDp() })
                                    .graphicsLayer(
                                        scaleX = scale,
                                        scaleY = scale,
                                        translationX = offsetX - horizontalOverflow / 2,
                                        translationY = offsetY
                                    )
                            )
                        }
                    }
                }

                // Loading indicator
                if (isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0x88000000)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            CircularProgressIndicator(
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Loading satellite data...",
                                color = Color.White
                            )
                        }
                    }
                }

                // Error message
                errorMessage?.let { error ->
                    Text(
                        text = error,
                        color = Color.White,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xCCFF0000))
                            .padding(16.dp)
                            .align(Alignment.BottomCenter),
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}

@Composable
fun EnhancedColorScaleBar(
    method: VisualizationMethod,
    channel: SatelliteChannel?,
    timestamp: String
) {
    val barHeight = 24.dp
    val parser = NetCDFParser()

    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        // Channel information and timestamp row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 6.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Channel information - giving it more weight (3 instead of 2)
            channel?.let {
                Text(
                    text = "Channel ${it.number} - ${it.description} (${it.wavelength})",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(3f)  // Increased from 2f to 3f
                )
            }

            // Timestamp - with fixed width instead of weight
            Text(
                text = timestamp,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.End,
                modifier = Modifier.width(90.dp)  // Fixed width instead of weight
            )
        }

        // Color scale gradient
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(barHeight)
        ) {
            // Generate 100 color segments for the gradient
            for (i in 0 until 100) {
                val normalizedValue = i / 99f
                val color = parser.applyColorMap(normalizedValue, method)

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(Color(color))
                )
            }
        }

        // Removed min/max labels as requested
    }
}

@Composable
fun SatelliteButton(name: String, location: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                color = if (selected) Color(0xFF2196F3) else Color(0xFF424242),
                shape = RoundedCornerShape(4.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = name,
                color = if (selected) Color.White else Color.LightGray,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = location,
                color = if (selected) Color.White else Color.LightGray,
                fontSize = 10.sp
            )
        }
    }
}

@Composable
fun DomainButton(name: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                color = if (selected) Color(0xFF2196F3) else Color(0xFF424242),
                shape = RoundedCornerShape(4.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(
            text = name,
            color = if (selected) Color.White else Color.LightGray,
            fontSize = 12.sp
        )
    }
}

@Composable
fun RegionTypeButton(name: String, description: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                color = Color(0xFF424242),
                shape = RoundedCornerShape(4.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = name,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = description,
                color = Color.LightGray,
                fontSize = 10.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun RegionButton(name: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                color = Color(0xFF424242),
                shape = RoundedCornerShape(4.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = name,
            color = Color.LightGray,
            fontSize = 11.sp
        )
    }
}

@Composable
fun ChannelButton(channel: SatelliteChannel, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                color = if (selected) Color(0xFF2196F3) else Color(0xFF424242),
                shape = RoundedCornerShape(4.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "CH ${channel.number}",
                color = if (selected) Color.White else Color.LightGray,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = channel.name,
                color = if (selected) Color.White else Color.LightGray,
                fontSize = 10.sp
            )
        }
    }
}

@Composable
fun VisualizationButton(name: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                color = if (selected) Color(0xFF2196F3) else Color(0xFF424242),
                shape = RoundedCornerShape(4.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(
            text = name,
            color = if (selected) Color.White else Color.LightGray,
            fontSize = 12.sp
        )
    }
}

@Composable
fun ColorScaleBar(method: VisualizationMethod, selectedChannel: SatelliteChannel?) {
    val barHeight = 24.dp
    val parser = NetCDFParser()

    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        // Add title with channel information
        selectedChannel?.let { channel ->
            Text(
                text = "GOES-19 ABI Channel ${channel.number} - ${channel.description} (${channel.wavelength})",
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )
        }

        // Create a simple gradient for the color scale
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(barHeight)
        ) {
            // Generate 100 color segments for the gradient
            for (i in 0 until 100) {
                val normalizedValue = i / 99f
                val color = parser.applyColorMap(normalizedValue, method)

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(Color(color))
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = when (method) {
                    VisualizationMethod.STANDARD_ENHANCED -> "Cold"
                    VisualizationMethod.COLOR_IR -> "Cold"
                    VisualizationMethod.FIRE_DETECTION -> "Cool"
                    VisualizationMethod.WATER_VAPOR -> "Dry"
                    VisualizationMethod.VISIBLE -> "Dark"
                    VisualizationMethod.VISIBLE_RED -> "Dark"
                    VisualizationMethod.VISIBLE_BLUE -> "Dark"
                    VisualizationMethod.VISIBLE_GREEN -> "Dark"
                    VisualizationMethod.CLEAN_IR_ENHANCED -> "-90°C"
                    else -> "Min"
                },
                color = Color.White,
                fontSize = 10.sp
            )

            Text(
                text = when (method) {
                    VisualizationMethod.STANDARD_ENHANCED -> "Warm"
                    VisualizationMethod.COLOR_IR -> "Warm"
                    VisualizationMethod.FIRE_DETECTION -> "Hot"
                    VisualizationMethod.WATER_VAPOR -> "Moist"
                    VisualizationMethod.VISIBLE -> "Bright"
                    VisualizationMethod.VISIBLE_RED -> "Bright"
                    VisualizationMethod.VISIBLE_BLUE -> "Bright"
                    VisualizationMethod.VISIBLE_GREEN -> "Bright"
                    VisualizationMethod.CLEAN_IR_ENHANCED -> "40°C"
                    else -> "Max"
                },
                color = Color.White,
                fontSize = 10.sp
            )
        }
    }
}

@Composable
fun DrawerContent() {
    var expandedNws by remember { mutableStateOf(false) }
    var expandedGoes by remember { mutableStateOf(false) }
    var expandedMeso by remember { mutableStateOf(false) }
    var expandedSpc by remember { mutableStateOf(false) }
    var expandedMapOptions by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // App name and version
        Text(
            text = "Satellite Viewer",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Text(
            text = "Version 1.0",
            color = Color.Gray,
            fontSize = 14.sp,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        // Settings button
        TextButton(
            onClick = { /* TODO */ },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(
                imageVector = Icons.Default.Settings,
                contentDescription = "Settings",
                tint = Color.White
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Settings",
                color = Color.White,
                textAlign = TextAlign.Start,
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Overlays heading
        Text(
            text = "Overlays",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            modifier = Modifier.padding(vertical = 8.dp)
        )

        // NWS Products Section
        SectionHeader(
            title = "NWS Products",
            expanded = expandedNws,
            onToggle = { expandedNws = !expandedNws }
        )

        AnimatedVisibility(visible = expandedNws) {
            Column(
                modifier = Modifier.padding(start = 16.dp)
            ) {
                CheckboxOption(text = "Warnings", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Watches", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Mesoscale Discussions", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Special Weather Statements", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "CWA Boundaries", checked = false, onCheckedChange = { /* TODO */ })
            }
        }

        // GOES Derived Products Section
        SectionHeader(
            title = "GOES Derived Products",
            expanded = expandedGoes,
            onToggle = { expandedGoes = !expandedGoes }
        )

        AnimatedVisibility(visible = expandedGoes) {
            Column(
                modifier = Modifier.padding(start = 16.dp)
            ) {
                CheckboxOption(text = "Cloud Top Height", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Cloud Top Temperature", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "GLM Flash Extent Density", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "GLM Minimum Flash Area", checked = false, onCheckedChange = { /* TODO */ })
            }
        }

        // Mesoanalysis Section
        SectionHeader(
            title = "Mesoanalysis",
            expanded = expandedMeso,
            onToggle = { expandedMeso = !expandedMeso }
        )

        AnimatedVisibility(visible = expandedMeso) {
            Column(
                modifier = Modifier.padding(start = 16.dp)
            ) {
                CheckboxOption(text = "Composite Radar", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "CAPE", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Wind Gusts", checked = false, onCheckedChange = { /* TODO */ })
            }
        }

        // SPC Products Section
        SectionHeader(
            title = "SPC Products",
            expanded = expandedSpc,
            onToggle = { expandedSpc = !expandedSpc }
        )

        AnimatedVisibility(visible = expandedSpc) {
            Column(
                modifier = Modifier.padding(start = 16.dp)
            ) {
                CheckboxOption(text = "SPC Day 1 Outlook", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "SPC Day 1 Tor Probs", checked = false, onCheckedChange = { /* TODO */ })
            }
        }

        // Map Options Section
        SectionHeader(
            title = "Map Options",
            expanded = expandedMapOptions,
            onToggle = { expandedMapOptions = !expandedMapOptions }
        )

        AnimatedVisibility(visible = expandedMapOptions) {
            Column(
                modifier = Modifier.padding(start = 16.dp)
            ) {
                CheckboxOption(text = "Locations", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Counties", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Cities", checked = false, onCheckedChange = { /* TODO */ })
                CheckboxOption(text = "Roads", checked = false, onCheckedChange = { /* TODO */ })
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // About info
        Text(
            text = "About",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = "This app displays real-time satellite imagery from NOAA's GOES-19 satellite. " +
                    "All data is accessed from NOAA's public AWS S3 bucket.",
            color = Color.LightGray,
            fontSize = 14.sp
        )
    }
}

@Composable
fun SectionHeader(title: String, expanded: Boolean, onToggle: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$title ${if (expanded) "▼" else "►"}",
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun CheckboxOption(text: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = CheckboxDefaults.colors(
                checkedColor = Color(0xFF2196F3),
                uncheckedColor = Color.LightGray,
                checkmarkColor = Color.White
            )
        )
        Text(
            text = text,
            color = Color.White,
            fontSize = 14.sp,
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}