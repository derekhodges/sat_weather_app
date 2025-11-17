/**
 * JSON Schema Validation Utility
 *
 * Validates parsed JSON data against expected schemas to prevent
 * runtime errors from malformed or unexpected data.
 *
 * SECURITY: Prevents injection of malicious data structures
 * RELIABILITY: Catches malformed data before it causes crashes
 */

/**
 * Validate that a value is a non-empty string
 */
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

/**
 * Validate that a value is a positive number
 */
const isPositiveNumber = (value) => typeof value === 'number' && !isNaN(value) && value > 0;

/**
 * Validate that a value is a valid number (including negative/zero)
 */
const isValidNumber = (value) => typeof value === 'number' && !isNaN(value) && isFinite(value);

/**
 * Validate that a value is an array
 */
const isArray = (value) => Array.isArray(value);

/**
 * Validate that a value is an object (non-null, non-array)
 */
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validate geospatial bounds object
 * @param {Object} bounds - Bounds object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateBounds = (bounds) => {
  const errors = [];

  if (!isObject(bounds)) {
    return { valid: false, errors: ['Bounds must be an object'] };
  }

  const requiredFields = ['minLat', 'maxLat', 'minLon', 'maxLon'];
  const alternateFields = ['min_lat', 'max_lat', 'min_lon', 'max_lon'];

  // Check for either camelCase or snake_case
  const hasStandardFields = requiredFields.every(field => bounds[field] !== undefined);
  const hasAlternateFields = alternateFields.every(field => bounds[field] !== undefined);

  if (!hasStandardFields && !hasAlternateFields) {
    errors.push('Bounds missing required fields (minLat, maxLat, minLon, maxLon)');
  }

  // Validate ranges
  const minLat = bounds.minLat ?? bounds.min_lat;
  const maxLat = bounds.maxLat ?? bounds.max_lat;
  const minLon = bounds.minLon ?? bounds.min_lon;
  const maxLon = bounds.maxLon ?? bounds.max_lon;

  if (minLat !== undefined && !isValidNumber(minLat)) {
    errors.push('minLat must be a valid number');
  } else if (minLat < -90 || minLat > 90) {
    errors.push('minLat must be between -90 and 90');
  }

  if (maxLat !== undefined && !isValidNumber(maxLat)) {
    errors.push('maxLat must be a valid number');
  } else if (maxLat < -90 || maxLat > 90) {
    errors.push('maxLat must be between -90 and 90');
  }

  if (minLon !== undefined && !isValidNumber(minLon)) {
    errors.push('minLon must be a valid number');
  } else if (minLon < -180 || minLon > 180) {
    errors.push('minLon must be between -180 and 180');
  }

  if (maxLon !== undefined && !isValidNumber(maxLon)) {
    errors.push('maxLon must be a valid number');
  } else if (maxLon < -180 || maxLon > 180) {
    errors.push('maxLon must be between -180 and 180');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate settings object structure
 * @param {Object} settings - Settings object to validate
 * @returns {Object} { valid: boolean, errors: string[], sanitized: Object }
 */
export const validateSettings = (settings) => {
  const errors = [];
  const sanitized = {};

  if (!isObject(settings)) {
    return { valid: false, errors: ['Settings must be an object'], sanitized: {} };
  }

  // Validate and sanitize each field
  if (settings.animationSpeed !== undefined) {
    const val = parseInt(settings.animationSpeed);
    if (isNaN(val) || val < 100 || val > 5000) {
      errors.push('animationSpeed must be between 100-5000');
      sanitized.animationSpeed = 500; // Default
    } else {
      sanitized.animationSpeed = val;
    }
  }

  if (settings.endDwellDuration !== undefined) {
    const val = parseInt(settings.endDwellDuration);
    if (isNaN(val) || val < 0 || val > 10000) {
      errors.push('endDwellDuration must be between 0-10000');
      sanitized.endDwellDuration = 1500; // Default
    } else {
      sanitized.endDwellDuration = val;
    }
  }

  if (settings.frameCount !== undefined) {
    const val = parseInt(settings.frameCount);
    if (isNaN(val) || val < 1 || val > 100) {
      errors.push('frameCount must be between 1-100');
      sanitized.frameCount = 12; // Default
    } else {
      sanitized.frameCount = val;
    }
  }

  if (settings.frameSkip !== undefined) {
    const val = parseInt(settings.frameSkip);
    if (isNaN(val) || val < 0 || val > 50) {
      errors.push('frameSkip must be between 0-50');
      sanitized.frameSkip = 0; // Default
    } else {
      sanitized.frameSkip = val;
    }
  }

  if (settings.autoRefreshInterval !== undefined) {
    const val = parseInt(settings.autoRefreshInterval);
    if (isNaN(val) || val < 1 || val > 120) {
      errors.push('autoRefreshInterval must be between 1-120');
      sanitized.autoRefreshInterval = 5; // Default
    } else {
      sanitized.autoRefreshInterval = val;
    }
  }

  // Boolean fields
  ['autoRefresh', 'showColorScale', 'useLocalTime'].forEach(field => {
    if (settings[field] !== undefined) {
      sanitized[field] = !!settings[field];
    }
  });

  // String enum fields
  if (settings.imageDisplayMode !== undefined) {
    if (['contain', 'cover'].includes(settings.imageDisplayMode)) {
      sanitized.imageDisplayMode = settings.imageDisplayMode;
    } else {
      errors.push('imageDisplayMode must be "contain" or "cover"');
      sanitized.imageDisplayMode = 'contain';
    }
  }

  if (settings.channelDisplayMode !== undefined) {
    if (['list', 'grid'].includes(settings.channelDisplayMode)) {
      sanitized.channelDisplayMode = settings.channelDisplayMode;
    } else {
      errors.push('channelDisplayMode must be "list" or "grid"');
      sanitized.channelDisplayMode = 'list';
    }
  }

  if (settings.defaultViewMode !== undefined) {
    if (['rgb', 'channel'].includes(settings.defaultViewMode)) {
      sanitized.defaultViewMode = settings.defaultViewMode;
    } else {
      errors.push('defaultViewMode must be "rgb" or "channel"');
      sanitized.defaultViewMode = 'rgb';
    }
  }

  // Objects (pass through but validate structure)
  if (settings.defaultDomain !== undefined) {
    if (isObject(settings.defaultDomain)) {
      sanitized.defaultDomain = settings.defaultDomain;
    } else {
      errors.push('defaultDomain must be an object');
    }
  }

  if (settings.defaultProduct !== undefined) {
    if (isObject(settings.defaultProduct)) {
      sanitized.defaultProduct = settings.defaultProduct;
    } else {
      errors.push('defaultProduct must be an object');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * Validate favorite object structure
 * @param {Object} favorite - Favorite object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateFavorite = (favorite) => {
  const errors = [];

  if (!isObject(favorite)) {
    return { valid: false, errors: ['Favorite must be an object'] };
  }

  if (!isNonEmptyString(favorite.id)) {
    errors.push('Favorite must have a non-empty id');
  }

  if (!isNonEmptyString(favorite.name)) {
    errors.push('Favorite must have a non-empty name');
  }

  if (!isObject(favorite.domain)) {
    errors.push('Favorite must have a domain object');
  }

  if (!isObject(favorite.product)) {
    errors.push('Favorite must have a product object');
  }

  if (!['rgb', 'channel'].includes(favorite.viewMode)) {
    errors.push('Favorite viewMode must be "rgb" or "channel"');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Safely parse JSON with validation
 * @param {string} jsonString - JSON string to parse
 * @param {Function} validator - Optional validation function
 * @returns {Object} { success: boolean, data: any, error: string }
 */
export const safeJSONParse = (jsonString, validator = null) => {
  try {
    const data = JSON.parse(jsonString);

    if (validator) {
      const validation = validator(data);
      if (!validation.valid) {
        console.warn('[VALIDATION] JSON parsed but validation failed:', validation.errors);
        return {
          success: false,
          data: validation.sanitized || data,
          error: `Validation errors: ${validation.errors.join(', ')}`
        };
      }
      return {
        success: true,
        data: validation.sanitized || data,
        error: null
      };
    }

    return { success: true, data, error: null };
  } catch (error) {
    console.error('[VALIDATION] JSON parse error:', error.message);
    return { success: false, data: null, error: error.message };
  }
};

/**
 * Error boundary wrapper for async operations
 * Provides consistent error handling and reporting
 * @param {Function} asyncFn - Async function to wrap
 * @param {Object} options - Options
 * @returns {Promise} Result or error object
 */
export const withErrorBoundary = async (asyncFn, options = {}) => {
  const {
    fallback = null,
    logPrefix = '[ERROR]',
    rethrow = false,
    onError = null,
  } = options;

  try {
    return await asyncFn();
  } catch (error) {
    console.error(`${logPrefix} ${error.message}`);

    if (onError) {
      onError(error);
    }

    if (rethrow) {
      throw error;
    }

    return fallback;
  }
};

/**
 * Validate array of items
 * @param {Array} items - Array to validate
 * @param {Function} itemValidator - Validation function for each item
 * @returns {Object} { valid: boolean, errors: string[], validItems: Array }
 */
export const validateArray = (items, itemValidator) => {
  const errors = [];
  const validItems = [];

  if (!isArray(items)) {
    return { valid: false, errors: ['Must be an array'], validItems: [] };
  }

  items.forEach((item, index) => {
    const result = itemValidator(item);
    if (result.valid) {
      validItems.push(item);
    } else {
      errors.push(`Item ${index}: ${result.errors.join(', ')}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validItems
  };
};
