// Overlay options for the satellite imagery
export const OVERLAY_CATEGORIES = {
  LIGHTNING: 'lightning',
  RADAR: 'radar',
  NWS: 'nws',
  SPC: 'spc',
  BOUNDARIES: 'boundaries',
};

export const OVERLAYS = {
  // Lightning
  GLM_FLASH: {
    id: 'glm_flash',
    name: 'GLM Flash Extent',
    category: OVERLAY_CATEGORIES.LIGHTNING,
    description: 'GOES Lightning Mapper flash extent density',
    enabled: false,
  },

  GLM_GROUPS: {
    id: 'glm_groups',
    name: 'GLM Groups',
    category: OVERLAY_CATEGORIES.LIGHTNING,
    description: 'GLM group detections',
    enabled: false,
  },

  // Radar
  MRMS: {
    id: 'mrms',
    name: 'MRMS Reflectivity',
    category: OVERLAY_CATEGORIES.RADAR,
    description: 'Multi-Radar Multi-Sensor composite',
    enabled: false,
  },

  COMPOSITE_RADAR: {
    id: 'composite_radar',
    name: 'Composite Radar',
    category: OVERLAY_CATEGORIES.RADAR,
    description: 'National composite radar',
    enabled: false,
  },

  // NWS Products
  WARNINGS: {
    id: 'warnings',
    name: 'Warnings',
    category: OVERLAY_CATEGORIES.NWS,
    description: 'Severe weather warnings',
    enabled: false,
  },

  WATCHES: {
    id: 'watches',
    name: 'Watches',
    category: OVERLAY_CATEGORIES.NWS,
    description: 'Severe weather watches',
    enabled: false,
  },

  MESOSCALE_DISCUSSIONS: {
    id: 'meso_disc',
    name: 'Mesoscale Discussions',
    category: OVERLAY_CATEGORIES.NWS,
    description: 'NWS mesoscale discussions',
    enabled: false,
  },

  // SPC Products
  SPC_OUTLOOK: {
    id: 'spc_outlook',
    name: 'SPC Convective Outlook',
    category: OVERLAY_CATEGORIES.SPC,
    description: 'Storm Prediction Center outlook',
    enabled: false,
  },

  SPC_TORNADO: {
    id: 'spc_tornado',
    name: 'Tornado Probabilities',
    category: OVERLAY_CATEGORIES.SPC,
    description: 'SPC tornado probability',
    enabled: false,
  },

  // Boundaries - Political
  STATE_LINES: {
    id: 'state_lines',
    name: 'State Boundaries',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'State and political boundary lines',
    enabled: true, // Default on
  },

  COUNTY_LINES: {
    id: 'county_lines',
    name: 'County Boundaries',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'County boundary lines',
    enabled: false,
  },

  NWS_CWA: {
    id: 'nws_cwa',
    name: 'NWS County Warning Areas',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'National Weather Service county warning areas',
    enabled: false,
  },

  // Boundaries - Geographic
  LAT_LON: {
    id: 'latlon',
    name: 'Lat/Lon Grid',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'Latitude/longitude grid lines',
    enabled: false,
  },

  RIVERS: {
    id: 'rivers',
    name: 'Rivers',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'Major rivers and waterways',
    enabled: false,
  },

  // Boundaries - Infrastructure
  US_INTERSTATES: {
    id: 'usint',
    name: 'US Interstates',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'Interstate highway system',
    enabled: false,
  },

  US_HIGHWAYS: {
    id: 'ushw',
    name: 'US Highways',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'US highway system',
    enabled: false,
  },

  US_ROADS: {
    id: 'usstrd',
    name: 'US Roads',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'State roads and highways',
    enabled: false,
  },

  // Boundaries - Labels
  CITIES: {
    id: 'cities',
    name: 'Cities',
    category: OVERLAY_CATEGORIES.BOUNDARIES,
    description: 'Major city labels',
    enabled: false,
  },
};

// Organize overlays by category
export const OVERLAYS_BY_CATEGORY = Object.values(OVERLAYS).reduce((acc, overlay) => {
  if (!acc[overlay.category]) {
    acc[overlay.category] = [];
  }
  acc[overlay.category].push(overlay);
  return acc;
}, {});

export const getEnabledOverlays = () => {
  return Object.values(OVERLAYS).filter(overlay => overlay.enabled);
};
