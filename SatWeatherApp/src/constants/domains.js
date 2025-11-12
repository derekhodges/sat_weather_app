// Domain configurations
export const DOMAIN_TYPES = {
  FULL_DISK: 'full_disk',
  CONUS: 'conus',
  REGIONAL: 'regional',
  LOCAL: 'local',
};

export const DOMAINS = {
  // Full Disk
  FULL_DISK: {
    id: 'full_disk',
    name: 'Full Disk',
    type: DOMAIN_TYPES.FULL_DISK,
    codName: 'full_disk',
    description: 'Entire hemisphere view',
    bounds: null, // Entire disk
  },

  // CONUS
  CONUS: {
    id: 'conus',
    name: 'CONUS',
    type: DOMAIN_TYPES.CONUS,
    codName: 'conus',
    description: 'Continental United States',
    bounds: {
      minLat: 24.0,
      maxLat: 50.0,
      minLon: -126.0,
      maxLon: -66.0,
    },
  },

  // Regional domains
  NORTHWEST: {
    id: 'northwest',
    name: 'Northwest',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'northwest',
    description: 'Pacific Northwest',
    bounds: {
      minLat: 42.0,
      maxLat: 49.0,
      minLon: -125.0,
      maxLon: -111.0,
    },
  },

  NORTHEAST: {
    id: 'northeast',
    name: 'Northeast',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'northeast',
    description: 'Northeast US',
    bounds: {
      minLat: 38.0,
      maxLat: 47.0,
      minLon: -85.0,
      maxLon: -67.0,
    },
  },

  SOUTHWEST: {
    id: 'southwest',
    name: 'Southwest',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'southwest',
    description: 'Southwest US',
    bounds: {
      minLat: 31.0,
      maxLat: 42.0,
      minLon: -124.0,
      maxLon: -109.0,
    },
  },

  SOUTHEAST: {
    id: 'southeast',
    name: 'Southeast',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'southeast',
    description: 'Southeast US',
    bounds: {
      minLat: 25.0,
      maxLat: 38.0,
      minLon: -92.0,
      maxLon: -75.0,
    },
  },

  NORTH_CENTRAL: {
    id: 'north_central',
    name: 'North Central',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'north_central',
    description: 'North Central US',
    bounds: {
      minLat: 41.0,
      maxLat: 49.0,
      minLon: -104.0,
      maxLon: -90.0,
    },
  },

  WEST_CENTRAL: {
    id: 'west_central',
    name: 'West-Central',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'west_central',
    description: 'West-Central US',
    bounds: {
      minLat: 35.0,
      maxLat: 44.0,
      minLon: -117.0,
      maxLon: -103.0,
    },
  },

  CENTRAL: {
    id: 'central',
    name: 'Central',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'central',
    description: 'Central US',
    bounds: {
      minLat: 35.0,
      maxLat: 44.0,
      minLon: -103.0,
      maxLon: -89.0,
    },
  },

  EAST_CENTRAL: {
    id: 'east_central',
    name: 'East-Central',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'east_central',
    description: 'East-Central US',
    bounds: {
      minLat: 35.0,
      maxLat: 44.0,
      minLon: -89.0,
      maxLon: -75.0,
    },
  },

  SOUTH_CENTRAL: {
    id: 'south_central',
    name: 'South Central',
    type: DOMAIN_TYPES.REGIONAL,
    codName: 'south_central',
    description: 'South Central US',
    bounds: {
      minLat: 28.0,
      maxLat: 37.0,
      minLon: -103.0,
      maxLon: -89.0,
    },
  },

  // Local/State domains
  OKLAHOMA: {
    id: 'oklahoma',
    name: 'Oklahoma',
    type: DOMAIN_TYPES.LOCAL,
    codName: 'Oklahoma', // Note: COD uses capital O
    description: 'Oklahoma',
    bounds: {
      minLat: 33.5,
      maxLat: 37.0,
      minLon: -103.0,
      maxLon: -94.5,
    },
  },

  TEXAS: {
    id: 'texas',
    name: 'Texas',
    type: DOMAIN_TYPES.LOCAL,
    codName: 'Texas',
    description: 'Texas',
    bounds: {
      minLat: 26.0,
      maxLat: 36.5,
      minLon: -106.5,
      maxLon: -93.5,
    },
  },

  // Mesoscale domains
  MESOSCALE_1: {
    id: 'meso1',
    name: 'Mesoscale 1',
    type: DOMAIN_TYPES.LOCAL,
    codName: 'meso1',
    description: 'Mesoscale Domain 1',
    bounds: null, // Dynamic positioning
  },

  MESOSCALE_2: {
    id: 'meso2',
    name: 'Mesoscale 2',
    type: DOMAIN_TYPES.LOCAL,
    codName: 'meso2',
    description: 'Mesoscale Domain 2',
    bounds: null, // Dynamic positioning
  },
};

export const DEFAULT_DOMAIN = DOMAINS.OKLAHOMA;

// Organize domains by type for menu display
export const DOMAINS_BY_TYPE = {
  [DOMAIN_TYPES.FULL_DISK]: [DOMAINS.FULL_DISK],
  [DOMAIN_TYPES.CONUS]: [DOMAINS.CONUS],
  [DOMAIN_TYPES.REGIONAL]: [
    DOMAINS.NORTHWEST,
    DOMAINS.NORTH_CENTRAL,
    DOMAINS.NORTHEAST,
    DOMAINS.WEST_CENTRAL,
    DOMAINS.CENTRAL,
    DOMAINS.EAST_CENTRAL,
    DOMAINS.SOUTHWEST,
    DOMAINS.SOUTH_CENTRAL,
    DOMAINS.SOUTHEAST,
  ],
  [DOMAIN_TYPES.LOCAL]: [
    DOMAINS.MESOSCALE_1,
    DOMAINS.MESOSCALE_2,
    DOMAINS.OKLAHOMA,
    DOMAINS.TEXAS,
  ],
};
