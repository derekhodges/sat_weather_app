import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Rectangle, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DOMAINS, DOMAINS_BY_TYPE, DOMAIN_TYPES } from '../constants/domains';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DomainMapSelector = () => {
  const { showDomainMap, setShowDomainMap, selectDomain } = useApp();
  const [selectedType, setSelectedType] = useState(null);

  // Center of CONUS
  const initialRegion = {
    latitude: 39.8283,
    longitude: -98.5795,
    latitudeDelta: 30,
    longitudeDelta: 50,
  };

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;

    // Find which domain was clicked based on coordinates
    const clickedDomain = Object.values(DOMAINS).find((domain) => {
      if (!domain.bounds) return false;

      const { minLat, maxLat, minLon, maxLon } = domain.bounds;
      return (
        coordinate.latitude >= minLat &&
        coordinate.latitude <= maxLat &&
        coordinate.longitude >= minLon &&
        coordinate.longitude <= maxLon
      );
    });

    if (clickedDomain) {
      selectDomain(clickedDomain);
    }
  };

  const renderDomainRectangles = () => {
    const domains = selectedType
      ? DOMAINS_BY_TYPE[selectedType]
      : Object.values(DOMAINS).filter((d) => d.bounds);

    return domains.map((domain) => {
      if (!domain.bounds) return null;

      const { minLat, maxLat, minLon, maxLon } = domain.bounds;

      return (
        <React.Fragment key={domain.id}>
          <Rectangle
            coordinates={[
              { latitude: minLat, longitude: minLon },
              { latitude: maxLat, longitude: maxLon },
            ]}
            strokeColor="#2196F3"
            strokeWidth={2}
            fillColor="rgba(33, 150, 243, 0.2)"
          />
          <Marker
            coordinate={{
              latitude: (minLat + maxLat) / 2,
              longitude: (minLon + maxLon) / 2,
            }}
            title={domain.name}
            description={domain.description}
          />
        </React.Fragment>
      );
    });
  };

  return (
    <Modal
      visible={showDomainMap}
      animationType="slide"
      onRequestClose={() => setShowDomainMap(false)}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setShowDomainMap(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Select Domain on Map</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Domain type selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              selectedType === null && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedType(null)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedType === null && styles.typeButtonTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              selectedType === DOMAIN_TYPES.CONUS && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedType(DOMAIN_TYPES.CONUS)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedType === DOMAIN_TYPES.CONUS &&
                  styles.typeButtonTextActive,
              ]}
            >
              CONUS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              selectedType === DOMAIN_TYPES.REGIONAL &&
                styles.typeButtonActive,
            ]}
            onPress={() => setSelectedType(DOMAIN_TYPES.REGIONAL)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedType === DOMAIN_TYPES.REGIONAL &&
                  styles.typeButtonTextActive,
              ]}
            >
              Regional
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              selectedType === DOMAIN_TYPES.LOCAL && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedType(DOMAIN_TYPES.LOCAL)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedType === DOMAIN_TYPES.LOCAL &&
                  styles.typeButtonTextActive,
              ]}
            >
              Local
            </Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          onPress={handleMapPress}
          provider={PROVIDER_DEFAULT}
        >
          {renderDomainRectangles()}
        </MapView>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            Tap on a highlighted region to select that domain
          </Text>
        </View>
      </View>
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
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 8,
    justifyContent: 'space-evenly',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
  },
  typeButtonText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  map: {
    flex: 1,
  },
  instructions: {
    backgroundColor: '#1a1a1a',
    padding: 12,
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
  },
});
