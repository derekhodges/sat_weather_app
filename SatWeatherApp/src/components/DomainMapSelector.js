import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DOMAINS } from '../constants/domains';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 500;

// Map coordinates for domain positions (relative to map container)
const DOMAIN_POSITIONS = {
  // CONUS
  conus: { x: '50%', y: '45%', label: 'CONUS' },

  // Regional
  northwest: { x: '20%', y: '25%', label: 'Northwest' },
  northeast: { x: '75%', y: '25%', label: 'Northeast' },
  southwest: { x: '25%', y: '65%', label: 'Southwest' },
  southeast: { x: '70%', y: '65%', label: 'Southeast' },

  // Local
  oklahoma: { x: '45%', y: '55%', label: 'Oklahoma' },
  texas: { x: '42%', y: '72%', label: 'Texas' },
};

export const DomainMapSelector = () => {
  const { showDomainMap, setShowDomainMap, selectDomain } = useApp();
  const [viewMode, setViewMode] = useState('menu'); // 'menu' or 'map'

  const handleDomainSelect = (domain) => {
    selectDomain(domain);
    setShowDomainMap(false);
    setViewMode('menu');
  };

  const renderMapView = () => {
    return (
      <View style={styles.mapContainer}>
        {/* Map background - representing North America */}
        <View style={styles.mapBackground}>
          <Text style={styles.mapLabel}>North America</Text>

          {/* Render domain dots on the map */}
          {Object.entries(DOMAIN_POSITIONS).map(([domainId, position]) => {
            const domain = DOMAINS[domainId.toUpperCase()];
            if (!domain) return null;

            return (
              <TouchableOpacity
                key={domainId}
                style={[
                  styles.domainDot,
                  {
                    left: position.x,
                    top: position.y,
                  },
                ]}
                onPress={() => handleDomainSelect(domain)}
              >
                <View style={styles.dot} />
                <Text style={styles.dotLabel}>{position.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.mapInstructions}>
          <Text style={styles.instructionsText}>
            Tap a dot to select that domain
          </Text>
        </View>
      </View>
    );
  };

  const renderMenuView = () => {
    return (
      <View style={styles.menuContainer}>
        {/* Full Disk */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleDomainSelect(DOMAINS.FULL_DISK)}
        >
          <Ionicons name="globe" size={32} color="#2196F3" />
          <Text style={styles.menuCardTitle}>Full Disk</Text>
          <Text style={styles.menuCardSubtitle}>Entire hemisphere view</Text>
        </TouchableOpacity>

        {/* CONUS */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => handleDomainSelect(DOMAINS.CONUS)}
        >
          <Ionicons name="location" size={32} color="#2196F3" />
          <Text style={styles.menuCardTitle}>CONUS</Text>
          <Text style={styles.menuCardSubtitle}>Continental United States</Text>
        </TouchableOpacity>

        {/* Regional - Select on Map */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => setViewMode('map')}
        >
          <Ionicons name="map" size={32} color="#4CAF50" />
          <Text style={styles.menuCardTitle}>Regional</Text>
          <Text style={styles.menuCardSubtitle}>Select on map →</Text>
        </TouchableOpacity>

        {/* Local - Select on Map */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => setViewMode('map')}
        >
          <Ionicons name="navigate" size={32} color="#4CAF50" />
          <Text style={styles.menuCardTitle}>Local</Text>
          <Text style={styles.menuCardSubtitle}>Select on map →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={showDomainMap}
      animationType="slide"
      onRequestClose={() => {
        setShowDomainMap(false);
        setViewMode('menu');
      }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {viewMode === 'map' && (
            <TouchableOpacity
              onPress={() => setViewMode('menu')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setShowDomainMap(false);
              setViewMode('menu');
            }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {viewMode === 'map' ? 'Select Domain on Map' : 'Select Domain'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        {viewMode === 'menu' ? renderMenuView() : renderMapView()}
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
  backButton: {
    padding: 8,
    position: 'absolute',
    left: 8,
    zIndex: 10,
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
  menuContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  menuCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  menuCardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  menuCardSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#1a3a1a',
    margin: 16,
    borderRadius: 12,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  mapLabel: {
    position: 'absolute',
    top: 16,
    left: 16,
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  domainDot: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  dotLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapInstructions: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
});
