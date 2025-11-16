#!/usr/bin/env python3
"""
Convert NPZ and H5 geospatial data files to JSON format for React Native app testing.

Usage:
    python convert_geodata.py

Creates JSON files that can be loaded by the app's geoDataService.
"""

import json
import numpy as np
import h5py


def convert_to_json_friendly(obj):
    """Convert numpy types to JSON-serializable Python types."""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_to_json_friendly(v) for k, v in obj.items()}
    return obj


def sample_grid(arr, sample_rate=4):
    """Downsample a 2D or 3D array by taking every Nth element."""
    if arr.ndim == 2:
        return arr[::sample_rate, ::sample_rate]
    elif arr.ndim == 3:
        return arr[::sample_rate, ::sample_rate, :]
    return arr


def create_conus_json():
    """Create CONUS geospatial data JSON from NPZ and H5 files."""
    print("Processing CONUS data...")

    # Load NPZ file (lat/lon grids and metadata)
    npz_data = np.load('conus_1840x865_reduced4.npz', allow_pickle=True)

    # Load H5 file (contains lat/lon and RGB values)
    with h5py.File('channel_c13_data_conus.h5', 'r') as h5:
        lat_grid = h5['latitude'][:]
        lon_grid = h5['longitude'][:]
        rgb_values = h5['rgb_values'][:]

    # Extract metadata
    core_width = int(npz_data['core_width'])
    core_height = int(npz_data['core_height'])
    padding = convert_to_json_friendly(npz_data['padding'].item())
    resolution_factor = int(npz_data['resolution_factor'])

    # Calculate actual image dimensions
    total_width = core_width + padding['left'] + padding['right']
    total_height = core_height + padding['top'] + padding['bottom']

    # Get bounds from lat/lon grids
    min_lat = float(lat_grid.min())
    max_lat = float(lat_grid.max())
    min_lon = float(lon_grid.min())
    max_lon = float(lon_grid.max())

    # Sample the data to reduce JSON size (keep every 2nd point from already reduced grid)
    sample_rate = 2
    sampled_lat = sample_grid(lat_grid, sample_rate).tolist()
    sampled_lon = sample_grid(lon_grid, sample_rate).tolist()

    # Convert RGB to grayscale for brightness temp approximation
    # Or just store RGB for visible channel data
    sampled_rgb = sample_grid(rgb_values, sample_rate)

    # Create grayscale (brightness) values from RGB
    # Simple average - actual brightness temp would need calibration
    brightness = np.mean(sampled_rgb, axis=2).astype(float).tolist()

    geo_data = {
        "bounds": {
            "min_lat": min_lat,
            "max_lat": max_lat,
            "min_lon": min_lon,
            "max_lon": max_lon
        },
        "projection": "geostationary",  # NOT plate_carree - this is key!
        "resolution": {
            "width": total_width,
            "height": total_height
        },
        "core_dimensions": {
            "width": core_width,
            "height": core_height
        },
        "padding": padding,
        "grid_dimensions": {
            "rows": len(sampled_lat),
            "cols": len(sampled_lat[0]) if sampled_lat else 0
        },
        "lat_grid": sampled_lat,
        "lon_grid": sampled_lon,
        "data_values": brightness,
        "data_unit": "brightness",
        "data_name": "Pixel Brightness",
        "timestamp": None,
        "polygons": [],
        "metadata": {
            "source": "GOES-16",
            "channel": "C13",
            "sample_rate": resolution_factor * sample_rate
        }
    }

    # Save to JSON
    output_file = 'SatWeatherApp/src/data/samples/conus_geodata.json'
    with open(output_file, 'w') as f:
        json.dump(geo_data, f, indent=2)

    print(f"Created {output_file}")
    print(f"  Bounds: lat [{min_lat:.2f}, {max_lat:.2f}], lon [{min_lon:.2f}, {max_lon:.2f}]")
    print(f"  Image size: {total_width}x{total_height}")
    print(f"  Grid size: {len(sampled_lat)}x{len(sampled_lat[0])}")

    return geo_data


def create_oklahoma_json():
    """Create Oklahoma geospatial data JSON from NPZ and H5 files."""
    print("Processing Oklahoma data...")

    # Load NPZ file
    npz_data = np.load('oklahoma_1840x1200_reduced4.npz', allow_pickle=True)

    # Load H5 file
    with h5py.File('channel_c13_data_oklahoma.h5', 'r') as h5:
        lat_grid = h5['latitude'][:]
        lon_grid = h5['longitude'][:]
        rgb_values = h5['rgb_values'][:]

    # Extract metadata
    core_width = int(npz_data['core_width'])
    core_height = int(npz_data['core_height'])
    padding = convert_to_json_friendly(npz_data['padding'].item())
    resolution_factor = int(npz_data['resolution_factor'])

    # Calculate actual image dimensions
    total_width = core_width + padding['left'] + padding['right']
    total_height = core_height + padding['top'] + padding['bottom']

    # Get bounds from lat/lon grids
    min_lat = float(lat_grid.min())
    max_lat = float(lat_grid.max())
    min_lon = float(lon_grid.min())
    max_lon = float(lon_grid.max())

    # Sample the data
    sample_rate = 2
    sampled_lat = sample_grid(lat_grid, sample_rate).tolist()
    sampled_lon = sample_grid(lon_grid, sample_rate).tolist()
    sampled_rgb = sample_grid(rgb_values, sample_rate)

    # Create brightness values
    brightness = np.mean(sampled_rgb, axis=2).astype(float).tolist()

    geo_data = {
        "bounds": {
            "min_lat": min_lat,
            "max_lat": max_lat,
            "min_lon": min_lon,
            "max_lon": max_lon
        },
        "projection": "geostationary",
        "resolution": {
            "width": total_width,
            "height": total_height
        },
        "core_dimensions": {
            "width": core_width,
            "height": core_height
        },
        "padding": padding,
        "grid_dimensions": {
            "rows": len(sampled_lat),
            "cols": len(sampled_lat[0]) if sampled_lat else 0
        },
        "lat_grid": sampled_lat,
        "lon_grid": sampled_lon,
        "data_values": brightness,
        "data_unit": "brightness",
        "data_name": "Pixel Brightness",
        "timestamp": None,
        "polygons": [],
        "metadata": {
            "source": "GOES-16",
            "channel": "C13",
            "sample_rate": resolution_factor * sample_rate
        }
    }

    # Save to JSON
    output_file = 'SatWeatherApp/src/data/samples/oklahoma_geodata.json'
    with open(output_file, 'w') as f:
        json.dump(geo_data, f, indent=2)

    print(f"Created {output_file}")
    print(f"  Bounds: lat [{min_lat:.2f}, {max_lat:.2f}], lon [{min_lon:.2f}, {max_lon:.2f}]")
    print(f"  Image size: {total_width}x{total_height}")
    print(f"  Grid size: {len(sampled_lat)}x{len(sampled_lat[0])}")

    return geo_data


if __name__ == '__main__':
    print("Converting geospatial data to JSON format...\n")

    conus_data = create_conus_json()
    print()
    oklahoma_data = create_oklahoma_json()

    print("\nDone! JSON files ready for app testing.")
    print("\nIMPORTANT: These files use 'geostationary' projection.")
    print("The app's projection utilities need to be updated to support")
    print("lat/lon grid lookup instead of linear interpolation.")
