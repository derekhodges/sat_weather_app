import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_TIERS, getTierFeatures } from '../config/subscription';
import { resetTutorial } from './TutorialOverlay';
import { FeedbackModal } from './FeedbackModal';
import AboutScreen from '../screens/AboutScreen';

export const SettingsModal = ({ visible, onClose, onShowTutorial }) => {
  const {
    settings,
    updateSettings,
    setAsHome,
    selectedDomain,
    selectedRGBProduct,
    selectedChannel,
    viewMode,
    setShowSubscriptionModal,
  } = useApp();

  const {
    subscriptionTier,
    actualSubscriptionTier,
    devTierOverride,
    setDeveloperTierOverride,
    getAnimationMaxFrames,
    shouldDisplayAds,
  } = useAuth();

  const [localAnimationSpeed, setLocalAnimationSpeed] = useState(settings.animationSpeed.toString());
  const [localEndDwellDuration, setLocalEndDwellDuration] = useState((settings.endDwellDuration ?? 1500).toString());
  const [localFrameCount, setLocalFrameCount] = useState(settings.frameCount.toString());
  const [localFrameSkip, setLocalFrameSkip] = useState(settings.frameSkip.toString());
  const [showCustomFrameSkip, setShowCustomFrameSkip] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAboutScreen, setShowAboutScreen] = useState(false);

  // Developer tools - set to true to always show, false to hide in production
  // TODO: Set to false before releasing to production
  const SHOW_DEV_TOOLS = true; // Change to false for production release
  const isDevelopment = SHOW_DEV_TOOLS || process.env.EXPO_PUBLIC_APP_ENV === 'development';

  // Handle tier override for testing
  const handleTierOverride = async (tier) => {
    const success = await setDeveloperTierOverride(tier);
    if (success) {
      Alert.alert('Tier Changed', `Subscription tier set to: ${tier || 'Default'}`);
    } else {
      Alert.alert('Error', 'Failed to change tier');
    }
  };

  const clearTierOverride = async () => {
    const success = await setDeveloperTierOverride(null);
    if (success) {
      Alert.alert('Tier Reset', 'Subscription tier reset to actual value');
    }
  };

  const handleAnimationSpeedChange = (value) => {
    setLocalAnimationSpeed(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 100 && numValue <= 2000) {
      updateSettings({ animationSpeed: numValue });
    }
  };

  const handleEndDwellDurationChange = (value) => {
    setLocalEndDwellDuration(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10000) {
      updateSettings({ endDwellDuration: numValue });
    }
  };

  const handleFrameCountChange = (value) => {
    setLocalFrameCount(value);
    const numValue = parseInt(value);
    const maxAllowed = getAnimationMaxFrames();
    if (!isNaN(numValue) && numValue >= 5 && numValue <= maxAllowed) {
      updateSettings({ frameCount: numValue });
    } else if (!isNaN(numValue) && numValue > maxAllowed) {
      // Silently cap to max allowed
      setLocalFrameCount(maxAllowed.toString());
      updateSettings({ frameCount: maxAllowed });
      Alert.alert(
        'Frame Limit',
        `Your current plan allows up to ${maxAllowed} frames. Upgrade to increase this limit.`
      );
    }
  };

  const handleFrameSkipChange = (value) => {
    setLocalFrameSkip(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 12) {
      updateSettings({ frameSkip: numValue });
    }
  };

  const handleFrameSkipPreset = (skip) => {
    updateSettings({ frameSkip: skip });
    setLocalFrameSkip(skip.toString());
    setShowCustomFrameSkip(false);
  };

  const handleCustomFrameSkipToggle = () => {
    setShowCustomFrameSkip(true);
  };

  const handleSetHome = async () => {
    const success = await setAsHome();
    if (success) {
      setShowHomeConfirm(true);
      setTimeout(() => setShowHomeConfirm(false), 2000);
    }
  };

  // Generate current view name
  const getCurrentViewName = () => {
    const domainName = selectedDomain?.name || 'Unknown';
    let productName = 'Unknown';

    if (viewMode === 'rgb' && selectedRGBProduct) {
      productName = selectedRGBProduct.name;
    } else if (viewMode === 'channel' && selectedChannel) {
      productName = `Channel ${selectedChannel.number}`;
    }

    return `${productName} - ${domainName}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {/* Animation Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Animation</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Animation Speed (ms per frame)</Text>
                <Text style={styles.settingDescription}>
                  Lower = faster animation (100-2000ms)
                </Text>
              </View>
              <TextInput
                style={styles.settingInput}
                value={localAnimationSpeed}
                onChangeText={handleAnimationSpeedChange}
                keyboardType="numeric"
                placeholder="500"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>End Dwell Duration (ms)</Text>
                <Text style={styles.settingDescription}>
                  Pause on newest frame before loop (0-10000ms)
                </Text>
              </View>
              <TextInput
                style={styles.settingInput}
                value={localEndDwellDuration}
                onChangeText={handleEndDwellDurationChange}
                keyboardType="numeric"
                placeholder="1500"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Number of Frames</Text>
                <Text style={styles.settingDescription}>
                  Frames to load for animation (5-{getAnimationMaxFrames()} max for your plan)
                </Text>
              </View>
              <TextInput
                style={styles.settingInput}
                value={localFrameCount}
                onChangeText={handleFrameCountChange}
                keyboardType="numeric"
                placeholder="12"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Frame Skip</Text>
                <Text style={styles.settingDescription}>
                  Skip frames for longer time periods (0-12)
                </Text>
              </View>
              <View style={styles.frameSkipButtons}>
                {[0, 1, 2, 5, 10].map((skip) => (
                  <TouchableOpacity
                    key={skip}
                    style={[
                      styles.frameSkipButton,
                      settings.frameSkip === skip && !showCustomFrameSkip && styles.frameSkipButtonActive
                    ]}
                    onPress={() => handleFrameSkipPreset(skip)}
                  >
                    <Text
                      style={[
                        styles.frameSkipButtonText,
                        settings.frameSkip === skip && !showCustomFrameSkip && styles.frameSkipButtonTextActive
                      ]}
                    >
                      {skip === 0 ? 'None' : skip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[
                  styles.frameSkipCustomButton,
                  showCustomFrameSkip && styles.frameSkipButtonActive
                ]}
                onPress={handleCustomFrameSkipToggle}
              >
                <Text
                  style={[
                    styles.frameSkipButtonText,
                    showCustomFrameSkip && styles.frameSkipButtonTextActive
                  ]}
                >
                  Custom
                </Text>
              </TouchableOpacity>
              {showCustomFrameSkip && (
                <TextInput
                  style={[styles.settingInput, { marginTop: 12 }]}
                  value={localFrameSkip}
                  onChangeText={handleFrameSkipChange}
                  keyboardType="numeric"
                  placeholder="0-12"
                  placeholderTextColor="#666"
                />
              )}
            </View>
          </View>

          {/* Display Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Display</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Time Display</Text>
                <Text style={styles.settingDescription}>
                  Show times in UTC or local timezone
                </Text>
              </View>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    !settings.useLocalTime && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSettings({ useLocalTime: false })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      !settings.useLocalTime && styles.segmentButtonTextActive
                    ]}
                  >
                    UTC
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings.useLocalTime && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSettings({ useLocalTime: true })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      settings.useLocalTime && styles.segmentButtonTextActive
                    ]}
                  >
                    Local
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Image Display Mode</Text>
                <Text style={styles.settingDescription}>
                  Contain: Entire image visible | Cover: Full image, pan to explore
                </Text>
              </View>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings.imageDisplayMode === 'contain' && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSettings({ imageDisplayMode: 'contain' })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      settings.imageDisplayMode === 'contain' && styles.segmentButtonTextActive
                    ]}
                  >
                    Contain
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings.imageDisplayMode === 'cover' && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSettings({ imageDisplayMode: 'cover' })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      settings.imageDisplayMode === 'cover' && styles.segmentButtonTextActive
                    ]}
                  >
                    Cover
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show Color Scale</Text>
                <Text style={styles.settingDescription}>
                  Display color scale bar in portrait mode
                </Text>
              </View>
              <Switch
                value={settings.showColorScale}
                onValueChange={(value) => updateSettings({ showColorScale: value })}
                trackColor={{ false: '#666', true: '#2196F3' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Channel Display Mode</Text>
                <Text style={styles.settingDescription}>
                  List: Detailed info | Grid: Quick 4x4 number grid
                </Text>
              </View>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings.channelDisplayMode === 'list' && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSettings({ channelDisplayMode: 'list' })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      settings.channelDisplayMode === 'list' && styles.segmentButtonTextActive
                    ]}
                  >
                    List
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings.channelDisplayMode === 'grid' && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSettings({ channelDisplayMode: 'grid' })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      settings.channelDisplayMode === 'grid' && styles.segmentButtonTextActive
                    ]}
                  >
                    Grid
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Home View Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Default View</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Set Current View as Home</Text>
                <Text style={styles.settingDescription}>
                  Click this to set the current domain and map as default. The app will launch with this view instead of Oklahoma Geocolor.
                </Text>
                <Text style={[styles.settingDescription, { marginTop: 8, fontWeight: '600', color: '#2196F3' }]}>
                  Current view: {getCurrentViewName()}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.setHomeButton, showHomeConfirm && styles.setHomeButtonConfirm]}
                onPress={handleSetHome}
              >
                <Text style={styles.setHomeButtonText}>
                  {showHomeConfirm ? '✓ Set as Home' : 'Set as Home'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Auto-Refresh Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Auto-Refresh</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Auto-Refresh</Text>
                <Text style={styles.settingDescription}>
                  Automatically refresh latest image
                </Text>
              </View>
              <Switch
                value={settings.autoRefresh}
                onValueChange={(value) => updateSettings({ autoRefresh: value })}
                trackColor={{ false: '#666', true: '#2196F3' }}
                thumbColor="#fff"
              />
            </View>

            {settings.autoRefresh && (
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Refresh Interval (minutes)</Text>
                  <Text style={styles.settingDescription}>
                    How often to refresh (1-60 min)
                  </Text>
                </View>
                <View style={styles.intervalButtons}>
                  {[1, 5, 10, 15, 30].map((interval) => (
                    <TouchableOpacity
                      key={interval}
                      style={[
                        styles.intervalButton,
                        settings.autoRefreshInterval === interval && styles.intervalButtonActive
                      ]}
                      onPress={() => updateSettings({ autoRefreshInterval: interval })}
                    >
                      <Text
                        style={[
                          styles.intervalButtonText,
                          settings.autoRefreshInterval === interval && styles.intervalButtonTextActive
                        ]}
                      >
                        {interval}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Subscription Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Subscription</Text>

            {/* Current Status */}
            <View style={styles.currentStatusBox}>
              <Text style={styles.currentStatusLabel}>Current Plan:</Text>
              <Text style={styles.currentStatusValue}>
                {getTierFeatures(subscriptionTier).name}
                {devTierOverride && ' (Override)'}
              </Text>
              {devTierOverride && (
                <Text style={styles.currentStatusNote}>
                  Actual plan: {getTierFeatures(actualSubscriptionTier).name}
                </Text>
              )}
            </View>

            {/* Manage Subscription Button */}
            <TouchableOpacity
              style={styles.manageSubscriptionButton}
              onPress={() => {
                onClose(); // Close settings modal first
                setTimeout(() => setShowSubscriptionModal(true), 300); // Then open subscription modal
              }}
            >
              <Text style={styles.manageSubscriptionButtonText}>
                {subscriptionTier === SUBSCRIPTION_TIERS.FREE ? 'Upgrade Your Plan' : 'Manage Subscription'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#4A90E2" />
            </TouchableOpacity>

            {/* Free Tier */}
            <TouchableOpacity
              style={[
                styles.subscriptionTier,
                subscriptionTier === SUBSCRIPTION_TIERS.FREE && styles.subscriptionTierActive
              ]}
            >
              <View style={styles.subscriptionTierHeader}>
                <Text style={styles.subscriptionTierName}>Free</Text>
                <Text style={styles.subscriptionTierPrice}>$0</Text>
              </View>
              <View style={styles.subscriptionFeatures}>
                <Text style={styles.subscriptionFeature}>✓ Geocolor RGB product</Text>
                <Text style={styles.subscriptionFeature}>✓ Channel 13 (Clean IR)</Text>
                <Text style={styles.subscriptionFeature}>✓ Basic animation (6 frames)</Text>
                <Text style={styles.subscriptionFeature}>✓ Map overlays (states, counties)</Text>
                <Text style={styles.subscriptionFeature}>✓ Drawing & sharing tools</Text>
                <Text style={styles.subscriptionFeature}>• Contains ads</Text>
              </View>
              {subscriptionTier === SUBSCRIPTION_TIERS.FREE && (
                <View style={styles.subscriptionBadge}>
                  <Text style={styles.subscriptionBadgeText}>CURRENT</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Pro Subscription */}
            <TouchableOpacity
              style={[
                styles.subscriptionTier,
                subscriptionTier === SUBSCRIPTION_TIERS.PRO && styles.subscriptionTierActive
              ]}
            >
              <View style={styles.subscriptionTierHeader}>
                <Text style={styles.subscriptionTierName}>Pro</Text>
                <Text style={styles.subscriptionTierPrice}>$1.99/mo or $20/yr</Text>
              </View>
              <View style={styles.subscriptionFeatures}>
                <Text style={styles.subscriptionFeature}>✓ All RGB products</Text>
                <Text style={styles.subscriptionFeature}>✓ All 16 channels</Text>
                <Text style={styles.subscriptionFeature}>✓ Extended animation (24 frames)</Text>
                <Text style={styles.subscriptionFeature}>✓ Lightning overlays (GLM)</Text>
                <Text style={styles.subscriptionFeature}>✓ NWS warnings & watches</Text>
                <Text style={styles.subscriptionFeature}>✓ Ad-free experience</Text>
              </View>
              {subscriptionTier === SUBSCRIPTION_TIERS.PRO ? (
                <View style={styles.subscriptionBadge}>
                  <Text style={styles.subscriptionBadgeText}>CURRENT</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.subscriptionButton}
                  onPress={() => {
                    onClose(); // Close settings modal
                    setTimeout(() => setShowSubscriptionModal(true), 300); // Open subscription modal
                  }}
                >
                  <Text style={styles.subscriptionButtonText}>Upgrade to Pro</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Pro Plus Subscription */}
            <TouchableOpacity
              style={[
                styles.subscriptionTier,
                subscriptionTier === SUBSCRIPTION_TIERS.PRO_PLUS && styles.subscriptionTierActive
              ]}
            >
              <View style={styles.subscriptionTierHeader}>
                <Text style={styles.subscriptionTierName}>Pro Plus</Text>
                <Text style={styles.subscriptionTierPrice}>$4.99/mo or $50/yr</Text>
              </View>
              <View style={styles.subscriptionFeatures}>
                <Text style={styles.subscriptionFeature}>✓ Everything in Pro</Text>
                <Text style={styles.subscriptionFeature}>✓ Extended animation (36 frames)</Text>
                <Text style={styles.subscriptionFeature}>✓ Radar overlays (MRMS)</Text>
                <Text style={styles.subscriptionFeature}>✓ SPC overlays (convective, tornado)</Text>
                <Text style={styles.subscriptionFeature}>✓ Custom time selection</Text>
                <Text style={styles.subscriptionFeature}>✓ Priority support</Text>
              </View>
              {subscriptionTier === SUBSCRIPTION_TIERS.PRO_PLUS ? (
                <View style={styles.subscriptionBadge}>
                  <Text style={styles.subscriptionBadgeText}>CURRENT</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.subscriptionButton}
                  onPress={() => {
                    onClose(); // Close settings modal
                    setTimeout(() => setShowSubscriptionModal(true), 300); // Open subscription modal
                  }}
                >
                  <Text style={styles.subscriptionButtonText}>Upgrade to Pro Plus</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          {/* Help & Support Section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Help & Support</Text>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  if (onShowTutorial) {
                    onShowTutorial();
                  }
                }, 300);
              }}
            >
              <View style={styles.helpButtonContent}>
                <Ionicons name="school-outline" size={24} color="#4A90E2" />
                <View style={styles.helpButtonText}>
                  <Text style={styles.helpButtonTitle}>View Tutorial</Text>
                  <Text style={styles.helpButtonDescription}>Learn how to use the app</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={async () => {
                await resetTutorial();
                Alert.alert(
                  'Tutorial Reset',
                  'The tutorial will show again next time you open the app.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <View style={styles.helpButtonContent}>
                <Ionicons name="refresh-outline" size={24} color="#27ae60" />
                <View style={styles.helpButtonText}>
                  <Text style={styles.helpButtonTitle}>Reset Tutorial</Text>
                  <Text style={styles.helpButtonDescription}>Show tutorial on next launch</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => setShowFeedbackModal(true)}
            >
              <View style={styles.helpButtonContent}>
                <Ionicons name="chatbubble-outline" size={24} color="#FF9500" />
                <View style={styles.helpButtonText}>
                  <Text style={styles.helpButtonTitle}>Send Feedback</Text>
                  <Text style={styles.helpButtonDescription}>Report bugs or suggest features</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => setShowAboutScreen(true)}
            >
              <View style={styles.helpButtonContent}>
                <Ionicons name="information-circle-outline" size={24} color="#9b59b6" />
                <View style={styles.helpButtonText}>
                  <Text style={styles.helpButtonTitle}>About This App</Text>
                  <Text style={styles.helpButtonDescription}>Version, credits, and changelog</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Developer Tools - For Testing Only */}
          {isDevelopment && (
            <View style={styles.settingsSection}>
              <TouchableOpacity
                style={styles.devToolsHeader}
                onPress={() => setShowDevTools(!showDevTools)}
              >
                <Text style={styles.settingsSectionTitle}>Developer Tools</Text>
                <Ionicons
                  name={showDevTools ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#FF6B6B"
                />
              </TouchableOpacity>

              {showDevTools && (
                <View>
                  <Text style={styles.devWarning}>
                    ⚠️ These tools are for testing only and will be hidden in production.
                  </Text>

                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Override Subscription Tier</Text>
                      <Text style={styles.settingDescription}>
                        Test features for different subscription levels
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tierButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.tierButton,
                        subscriptionTier === SUBSCRIPTION_TIERS.FREE && styles.tierButtonActive
                      ]}
                      onPress={() => handleTierOverride(SUBSCRIPTION_TIERS.FREE)}
                    >
                      <Text style={[
                        styles.tierButtonText,
                        subscriptionTier === SUBSCRIPTION_TIERS.FREE && styles.tierButtonTextActive
                      ]}>
                        Free
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.tierButton,
                        subscriptionTier === SUBSCRIPTION_TIERS.PRO && styles.tierButtonActive
                      ]}
                      onPress={() => handleTierOverride(SUBSCRIPTION_TIERS.PRO)}
                    >
                      <Text style={[
                        styles.tierButtonText,
                        subscriptionTier === SUBSCRIPTION_TIERS.PRO && styles.tierButtonTextActive
                      ]}>
                        Pro
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.tierButton,
                        subscriptionTier === SUBSCRIPTION_TIERS.PRO_PLUS && styles.tierButtonActive
                      ]}
                      onPress={() => handleTierOverride(SUBSCRIPTION_TIERS.PRO_PLUS)}
                    >
                      <Text style={[
                        styles.tierButtonText,
                        subscriptionTier === SUBSCRIPTION_TIERS.PRO_PLUS && styles.tierButtonTextActive
                      ]}>
                        Pro Plus
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {devTierOverride && (
                    <TouchableOpacity
                      style={styles.clearOverrideButton}
                      onPress={clearTierOverride}
                    >
                      <Text style={styles.clearOverrideText}>Clear Override</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.devInfoBox}>
                    <Text style={styles.devInfoText}>
                      Max frames: {getAnimationMaxFrames()}{'\n'}
                      Show ads: {shouldDisplayAds() ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Feedback Modal */}
      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* About Screen */}
      {showAboutScreen && (
        <Modal
          visible={showAboutScreen}
          animationType="slide"
          onRequestClose={() => setShowAboutScreen(false)}
        >
          <AboutScreen onClose={() => setShowAboutScreen(false)} />
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    height: 60,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  settingsSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingsSectionTitle: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  settingRow: {
    marginBottom: 20,
  },
  settingInfo: {
    marginBottom: 8,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: '#999',
    fontSize: 12,
    lineHeight: 16,
  },
  settingInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#2196F3',
  },
  segmentButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  intervalButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  intervalButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  intervalButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  intervalButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  intervalButtonTextActive: {
    color: '#fff',
  },
  frameSkipButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  frameSkipButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 50,
    alignItems: 'center',
  },
  frameSkipButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  frameSkipButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  frameSkipButtonTextActive: {
    color: '#fff',
  },
  frameSkipCustomButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    marginTop: 8,
  },
  currentStatusBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  currentStatusLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  currentStatusValue: {
    color: '#2196F3',
    fontSize: 18,
    fontWeight: 'bold',
  },
  currentStatusNote: {
    color: '#FF6B6B',
    fontSize: 12,
  },
  manageSubscriptionButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  manageSubscriptionButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
  helpButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333',
  },
  helpButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  helpButtonText: {
    marginLeft: 12,
  },
  helpButtonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  helpButtonDescription: {
    color: '#999',
    fontSize: 12,
  },
  subscriptionTier: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  subscriptionTierActive: {
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  subscriptionTierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTierName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subscriptionTierPrice: {
    color: '#2196F3',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subscriptionFeatures: {
    marginBottom: 16,
  },
  subscriptionFeature: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  subscriptionBadge: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
  },
  subscriptionBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  subscriptionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  subscriptionButtonInactive: {
    backgroundColor: '#333',
  },
  subscriptionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  devToolsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  devWarning: {
    color: '#FF6B6B',
    fontSize: 12,
    marginBottom: 16,
    padding: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 6,
  },
  tierButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tierButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  tierButtonActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  tierButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  tierButtonTextActive: {
    color: '#fff',
  },
  clearOverrideButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  clearOverrideText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  devInfoBox: {
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  devInfoText: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  setHomeButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  setHomeButtonConfirm: {
    backgroundColor: '#4CAF50',
  },
  setHomeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
