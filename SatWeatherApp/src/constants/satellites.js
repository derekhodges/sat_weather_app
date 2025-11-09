// Satellite configurations
export const SATELLITES = {
  GOES_19: {
    id: 'goes-19',
    name: 'GOES-19',
    location: 'East',
    available: true,
  },
  GOES_18: {
    id: 'goes-18',
    name: 'GOES-18',
    location: 'West',
    available: false, // Placeholder for future
  },
  GOES_17: {
    id: 'goes-17',
    name: 'GOES-17',
    location: 'West',
    available: false, // Placeholder for future
  },
};

export const DEFAULT_SATELLITE = SATELLITES.GOES_19;

// Satellite channels
export const CHANNELS = [
  { id: 1, number: 1, name: 'Blue', description: 'Visible Blue', wavelength: '0.47 μm', type: 'visible' },
  { id: 2, number: 2, name: 'Red', description: 'Visible Red', wavelength: '0.64 μm', type: 'visible' },
  { id: 3, number: 3, name: 'Veggie', description: 'Near-IR Veggie', wavelength: '0.86 μm', type: 'visible' },
  { id: 4, number: 4, name: 'Cirrus', description: 'Cirrus', wavelength: '1.38 μm', type: 'visible' },
  { id: 5, number: 5, name: 'Snow/Ice', description: 'Snow/Ice', wavelength: '1.61 μm', type: 'visible' },
  { id: 6, number: 6, name: 'Cloud Particle', description: 'Cloud Particle Size', wavelength: '2.25 μm', type: 'visible' },
  { id: 7, number: 7, name: 'Shortwave', description: 'Shortwave Window', wavelength: '3.90 μm', type: 'infrared' },
  { id: 8, number: 8, name: 'Upper Tropo', description: 'Upper-Level Tropo', wavelength: '6.19 μm', type: 'infrared' },
  { id: 9, number: 9, name: 'Mid Tropo', description: 'Mid-Level Tropo', wavelength: '6.95 μm', type: 'infrared' },
  { id: 10, number: 10, name: 'Lower Tropo', description: 'Lower-Level Tropo', wavelength: '7.34 μm', type: 'infrared' },
  { id: 11, number: 11, name: 'Cloud Top', description: 'Cloud-Top Phase', wavelength: '8.50 μm', type: 'infrared' },
  { id: 12, number: 12, name: 'Ozone', description: 'Ozone', wavelength: '9.61 μm', type: 'infrared' },
  { id: 13, number: 13, name: 'Clean IR', description: 'Clean Longwave IR', wavelength: '10.35 μm', type: 'infrared' },
  { id: 14, number: 14, name: 'IR Longwave', description: 'IR Longwave', wavelength: '11.20 μm', type: 'infrared' },
  { id: 15, number: 15, name: 'Dirty Longwave', description: 'Dirty Longwave', wavelength: '12.30 μm', type: 'infrared' },
  { id: 16, number: 16, name: 'CO2 Longwave', description: 'CO2 Longwave', wavelength: '13.30 μm', type: 'infrared' },
];

export const DEFAULT_CHANNEL = CHANNELS.find(c => c.number === 13); // Default to Clean IR
