import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DOMAINS, DOMAINS_BY_TYPE, DOMAIN_TYPES } from '../constants/domains';

export const DomainMapSelector = () => {
  const { showDomainMap, setShowDomainMap, selectDomain } = useApp();
  const [selectedType, setSelectedType] = useState(null);

  const handleDomainSelect = (domain) => {
    selectDomain(domain);
    setShowDomainMap(false);
  };

  const renderDomainList = () => {
    const domains = selectedType
      ? DOMAINS_BY_TYPE[selectedType]
      : Object.values(DOMAINS);

    return domains.map((domain) => (
      <TouchableOpacity
        key={domain.id}
        style={styles.domainCard}
        onPress={() => handleDomainSelect(domain)}
      >
        <View style={styles.domainCardContent}>
          <Text style={styles.domainName}>{domain.name}</Text>
          <Text style={styles.domainDescription}>{domain.description}</Text>
          {domain.bounds && (
            <Text style={styles.domainBounds}>
              Lat: {domain.bounds.minLat}° to {domain.bounds.maxLat}° |
              Lon: {domain.bounds.minLon}° to {domain.bounds.maxLon}°
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={24} color="#666" />
      </TouchableOpacity>
    ));
  };

  const renderDomainsByType = () => {
    if (selectedType !== null) {
      return renderDomainList();
    }

    return Object.entries(DOMAINS_BY_TYPE).map(([type, domains]) => (
      <View key={type} style={styles.typeSection}>
        <Text style={styles.typeSectionTitle}>
          {type === DOMAIN_TYPES.FULL_DISK && 'Full Disk'}
          {type === DOMAIN_TYPES.CONUS && 'CONUS'}
          {type === DOMAIN_TYPES.REGIONAL && 'Regional Domains'}
          {type === DOMAIN_TYPES.LOCAL && 'Local Domains'}
        </Text>
        {domains.map((domain) => (
          <TouchableOpacity
            key={domain.id}
            style={styles.domainCard}
            onPress={() => handleDomainSelect(domain)}
          >
            <View style={styles.domainCardContent}>
              <Text style={styles.domainName}>{domain.name}</Text>
              <Text style={styles.domainDescription}>{domain.description}</Text>
              {domain.bounds && (
                <Text style={styles.domainBounds}>
                  Lat: {domain.bounds.minLat}° to {domain.bounds.maxLat}° |
                  Lon: {domain.bounds.minLon}° to {domain.bounds.maxLon}°
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        ))}
      </View>
    ));
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

        {/* Domain List */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {renderDomainsByType()}
        </ScrollView>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            Tap on a domain to select it
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  typeSection: {
    marginBottom: 24,
  },
  typeSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    paddingLeft: 4,
  },
  domainCard: {
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
  domainCardContent: {
    flex: 1,
  },
  domainName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  domainDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 6,
  },
  domainBounds: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
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
