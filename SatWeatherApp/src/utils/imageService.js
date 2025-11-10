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

  if (!product || !product.codName) {
    console.error('generateCODImageUrl: Invalid product', product);
    return null;
  }

  const ts = timestamp || generateCurrentTimestamp();

  // Determine the base path based on domain type
  let basePath = '';
  let domainName = domain.codName;
  let productName = product.codName;

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

  return url;
};

/**
 * Generate current timestamp in COD format: YYYYMMDD.HHMMSS
 */
export const generateCurrentTimestamp = () => {
  const now = new Date();

  // Round down to nearest 5 minutes (COD updates every 5-10 minutes)
  const minutes = Math.floor(now.getUTCMinutes() / 5) * 5;
  now.setUTCMinutes(minutes);
  now.setUTCSeconds(0);

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const mins = String(now.getUTCMinutes()).padStart(2, '0');
  const secs = String(now.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}.${hours}${mins}${secs}`;
};

/**
 * Generate array of timestamps for animation (last N frames)
 */
export const generateTimestampArray = (count = 20, intervalMinutes = 10) => {
  const timestamps = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const time = new Date(now.getTime() - (i * intervalMinutes * 60 * 1000));

    // Round to nearest interval
    const minutes = Math.floor(time.getUTCMinutes() / intervalMinutes) * intervalMinutes;
    time.setUTCMinutes(minutes);
    time.setUTCSeconds(0);

    const year = time.getUTCFullYear();
    const month = String(time.getUTCMonth() + 1).padStart(2, '0');
    const day = String(time.getUTCDate()).padStart(2, '0');
    const hours = String(time.getUTCHours()).padStart(2, '0');
    const mins = String(time.getUTCMinutes()).padStart(2, '0');
    const secs = String(time.getUTCSeconds()).padStart(2, '0');

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
export const getLatestImageUrl = async (domain, product, maxAttempts = 12) => {
  // Validate inputs first
  if (!domain || !product) {
    console.error('getLatestImageUrl: Invalid domain or product', { domain, product });
    return null;
  }

  for (let i = 0; i < maxAttempts; i++) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - (i * 10)); // Go back 10 minutes each attempt

    const minutes = Math.floor(now.getUTCMinutes() / 10) * 10;
    now.setUTCMinutes(minutes);
    now.setUTCSeconds(0);

    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const mins = String(now.getUTCMinutes()).padStart(2, '0');
    const secs = '00';

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
 * Placeholder for AWS image fetching (future implementation)
 */
export const generateAWSImageUrl = (satellite, domain, product, timestamp) => {
  // TODO: Implement AWS S3 URL generation
  // Will follow pattern like:
  // s3://your-bucket/satellite/{satellite}/{domain}/{product}/{timestamp}.jpg
  throw new Error('AWS image fetching not yet implemented');
};
