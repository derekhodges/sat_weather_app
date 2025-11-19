/**
 * Subscription Management Screen
 *
 * Displays available subscription tiers and handles upgrades.
 * Integrates with RevenueCat for cross-platform in-app purchases.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_TIERS, TIER_FEATURES } from '../config/subscription';
import {
  isPurchasesConfigured,
  getOfferings,
  getMockOfferings,
  purchasePackage,
  restorePurchases,
  getCurrentTierFromPurchases,
  PRODUCT_IDS,
} from '../services/purchases';

export default function SubscriptionScreen({ onClose }) {
  const {
    subscriptionTier,
    setDeveloperTierOverride,
    trialActive,
    trialUsed,
    startTrial,
    getTrialStatus,
    isAuthenticated,
    authEnabled,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly'); // 'monthly' or 'yearly'
  const [showTrialCardOverride, setShowTrialCardOverride] = useState(false); // Developer override

  // Check if we're in development mode
  const isDevelopment = __DEV__ || process.env.EXPO_PUBLIC_APP_ENV === 'development';

  // Load offerings on mount
  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    setLoading(true);
    try {
      if (isPurchasesConfigured()) {
        const currentOffering = await getOfferings();
        setOfferings(currentOffering);
      } else {
        // Use mock offerings for development
        setOfferings(getMockOfferings());
        console.log('[SUBSCRIPTION] Using mock offerings (RevenueCat not configured)');
      }
    } catch (error) {
      console.error('Failed to load offerings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tier) => {
    if (tier === SUBSCRIPTION_TIERS.FREE) {
      // Downgrade or cancel
      Alert.alert(
        'Cancel Subscription',
        'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.',
        [
          { text: 'Keep My Plan', style: 'cancel' },
          {
            text: 'Yes, Cancel It',
            style: 'destructive',
            onPress: () => {
              // Note: RevenueCat doesn't support direct cancellation
              // Users must cancel through App Store / Play Store
              Alert.alert(
                'Cancel Subscription',
                'To cancel your subscription, please go to your device Settings > Apple ID (iOS) or Google Play Store (Android) > Subscriptions and cancel from there.',
                [{ text: 'OK' }]
              );
            },
          },
        ]
      );
      return;
    }

    if (!isPurchasesConfigured()) {
      // Demo mode - allow tier override for testing
      Alert.alert(
        'Demo Mode',
        'RevenueCat is not configured yet. Would you like to simulate this subscription for testing?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Simulate',
            onPress: () => {
              setDeveloperTierOverride(tier);
              Alert.alert('Success', `Your account has been upgraded to ${tier.toUpperCase()} tier (demo mode).`, [
                { text: 'OK', onPress: onClose },
              ]);
            },
          },
        ]
      );
      return;
    }

    // Find the right package
    const productId =
      tier === SUBSCRIPTION_TIERS.PRO
        ? selectedPeriod === 'monthly'
          ? PRODUCT_IDS.PRO_MONTHLY
          : PRODUCT_IDS.PRO_YEARLY
        : selectedPeriod === 'monthly'
        ? PRODUCT_IDS.PRO_PLUS_MONTHLY
        : PRODUCT_IDS.PRO_PLUS_YEARLY;

    const packageToPurchase = offerings?.availablePackages?.find(
      (pkg) => pkg.product.identifier === productId
    );

    if (!packageToPurchase) {
      Alert.alert('Error', 'This subscription package is not available. Please try again later.');
      return;
    }

    setLoading(true);
    try {
      const result = await purchasePackage(packageToPurchase);

      if (result.success) {
        // Refresh subscription status
        const newTier = await getCurrentTierFromPurchases();

        Alert.alert('Success!', `Welcome to ${newTier.toUpperCase()}! You now have access to all premium features.`, [
          { text: 'Great!', onPress: onClose },
        ]);
      } else if (result.cancelled) {
        // User cancelled - do nothing
      } else {
        Alert.alert('Purchase Failed', result.error || 'Unable to complete purchase. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      if (!isPurchasesConfigured()) {
        Alert.alert('Demo Mode', 'RevenueCat is not configured. No purchases to restore.');
        return;
      }

      await restorePurchases();
      const newTier = await getCurrentTierFromPurchases();

      if (newTier !== SUBSCRIPTION_TIERS.FREE) {
        Alert.alert('Purchases Restored', `Your ${newTier.toUpperCase()} subscription has been restored!`, [
          { text: 'OK', onPress: onClose },
        ]);
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found for this account.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      const result = await startTrial();

      if (result.success) {
        Alert.alert(
          'Trial Started!',
          'Welcome to your 7-day free trial of Pro Plus! You now have access to all premium features including radar overlays, custom time selection, and more.',
          [{ text: 'Start Exploring', onPress: onClose }]
        );
      } else {
        Alert.alert('Unable to Start Trial', result.error || 'Please try again later.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start trial. Please try again.');
    } finally {
      setStartingTrial(false);
    }
  };

  const getPackageForTier = (tier) => {
    if (!offerings) return null;

    const productId =
      tier === SUBSCRIPTION_TIERS.PRO
        ? selectedPeriod === 'monthly'
          ? PRODUCT_IDS.PRO_MONTHLY
          : PRODUCT_IDS.PRO_YEARLY
        : selectedPeriod === 'monthly'
        ? PRODUCT_IDS.PRO_PLUS_MONTHLY
        : PRODUCT_IDS.PRO_PLUS_YEARLY;

    return offerings.availablePackages?.find((pkg) => pkg.product.identifier === productId);
  };

  const renderFeatureList = (features) => {
    return (
      <View style={styles.featureList}>
        {features.maxFrames && <Text style={styles.feature}>✓ Up to {features.maxFrames} animation frames</Text>}
        {features.allProducts && <Text style={styles.feature}>✓ All RGB products</Text>}
        {features.allChannels && <Text style={styles.feature}>✓ All 16 satellite channels</Text>}
        {features.localDomains && <Text style={styles.feature}>✓ Local domain views</Text>}
        {features.lightningOverlays && <Text style={styles.feature}>✓ Lightning detection overlays</Text>}
        {features.nwsOverlays && <Text style={styles.feature}>✓ NWS warnings & watches</Text>}
        {features.spcOverlays && <Text style={styles.feature}>✓ SPC convective outlooks</Text>}
        {features.radarOverlays && <Text style={styles.feature}>✓ Radar overlays (MRMS)</Text>}
        {features.highResImages && <Text style={styles.feature}>✓ High-resolution imagery</Text>}
        {features.inspectorMode && <Text style={styles.feature}>✓ Pixel inspector tool</Text>}
        {features.offlineCaching && <Text style={styles.feature}>✓ Offline caching</Text>}
        {features.autoRefresh && <Text style={styles.feature}>✓ Auto-refresh</Text>}
        {features.customTimeSelection && <Text style={styles.feature}>✓ Custom time selection</Text>}
        {features.adFree && <Text style={styles.feature}>✓ Ad-free experience</Text>}
        {features.showAds && <Text style={styles.featureDisabled}>✗ Contains ads</Text>}
      </View>
    );
  };

  const renderTierCard = (tier, tierData) => {
    const isCurrent = subscriptionTier === tier;
    const isFreeTier = tier === SUBSCRIPTION_TIERS.FREE;
    const purchasePackage = !isFreeTier ? getPackageForTier(tier) : null;

    // Get price from RevenueCat package or fallback to config
    const price = isFreeTier
      ? '$0'
      : purchasePackage
      ? purchasePackage.product.priceString
      : selectedPeriod === 'monthly'
      ? tierData.price
      : tierData.priceYearly;

    const periodText = isFreeTier ? 'forever' : selectedPeriod === 'monthly' ? '/month' : '/year';

    return (
      <TouchableOpacity
        key={tier}
        activeOpacity={loading || isCurrent ? 1 : 0.7}
        onPress={() => !loading && !isCurrent && handleSubscribe(tier)}
        disabled={loading || isCurrent}
      >
        <View style={[styles.tierCard, isCurrent && styles.tierCardCurrent]}>
          {isCurrent && <Text style={styles.currentBadge}>Current Plan</Text>}

          <Text style={styles.tierName}>{tierData.name}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.tierPrice}>{price}</Text>
            <Text style={styles.tierPeriod}>{periodText}</Text>
          </View>

          {!isFreeTier && selectedPeriod === 'yearly' && (
            <Text style={styles.savingsText}>Save 17% with yearly billing</Text>
          )}

          {renderFeatureList(tierData.features)}

          <View style={[styles.subscribeButton, isCurrent && styles.subscribeButtonCurrent, loading && styles.subscribeButtonDisabled]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.subscribeButtonText}>
                {isCurrent ? 'Current Plan' : isFreeTier ? 'Downgrade' : 'Subscribe'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Get trial status for display
  const trialStatus = getTrialStatus();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Trial Status Banner */}
      {trialActive && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerTitle}>🎉 Free Trial Active</Text>
          <Text style={styles.trialBannerText}>
            {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'day' : 'days'} remaining of Pro Plus features
          </Text>
        </View>
      )}

      {/* Free Trial Card - Show if conditions are met OR developer override is enabled */}
      {(showTrialCardOverride || (authEnabled && isAuthenticated && !trialActive && !trialUsed && subscriptionTier === SUBSCRIPTION_TIERS.FREE)) && (
        <View style={styles.trialCard}>
          <View style={styles.trialCardHeader}>
            <Text style={styles.trialCardTitle}>Try Pro Plus Free for 7 Days</Text>
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>LIMITED TIME</Text>
            </View>
          </View>
          <Text style={styles.trialCardDescription}>
            Get full access to all premium features including radar overlays, custom time selection, high-res imagery, and more. No credit card required!
          </Text>
          <TouchableOpacity
            style={[styles.trialButton, startingTrial && styles.trialButtonDisabled]}
            onPress={handleStartTrial}
            disabled={startingTrial || loading}
          >
            {startingTrial ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.trialButtonText}>Start Free Trial</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Create Account Prompt - Show if auth is enabled but user is not logged in (and not overridden) */}
      {!showTrialCardOverride && authEnabled && !isAuthenticated && !trialActive && subscriptionTier === SUBSCRIPTION_TIERS.FREE && (
        <View style={styles.trialCard}>
          <View style={styles.trialCardHeader}>
            <Text style={styles.trialCardTitle}>Start Your 7-Day Free Trial</Text>
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>NEW USER OFFER</Text>
            </View>
          </View>
          <Text style={styles.trialCardDescription}>
            Create a free account to unlock a 7-day trial of Pro Plus. Try all premium features including radar overlays, custom time selection, and more!
          </Text>
          <TouchableOpacity
            style={styles.trialButton}
            onPress={() => {
              Alert.alert(
                'Create Account',
                'To start your free trial, please create an account first. You can do this from the main menu.',
                [
                  { text: 'Maybe Later', style: 'cancel' },
                  { text: 'OK', onPress: onClose }
                ]
              );
            }}
          >
            <Text style={styles.trialButtonText}>Create Free Account</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Billing Period Toggle */}
      <View style={styles.periodToggle}>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'monthly' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('monthly')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'monthly' && styles.periodButtonTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'yearly' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('yearly')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'yearly' && styles.periodButtonTextActive]}>
            Yearly
          </Text>
          <Text style={styles.saveBadge}>SAVE 17%</Text>
        </TouchableOpacity>
      </View>

      {/* Tier Cards */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderTierCard(SUBSCRIPTION_TIERS.FREE, TIER_FEATURES[SUBSCRIPTION_TIERS.FREE])}
        {renderTierCard(SUBSCRIPTION_TIERS.PRO, TIER_FEATURES[SUBSCRIPTION_TIERS.PRO])}
        {renderTierCard(SUBSCRIPTION_TIERS.PRO_PLUS, TIER_FEATURES[SUBSCRIPTION_TIERS.PRO_PLUS])}

        {/* Restore Purchases */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          disabled={restoring || loading}
        >
          {restoring ? (
            <ActivityIndicator color="#4A90E2" />
          ) : (
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <Text style={styles.info}>
          All plans include access to real-time GOES satellite imagery.{'\n'}
          Subscriptions are billed through {__DEV__ ? 'your device\'s app store' : 'your device\'s app store'}. Cancel anytime.
        </Text>

        {!isPurchasesConfigured() && (
          <View style={styles.demoNotice}>
            <Text style={styles.demoNoticeTitle}>Development Mode</Text>
            <Text style={styles.demoNoticeText}>
              RevenueCat is not configured. Subscriptions will run in demo mode, allowing you to test tier functionality
              without actual payments.
            </Text>
          </View>
        )}

        {/* Developer Tools */}
        {isDevelopment && (
          <View style={styles.devTools}>
            <Text style={styles.devToolsTitle}>Developer Tools</Text>
            <TouchableOpacity
              style={styles.devToggle}
              onPress={() => setShowTrialCardOverride(!showTrialCardOverride)}
            >
              <View style={styles.devToggleContent}>
                <Text style={styles.devToggleLabel}>Show Free Trial Card</Text>
                <Text style={styles.devToggleSubtext}>Override visibility conditions for testing</Text>
              </View>
              <View style={[styles.devToggleSwitch, showTrialCardOverride && styles.devToggleSwitchActive]}>
                <Text style={styles.devToggleSwitchText}>{showTrialCardOverride ? 'ON' : 'OFF'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#999',
  },
  periodToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#4A90E2',
  },
  periodButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  saveBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#27ae60',
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  tierCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#333',
  },
  tierCardCurrent: {
    borderColor: '#4A90E2',
  },
  currentBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#4A90E2',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  tierPeriod: {
    fontSize: 16,
    color: '#999',
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 12,
    color: '#27ae60',
    marginBottom: 16,
    fontWeight: '600',
  },
  featureList: {
    marginBottom: 20,
  },
  feature: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 6,
    lineHeight: 20,
  },
  featureDisabled: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  subscribeButtonCurrent: {
    backgroundColor: '#333',
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  restoreButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  info: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  demoNotice: {
    backgroundColor: '#2d2d00',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#666600',
  },
  demoNoticeTitle: {
    color: '#ffcc00',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  demoNoticeText: {
    color: '#ccaa00',
    fontSize: 12,
    lineHeight: 18,
  },
  trialBanner: {
    backgroundColor: '#1a4d2e',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27ae60',
  },
  trialBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trialBannerText: {
    color: '#a8e6cf',
    fontSize: 14,
  },
  trialCard: {
    backgroundColor: '#2d1b69',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  trialCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trialCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  trialBadge: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  trialBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  trialCardDescription: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
    marginBottom: 16,
  },
  trialButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  trialButtonDisabled: {
    opacity: 0.7,
  },
  trialButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  devTools: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  devToolsTitle: {
    color: '#ffcc00',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  devToggleContent: {
    flex: 1,
    marginRight: 12,
  },
  devToggleLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  devToggleSubtext: {
    color: '#888',
    fontSize: 12,
  },
  devToggleSwitch: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  devToggleSwitchActive: {
    backgroundColor: '#4A90E2',
  },
  devToggleSwitchText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
