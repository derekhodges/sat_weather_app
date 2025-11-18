/**
 * Subscription Tiers and Feature Flags
 *
 * This configuration defines what features are available to each subscription tier.
 * Modify these to adjust your app's monetization strategy.
 *
 * IMPORTANT: For iOS/Android, you MUST use Apple In-App Purchases and Google Play Billing.
 * RevenueCat is recommended to handle both platforms with one SDK.
 */

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  PRO_PLUS: 'pro_plus',
};

export const TIER_FEATURES = {
  [SUBSCRIPTION_TIERS.FREE]: {
    name: 'Free',
    price: '$0',
    features: {
      // Animation
      maxFrames: 6,
      animationEnabled: true,

      // Products & Channels - LIMITED
      allowedProducts: ['geocolor'], // Only Geocolor RGB
      allowedChannels: [13], // Only Channel 13 (Clean IR)
      allProducts: false,
      allChannels: false,

      // Domains
      localDomains: false, // Local domains require Pro or higher

      // Overlays - Boundaries only (counties, roads, cities, etc.)
      boundaryOverlays: true, // States, counties, roads, cities, rivers, lat/lon
      lightningOverlays: false,
      nwsOverlays: false, // Warnings, watches
      radarOverlays: false,
      spcOverlays: false, // Convective outlook, tornado probs

      // Drawing & Sharing
      drawingEnabled: true,
      sharingEnabled: true,

      // Quality & Performance
      highResImages: false,
      offlineCaching: false,
      autoRefresh: false,

      // Advanced Features
      inspectorMode: false,
      customTimeSelection: false,

      // Experience
      showAds: true, // Banner ad at bottom
      adFree: false,
    },
  },

  [SUBSCRIPTION_TIERS.PRO]: {
    name: 'Pro',
    price: '$1.99/month',
    priceYearly: '$20/year',
    features: {
      // Animation
      maxFrames: 24,
      animationEnabled: true,

      // Products & Channels - ALL
      allowedProducts: 'all',
      allowedChannels: 'all',
      allProducts: true,
      allChannels: true,

      // Domains
      localDomains: true, // Local domains included in Pro

      // Overlays - Boundaries + Lightning + NWS + SPC (no radar)
      boundaryOverlays: true,
      lightningOverlays: true, // GLM Flash, GLM Groups
      nwsOverlays: true, // Warnings, watches, mesoscale discussions
      radarOverlays: false, // Not in Pro - only Pro Plus
      spcOverlays: true, // Convective Outlook, Tornado Probabilities

      // Drawing & Sharing
      drawingEnabled: true,
      sharingEnabled: true,

      // Quality & Performance
      highResImages: true,
      offlineCaching: true,
      autoRefresh: true,

      // Advanced Features
      inspectorMode: true,
      customTimeSelection: false,

      // Experience
      showAds: false,
      adFree: true,
    },
  },

  [SUBSCRIPTION_TIERS.PRO_PLUS]: {
    name: 'Pro Plus',
    price: '$4.99/month',
    priceYearly: '$50/year',
    features: {
      // Animation
      maxFrames: 36,
      animationEnabled: true,

      // Products & Channels - ALL
      allowedProducts: 'all',
      allowedChannels: 'all',
      allProducts: true,
      allChannels: true,

      // Domains
      localDomains: true, // Local domains included

      // Overlays - ALL
      boundaryOverlays: true,
      lightningOverlays: true,
      nwsOverlays: true,
      radarOverlays: true, // MRMS, Composite Radar - Pro Plus only
      spcOverlays: true, // Convective Outlook, Tornado Probabilities

      // Drawing & Sharing
      drawingEnabled: true,
      sharingEnabled: true,

      // Quality & Performance
      highResImages: true,
      offlineCaching: true,
      autoRefresh: true,

      // Advanced Features
      inspectorMode: true,
      customTimeSelection: true,

      // Experience
      showAds: false,
      adFree: true,
    },
  },
};

/**
 * Get features for a specific tier
 */
export const getTierFeatures = (tier = SUBSCRIPTION_TIERS.FREE) => {
  return TIER_FEATURES[tier] || TIER_FEATURES[SUBSCRIPTION_TIERS.FREE];
};

/**
 * Check if a feature is available for a tier
 */
export const hasFeature = (tier, featureName) => {
  const features = getTierFeatures(tier);
  return features.features[featureName] || false;
};

/**
 * Feature gate helper - returns whether feature should be allowed
 * Respects MOCK_PREMIUM flag for testing
 */
export const isFeatureEnabled = (userTier, featureName) => {
  // If subscriptions are disabled, grant all features
  const subscriptionsEnabled = process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS === 'true';
  if (!subscriptionsEnabled) {
    return true;
  }

  // If mock premium is enabled, grant all features
  const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
  if (mockPremium) {
    return true;
  }

  // Otherwise check actual tier
  return hasFeature(userTier, featureName);
};

/**
 * Check if a product is allowed for a tier
 */
export const isProductAllowed = (tier, productId) => {
  const features = getTierFeatures(tier).features;

  // If subscriptions are disabled, allow all
  const subscriptionsEnabled = process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS === 'true';
  if (!subscriptionsEnabled) {
    return true;
  }

  // If mock premium is enabled, allow all
  const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
  if (mockPremium) {
    return true;
  }

  // Check if product is allowed
  if (features.allowedProducts === 'all') {
    return true;
  }

  return features.allowedProducts.includes(productId);
};

/**
 * Check if a channel is allowed for a tier
 */
export const isChannelAllowed = (tier, channelNumber) => {
  const features = getTierFeatures(tier).features;

  // If subscriptions are disabled, allow all
  const subscriptionsEnabled = process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS === 'true';
  if (!subscriptionsEnabled) {
    return true;
  }

  // If mock premium is enabled, allow all
  const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
  if (mockPremium) {
    return true;
  }

  // Check if channel is allowed
  if (features.allowedChannels === 'all') {
    return true;
  }

  return features.allowedChannels.includes(channelNumber);
};

/**
 * Check if an overlay is allowed for a tier
 * @param {string} tier - The subscription tier
 * @param {string} overlayId - The overlay ID (e.g., 'glm_flash', 'state_lines', 'mrms')
 */
export const isOverlayAllowed = (tier, overlayId) => {
  const features = getTierFeatures(tier).features;

  // If subscriptions are disabled, allow all
  const subscriptionsEnabled = process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS === 'true';
  if (!subscriptionsEnabled) {
    return true;
  }

  // If mock premium is enabled, allow all
  const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
  if (mockPremium) {
    return true;
  }

  // Check overlay by ID - map to the appropriate feature flag
  switch (overlayId) {
    // Boundary overlays - FREE tier and above
    case 'state_lines':
    case 'county_lines':
    case 'nws_cwa':
    case 'latlon':
    case 'rivers':
    case 'usint':
    case 'ushw':
    case 'usstrd':
    case 'cities':
      return features.boundaryOverlays;

    // Lightning overlays - PRO tier and above
    case 'glm_flash':
    case 'glm_groups':
      return features.lightningOverlays;

    // NWS overlays - PRO tier and above
    case 'warnings':
    case 'watches':
    case 'meso_disc':
      return features.nwsOverlays;

    // SPC overlays - PRO tier and above
    case 'spc_outlook':
    case 'spc_tornado':
      return features.spcOverlays;

    // Radar overlays - PRO PLUS only
    case 'mrms':
    case 'composite_radar':
      return features.radarOverlays;

    default:
      // Unknown overlay - deny by default for safety
      return false;
  }
};

/**
 * Check if local domains are allowed for a tier
 */
export const isLocalDomainAllowed = (tier) => {
  const features = getTierFeatures(tier).features;

  // If subscriptions are disabled, allow all
  const subscriptionsEnabled = process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS === 'true';
  if (!subscriptionsEnabled) {
    return true;
  }

  // If mock premium is enabled, allow all
  const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
  if (mockPremium) {
    return true;
  }

  return features.localDomains;
};

/**
 * Get max frames allowed for animation
 */
export const getMaxFrames = (tier) => {
  const features = getTierFeatures(tier).features;

  // If subscriptions are disabled, return max possible
  const subscriptionsEnabled = process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS === 'true';
  if (!subscriptionsEnabled) {
    return 50; // Maximum possible
  }

  // If mock premium is enabled, return max possible
  const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
  if (mockPremium) {
    return 50;
  }

  return features.maxFrames;
};

/**
 * Check if ads should be shown
 */
export const shouldShowAds = (tier) => {
  const features = getTierFeatures(tier).features;

  // If subscriptions are disabled, don't show ads
  const subscriptionsEnabled = process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS === 'true';
  if (!subscriptionsEnabled) {
    return false;
  }

  // If mock premium is enabled, don't show ads
  const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
  if (mockPremium) {
    return false;
  }

  return features.showAds;
};
