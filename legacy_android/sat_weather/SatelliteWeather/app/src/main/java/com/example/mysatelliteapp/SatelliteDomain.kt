package com.example.mysatelliteapp

enum class SatelliteDomain(
    val id: String,
    val displayName: String,
    val pathName: String,
    val downsampleFactor: Int,
    val isRegional: Boolean = false,
    val regionBounds: Array<Float>? = null // [minLat, maxLat, minLon, maxLon] if isRegional
) {
    FULL_DISK("full-disk", "Full Disk", "FullDisk", 32),
    CONUS("conus", "CONUS", "CONUS", 16),
    MESOSCALE_1("meso1", "Mesoscale 1", "Mesoscale-1", 8),
    MESOSCALE_2("meso2", "Mesoscale 2", "Mesoscale-2", 8),
    // Regional domains will use CONUS data but subset by coords
    NORTHWEST("northwest", "Northwest", "CONUS", 8, true, arrayOf(42.0f, 49.0f, -125.0f, -111.0f)),
    NORTHEAST("northeast", "Northeast", "CONUS", 8, true, arrayOf(38.0f, 47.0f, -85.0f, -67.0f)),
    SOUTHWEST("southwest", "Southwest", "CONUS", 8, true, arrayOf(31.0f, 42.0f, -124.0f, -109.0f)),
    SOUTHEAST("southeast", "Southeast", "CONUS", 8, true, arrayOf(25.0f, 38.0f, -92.0f, -75.0f)),
    OKLAHOMA("oklahoma", "Oklahoma", "CONUS", 4, true, arrayOf(33.5f, 37.0f, -103.0f, -94.5f)),
    TEXAS("texas", "Texas", "CONUS", 4, true, arrayOf(26.0f, 36.5f, -106.5f, -93.5f));
}

/**
 * RGB composite products available from GOES satellites
 */
enum class RGBProduct(
    val id: String,
    val displayName: String,
    val folderName: String,
    val description: String
) {
    GEOCOLOR("geocolor", "GeoColor (True Color)", "geocolor", "Natural color composite with nighttime IR"),
    TRUE_COLOR("true_color", "True Color", "true_color", "Daytime natural color"),
    NIGHT_MICROPHYSICS("night_micro", "Night Microphysics", "night_microphysics", "Cloud properties at night"),
    DAY_CLOUD_PHASE("day_cloud_phase", "Day Cloud Phase", "day_cloud_phase", "Cloud particle phase"),
    AIR_MASS("air_mass", "Air Mass", "air_mass", "Upper level moisture and dynamics"),
    WATER_VAPOR("water_vapor", "Water Vapor", "water_vapor", "Mid-level moisture"),
    DUST("dust", "Dust", "dust", "Dust and aerosol detection"),
    FIRE_TEMPERATURE("fire_temp", "Fire Temperature", "fire_temperature", "Active fire detection")
}