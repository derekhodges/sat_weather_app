import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { CHANNELS, SATELLITES } from '../constants/satellites';
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
    selectedSatellite,
    setSelectedSatellite,
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
          selectedSatellite={selectedSatellite}
          onSelectSatellite={setSelectedSatellite}
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
  const [selectedInfo, setSelectedInfo] = useState(null);

  return (
    <>
      <ScrollView style={styles.panel}>
        <Text style={styles.panelTitle}>SELECT SATELLITE CHANNEL</Text>
        <View style={styles.channelList}>
          {CHANNELS.map((channel) => (
            <View key={channel.id} style={styles.listItemWrapper}>
              <TouchableOpacity
                style={styles.channelListItem}
                onPress={() => onSelect(channel)}
              >
                <View style={styles.channelListContent}>
                  <Text style={styles.channelListTitle}>
                    Channel {channel.number} - {channel.name} ({channel.wavelength})
                  </Text>
                  <Text style={styles.channelListDescription} numberOfLines={2}>{channel.useCase}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => setSelectedInfo({ type: 'channel', data: channel })}
              >
                <Ionicons name="information-circle-outline" size={24} color="#2196F3" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <InfoModal
        visible={selectedInfo !== null}
        info={selectedInfo}
        onClose={() => setSelectedInfo(null)}
      />
    </>
  );
};

const RGBPanel = ({ onSelect }) => {
  const [selectedInfo, setSelectedInfo] = useState(null);

  return (
    <>
      <ScrollView style={styles.panel}>
        <Text style={styles.panelTitle}>SELECT RGB PRODUCT</Text>
        <View style={styles.rgbGrid}>
          {RGB_PRODUCTS.map((product) => (
            <View key={product.id} style={styles.listItemWrapper}>
              <TouchableOpacity
                style={styles.rgbButton}
                onPress={() => onSelect(product)}
              >
                <Text style={styles.rgbName}>{product.name}</Text>
                <Text style={styles.rgbDescription} numberOfLines={2}>{product.description}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => setSelectedInfo({ type: 'rgb', data: product })}
              >
                <Ionicons name="information-circle-outline" size={24} color="#2196F3" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <InfoModal
        visible={selectedInfo !== null}
        info={selectedInfo}
        onClose={() => setSelectedInfo(null)}
      />
    </>
  );
};

const DomainPanel = ({ onSelect, onShowMap, selectedSatellite, onSelectSatellite }) => {
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

      <View style={styles.domainTypeRow}>
        <TouchableOpacity
          style={styles.domainTypeButton}
          onPress={() => onSelect(DOMAINS.MESOSCALE_1)}
        >
          <Text style={styles.domainTypeName}>Mesoscale 1</Text>
          <Text style={styles.domainTypeDesc}>Meso Domain 1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainTypeButton}
          onPress={() => onSelect(DOMAINS.MESOSCALE_2)}
        >
          <Text style={styles.domainTypeName}>Mesoscale 2</Text>
          <Text style={styles.domainTypeDesc}>Meso Domain 2</Text>
        </TouchableOpacity>
      </View>

      {/* Quick regional domains */}
      <Text style={styles.sectionTitle}>Quick Regional Access</Text>

      {/* First row: Northwest, North Central, Northeast */}
      <View style={styles.domainGrid}>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.NORTHWEST)}
        >
          <Text style={styles.domainName}>Northwest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.NORTH_CENTRAL)}
        >
          <Text style={styles.domainName}>North Central</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.NORTHEAST)}
        >
          <Text style={styles.domainName}>Northeast</Text>
        </TouchableOpacity>
      </View>

      {/* Second row: West-Central, Central, East-Central */}
      <View style={styles.domainGrid}>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.WEST_CENTRAL)}
        >
          <Text style={styles.domainName}>West-Central</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.CENTRAL)}
        >
          <Text style={styles.domainName}>Central</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.EAST_CENTRAL)}
        >
          <Text style={styles.domainName}>East-Central</Text>
        </TouchableOpacity>
      </View>

      {/* Third row: Southwest, South Central, Southeast */}
      <View style={styles.domainGrid}>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.SOUTHWEST)}
        >
          <Text style={styles.domainName}>Southwest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.SOUTH_CENTRAL)}
        >
          <Text style={styles.domainName}>South Central</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.domainButton}
          onPress={() => onSelect(DOMAINS.SOUTHEAST)}
        >
          <Text style={styles.domainName}>Southeast</Text>
        </TouchableOpacity>
      </View>

      {/* Satellite Selector */}
      <Text style={styles.sectionTitle}>Select Satellite</Text>
      <View style={styles.satelliteGrid}>
        {Object.values(SATELLITES).map((satellite) => (
          <TouchableOpacity
            key={satellite.id}
            style={[
              styles.satelliteButton,
              selectedSatellite?.id === satellite.id && styles.satelliteButtonActive,
              !satellite.available && styles.satelliteButtonDisabled,
            ]}
            onPress={() => {
              if (satellite.available) {
                onSelectSatellite(satellite);
              }
            }}
            disabled={!satellite.available}
          >
            <Text
              style={[
                styles.satelliteName,
                selectedSatellite?.id === satellite.id && styles.satelliteNameActive,
                !satellite.available && styles.satelliteNameDisabled,
              ]}
            >
              {satellite.name}
            </Text>
            <Text
              style={[
                styles.satelliteLocation,
                !satellite.available && styles.satelliteLocationDisabled,
              ]}
            >
              {satellite.location}
            </Text>
            {!satellite.available && (
              <Text style={styles.satelliteUnavailable}>Unavailable</Text>
            )}
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

const InfoModal = ({ visible, info, onClose }) => {
  if (!info) return null;

  const { type, data } = info;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.infoModalOverlay}>
        <View style={styles.infoModalContent}>
          <View style={styles.infoModalHeader}>
            <Text style={styles.infoModalTitle}>
              {type === 'channel'
                ? `Channel ${data.number} - ${data.name}`
                : data.name}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.infoModalBody}>
            {type === 'channel' ? (
              <>
                <Text style={styles.infoLabel}>Wavelength:</Text>
                <Text style={styles.infoValue}>{data.wavelength}</Text>

                <Text style={styles.infoLabel}>Type:</Text>
                <Text style={styles.infoValue}>{data.type === 'visible' ? 'Visible/Near-IR' : 'Infrared'}</Text>

                <Text style={styles.infoLabel}>Description:</Text>
                <Text style={styles.infoValue}>{data.description}</Text>

                <Text style={styles.infoLabel}>Typical Uses:</Text>
                <Text style={styles.infoValue}>{data.useCase}</Text>
              </>
            ) : (
              <>
                <Text style={styles.infoLabel}>Description:</Text>
                <Text style={styles.infoValue}>{data.description}</Text>

                <Text style={styles.infoLabel}>Typical Uses:</Text>
                <Text style={styles.infoValue}>{data.useCase || 'Multi-channel composite imagery for enhanced visualization of atmospheric features.'}</Text>
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.infoModalCloseButton} onPress={onClose}>
            <Text style={styles.infoModalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  channelList: {
    paddingBottom: 8,
  },
  channelListItem: {
    flex: 1,
    backgroundColor: '#424242',
    padding: 12,
    borderRadius: 6,
  },
  channelListContent: {
    flex: 1,
  },
  channelListTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  channelListDescription: {
    color: '#999',
    fontSize: 11,
    lineHeight: 16,
  },
  rgbGrid: {
    paddingBottom: 8,
  },
  rgbButton: {
    flex: 1,
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
    gap: 8,
    marginBottom: 8,
  },
  domainButton: {
    flex: 1,
    backgroundColor: '#424242',
    padding: 10,
    borderRadius: 6,
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
  listItemWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  infoButton: {
    padding: 8,
    marginTop: 4,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  infoModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  infoModalBody: {
    padding: 16,
  },
  infoLabel: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  infoModalCloseButton: {
    backgroundColor: '#2196F3',
    padding: 14,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  infoModalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  satelliteGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  satelliteButton: {
    flex: 1,
    backgroundColor: '#424242',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  satelliteButtonActive: {
    borderColor: '#2196F3',
    backgroundColor: '#1a3a52',
  },
  satelliteButtonDisabled: {
    backgroundColor: '#2a2a2a',
    opacity: 0.5,
  },
  satelliteName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  satelliteNameActive: {
    color: '#2196F3',
  },
  satelliteNameDisabled: {
    color: '#666',
  },
  satelliteLocation: {
    color: '#999',
    fontSize: 11,
  },
  satelliteLocationDisabled: {
    color: '#555',
  },
  satelliteUnavailable: {
    color: '#ff6666',
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
