/**
 * Image Service - Handles fetching satellite imagery
 * Currently uses COD (College of DuPage) as a placeholder
 * TODO: Switch to AWS when ready
 */

const COD_BASE_URL = 'https://weather.cod.edu/data/satellite';

/**
 * Fetch with timeout to prevent hanging on slow/dead connections
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 10 seconds)
 */
const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

/**
 * Generate COD image URL based on domain, product, and timestamp
 * Examples:
 * - https://weather.cod.edu/data/satellite/local/Oklahoma/truecolor/Oklahoma.truecolor.20251109.220118.jpg
 * - https://weather.cod.edu/data/satellite/continental/conus/truecolor/conus.truecolor.20251109.220118.jpg
 */
export const generateCODImageUrl = (domain, product, timestamp = null) => {
  // Check for null/undefined domain or product
  if (!domain || !domain.codName) {
    console.error('generateCODImageUrl: Invalid domain', domain);
    return null;
  }

  if (!product) {
    console.error('generateCODImageUrl: Invalid product', product);
    return null;
  }

  // Product can be either an RGB product (with codName) or a channel (with number)
  const productName = product.codName || product.number?.toString();

  if (!productName) {
    console.error('generateCODImageUrl: Product missing codName and number', product);
    return null;
  }

  const ts = timestamp || generateCurrentTimestamp();

  // Determine the base path based on domain type
  let basePath = '';
  let domainName = domain.codName;

  if (domain.type === 'full_disk') {
    basePath = 'full_disk';
  } else if (domain.type === 'conus') {
    basePath = 'continental/conus';
  } else if (domain.type === 'regional') {
    basePath = `regional/${domainName}`;
  } else if (domain.type === 'local') {
    basePath = `local/${domainName}`;
  }

  // Construct the full URL
  // Format: {base}/{domain}/{product}/{domain}.{product}.{timestamp}.jpg
  const url = `${COD_BASE_URL}/${basePath}/${productName}/${domainName}.${productName}.${ts}.jpg`;

  console.log('Generated COD URL:', url);

  return url;
};

/**
 * Generate current timestamp in COD format: YYYYMMDD.HHMMSS
 * COD timestamps follow pattern: XX:01, XX:06, XX:11, XX:16, XX:21, XX:26, XX:31, XX:36, XX:41, XX:46, XX:51, XX:56
 * Seconds can vary (commonly 17 or 18)
 */
export const generateCurrentTimestamp = () => {
  const now = new Date();

  // COD updates at minutes: 01, 06, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56
  // Pattern: (n * 5) + 1 where n = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
  const currentMinute = now.getUTCMinutes();

  // Find the most recent valid minute
  // Valid minutes: 1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56
  const minuteMod = (currentMinute - 1) % 5;
  const minutes = currentMinute - minuteMod;

  now.setUTCMinutes(minutes);
  now.setUTCSeconds(17); // COD typically uses 17 seconds

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const mins = String(now.getUTCMinutes()).padStart(2, '0');
  const secs = '17';

  return `${year}${month}${day}.${hours}${mins}${secs}`;
};

/**
 * Generate array of timestamps for animation (last N frames)
 * COD updates every 5 minutes at: 01, 06, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56
 */
export const generateTimestampArray = (count = 20, intervalMinutes = 5) => {
  const timestamps = [];
  const now = new Date();

  // Start from current time and go back
  const currentMinute = now.getUTCMinutes();
  const minuteMod = (currentMinute - 1) % 5;
  const startMinute = currentMinute - minuteMod;

  for (let i = 0; i < count; i++) {
    const time = new Date(now.getTime());

    // Calculate minutes going back in 5-minute increments from the start minute
    const totalMinutesBack = i * intervalMinutes;
    const adjustedMinute = startMinute - totalMinutesBack;

    // Handle negative minutes by adjusting hours/days
    time.setUTCMinutes(adjustedMinute);
    time.setUTCSeconds(17);

    const year = time.getUTCFullYear();
    const month = String(time.getUTCMonth() + 1).padStart(2, '0');
    const day = String(time.getUTCDate()).padStart(2, '0');
    const hours = String(time.getUTCHours()).padStart(2, '0');
    const mins = String(time.getUTCMinutes()).padStart(2, '0');
    const secs = '17';

    timestamps.push(`${year}${month}${day}.${hours}${mins}${secs}`);
  }

  return timestamps.reverse(); // Oldest to newest
};

/**
 * Format timestamp for display
 * @param {string} timestamp - Timestamp in COD format (YYYYMMDD.HHMMSS)
 * @param {boolean} useLocalTime - If true, convert to local time. If false, show UTC
 */
export const formatTimestamp = (timestamp, useLocalTime = false) => {
  if (!timestamp) return useLocalTime ? '--:-- Local' : '--:-- UTC';

  // Parse timestamp: YYYYMMDD.HHMMSS
  const dateStr = timestamp.split('.')[0];
  const timeStr = timestamp.split('.')[1];

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));
  const hours = parseInt(timeStr.substring(0, 2));
  const minutes = parseInt(timeStr.substring(2, 4));
  const seconds = parseInt(timeStr.substring(4, 6));

  // Create Date object in UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  if (useLocalTime) {
    // Convert to local time with 12-hour format and AM/PM
    const localMonth = String(utcDate.getMonth() + 1).padStart(2, '0');
    const localDay = String(utcDate.getDate()).padStart(2, '0');
    const localHours24 = utcDate.getHours();
    const localMinutes = String(utcDate.getMinutes()).padStart(2, '0');

    // Convert to 12-hour format
    const period = localHours24 >= 12 ? 'PM' : 'AM';
    const localHours12 = localHours24 % 12 || 12; // Convert 0 to 12 for midnight

    return `${localMonth}/${localDay} ${localHours12}:${localMinutes} ${period} Local`;
  } else {
    // Display UTC time
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');

    return `${monthStr}/${dayStr} ${hoursStr}:${minutesStr} UTC`;
  }
};

/**
 * Check if image URL is valid (exists)
 */
export const checkImageExists = async (url) => {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' }, 10000);
    return response.ok;
  } catch (error) {
    // Log timeout errors vs network errors for debugging
    if (error.message === 'Request timeout') {
      console.warn('Image check timeout for:', url);
    }
    return false;
  }
};

/**
 * Get the latest available image URL
 * Tries current time and works backwards
 */
export const getLatestImageUrl = async (domain, product, maxAttempts = 24) => {
  // Validate inputs first
  if (!domain || !product) {
    console.error('getLatestImageUrl: Invalid domain or product', { domain, product });
    return null;
  }

  // Start from current time
  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  const minuteMod = (currentMinute - 1) % 5;
  const startMinute = currentMinute - minuteMod;

  for (let i = 0; i < maxAttempts; i++) {
    const time = new Date(now.getTime());

    // Go back in 5-minute increments: 01, 06, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56
    const adjustedMinute = startMinute - (i * 5);
    time.setUTCMinutes(adjustedMinute);
    time.setUTCSeconds(17);

    const year = time.getUTCFullYear();
    const month = String(time.getUTCMonth() + 1).padStart(2, '0');
    const day = String(time.getUTCDate()).padStart(2, '0');
    const hours = String(time.getUTCHours()).padStart(2, '0');
    const mins = String(time.getUTCMinutes()).padStart(2, '0');
    const secs = '17';

    const timestamp = `${year}${month}${day}.${hours}${mins}${secs}`;
    const url = generateCODImageUrl(domain, product, timestamp);

    // Skip if URL generation failed
    if (!url) {
      console.warn('getLatestImageUrl: Failed to generate URL for timestamp', timestamp);
      continue;
    }

    const exists = await checkImageExists(url);
    if (exists) {
      return { url, timestamp };
    }
  }

  return null;
};

/**
 * Helper function to batch async operations to avoid overwhelming the network
 * @param {Array} items - Items to process
 * @param {Function} processItem - Async function to process each item
 * @param {number} batchSize - Number of concurrent operations (default: 4)
 */
const processBatched = async (items, processItem, batchSize = 4) => {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processItem));
    results.push(...batchResults);
  }

  return results;
};

/**
 * Generate validated timestamp array - only includes frames that actually exist
 * This prevents the app from breaking when recent frames haven't been plotted yet
 * Uses batched requests to avoid overwhelming the network with 12+ parallel requests
 */
export const generateValidatedTimestampArray = async (
  domain,
  product,
  count = 12,
  intervalMinutes = 5
) => {
  console.log('Generating validated timestamp array...');

  // First generate all possible timestamps
  const possibleTimestamps = generateTimestampArray(count, intervalMinutes);

  // Check each timestamp in batches of 4 to avoid network congestion
  const validationResults = await processBatched(
    possibleTimestamps,
    async (timestamp) => {
      const url = generateCODImageUrl(domain, product, timestamp);
      if (!url) {
        return { timestamp, url: null, exists: false };
      }

      const exists = await checkImageExists(url);
      return { timestamp, url, exists };
    },
    4 // Concurrent requests per batch
  );

  // Filter to only existing frames
  const validFrames = validationResults.filter(r => r.exists);

  console.log(
    `Validated timestamps: ${validFrames.length}/${possibleTimestamps.length} frames available`
  );

  // If no frames are valid, something is wrong - return empty array
  if (validFrames.length === 0) {
    console.error('No valid frames found!');
    return [];
  }

  // Return array of timestamps and their URLs for caching
  return validFrames.map(f => ({
    timestamp: f.timestamp,
    url: f.url,
  }));
};

/**
 * Placeholder for AWS image fetching (future implementation)
 */
export const generateAWSImageUrl = (satellite, domain, product, timestamp) => {
  // TODO: Implement AWS S3 URL generation
  // Will follow pattern like:
  // s3://your-bucket/satellite/{satellite}/{domain}/{product}/{timestamp}.jpg
  throw new Error('AWS image fetching not yet implemented');
};
