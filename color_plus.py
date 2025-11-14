#@title Cell 4: Unified Channel Processing V2 { vertical-output: true, display-mode: "form" }

from osgeo import osr
import numpy as np
import xarray as xr
import time
import psutil
import gc
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import threading
from scipy.ndimage import zoom
from numba import jit, prange
NUMBA_AVAILABLE = True

print("📊 CELL 4: UNIFIED CHANNEL PROCESSING")
print("=" * 60)

# Check prerequisites and determine processing path
required_vars = ['DOWNLOAD_RESULTS', 'DOWNLOAD_CONFIG']
missing_vars = [var for var in required_vars if var not in globals()]

if missing_vars:
    raise ValueError(f"❌ Missing required variables: {missing_vars}. Please run Cell 1 first.")

# Detect data characteristics
HAS_DOWNLOAD_SUMMARY = 'DOWNLOAD_SUMMARY' in globals()
HAS_CHANNELS_TO_PROCESS = 'CHANNELS_TO_PROCESS' in globals()
DATA_LEVEL = DOWNLOAD_SUMMARY.get('data_level', 'level1b') if HAS_DOWNLOAD_SUMMARY else 'level1b'
DOMAIN_TYPE = DOWNLOAD_CONFIG.get('domain_type', 'conus')

print(f"🛰️  Processing GOES-{DOWNLOAD_CONFIG['satellite']} {DOMAIN_TYPE} data")
print(f"📊 Data level: {DATA_LEVEL}")
print(f"📁 {len(DOWNLOAD_RESULTS)} channels available")
print(f"🔍 Detection results:")
print(f"   - Download summary: {'✅' if HAS_DOWNLOAD_SUMMARY else '❌'}")
print(f"   - Channel selection: {'✅' if HAS_CHANNELS_TO_PROCESS else '❌ (will process all)'}")

# ============================================================================
# ULTRA-FAST IR PROCESSOR (COMMON TO ALL PATHS)
# ============================================================================

class GOESProjectionAuthority:
    """
    Read GOES projection from NetCDF once.
    Provide geotransforms for any resolution based on data dimensions.
    """

    # Known GOES resolutions (in radians per pixel at native resolution)
    RESOLUTION_MAP = {
        0.5: 0.000014,  # C02, C04, and upscaled RGBs
        1.0: 0.000028,  # C01, C03, C05, C06
        2.0: 0.000056   # C07-C16
    }

    def __init__(self, netcdf_dataset):
        """Initialize from first NetCDF file - read what's there"""
        proj_info = netcdf_dataset['goes_imager_projection']

        # Read parameters from file (these never change)
        self.sat_lon = float(proj_info.longitude_of_projection_origin)
        self.sat_height = float(proj_info.perspective_point_height)
        self.semi_major = float(proj_info.semi_major_axis)
        self.semi_minor = float(proj_info.semi_minor_axis)
        self.inv_flattening = float(proj_info.inverse_flattening)
        self.sweep_axis = str(proj_info.sweep_angle_axis)

        # Read coordinate arrays to determine geographic extent
        x_coords = netcdf_dataset['x'].values
        y_coords = netcdf_dataset['y'].values

        # Store geographic extent (in radians) - this is constant
        self.x_min = float(x_coords.min())
        self.x_max = float(x_coords.max())
        self.y_min = float(y_coords.min())
        self.y_max = float(y_coords.max())

        # Store extent dimensions
        self.x_extent_rad = self.x_max - self.x_min
        self.y_extent_rad = self.y_max - self.y_min

        # Detect resolution of THIS channel (for info)
        dx = float(x_coords[1] - x_coords[0])
        pixel_size_rad = abs(dx)
        if pixel_size_rad < 0.000021:
            self.source_resolution_km = 0.5
        elif pixel_size_rad < 0.000042:
            self.source_resolution_km = 1.0
        else:
            self.source_resolution_km = 2.0

        # Compute WKT and PROJ once
        self._wkt = self._create_wkt()
        self._proj = self._create_proj()

        print(f"✅ GOES Projection Authority initialized")
        print(f"   Satellite: {self.sat_lon}° at {self.sat_height/1e6:.1f}M m")
        print(f"   Geographic extent: {self.x_extent_rad:.6f} x {self.y_extent_rad:.6f} rad")
        print(f"   Source channel resolution: {self.source_resolution_km} km")
        print(f"   (Will auto-detect resolution for RGBs/other channels)")

    def _create_wkt(self):
        """Create WKT using SetGEOS - sweep handled in PROJ string"""
        from osgeo import osr

        srs = osr.SpatialReference()
        srs.SetGeogCS("GRS 1980", "GRS 1980", "GRS80",
                      self.semi_major, self.inv_flattening)
        srs.SetGEOS(self.sat_lon, self.sat_height, 0.0, 0.0)

        return srs.ExportToWkt()

    def _create_proj(self):
        """Create PROJ string with sweep parameter"""
        proj_str = (f"+proj=geos +lon_0={self.sat_lon} "
                    f"+h={self.sat_height} "
                    f"+x_0=0 +y_0=0 "
                    f"+ellps=GRS80 "
                    f"+sweep={self.sweep_axis} "
                    f"+units=m +no_defs")
        return proj_str

    def get_proj(self):
        """Return the PROJ string with sweep parameter"""
        return self._proj

    def get_wkt(self):
        """Return the WKT - same every time"""
        return self._wkt

    def detect_resolution_from_dimensions(self, data_width, data_height):
        """
        Detect what resolution the data is at based on dimensions.
        Works for channels at native resolution AND upscaled RGBs.
        """
        # Calculate pixel spacing from dimensions and known extent
        pixel_spacing_x_rad = self.x_extent_rad / data_width
        pixel_spacing_y_rad = self.y_extent_rad / data_height

        # Use X spacing to determine resolution
        pixel_size_rad = abs(pixel_spacing_x_rad)

        # Determine which standard resolution this matches
        if pixel_size_rad < 0.000021:
            detected_km = 0.5
        elif pixel_size_rad < 0.000042:
            detected_km = 1.0
        else:
            detected_km = 2.0

        return detected_km, pixel_spacing_x_rad, pixel_spacing_y_rad

    def get_geotransform(self, data_width, data_height):
        """
        Return geotransform for data of ANY resolution.
        Auto-detects resolution from dimensions.
        """
        # Detect resolution from dimensions
        detected_km, dx_rad, dy_rad = self.detect_resolution_from_dimensions(data_width, data_height)

        # Convert to meters
        upper_left_x = self.x_min * self.sat_height
        upper_left_y = self.y_max * self.sat_height
        pixel_size_x = dx_rad * self.sat_height
        pixel_size_y = abs(dy_rad * self.sat_height)

        if not OPERATIONAL_MODE:
            print(f"    🔍 Detected resolution: {detected_km} km from dims {data_width}x{data_height}")
            print(f"    📏 Pixel size: {pixel_size_x:.1f} x {pixel_size_y:.1f} meters")

        return [
            upper_left_x,
            pixel_size_x,
            0.0,
            upper_left_y,
            0.0,
            -pixel_size_y
        ]

    def get_info_dict(self):
        """Return info for display"""
        return {
            'sat_lon': self.sat_lon,
            'sat_height': self.sat_height,
            'source_resolution_km': self.source_resolution_km,
            'geographic_extent_rad': (self.x_extent_rad, self.y_extent_rad),
            'supported_resolutions': '0.5, 1.0, 2.0 km (auto-detected)'
        }

# Global singleton - initialized once in Cell 4
_GOES_PROJECTION_AUTHORITY = None

def get_projection_authority():
    """Get the global projection authority (must be initialized first)"""
    if _GOES_PROJECTION_AUTHORITY is None:
        raise ValueError(
            "GOES Projection Authority not initialized!\n"
            "This should have been initialized in Cell 4 when loading channels.\n"
            "Please run Cell 4 first."
        )
    return _GOES_PROJECTION_AUTHORITY

class UltraFastIRProcessor:
    """Ultra-fast IR processing using pre-computed lookup tables"""

    def __init__(self):
        self._temperature_luts = {}
        self._color_luts = {}
        self._combined_luts = {}
        print("🚀 UltraFastIRProcessor initialized")

    def _create_temperature_enhancement_lut(self, channel_code):
        """Create temperature->enhancement LUT using EXACT algorithms"""
        if channel_code in self._temperature_luts:
            return self._temperature_luts[channel_code]

        print(f"    🔧 Pre-computing temperature LUT for {channel_code}")

        temp_celsius = np.linspace(-150, 150, 30000)
        enhanced = np.zeros_like(temp_celsius)

        if channel_code == 'C07':
            t_min, t_max = -83.0, 127.0
            normalized = (temp_celsius - t_min) / (t_max - t_min)
            enhanced = 255.0 - np.clip(normalized * 255.0, 0.0, 255.0)
        elif channel_code in ['C08', 'C09', 'C10']:
            temps = np.array([-93., -88., -83., -78., -73., -68., -63., -58., -54., -53.,
                             -48., -43., -38., -33., -30., -28., -23., -18., -13., -8.,
                             -5., -3., 2., 7.])
            values = np.array([int(i * 255 / (len(temps) - 1)) for i in range(len(temps))])
            enhanced = np.interp(temp_celsius, temps, values)
        elif channel_code in ['C11', 'C12', 'C13', 'C14', 'C15','C16']:
            temps = np.array([-110., -105., -100., -95., -90., -85., -80., -75., -70., -65.,
                             -60., -59., -55., -50., -45., -40., -35., -30., -25., -20.,
                             -15., -10., -5., 0., 5., 6., 10., 15., 20., 25., 30., 31.,
                             35., 40., 45., 50., 55., 57.])
            values = np.array([int(i * 255 / (len(temps) - 1)) for i in range(len(temps))])
            enhanced = np.interp(temp_celsius, temps, values)
        else:
            enhanced = np.clip((temp_celsius + 100) / 200 * 255, 0, 255)

        self._temperature_luts[channel_code] = {
            'temp_celsius': temp_celsius,
            'enhanced': enhanced.astype(np.uint8)
        }
        return self._temperature_luts[channel_code]

    def _create_color_lut(self, channel_code):
        """Create enhancement->RGB LUT using EXACT colormap algorithms"""
        if channel_code in self._color_luts:
            return self._color_luts[channel_code]

        print(f"    🎨 Pre-computing color LUT for {channel_code}")

        lut = np.zeros((256, 3), dtype=np.uint8)

        if channel_code == 'C07':
            key_temps = [-83, -78, -73, -68, -63, -58, -53, -48, -43, -42, -38, -33, -28,
                        -23, -18, -13, -8, -3, 2, 7, 13, 17, 22, 27, 32, 38, 42, 47,
                        52, 57, 62, 67, 72, 77, 82, 87, 92, 97, 102, 107, 112, 117, 122, 127]
            key_colors = [
                (122, 122, 122), (101, 101, 101), (79, 79, 79), (58, 58, 58), (35, 35, 35),
                (70, 0, 0), (252, 0, 0), (255, 149, 0), (201, 255, 0), (172, 255, 0),
                (0, 249, 3), (0, 2, 114), (0, 166, 206), (186, 186, 186), (177, 177, 177),
                (167, 167, 167), (156, 156, 156), (145, 145, 145), (135, 135, 135), (125, 125, 125),
                (112, 112, 112), (103, 103, 103), (91, 91, 91), (80, 80, 80), (69, 69, 69),
                (56, 56, 56), (53, 53, 53), (49, 49, 49), (46, 46, 46), (44, 44, 44),
                (40, 40, 40), (37, 37, 37), (34, 34, 34), (31, 31, 31), (27, 27, 27),
                (24, 24, 24), (21, 21, 21), (17, 17, 17), (14, 14, 14), (11, 11, 11),
                (8, 8, 8), (5, 5, 5), (2, 2, 2), (0, 0, 0)
            ]
            key_colors = key_colors[::-1]
            positions = [(temp - (-83)) / (127 - (-83)) for temp in key_temps]
            indices = np.linspace(0, 1, 256)
            lut[:, 0] = np.interp(indices, positions, [c[0] for c in key_colors])
            lut[:, 1] = np.interp(indices, positions, [c[1] for c in key_colors])
            lut[:, 2] = np.interp(indices, positions, [c[2] for c in key_colors])

        elif channel_code in ['C08', 'C09', 'C10']:
            temps = [-93, -88, -83, -78, -73, -68, -63, -58, -54, -53, -48, -43, -38, -33, -30, -28, -23, -18, -13, -8, -5, -3, 2, 7]
            rgb_colors = [
                (9, 239, 227), (26, 207, 170), (43, 176, 114), (61, 144, 57), (77, 137, 47),
                (100, 152, 73), (122, 167, 99), (145, 182, 126), (164, 194, 148), (170, 200, 156),
                (206, 223, 198), (243, 248, 241), (224, 224, 238), (169, 169, 207), (137, 137, 190),
                (92, 92, 166), (21, 21, 105), (199, 199, 25), (255, 216, 0), (255, 149, 0),
                (255, 109, 0), (255, 81, 0), (255, 9, 0), (0, 0, 0)
            ]
            positions = [(temp - (-93)) / (7 - (-93)) for temp in temps]
            indices = np.linspace(0, 1, 256)
            lut[:, 0] = np.interp(indices, positions, [c[0] for c in rgb_colors])
            lut[:, 1] = np.interp(indices, positions, [c[1] for c in rgb_colors])
            lut[:, 2] = np.interp(indices, positions, [c[2] for c in rgb_colors])

        elif channel_code in ['C11', 'C12', 'C13', 'C14', 'C15','C16']:
            temps = [-110, -105, -100, -95, -90, -85, -80, -75, -70, -65, -60, -59, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 6, 10, 15, 20, 25, 30, 31, 35, 40, 45, 50, 55, 57]
            rgb_colors = [
                (255, 255, 255), (255, 255, 255), (255, 255, 255), (187, 187, 187), (103, 103, 103), (8, 11, 11), (104, 0, 0), (223, 0, 0), (255, 79, 0), (255, 184, 0), (219, 255, 0), (199, 255, 0), (67, 255, 0), (0, 144, 50), (0, 9, 120), (0, 149, 197), (199, 186, 186), (182, 182, 182), (176, 176, 176), (168, 168, 168), (157, 157, 157), (146, 146, 146), (136, 136, 136), (125, 125, 125), (114, 114, 114), (113, 113, 113), (103, 103, 103), (92, 92, 92), (80, 80, 80), (69, 69, 69), (58, 58, 58), (55, 55, 55), (48, 48, 48), (37, 37, 37), (28, 28, 28), (18, 18, 18), (9, 9, 9), (5, 5, 5)
            ]
            positions = [(temp - (-110)) / (57 - (-110)) for temp in temps]
            indices = np.linspace(0, 1, 256)
            lut[:, 0] = np.interp(indices, positions, [c[0] for c in rgb_colors])
            lut[:, 1] = np.interp(indices, positions, [c[1] for c in rgb_colors])
            lut[:, 2] = np.interp(indices, positions, [c[2] for c in rgb_colors])
        else:
            lut[:, 0] = np.arange(256)
            lut[:, 1] = np.arange(256)
            lut[:, 2] = np.arange(256)

        self._color_luts[channel_code] = lut
        return lut

    def create_combined_temperature_to_rgb_lut(self, channel_code):
        """Create ultra-fast direct temperature->RGB LUT"""
        if channel_code in self._combined_luts:
            return self._combined_luts[channel_code]

        print(f"    🚀 Creating combined temperature->RGB LUT for {channel_code}")

        temp_lut = self._create_temperature_enhancement_lut(channel_code)
        color_lut = self._create_color_lut(channel_code)

        temp_range = np.linspace(-150, 150, 3000)
        rgb_lut = np.zeros((len(temp_range), 3), dtype=np.uint8)

        for i, temp in enumerate(temp_range):
            enh_val = np.interp(temp, temp_lut['temp_celsius'], temp_lut['enhanced'])
            enh_idx = int(np.clip(enh_val, 0, 255))
            rgb_lut[i] = color_lut[enh_idx]

        combined_lut = {
            'temp_range': temp_range,
            'rgb_lut': rgb_lut
        }

        self._combined_luts[channel_code] = combined_lut
        print(f"      ✅ Combined LUT: {len(temp_range)} temps -> RGB ({rgb_lut.nbytes} bytes)")
        return combined_lut

# Initialize global ultra-fast IR processor
ULTRA_FAST_IR = UltraFastIRProcessor() if NUMBA_AVAILABLE else None

# ============================================================================
# ENHANCED IR CHANNEL PROCESSOR (COMMON TO ALL PATHS)
# ============================================================================

class EnhancedIRChannelProcessor:
    """Enhanced IR channel calibration with ultra-fast LUT optimization"""

    CHANNEL_CONSTANTS = {
        'C07': [3.8853, 5.44958e+03, 9.20062e+02, 0.43616, 0.99715],
        'C08': [6.2428, 2.08380e+03, 8.97668e+02, 0.27387, 0.99636],
        'C09': [6.9419, 1.67380e+03, 8.95963e+02, 0.30802, 0.99574],
        'C10': [7.3414, 1.49979e+03, 8.94765e+02, 0.33708, 0.99536],
        'C11': [8.4447, 1.12855e+03, 8.89377e+02, 0.39298, 0.99419],
        'C12': [9.6136, 8.68052e+02, 8.78786e+02, 0.47261, 0.99248],
        'C13': [10.3499, 7.47300e+02, 8.68467e+02, 0.53083, 0.99111],
        'C14': [11.1949, 6.34106e+02, 8.55701e+02, 0.60474, 0.98917],
        'C15': [12.2740, 5.16292e+02, 8.36581e+02, 0.70681, 0.98622],
        'C16': [13.2807, 4.31815e+02, 8.16406e+02, 0.81669, 0.98279]
    }

    @staticmethod
    def radiance_to_brightness_temp(radiance, channel_code, ds=None):
        """Convert radiance to brightness temperature - ENHANCED WITH NUMBA"""
        # Try to get constants from dataset first
        if ds is not None:
            try:
                fk1 = float(ds.planck_fk1.values)
                fk2 = float(ds.planck_fk2.values)
                bc1 = float(ds.planck_bc1.values)
                bc2 = float(ds.planck_bc2.values)
            except Exception:
                # Fall back to default constants
                constants = EnhancedIRChannelProcessor.CHANNEL_CONSTANTS.get(channel_code,
                                                                    EnhancedIRChannelProcessor.CHANNEL_CONSTANTS['C13'])
                _, fk1, fk2, bc1, bc2 = constants
        else:
            # Use default constants
            constants = EnhancedIRChannelProcessor.CHANNEL_CONSTANTS.get(channel_code)
            if constants:
                _, fk1, fk2, bc1, bc2 = constants
            else:
                _, fk1, fk2, bc1, bc2 = EnhancedIRChannelProcessor.CHANNEL_CONSTANTS['C13']

        # Use Numba version if available
        if NUMBA_AVAILABLE:
            bt = np.zeros_like(radiance, dtype=np.float32)
            numba_radiance_to_brightness_temp(
                radiance.astype(np.float32),
                np.float32(fk1), np.float32(fk2),
                np.float32(bc1), np.float32(bc2),
                bt
            )
            return bt
        else:
            # Fallback to original implementation
            valid_mask = radiance > 0
            bt = np.full_like(radiance, np.nan, dtype=np.float32)

            if np.any(valid_mask):
                temp_eff = fk2 / np.log(fk1 / radiance[valid_mask] + 1)
                bt[valid_mask] = (temp_eff - bc1) / bc2

            return bt

    @staticmethod
    def enhance_ir_channel(radiance_data, channel_code, ds=None):
        """Enhanced IR channel processing with ultra-fast LUT optimization"""

        bt_kelvin = radiance_data  # Actually BT, not radiance!
        #print(f"    📊 Received BT data: [{np.nanmin(bt_kelvin):.1f}, {np.nanmax(bt_kelvin):.1f}] K")
        bt_celsius = bt_kelvin - 273.15

        # Try ultra-fast LUT processor first (50-100x speedup)
        if ULTRA_FAST_IR and NUMBA_AVAILABLE and ENABLE_ULTRA_FAST_IR_LUTS:
            try:
                # Get or create combined temperature->RGB LUT
                combined_lut = ULTRA_FAST_IR.create_combined_temperature_to_rgb_lut(channel_code)

                # Pre-allocate RGB output
                rgb_output = np.zeros((bt_celsius.shape[0], bt_celsius.shape[1], 3), dtype=np.uint8)

                if not OPERATIONAL_MODE:
                    # Check if temperatures fall within LUT range
                    in_range = ((bt_celsius >= combined_lut['temp_range'][0]) &
                              (bt_celsius <= combined_lut['temp_range'][-1]) &
                              ~np.isnan(bt_celsius))
                    print(f"       Temps in LUT range: {np.sum(in_range)}/{bt_celsius.size} ({100*np.sum(in_range)/bt_celsius.size:.1f}%)")

                # Use ultra-fast Numba LUT function
                ultra_fast_temperature_to_rgb_lut(
                    bt_celsius.astype(np.float32),
                    combined_lut['temp_range'].astype(np.float32),
                    combined_lut['rgb_lut'],
                    rgb_output
                )

                return rgb_output
                # Convert RGB to grayscale for compatibility (or return RGB directly)
                # For now, convert to grayscale to maintain compatibility
                #enhanced_data = (0.299 * rgb_output[:, :, 0] +
                #               0.587 * rgb_output[:, :, 1] +
                #               0.114 * rgb_output[:, :, 2]).astype(np.uint8)

                #return enhanced_data

            except Exception as e:
                print(f"    ⚠️  Ultra-fast LUT failed for {channel_code}: {e}")
                print(f"    🔄 Falling back to Numba enhancement...")

        # Fallback to Numba-optimized enhancement
        if NUMBA_AVAILABLE:
            enhanced_data = np.zeros_like(bt_celsius, dtype=np.uint8)

            if channel_code == 'C07':
                # Shortwave IR with exact CIRA mapping
                numba_ir_enhancement_c07_corrected(bt_celsius.astype(np.float32), enhanced_data)
                print(f"    ⚡ Used Numba C07 enhancement (10-25x speedup)")

            elif channel_code in ['C08', 'C09', 'C10']:
                # Water vapor channels with exact breakpoints
                numba_ir_enhancement_water_vapor_corrected(bt_celsius.astype(np.float32), enhanced_data)
                print(f"    ⚡ Used Numba water vapor enhancement (10-25x speedup)")

            elif channel_code in ['C11', 'C12', 'C13', 'C14', 'C15', 'C16']:
                # IR window channels with exact CIRA rainbow
                numba_ir_enhancement_window_corrected(bt_celsius.astype(np.float32), enhanced_data)
                print(f"    ⚡ Used Numba IR window enhancement (10-25x speedup)")

            else:
                # Default enhancement for unknown channels
                enhanced_data = np.clip((bt_celsius + 100) / 200 * 255, 0, 255).astype(np.uint8)
                print(f"    🔄 Used default enhancement for {channel_code}")

        else:
            # Fallback to simple enhancement without scipy
            print(f"    ⚠️  Numba not available, using simple IR enhancement for {channel_code}")
            enhanced_data = np.clip((bt_celsius + 100) / 200 * 255, 0, 255).astype(np.uint8)

        return enhanced_data

    @staticmethod
    def enhance_visible_channel(calibrated_data):
        """Enhanced visible channel processing"""
        if NUMBA_AVAILABLE:
            enhanced_data = np.zeros_like(calibrated_data, dtype=np.uint8)
            numba_visible_enhancement(calibrated_data.astype(np.float32), enhanced_data)
            print(f"    ⚡ Used Numba visible enhancement")
            return enhanced_data
        else:
            enhanced = np.sqrt(np.clip(calibrated_data, 0, 1))
            return (enhanced * 255).astype(np.uint8)

# ============================================================================
# DATA STORE (COMMON TO ALL PATHS)
# ============================================================================

class ChannelDataStore:
    """Storage for processed channel data"""

    def __init__(self):
        self.channels = {}
        self.metadata = {}
        self.coordinate_data = None
        self.solar_angles = None
        self.processing_times = {}

    def store_channel(self, channel_code, calibrated_data, enhanced_data,
                     channel_type, metadata, processing_time=None):
        """Store processed channel data"""
        self.channels[channel_code] = {
            'calibrated': calibrated_data,
            'enhanced': enhanced_data,
            'channel_type': channel_type,
            'shape': calibrated_data.shape
        }
        self.metadata[channel_code] = metadata
        if processing_time:
            self.processing_times[channel_code] = processing_time

    def store_coordinate_data(self, x_coords, y_coords, projection_info):
        """Store coordinate data"""
        self.coordinate_data = {
            'x_coords': x_coords,
            'y_coords': y_coords,
            'projection_info': projection_info,
            'primary_channel': 'C02'
        }

    def store_solar_angles(self, sza, cos_sza):
        """Store solar angle data"""
        self.solar_angles = {
            'sza': sza,
            'cos_sza': cos_sza
        }

    def get_summary(self):
        """Get processing summary"""
        total_size_mb = 0
        for ch_data in self.channels.values():
            total_size_mb += (ch_data['calibrated'].nbytes + ch_data['enhanced'].nbytes) / (1024 * 1024)

        return {
            'total_channels': len(self.channels),
            'total_size_mb': total_size_mb,
            'has_coordinates': self.coordinate_data is not None,
            'has_solar_angles': self.solar_angles is not None,
            'channel_types': {ch: data['channel_type'] for ch, data in self.channels.items()},
            'avg_processing_time': np.mean(list(self.processing_times.values())) if self.processing_times else 0
        }

# ============================================================================
# PATH SELECTION AND ROUTING
# ============================================================================

def determine_processing_path():
    """Determine which processing path to use based on available data and configuration"""

    print(f"\n🔍 DETERMINING PROCESSING PATH")
    print("-" * 40)

    # Check what we have available
    has_summary = HAS_DOWNLOAD_SUMMARY
    data_level = DATA_LEVEL
    domain_type = DOMAIN_TYPE

    print(f"Available information:")
    print(f"  - Download summary: {has_summary}")
    print(f"  - Data level: {data_level}")
    print(f"  - Domain type: {domain_type}")

    # Determine path
    if data_level == 'level2' or has_summary:
        path = "level2_aware"
        print(f"🎯 Selected path: LEVEL2_AWARE (supports both Level 1b and Level 2)")
    elif domain_type == 'full_disk':
        path = "enhanced_full_disk"
        print(f"🎯 Selected path: ENHANCED_FULL_DISK (optimized for full disk)")
    else:
        path = "standard_conus"
        print(f"🎯 Selected path: STANDARD_CONUS (proven CONUS processing)")

    return path

# ============================================================================
# PATH 1: LEVEL 2 AWARE PROCESSING (From Version 3)
# ============================================================================

def create_valid_coordinate_mask(x_coords, y_coords, sat_height=35786023.0):
    """Create mask for valid coordinates within Earth's disk"""
    earth_radius = 6378137.0
    max_viewing_angle = np.arcsin(earth_radius / sat_height)

    if x_coords.ndim == 1 and y_coords.ndim == 1:
        y_2d, x_2d = np.meshgrid(y_coords, x_coords, indexing='ij')
    else:
        x_2d, y_2d = x_coords, y_coords

    r_squared = x_2d**2 + y_2d**2
    valid_mask = r_squared <= (max_viewing_angle**2)

    total_pixels = valid_mask.size
    valid_pixels = np.sum(valid_mask)

    x_grid = x_2d * sat_height
    y_grid = y_2d * sat_height

    return valid_mask, x_grid, y_grid

def get_level2_channel_requirements(domain_type):
    """Get resolution requirements for Level 2 processing"""
    if domain_type == 'full_disk':
        return {ch: 'native' for ch in ['C01', 'C02', 'C03', 'C04', 'C05', 'C06',
                                       'C07', 'C08', 'C09', 'C10', 'C11', 'C12',
                                       'C13', 'C14', 'C15', 'C16']}
    else:
        return {
            'C02': 'native', 'C04': 'native', 'C09': 'native',
            'C11': 'upscale_4x', 'C12': 'upscale_4x', 'C14': 'upscale_4x',
            'C15': 'upscale_4x', 'C16': 'native',
            'C01': 'upscale_2x', 'C03': 'upscale_2x', 'C05': 'upscale_2x',
            'C06': 'upscale_4x', 'C07': 'upscale_4x', 'C08': 'upscale_4x',
            'C10': 'upscale_4x', 'C13': 'upscale_4x',
        }

def load_level2_data(channels_to_process):
    """Load Level 2 multi-channel data"""
    print(f"📖 Loading Level 2 multi-channel file...")

    raw_data_store = {}
    first_channel = list(DOWNLOAD_RESULTS.keys())[0]
    level2_file = DOWNLOAD_RESULTS[first_channel]['local_path']

    try:
        with xr.open_dataset(level2_file) as ds:
            print(f"  📊 File: {level2_file.split('/')[-1]}")
            print(f"  📐 Resolution: {ds.dims['y']}x{ds.dims['x']}")

            for i, channel in enumerate(channels_to_process, 1):
                print(f"    [{i:2d}/{len(channels_to_process)}] Extracting {channel}...")

                cmi_var = f'CMI_{channel}'
                band_id_var = f'band_id_{channel}'

                if cmi_var not in ds:
                    print(f"      ❌ {cmi_var} not found")
                    continue

                calibrated_data = ds[cmi_var].values.copy()
                band_id = ds[band_id_var].values[0] if band_id_var in ds else int(channel[1:])

                units = ds[cmi_var].attrs.get('units', '')
                channel_type = 'ir' if units == 'K' else 'visible'

                raw_data_store[channel] = {
                    'calibrated_data': calibrated_data,
                    'native_shape': calibrated_data.shape,
                    'band_id': band_id,
                    'channel_type': channel_type,
                    'units': units,
                    'data_level': 'level2',
                    'time_coverage_start': ds.attrs.get('time_coverage_start', ''),
                    'time_coverage_end': ds.attrs.get('time_coverage_end', ''),
                    'orbital_slot': ds.attrs.get('orbital_slot', f'GOES-{DOWNLOAD_CONFIG["satellite"]}'),
                    'file_path': level2_file
                }

                if channel == channels_to_process[0]:
                    raw_data_store[channel]['coordinate_data'] = {
                        'x_coords': ds['x'].values.copy(),
                        'y_coords': ds['y'].values.copy(),
                        'projection_info': ds['goes_imager_projection'],
                        'primary_channel': channel
                    }

                data_size_mb = calibrated_data.nbytes / (1024 * 1024)
                print(f"      ✅ {channel} ({channel_type}): {data_size_mb:.1f} MB")

    except Exception as e:
        print(f"    ❌ Failed to load Level 2 file: {e}")
        return {}

    return raw_data_store

# In Cell 4, modify load_level1b_data function:

def load_level1b_data(channels_to_process):
    """Load Level 1b individual channel files WITH PROJECTION AUTHORITY"""
    global _GOES_PROJECTION_AUTHORITY

    print(f"📖 Loading Level 1b individual channel files...")

    raw_data_store = {}

    for i, channel in enumerate(channels_to_process, 1):
        print(f"  [{i:2d}/{len(channels_to_process)}] Loading {channel}...")

        try:
            file_path = DOWNLOAD_RESULTS[channel]['local_path']

            with xr.open_dataset(file_path) as ds:
                # Initialize projection authority from first channel
                if _GOES_PROJECTION_AUTHORITY is None:
                    print(f"    🔧 Initializing projection authority from {channel}...")
                    _GOES_PROJECTION_AUTHORITY = GOESProjectionAuthority(ds)

                raw_data_store[channel] = {
                    'radiance': ds['Rad'].values.copy(),
                    'native_shape': ds['Rad'].shape,
                    'band_id': ds.band_id.values[0] if 'band_id' in ds else None,
                    'channel_type': 'ir' if ds.band_id.values[0] >= 7 else 'visible',
                    'data_level': 'level1b',
                    'time_coverage_start': ds.time_coverage_start,
                    'time_coverage_end': ds.time_coverage_end,
                    'orbital_slot': getattr(ds, 'orbital_slot', f'GOES-{DOWNLOAD_CONFIG["satellite"]}'),
                    'file_path': file_path
                }

                if raw_data_store[channel]['channel_type'] == 'ir':
                    raw_data_store[channel].update({
                        'planck_fk1': ds['planck_fk1'].values.copy() if 'planck_fk1' in ds else None,
                        'planck_fk2': ds['planck_fk2'].values.copy() if 'planck_fk2' in ds else None,
                        'planck_bc1': ds['planck_bc1'].values.copy() if 'planck_bc1' in ds else None,
                        'planck_bc2': ds['planck_bc2'].values.copy() if 'planck_bc2' in ds else None,
                    })
                else:
                    raw_data_store[channel]['kappa0'] = ds['kappa0'].values.copy() if 'kappa0' in ds else None

                # Store coordinate data from first suitable channel (C02 or first channel)
                if channel == 'C02' or (channel == channels_to_process[0] and 'C02' not in channels_to_process):
                    raw_data_store[channel]['coordinate_data'] = {
                        'x_coords': ds['x'].values.copy(),
                        'y_coords': ds['y'].values.copy(),
                        'projection_info': ds['goes_imager_projection'],
                        'primary_channel': channel
                    }

            data_size_mb = raw_data_store[channel]['radiance'].nbytes / (1024 * 1024)
            print(f"    ✅ {channel}: {data_size_mb:.1f} MB loaded")

        except Exception as e:
            print(f"    ❌ {channel}: Failed to load - {e}")
            continue

    print(f"✅ Level 1b loading complete: {len(raw_data_store)} channels")

    return raw_data_store

def fast_upscale_array(data, zoom_factor):
    """Fast array upscaling with Numba optimization"""
    if zoom_factor == (1.0, 1.0):
        return data

    target_shape = (int(data.shape[0] * zoom_factor[0]), int(data.shape[1] * zoom_factor[1]))

    if NUMBA_AVAILABLE:
        if zoom_factor == (2.0, 2.0):
            output = np.zeros(target_shape, dtype=np.float32)
            numba_fast_upscale_2x(data.astype(np.float32), output)
            return output.astype(data.dtype)
        elif zoom_factor == (4.0, 4.0):
            output = np.zeros(target_shape, dtype=np.float32)
            numba_fast_upscale_4x(data.astype(np.float32), output)
            return output.astype(data.dtype)
        else:
            y_ratio = data.shape[0] / target_shape[0]
            x_ratio = data.shape[1] / target_shape[1]
            output = np.zeros(target_shape, dtype=np.float32)
            numba_bilinear_upscale(data.astype(np.float32), output, y_ratio, x_ratio)
            return output.astype(data.dtype)
    else:
        return zoom(data, zoom_factor, order=1, prefilter=False)

def get_target_shape(channel_code, native_shape, reference_shape, domain_type):
    """Determine target shape based on domain and requirements"""
    requirements = get_level2_channel_requirements(domain_type)
    requirement = requirements.get(channel_code, 'native')

    if requirement == 'native':
        return native_shape
    elif requirement == 'upscale_2x':
        return (native_shape[0] * 2, native_shape[1] * 2)
    elif requirement == 'upscale_4x':
        return (native_shape[0] * 4, native_shape[1] * 4)
    else:
        return reference_shape

def level2_aware_worker(task_data):
    """Level 2 aware processing worker"""
    channel_code, raw_data, target_shape, reference_shape, domain_type = task_data
    start_time = time.time()

    try:
        print(f"  Processing {channel_code} (Level 2 aware)...")

        data_level = raw_data.get('data_level', 'level1b')
        channel_type = raw_data['channel_type']
        band_id = raw_data['band_id']
        current_shape = raw_data['native_shape']

        requirements = get_level2_channel_requirements(domain_type)
        requirement = requirements.get(channel_code, 'native')
        print(f"    Native: {current_shape}, Target: {target_shape}, Rule: {requirement}")

        if data_level == 'level2':
            calibrated_data = raw_data['calibrated_data'].copy()
        else:
            radiance = raw_data['radiance'].copy()

            if channel_type == 'ir':
                class SimpleMockDataset:
                    def __init__(self, cal_params):
                        if cal_params.get('planck_fk1') is not None:
                            self.planck_fk1 = type('obj', (object,), {'values': cal_params['planck_fk1']})
                            self.planck_fk2 = type('obj', (object,), {'values': cal_params['planck_fk2']})
                            self.planck_bc1 = type('obj', (object,), {'values': cal_params['planck_bc1']})
                            self.planck_bc2 = type('obj', (object,), {'values': cal_params['planck_bc2']})
                        else:
                            self.planck_fk1 = None

                simple_mock_ds = SimpleMockDataset(raw_data) if raw_data.get('planck_fk1') is not None else None
                calibrated_data = EnhancedIRChannelProcessor.radiance_to_brightness_temp(radiance, channel_code, simple_mock_ds)
            else:
                if raw_data.get('kappa0') is not None:
                    if NUMBA_AVAILABLE:
                        calibrated_data = np.zeros_like(radiance, dtype=np.float32)
                        numba_visible_calibration(radiance.astype(np.float32),
                                                np.float32(raw_data['kappa0']),
                                                calibrated_data)
                    else:
                        calibrated_data = radiance * raw_data['kappa0']
                else:
                    max_val = np.nanmax(radiance)
                    calibrated_data = radiance / max_val if max_val > 0 else radiance

            del radiance
            gc.collect()

        # Upscale if needed
        if current_shape != target_shape:
            zoom_factor = (target_shape[0] / current_shape[0], target_shape[1] / current_shape[1])
            if zoom_factor != (1.0, 1.0):
                print(f"    Upscaling {zoom_factor[0]:.1f}x from {current_shape} to {target_shape}...")
                calibrated_data_upscaled = fast_upscale_array(calibrated_data, zoom_factor)
                del calibrated_data
                calibrated_data = calibrated_data_upscaled
                gc.collect()

        # Apply enhancement
        if channel_type == 'ir':
            enhanced_data = EnhancedIRChannelProcessor.enhance_ir_channel(calibrated_data, channel_code, None)
        else:
            enhanced_data = EnhancedIRChannelProcessor.enhance_visible_channel(calibrated_data)

        # Build metadata
        metadata = {
            'file_path': raw_data['file_path'],
            'shape': target_shape,
            'band_id': band_id,
            'data_level': data_level,
            'time_coverage_start': raw_data['time_coverage_start'],
            'time_coverage_end': raw_data['time_coverage_end'],
            'orbital_slot': raw_data['orbital_slot'],
        }

        # Ensure proper data types
        if globals().get('COMPRESS_STORED_DATA', True):
            calibrated_data = calibrated_data.astype(np.float32)
            enhanced_data = enhanced_data.astype(np.uint8)

        processing_time = time.time() - start_time
        data_size_mb = (calibrated_data.nbytes + enhanced_data.nbytes) / (1024 * 1024)

        print(f"    ✅ {channel_code}: {data_size_mb:.1f} MB processed in {processing_time:.2f}s")

        return {
            'success': True,
            'channel_code': channel_code,
            'calibrated_data': calibrated_data,
            'enhanced_data': enhanced_data,
            'channel_type': channel_type,
            'metadata': metadata,
            'coordinate_data': raw_data.get('coordinate_data'),
            'processing_time': processing_time
        }

    except Exception as e:
        processing_time = time.time() - start_time
        print(f"    ❌ {channel_code}: Processing failed - {e}")
        return {
            'success': False,
            'channel_code': channel_code,
            'error': str(e),
            'processing_time': processing_time
        }

def compute_solar_angles_enhanced(coordinate_data, scan_time_str):
    """Enhanced solar angle computation with coordinate validation and bounds checking"""
    if not coordinate_data:
        print("⚠️  No coordinate data available")
        return None, None

    print("☀️  Computing solar angles (enhanced version)...")
    start_time = time.time()

    try:
        from datetime import datetime, timezone
        import pyproj

        # Parse scan time
        if isinstance(scan_time_str, str) and 'T' in scan_time_str:
            scan_time = datetime.strptime(scan_time_str, '%Y-%m-%dT%H:%M:%S.%fZ')
            scan_time = scan_time.replace(tzinfo=timezone.utc)
        else:
            scan_time = datetime.utcnow().replace(tzinfo=timezone.utc)

        # Get projection parameters
        proj_info = coordinate_data['projection_info']
        sat_lon = float(proj_info.longitude_of_projection_origin)
        sat_height = float(proj_info.perspective_point_height)

        print(f"   🛰️  Satellite: {sat_lon:.1f}°E")

        # Get coordinate arrays
        x_coords = coordinate_data['x_coords']
        y_coords = coordinate_data['y_coords']

        print(f"   📊 Original coordinates: x={len(x_coords)}, y={len(y_coords)}")

        # Create coordinate validity mask
        print("   📍 Creating coordinate validity mask...")
        valid_mask, x_grid_full, y_grid_full = create_valid_coordinate_mask(x_coords, y_coords, sat_height)

        valid_pixels = np.sum(valid_mask)
        total_pixels = valid_mask.size
        print(f"   Valid pixels: {valid_pixels}/{total_pixels} ({100*valid_pixels/total_pixels:.1f}%)")

        # Determine downsampling factor with safety checks
        downsample = 8 if len(x_coords) > 3000 else 4
        downsample = min(downsample, len(x_coords) // 20, len(y_coords) // 20)  # Ensure we have enough points
        downsample = max(downsample, 1)  # Minimum downsample of 1

        # Downsample coordinates
        x_coords_down = x_coords[::downsample]
        y_coords_down = y_coords[::downsample]

        # DISABLE downsampling for testing
        #downsample = 1  # No downsampling
        #print(f"   📊 TESTING: No downsampling (factor = {downsample})")

        # Use full resolution coordinates
        #x_coords_down = x_coords
        #y_coords_down = y_coords

        # Carefully downsample the valid mask to match grid dimensions
        valid_mask_down = valid_mask[::downsample, ::downsample]

        print(f"   📊 Downsampled coordinates: x={len(x_coords_down)}, y={len(y_coords_down)}")
        print(f"   📊 Downsampled mask shape: {valid_mask_down.shape}")

        # Create coordinate grids using standard 'xy' indexing (more predictable)
        x_grid, y_grid = np.meshgrid(x_coords_down, y_coords_down, indexing='xy')
        x_grid_scaled = x_grid * sat_height
        y_grid_scaled = y_grid * sat_height

        print(f"   📊 Grid shapes: x_grid={x_grid.shape}, y_grid={y_grid.shape}")

        # Ensure valid_mask_down matches grid shape
        if valid_mask_down.shape != x_grid.shape:
            print(f"   ⚠️  Reshaping valid mask from {valid_mask_down.shape} to {x_grid.shape}")
            # Use zoom to resize the mask
            from scipy.ndimage import zoom
            zoom_factors = (x_grid.shape[0] / valid_mask_down.shape[0],
                           x_grid.shape[1] / valid_mask_down.shape[1])
            valid_mask_down = zoom(valid_mask_down.astype(float), zoom_factors, order=0) > 0.5

        print(f"   📊 Final shapes: grid={x_grid.shape}, mask={valid_mask_down.shape}")
        print(f"   📊 Valid ratio after downsampling: {np.sum(valid_mask_down)/valid_mask_down.size:.3f}")

        # Set up coordinate transformation
        goes_proj = pyproj.Proj(proj='geos', lon_0=sat_lon, h=sat_height, x_0=0, y_0=0, datum='WGS84')
        lonlat_proj = pyproj.Proj(proj='latlong', datum='WGS84')
        transformer = pyproj.Transformer.from_proj(goes_proj, lonlat_proj, always_xy=True)

        # Initialize output grids
        lon_grid = np.full_like(x_grid, np.nan)
        lat_grid = np.full_like(y_grid, np.nan)

        # Find valid coordinates with bounds checking
        valid_indices = np.where(valid_mask_down)
        print(f"   📍 Found {len(valid_indices[0])} valid coordinate points")

        if len(valid_indices[0]) > 0:
            # Add bounds checking to prevent index errors
            max_i, max_j = x_grid_scaled.shape
            safe_i = np.clip(valid_indices[0], 0, max_i - 1)
            safe_j = np.clip(valid_indices[1], 0, max_j - 1)

            valid_x = x_grid_scaled[safe_i, safe_j]
            valid_y = y_grid_scaled[safe_i, safe_j]

            # Filter out non-finite coordinates before transformation
            finite_mask = np.isfinite(valid_x) & np.isfinite(valid_y)
            print(f"   📍 Finite coordinates: {np.sum(finite_mask)}/{len(finite_mask)}")

            if np.any(finite_mask):
                clean_x = valid_x[finite_mask]
                clean_y = valid_y[finite_mask]
                clean_i = safe_i[finite_mask]
                clean_j = safe_j[finite_mask]

                try:
                    # Transform coordinates
                    valid_lon, valid_lat = transformer.transform(clean_x, clean_y)

                    # Check for finite results
                    finite_results = np.isfinite(valid_lon) & np.isfinite(valid_lat)
                    print(f"   📍 Successful transformations: {np.sum(finite_results)}/{len(finite_results)}")

                    if np.any(finite_results):
                        final_i = clean_i[finite_results]
                        final_j = clean_j[finite_results]
                        final_lon = valid_lon[finite_results]
                        final_lat = valid_lat[finite_results]

                        # Double-check bounds before assignment
                        valid_assignments = ((final_i >= 0) & (final_i < lon_grid.shape[0]) &
                                           (final_j >= 0) & (final_j < lon_grid.shape[1]))

                        if np.any(valid_assignments):
                            lon_grid[final_i[valid_assignments], final_j[valid_assignments]] = final_lon[valid_assignments]
                            lat_grid[final_i[valid_assignments], final_j[valid_assignments]] = final_lat[valid_assignments]

                except Exception as e:
                    print(f"   ⚠️  Coordinate transformation error: {e}")

        # Check if we have any valid coordinates
        finite_coords = np.isfinite(lat_grid) & np.isfinite(lon_grid)
        if np.any(finite_coords):
            print(f"   📍 Coordinate ranges:")
            print(f"      Latitude: {np.nanmin(lat_grid[finite_coords]):.1f}° to {np.nanmax(lat_grid[finite_coords]):.1f}°")
            print(f"      Longitude: {np.nanmin(lon_grid[finite_coords]):.1f}° to {np.nanmax(lon_grid[finite_coords]):.1f}°")
        else:
            raise ValueError("No finite coordinates after transformation")

        # Solar angle calculations
        day_of_year = scan_time.timetuple().tm_yday
        utc_hour = scan_time.hour + scan_time.minute / 60.0 + scan_time.second / 3600.0
        declination = 23.45 * np.sin(np.radians(360 * (284 + day_of_year) / 365.25))

        print(f"   📅 Day {day_of_year}, UTC hour {utc_hour:.3f}, declination {declination:.2f}°")

        # Convert to radians
        lat_rad = np.radians(lat_grid)
        lon_rad = np.radians(lon_grid)
        dec_rad = np.radians(declination)

        # Initialize solar angle grids
        sza_grid = np.full_like(lat_grid, np.nan)
        cos_sza_grid = np.full_like(lat_grid, np.nan)

        # Calculate solar angles only for valid coordinates
        valid_solar = finite_coords
        if np.any(valid_solar):
            lat_valid = lat_rad[valid_solar]
            lon_valid = lon_rad[valid_solar]

            # Calculate hour angle
            hour_angle_deg = 15.0 * (utc_hour - 12.0) + np.degrees(lon_valid)
            hour_angle_rad = np.radians(hour_angle_deg)

            # Calculate solar zenith angle
            cos_sza_valid = (np.sin(lat_valid) * np.sin(dec_rad) +
                           np.cos(lat_valid) * np.cos(dec_rad) * np.cos(hour_angle_rad))
            cos_sza_valid = np.clip(cos_sza_valid, -1, 1)
            sza_valid = np.degrees(np.arccos(cos_sza_valid))

            # Store results
            cos_sza_grid[valid_solar] = cos_sza_valid
            sza_grid[valid_solar] = sza_valid

        # Validate solar angle results
        valid_sza = sza_grid[np.isfinite(sza_grid)]
        if len(valid_sza) > 0:
            sza_range = (np.nanmin(sza_grid), np.nanmax(sza_grid))
            day_pixels = np.sum(valid_sza < 90)
            total_valid = len(valid_sza)

            print(f"   ✅ Solar angles computed:")
            print(f"      SZA range: {sza_range[0]:.1f}° to {sza_range[1]:.1f}°")
            print(f"      Daytime: {day_pixels}/{total_valid} ({100*day_pixels/total_valid:.1f}%)")
        else:
            raise ValueError("No valid solar angles computed")

        # Upsample back to full resolution
        from scipy.ndimage import zoom
        full_shape = (len(y_coords), len(x_coords))
        zoom_factors = (full_shape[0] / sza_grid.shape[0], full_shape[1] / sza_grid.shape[1])

        print(f"   📏 Upsampling by {zoom_factors[0]:.1f}x, {zoom_factors[1]:.1f}x to {full_shape}")

        # Handle NaN values for upsampling
        sza_valid_for_zoom = np.where(np.isfinite(sza_grid), sza_grid, 90.0)
        cos_sza_valid_for_zoom = np.where(np.isfinite(cos_sza_grid), cos_sza_grid, 0.0)

        # Upsample
        sza_full = zoom(sza_valid_for_zoom, zoom_factors, order=1).astype(np.float32)
        cos_sza_full = zoom(cos_sza_valid_for_zoom, zoom_factors, order=1).astype(np.float32)

        # Apply original valid mask
        sza_full = np.where(valid_mask, sza_full, np.nan)
        cos_sza_full = np.where(valid_mask, cos_sza_full, np.nan)

        total_time = time.time() - start_time
        print(f"   ⏱️  Total time: {total_time:.2f}s")

        return sza_full, cos_sza_full

    except Exception as e:
        print(f"❌ Error in solar angle computation: {e}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")

        # Enhanced fallback
        try:
            full_shape = (len(coordinate_data['y_coords']), len(coordinate_data['x_coords']))
            x_coords = coordinate_data['x_coords']
            y_coords = coordinate_data['y_coords']
            valid_mask, _, _ = create_valid_coordinate_mask(x_coords, y_coords)

            # Initialize with NaN
            sza = np.full(full_shape, np.nan, dtype=np.float32)
            cos_sza = np.full(full_shape, np.nan, dtype=np.float32)

            # Create a reasonable fallback pattern if we have scan time
            if 'scan_time' in locals() and scan_time:
                utc_hour = scan_time.hour + scan_time.minute/60.0

                # Create a spatial pattern based on coordinate position
                y_indices, x_indices = np.meshgrid(
                    np.linspace(0, 1, full_shape[0]),
                    np.linspace(0, 1, full_shape[1]),
                    indexing='ij'
                )

                # Base SZA varies with time and longitude proxy
                base_sza = max(90 - (15 * abs(utc_hour - 12)), 20)
                lon_variation = (x_indices - 0.5) * 30  # ±15 degree variation
                sza_pattern = base_sza + lon_variation

                # Apply only to valid pixels
                sza = np.where(valid_mask, np.clip(sza_pattern, 10, 120), np.nan)
                cos_sza = np.where(valid_mask, np.cos(np.radians(sza)), np.nan)

                print(f"   🔄 Enhanced fallback: SZA range {np.nanmin(sza):.1f}° to {np.nanmax(sza):.1f}°")
            else:
                # Simple uniform fallback
                sza = np.where(valid_mask, 60.0, np.nan)
                cos_sza = np.where(valid_mask, np.cos(np.radians(60.0)), np.nan)
                print(f"   🔄 Simple fallback: uniform 60° SZA for valid pixels")

            return sza, cos_sza

        except Exception as fallback_error:
            print(f"❌ Fallback also failed: {fallback_error}")
            return None, None

def process_level2_aware():
    """Level 2 aware processing path"""
    print(f"\n📊 LEVEL 2 AWARE PROCESSING")
    print("-" * 50)

    # Determine channels to process
    if HAS_CHANNELS_TO_PROCESS and CHANNELS_TO_PROCESS is not None:
        channels_to_process = [ch for ch in CHANNELS_TO_PROCESS if ch in DOWNLOAD_RESULTS]
    else:
        channels_to_process = list(DOWNLOAD_RESULTS.keys())

    print(f"📊 Processing {len(channels_to_process)} channels: {channels_to_process}")
    print(f"🔍 Data level: {DATA_LEVEL}")
    print(f"🌍 Domain type: {DOMAIN_TYPE}")

    data_store = OptimizedMemoryStore()
    memory_monitor = setup_memory_monitoring(data_store)

    # PHASE 1: Data loading
    print(f"\n📖 PHASE 1: Data Loading")
    phase1_start = time.time()

    if DATA_LEVEL == 'level2':
        raw_data_store = load_level2_data(channels_to_process)
    else:
        raw_data_store = load_level1b_data(channels_to_process)

    phase1_time = time.time() - phase1_start

    if not raw_data_store:
        print("❌ No data loaded successfully")
        print_comprehensive_memory_report(data_store)

    # Clean up memory monitor
    if memory_monitor:
        try:
            memory_monitor.stop_monitoring()
        except:
            pass

    print(f"✅ Phase 1: {len(raw_data_store)} channels loaded in {phase1_time:.1f}s")

    # Determine reference shape
    reference_shape = None
    if 'C02' in raw_data_store:
        reference_shape = raw_data_store['C02']['native_shape']
    else:
        max_pixels = 0
        for data in raw_data_store.values():
            pixels = data['native_shape'][0] * data['native_shape'][1]
            if pixels > max_pixels:
                max_pixels = pixels
                reference_shape = data['native_shape']

    print(f"🎯 Reference shape: {reference_shape}")

    # PHASE 2: Processing
    print(f"\n⚡ PHASE 2: Processing")
    phase2_start = time.time()

    tasks = []
    for channel_code, raw_data in raw_data_store.items():
        target_shape = get_target_shape(
            channel_code, raw_data['native_shape'], reference_shape, DOMAIN_TYPE
        )
        task = (channel_code, raw_data, target_shape, reference_shape, DOMAIN_TYPE)
        tasks.append(task)

    print(f"🚀 Processing {len(tasks)} channels...")

    successful = 0
    failed = 0
    max_workers = globals().get('MAX_PARALLEL_WORKERS', 4)
    enable_parallel = globals().get('ENABLE_PARALLEL_PROCESSING', True)

    if enable_parallel and len(tasks) > 1:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_channel = {
                executor.submit(level2_aware_worker, task): task[0]
                for task in tasks
            }

            for future in as_completed(future_to_channel):
                channel = future_to_channel[future]
                try:
                    result = future.result()

                    if result['success']:
                        data_store.store_channel(
                            result['channel_code'],
                            result['calibrated_data'],
                            result['enhanced_data'],
                            result['channel_type'],
                            result['metadata'],
                            result['processing_time']
                        )

                        if result['coordinate_data']:
                            coord_data = result['coordinate_data']
                            data_store.store_coordinate_data(
                                coord_data['x_coords'],
                                coord_data['y_coords'],
                                coord_data['projection_info']
                            )

                        successful += 1
                    else:
                        failed += 1

                except Exception as e:
                    print(f"❌ {channel}: Unexpected error - {e}")
                    failed += 1
    else:
        print("🔄 Sequential processing")
        for task in tasks:
            result = level2_aware_worker(task)

            if result['success']:
                data_store.store_channel(
                    result['channel_code'],
                    result['calibrated_data'],
                    result['enhanced_data'],
                    result['channel_type'],
                    result['metadata'],
                    result['processing_time']
                )

                if result['coordinate_data']:
                    coord_data = result['coordinate_data']
                    data_store.store_coordinate_data(
                        coord_data['x_coords'],
                        coord_data['y_coords'],
                        coord_data['projection_info']
                    )

                successful += 1
            else:
                failed += 1

    phase2_time = time.time() - phase2_start
    total_time = phase1_time + phase2_time

    # Solar angles
    enable_solar = globals().get('ENABLE_SOLAR_ANGLES', True)
    if enable_solar and data_store.coordinate_data:
        scan_time = None
        if data_store.metadata:
            first_channel = list(data_store.metadata.keys())[0]
            scan_time = data_store.metadata[first_channel].get('time_coverage_start')

        sza, cos_sza = compute_solar_angles_enhanced(data_store.coordinate_data, scan_time)
        if sza is not None:
            data_store.store_solar_angles(sza, cos_sza)

    print(f"\n📊 LEVEL 2 AWARE PROCESSING COMPLETE")
    print("-" * 40)
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Phase 1 (I/O): {phase1_time:.1f}s")
    print(f"⚡ Phase 2 (Processing): {phase2_time:.1f}s")
    print(f"🎯 Total time: {total_time:.1f}s")

    return data_store

# ============================================================================
# PATH 2: STANDARD CONUS PROCESSING (From Versions 1&2)
# ============================================================================

def get_standard_channel_requirements():
    """Standard CONUS channel requirements"""
    return {
        'C02': 'native', 'C04': 'native', 'C09': 'native',
        'C11': 'upscale_4x', 'C12': 'upscale_4x', 'C14': 'upscale_4x',
        'C15': 'upscale_4x', 'C16': 'native',
        'C01': 'upscale_2x', 'C03': 'upscale_2x', 'C05': 'upscale_2x',
        'C06': 'upscale_4x', 'C07': 'upscale_4x', 'C08': 'upscale_4x',
        'C10': 'upscale_4x', 'C13': 'upscale_4x',
    }

def get_standard_target_shape(channel_code, native_shape, reference_shape):
    """Standard target shape determination"""
    requirements = get_standard_channel_requirements()
    requirement = requirements.get(channel_code, 'native')

    if requirement == 'native':
        return native_shape
    elif requirement == 'upscale_2x':
        return (native_shape[0] * 2, native_shape[1] * 2)
    elif requirement == 'upscale_4x':
        return (native_shape[0] * 4, native_shape[1] * 4)
    else:
        return reference_shape

def standard_conus_worker(task_data):
    """Standard CONUS processing worker"""
    channel_code, raw_data, target_shape, reference_shape = task_data
    start_time = time.time()

    try:
        print(f"  🔄 Worker processing {channel_code} (standard CONUS)...")

        radiance = raw_data['radiance'].copy()
        channel_type = raw_data['channel_type']
        band_id = raw_data['band_id']
        current_shape = raw_data['native_shape']

        requirements = get_standard_channel_requirements()
        requirement = requirements.get(channel_code, 'native')
        print(f"    📊 Native: {current_shape}, Target: {target_shape}, Rule: {requirement}")

        # Upscale radiance if needed BEFORE processing
        if current_shape != target_shape:
            zoom_factor = (target_shape[0] / current_shape[0], target_shape[1] / current_shape[1])
            if zoom_factor != (1.0, 1.0):
                print(f"    📏 Upscaling {zoom_factor[0]:.1f}x from {current_shape} to {target_shape}...")
                radiance = fast_upscale_array(radiance, zoom_factor)

        # Process based on channel type
        if channel_type == 'ir':
            print(f"    🌡️  Processing IR channel {channel_code}...")

            class SimpleMockDataset:
                def __init__(self, cal_params):
                    if cal_params['planck_fk1'] is not None:
                        self.planck_fk1 = type('obj', (object,), {'values': cal_params['planck_fk1']})
                        self.planck_fk2 = type('obj', (object,), {'values': cal_params['planck_fk2']})
                        self.planck_bc1 = type('obj', (object,), {'values': cal_params['planck_bc1']})
                        self.planck_bc2 = type('obj', (object,), {'values': cal_params['planck_bc2']})
                    else:
                        self.planck_fk1 = None

            simple_mock_ds = SimpleMockDataset(raw_data) if raw_data['planck_fk1'] is not None else None
            calibrated_data = EnhancedIRChannelProcessor.radiance_to_brightness_temp(radiance, channel_code, simple_mock_ds)

            enhanced_data = EnhancedIRChannelProcessor.enhance_ir_channel(calibrated_data, channel_code, simple_mock_ds)

        else:
            print(f"    ☀️  Processing visible channel {channel_code}...")

            if raw_data['kappa0'] is not None:
                if NUMBA_AVAILABLE:
                    calibrated_data = np.zeros_like(radiance, dtype=np.float32)
                    numba_visible_calibration(radiance.astype(np.float32),
                                            np.float32(raw_data['kappa0']),
                                            calibrated_data)
                else:
                    calibrated_data = radiance * raw_data['kappa0']
            else:
                max_val = np.nanmax(radiance)
                calibrated_data = radiance / max_val if max_val > 0 else radiance

            enhanced_data = EnhancedIRChannelProcessor.enhance_visible_channel(calibrated_data)

        del radiance

        metadata = {
            'file_path': raw_data['file_path'],
            'shape': target_shape,
            'band_id': band_id,
            'time_coverage_start': raw_data['time_coverage_start'],
            'time_coverage_end': raw_data['time_coverage_end'],
            'orbital_slot': raw_data['orbital_slot'],
        }

        if globals().get('COMPRESS_STORED_DATA', True):
            calibrated_data = calibrated_data.astype(np.float32)
            enhanced_data = enhanced_data.astype(np.uint8)

        processing_time = time.time() - start_time
        data_size_mb = (calibrated_data.nbytes + enhanced_data.nbytes) / (1024 * 1024)

        print(f"    ✅ {channel_code}: {data_size_mb:.1f} MB processed in {processing_time:.2f}s")

        return {
            'success': True,
            'channel_code': channel_code,
            'calibrated_data': calibrated_data,
            'enhanced_data': enhanced_data,
            'channel_type': channel_type,
            'metadata': metadata,
            'coordinate_data': raw_data.get('coordinate_data'),
            'processing_time': processing_time
        }

    except Exception as e:
        processing_time = time.time() - start_time
        print(f"    ❌ {channel_code}: Processing failed - {e}")
        return {
            'success': False,
            'channel_code': channel_code,
            'error': str(e),
            'processing_time': processing_time
        }

def compute_solar_angles_simple(coordinate_data, scan_time_str):
    """Simple solar angle computation"""
    if not coordinate_data:
        print("⚠️  No coordinate data available")
        return None, None

    print("☀️  Computing solar angles (simple version)...")
    start_time = time.time()

    try:
        from datetime import datetime, timezone
        import pyproj

        if isinstance(scan_time_str, str) and 'T' in scan_time_str:
            scan_time = datetime.strptime(scan_time_str, '%Y-%m-%dT%H:%M:%S.%fZ')
            scan_time = scan_time.replace(tzinfo=timezone.utc)
        else:
            scan_time = datetime.utcnow().replace(tzinfo=timezone.utc)

        proj_info = coordinate_data['projection_info']
        sat_lon = float(proj_info.longitude_of_projection_origin)
        sat_height = float(proj_info.perspective_point_height)

        print(f"   🛰️  Satellite: {sat_lon:.1f}°E")

        x_coords = coordinate_data['x_coords']
        y_coords = coordinate_data['y_coords']

        downsample = 16
        x_coords_down = x_coords[::downsample]
        y_coords_down = y_coords[::downsample]

        x_grid, y_grid = np.meshgrid(x_coords_down * sat_height, y_coords_down * sat_height)

        print(f"   📊 Downsampled grid: {x_grid.shape}")

        goes_proj = pyproj.Proj(proj='geos', lon_0=sat_lon, h=sat_height, x_0=0, y_0=0, datum='WGS84')
        lonlat_proj = pyproj.Proj(proj='latlong', datum='WGS84')
        transformer = pyproj.Transformer.from_proj(goes_proj, lonlat_proj, always_xy=True)

        lon_grid, lat_grid = transformer.transform(x_grid.flatten(), y_grid.flatten())
        lon_grid = lon_grid.reshape(x_grid.shape)
        lat_grid = lat_grid.reshape(y_grid.shape)

        print(f"   📍 Coordinate ranges:")
        print(f"      Latitude: {np.nanmin(lat_grid):.1f}° to {np.nanmax(lat_grid):.1f}°")
        print(f"      Longitude: {np.nanmin(lon_grid):.1f}° to {np.nanmax(lon_grid):.1f}°")

        if np.all(np.isnan(lat_grid)) or np.all(np.isnan(lon_grid)):
            raise ValueError("All coordinates are NaN after transformation")

        day_of_year = scan_time.timetuple().tm_yday
        utc_hour = scan_time.hour + scan_time.minute / 60.0 + scan_time.second / 3600.0

        declination = 23.45 * np.sin(np.radians(360 * (284 + day_of_year) / 365.25))

        print(f"   📅 Day {day_of_year}, UTC hour {utc_hour:.3f}, declination {declination:.2f}°")

        lat_rad = np.radians(lat_grid)
        lon_rad = np.radians(lon_grid)
        dec_rad = np.radians(declination)

        hour_angle_deg = 15.0 * (utc_hour - 12.0) + lon_grid
        hour_angle_rad = np.radians(hour_angle_deg)

        cos_sza_grid = (np.sin(lat_rad) * np.sin(dec_rad) +
                       np.cos(lat_rad) * np.cos(dec_rad) * np.cos(hour_angle_rad))

        cos_sza_grid = np.clip(cos_sza_grid, -1, 1)
        sza_grid = np.degrees(np.arccos(cos_sza_grid))

        valid_sza = sza_grid[~np.isnan(sza_grid)]
        if len(valid_sza) > 0:
            sza_range = (np.nanmin(sza_grid), np.nanmax(sza_grid))
            day_pixels = np.sum(valid_sza < 90)
            total_valid = len(valid_sza)

            print(f"   ✅ Solar angles computed:")
            print(f"      SZA range: {sza_range[0]:.1f}° to {sza_range[1]:.1f}°")
            print(f"      Daytime: {day_pixels}/{total_valid} ({100*day_pixels/total_valid:.1f}%)")

        else:
            raise ValueError("No valid solar angles computed")

        from scipy.ndimage import zoom
        full_shape = (len(y_coords), len(x_coords))
        zoom_factors = (full_shape[0] / sza_grid.shape[0], full_shape[1] / sza_grid.shape[1])

        print(f"   📏 Upsampling by {zoom_factors[0]:.1f}x to {full_shape}")

        sza_full = zoom(sza_grid, zoom_factors, order=1).astype(np.float32)
        cos_sza_full = zoom(cos_sza_grid, zoom_factors, order=1).astype(np.float32)

        total_time = time.time() - start_time
        print(f"   ⏱️  Total time: {total_time:.2f}s")

        return sza_full, cos_sza_full

    except Exception as e:
        print(f"❌ Error in solar angle computation: {e}")

        full_shape = (len(coordinate_data['y_coords']), len(coordinate_data['x_coords']))

        if 'scan_time' in locals():
            utc_hour = scan_time.hour + scan_time.minute/60.0
            print(f"   🔄 Using time-based fallback for UTC hour {utc_hour:.1f}")

            y_indices, x_indices = np.meshgrid(
                np.arange(full_shape[0]) / full_shape[0],
                np.arange(full_shape[1]) / full_shape[1],
                indexing='ij'
            )

            base_sza = 90 - (15 * abs(utc_hour - 12))
            base_sza = max(base_sza, 30)

            lon_variation = (x_indices - 0.5) * 20
            sza_pattern = base_sza + lon_variation

            sza = np.clip(sza_pattern, 20, 120).astype(np.float32)
            cos_sza = np.cos(np.radians(sza))

            print(f"   📊 Fallback SZA range: {np.min(sza):.1f}° to {np.max(sza):.1f}°")

        else:
            sza = np.full(full_shape, 60.0, dtype=np.float32)
            cos_sza = np.cos(np.radians(sza))
            print(f"   🔄 Using default SZA: 60°")

        return sza, cos_sza

def process_standard_conus():
    """Standard CONUS processing path"""
    print(f"\n📊 STANDARD CONUS PROCESSING")
    print("-" * 50)

    # Determine channels to process
    if HAS_CHANNELS_TO_PROCESS and CHANNELS_TO_PROCESS is not None:
        channels_to_process = [ch for ch in CHANNELS_TO_PROCESS if ch in DOWNLOAD_RESULTS]
    else:
        channels_to_process = list(DOWNLOAD_RESULTS.keys())

    print(f"📊 Processing {len(channels_to_process)} channels: {channels_to_process}")
    print(f"⚙️  Strategy: Sequential I/O → Parallel Processing")

    data_store = ChannelDataStore()
    memory_monitor = setup_memory_monitoring(data_store)

    # PHASE 1: Sequential file loading
    print(f"\n📖 PHASE 1: Sequential Data Loading")
    phase1_start = time.time()
    raw_data_store = load_level1b_data(channels_to_process)
    phase1_time = time.time() - phase1_start

    if not raw_data_store:
        print("❌ No data loaded successfully")
        return data_store

    print(f"✅ Phase 1: {len(raw_data_store)} channels loaded in {phase1_time:.1f}s")

    # Determine reference shape
    reference_shape = None
    if 'C02' in raw_data_store:
        reference_shape = raw_data_store['C02']['native_shape']
    else:
        max_pixels = 0
        for data in raw_data_store.values():
            pixels = data['native_shape'][0] * data['native_shape'][1]
            if pixels > max_pixels:
                max_pixels = pixels
                reference_shape = data['native_shape']

    print(f"🎯 Reference shape: {reference_shape}")

    # PHASE 2: Parallel processing
    print(f"\n⚡ PHASE 2: Parallel Processing")
    phase2_start = time.time()

    tasks = []
    for channel_code, raw_data in raw_data_store.items():
        target_shape = get_standard_target_shape(channel_code, raw_data['native_shape'], reference_shape)
        task = (channel_code, raw_data, target_shape, reference_shape)
        tasks.append(task)

    print(f"🚀 Processing {len(tasks)} channels...")

    successful = 0
    failed = 0
    max_workers = globals().get('MAX_PARALLEL_WORKERS', 4)
    enable_parallel = globals().get('ENABLE_PARALLEL_PROCESSING', True)

    if enable_parallel and len(tasks) > 1:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_channel = {
                executor.submit(standard_conus_worker, task): task[0]
                for task in tasks
            }

            for future in as_completed(future_to_channel):
                channel = future_to_channel[future]
                try:
                    result = future.result()

                    if result['success']:
                        data_store.store_channel(
                            result['channel_code'],
                            result['calibrated_data'],
                            result['enhanced_data'],
                            result['channel_type'],
                            result['metadata'],
                            result['processing_time']
                        )

                        if result['coordinate_data']:
                            coord_data = result['coordinate_data']
                            data_store.store_coordinate_data(
                                coord_data['x_coords'],
                                coord_data['y_coords'],
                                coord_data['projection_info']
                            )

                        successful += 1
                    else:
                        failed += 1

                except Exception as e:
                    print(f"❌ {channel}: Unexpected error - {e}")
                    failed += 1
    else:
        print("🔄 Sequential processing")
        for task in tasks:
            result = standard_conus_worker(task)

            if result['success']:
                data_store.store_channel(
                    result['channel_code'],
                    result['calibrated_data'],
                    result['enhanced_data'],
                    result['channel_type'],
                    result['metadata'],
                    result['processing_time']
                )

                if result['coordinate_data']:
                    coord_data = result['coordinate_data']
                    data_store.store_coordinate_data(
                        coord_data['x_coords'],
                        coord_data['y_coords'],
                        coord_data['projection_info']
                    )

                successful += 1
            else:
                failed += 1

    phase2_time = time.time() - phase2_start
    total_time = phase1_time + phase2_time

    # Solar angles
    enable_solar = globals().get('ENABLE_SOLAR_ANGLES', True)
    if enable_solar and data_store.coordinate_data:
        scan_time = None
        if data_store.metadata:
            first_channel = list(data_store.metadata.keys())[0]
            scan_time = data_store.metadata[first_channel].get('time_coverage_start')

        sza, cos_sza = compute_solar_angles_simple(data_store.coordinate_data, scan_time)
        if sza is not None:
            data_store.store_solar_angles(sza, cos_sza)

    print(f"\n📊 STANDARD CONUS PROCESSING COMPLETE")
    print("-" * 40)
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Phase 1 (I/O): {phase1_time:.1f}s")
    print(f"⚡ Phase 2 (Processing): {phase2_time:.1f}s")
    print(f"🎯 Total time: {total_time:.1f}s")

    return data_store

# ============================================================================
# PATH 3: ENHANCED FULL DISK (From Version 2)
# ============================================================================

def process_enhanced_full_disk():
    """Enhanced full disk processing path (all channels native resolution)"""
    print(f"\n📊 ENHANCED FULL DISK PROCESSING")
    print("-" * 50)

    # For full disk, process all channels at native resolution
    if HAS_CHANNELS_TO_PROCESS and CHANNELS_TO_PROCESS is not None:
        channels_to_process = [ch for ch in CHANNELS_TO_PROCESS if ch in DOWNLOAD_RESULTS]
    else:
        channels_to_process = list(DOWNLOAD_RESULTS.keys())

    print(f"📊 Processing {len(channels_to_process)} channels: {channels_to_process}")
    print(f"🌍 Full disk mode: All channels at native resolution")

    data_store = ChannelDataStore()
    memory_monitor = setup_memory_monitoring(data_store)

    # PHASE 1: Sequential file loading
    print(f"\n📖 PHASE 1: Sequential Data Loading")
    phase1_start = time.time()
    raw_data_store = load_level1b_data(channels_to_process)
    phase1_time = time.time() - phase1_start

    if not raw_data_store:
        print("❌ No data loaded successfully")
        return data_store

    print(f"✅ Phase 1: {len(raw_data_store)} channels loaded in {phase1_time:.1f}s")

    # For full disk, use native shapes (no upscaling)
    reference_shape = None
    if 'C02' in raw_data_store:
        reference_shape = raw_data_store['C02']['native_shape']
    else:
        # Use largest native shape as reference
        max_pixels = 0
        for data in raw_data_store.values():
            pixels = data['native_shape'][0] * data['native_shape'][1]
            if pixels > max_pixels:
                max_pixels = pixels
                reference_shape = data['native_shape']

    print(f"🎯 Reference shape: {reference_shape}")

    # PHASE 2: Processing (all channels at native resolution)
    print(f"\n⚡ PHASE 2: Processing (Native Resolution)")
    phase2_start = time.time()

    tasks = []
    for channel_code, raw_data in raw_data_store.items():
        # Full disk: always use native shape (no upscaling)
        target_shape = raw_data['native_shape']
        task = (channel_code, raw_data, target_shape, reference_shape)
        tasks.append(task)

    print(f"🚀 Processing {len(tasks)} channels at native resolution...")

    successful = 0
    failed = 0
    max_workers = globals().get('MAX_PARALLEL_WORKERS', 4)
    enable_parallel = globals().get('ENABLE_PARALLEL_PROCESSING', True)

    if enable_parallel and len(tasks) > 1:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_channel = {
                executor.submit(standard_conus_worker, task): task[0]  # Reuse worker
                for task in tasks
            }

            for future in as_completed(future_to_channel):
                channel = future_to_channel[future]
                try:
                    result = future.result()

                    if result['success']:
                        data_store.store_channel(
                            result['channel_code'],
                            result['calibrated_data'],
                            result['enhanced_data'],
                            result['channel_type'],
                            result['metadata'],
                            result['processing_time']
                        )

                        if result['coordinate_data']:
                            coord_data = result['coordinate_data']
                            data_store.store_coordinate_data(
                                coord_data['x_coords'],
                                coord_data['y_coords'],
                                coord_data['projection_info']
                            )

                        successful += 1
                    else:
                        failed += 1

                except Exception as e:
                    print(f"❌ {channel}: Unexpected error - {e}")
                    failed += 1
    else:
        print("🔄 Sequential processing")
        for task in tasks:
            result = standard_conus_worker(task)

            if result['success']:
                data_store.store_channel(
                    result['channel_code'],
                    result['calibrated_data'],
                    result['enhanced_data'],
                    result['channel_type'],
                    result['metadata'],
                    result['processing_time']
                )

                if result['coordinate_data']:
                    coord_data = result['coordinate_data']
                    data_store.store_coordinate_data(
                        coord_data['x_coords'],
                        coord_data['y_coords'],
                        coord_data['projection_info']
                    )

                successful += 1
            else:
                failed += 1

    phase2_time = time.time() - phase2_start
    total_time = phase1_time + phase2_time

    # Solar angles (enhanced version for full disk)
    enable_solar = globals().get('ENABLE_SOLAR_ANGLES', True)
    if enable_solar and data_store.coordinate_data:
        scan_time = None
        if data_store.metadata:
            first_channel = list(data_store.metadata.keys())[0]
            scan_time = data_store.metadata[first_channel].get('time_coverage_start')

        sza, cos_sza = compute_solar_angles_enhanced(data_store.coordinate_data, scan_time)
        if sza is not None:
            data_store.store_solar_angles(sza, cos_sza)

    print(f"\n📊 ENHANCED FULL DISK PROCESSING COMPLETE")
    print("-" * 40)
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Phase 1 (I/O): {phase1_time:.1f}s")
    print(f"⚡ Phase 2 (Processing): {phase2_time:.1f}s")
    print(f"🎯 Total time: {total_time:.1f}s")

    return data_store

# ============================================================================
# MAIN EXECUTION AND PATH ROUTING
# ============================================================================

# Determine processing path
processing_path = determine_processing_path()

print(f"\n🚀 Starting unified channel processing...")
print(f"📊 Path selected: {processing_path}")
print(f"⚙️  Configuration:")
print(f"   📊 Channels: {CHANNELS_TO_PROCESS or 'all downloaded'}")
print(f"   ⚡ Parallel processing: {globals().get('ENABLE_PARALLEL_PROCESSING', True)}")
print(f"   ☀️  Solar angles: {globals().get('ENABLE_SOLAR_ANGLES', True)}")
print(f"   🚀 Ultra-fast IR LUTs: {'✅ Enabled' if ULTRA_FAST_IR else '❌ Requires Numba'}")

# Get initial memory
try:
    initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
    print(f"   🧠 Initial memory: {initial_memory:.1f} MB")
except:
    initial_memory = 0

# Route to appropriate processing path
if processing_path == "level2_aware":
    PROCESSED_CHANNELS = process_level2_aware()
elif processing_path == "enhanced_full_disk":
    PROCESSED_CHANNELS = process_enhanced_full_disk()
else:  # standard_conus
    PROCESSED_CHANNELS = process_standard_conus()

# Final memory check
try:
    final_memory = psutil.Process().memory_info().rss / 1024 / 1024
    memory_delta = final_memory - initial_memory
    print(f"🧠 Final memory: {final_memory:.1f} MB ({memory_delta:+.1f} MB)")
except:
    pass

# Clean up
gc.collect()

# Create access variables for next cells
CHANNELS = PROCESSED_CHANNELS.channels
METADATA = PROCESSED_CHANNELS.metadata
COORDINATE_DATA = PROCESSED_CHANNELS.coordinate_data
SOLAR_ANGLES = PROCESSED_CHANNELS.solar_angles

print(f"\n🔗 VARIABLES CREATED FOR NEXT CELLS:")
print(f"   PROCESSED_CHANNELS: Complete data store object")
print(f"   CHANNELS: Direct access to channel data")
print(f"   COORDINATE_DATA: Projection and coordinate info")
print(f"   SOLAR_ANGLES: Solar zenith angle data")

# Show final summary
summary = PROCESSED_CHANNELS.get_summary()
print(f"\n📋 FINAL SUMMARY:")
print(f"🛰️  Processing path: {processing_path}")
print(f"📊 Channels processed: {summary['total_channels']}")
print(f"💾 Total data: {summary['total_size_mb']:.1f} MB")
print(f"📍 Coordinates: {'✅' if summary['has_coordinates'] else '❌'}")
print(f"☀️  Solar angles: {'✅' if summary['has_solar_angles'] else '❌'}")

if summary['channel_types']:
    ir_channels = [ch for ch, typ in summary['channel_types'].items() if typ == 'ir']
    vis_channels = [ch for ch, typ in summary['channel_types'].items() if typ == 'visible']
    print(f"🌡️  IR channels ({len(ir_channels)}): {ir_channels}")
    print(f"☀️  Visible channels ({len(vis_channels)}): {vis_channels}")

print(f"\n✅ UNIFIED CELL 4 COMPLETE")
print(f"🎯 Ready for next processing steps!")

#@title Cell 5: RGB Generation { vertical-output: true, display-mode: "form" }

import numpy as np
import time
import gc
import tempfile
import pickle
import shutil
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import cpu_count

print("🌈 CELL 5: RGB GENERATION (ENHANCED WITH ADDITIONAL PRODUCTS)")
print("=" * 60)

# ============================================================================
# VERIFY PREREQUISITES (SAME AS ORIGINAL)
# ============================================================================

# Check basic prerequisites
if not all(var in globals() for var in ['CHANNELS', 'RGB_PRODUCTS_TO_CREATE', 'SOLAR_ANGLES']):
    raise ValueError("❌ Please run Cell 1.5 and Cell 2 first")

# Verify Cell 0.5 ran successfully
if not globals().get('NUMBA_WARMUP_COMPLETE', False):
    raise ValueError("❌ Cell 0.5 (Numba functions) must be run first for ultra-fast processing")

print("✅ Cell 0.5 Numba functions detected and ready for ultra-fast RGB generation")
print(f"📊 Available channels: {list(CHANNELS.keys())}")
print(f"🎨 RGB products to create: {RGB_PRODUCTS_TO_CREATE}")
print(f"☀️  Solar angles available: {'✅' if SOLAR_ANGLES else '❌'}")

# ============================================================================
# ENHANCED RGB DATA STORE (PRESERVES ORIGINAL INTERFACE)
# ============================================================================

class UnifiedRGBDataStore:
    """Unified RGB storage - single place for all products"""

    def __init__(self):
        self.rgb_products = {}
        self.processing_stats = {}
        self.creation_times = {}

    def store_rgb(self, product_name, rgb_array, creation_time=None, processing_stats=None):
        """Store any RGB product"""
        self.rgb_products[product_name] = rgb_array
        if creation_time:
            self.creation_times[product_name] = creation_time
        if processing_stats:
            self.processing_stats[product_name] = processing_stats

    def get_all_products(self):
        """Get all RGB products"""
        return self.rgb_products

    def get_summary(self):
        """Get comprehensive RGB storage summary"""
        total_size_mb = sum(rgb.nbytes for rgb in self.rgb_products.values()) / (1024 * 1024)

        # Group products by category
        categories = {}
        for product_name in self.rgb_products.keys():
            if product_name in RGB_CATALOG:
                category = RGB_CATALOG[product_name]['category']
                if category not in categories:
                    categories[category] = []
                categories[category].append(product_name)

        return {
            'total_products': len(self.rgb_products),
            'total_size_mb': total_size_mb,
            'products': list(self.rgb_products.keys()),
            'shapes': {name: rgb.shape for name, rgb in self.rgb_products.items()},
            'categories': categories,
            'creation_times': dict(self.creation_times),
            'processing_stats': dict(self.processing_stats)
        }

RGB_CATALOG = {
    # Core/Popular Products
    'geocolor': {
        'channels': ['C01', 'C02', 'C03', 'C07', 'C13'],
        'worker': 'rgb_worker_geocolor',
        'description': 'Sophisticated geocolor with day/night blending',
        'category': 'core'
    },
    'cloud_microphysics': {
        'channels': ['C02', 'C05', 'C07', 'C13', 'C15'],
        'worker': 'rgb_worker_cloud_microphysics',
        'description': 'Cloud microphysics RGB for 24-hour composite',
        'category': 'core'
    },

    # Basic/Legacy Products
    'true_color': {
        'channels': ['C01', 'C02', 'C03'],
        'worker': 'rgb_worker_true_color',
        'description': 'Basic true color (use geocolor for better results)',
        'category': 'basic'
    },
    'day_cloud_phase': {
        'channels': ['C02', 'C05', 'C13'],
        'worker': 'rgb_worker_day_cloud_phase',
        'description': 'Day cloud phase only (use cloud_microphysics for 24h)',
        'category': 'basic'
    },

    # Atmospheric Analysis
    'airmass': {
        'channels': ['C08', 'C10', 'C12', 'C13'],
        'worker': 'rgb_worker_airmass',
        'description': 'Airmass RGB for jet streams and fronts',
        'category': 'atmospheric'
    },
    'simple_water_vapor': {
        'channels': ['C08', 'C09', 'C10'],
        'worker': 'rgb_worker_simple_water_vapor',
        'description': 'Simple water vapor RGB',
        'category': 'atmospheric'
    },
    'differential_water_vapor': {
        'channels': ['C08', 'C10'],
        'worker': 'rgb_worker_differential_water_vapor',
        'description': 'Differential water vapor',
        'category': 'atmospheric'
    },

    # Hazards Detection
    'dust': {
        'channels': ['C11', 'C13', 'C14', 'C15'],
        'worker': 'rgb_worker_dust',
        'description': 'Dust RGB for dust storms',
        'category': 'hazards'
    },
    'ash': {
        'channels': ['C11', 'C13', 'C15'],
        'worker': 'rgb_worker_ash',
        'description': 'Volcanic ash RGB',
        'category': 'hazards'
    },
    'fire_temperature': {
        'channels': ['C07', 'C06', 'C05'],
        'worker': 'rgb_worker_fire_temperature',
        'description': 'Fire temperature RGB',
        'category': 'hazards'
    },
    'day_land_cloud_fire': {
        'channels': ['C06', 'C03', 'C02'],
        'worker': 'rgb_worker_day_land_cloud_fire',
        'description': 'Day land cloud fire RGB',
        'category': 'hazards'
    },

    # Weather Analysis
    'day_snow_fog': {
        'channels': ['C03', 'C05', 'C07', 'C13'],
        'worker': 'rgb_worker_day_snow_fog',
        'description': 'Day snow fog RGB',
        'category': 'weather'
    },
    'night_microphysics': {
        'channels': ['C07', 'C13', 'C15'],
        'worker': 'rgb_worker_night_microphysics',
        'description': 'Nighttime microphysics (fog, low clouds)',
        'category': 'weather'
    },
    'split_window': {
        'channels': ['C13', 'C15'],
        'worker': 'rgb_worker_split_window_optimized',
        'description': 'Split window RGB with temperature analysis',
        'category': 'weather'
    },
    'split_window_difference': {
        'channels': ['C13', 'C15'],
        'worker': 'rgb_worker_split_window_difference',
        'description': 'Split window difference',
        'category': 'weather'
    },
    'day_snow_fog_night_fog': {
        'channels': ['C03', 'C05', 'C07', 'C13'],
        'worker': 'rgb_worker_day_snow_fog_night_fog',
        'description': '24-hour fog detection: Day snow fog + Night fog (cyan)',
        'category': 'weather'
    },

    # Composite Products
    'sandwich': {
        'channels': ['C02', 'C13'],
        'worker': 'rgb_worker_sandwich_optimized',
        'description': 'Sandwich RGB for 24-hour day/night composite',
        'category': 'composite'
    }
}

# UNIFIED WORKER REGISTRY - Single mapping to all workers
def get_rgb_worker_registry():
    """Return mapping of worker names to actual worker functions"""
    return {
        'rgb_worker_geocolor': rgb_worker_geocolor,
        'rgb_worker_true_color': rgb_worker_true_color,
        'rgb_worker_day_cloud_phase': rgb_worker_day_cloud_phase,
        'rgb_worker_cloud_microphysics': rgb_worker_cloud_microphysics,
        'rgb_worker_airmass': rgb_worker_airmass,
        'rgb_worker_dust': rgb_worker_dust,
        'rgb_worker_ash': rgb_worker_ash,
        'rgb_worker_fire_temperature': rgb_worker_fire_temperature,
        'rgb_worker_night_microphysics': rgb_worker_night_microphysics,
        'rgb_worker_day_snow_fog': rgb_worker_day_snow_fog,
        'rgb_worker_split_window_difference': rgb_worker_split_window_difference,
        'rgb_worker_differential_water_vapor': rgb_worker_differential_water_vapor,
        'rgb_worker_simple_water_vapor': rgb_worker_simple_water_vapor,
        'rgb_worker_day_land_cloud_fire': rgb_worker_day_land_cloud_fire,
        'rgb_worker_split_window_optimized': rgb_worker_split_window_optimized,
        'rgb_worker_sandwich_optimized': rgb_worker_sandwich_optimized,
        'rgb_worker_day_snow_fog_night_fog': rgb_worker_day_snow_fog_night_fog_core,
    }

# ============================================================================
# ORIGINAL RGB WORKER FUNCTIONS (PRESERVED EXACTLY)
# ============================================================================
def create_coordinate_grids2(x_coords, y_coords, target_shape):
    """
    Create lat/lon coordinate grids from GOES x/y coordinates
    Simplified version of Cell 5's create_goes_lat_lon_grids function
    """
    import pyproj

    # GOES projection parameters (you may need to get these from your data)
    # These are typical GOES-East values - adjust for your satellite
    sat_lon = -75.0 if SATELLITE_CHOICE in ['goes_east', 'goes_16', 'goes_19'] else -137.0
    sat_height = 42164160.0  # meters
    semi_major = 6378137.0   # WGS84 semi-major axis
    inv_flattening = 298.257223563  # WGS84 inverse flattening

    # Set up GOES projection
    proj_string = (
        f"+proj=geos +lon_0={sat_lon} +h={sat_height} "
        f"+a={semi_major} +rf={inv_flattening} "
        f"+sweep=x +units=m +no_defs"
    )

    goes_proj = pyproj.Proj(proj_string)
    lonlat_proj = pyproj.Proj(proj='latlong', datum='WGS84')
    transformer = pyproj.Transformer.from_proj(goes_proj, lonlat_proj, always_xy=True)

    # Convert from radians to meters
    x_meters = x_coords * sat_height
    y_meters = y_coords * sat_height

    # Create 2D grids
    X, Y = np.meshgrid(x_meters, y_meters)

    # Transform to lat/lon
    lons, lats = transformer.transform(X.flatten(), Y.flatten())

    # Reshape back to 2D and ensure correct shape
    goes_lons = lons.reshape(X.shape).astype(np.float32)
    goes_lats = lats.reshape(Y.shape).astype(np.float32)

    # Resize to match target shape if needed
    if goes_lons.shape != target_shape:
        from scipy.ndimage import zoom
        y_ratio = target_shape[0] / goes_lons.shape[0]
        x_ratio = target_shape[1] / goes_lons.shape[1]
        goes_lons = zoom(goes_lons, (y_ratio, x_ratio), order=1)
        goes_lats = zoom(goes_lats, (y_ratio, x_ratio), order=1)

    # Mask invalid coordinates
    valid_mask = np.isfinite(goes_lons) & np.isfinite(goes_lats)
    goes_lons = np.where(valid_mask, goes_lons, np.nan)
    goes_lats = np.where(valid_mask, goes_lats, np.nan)

    return goes_lons, goes_lats

def create_coordinate_grids(x_coords, y_coords, target_shape):
    """
    CORRECTED: Uses exact method from working paste 2
    """
    import pyproj

    try:
        # Get GOES projection parameters (same as paste 2)
        if 'COORDINATE_DATA' in globals() and COORDINATE_DATA:
            proj_info = COORDINATE_DATA['projection_info']
            sat_lon = float(proj_info.longitude_of_projection_origin)
            sat_height = float(proj_info.perspective_point_height)
            semi_major = float(proj_info.semi_major_axis)
            inv_flattening = float(proj_info.inverse_flattening)
            sweep_axis = str(proj_info.sweep_angle_axis)
        else:
            # Fallback values for GOES East
            sat_lon = -75.0
            sat_height = 42164160.0  # CORRECTED: Use same value as paste 2
            semi_major = 6378137.0
            inv_flattening = 298.257223563
            sweep_axis = 'x'

        print(f"COORDINATE TRANSFORM DEBUG:")
        print(f"  sat_lon: {sat_lon}")
        print(f"  sat_height: {sat_height}")
        print(f"  x_coords range: {np.min(x_coords):.6f} to {np.max(x_coords):.6f}")
        print(f"  y_coords range: {np.min(y_coords):.6f} to {np.max(y_coords):.6f}")

        # EXACT same projection setup as paste 2
        proj_string = (
            f"+proj=geos +lon_0={sat_lon} +h={sat_height} "
            f"+a={semi_major} +rf={inv_flattening} "
            f"+sweep={sweep_axis} +units=m +no_defs"
        )

        goes_proj = pyproj.Proj(proj_string)
        lonlat_proj = pyproj.Proj(proj='latlong', datum='WGS84')
        transformer = pyproj.Transformer.from_proj(goes_proj, lonlat_proj, always_xy=True)

        # EXACT same coordinate conversion as paste 2
        x_meters = x_coords * sat_height  # CRITICAL: This was missing/wrong
        y_meters = y_coords * sat_height

        print(f"  X meters range: {x_meters.min()/1e6:.1f} to {x_meters.max()/1e6:.1f} million meters")
        print(f"  Y meters range: {y_meters.min()/1e6:.1f} to {y_meters.max()/1e6:.1f} million meters")

        # EXACT same meshgrid creation as paste 2
        X, Y = np.meshgrid(x_meters, y_meters)

        print(f"  Transforming {X.size:,} coordinate pairs...")

        # EXACT same transformation as paste 2
        lons, lats = transformer.transform(X.flatten(), Y.flatten())

        # Reshape back to 2D (same as paste 2)
        goes_lons = lons.reshape(X.shape).astype(np.float32)
        goes_lats = lats.reshape(Y.shape).astype(np.float32)

        # Apply same masking as paste 2
        valid_mask = np.isfinite(goes_lons) & np.isfinite(goes_lats)
        goes_lons = np.where(valid_mask, goes_lons, np.nan)
        goes_lats = np.where(valid_mask, goes_lats, np.nan)

        # Diagnostic output (same as paste 2)
        valid_pixels = np.sum(valid_mask)
        total_pixels = valid_mask.size
        print(f"  Valid pixels: {valid_pixels:,} of {total_pixels:,} ({100*valid_pixels/total_pixels:.1f}%)")
        print(f"  Lon range: {np.nanmin(goes_lons):.2f} to {np.nanmax(goes_lons):.2f}")
        print(f"  Lat range: {np.nanmin(goes_lats):.2f} to {np.nanmax(goes_lats):.2f}")

        return goes_lons, goes_lats

    except Exception as e:
        print(f"Coordinate transformation failed: {e}")
        import traceback
        traceback.print_exc()
        return np.full(target_shape, np.nan, dtype=np.float32), np.full(target_shape, np.nan, dtype=np.float32)

def rgb_worker_geocolor(channels_data, solar_angles_data):
    """Enhanced geocolor worker that handles mesoscale nightlights automatically"""
    try:
        print(f"    🌈 Worker creating sophisticated geocolor with mesoscale support...")

        # Check required channels
        required = ['C01', 'C02', 'C03', 'C07', 'C13']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # CRITICAL: Prepare mesoscale nightlights BEFORE processing
        if DOMAIN_CHOICE in ['mesoscale1', 'mesoscale2']:
            print("    🌃 Preparing mesoscale nightlights...")
            prepare_mesoscale_nightlights()

        # Rest of geocolor processing unchanged...
        blue_ref = np.ascontiguousarray(channels_data['C01']['calibrated'].astype(np.float32))
        red_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))
        nir_ref = np.ascontiguousarray(channels_data['C03']['calibrated'].astype(np.float32))
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
        c07_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))

        if solar_angles_data:
            cos_sza = np.ascontiguousarray(solar_angles_data['cos_sza'].astype(np.float32))
            sza = np.ascontiguousarray(solar_angles_data['sza'].astype(np.float32))
            print(f"    ☀️  Using computed solar angles for day/night blending")
        else:
            print(f"    ☀️  No solar angles available, using default values")
            cos_sza = np.full(blue_ref.shape, 0.707, dtype=np.float32)
            sza = np.full(blue_ref.shape, 45.0, dtype=np.float32)

        print(f"    🗺️  Generating high-quality land/sea mask...")
        land_mask = get_land_mask_for_geocolor()

        output = np.zeros((blue_ref.shape[0], blue_ref.shape[1], 3), dtype=np.uint8)

        x_coords = COORDINATE_DATA['x_coords']
        y_coords = COORDINATE_DATA['y_coords']
        goes_lons, goes_lats = create_coordinate_grids(x_coords, y_coords, blue_ref.shape)

        # Call enhanced Numba function with mesoscale nightlights support
        numba_geocolor_core(blue_ref, red_ref, nir_ref, c13_bt, c07_bt, cos_sza, sza, output,
                           precomputed_land_mask=land_mask, goes_lons=goes_lons, goes_lats=goes_lats)

        # Report nightlights status
        if NIGHTLIGHTS_HEIGHT > 1 and NIGHTLIGHTS_WIDTH > 1:
            lights_count = np.sum(NIGHTLIGHTS_DATA > 0) if NIGHTLIGHTS_DATA.size > 1 else 0
            print(f"    ✨ Applied nightlights: {lights_count:,} lit pixels")
        else:
            print(f"    ⚪ No nightlights applied (placeholder data)")

        print(f"    ⚡ Enhanced geocolor complete with mesoscale nightlights support")

        return {'success': True, 'rgb_data': output, 'method': 'geocolor_enhanced_mesoscale'}

    except Exception as e:
        print(f"    ❌ Geocolor error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

def rgb_worker_geocolor2(channels_data, solar_angles_data):
    """Enhanced geocolor worker with high-quality land mask"""
    try:
        print(f"    🌈 Worker creating sophisticated geocolor...")

        # Check required channels
        required = ['C01', 'C02', 'C03', 'C07', 'C13']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get calibrated data as contiguous float32 arrays
        blue_ref = np.ascontiguousarray(channels_data['C01']['calibrated'].astype(np.float32))
        red_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))
        nir_ref = np.ascontiguousarray(channels_data['C03']['calibrated'].astype(np.float32))
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
        c07_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))

        # Get solar angles
        if solar_angles_data:
            cos_sza = np.ascontiguousarray(solar_angles_data['cos_sza'].astype(np.float32))
            sza = np.ascontiguousarray(solar_angles_data['sza'].astype(np.float32))
            print(f"    ☀️  Using computed solar angles for day/night blending")
        else:
            print(f"    ☀️  No solar angles available, using default values")
            cos_sza = np.full(blue_ref.shape, 0.707, dtype=np.float32)  # cos(45°)
            sza = np.full(blue_ref.shape, 45.0, dtype=np.float32)

        # NEW: Generate high-quality land mask
        print(f"    🗺️  Generating high-quality land/sea mask...")
        #mask_gen = GOESLandSeaMask()
        # Determine satellite based on your data (you'll need to pass this info)
        #if SATELLITE_CHOICE in ['goes_west', 'goes_17', 'goes_18']:
        #    satellite = 'west'
        #else:
        #    satellite = 'east'

        #land_mask = mask_gen.create_land_mask(satellite, blue_ref.shape)
        land_mask = get_land_mask_for_geocolor()

        # Pre-allocate output array
        output = np.zeros((blue_ref.shape[0], blue_ref.shape[1], 3), dtype=np.uint8)

        x_coords = COORDINATE_DATA['x_coords']
        y_coords = COORDINATE_DATA['y_coords']
        # Create lat/lon grids (simplified version of your Cell 5 function)
        goes_lons, goes_lats = create_coordinate_grids(x_coords, y_coords, blue_ref.shape)

        # Call enhanced Numba function with land mask
        numba_geocolor_core(blue_ref, red_ref, nir_ref, c13_bt, c07_bt, cos_sza, sza, output,
                           precomputed_land_mask=land_mask, goes_lons=goes_lons, goes_lats=goes_lats)
        print(f"    ⚡ Enhanced Numba geocolor complete with high-quality coastlines")

        return {'success': True, 'rgb_data': output, 'method': 'geocolor_enhanced'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_true_color(channels_data, solar_angles_data):
    """ORIGINAL true color worker - PRESERVED EXACTLY"""
    try:
        print(f"    🌈 Worker creating enhanced true color...")

        required = ['C01', 'C02', 'C03']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        blue_ref = np.ascontiguousarray(channels_data['C01']['calibrated'].astype(np.float32))
        red_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))
        nir_ref = np.ascontiguousarray(channels_data['C03']['calibrated'].astype(np.float32))

        # Get solar angles
        if solar_angles_data:
            cos_sza = np.ascontiguousarray(solar_angles_data['cos_sza'].astype(np.float32))
        else:
            cos_sza = np.full(blue_ref.shape, 0.707, dtype=np.float32)

        # Pre-allocate output
        output = np.zeros((blue_ref.shape[0], blue_ref.shape[1], 3), dtype=np.uint8)

        # Call ultra-fast Numba function
        numba_true_color_core_enhanced(blue_ref, red_ref, nir_ref, cos_sza, output)
        print(f"    ⚡ Enhanced Numba true color complete")

        return {'success': True, 'rgb_data': output, 'method': 'true_color_enhanced'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_day_cloud_phase(channels_data, solar_angles_data):
    """ORIGINAL day cloud phase worker - PRESERVED EXACTLY"""
    try:
        print(f"    🌈 Worker creating advanced day cloud phase...")

        required = ['C02', 'C05', 'C13']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data
        red_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))
        snow_ice_ref = np.ascontiguousarray(channels_data['C05']['calibrated'].astype(np.float32))
        clean_ir_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))

        # Convert to Celsius
        clean_ir_celsius = clean_ir_bt - 273.15

        # Pre-allocate output
        output = np.zeros((red_ref.shape[0], red_ref.shape[1], 3), dtype=np.uint8)

        # Call ultra-fast Numba function
        numba_day_cloud_phase_core_enhanced(red_ref, snow_ice_ref, clean_ir_celsius, output)
        print(f"    ⚡ Advanced Numba day cloud phase complete")

        return {'success': True, 'rgb_data': output, 'method': 'day_cloud_phase_advanced'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# SOPHISTICATED GEOCOLOR WRAPPER FUNCTION
# ============================================================================

def create_sophisticated_geocolor(channels_data, solar_angles_data, coordinate_data):
    """
    Create sophisticated geocolor using enhanced algorithms
    Requires corrected solar angles from the first artifact
    """
    print(f"🌈 Creating SOPHISTICATED GEOCOLOR...")

    # Check required channels
    required = ['C01', 'C02', 'C03', 'C07', 'C13']
    missing = [ch for ch in required if ch not in channels_data]
    if missing:
        print(f"❌ Missing channels for sophisticated geocolor: {missing}")
        return None

    # Get calibrated data
    blue_ref = np.ascontiguousarray(channels_data['C01']['calibrated'].astype(np.float32))
    red_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))
    nir_ref = np.ascontiguousarray(channels_data['C03']['calibrated'].astype(np.float32))
    c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
    c07_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))

    #print(f"   📊 Data shapes: Blue {blue_ref.shape}, Red {red_ref.shape}")
    #print(f"   🌡️  Temperature ranges: C13 {np.nanmin(c13_bt):.1f}-{np.nanmax(c13_bt):.1f}K")

    # Get solar angles
    if solar_angles_data:
        cos_sza = np.ascontiguousarray(solar_angles_data['cos_sza'].astype(np.float32))
        sza = np.ascontiguousarray(solar_angles_data['sza'].astype(np.float32))

        # Check if solar angles look reasonable
        valid_sza = sza[~np.isnan(sza)]
        if len(valid_sza) > 0:
            day_fraction = np.sum(valid_sza < 90) / len(valid_sza)
            print(f"   ☀️  Solar angles: SZA {np.nanmin(sza):.1f}-{np.nanmax(sza):.1f}°, {day_fraction:.1%} daytime")

            if day_fraction < 0.1:
                print(f"   ⚠️  WARNING: Very little daytime detected - check solar angle correction!")
        else:
            print(f"   ⚠️  WARNING: No valid solar angles!")
    else:
        print(f"   ⚠️  No solar angles available, using defaults")
        cos_sza = np.full(blue_ref.shape, 0.707, dtype=np.float32)
        sza = np.full(blue_ref.shape, 45.0, dtype=np.float32)

    # Create lat/lon grids for land/sea masking (simplified)
    if coordinate_data:
        try:
            # Use coordinate data to create approximate lat/lon grids
            x_coords = coordinate_data['x_coords']
            y_coords = coordinate_data['y_coords']
            proj_info = coordinate_data['projection_info']
            sat_lon = float(proj_info.longitude_of_projection_origin)

            # Simple approximation for lat/lon (good enough for land/sea mask)
            y_grid, x_grid = np.meshgrid(y_coords, x_coords, indexing='ij')

            # Rough conversion (this is approximate but sufficient for land/sea classification)
            lat_grid = np.degrees(y_grid)  # Very rough approximation
            lon_grid = sat_lon + np.degrees(x_grid)  # Very rough approximation

            # Clamp to reasonable ranges
            lat_grid = np.clip(lat_grid, 10, 60).astype(np.float32)
            lon_grid = np.clip(lon_grid, -140, -50).astype(np.float32)

            print(f"   📍 Approximate coordinates: Lat {np.min(lat_grid):.1f}-{np.max(lat_grid):.1f}°")
            print(f"                               Lon {np.min(lon_grid):.1f}-{np.max(lon_grid):.1f}°")

        except Exception as e:
            print(f"   ⚠️  Could not create coordinate grids: {e}")
            # Fallback to default CONUS coordinates
            lat_grid = np.full(blue_ref.shape, 38.0, dtype=np.float32)  # Central CONUS lat
            lon_grid = np.full(blue_ref.shape, -97.0, dtype=np.float32)  # Central CONUS lon
    else:
        print(f"   ⚠️  No coordinate data, using default CONUS coordinates")
        lat_grid = np.full(blue_ref.shape, 38.0, dtype=np.float32)
        lon_grid = np.full(blue_ref.shape, -97.0, dtype=np.float32)

    # Pre-allocate output
    output = np.zeros((blue_ref.shape[0], blue_ref.shape[1], 3), dtype=np.uint8)

    print(f"   ⚡ Running sophisticated Numba geocolor algorithm...")
    start_time = time.time()

    # Call the sophisticated geocolor function
    numba_geocolor_sophisticated(
        blue_ref, red_ref, nir_ref, c13_bt, c07_bt,
        cos_sza, sza, lat_grid, lon_grid, output
    )

    processing_time = time.time() - start_time
    print(f"   ✅ Sophisticated geocolor complete in {processing_time:.2f}s")

    # Analyze the result
    brightness = np.mean(output)
    color_variation = np.std(output)

    print(f"   📊 Result analysis:")
    print(f"      Average brightness: {brightness:.1f}/255")
    print(f"      Color variation: {color_variation:.1f}")

    if brightness > 50:
        print(f"   🌞 SUCCESS: Good brightness level detected!")
    else:
        print(f"   🌙 WARNING: Image appears quite dark - check solar angles")

    return output

# ============================================================================
# NEW ADDITIONAL RGB WORKERS (ADDED WITHOUT AFFECTING ORIGINALS)
# ============================================================================

def rgb_worker_cloud_microphysics(channels_data, solar_angles_data):
    """
    Cloud Microphysics RGB worker with goes2go night formulation
    """
    try:
        print(f"    Worker creating cloud microphysics (goes2go night formulation)...")

        required = ['C02', 'C05', 'C07', 'C13', 'C15']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get calibrated data as Kelvin for BT, reflectance for vis/nir
        red_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))
        snow_ice_ref = np.ascontiguousarray(channels_data['C05']['calibrated'].astype(np.float32))
        swir_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))      # Kelvin
        clean_ir_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))  # Kelvin
        dirty_ir_bt = np.ascontiguousarray(channels_data['C15']['calibrated'].astype(np.float32))  # Kelvin

        if solar_angles_data:
            sza = np.ascontiguousarray(solar_angles_data['sza'].astype(np.float32))
        else:
            sza = np.full(red_ref.shape, 60.0, dtype=np.float32)

        output = np.zeros((red_ref.shape[0], red_ref.shape[1], 3), dtype=np.uint8)

        # Call updated function with Kelvin BT inputs
        numba_cloud_microphysics_core(red_ref, snow_ice_ref, swir_bt, clean_ir_bt, dirty_ir_bt, sza, output)

        print(f"         Cloud microphysics complete (goes2go night ranges)")

        return {'success': True, 'rgb_data': output, 'method': 'cloud_microphysics_goes2go_night'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_split_window_optimized(channels_data, solar_angles_data):
    """Split Window with rainbow colorscale worker"""
    try:
        print(f"    Worker creating rainbow split window (-3K to +10K)...")

        required = ['C13', 'C15']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
        c15_bt = np.ascontiguousarray(channels_data['C15']['calibrated'].astype(np.float32))
        output = np.zeros((c13_bt.shape[0], c13_bt.shape[1], 3), dtype=np.uint8)

        if NUMBA_AVAILABLE:
            numba_split_window_core(c13_bt, c15_bt, output)
            print(f"         Rainbow split window complete: Blue(dust) -> Red(moisture)")
        else:
            # Python fallback
            temp_diff = c13_bt - c15_bt
            normalized = np.clip((temp_diff + 3) / 13, 0, 1)
            # Simple blue to red gradient
            r = (normalized * 255).astype(np.uint8)
            g = ((1 - np.abs(normalized - 0.5) * 2) * 255).astype(np.uint8)
            b = ((1 - normalized) * 255).astype(np.uint8)
            output = np.stack([r, g, b], axis=-1)

        return {'success': True, 'rgb_data': output, 'method': 'split_window_rainbow_colorscale'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_day_snow_fog_night_fog_core(channels_data, solar_angles_data):
    """24-hour fog detection: Day Snow Fog + Night Fog worker"""
    try:
        print(f"    Worker creating 24-hour fog detection (day snow fog + night fog)...")

        required = ['C03', 'C05', 'C07', 'C13']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        c03_ref = np.ascontiguousarray(channels_data['C03']['calibrated'].astype(np.float32))
        c05_ref = np.ascontiguousarray(channels_data['C05']['calibrated'].astype(np.float32))
        c07_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))

        if solar_angles_data:
            sza = np.ascontiguousarray(solar_angles_data['sza'].astype(np.float32))
            print(f"         Using solar angles for day/night fog detection blend")
        else:
            sza = np.full(c03_ref.shape, 80.0, dtype=np.float32)

        output = np.zeros((c03_ref.shape[0], c03_ref.shape[1], 3), dtype=np.uint8)

        if NUMBA_AVAILABLE:
            numba_day_snow_fog_night_fog_core(c03_ref, c05_ref, c07_bt, c13_bt, sza, output)
            print(f"         24-hour fog detection complete")
            print(f"         Day: Snow/fog discrimination, Night: Cyan fog detection")
        else:
            # Simplified Python fallback
            day_r = np.clip(c03_ref, 0, 1) ** (1/1.7)
            day_g = np.clip(c05_ref/0.7, 0, 1) ** (1/1.7)
            day_b = np.clip((c07_bt-c13_bt)/30, 0, 1) ** (1/1.7)

            fog_diff = c13_bt - c07_bt
            fog_norm = 1 - np.clip((fog_diff + 90)/105, 0, 1)

            output = np.stack([
                ((day_r * 0.7 + fog_norm * 0.3 * 0.3) * 255).astype(np.uint8),
                ((day_g * 0.7 + fog_norm * 0.3 * 0.8) * 255).astype(np.uint8),
                ((day_b * 0.7 + fog_norm * 0.3 * 0.9) * 255).astype(np.uint8)
            ], axis=-1)

        return {'success': True, 'rgb_data': output, 'method': 'fog_detection_24h_day_snow_fog_night_fog'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_sandwich_optimized(channels_data, solar_angles_data):
    """CORRECTED Sandwich RGB worker with proper solar angle blending"""
    try:
        print(f"    Worker creating corrected sandwich with solar angle blending...")

        required = ['C02', 'C13']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        vis_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))
        ir_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
        ir_bt_celsius = ir_bt - 273.15

        # Get solar angles (CRITICAL for proper day/night blending)
        if solar_angles_data:
            sza = np.ascontiguousarray(solar_angles_data['sza'].astype(np.float32))
            print(f"        Using solar angles for day/night sandwich blend")
        else:
            sza = np.full(vis_ref.shape, 80.0, dtype=np.float32)  # Default to twilight
            print(f"        WARNING: No solar angles - using default twilight blend")

        output = np.zeros((vis_ref.shape[0], vis_ref.shape[1], 3), dtype=np.uint8)

        # Use corrected solar angle blending with temperature threshold
        numba_sandwich_enhanced_core(vis_ref, ir_bt_celsius, sza, output)
        print(f"        Temperature-filtered sandwich complete")
        print(f"        Method: Cold clouds (≤-15°C) get IR colors, solar blending prevents visible*0 at night")

        return {'success': True, 'rgb_data': output, 'method': 'sandwich_temperature_filtered_solar_corrected'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_airmass(channels_data, solar_angles_data):
    """CORRECTED Airmass RGB worker with proper normalization ranges"""
    try:
        print(f"    🌈 Worker creating corrected airmass RGB...")

        required = ['C08', 'C10', 'C12', 'C13']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c08_bt = np.ascontiguousarray(channels_data['C08']['calibrated'].astype(np.float32))
        c10_bt = np.ascontiguousarray(channels_data['C10']['calibrated'].astype(np.float32))
        c12_bt = np.ascontiguousarray(channels_data['C12']['calibrated'].astype(np.float32))
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))

        # Pre-allocate output
        output = np.zeros((c08_bt.shape[0], c08_bt.shape[1], 3), dtype=np.uint8)

        # Use corrected Numba function
        numba_airmass_optimized_core(c08_bt, c10_bt, c12_bt, c13_bt, output)
        print(f"    ⚡ Ultra-fast corrected airmass complete")

        return {'success': True, 'rgb_data': output, 'method': 'airmass_corrected_normalization'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_dust(channels_data, solar_angles_data):
    """CORRECTED Dust RGB worker using C14 for green channel"""
    try:
        print(f"    🌈 Worker creating corrected dust RGB...")

        # CRITICAL: Now requires C14!
        required = ['C11', 'C13', 'C14', 'C15']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c11_bt = np.ascontiguousarray(channels_data['C11']['calibrated'].astype(np.float32))
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
        c14_bt = np.ascontiguousarray(channels_data['C14']['calibrated'].astype(np.float32))  # NEW!
        c15_bt = np.ascontiguousarray(channels_data['C15']['calibrated'].astype(np.float32))

        # Pre-allocate output
        output = np.zeros((c11_bt.shape[0], c11_bt.shape[1], 3), dtype=np.uint8)

        # Call corrected Numba dust function
        numba_dust_optimized_core(c11_bt, c13_bt, c14_bt, c15_bt, output)
        print(f"    ⚡ Ultra-fast corrected dust complete")

        return {'success': True, 'rgb_data': output, 'method': 'dust_corrected_C14_gamma'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_fire_temperature(channels_data, solar_angles_data):
    """
    CORRECTED Fire Temperature RGB worker using proper channel order and gamma correction
    """
    try:
        print(f"    🔥 Worker creating CORRECTED fire temperature RGB...")

        # CORRECTED required channels: C07, C06, C05
        required = ['C07', 'C06', 'C05']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c07_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))  # Temperature
        c06_ref = np.ascontiguousarray(channels_data['C06']['calibrated'].astype(np.float32))  # Reflectance
        c05_ref = np.ascontiguousarray(channels_data['C05']['calibrated'].astype(np.float32))  # Reflectance

        # Pre-allocate output
        output = np.zeros((c07_bt.shape[0], c07_bt.shape[1], 3), dtype=np.uint8)

        # Call corrected Numba function
        numba_fire_temperature_core(c07_bt, c06_ref, c05_ref, output)
        print(f"    ⚡ Ultra-fast CORRECTED fire temperature complete")
        print(f"         Channels: R=C07(temp+gamma), G=C06(refl), B=C05(refl)")

        return {'success': True, 'rgb_data': output, 'method': 'fire_temperature_corrected_gamma_C07_C06_C05'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_night_microphysics(channels_data, solar_angles_data):
    """ENHANCED Night Microphysics RGB worker with Numba optimization"""
    try:
        print(f"    🌈 Worker creating optimized night microphysics...")

        required = ['C07', 'C13', 'C15']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c07_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
        c15_bt = np.ascontiguousarray(channels_data['C15']['calibrated'].astype(np.float32))

        # Pre-allocate output
        output = np.zeros((c07_bt.shape[0], c07_bt.shape[1], 3), dtype=np.uint8)

        numba_night_microphysics_optimized_core(c07_bt, c13_bt, c15_bt, output)
        print(f"    ⚡ Ultra-fast Numba optimized night microphysics complete")

        return {'success': True, 'rgb_data': output, 'method': 'night_microphysics_numba_optimized'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_ash(channels_data, solar_angles_data):
    """NEW: Ash RGB worker"""
    try:
        print(f"    🌈 Worker creating ash...")

        required = ['C11', 'C13', 'C15']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get brightness temperatures (convert to Celsius)
        c11_bt = channels_data['C11']['calibrated'] - 273.15
        c13_bt = channels_data['C13']['calibrated'] - 273.15
        c15_bt = channels_data['C15']['calibrated'] - 273.15

        # Ash RGB formulation (similar to dust but optimized for volcanic ash)
        red = np.clip((c15_bt - c13_bt + 4) / 8, 0, 1)  # Slightly different scaling
        green = np.clip((c13_bt - c11_bt + 2) / 12, 0, 1)
        blue = np.clip((c11_bt + 30) / 140, 0, 1)

        rgb = np.stack([
            np.clip(red * 255, 0, 255).astype(np.uint8),
            np.clip(green * 255, 0, 255).astype(np.uint8),
            np.clip(blue * 255, 0, 255).astype(np.uint8)
        ], axis=-1)

        return {'success': True, 'rgb_data': rgb, 'method': 'ash_python'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_day_snow_fog(channels_data, solar_angles_data):
    """
    CORRECTED Day Snow Fog RGB worker with proper temperature difference and gamma correction
    """
    try:
        print(f"    ❄️ Worker creating CORRECTED day snow fog RGB...")

        # Required channels: C03, C05, C07, C13
        required = ['C03', 'C05', 'C07', 'C13']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c03_ref = np.ascontiguousarray(channels_data['C03']['calibrated'].astype(np.float32))  # Reflectance
        c05_ref = np.ascontiguousarray(channels_data['C05']['calibrated'].astype(np.float32))  # Reflectance
        c07_bt = np.ascontiguousarray(channels_data['C07']['calibrated'].astype(np.float32))   # Temperature (K)
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))   # Temperature (K)

        # Pre-allocate output
        output = np.zeros((c03_ref.shape[0], c03_ref.shape[1], 3), dtype=np.uint8)

        # Call corrected Numba function
        if NUMBA_AVAILABLE:
            numba_day_snow_fog_core(c03_ref, c05_ref, c07_bt, c13_bt, output)
            print(f"    ⚡ Ultra-fast CORRECTED day snow fog complete")
            print(f"         Formula: R=C03+γ, G=C05+γ, B=(C07-C13)+γ, γ=1.7")
        else:
            # Python fallback with gamma correction
            gamma = 1.7
            red = np.clip(c03_ref, 0, 1) ** (1.0/gamma)
            green = np.clip(c05_ref / 0.7, 0, 1) ** (1.0/gamma)
            blue = np.clip((c07_bt - c13_bt) / 30.0, 0, 1) ** (1.0/gamma)
            output = np.stack([
                (red * 255).astype(np.uint8),
                (green * 255).astype(np.uint8),
                (blue * 255).astype(np.uint8)
            ], axis=-1)

        return {'success': True, 'rgb_data': output, 'method': 'day_snow_fog_corrected_gamma_temp_diff'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_differential_water_vapor(channels_data, solar_angles_data):
    """Differential Water Vapor RGB worker with Numba optimization"""
    try:
        print(f"    🌈 Worker creating differential water vapor...")

        required = ['C08', 'C10']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c08_bt = np.ascontiguousarray(channels_data['C08']['calibrated'].astype(np.float32))
        c10_bt = np.ascontiguousarray(channels_data['C10']['calibrated'].astype(np.float32))

        # Pre-allocate output
        output = np.zeros((c08_bt.shape[0], c08_bt.shape[1], 3), dtype=np.uint8)

        # Call ultra-fast Numba function
        if NUMBA_AVAILABLE:
            numba_differential_water_vapor_core(c08_bt, c10_bt, output)
            print(f"    ⚡ Ultra-fast Numba differential water vapor complete")
        else:
            # Fallback to Python
            t08 = c08_bt - 273.15
            t10 = c10_bt - 273.15
            diff = np.clip((t08 - t10 + 20) / 40, 0, 1)
            gray = (diff * 255).astype(np.uint8)
            output = np.stack([gray, gray, gray], axis=-1)

        return {'success': True, 'rgb_data': output, 'method': 'differential_water_vapor_numba'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_split_window_difference(channels_data, solar_angles_data):
    """Split Window Difference RGB worker with Numba optimization"""
    try:
        print(f"    🌈 Worker creating split window difference...")

        required = ['C13', 'C15']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c13_bt = np.ascontiguousarray(channels_data['C13']['calibrated'].astype(np.float32))
        c15_bt = np.ascontiguousarray(channels_data['C15']['calibrated'].astype(np.float32))

        # Pre-allocate output
        output = np.zeros((c13_bt.shape[0], c13_bt.shape[1], 3), dtype=np.uint8)

        # Call ultra-fast Numba function
        if NUMBA_AVAILABLE:
            numba_split_window_difference_core(c13_bt, c15_bt, output)
            print(f"    ⚡ Ultra-fast Numba split window difference complete")
        else:
            # Fallback to Python
            t13 = c13_bt - 273.15
            t15 = c15_bt - 273.15
            diff = np.clip((t13 - t15 + 10) / 20, 0, 1)
            gray = (diff * 255).astype(np.uint8)
            output = np.stack([gray, gray, gray], axis=-1)

        return {'success': True, 'rgb_data': output, 'method': 'split_window_difference_numba'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_simple_water_vapor(channels_data, solar_angles_data):
    """Simple Water Vapor RGB worker with Numba optimization"""
    try:
        print(f"    🌈 Worker creating simple water vapor...")

        required = ['C08', 'C09', 'C10']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays
        c08_bt = np.ascontiguousarray(channels_data['C08']['calibrated'].astype(np.float32))
        c09_bt = np.ascontiguousarray(channels_data['C09']['calibrated'].astype(np.float32))
        c10_bt = np.ascontiguousarray(channels_data['C10']['calibrated'].astype(np.float32))

        # Pre-allocate output
        output = np.zeros((c08_bt.shape[0], c08_bt.shape[1], 3), dtype=np.uint8)

        # Call ultra-fast Numba function
        if NUMBA_AVAILABLE:
            numba_simple_water_vapor_core(c08_bt, c09_bt, c10_bt, output)
            print(f"    ⚡ Ultra-fast Numba simple water vapor complete")
        else:
            # Fallback to Python
            t08 = c08_bt - 273.15
            t09 = c09_bt - 273.15
            t10 = c10_bt - 273.15

            red = np.clip((t08 + 70) / 120, 0, 1)
            green = np.clip((t09 + 70) / 120, 0, 1)
            blue = np.clip((t10 + 70) / 120, 0, 1)

            output = np.stack([
                (red * 255).astype(np.uint8),
                (green * 255).astype(np.uint8),
                (blue * 255).astype(np.uint8)
            ], axis=-1)

        return {'success': True, 'rgb_data': output, 'method': 'simple_water_vapor_numba'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def rgb_worker_day_land_cloud_fire(channels_data, solar_angles_data):
    """
    NEW: Day Land Cloud Fire RGB worker using C06, C03, C02
    """
    try:
        print(f"    🌍 Worker creating day land cloud fire RGB...")

        # Required channels: C06, C03, C02
        required = ['C06', 'C03', 'C02']
        missing = [ch for ch in required if ch not in channels_data]
        if missing:
            return {'success': False, 'error': f'Missing channels: {missing}'}

        # Get data as contiguous arrays (all reflectances)
        c06_ref = np.ascontiguousarray(channels_data['C06']['calibrated'].astype(np.float32))
        c03_ref = np.ascontiguousarray(channels_data['C03']['calibrated'].astype(np.float32))
        c02_ref = np.ascontiguousarray(channels_data['C02']['calibrated'].astype(np.float32))

        # Pre-allocate output
        output = np.zeros((c06_ref.shape[0], c06_ref.shape[1], 3), dtype=np.uint8)

        # Call Numba function
        if NUMBA_AVAILABLE:
            numba_day_land_cloud_fire_core(c06_ref, c03_ref, c02_ref, output)
            print(f"    ⚡ Ultra-fast day land cloud fire complete")
        else:
            # Python fallback
            red = np.clip(c06_ref, 0, 1)
            green = np.clip(c03_ref, 0, 1)
            blue = np.clip(c02_ref, 0, 1)
            output = np.stack([
                (red * 255).astype(np.uint8),
                (green * 255).astype(np.uint8),
                (blue * 255).astype(np.uint8)
            ], axis=-1)

        return {'success': True, 'rgb_data': output, 'method': 'day_land_cloud_fire_C06_C03_C02'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# ORIGINAL RGB CREATION FUNCTION (ENHANCED BUT STRUCTURE PRESERVED)
# ============================================================================

def create_rgb_products_unified(memory_store):
    """
    Unified RGB creation function - single path for all products
    """
    print(f"🌈 Creating RGB products with unified processing...")

    # Check available channels
    available_channels = set(memory_store.channels.keys())
    print(f"📊 Available channels: {sorted(available_channels)}")

    # Determine which products we can create
    possible_products = []

    # Filter by requested products from Cell 1.5
    requested_products = RGB_PRODUCTS_TO_CREATE if RGB_PRODUCTS_TO_CREATE else list(RGB_CATALOG.keys())

    for rgb_name in requested_products:
        if rgb_name in RGB_CATALOG:
            required_channels = RGB_CATALOG[rgb_name]['channels']
            missing_channels = [ch for ch in required_channels if ch not in available_channels]

            if not missing_channels:
                possible_products.append(rgb_name)
                print(f"  ✅ {rgb_name}: All channels available")
            else:
                print(f"  ❌ {rgb_name}: Missing channels {missing_channels}")
        else:
            print(f"  ⚠️  {rgb_name}: Unknown RGB product")

    if not possible_products:
        print("  ❌ No RGB products can be created with available channels")
        return UnifiedRGBDataStore()

    print(f"  🎨 Will create {len(possible_products)} products: {possible_products}")

    # Get worker registry
    worker_registry = get_rgb_worker_registry()

    # Create temporary directory for multiprocessing
    temp_dir = tempfile.mkdtemp(prefix='rgb_unified_')

    try:
        # Prepare data for workers
        print(f"  📦 Preparing channel data...")

        channels_data = {}
        for ch_code, ch_data in memory_store.channels.items():
            channels_data[ch_code] = {
                'calibrated': ch_data['calibrated'],
                'enhanced': ch_data['enhanced'],
                'channel_type': ch_data['channel_type'],
                'shape': ch_data['shape']
            }

        # Save data files
        channel_data_file = os.path.join(temp_dir, 'channels.pkl')
        with open(channel_data_file, 'wb') as f:
            pickle.dump(channels_data, f, protocol=pickle.HIGHEST_PROTOCOL)

        solar_angles_data = None
        if memory_store.solar_angles:
            solar_angles_file = os.path.join(temp_dir, 'solar_angles.pkl')
            with open(solar_angles_file, 'wb') as f:
                pickle.dump(memory_store.solar_angles, f, protocol=pickle.HIGHEST_PROTOCOL)
            solar_angles_data = memory_store.solar_angles

        # Create unified RGB store
        rgb_store = UnifiedRGBDataStore()

        # Process all products
        for product_name in possible_products:
            print(f"  🎨 Creating {product_name}...")

            product_info = RGB_CATALOG[product_name]
            worker_name = product_info['worker']

            if worker_name not in worker_registry:
                print(f"    ❌ Worker {worker_name} not found")
                continue

            worker_func = worker_registry[worker_name]

            try:
                start_time = time.time()
                result = worker_func(channels_data, solar_angles_data)
                processing_time = time.time() - start_time

                if result['success']:
                    rgb_store.store_rgb(
                        product_name,
                        result['rgb_data'],
                        processing_time,
                        {'method': result['method'], 'processing_time': processing_time}
                    )

                    rgb_size_mb = result['rgb_data'].nbytes / (1024 * 1024)
                    category = product_info['category']
                    print(f"    ✅ {product_name}: {rgb_size_mb:.1f} MB in {processing_time:.2f}s [{category}]")
                else:
                    print(f"    ❌ {product_name}: Failed - {result['error']}")

            except Exception as e:
                print(f"    ❌ {product_name}: Exception - {str(e)}")

        return rgb_store

    finally:
        # Cleanup
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"  ⚠️  Could not remove temp directory: {e}")

# ============================================================================
# ENHANCED RGB PRODUCT FACTORY (PRESERVES ORIGINAL WHILE ADDING FUNCTIONALITY)
# ============================================================================

class UnifiedRGBProductFactory:
    """Unified factory for all RGB products"""

    def __init__(self, memory_store):
        self.memory_store = memory_store

    def create_all_requested_products(self):
        """Create all requested RGB products using unified system"""
        print(f"🎨 Unified RGB Product Factory starting...")
        return create_rgb_products_unified(self.memory_store)

    def get_available_products(self):
        """Get list of available RGB products based on loaded channels"""
        available_channels = set(self.memory_store.channels.keys())
        products = []

        for product, info in RGB_CATALOG.items():
            required_channels = info['channels']
            if all(ch in available_channels for ch in required_channels):
                products.append(product)

        return products

# ============================================================================
# MAIN RGB GENERATION FUNCTION (ENHANCED BUT PRESERVES ORIGINAL INTERFACE)
# ============================================================================

def generate_all_rgb_products():
    """Simplified main RGB generation function"""

    print(f"\n🎨 GENERATING RGB PRODUCTS (UNIFIED SYSTEM)")
    print("-" * 60)

    # Create memory store adapter
    class MemoryStoreAdapter:
        def __init__(self, channels, solar_angles):
            self.channels = channels
            self.solar_angles = solar_angles

    memory_store = MemoryStoreAdapter(CHANNELS, SOLAR_ANGLES)

    # Show available products
    available_channels = set(memory_store.channels.keys())
    available_products = []

    for product_name, product_info in RGB_CATALOG.items():
        required_channels = product_info['channels']
        if all(ch in available_channels for ch in required_channels):
            available_products.append(product_name)

    print(f"🌈 Available RGB products: {len(available_products)}")

    # Group by category for display
    by_category = {}
    for product in available_products:
        category = RGB_CATALOG[product]['category']
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(product)

    for category, products in by_category.items():
        print(f"   {category.upper()}: {products}")

    # Create products
    total_start = time.time()
    rgb_store = create_rgb_products_unified(memory_store)
    total_time = time.time() - total_start

    # Show summary
    summary = rgb_store.get_summary()
    print(f"\n📊 UNIFIED RGB GENERATION COMPLETE")
    print("-" * 40)
    print(f"✅ Products created: {summary['total_products']}")
    print(f"💾 Total RGB data: {summary['total_size_mb']:.1f} MB")
    print(f"⏱️  Total time: {total_time:.1f}s")

    if summary['total_products'] > 0:
        avg_time = total_time / summary['total_products']
        print(f"📈 Average per product: {avg_time:.2f}s")

    # Show by category
    if summary['categories']:
        print(f"\n📋 Products by category:")
        for category, products in summary['categories'].items():
            print(f"   {category.upper()}: {products}")

    return rgb_store

# ============================================================================
# EXECUTE ENHANCED RGB GENERATION (PRESERVES ORIGINAL EXECUTION FLOW)
# ============================================================================

print(f"\n🚀 Starting unified RGB generation...")
print(f"⚙️  Configuration from Cell 1.5:")
print(f"   🎨 Products to create: {RGB_PRODUCTS_TO_CREATE}")
print(f"   ☀️  Solar angles: {'available' if SOLAR_ANGLES else 'using defaults'}")
print(f"   🚀 Processing: Unified System")
print(f"   ⚡ Ultra-fast Numba JIT: ✅ Active")

# Get initial memory
try:
    initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
    print(f"   🧠 Initial memory: {initial_memory:.1f} MB")
except:
    initial_memory = 0

# Generate RGB products using unified system
RGB_DATA_STORE = generate_all_rgb_products()

try:
    memory_freed = cleanup_channel_data_after_rgb()
    print(f"🧠 Memory cleanup: {memory_freed:.1f}MB calibrated channel data freed")
except Exception as e:
    print(f"⚠️ Memory cleanup error: {e}")

# Final memory check
try:
    final_memory = psutil.Process().memory_info().rss / 1024 / 1024
    memory_delta = final_memory - initial_memory
    print(f"🧠 Final memory: {final_memory:.1f} MB ({memory_delta:+.1f} MB)")
except:
    pass

# Create access variables for next cells (same interface)
RGB_PRODUCTS = RGB_DATA_STORE.get_all_products()

print(f"\n🔗 VARIABLES CREATED FOR NEXT CELLS:")
print(f"   RGB_DATA_STORE: Unified RGB data store object")
print(f"   RGB_PRODUCTS: Direct access to RGB arrays")

# Show what was created
all_products = RGB_DATA_STORE.get_all_products()
if all_products:
    print(f"\n🎉 SUCCESS: {len(all_products)} RGB products created!")
    print(f"   PRODUCTS: {list(all_products.keys())}")

    # Show categories
    summary = RGB_DATA_STORE.get_summary()
    if summary['categories']:
        for category, products in summary['categories'].items():
            print(f"   {category.upper()}: {products}")
else:
    print(f"\n⚠️  No RGB products were created")