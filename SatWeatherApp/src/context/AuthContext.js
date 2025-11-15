/**
 * Authentication Context
 *
 * Manages user authentication state and subscription status.
 * Gracefully handles disabled auth mode for testing.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isAuthEnabled } from '../config/supabase';
import {
  SUBSCRIPTION_TIERS,
  isFeatureEnabled,
  isProductAllowed,
  isChannelAllowed,
  isOverlayAllowed,
  getMaxFrames,
  shouldShowAds,
  getTierFeatures,
} from '../config/subscription';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // User state
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subscription state
  const [subscriptionTier, setSubscriptionTier] = useState(SUBSCRIPTION_TIERS.FREE);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null); // null, 'active', 'cancelled', 'expired'

  // Developer testing mode - override subscription tier for testing
  const [devTierOverride, setDevTierOverride] = useState(null);

  // Check if auth is actually enabled
  const authEnabled = isAuthEnabled();

  // Get effective tier (respects override for testing)
  const effectiveTier = devTierOverride || subscriptionTier;

  // Load dev tier override from storage
  useEffect(() => {
    const loadDevOverride = async () => {
      try {
        const savedOverride = await AsyncStorage.getItem('devTierOverride');
        if (savedOverride) {
          setDevTierOverride(savedOverride);
          console.log('Loaded dev tier override:', savedOverride);
        }
      } catch (error) {
        console.error('Error loading dev tier override:', error);
      }
    };
    loadDevOverride();
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!authEnabled) {
      console.log('Auth disabled - running in guest mode');
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadSubscriptionStatus(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadSubscriptionStatus(session.user.id);
      } else {
        setSubscriptionTier(SUBSCRIPTION_TIERS.FREE);
        setSubscriptionStatus(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [authEnabled]);

  /**
   * Load user's subscription status from database
   */
  const loadSubscriptionStatus = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, status, expires_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setSubscriptionTier(data.tier);
        setSubscriptionStatus(data.status);

        // Check if subscription is expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setSubscriptionTier(SUBSCRIPTION_TIERS.FREE);
          setSubscriptionStatus('expired');
        }
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Default to free tier on error
      setSubscriptionTier(SUBSCRIPTION_TIERS.FREE);
    }
  };

  /**
   * Sign up new user
   */
  const signUp = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign in existing user
   */
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign out current user
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Reset subscription state
      setSubscriptionTier(SUBSCRIPTION_TIERS.FREE);
      setSubscriptionStatus(null);

      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Update user profile
   */
  const updateProfile = async (updates) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: updates,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Check if user has access to a feature
   */
  const hasFeatureAccess = (featureName) => {
    return isFeatureEnabled(effectiveTier, featureName);
  };

  /**
   * Check if user can access a specific product
   */
  const canAccessProduct = (productId) => {
    return isProductAllowed(effectiveTier, productId);
  };

  /**
   * Check if user can access a specific channel
   */
  const canAccessChannel = (channelNumber) => {
    return isChannelAllowed(effectiveTier, channelNumber);
  };

  /**
   * Check if user can access a specific overlay type
   */
  const canAccessOverlay = (overlayType) => {
    return isOverlayAllowed(effectiveTier, overlayType);
  };

  /**
   * Get maximum frames allowed for animation
   */
  const getAnimationMaxFrames = () => {
    return getMaxFrames(effectiveTier);
  };

  /**
   * Check if ads should be displayed
   */
  const shouldDisplayAds = () => {
    return shouldShowAds(effectiveTier);
  };

  /**
   * Get current tier features
   */
  const getCurrentTierFeatures = () => {
    return getTierFeatures(effectiveTier);
  };

  /**
   * Set developer tier override (for testing)
   * Pass null to clear override
   */
  const setDeveloperTierOverride = async (tier) => {
    try {
      if (tier === null) {
        await AsyncStorage.removeItem('devTierOverride');
        setDevTierOverride(null);
        console.log('Cleared dev tier override');
      } else {
        await AsyncStorage.setItem('devTierOverride', tier);
        setDevTierOverride(tier);
        console.log('Set dev tier override:', tier);
      }
      return true;
    } catch (error) {
      console.error('Error setting dev tier override:', error);
      return false;
    }
  };

  /**
   * Show upgrade prompt for premium features
   */
  const showUpgradePrompt = (featureName) => {
    const tierName = effectiveTier === SUBSCRIPTION_TIERS.FREE ? 'Pro' : 'Pro Plus';
    Alert.alert(
      'Upgrade Required',
      `${featureName} is available with a ${tierName} subscription. Upgrade now to unlock this feature!`,
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => console.log('TODO: Navigate to subscription screen') },
      ]
    );
  };

  const value = {
    // State
    user,
    session,
    loading,
    subscriptionTier: effectiveTier, // Use effective tier
    actualSubscriptionTier: subscriptionTier, // Original tier (for display)
    subscriptionStatus,
    isAuthenticated: !!user,
    authEnabled,
    devTierOverride,

    // Actions
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    hasFeatureAccess,
    canAccessProduct,
    canAccessChannel,
    canAccessOverlay,
    getAnimationMaxFrames,
    shouldDisplayAds,
    getCurrentTierFeatures,
    setDeveloperTierOverride,
    showUpgradePrompt,
    refreshSubscription: () => user && loadSubscriptionStatus(user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
