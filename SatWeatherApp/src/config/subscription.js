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

      // Overlays - Map only
      mapOverlays: true, // States, counties, cities
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
    price: '$0.99/month',
    priceYearly: '$10/year',
    features: {
      // Animation
      maxFrames: 24,
      animationEnabled: true,

      // Products & Channels - ALL
      allowedProducts: 'all',
      allowedChannels: 'all',
      allProducts: true,
      allChannels: true,

      // Overlays - Map + Lightning + NWS
      mapOverlays: true,
      lightningOverlays: true, // GLM Flash, GLM Groups
      nwsOverlays: true, // Warnings, watches, mesoscale discussions
      radarOverlays: false, // Not in Pro
      spcOverlays: false, // Not in Pro

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
    price: '$2.99/month',
    priceYearly: '$30/year',
    features: {
      // Animation
      maxFrames: 36,
      animationEnabled: true,

      // Products & Channels - ALL
      allowedProducts: 'all',
      allowedChannels: 'all',
      allProducts: true,
      allChannels: true,

      // Overlays - ALL
      mapOverlays: true,
      lightningOverlays: true,
      nwsOverlays: true,
      radarOverlays: true, // MRMS, Composite Radar
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
 * Check if an overlay category is allowed for a tier
 */
export const isOverlayAllowed = (tier, overlayType) => {
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

  // Check overlay category
  switch (overlayType) {
    case 'map':
    case 'states':
    case 'counties':
    case 'cities':
      return features.mapOverlays;
    case 'lightning':
    case 'glm_flash':
    case 'glm_groups':
      return features.lightningOverlays;
    case 'nws':
    case 'warnings':
    case 'watches':
    case 'mesoscale':
      return features.nwsOverlays;
    case 'radar':
    case 'mrms':
    case 'composite':
      return features.radarOverlays;
    case 'spc':
    case 'convective':
    case 'tornado':
      return features.spcOverlays;
    default:
      return false;
  }
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
