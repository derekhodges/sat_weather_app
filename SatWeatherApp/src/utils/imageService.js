/**
 * Image Service - Handles fetching satellite imagery
 * Currently uses COD (College of DuPage) as a placeholder
 * TODO: Switch to AWS when ready
 */

const COD_BASE_URL = 'https://weather.cod.edu/data/satellite';

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
 * Seconds are always 18
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
  now.setUTCSeconds(18); // Always 18 seconds

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const mins = String(now.getUTCMinutes()).padStart(2, '0');
  const secs = '18';

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
    time.setUTCSeconds(18);

    const year = time.getUTCFullYear();
    const month = String(time.getUTCMonth() + 1).padStart(2, '0');
    const day = String(time.getUTCDate()).padStart(2, '0');
    const hours = String(time.getUTCHours()).padStart(2, '0');
    const mins = String(time.getUTCMinutes()).padStart(2, '0');
    const secs = '18';

    timestamps.push(`${year}${month}${day}.${hours}${mins}${secs}`);
  }

  return timestamps.reverse(); // Oldest to newest
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '--:-- UTC';

  // Parse timestamp: YYYYMMDD.HHMMSS
  const dateStr = timestamp.split('.')[0];
  const timeStr = timestamp.split('.')[1];

  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4);

  return `${month}/${day} ${hours}:${minutes} UTC`;
};

/**
 * Check if image URL is valid (exists)
 */
export const checkImageExists = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
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
    time.setUTCSeconds(18);

    const year = time.getUTCFullYear();
    const month = String(time.getUTCMonth() + 1).padStart(2, '0');
    const day = String(time.getUTCDate()).padStart(2, '0');
    const hours = String(time.getUTCHours()).padStart(2, '0');
    const mins = String(time.getUTCMinutes()).padStart(2, '0');
    const secs = '18';

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
 * Generate validated timestamp array - only includes frames that actually exist
 * This prevents the app from breaking when recent frames haven't been plotted yet
 */
export const generateValidatedTimestampArray = async (
  domain,
  product,
  count = 20,
  intervalMinutes = 5
) => {
  console.log('Generating validated timestamp array...');

  // First generate all possible timestamps
  const possibleTimestamps = generateTimestampArray(count, intervalMinutes);

  // Check each timestamp in parallel
  const validationResults = await Promise.all(
    possibleTimestamps.map(async (timestamp) => {
      const url = generateCODImageUrl(domain, product, timestamp);
      if (!url) {
        return { timestamp, url: null, exists: false };
      }

      const exists = await checkImageExists(url);
      return { timestamp, url, exists };
    })
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
