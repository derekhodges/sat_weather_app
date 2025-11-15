/**
 * Region definitions for satellite imagery
 * Bounds format: [minLon, maxLon, minLat, maxLat]
 */

// All available regions with their geographic bounds
export const ALL_REGIONS = {
  // Main domains
  conus: [-128, -60, 23, 51],
  conus_west: [-166, -106, 19, 51],

  // Conus Regions
  northwest: [-130, -105, 36, 51],
  north_rockies: [-120, -95, 37, 52],
  north_central: [-110, -85, 36, 51],
  great_lakes: [-99, -74, 36, 51],
  northeast: [-90, -65, 35, 50],
  southwest: [-127, -102, 27, 44],
  south_central: [-110, -85, 24, 41],
  southeast: [-93, -68, 22, 39],
  southern_rockies: [-115, -90, 30, 45],
  east_central: [-95, -70, 31, 46],

  // Out of conus Regions
  east_pacific: [-190, -100, 0, 65],
  conus_pacific: [-170, -120, 12, 52],
  atlantic: [-105, -15, 0, 60],
  carribean: [-95, -50, 5, 25],
  cape_verde: [-60, -10, 0, 40],
  cape_verde_zoomed: [-30, 0, 5, 25],
  windward_east: [-55, -25, 5, 25],
  se_pacific_large: [-200, -80, -65, 0],
  south_america: [-90, -30, -60, 15],
  northwest_offshore: [-145, -120, 36, 51],
  cal_offshore: [-141, -116, 28, 45],
  baja_offshore: [-129, -104, 18, 35],
  gulf_america: [-104, -79, 15, 32],
  se_coast: [-85, -60, 20, 37],
  east_coast: [-85, -60, 27, 44],
  carribean_north: [-85, -60, 15, 30],
  puerto_rico: [-74, -64, 16, 22],
  gulf_of_alaska: [-170, -120, 40, 60],
  ec_pacific: [-150, -80, -10, 30],
  bermuda: [-71, -61, 29, 35],
  windward_islands: [-68, -54, 10, 18],
  jamaica: [-81, -67, 15, 22],
  bahamas: [-84, -74, 21, 27],
  cancun: [-92, -82, 17, 23],
  mexico_north: [-113, -93, 18, 30],
  baja_south: [-116, -106, 21, 27],

  // Canada
  british_columbia: [-140, -110, 47, 62],
  alberta_saskatchewan: [-124, -96, 47, 62],
  manitoba_ontario: [-103, -77, 45, 60],
  quebec: [-81, -55, 40, 57],
  newfound_labrador: [-75, -50, 36, 53],

  // Alaska/Hawaii
  alaska: [-170, -128, 52, 72],
  se_alaska: [-145, -125, 50, 62],
  central_alaska: [-158, -140, 57, 67],
  fairbanks: [-154, -141, 62, 68],
  hawaii: [-172, -142, 12, 27],
  hawaii_zoom: [-162, -152, 17, 23],

  // Small Regions - Western US
  washington: [-126, -116, 45, 51],
  oregon: [-126, -116, 41.5, 47.5],
  cal_oregon: [-126, -116, 39, 45],
  nor_cal: [-126, -116, 35, 41],
  so_cal: [-124, -114, 32, 38],
  north_baja: [-123, -113, 29, 35],

  north_idaho: [-120, -110, 45, 51],
  idaho: [-119, -109, 41, 47],
  utah: [-118, -108, 37, 43],
  nevada: [-120, -110, 34, 40],
  arizona: [-117, -107, 31.2, 37.2],

  // Small Regions - Central/Eastern US
  east_montana: [-113, -103, 44, 50],
  wyoming: [-113, -103, 40, 46],
  colorado: [-111, -101, 36, 42],
  north_new_mexico: [-111, -101, 33, 39],
  south_new_mexico: [-111, -101, 29, 35],

  north_dakota: [-106, -96, 45, 51],
  south_dakota: [-106, -96, 41, 47],
  nebraska: [-104.5, -94.5, 39, 45],
  kansas: [-103.5, -93.5, 36, 42],
  oklahoma: [-103.7, -93.7, 33, 39],
  west_texas: [-105, -95, 29, 35],
  south_texas: [-103, -93, 25, 31],

  minnesota: [-100, -88.4, 43, 50],
  iowa: [-99, -89, 39, 45],
  missouri: [-98, -88, 35, 41],
  arkansas: [-98, -88, 32, 38],
  east_texas: [-99, -89, 29, 35],
  gulf_coast: [-97, -87, 26, 32],

  wisconsin: [-95, -84, 42, 48.6],
  illinois: [-94, -84, 36.5, 42.5],
  tennessee: [-91, -81, 32, 38],
  mississippi: [-93.2, -83, 29, 35.1],
  south_alabama: [-92, -82, 27, 33],

  michigan: [-89, -79, 41, 47],
  indiana: [-90, -80, 37, 43],
  ohio_valley: [-88, -78, 36, 42],
  southern_appalachia: [-87, -77, 32, 38],
  north_florida: [-87, -77, 28, 34],

  east_great_lakes: [-83, -73, 41, 47],
  pennsylvania: [-83, -73, 39, 45],
  i95_corridor: [-81, -71, 37, 43],
  east_carolina: [-81, -71, 33, 39],
  south_florida: [-86, -76, 24, 30],

  north_new_england: [-76, -66, 42, 48],
  south_new_england: [-76, -66, 39, 45],
  nova_scotia: [-69, -59, 42, 48],

  // Hemisphere regions
  north_hemisphere_w: [-227, -47, 0, 90],
  north_hemisphere_e: [-165, 15, 0, 90],
  south_hemisphere_w: [-227, -47, -90, 0],
  south_hemisphere_e: [-165, 15, -90, 0],

  // South America
  andian_states: [-90, -50, -20, 15],
  brazil: [-75, -30, -30, 10],
  chili_argentina: [-88, -48, -57, -27],
};

// Region filtering based on satellite+domain combinations
export const REGION_FILTERS = {
  conus_west: [
    'conus_west',
    'northwest',
    'northwest_offshore',
    'cal_offshore',
    'hawaii_zoom',
    'washington',
    'oregon',
    'cal_oregon',
    'nor_cal',
    'so_cal',
    'north_baja',
    'north_idaho',
    'idaho',
    'utah',
    'nevada',
  ],
  conus_east: [
    'conus',
    'north_rockies',
    'north_central',
    'great_lakes',
    'northeast',
    'south_central',
    'southeast',
    'southern_rockies',
    'east_central',
    'gulf_america',
    'se_coast',
    'east_coast',
    'carribean_north',
    'puerto_rico',
    'bermuda',
    'jamaica',
    'bahamas',
    'nova_scotia',
    'east_montana',
    'wyoming',
    'colorado',
    'north_new_mexico',
    'south_dakota',
    'south_new_mexico',
    'north_dakota',
    'nebraska',
    'kansas',
    'baja_south',
    'oklahoma',
    'west_texas',
    'south_texas',
    'minnesota',
    'iowa',
    'missouri',
    'arkansas',
    'gulf_coast',
    'wisconsin',
    'illinois',
    'tennessee',
    'mississippi',
    'south_alabama',
    'michigan',
    'indiana',
    'north_florida',
    'east_great_lakes',
    'pennsylvania',
    'i95_corridor',
    'east_carolina',
    'south_florida',
    'north_new_england',
    'south_new_england',
    'cancun',
    'mexico_north',
    'arizona',
    'southwest',
    'southern_appalachia',
    'ohio_valley',
    'east_texas',
  ],
  full_disk_west: [
    'east_pacific',
    'se_pacific_large',
    'gulf_of_alaska',
    'ec_pacific',
    'north_hemisphere_w',
    'south_hemisphere_w',
    'british_columbia',
    'alaska',
    'se_alaska',
    'central_alaska',
    'hawaii',
    'baja_offshore',
  ],
  full_disk_east: [
    'atlantic',
    'carribean',
    'cape_verde',
    'windward_islands',
    'north_hemisphere_e',
    'south_hemisphere_e',
    'andian_states',
    'brazil',
    'chili_argentina',
    'south_america',
    'quebec',
    'alberta_saskatchewan',
    'manitoba_ontario',
    'newfound_labrador',
    'cancun',
    'cape_verde_zoomed',
    'windward_east',
  ],
};

/**
 * Calculate region size (width x height in degrees)
 */
export const getRegionSize = (regionKey) => {
  const bounds = ALL_REGIONS[regionKey];
  if (!bounds) return { width: 0, height: 0 };

  const [minLon, maxLon, minLat, maxLat] = bounds;
  return {
    width: Math.abs(maxLon - minLon),
    height: Math.abs(maxLat - minLat),
  };
};

/**
 * Categorize regions by size
 * Local: roughly 10x6 or smaller
 * Regional: roughly 20x10 or larger
 * Excludes 'conus' as it's a main domain
 */
export const categorizeRegions = () => {
  const local = [];
  const regional = [];

  Object.keys(ALL_REGIONS).forEach((regionKey) => {
    // Skip conus as it's a main domain, not selectable from local/regional
    if (regionKey === 'conus') return;

    const { width, height } = getRegionSize(regionKey);
    const area = width * height;

    // Local: ~10x6 = 60 or smaller (area <= 70)
    // Regional: ~20x10 = 200 or larger (area >= 150)
    // In-between regions go to regional to avoid UI clutter
    if (area <= 70) {
      local.push(regionKey);
    } else {
      regional.push(regionKey);
    }
  });

  return { local, regional };
};

/**
 * Get the center point of a region
 */
export const getRegionCenter = (regionKey) => {
  const bounds = ALL_REGIONS[regionKey];
  if (!bounds) return null;

  const [minLon, maxLon, minLat, maxLat] = bounds;
  return {
    lon: (minLon + maxLon) / 2,
    lat: (minLat + maxLat) / 2,
  };
};

/**
 * Convert geographic coordinates to map position (relative to CONUS bounds)
 * CONUS bounds: [-128, -60, 23, 51]
 */
export const geoToMapPosition = (lon, lat, containerWidth, containerHeight) => {
  const conusBounds = ALL_REGIONS.conus;
  const [conusMinLon, conusMaxLon, conusMinLat, conusMaxLat] = conusBounds;

  // Calculate percentage position within CONUS bounds
  const xPercent = (lon - conusMinLon) / (conusMaxLon - conusMinLon);
  const yPercent = 1 - (lat - conusMinLat) / (conusMaxLat - conusMinLat); // Flip Y axis

  return {
    x: xPercent * containerWidth,
    y: yPercent * containerHeight,
  };
};

/**
 * Convert region bounds to map rectangle
 */
export const regionBoundsToMapRect = (regionKey, containerWidth, containerHeight) => {
  const bounds = ALL_REGIONS[regionKey];
  if (!bounds) return null;

  const [minLon, maxLon, minLat, maxLat] = bounds;
  const conusBounds = ALL_REGIONS.conus;
  const [conusMinLon, conusMaxLon, conusMinLat, conusMaxLat] = conusBounds;

  // Calculate positions
  const left = ((minLon - conusMinLon) / (conusMaxLon - conusMinLon)) * containerWidth;
  const right = ((maxLon - conusMinLon) / (conusMaxLon - conusMinLon)) * containerWidth;
  const top = (1 - (maxLat - conusMinLat) / (conusMaxLat - conusMinLat)) * containerHeight;
  const bottom = (1 - (minLat - conusMinLat) / (conusMaxLat - conusMinLat)) * containerHeight;

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    width: right - left,
    height: bottom - top,
  };
};

/**
 * Generate a random color for a region dot
 */
export const generateRegionColor = (regionKey) => {
  // Use a hash of the region key for consistent colors
  let hash = 0;
  for (let i = 0; i < regionKey.length; i++) {
    hash = regionKey.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate HSL color with good saturation and lightness
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
};

// Pre-categorize regions for performance
export const CATEGORIZED_REGIONS = categorizeRegions();
