import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
  } = useApp();

  const isLandscape = layoutOrientation === 'landscape';

  return (
    <View style={styles.container}>
      {/* Main menu row - only show in portrait mode (landscape has inline buttons) */}
      {!isLandscape && (
        <View style={styles.menuRow}>
        <MenuButton
          label="SELECT CHANNEL"
          isActive={activeMenu === 'channel'}
          onPress={() =>
            setActiveMenu(activeMenu === 'channel' ? null : 'channel')
          }
        />
        <MenuButton
          label="RGB"
          isActive={activeMenu === 'rgb'}
          onPress={() => setActiveMenu(activeMenu === 'rgb' ? null : 'rgb')}
        />
        <MenuButton
          label="DOMAIN"
          isActive={activeMenu === 'domain'}
          onPress={() => setActiveMenu(activeMenu === 'domain' ? null : 'domain')}
        />
        <MenuButton
          label="OVERLAYS"
          isActive={activeMenu === 'overlays'}
          onPress={() =>
            setActiveMenu(activeMenu === 'overlays' ? null : 'overlays')
          }
        />
      </View>
      )}

      {/* Content panels */}
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
});
