/**
 * RevenueCat Purchases Service
 *
 * Handles in-app purchases and subscriptions for both iOS and Android.
 * RevenueCat abstracts away the differences between App Store and Play Store.
 *
 * Setup Required:
 * 1. Create account at https://www.revenuecat.com
 * 2. Create iOS and Android apps in RevenueCat dashboard
 * 3. Set up products in App Store Connect and Google Play Console
 * 4. Configure products in RevenueCat dashboard
 * 5. Add API keys to your .env file
 */

import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { SUBSCRIPTION_TIERS } from '../config/subscription';

// RevenueCat API Keys - set these in your .env file
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

// Product identifiers - these must match what you set up in App Store Connect / Google Play Console
export const PRODUCT_IDS = {
  PRO_MONTHLY: 'sat_weather_pro_monthly',
  PRO_YEARLY: 'sat_weather_pro_yearly',
  PRO_PLUS_MONTHLY: 'sat_weather_pro_plus_monthly',
  PRO_PLUS_YEARLY: 'sat_weather_pro_plus_yearly',
};

// Entitlement identifiers - these are set up in RevenueCat dashboard
export const ENTITLEMENTS = {
  PRO: 'pro',
  PRO_PLUS: 'pro_plus',
};

/**
 * Initialize RevenueCat SDK
 * Call this once when the app starts, typically in App.js or AuthContext
 */
export const initializePurchases = async () => {
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

    if (!apiKey) {
      console.log('[PURCHASES] No RevenueCat API key configured. Subscriptions will not work.');
      console.log('[PURCHASES] Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in your .env file');
      return false;
    }

    await Purchases.configure({ apiKey });
    console.log('[PURCHASES] RevenueCat initialized successfully');
    return true;
  } catch (error) {
    console.error('[PURCHASES] Failed to initialize RevenueCat:', error);
    return false;
  }
};

/**
 * Set the user ID for RevenueCat (call after user signs in)
 * This links purchases to your user account
 */
export const setUserId = async (userId) => {
  try {
    if (!userId) {
      // Anonymous user
      await Purchases.logOut();
      console.log('[PURCHASES] Logged out RevenueCat user');
    } else {
      await Purchases.logIn(userId);
      console.log('[PURCHASES] Set RevenueCat user ID:', userId);
    }
  } catch (error) {
    console.error('[PURCHASES] Failed to set user ID:', error);
  }
};

/**
 * Get available subscription packages
 * Returns offerings configured in RevenueCat dashboard
 */
export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();

    if (!offerings.current) {
      console.log('[PURCHASES] No current offering available');
      return null;
    }

    console.log('[PURCHASES] Available packages:', offerings.current.availablePackages.length);
    return offerings.current;
  } catch (error) {
    console.error('[PURCHASES] Failed to get offerings:', error);
    return null;
  }
};

/**
 * Purchase a subscription package
 * @param {Package} purchasePackage - RevenueCat package object
 * @returns {Object} Purchase result with customerInfo
 */
export const purchasePackage = async (purchasePackage) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(purchasePackage);
    console.log('[PURCHASES] Purchase successful');
    return { success: true, customerInfo };
  } catch (error) {
    if (error.userCancelled) {
      console.log('[PURCHASES] User cancelled purchase');
      return { success: false, cancelled: true };
    }
    console.error('[PURCHASES] Purchase failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Restore previous purchases (important for users who reinstall the app)
 */
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('[PURCHASES] Purchases restored successfully');
    return customerInfo;
  } catch (error) {
    console.error('[PURCHASES] Failed to restore purchases:', error);
    throw error;
  }
};

/**
 * Get current customer info (subscription status)
 */
export const getCustomerInfo = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('[PURCHASES] Failed to get customer info:', error);
    return null;
  }
};

/**
 * Check if user has active entitlement
 * @param {string} entitlementId - ENTITLEMENTS.PRO or ENTITLEMENTS.PRO_PLUS
 */
export const hasEntitlement = async (entitlementId) => {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return false;

    const entitlement = customerInfo.entitlements.active[entitlementId];
    return entitlement?.isActive || false;
  } catch (error) {
    console.error('[PURCHASES] Failed to check entitlement:', error);
    return false;
  }
};

/**
 * Get current subscription tier based on entitlements
 * @returns {string} SUBSCRIPTION_TIERS.FREE, PRO, or PRO_PLUS
 */
export const getCurrentTierFromPurchases = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return SUBSCRIPTION_TIERS.FREE;

    const activeEntitlements = customerInfo.entitlements.active;

    // Check in order of highest tier first
    if (activeEntitlements[ENTITLEMENTS.PRO_PLUS]?.isActive) {
      return SUBSCRIPTION_TIERS.PRO_PLUS;
    }

    if (activeEntitlements[ENTITLEMENTS.PRO]?.isActive) {
      return SUBSCRIPTION_TIERS.PRO;
    }

    return SUBSCRIPTION_TIERS.FREE;
  } catch (error) {
    console.error('[PURCHASES] Failed to get current tier:', error);
    return SUBSCRIPTION_TIERS.FREE;
  }
};

/**
 * Listen for customer info updates (subscription changes)
 * @param {Function} callback - Called with new customerInfo when it changes
 * @returns {Function} Unsubscribe function
 */
export const addCustomerInfoUpdateListener = (callback) => {
  const listener = (customerInfo) => {
    console.log('[PURCHASES] Customer info updated');
    callback(customerInfo);
  };

  Purchases.addCustomerInfoUpdateListener(listener);

  // Return unsubscribe function
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
};

/**
 * Format price for display
 * @param {Package} purchasePackage - RevenueCat package
 * @returns {string} Formatted price string
 */
export const formatPrice = (purchasePackage) => {
  if (!purchasePackage?.product) return '';
  return purchasePackage.product.priceString;
};

/**
 * Get subscription period text
 * @param {Package} purchasePackage - RevenueCat package
 * @returns {string} e.g., "per month", "per year"
 */
export const getSubscriptionPeriod = (purchasePackage) => {
  if (!purchasePackage?.packageType) return '';

  switch (purchasePackage.packageType) {
    case 'MONTHLY':
      return 'per month';
    case 'ANNUAL':
      return 'per year';
    default:
      return '';
  }
};

/**
 * Demo/Testing utilities
 */

/**
 * Check if purchases are configured (API key set)
 */
export const isPurchasesConfigured = () => {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  return !!apiKey;
};

/**
 * Get mock offerings for UI development
 * Use this when RevenueCat isn't configured yet
 */
export const getMockOfferings = () => ({
  identifier: 'default',
  availablePackages: [
    {
      identifier: 'pro_monthly',
      packageType: 'MONTHLY',
      product: {
        identifier: PRODUCT_IDS.PRO_MONTHLY,
        priceString: '$1.99',
        price: 1.99,
        title: 'Pro Monthly',
        description: 'Pro subscription billed monthly',
      },
      offeringIdentifier: 'default',
    },
    {
      identifier: 'pro_yearly',
      packageType: 'ANNUAL',
      product: {
        identifier: PRODUCT_IDS.PRO_YEARLY,
        priceString: '$19.99',
        price: 19.99,
        title: 'Pro Yearly',
        description: 'Pro subscription billed yearly (save $4!)',
      },
      offeringIdentifier: 'default',
    },
    {
      identifier: 'pro_plus_monthly',
      packageType: 'MONTHLY',
      product: {
        identifier: PRODUCT_IDS.PRO_PLUS_MONTHLY,
        priceString: '$4.99',
        price: 4.99,
        title: 'Pro Plus Monthly',
        description: 'Pro Plus subscription billed monthly',
      },
      offeringIdentifier: 'default',
    },
    {
      identifier: 'pro_plus_yearly',
      packageType: 'ANNUAL',
      product: {
        identifier: PRODUCT_IDS.PRO_PLUS_YEARLY,
        priceString: '$49.99',
        price: 49.99,
        title: 'Pro Plus Yearly',
        description: 'Pro Plus subscription billed yearly (save $10!)',
      },
      offeringIdentifier: 'default',
    },
  ],
});
