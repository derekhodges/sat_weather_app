// RGB Products as specified by user
export const RGB_PRODUCTS = [
  {
    id: 'geocolor',
    name: 'Geocolor',
    codName: 'truecolor', // COD uses 'truecolor' for geocolor
    description: 'Natural color composite with nighttime IR',
    useCase: 'True color daytime imagery that transitions to infrared at night. Best for general viewing, cloud identification, and surface features. Shows Earth as the human eye would see it from space.',
  },
  {
    id: 'airmass',
    name: 'Airmass',
    codName: 'airmass',
    description: 'Upper level moisture and jet stream',
    useCase: 'Identifies upper-level dynamics including jet streams, areas of convergence/divergence, and potential vorticity anomalies. Useful for severe weather forecasting and understanding large-scale atmospheric patterns.',
  },
  {
    id: 'dust',
    name: 'Dust',
    codName: 'dust',
    description: 'Dust and aerosol detection',
    useCase: 'Detects airborne dust, sand, volcanic ash, and smoke. Critical for aviation safety, air quality monitoring, and tracking Saharan dust transport across oceans.',
  },
  {
    id: 'split_window',
    name: 'Split Window',
    codName: 'split_window',
    description: 'Temperature difference product',
    useCase: 'Highlights differences in atmospheric moisture and cloud properties. Useful for identifying cloud types, volcanic ash, and areas of dry air intrusion.',
  },
  {
    id: 'cloud_microphysics',
    name: 'Cloud Microphysics',
    codName: 'cloud_microphysics',
    description: 'Cloud particle properties',
    useCase: 'Distinguishes between ice and water clouds, cloud particle size, and cloud phase. Important for aviation icing hazards, precipitation forecasting, and understanding storm structure.',
  },
  {
    id: 'day_land_cloud_fire',
    name: 'Day Land Cloud Fire',
    codName: 'day_land_cloud_fire',
    description: 'Daytime surface and fire detection',
    useCase: 'Detects active fires, hot spots, and burn scars during daytime. Also enhances land surface features and distinguishes clouds from snow. Critical for wildfire monitoring and management.',
  },
  {
    id: 'day_snow_fog',
    name: 'Day Snow Fog',
    codName: 'day_snow_fog',
    description: 'Snow and fog detection',
    useCase: 'Distinguishes between snow cover, clouds, and fog during daytime. Important for winter weather monitoring, aviation safety, and surface transportation.',
  },
  {
    id: 'night_fog',
    name: 'Night Fog',
    codName: 'night_fog',
    description: 'Nighttime fog detection',
    useCase: 'Detects and monitors fog and low clouds at night. Essential for aviation safety, marine navigation, and identifying areas of reduced visibility during nighttime hours.',
  },
];

export const DEFAULT_RGB_PRODUCT = RGB_PRODUCTS[0]; // Geocolor
