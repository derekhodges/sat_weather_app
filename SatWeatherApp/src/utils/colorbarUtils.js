/**
 * Utility functions for colorbar display and inspector functionality
 */

/**
 * Determines if a colorbar should be displayed based on the current product/channel
 *
 * Rules:
 * - Geocolor (truecolor): NO colorbar
 * - Visible channels: NO colorbar
 * - IR channels: YES colorbar
 * - Other RGB products: YES colorbar (for now - can be refined later)
 *
 * @param {string} viewMode - 'rgb' or 'channel'
 * @param {object} selectedChannel - Current channel object (if in channel mode)
 * @param {object} selectedRGBProduct - Current RGB product object (if in RGB mode)
 * @returns {boolean} - true if colorbar should be shown
 */
export const shouldShowColorbar = (viewMode, selectedChannel, selectedRGBProduct) => {
  if (viewMode === 'channel') {
    // For channels, show colorbar only for IR channels
    if (!selectedChannel) return false;
    return selectedChannel.type === 'infrared';
  }

  if (viewMode === 'rgb') {
    // For RGB products, hide colorbar for geocolor/truecolor
    if (!selectedRGBProduct) return false;

    // Geocolor uses 'truecolor' as codName
    if (selectedRGBProduct.codName === 'truecolor' || selectedRGBProduct.id === 'geocolor') {
      return false;
    }

    // Other RGB products show colorbar (can be refined later)
    return true;
  }

  return false;
};

/**
 * Generates the color gradient array used in the colorbar
 * This matches the gradient used in ColorScaleBar component
 *
 * @param {number} segments - Number of color segments (default: 50)
 * @returns {Array} - Array of color objects with hsl values
 */
export const generateColorbarGradient = (segments = 50) => {
  const colors = [];
  for (let i = 0; i < segments; i++) {
    const hue = (i / segments) * 240; // Blue (240) to red (0)
    colors.push({
      index: i,
      hue: 240 - hue, // Reverse so index 0 is blue, index 49 is red
      saturation: 100,
      lightness: 50,
      hslString: `hsl(${240 - hue}, 100%, 50%)`,
    });
  }
  return colors;
};

/**
 * Converts RGB color to HSL
 *
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {object} - {h, s, l} where h is 0-360, s and l are 0-100
 */
export const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

/**
 * Finds the closest color in the colorbar gradient to a given color
 * This is used by the inspector tool to determine which part of the gradient
 * a pixel color corresponds to
 *
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @param {Array} gradient - Array of gradient colors from generateColorbarGradient()
 * @returns {object} - {index, color, distance} of closest match
 */
export const findClosestColorInGradient = (r, g, b, gradient = null) => {
  if (!gradient) {
    gradient = generateColorbarGradient();
  }

  const targetHsl = rgbToHsl(r, g, b);

  let closestIndex = 0;
  let minDistance = Infinity;

  gradient.forEach((color, index) => {
    // Calculate color distance in HSL space
    // Weight hue more heavily since our gradient is primarily hue-based
    const hueDiff = Math.abs(color.hue - targetHsl.h);
    const satDiff = Math.abs(color.saturation - targetHsl.s);
    const lightDiff = Math.abs(color.lightness - targetHsl.l);

    // Weighted distance calculation
    const distance = (hueDiff * 2) + (satDiff * 0.5) + (lightDiff * 0.5);

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });

  return {
    index: closestIndex,
    color: gradient[closestIndex],
    distance: minDistance,
    // Percentage along the gradient (0-100)
    percentage: (closestIndex / (gradient.length - 1)) * 100,
  };
};

/**
 * Maps a gradient position to a temperature value
 * This is a placeholder that will be replaced with actual temperature mapping
 * based on the specific channel or product
 *
 * @param {number} percentage - Position in gradient (0-100)
 * @param {string} viewMode - 'rgb' or 'channel'
 * @param {object} product - Current channel or RGB product
 * @returns {object} - {value, unit, label} for display
 */
export const mapGradientToValue = (percentage, viewMode, product) => {
  // Placeholder implementation
  // TODO: Implement actual temperature/value mapping based on channel type

  if (viewMode === 'channel' && product?.type === 'infrared') {
    // For IR channels, typically map from cold (high) to warm (low)
    // This is a rough estimate - actual values depend on the channel
    const tempC = -80 + (percentage / 100) * 120; // Range: -80°C to +40°C
    const tempF = (tempC * 9/5) + 32;

    return {
      value: tempC.toFixed(1),
      valueF: tempF.toFixed(1),
      unit: '°C',
      label: `${tempC.toFixed(1)}°C (${tempF.toFixed(1)}°F)`,
    };
  }

  // For other products, just return the percentage for now
  return {
    value: percentage.toFixed(1),
    unit: '%',
    label: `Position: ${percentage.toFixed(1)}%`,
  };
};
