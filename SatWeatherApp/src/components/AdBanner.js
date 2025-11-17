/**
 * Ad Banner Component
 *
 * Placeholder banner ad for free tier users.
 * This will be replaced with actual ad SDK integration (AdMob, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function AdBanner({ style }) {
  const { shouldDisplayAds } = useAuth();
  const { setShowSubscriptionModal } = useApp();

  // Don't show if user has paid subscription
  if (!shouldDisplayAds()) {
    return null;
  }

  const handleUpgrade = () => {
    setShowSubscriptionModal(true);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adContent}>
        {/* Placeholder ad content */}
        <Text style={styles.adLabel}>ADVERTISEMENT</Text>
        <Text style={styles.adText}>
          Ad space placeholder - Integrate AdMob or similar SDK
        </Text>
      </View>
      <TouchableOpacity style={styles.removeButton} onPress={handleUpgrade}>
        <Text style={styles.removeText}>Remove Ads</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adContent: {
    flex: 1,
  },
  adLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  adText: {
    fontSize: 12,
    color: '#999',
  },
  removeButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 12,
  },
  removeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

/**
 * Usage:
 *
 * // In MainScreen.js or similar:
 * import AdBanner from '../components/AdBanner';
 *
 * return (
 *   <View style={{ flex: 1 }}>
 *     <YourMainContent />
 *     <AdBanner />
 *   </View>
 * );
 *
 * // The banner will only show for free tier users
 * // and will hide automatically for Pro/Pro Plus
 */

/**
 * Integration Guide:
 *
 * To integrate real ads (AdMob):
 *
 * 1. Install: expo install expo-ads-admob
 *
 * 2. Replace placeholder with:
 *    import { AdMobBanner } from 'expo-ads-admob';
 *
 *    <AdMobBanner
 *      bannerSize="smartBannerPortrait"
 *      adUnitID="ca-app-pub-xxxxx/yyyyy" // Your AdMob unit ID
 *      servePersonalizedAds={false}
 *    />
 *
 * 3. Configure ad unit IDs in app.json for iOS and Android
 *
 * 4. Test with test ad unit IDs before production
 */
