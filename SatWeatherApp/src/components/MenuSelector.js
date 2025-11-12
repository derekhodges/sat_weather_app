import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { CHANNELS } from '../constants/satellites';
import { RGB_PRODUCTS } from '../constants/products';
import { DOMAINS, DOMAINS_BY_TYPE, DOMAIN_TYPES } from '../constants/domains';
import { OVERLAYS, OVERLAYS_BY_CATEGORY } from '../constants/overlays';

export const MenuSelector = () => {
  const {
    activeMenu,
    setActiveMenu,
    selectChannel,
    selectRGBProduct,
    selectDomain,
    toggleOverlay,
    overlayStates,
    setShowDomainMap,
    layoutOrientation,
    settings,
    updateSettings,
  } = useApp();

  const isLandscape = layoutOrientation === 'landscape';

  return (
    <View style={styles.container}>
      {/* Content panels - menu buttons are now inline in MainScreen for both modes */}
      {activeMenu === 'channel' && <ChannelPanel onSelect={selectChannel} />}
      {activeMenu === 'rgb' && <RGBPanel onSelect={selectRGBProduct} />}
      {activeMenu === 'domain' && (
        <DomainPanel
          onSelect={selectDomain}
          onShowMap={() => {
            setShowDomainMap(true);
            setActiveMenu(null);
          }}
        />
      )}
      {activeMenu === 'overlays' && (
        <OverlaysPanel
          overlayStates={overlayStates}
          onToggle={toggleOverlay}
        />
      )}
      {activeMenu === 'settings' && (
        <SettingsPanel
          settings={settings}
          onUpdateSettings={updateSettings}
        />
      )}
    </View>
  );
};

const MenuButton = ({ label, isActive, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.menuButton, isActive && styles.menuButtonActive]}
  >
    <Text style={styles.menuButtonText}>{label}</Text>
  </TouchableOpacity>
);

const ChannelPanel = ({ onSelect }) => {
  const visibleChannels = CHANNELS.filter((c) => c.type === 'visible');
  const infraredChannels = CHANNELS.filter((c) => c.type === 'infrared');

  return (
    <ScrollView style={styles.panel}>
      <Text style={styles.panelTitle}>SELECT SATELLITE CHANNEL</Text>

      <Text style={styles.sectionTitle}>Visible & Near-IR Channels</Text>
      <View style={styles.channelGrid}>
        {visibleChannels.map((channel) => (
          <TouchableOpacity
            key={channel.id}
            style={styles.channelButton}
            onPress={() => onSelect(channel)}
          >
            <Text style={styles.channelNumber}>CH {channel.number}</Text>
            <Text style={styles.channelName}>{channel.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Infrared Channels</Text>
      <View style={styles.channelGrid}>
        {infraredChannels.map((channel) => (
          <TouchableOpacity
            key={channel.id}
            style={styles.channelButton}
            onPress={() => onSelect(channel)}
          >
            <Text style={styles.channelNumber}>CH {channel.number}</Text>
            <Text style={styles.channelName}>{channel.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const RGBPanel = ({ onSelect }) => {
  return (
    <ScrollView style={styles.panel}>
      <Text style={styles.panelTitle}>SELECT RGB PRODUCT</Text>
      <View style={styles.rgbGrid}>
        {RGB_PRODUCTS.map((product) => (
          <TouchableOpacity
            key={product.id}
            style={styles.rgbButton}
            onPress={() => onSelect(product)}
          >
            <Text style={styles.rgbName}>{product.name}</Text>
            <Text style={styles.rgbDescription}>{product.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const DomainPanel = ({ onSelect, onShowMap }) => {
  return (
    <ScrollView style={styles.panel}>
      <Text style={styles.panelTitle}>SELECT DOMAIN</Text>

      {/* Quick access buttons */}
      <View style={styles.domainTypeRow}>
        <TouchableOpacity
          style={styles.domainTypeButton}
          onPress={() => onSelect(DOMAINS.FULL_DISK)}
        >
          <Text style={styles.domainTypeName}>Full Disk</Text>
          <Text style={styles.domainTypeDesc}>Entire Hemisphere</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainTypeButton}
          onPress={() => onSelect(DOMAINS.CONUS)}
        >
          <Text style={styles.domainTypeName}>CONUS</Text>
          <Text style={styles.domainTypeDesc}>Continental US</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.domainTypeRow}>
        <TouchableOpacity style={styles.domainTypeButton} onPress={onShowMap}>
          <Text style={styles.domainTypeName}>Regional</Text>
          <Text style={styles.domainTypeDesc}>Select on Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.domainTypeButton} onPress={onShowMap}>
          <Text style={styles.domainTypeName}>Local</Text>
          <Text style={styles.domainTypeDesc}>Select on Map</Text>
        </TouchableOpacity>
      </View>

      {/* Quick regional domains */}
      <Text style={styles.sectionTitle}>Quick Regional Access</Text>
      <View style={styles.domainGrid}>
        {DOMAINS_BY_TYPE[DOMAIN_TYPES.REGIONAL].map((domain) => (
          <TouchableOpacity
            key={domain.id}
            style={styles.domainButton}
            onPress={() => onSelect(domain)}
          >
            <Text style={styles.domainName}>{domain.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick local domains */}
      <Text style={styles.sectionTitle}>Quick Local Access</Text>
      <View style={styles.domainGrid}>
        {DOMAINS_BY_TYPE[DOMAIN_TYPES.LOCAL].map((domain) => (
          <TouchableOpacity
            key={domain.id}
            style={styles.domainButton}
            onPress={() => onSelect(domain)}
          >
            <Text style={styles.domainName}>{domain.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const OverlaysPanel = ({ overlayStates, onToggle }) => {
  const categories = Object.keys(OVERLAYS_BY_CATEGORY);

  return (
    <ScrollView style={styles.panel}>
      <Text style={styles.panelTitle}>SELECT OVERLAYS</Text>
      {categories.map((category) => (
        <View key={category} style={styles.overlayCategory}>
          <Text style={styles.overlayCategoryTitle}>
            {category.toUpperCase()}
          </Text>
          {OVERLAYS_BY_CATEGORY[category].map((overlay) => {
            const state = overlayStates[overlay.id];
            return (
              <TouchableOpacity
                key={overlay.id}
                style={styles.overlayItem}
                onPress={() => onToggle(overlay.id)}
              >
                <View style={styles.overlayInfo}>
                  <Text style={styles.overlayName}>{overlay.name}</Text>
                  <Text style={styles.overlayDescription}>
                    {overlay.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    state?.enabled && styles.checkboxChecked,
                  ]}
                >
                  {state?.enabled && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
};

const SettingsPanel = ({ settings, onUpdateSettings }) => {
  const [localAnimationSpeed, setLocalAnimationSpeed] = useState(settings.animationSpeed.toString());
  const [localFrameCount, setLocalFrameCount] = useState(settings.frameCount.toString());

  const handleAnimationSpeedChange = (value) => {
    setLocalAnimationSpeed(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 100 && numValue <= 2000) {
      onUpdateSettings({ animationSpeed: numValue });
    }
  };

  const handleFrameCountChange = (value) => {
    setLocalFrameCount(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 5 && numValue <= 50) {
      onUpdateSettings({ frameCount: numValue });
    }
  };

  return (
    <ScrollView style={styles.panel}>
      <Text style={styles.panelTitle}>SETTINGS</Text>

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
      </View>

      {/* Display Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Display</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Image Display Mode</Text>
            <Text style={styles.settingDescription}>
              Contain: Entire image visible | Cover: Fill space (may crop)
            </Text>
          </View>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                settings.imageDisplayMode === 'contain' && styles.segmentButtonActive
              ]}
              onPress={() => onUpdateSettings({ imageDisplayMode: 'contain' })}
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
              onPress={() => onUpdateSettings({ imageDisplayMode: 'cover' })}
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
            onValueChange={(value) => onUpdateSettings({ showColorScale: value })}
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
            onValueChange={(value) => onUpdateSettings({ autoRefresh: value })}
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
                  onPress={() => onUpdateSettings({ autoRefreshInterval: interval })}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
  },
  menuRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: '#262626',
    maxHeight: 300,
    padding: 12,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelButton: {
    backgroundColor: '#424242',
    padding: 10,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  channelNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  channelName: {
    color: '#ccc',
    fontSize: 10,
    marginTop: 2,
  },
  rgbGrid: {
    gap: 8,
  },
  rgbButton: {
    backgroundColor: '#424242',
    padding: 12,
    borderRadius: 6,
  },
  rgbName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  rgbDescription: {
    color: '#999',
    fontSize: 11,
    marginTop: 4,
  },
  domainTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  domainTypeButton: {
    flex: 1,
    backgroundColor: '#424242',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  domainTypeName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  domainTypeDesc: {
    color: '#999',
    fontSize: 10,
    marginTop: 2,
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  domainButton: {
    backgroundColor: '#424242',
    padding: 10,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  domainName: {
    color: '#ccc',
    fontSize: 12,
  },
  overlayCategory: {
    marginBottom: 16,
  },
  overlayCategoryTitle: {
    color: '#2196F3',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  overlayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  overlayInfo: {
    flex: 1,
  },
  overlayName: {
    color: '#fff',
    fontSize: 13,
  },
  overlayDescription: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingsSectionTitle: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingRow: {
    marginBottom: 16,
  },
  settingInfo: {
    marginBottom: 8,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: '#999',
    fontSize: 11,
  },
  settingInput: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#555',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderRadius: 6,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  segmentButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  segmentButtonText: {
    color: '#999',
    fontSize: 13,
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
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555',
  },
  intervalButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  intervalButtonText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  intervalButtonTextActive: {
    color: '#fff',
  },
});
