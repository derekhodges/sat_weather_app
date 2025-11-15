/**
 * Feature Gate Usage Examples
 *
 * This file contains examples of how to implement feature gates
 * throughout your app. Copy these patterns into your components.
 */

import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';

/**
 * Example 1: Check feature access before performing an action
 */
export const Example1_CheckBeforeAction = () => {
  const { hasFeatureAccess, showUpgradePrompt } = useAuth();

  const handleAddFavorite = () => {
    // Check if user can add more favorites
    if (!hasFeatureAccess('maxFavorites')) {
      showUpgradePrompt('Unlimited Favorites');
      return;
    }

    // Continue with adding favorite
    console.log('Adding favorite...');
  };

  return (
    <button onClick={handleAddFavorite}>
      Add to Favorites
    </button>
  );
};

/**
 * Example 2: Disable overlay toggles if user doesn't have access
 */
export const Example2_DisableOverlays = () => {
  const { hasFeatureAccess, showUpgradePrompt } = useAuth();
  const overlaysEnabled = hasFeatureAccess('overlaysEnabled');

  const handleToggleOverlay = (overlayId) => {
    if (!overlaysEnabled) {
      showUpgradePrompt('Weather Overlays');
      return;
    }

    // Toggle the overlay
    console.log('Toggling overlay:', overlayId);
  };

  return null; // Your component JSX
};

/**
 * Example 3: Limit number of frames based on subscription
 */
export const Example3_LimitFrames = () => {
  const { subscriptionTier } = useAuth();
  const { getTierFeatures } = require('../config/subscription');

  const tierFeatures = getTierFeatures(subscriptionTier);
  const maxFrames = tierFeatures.features.maxFrames;

  console.log(`User can load up to ${maxFrames} frames`);

  return null;
};

/**
 * Example 4: Show different UI based on subscription
 */
export const Example4_ConditionalUI = () => {
  const { subscriptionTier } = useAuth();
  const { SUBSCRIPTION_TIERS } = require('../config/subscription');

  const isPremium = subscriptionTier !== SUBSCRIPTION_TIERS.FREE;

  return (
    <div>
      {isPremium ? (
        <div>Premium Content Here</div>
      ) : (
        <div>
          <p>Upgrade to Premium to unlock this feature!</p>
          <button>Upgrade Now</button>
        </div>
      )}
    </div>
  );
};

/**
 * Example 5: Custom alert for feature limits
 */
export const Example5_CustomAlert = () => {
  const { hasFeatureAccess, subscriptionTier } = useAuth();
  const { getTierFeatures } = require('../config/subscription');

  const handleExceedLimit = (feature) => {
    const tierFeatures = getTierFeatures(subscriptionTier);
    const limit = tierFeatures.features[feature];

    Alert.alert(
      'Limit Reached',
      `You've reached the maximum of ${limit} allowed in your current plan. Upgrade to Premium for more!`,
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => console.log('Navigate to subscription') },
      ]
    );
  };

  return null;
};

/**
 * Example 6: Check if user should see inspector mode
 */
export const Example6_InspectorMode = () => {
  const { hasFeatureAccess } = useAuth();

  const canUseInspector = hasFeatureAccess('inspectorMode');

  if (!canUseInspector) {
    // Don't show inspector button
    return null;
  }

  return <button>🔍 Inspector</button>;
};

/**
 * Example 7: Filter available products based on subscription
 */
export const Example7_FilterProducts = () => {
  const { subscriptionTier } = useAuth();
  const { getAllowedProducts } = require('../config/subscription');

  const allowedProducts = getAllowedProducts(subscriptionTier);

  console.log('User can access these products:', allowedProducts);

  // In your product list, filter by allowedProducts
  const allProducts = ['geocolor', 'airmass', 'dust', 'split_window'];
  const availableProducts = allProducts.filter(p => allowedProducts.includes(p));

  return null;
};

/**
 * Example 8: Track usage against limits
 */
export const Example8_TrackUsage = () => {
  const { subscriptionTier } = useAuth();
  const { getTierFeatures } = require('../config/subscription');
  const [favoriteCount, setFavoriteCount] = React.useState(0);

  const tierFeatures = getTierFeatures(subscriptionTier);
  const maxFavorites = tierFeatures.features.maxFavorites;

  const canAddMore = favoriteCount < maxFavorites;

  console.log(`${favoriteCount} / ${maxFavorites} favorites used`);

  return null;
};

/**
 * IMPLEMENTATION IN REAL COMPONENTS:
 *
 * 1. In FavoritesMenu.js - Limit favorites based on tier
 * 2. In TimelineSlider.js - Limit frames based on tier
 * 3. In InspectorOverlay.js - Show only for premium users
 * 4. In MenuSelector.js (Overlays) - Disable if not premium
 * 5. In SettingsModal.js - Show subscription info and upgrade button
 */
