/**
 * Subscription Tiers and Feature Flags
 *
 * This configuration defines what features are available to each subscription tier.
 * Modify these to adjust your app's monetization strategy.
 */

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  PREMIUM_PLUS: 'premium_plus',
};

export const TIER_FEATURES = {
  [SUBSCRIPTION_TIERS.FREE]: {
    name: 'Free',
    price: '$0',
    features: {
      // Basic features
      maxFavorites: 3,
      maxFrames: 6,
      animationEnabled: true,

      // Products & Channels
      basicProducts: true,
      advancedProducts: false,
      allChannels: false,

      // Overlays
      overlaysEnabled: false,

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
      multipleLocations: false,
      pushNotifications: false,

      // Experience
      adFree: false,
    },
  },

  [SUBSCRIPTION_TIERS.PREMIUM]: {
    name: 'Premium',
    price: '$4.99/month',
    priceYearly: '$49.99/year',
    features: {
      // Basic features
      maxFavorites: 10,
      maxFrames: 20,
      animationEnabled: true,

      // Products & Channels
      basicProducts: true,
      advancedProducts: true,
      allChannels: true,

      // Overlays
      overlaysEnabled: true,

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
      multipleLocations: false,
      pushNotifications: true,

      // Experience
      adFree: true,
    },
  },

  [SUBSCRIPTION_TIERS.PREMIUM_PLUS]: {
    name: 'Premium Plus',
    price: '$9.99/month',
    priceYearly: '$99.99/year',
    features: {
      // Basic features
      maxFavorites: 50,
      maxFrames: 50,
      animationEnabled: true,

      // Products & Channels
      basicProducts: true,
      advancedProducts: true,
      allChannels: true,

      // Overlays
      overlaysEnabled: true,

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
      multipleLocations: true,
      pushNotifications: true,

      // Experience
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
 * Product lists based on tier
 */
export const BASIC_PRODUCTS = ['geocolor', 'truecolor', 'infrared'];
export const ADVANCED_PRODUCTS = ['airmass', 'dust', 'split_window', 'day_cloud_phase', 'day_land_cloud_fire', 'day_snow_fog', 'night_fog'];

/**
 * Get allowed products for a tier
 */
export const getAllowedProducts = (tier) => {
  const features = getTierFeatures(tier);

  if (features.features.advancedProducts) {
    return [...BASIC_PRODUCTS, ...ADVANCED_PRODUCTS];
  }

  return BASIC_PRODUCTS;
};
