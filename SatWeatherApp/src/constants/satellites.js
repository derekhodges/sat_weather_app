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
    available: true,
  },
};

export const DEFAULT_SATELLITE = SATELLITES.GOES_19;

// Satellite channels
export const CHANNELS = [
  { id: 1, number: 1, name: 'Blue', description: 'Visible Blue', wavelength: '0.47 μm', type: 'visible', useCase: 'Aerosol detection, true color imagery, coastal waters' },
  { id: 2, number: 2, name: 'Red', description: 'Visible Red', wavelength: '0.64 μm', type: 'visible', useCase: 'Daytime clouds, fog, insolation, winds, natural color imagery' },
  { id: 3, number: 3, name: 'Veggie', description: 'Near-IR Veggie', wavelength: '0.86 μm', type: 'visible', useCase: 'Vegetation health, burn scar, aerosol particle size, snow/ice discrimination' },
  { id: 4, number: 4, name: 'Cirrus', description: 'Cirrus', wavelength: '1.38 μm', type: 'visible', useCase: 'High-altitude cirrus cloud detection, aviation safety' },
  { id: 5, number: 5, name: 'Snow/Ice', description: 'Snow/Ice', wavelength: '1.61 μm', type: 'visible', useCase: 'Cloud particle size, snow/ice discrimination, aviation' },
  { id: 6, number: 6, name: 'Cloud Particle', description: 'Cloud Particle Size', wavelength: '2.25 μm', type: 'visible', useCase: 'Cloud particle size, cloud phase, aviation icing' },
  { id: 7, number: 7, name: 'Shortwave', description: 'Shortwave Window', wavelength: '3.90 μm', type: 'infrared', useCase: 'Fog/low cloud detection, fire/volcanic ash, surface temperature' },
  { id: 8, number: 8, name: 'Upper Tropo', description: 'Upper-Level Tropo', wavelength: '6.19 μm', type: 'infrared', useCase: 'Upper-level water vapor, jet stream, severe weather' },
  { id: 9, number: 9, name: 'Mid Tropo', description: 'Mid-Level Tropo', wavelength: '6.95 μm', type: 'infrared', useCase: 'Mid-level moisture, atmospheric instability' },
  { id: 10, number: 10, name: 'Lower Tropo', description: 'Lower-Level Tropo', wavelength: '7.34 μm', type: 'infrared', useCase: 'Lower-level moisture, rainfall potential, tropical cyclones' },
  { id: 11, number: 11, name: 'Cloud Top', description: 'Cloud-Top Phase', wavelength: '8.50 μm', type: 'infrared', useCase: 'Cloud phase (ice vs water), volcanic ash detection' },
  { id: 12, number: 12, name: 'Ozone', description: 'Ozone', wavelength: '9.61 μm', type: 'infrared', useCase: 'Total column ozone, atmospheric dynamics, stratospheric intrusions' },
  { id: 13, number: 13, name: 'Clean IR', description: 'Clean Longwave IR', wavelength: '10.35 μm', type: 'infrared', useCase: 'Cloud imagery, cloud-top temperature, surface temperature' },
  { id: 14, number: 14, name: 'IR Longwave', description: 'IR Longwave', wavelength: '11.20 μm', type: 'infrared', useCase: 'Cloud imagery, SST (sea surface temperature), rainfall estimation' },
  { id: 15, number: 15, name: 'Dirty Longwave', description: 'Dirty Longwave', wavelength: '12.30 μm', type: 'infrared', useCase: 'Low-level moisture, cloud height, surface emissivity' },
  { id: 16, number: 16, name: 'CO2 Longwave', description: 'CO2 Longwave', wavelength: '13.30 μm', type: 'infrared', useCase: 'Upper-level clouds, atmospheric CO2, cloud height' },
];

export const DEFAULT_CHANNEL = CHANNELS.find(c => c.number === 13); // Default to Clean IR
