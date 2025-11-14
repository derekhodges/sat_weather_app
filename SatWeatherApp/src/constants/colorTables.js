/**
 * Color tables for GOES satellite channels and RGB products
 * Extracted from color_plus.py processing algorithms
 */

/**
 * IR Channel Color Tables
 * Maps temperature (°C) to RGB colors for each channel
 */
export const IR_COLOR_TABLES = {
  // Channel 7: Shortwave Window (3.90 μm)
  C07: {
    temperatures: [-83, -78, -73, -68, -63, -58, -53, -48, -43, -42, -38, -33, -28,
                   -23, -18, -13, -8, -3, 2, 7, 13, 17, 22, 27, 32, 38, 42, 47,
                   52, 57, 62, 67, 72, 77, 82, 87, 92, 97, 102, 107, 112, 117, 122, 127],
    colors: [
      [122, 122, 122], [101, 101, 101], [79, 79, 79], [58, 58, 58], [35, 35, 35],
      [70, 0, 0], [252, 0, 0], [255, 149, 0], [201, 255, 0], [172, 255, 0],
      [0, 249, 3], [0, 2, 114], [0, 166, 206], [186, 186, 186], [177, 177, 177],
      [167, 167, 167], [156, 156, 156], [145, 145, 145], [135, 135, 135], [125, 125, 125],
      [112, 112, 112], [103, 103, 103], [91, 91, 91], [80, 80, 80], [69, 69, 69],
      [56, 56, 56], [53, 53, 53], [49, 49, 49], [46, 46, 46], [44, 44, 44],
      [40, 40, 40], [37, 37, 37], [34, 34, 34], [31, 31, 31], [27, 27, 27],
      [24, 24, 24], [21, 21, 21], [17, 17, 17], [14, 14, 14], [11, 11, 11],
      [8, 8, 8], [5, 5, 5], [2, 2, 2], [0, 0, 0]
    ]
  },

  // Channels 8, 9, 10: Water Vapor channels
  C08: {
    temperatures: [-93, -88, -83, -78, -73, -68, -63, -58, -54, -53, -48, -43, -38, -33, -30, -28, -23, -18, -13, -8, -5, -3, 2, 7],
    colors: [
      [9, 239, 227], [26, 207, 170], [43, 176, 114], [61, 144, 57], [77, 137, 47],
      [100, 152, 73], [122, 167, 99], [145, 182, 126], [164, 194, 148], [170, 200, 156],
      [206, 223, 198], [243, 248, 241], [224, 224, 238], [169, 169, 207], [137, 137, 190],
      [92, 92, 166], [21, 21, 105], [199, 199, 25], [255, 216, 0], [255, 149, 0],
      [255, 109, 0], [255, 81, 0], [255, 9, 0], [0, 0, 0]
    ]
  },

  C09: {
    temperatures: [-93, -88, -83, -78, -73, -68, -63, -58, -54, -53, -48, -43, -38, -33, -30, -28, -23, -18, -13, -8, -5, -3, 2, 7],
    colors: [
      [9, 239, 227], [26, 207, 170], [43, 176, 114], [61, 144, 57], [77, 137, 47],
      [100, 152, 73], [122, 167, 99], [145, 182, 126], [164, 194, 148], [170, 200, 156],
      [206, 223, 198], [243, 248, 241], [224, 224, 238], [169, 169, 207], [137, 137, 190],
      [92, 92, 166], [21, 21, 105], [199, 199, 25], [255, 216, 0], [255, 149, 0],
      [255, 109, 0], [255, 81, 0], [255, 9, 0], [0, 0, 0]
    ]
  },

  C10: {
    temperatures: [-93, -88, -83, -78, -73, -68, -63, -58, -54, -53, -48, -43, -38, -33, -30, -28, -23, -18, -13, -8, -5, -3, 2, 7],
    colors: [
      [9, 239, 227], [26, 207, 170], [43, 176, 114], [61, 144, 57], [77, 137, 47],
      [100, 152, 73], [122, 167, 99], [145, 182, 126], [164, 194, 148], [170, 200, 156],
      [206, 223, 198], [243, 248, 241], [224, 224, 238], [169, 169, 207], [137, 137, 190],
      [92, 92, 166], [21, 21, 105], [199, 199, 25], [255, 216, 0], [255, 149, 0],
      [255, 109, 0], [255, 81, 0], [255, 9, 0], [0, 0, 0]
    ]
  },

  // Channels 11-16: IR Longwave channels
  C11: {
    temperatures: [-110, -105, -100, -95, -90, -85, -80, -75, -70, -65, -60, -59, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 6, 10, 15, 20, 25, 30, 31, 35, 40, 45, 50, 55, 57],
    colors: [
      [255, 255, 255], [255, 255, 255], [255, 255, 255], [187, 187, 187], [103, 103, 103], [8, 11, 11], [104, 0, 0], [223, 0, 0], [255, 79, 0], [255, 184, 0], [219, 255, 0], [199, 255, 0], [67, 255, 0], [0, 144, 50], [0, 9, 120], [0, 149, 197], [199, 186, 186], [182, 182, 182], [176, 176, 176], [168, 168, 168], [157, 157, 157], [146, 146, 146], [136, 136, 136], [125, 125, 125], [114, 114, 114], [113, 113, 113], [103, 103, 103], [92, 92, 92], [80, 80, 80], [69, 69, 69], [58, 58, 58], [55, 55, 55], [48, 48, 48], [37, 37, 37], [28, 28, 28], [18, 18, 18], [9, 9, 9], [5, 5, 5]
    ]
  },

  C12: {
    temperatures: [-110, -105, -100, -95, -90, -85, -80, -75, -70, -65, -60, -59, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 6, 10, 15, 20, 25, 30, 31, 35, 40, 45, 50, 55, 57],
    colors: [
      [255, 255, 255], [255, 255, 255], [255, 255, 255], [187, 187, 187], [103, 103, 103], [8, 11, 11], [104, 0, 0], [223, 0, 0], [255, 79, 0], [255, 184, 0], [219, 255, 0], [199, 255, 0], [67, 255, 0], [0, 144, 50], [0, 9, 120], [0, 149, 197], [199, 186, 186], [182, 182, 182], [176, 176, 176], [168, 168, 168], [157, 157, 157], [146, 146, 146], [136, 136, 136], [125, 125, 125], [114, 114, 114], [113, 113, 113], [103, 103, 103], [92, 92, 92], [80, 80, 80], [69, 69, 69], [58, 58, 58], [55, 55, 55], [48, 48, 48], [37, 37, 37], [28, 28, 28], [18, 18, 18], [9, 9, 9], [5, 5, 5]
    ]
  },

  C13: {
    temperatures: [-110, -105, -100, -95, -90, -85, -80, -75, -70, -65, -60, -59, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 6, 10, 15, 20, 25, 30, 31, 35, 40, 45, 50, 55, 57],
    colors: [
      [255, 255, 255], [255, 255, 255], [255, 255, 255], [187, 187, 187], [103, 103, 103], [8, 11, 11], [104, 0, 0], [223, 0, 0], [255, 79, 0], [255, 184, 0], [219, 255, 0], [199, 255, 0], [67, 255, 0], [0, 144, 50], [0, 9, 120], [0, 149, 197], [199, 186, 186], [182, 182, 182], [176, 176, 176], [168, 168, 168], [157, 157, 157], [146, 146, 146], [136, 136, 136], [125, 125, 125], [114, 114, 114], [113, 113, 113], [103, 103, 103], [92, 92, 92], [80, 80, 80], [69, 69, 69], [58, 58, 58], [55, 55, 55], [48, 48, 48], [37, 37, 37], [28, 28, 28], [18, 18, 18], [9, 9, 9], [5, 5, 5]
    ]
  },

  C14: {
    temperatures: [-110, -105, -100, -95, -90, -85, -80, -75, -70, -65, -60, -59, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 6, 10, 15, 20, 25, 30, 31, 35, 40, 45, 50, 55, 57],
    colors: [
      [255, 255, 255], [255, 255, 255], [255, 255, 255], [187, 187, 187], [103, 103, 103], [8, 11, 11], [104, 0, 0], [223, 0, 0], [255, 79, 0], [255, 184, 0], [219, 255, 0], [199, 255, 0], [67, 255, 0], [0, 144, 50], [0, 9, 120], [0, 149, 197], [199, 186, 186], [182, 182, 182], [176, 176, 176], [168, 168, 168], [157, 157, 157], [146, 146, 146], [136, 136, 136], [125, 125, 125], [114, 114, 114], [113, 113, 113], [103, 103, 103], [92, 92, 92], [80, 80, 80], [69, 69, 69], [58, 58, 58], [55, 55, 55], [48, 48, 48], [37, 37, 37], [28, 28, 28], [18, 18, 18], [9, 9, 9], [5, 5, 5]
    ]
  },

  C15: {
    temperatures: [-110, -105, -100, -95, -90, -85, -80, -75, -70, -65, -60, -59, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 6, 10, 15, 20, 25, 30, 31, 35, 40, 45, 50, 55, 57],
    colors: [
      [255, 255, 255], [255, 255, 255], [255, 255, 255], [187, 187, 187], [103, 103, 103], [8, 11, 11], [104, 0, 0], [223, 0, 0], [255, 79, 0], [255, 184, 0], [219, 255, 0], [199, 255, 0], [67, 255, 0], [0, 144, 50], [0, 9, 120], [0, 149, 197], [199, 186, 186], [182, 182, 182], [176, 176, 176], [168, 168, 168], [157, 157, 157], [146, 146, 146], [136, 136, 136], [125, 125, 125], [114, 114, 114], [113, 113, 113], [103, 103, 103], [92, 92, 92], [80, 80, 80], [69, 69, 69], [58, 58, 58], [55, 55, 55], [48, 48, 48], [37, 37, 37], [28, 28, 28], [18, 18, 18], [9, 9, 9], [5, 5, 5]
    ]
  },

  C16: {
    temperatures: [-110, -105, -100, -95, -90, -85, -80, -75, -70, -65, -60, -59, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 6, 10, 15, 20, 25, 30, 31, 35, 40, 45, 50, 55, 57],
    colors: [
      [255, 255, 255], [255, 255, 255], [255, 255, 255], [187, 187, 187], [103, 103, 103], [8, 11, 11], [104, 0, 0], [223, 0, 0], [255, 79, 0], [255, 184, 0], [219, 255, 0], [199, 255, 0], [67, 255, 0], [0, 144, 50], [0, 9, 120], [0, 149, 197], [199, 186, 186], [182, 182, 182], [176, 176, 176], [168, 168, 168], [157, 157, 157], [146, 146, 146], [136, 136, 136], [125, 125, 125], [114, 114, 114], [113, 113, 113], [103, 103, 103], [92, 92, 92], [80, 80, 80], [69, 69, 69], [58, 58, 58], [55, 55, 55], [48, 48, 48], [37, 37, 37], [28, 28, 28], [18, 18, 18], [9, 9, 9], [5, 5, 5]
    ]
  }
};

/**
 * RGB Product Color Interpretations
 * Maps colors to meanings for various RGB composite products
 */
export const RGB_INTERPRETATIONS = {
  cloud_microphysics: {
    name: 'Cloud Microphysics',
    dayInterpretations: [
      { color: [255, 0, 0], range: '245-255,0-10,0-10', label: 'High Clouds (Ice)', description: 'Cold cloud tops, glaciated clouds' },
      { color: [255, 255, 0], range: '245-255,245-255,0-10', label: 'Mid-level Clouds', description: 'Mixed phase clouds' },
      { color: [0, 255, 0], range: '0-10,245-255,0-10', label: 'Low Clouds (Water)', description: 'Warm liquid water clouds' },
      { color: [255, 255, 255], range: '240-255,240-255,240-255', label: 'Thick Ice Clouds', description: 'Deep convection' },
      { color: [100, 100, 100], range: '90-110,90-110,90-110', label: 'Thin Clouds', description: 'Cirrus or thin stratiform' }
    ],
    nightInterpretations: [
      { color: [255, 0, 255], range: '245-255,0-10,245-255', label: 'Fog/Low Clouds', description: 'Low-level moisture' },
      { color: [0, 255, 255], range: '0-10,245-255,245-255', label: 'Mid Clouds', description: 'Mid-level clouds at night' }
    ]
  },

  airmass: {
    name: 'Airmass',
    interpretations: [
      { color: [255, 0, 0], range: '245-255,0-10,0-10', label: 'Dry Polar Air', description: 'Cold, dry polar air mass' },
      { color: [0, 255, 0], range: '0-10,245-255,0-10', label: 'Moist Tropical Air', description: 'Warm, moist tropical air' },
      { color: [0, 0, 255], range: '0-10,0-10,245-255', label: 'Jet Stream', description: 'Strong upper-level winds' },
      { color: [255, 255, 0], range: '245-255,245-255,0-10', label: 'Stratospheric Intrusion', description: 'Dry stratospheric air descending' },
      { color: [255, 0, 255], range: '245-255,0-10,245-255', label: 'Deep Convection', description: 'Developing thunderstorms' }
    ]
  },

  dust: {
    name: 'Dust',
    interpretations: [
      { color: [255, 0, 255], range: '245-255,0-10,245-255', label: 'Dust/Sand', description: 'Airborne dust or sand' },
      { color: [255, 192, 203], range: '245-255,180-200,190-215', label: 'Heavy Dust', description: 'Dense dust concentration' },
      { color: [255, 255, 0], range: '245-255,245-255,0-10', label: 'Volcanic Ash', description: 'Volcanic ash plume' },
      { color: [200, 100, 0], range: '190-210,90-110,0-10', label: 'Desert/Bare Soil', description: 'Arid land surface' },
      { color: [255, 255, 255], range: '240-255,240-255,240-255', label: 'Ice Clouds', description: 'High ice clouds' }
    ]
  },

  split_window: {
    name: 'Split Window Difference',
    interpretations: [
      { color: [0, 0, 255], range: '0-10,0-10,245-255', label: 'Dust/Dry Air', description: 'Dust or very dry air (-3K)' },
      { color: [0, 255, 255], range: '0-10,245-255,245-255', label: 'Normal Atmosphere', description: 'Typical atmospheric moisture' },
      { color: [0, 255, 0], range: '0-10,245-255,0-10', label: 'Moderate Moisture', description: 'Moderate water vapor' },
      { color: [255, 255, 0], range: '245-255,245-255,0-10', label: 'High Moisture', description: 'High water vapor content' },
      { color: [255, 0, 0], range: '245-255,0-10,0-10', label: 'Very High Moisture', description: 'Very moist atmosphere (+10K)' }
    ]
  },

  day_land_cloud_fire: {
    name: 'Day Land Cloud Fire',
    interpretations: [
      { color: [255, 0, 0], range: '245-255,0-10,0-10', label: 'Active Fires', description: 'Hot spots, active burning' },
      { color: [255, 165, 0], range: '245-255,155-175,0-10', label: 'Burn Scars', description: 'Recently burned areas' },
      { color: [139, 69, 19], range: '130-150,60-80,10-30', label: 'Bare Ground', description: 'Exposed soil, desert' },
      { color: [34, 139, 34], range: '25-45,130-150,25-45', label: 'Vegetation', description: 'Healthy vegetation' },
      { color: [255, 255, 255], range: '240-255,240-255,240-255', label: 'Clouds', description: 'Cloud cover' },
      { color: [173, 216, 230], range: '165-185,210-225,225-240', label: 'Snow/Ice', description: 'Snow cover or ice' }
    ]
  },

  day_snow_fog: {
    name: 'Day Snow Fog',
    interpretations: [
      { color: [255, 255, 255], range: '240-255,240-255,240-255', label: 'Snow/Ice', description: 'Snow cover' },
      { color: [255, 165, 0], range: '245-255,155-175,0-10', label: 'Fog', description: 'Low clouds and fog' },
      { color: [173, 216, 230], range: '165-185,210-225,225-240', label: 'Water Clouds', description: 'Liquid water clouds' },
      { color: [34, 139, 34], range: '25-45,130-150,25-45', label: 'Land', description: 'Clear land areas' }
    ]
  },

  night_fog: {
    name: 'Night Fog',
    interpretations: [
      { color: [0, 255, 255], range: '0-10,245-255,245-255', label: 'Fog/Stratus', description: 'Low clouds and fog at night' },
      { color: [255, 255, 255], range: '240-255,240-255,240-255', label: 'High Clouds', description: 'Mid to high level clouds' },
      { color: [50, 50, 50], range: '40-60,40-60,40-60', label: 'Clear Sky', description: 'Cloud-free areas' }
    ]
  }
};

/**
 * Get temperature range for a channel
 */
export function getChannelTemperatureRange(channelNumber) {
  const channel = `C${channelNumber.toString().padStart(2, '0')}`;
  const colorTable = IR_COLOR_TABLES[channel];

  if (!colorTable) {
    return { min: -100, max: 50 }; // Default fallback
  }

  return {
    min: Math.min(...colorTable.temperatures),
    max: Math.max(...colorTable.temperatures)
  };
}

/**
 * Find temperature from RGB color for IR channels
 * Uses color matching to find closest temperature
 */
export function temperatureFromColor(r, g, b, channelNumber) {
  const channel = `C${channelNumber.toString().padStart(2, '0')}`;
  const colorTable = IR_COLOR_TABLES[channel];

  if (!colorTable) {
    return null;
  }

  let minDistance = Infinity;
  let closestTempIndex = 0;

  // Find closest color match
  colorTable.colors.forEach((color, index) => {
    const distance = Math.sqrt(
      Math.pow(r - color[0], 2) +
      Math.pow(g - color[1], 2) +
      Math.pow(b - color[2], 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestTempIndex = index;
    }
  });

  return colorTable.temperatures[closestTempIndex];
}

/**
 * Interpret RGB product color
 * Returns interpretation based on RGB values
 */
export function interpretRGBProductColor(r, g, b, productId) {
  const interpretations = RGB_INTERPRETATIONS[productId];

  if (!interpretations) {
    return { label: 'Unknown', description: 'No interpretation available' };
  }

  // Check both day and night interpretations if available
  const allInterpretations = [
    ...(interpretations.interpretations || []),
    ...(interpretations.dayInterpretations || []),
    ...(interpretations.nightInterpretations || [])
  ];

  // Find closest match
  let minDistance = Infinity;
  let bestMatch = null;

  allInterpretations.forEach(interp => {
    const [tr, tg, tb] = interp.color;
    const distance = Math.sqrt(
      Math.pow(r - tr, 2) +
      Math.pow(g - tg, 2) +
      Math.pow(b - tb, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = interp;
    }
  });

  return bestMatch || { label: 'Unknown', description: 'Color not in interpretation table' };
}
