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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export const SettingsModal = ({ visible, onClose }) => {
  const { settings, updateSettings } = useApp();
  const [localAnimationSpeed, setLocalAnimationSpeed] = useState(settings.animationSpeed.toString());
  const [localFrameCount, setLocalFrameCount] = useState(settings.frameCount.toString());
  const [localFrameSkip, setLocalFrameSkip] = useState(settings.frameSkip.toString());
  const [showCustomFrameSkip, setShowCustomFrameSkip] = useState(false);

  const handleAnimationSpeedChange = (value) => {
    setLocalAnimationSpeed(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 100 && numValue <= 2000) {
      updateSettings({ animationSpeed: numValue });
    }
  };

  const handleFrameCountChange = (value) => {
    setLocalFrameCount(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 5 && numValue <= 50) {
      updateSettings({ frameCount: numValue });
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
                <Text style={styles.settingLabel}>Number of Frames</Text>
                <Text style={styles.settingDescription}>
                  Frames to load for animation (5-50)
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

            {/* Free Tier */}
            <TouchableOpacity style={styles.subscriptionTier}>
              <View style={styles.subscriptionTierHeader}>
                <Text style={styles.subscriptionTierName}>Free</Text>
                <Text style={styles.subscriptionTierPrice}>$0</Text>
              </View>
              <View style={styles.subscriptionFeatures}>
                <Text style={styles.subscriptionFeature}>✓ Geocolor RGB product</Text>
                <Text style={styles.subscriptionFeature}>✓ Channel 13 (Clean IR)</Text>
                <Text style={styles.subscriptionFeature}>✓ Basic animation (6 frames)</Text>
                <Text style={styles.subscriptionFeature}>✓ All domains</Text>
              </View>
              <View style={styles.subscriptionBadge}>
                <Text style={styles.subscriptionBadgeText}>CURRENT</Text>
              </View>
            </TouchableOpacity>

            {/* Pro Subscription */}
            <TouchableOpacity style={styles.subscriptionTier}>
              <View style={styles.subscriptionTierHeader}>
                <Text style={styles.subscriptionTierName}>Pro</Text>
                <Text style={styles.subscriptionTierPrice}>$0.99/mo or $10/year</Text>
              </View>
              <View style={styles.subscriptionFeatures}>
                <Text style={styles.subscriptionFeature}>✓ All RGB products</Text>
                <Text style={styles.subscriptionFeature}>✓ All 16 channels</Text>
                <Text style={styles.subscriptionFeature}>✓ Extended animation (24 frames)</Text>
                <Text style={styles.subscriptionFeature}>✓ Basic overlays</Text>
                <Text style={styles.subscriptionFeature}>✓ Drawing tools</Text>
              </View>
              <View style={[styles.subscriptionButton, styles.subscriptionButtonInactive]}>
                <Text style={styles.subscriptionButtonText}>Coming Soon</Text>
              </View>
            </TouchableOpacity>

            {/* Pro Plus Subscription */}
            <TouchableOpacity style={styles.subscriptionTier}>
              <View style={styles.subscriptionTierHeader}>
                <Text style={styles.subscriptionTierName}>Pro Plus</Text>
                <Text style={styles.subscriptionTierPrice}>$2.99/mo or $30/year</Text>
              </View>
              <View style={styles.subscriptionFeatures}>
                <Text style={styles.subscriptionFeature}>✓ Everything in Pro</Text>
                <Text style={styles.subscriptionFeature}>✓ Extended animation (48 frames)</Text>
                <Text style={styles.subscriptionFeature}>✓ All overlays</Text>
                <Text style={styles.subscriptionFeature}>✓ Priority support</Text>
                <Text style={styles.subscriptionFeature}>✓ Export high-res images</Text>
              </View>
              <View style={[styles.subscriptionButton, styles.subscriptionButtonInactive]}>
                <Text style={styles.subscriptionButtonText}>Coming Soon</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
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
  subscriptionTier: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
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
});
