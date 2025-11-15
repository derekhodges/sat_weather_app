/**
 * Authentication Context
 *
 * Manages user authentication state and subscription status.
 * Gracefully handles disabled auth mode for testing.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase, isAuthEnabled } from '../config/supabase';
import { SUBSCRIPTION_TIERS, isFeatureEnabled } from '../config/subscription';

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

  // Check if auth is actually enabled
  const authEnabled = isAuthEnabled();

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
    return isFeatureEnabled(subscriptionTier, featureName);
  };

  /**
   * Show upgrade prompt for premium features
   */
  const showUpgradePrompt = (featureName) => {
    Alert.alert(
      'Premium Feature',
      `${featureName} is available with a Premium subscription. Upgrade now to unlock this feature!`,
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
    subscriptionTier,
    subscriptionStatus,
    isAuthenticated: !!user,
    authEnabled,

    // Actions
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    hasFeatureAccess,
    showUpgradePrompt,
    refreshSubscription: () => user && loadSubscriptionStatus(user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
