// RGB Products as specified by user
export const RGB_PRODUCTS = [
  {
    id: 'geocolor',
    name: 'Geocolor',
    codName: 'truecolor', // COD uses 'truecolor' for geocolor
    description: 'Natural color composite with nighttime IR',
  },
  {
    id: 'airmass',
    name: 'Airmass',
    codName: 'airmass',
    description: 'Upper level moisture and jet stream',
  },
  {
    id: 'dust',
    name: 'Dust',
    codName: 'dust',
    description: 'Dust and aerosol detection',
  },
  {
    id: 'split_window',
    name: 'Split Window',
    codName: 'split_window',
    description: 'Temperature difference product',
  },
  {
    id: 'cloud_microphysics',
    name: 'Cloud Microphysics',
    codName: 'cloud_microphysics',
    description: 'Cloud particle properties',
  },
  {
    id: 'day_land_cloud_fire',
    name: 'Day Land Cloud Fire',
    codName: 'day_land_cloud_fire',
    description: 'Daytime surface and fire detection',
  },
  {
    id: 'day_snow_fog',
    name: 'Day Snow Fog',
    codName: 'day_snow_fog',
    description: 'Snow and fog detection',
  },
  {
    id: 'night_fog',
    name: 'Night Fog',
    codName: 'night_fog',
    description: 'Nighttime fog detection',
  },
];

export const DEFAULT_RGB_PRODUCT = RGB_PRODUCTS[0]; // Geocolor
