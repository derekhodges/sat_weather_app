# Geodata File Format Specification

## Overview
Each domain needs a corresponding geodata JSON file that maps pixel coordinates to latitude/longitude.

## File Location & Naming
Place files in: `SatWeatherApp/src/data/samples/`

Naming convention: `{domain_id}_geodata.json`
- `conus_geodata.json`
- `oklahoma_geodata.json`
- `texas_geodata.json`
- etc.

**Important**: After adding a new file, you must add a `require()` statement in:
`src/utils/geoDataService.js` in the `loadTestGeoData()` function.

## Required JSON Structure

```json
{
  "bounds": {
    "min_lat": 32.5,
    "max_lat": 40.0,
    "min_lon": -104.0,
    "max_lon": -93.0
  },
  "projection": "geostationary",
  "resolution": {
    "width": 1800,
    "height": 1080
  },
  "lat_grid": [
    [40.0, 40.0, 40.0, ...],
    [39.95, 39.95, 39.95, ...],
    ...
  ],
  "lon_grid": [
    [-104.0, -103.95, -103.90, ...],
    [-104.0, -103.95, -103.90, ...],
    ...
  ]
}
```

## Field Descriptions

### Required Fields

1. **bounds** (object) - Geographic corners of the image
   - `min_lat`: Southern edge latitude
   - `max_lat`: Northern edge latitude
   - `min_lon`: Western edge longitude (negative for Western Hemisphere)
   - `max_lon`: Eastern edge longitude

2. **projection** (string) - Always use `"geostationary"` for GOES data
   - This tells the app to use the lat/lon grids instead of linear interpolation

3. **resolution** (object) - Exact pixel dimensions of the image
   - `width`: Image width in pixels
   - `height`: Image height in pixels
   - **MUST match your actual COD image dimensions exactly**

4. **lat_grid** (2D array) - Latitude value for each pixel
   - Rows correspond to Y pixels (top to bottom)
   - Columns correspond to X pixels (left to right)
   - Size: [height][width] or subsampled version

5. **lon_grid** (2D array) - Longitude value for each pixel
   - Same structure as lat_grid
   - Western Hemisphere = negative values

## Grid Subsampling (Recommended)

Full pixel grids can be huge (1800x1080 = 1.9M values per grid).
Subsample to reduce file size while maintaining accuracy:

- Recommended: 1 sample per 10-12 pixels
- Example: 1800x1080 image → 180x108 grid (or 150x90)
- The app interpolates between grid points

Grid dimensions in the JSON:
```json
{
  "resolution": {
    "width": 1800,
    "height": 1080
  },
  "lat_grid": [...],  // 108 rows, 180 columns
  "lon_grid": [...]   // Same dimensions as lat_grid
}
```

## Python Script to Generate Geodata

```python
import numpy as np
import json

# Load your H5 file
# lat_full = your full latitude grid from H5
# lon_full = your full longitude grid from H5
# image_width, image_height = your image dimensions

# Subsample (every 10th pixel)
subsample_factor = 10
lat_grid = lat_full[::subsample_factor, ::subsample_factor].tolist()
lon_grid = lon_full[::subsample_factor, ::subsample_factor].tolist()

geodata = {
    "bounds": {
        "min_lat": float(np.min(lat_full)),
        "max_lat": float(np.max(lat_full)),
        "min_lon": float(np.min(lon_full)),
        "max_lon": float(np.max(lon_full))
    },
    "projection": "geostationary",
    "resolution": {
        "width": image_width,
        "height": image_height
    },
    "lat_grid": lat_grid,
    "lon_grid": lon_grid
}

with open('oklahoma_geodata.json', 'w') as f:
    json.dump(geodata, f)
```

## Optional Fields (Not Needed for Your Use Case)

These are NOT required since your images are pure data without padding:

- `core_dimensions` - Only if image has borders/titles
- `padding` - Only if image has padding around data area
- `grid_dimensions` - Automatically inferred from lat_grid/lon_grid
- `data_values` - Only for inspector data readout (future feature)
- `timestamp` - Can be added for reference but not required

## App Behavior Without Geodata

If no geodata file exists for a domain:
- App still works normally
- Inspector shows coordinates using linear interpolation (less accurate)
- Location marker uses linear interpolation (less accurate but functional)
- No errors are thrown

## Adding a New Domain

1. Create your geodata JSON file:
   ```
   src/data/samples/texas_geodata.json
   ```

2. Edit `src/utils/geoDataService.js`:
   ```javascript
   // Find the loadTestGeoData function and add:
   else if (normalizedId === 'texas') {
     geoData = require('../data/samples/texas_geodata.json');
   }
   ```

3. Rebuild the app:
   ```bash
   npx expo start --clear
   ```

## Troubleshooting

**Coordinates are wrong:**
- Check that `resolution.width` and `resolution.height` match your actual image exactly
- Verify lat_grid and lon_grid dimensions match your subsampling

**Large file size:**
- Increase subsampling factor (every 15th or 20th pixel)
- Grids should be under 50KB for optimal performance

**Grid orientation:**
- Row 0 of lat_grid = top of image (usually maximum latitude)
- Column 0 of lon_grid = left of image (usually minimum longitude)
