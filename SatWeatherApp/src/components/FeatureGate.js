/**
 * Feature Gate Component
 *
 * Wrapper component that shows upgrade prompt if user doesn't have access to a feature.
 * Use this to wrap premium features in your components.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function FeatureGate({
  feature,
  featureName,
  children,
  fallback = null,
  showPrompt = true,
}) {
  const { hasFeatureAccess, showUpgradePrompt } = useAuth();

  // Check if user has access to this feature
  const hasAccess = hasFeatureAccess(feature);

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If fallback is provided, show it
  if (fallback) {
    return <>{fallback}</>;
  }

  // If showPrompt is true, show upgrade prompt
  if (showPrompt) {
    return (
      <View style={styles.container}>
        <View style={styles.lockIcon}>
          <Text style={styles.lockText}>🔒</Text>
        </View>
        <Text style={styles.title}>Premium Feature</Text>
        <Text style={styles.message}>
          {featureName || feature} requires a Premium subscription
        </Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => showUpgradePrompt(featureName || feature)}
        >
          <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Otherwise, don't render anything
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  lockIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockText: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

/**
 * Usage examples:
 *
 * // Example 1: Wrap a component
 * <FeatureGate feature="inspectorMode" featureName="Pixel Inspector">
 *   <InspectorTool />
 * </FeatureGate>
 *
 * // Example 2: Use with fallback
 * <FeatureGate
 *   feature="highResImages"
 *   featureName="High Resolution"
 *   fallback={<LowResImage />}
 * >
 *   <HighResImage />
 * </FeatureGate>
 *
 * // Example 3: Check manually
 * const { hasFeatureAccess, showUpgradePrompt } = useAuth();
 * const handleClick = () => {
 *   if (!hasFeatureAccess('overlaysEnabled')) {
 *     showUpgradePrompt('Weather Overlays');
 *     return;
 *   }
 *   // Continue with feature
 * };
 */
