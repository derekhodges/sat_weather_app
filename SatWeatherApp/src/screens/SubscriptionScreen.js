/**
 * Subscription Management Screen
 *
 * Displays available subscription tiers and handles upgrades.
 * Integrates with Stripe for payment processing.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_TIERS, TIER_FEATURES } from '../config/subscription';

export default function SubscriptionScreen({ onClose }) {
  const { subscriptionTier, user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState(subscriptionTier);

  const handleSubscribe = async (tier) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to subscribe to a plan.');
      return;
    }

    if (tier === SUBSCRIPTION_TIERS.FREE) {
      // Downgrade or cancel
      Alert.alert(
        'Cancel Subscription',
        'Are you sure you want to cancel your subscription? You will lose access to premium features.',
        [
          { text: 'Keep Subscription', style: 'cancel' },
          {
            text: 'Cancel',
            style: 'destructive',
            onPress: () => console.log('TODO: Cancel subscription via Stripe'),
          },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      // TODO: Integrate with Stripe
      console.log('TODO: Create Stripe checkout session for tier:', tier);
      Alert.alert(
        'Coming Soon',
        'Subscription payments will be available soon via Stripe. Stay tuned!'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFeatureList = (features) => {
    return (
      <View style={styles.featureList}>
        {features.maxFavorites && (
          <Text style={styles.feature}>✓ {features.maxFavorites} saved favorites</Text>
        )}
        {features.maxFrames && (
          <Text style={styles.feature}>✓ {features.maxFrames} animation frames</Text>
        )}
        {features.advancedProducts && (
          <Text style={styles.feature}>✓ All RGB products</Text>
        )}
        {features.allChannels && (
          <Text style={styles.feature}>✓ All 16 satellite channels</Text>
        )}
        {features.overlaysEnabled && (
          <Text style={styles.feature}>✓ Radar & weather overlays</Text>
        )}
        {features.highResImages && (
          <Text style={styles.feature}>✓ High-resolution imagery</Text>
        )}
        {features.inspectorMode && (
          <Text style={styles.feature}>✓ Pixel inspector tool</Text>
        )}
        {features.offlineCaching && (
          <Text style={styles.feature}>✓ Offline caching</Text>
        )}
        {features.customTimeSelection && (
          <Text style={styles.feature}>✓ Custom time selection</Text>
        )}
        {features.multipleLocations && (
          <Text style={styles.feature}>✓ Multiple saved locations</Text>
        )}
        {features.pushNotifications && (
          <Text style={styles.feature}>✓ Weather alerts</Text>
        )}
        {features.adFree && (
          <Text style={styles.feature}>✓ Ad-free experience</Text>
        )}
      </View>
    );
  };

  const renderTierCard = (tier, tierData) => {
    const isCurrent = subscriptionTier === tier;
    const isSelected = selectedTier === tier;

    return (
      <View
        key={tier}
        style={[
          styles.tierCard,
          isCurrent && styles.tierCardCurrent,
          isSelected && styles.tierCardSelected,
        ]}
      >
        {isCurrent && <Text style={styles.currentBadge}>Current Plan</Text>}

        <Text style={styles.tierName}>{tierData.name}</Text>
        <Text style={styles.tierPrice}>{tierData.price}</Text>
        {tierData.priceYearly && (
          <Text style={styles.tierPriceYearly}>or {tierData.priceYearly}</Text>
        )}

        {renderFeatureList(tierData.features)}

        <TouchableOpacity
          style={[
            styles.subscribeButton,
            isCurrent && styles.subscribeButtonCurrent,
          ]}
          onPress={() => handleSubscribe(tier)}
          disabled={loading || isCurrent}
        >
          {loading && selectedTier === tier ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeButtonText}>
              {isCurrent ? 'Current Plan' : tier === SUBSCRIPTION_TIERS.FREE ? 'Downgrade' : 'Subscribe'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tier Cards */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderTierCard(SUBSCRIPTION_TIERS.FREE, TIER_FEATURES[SUBSCRIPTION_TIERS.FREE])}
        {renderTierCard(SUBSCRIPTION_TIERS.PREMIUM, TIER_FEATURES[SUBSCRIPTION_TIERS.PREMIUM])}
        {renderTierCard(SUBSCRIPTION_TIERS.PREMIUM_PLUS, TIER_FEATURES[SUBSCRIPTION_TIERS.PREMIUM_PLUS])}

        {/* Info */}
        <Text style={styles.info}>
          All plans include access to real-time GOES satellite imagery.{'\n'}
          Subscriptions are billed monthly or yearly. Cancel anytime.
        </Text>
      </ScrollView>
    </View>
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
  tierCardSelected: {
    borderColor: '#5BA3F5',
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
  tierPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  tierPriceYearly: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  featureList: {
    marginBottom: 20,
  },
  feature: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
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
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 20,
    lineHeight: 18,
  },
});
