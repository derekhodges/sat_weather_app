# Geospatial Data Testing Guide

This document explains how to test the new geospatial coordinate display features.

## What Was Implemented

1. **Geostationary Projection Support**: The app now handles GOES satellite geostationary projection using actual lat/lon grid lookup instead of linear interpolation.

2. **Test Data**: Bundled sample JSON files for CONUS and Oklahoma domains with real geostationary lat/lon grids.

3. **Inspector Mode Coordinates**: When in inspector mode, tapping on the image shows the actual lat/lon coordinates at that position.

4. **Debug Overlay**: Shows current geodata status including projection type, bounds, and grid size.

## How to Test

### 1. Start the App

```bash
cd SatWeatherApp
npx expo start
```

### 2. Test CONUS Domain
- Select **CONUS** domain from the Domain selector
- You should see the debug info overlay in the top-left corner showing:
  - `GeoData: TEST MODE` (indicates test data is loaded)
  - `Projection: geostationary`
  - `Lat/Lon Grid: 108x230` (real grid data)
  - `Bounds: 19.16° to 52.44°N...`

### 3. Test Oklahoma Domain
- Select **Oklahoma** domain
- Should show similar debug info with different bounds and grid size

### 4. Test Inspector Mode
- Tap the **crosshair button** (inspector icon) in the bottom bar
- A green crosshair appears on screen
- Tap anywhere on the image to reposition the crosshair
- Look at the bottom-right info box showing:
  - **Coordinates**: Actual lat/lon at that pixel (e.g., `35.50°N, 97.50°W`)
  - **Data Value**: Brightness value from the grid (in units shown)
  - **Color Analysis**: What the pixel color represents

### 5. What You Should See

**For CONUS:**
- Coordinates should range from ~19°N to ~52°N latitude
- Coordinates should range from ~59°W to ~131°W longitude
- The coordinates should update smoothly as you move the crosshair

**For Oklahoma:**
- Coordinates should range from ~33°N to ~39°N latitude
- Coordinates should range from ~93°W to ~109°W longitude
- Brightness values in the data grid

### 6. Verifying Geostationary Projection Works

The key test is that coordinates are **NOT linear**. In geostationary projection:
- The center of the image should have coordinates closer to the center of the US
- Edges should have coordinates that match the actual geographic location
- Moving the crosshair horizontally should not result in perfectly linear longitude changes

## Expected Console Logs

When running, look for these log messages:

```
[TEST] Loaded sample geodata for conus
[GEO] Using TEST geodata for conus: {
  bounds: {...},
  projection: "geostationary",
  hasDataValues: true,
  hasLatLonGrid: true,
  gridSize: "108x230",
  isFallback: false
}
[INSPECTOR] Coordinates: 35.50°N, 97.50°W
[INSPECTOR] Data value: 142.5 brightness
```

## Files Created/Modified

### New Files:
- `src/utils/projection.js` - Coordinate conversion with geostationary support
- `src/utils/geoDataService.js` - Service for loading geodata
- `src/components/VectorOverlay.js` - Polygon rendering (SPC outlooks)
- `src/components/GeoDataDebugInfo.js` - Debug info overlay
- `src/utils/testGeoData.js` - Test data utilities
- `src/data/samples/conus_geodata.json` - Real CONUS geostationary data
- `src/data/samples/oklahoma_geodata.json` - Real Oklahoma geostationary data

### Modified Files:
- `src/context/AppContext.js` - Added geospatial state
- `src/screens/MainScreen.js` - Integrated geodata loading
- `src/components/SatelliteImageViewer.js` - Added overlays and debug info
- `src/components/CenterCrosshairInspector.js` - Display coordinates/values
- `src/components/LocationMarker.js` - Geographic positioning

## Disabling Debug Info

To hide the debug overlay for production, edit `src/components/SatelliteImageViewer.js`:

```javascript
const SHOW_GEODATA_DEBUG = false;  // Change to false
```

## Known Limitations

1. **Test Data Only**: Currently only CONUS and Oklahoma have bundled test data. Other domains will fall back to domain bounds (linear interpolation).

2. **Data Grid Size**: The brightness values are sampled from the actual grid but may not perfectly match the image pixels due to resolution differences.

3. **No Server Data Yet**: This is a proof-of-concept. Server-side JSON files will need to be created for production use.

## Next Steps

After testing confirms the coordinate display works:

1. Set up server-side JSON generation for all domains
2. Implement polygon/shapefile overlay rendering for SPC warnings
3. Add real brightness temperature calibration (not just RGB brightness)
4. Optimize JSON file sizes for production
