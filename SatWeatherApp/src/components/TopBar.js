import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { SATELLITES } from '../constants/satellites';

import { formatTimestamp } from '../utils/imageService';

export const TopBar = ({ onMenuPress, onRefresh, onFavoritesPress }) => {
  const {
    selectedSatellite,
    selectedDomain,
    setSelectedSatellite,
    selectedChannel,
    selectedRGBProduct,
    viewMode,
    imageTimestamp,
    layoutOrientation,
    settings,
  } = useApp();
  const [showSatelliteSelector, setShowSatelliteSelector] = useState(false);

  const isLandscape = layoutOrientation === 'landscape';

  // Get product/channel info
  const productInfo = viewMode === 'rgb'
    ? selectedRGBProduct?.name || 'RGB Product'
    : selectedChannel
    ? `CH${selectedChannel.number} ${selectedChannel.description}`
    : 'No Channel';

  return (
    <View style={isLandscape ? styles.containerLandscape : styles.container}>
      {/* Menu button */}
      <TouchableOpacity onPress={onMenuPress} style={styles.iconButton}>
        <Ionicons name="menu" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Title */}
      <TouchableOpacity
        onPress={() => setShowSatelliteSelector(true)}
        style={styles.titleContainer}
      >
        {isLandscape ? (
          <View style={styles.landscapeTitleContent}>
            <Text style={styles.titleLandscape}>
              {selectedSatellite.name} {selectedDomain.name}
            </Text>
            <Text style={styles.productInfo}>{productInfo}</Text>
            <Text style={styles.timestamp}>{formatTimestamp(imageTimestamp, settings.useLocalTime)}</Text>
          </View>
        ) : (
          <View style={styles.portraitTitleContent}>
            <View style={styles.portraitTitleRow}>
              <Text style={styles.title}>
                {selectedSatellite.name} {selectedDomain.name}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </View>
            <Text style={styles.timestampPortrait}>{formatTimestamp(imageTimestamp, settings.useLocalTime)}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Right buttons */}
      <View style={styles.rightButtons}>
        <TouchableOpacity onPress={onFavoritesPress} style={styles.iconButton}>
          <Ionicons name="star" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Satellite Selector Modal */}
      <Modal
        visible={showSatelliteSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSatelliteSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSatelliteSelector(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SELECT SATELLITE</Text>

            {Object.values(SATELLITES).map((satellite) => (
              <TouchableOpacity
                key={satellite.id}
                style={[
                  styles.satelliteOption,
                  selectedSatellite.id === satellite.id && styles.selectedOption,
                  !satellite.available && styles.disabledOption,
                ]}
                onPress={() => {
                  if (satellite.available) {
                    setSelectedSatellite(satellite);
                    setShowSatelliteSelector(false);
                  }
                }}
                disabled={!satellite.available}
              >
                <View>
                  <Text
                    style={[
                      styles.satelliteName,
                      selectedSatellite.id === satellite.id &&
                        styles.selectedText,
                      !satellite.available && styles.disabledText,
                    ]}
                  >
                    {satellite.name}
                  </Text>
                  <Text
                    style={[
                      styles.satelliteLocation,
                      !satellite.available && styles.disabledText,
                    ]}
                  >
                    {satellite.location}
                  </Text>
                </View>
                {!satellite.available && (
                  <Text style={styles.comingSoon}>Coming Soon</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  containerLandscape: {
    height: 50,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  iconButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 4,
  },
  portraitTitleContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestampPortrait: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  landscapeTitleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleLandscape: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  productInfo: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
  },
  timestamp: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  rightButtons: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 16,
    minWidth: 280,
    maxWidth: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  satelliteOption: {
    backgroundColor: '#424242',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#2196F3',
  },
  disabledOption: {
    backgroundColor: '#333',
  },
  satelliteName: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  satelliteLocation: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  selectedText: {
    color: '#fff',
  },
  disabledText: {
    color: '#666',
  },
  comingSoon: {
    color: '#999',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
