/**
 * About This App Screen
 *
 * Provides information about the app including:
 * - Version and build info
 * - Changelog
 * - Upcoming features roadmap
 * - Data acknowledgements
 * - Open source licenses
 * - Support and feedback links
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen({ onClose }) {
  const [expandedSections, setExpandedSections] = useState({
    version: true,
    changelog: false,
    upcoming: false,
    acknowledgements: false,
    licenses: false,
    support: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const openLink = async (url, title) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', `Cannot open ${title}`);
    }
  };

  const renderSection = (id, title, icon, content) => (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(id)}
      >
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={24} color="#4A90E2" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Ionicons
          name={expandedSections[id] ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#666"
        />
      </TouchableOpacity>

      {expandedSections[id] && (
        <View style={styles.sectionContent}>
          {content}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.title}>About This App</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* App Icon and Name */}
        <View style={styles.appInfo}>
          <View style={styles.appIconPlaceholder}>
            <Ionicons name="partly-sunny" size={60} color="#4A90E2" />
          </View>
          <Text style={styles.appName}>Satellite Weather App</Text>
          <Text style={styles.appTagline}>
            Real-time GOES satellite imagery at your fingertips
          </Text>
        </View>

        {/* Version Info */}
        {renderSection(
          'version',
          'Version Information',
          'information-circle-outline',
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version:</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Build:</Text>
              <Text style={styles.infoValue}>2025.1</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform:</Text>
              <Text style={styles.infoValue}>React Native + Expo</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Released:</Text>
              <Text style={styles.infoValue}>January 2025</Text>
            </View>
          </>
        )}

        {/* Changelog */}
        {renderSection(
          'changelog',
          'What\'s New',
          'newspaper-outline',
          <>
            <View style={styles.changelogEntry}>
              <Text style={styles.changelogVersion}>Version 1.0.0</Text>
              <Text style={styles.changelogDate}>January 2025</Text>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Added 7-day free trial for Pro Plus features
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Implemented user feedback system with error tracking
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Fixed Android navigation button overlap issues
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Added comprehensive subscription management
                </Text>
              </View>
            </View>

            <View style={styles.changelogEntry}>
              <Text style={styles.changelogVersion}>Initial Release</Text>
              <Text style={styles.changelogDate}>December 2024</Text>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Real-time GOES satellite imagery (GOES-16 & GOES-18)
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  16 satellite channels and multiple RGB products
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Animation with customizable speed and frame count
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Drawing tools and image sharing capabilities
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Weather overlays (lightning, NWS warnings, radar)
                </Text>
              </View>
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>
                  Multiple domain views (CONUS, Meso, local regions)
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Upcoming Features */}
        {renderSection(
          'upcoming',
          'Coming Soon',
          'rocket-outline',
          <>
            <Text style={styles.roadmapIntro}>
              Here's what we're working on for future releases:
            </Text>

            <Text style={styles.roadmapTierHeader}>Pro Features</Text>

            <View style={styles.featureItem}>
              <View style={[styles.featurePriority, { backgroundColor: '#4A90E2' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>GLM Lightning Data Overlays</Text>
                <Text style={styles.featureDescription}>
                  Enhanced lightning detection from Geostationary Lightning Mapper
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featurePriority, { backgroundColor: '#4A90E2' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Additional Satellite Overlays</Text>
                <Text style={styles.featureDescription}>
                  More satellite-derived products and enhancements
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featurePriority, { backgroundColor: '#4A90E2' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>RAP Analysis Overlays</Text>
                <Text style={styles.featureDescription}>
                  Rapid Refresh analysis data for detailed atmospheric conditions
                </Text>
              </View>
            </View>

            <Text style={styles.roadmapTierHeader}>Pro Plus Features</Text>

            <View style={styles.featureItem}>
              <View style={[styles.featurePriority, { backgroundColor: '#667eea' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Model & ACARS Soundings</Text>
                <Text style={styles.featureDescription}>
                  Vertical atmospheric profiles from weather models and aircraft reports
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featurePriority, { backgroundColor: '#667eea' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Multiple MRMS Radar Layers</Text>
                <Text style={styles.featureDescription}>
                  Expanded radar products including reflectivity, velocity, and derived products
                </Text>
              </View>
            </View>

            <Text style={styles.roadmapTierHeader}>All Tiers</Text>

            <View style={styles.featureItem}>
              <View style={[styles.featurePriority, { backgroundColor: '#27ae60' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Custom Location Alerts</Text>
                <Text style={styles.featureDescription}>
                  Push notifications for weather events in your saved locations
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featurePriority, { backgroundColor: '#27ae60' }]} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Historical Archive</Text>
                <Text style={styles.featureDescription}>
                  Access past satellite imagery for analysis and research
                </Text>
              </View>
            </View>

            <Text style={styles.roadmapNote}>
              Have a feature request? Use the "Send Feedback" button in Settings!
            </Text>
          </>
        )}

        {/* Data Acknowledgements */}
        {renderSection(
          'acknowledgements',
          'Data Sources & Credits',
          'cloud-download-outline',
          <>
            <View style={styles.acknowledgement}>
              <Text style={styles.ackTitle}>NOAA/NESDIS</Text>
              <Text style={styles.ackDescription}>
                Satellite imagery provided by the National Oceanic and Atmospheric Administration (NOAA)
                and the National Environmental Satellite, Data, and Information Service (NESDIS).
              </Text>
              <Text style={styles.ackNote}>
                GOES-16 (GOES East) and GOES-18 (GOES West)
              </Text>
            </View>

            <View style={styles.acknowledgement}>
              <Text style={styles.ackTitle}>CIRA/RAMMB</Text>
              <Text style={styles.ackDescription}>
                RGB products and satellite composites from the Cooperative Institute for Research in the
                Atmosphere (CIRA) and Regional and Mesoscale Meteorology Branch (RAMMB) at Colorado State University.
              </Text>
            </View>

            <View style={styles.acknowledgement}>
              <Text style={styles.ackTitle}>National Weather Service</Text>
              <Text style={styles.ackDescription}>
                Weather warnings, watches, and advisories from the National Weather Service (NWS).
              </Text>
            </View>

            <View style={styles.acknowledgement}>
              <Text style={styles.ackTitle}>Storm Prediction Center</Text>
              <Text style={styles.ackDescription}>
                Convective outlooks and severe weather probabilities from NOAA's Storm Prediction Center (SPC).
              </Text>
            </View>

            <View style={styles.acknowledgement}>
              <Text style={styles.ackTitle}>MRMS Radar</Text>
              <Text style={styles.ackDescription}>
                Multi-Radar Multi-Sensor (MRMS) composite radar data from NOAA's National Severe Storms Laboratory.
              </Text>
            </View>

            <View style={styles.acknowledgement}>
              <Text style={styles.ackTitle}>GLM Lightning Data</Text>
              <Text style={styles.ackDescription}>
                Lightning detection from the Geostationary Lightning Mapper (GLM) aboard GOES satellites.
              </Text>
            </View>

            <Text style={styles.disclaimer}>
              This app is not affiliated with or endorsed by NOAA, NWS, or any government agency.
              Satellite data is provided for informational and educational purposes only.
            </Text>
          </>
        )}

        {/* Open Source Licenses */}
        {renderSection(
          'licenses',
          'Open Source Licenses',
          'code-slash-outline',
          <>
            <Text style={styles.licenseIntro}>
              This app is built with open source software:
            </Text>

            <View style={styles.licenseItem}>
              <Text style={styles.licenseName}>React & React Native</Text>
              <Text style={styles.licenseType}>MIT License</Text>
            </View>

            <View style={styles.licenseItem}>
              <Text style={styles.licenseName}>Expo</Text>
              <Text style={styles.licenseType}>MIT License</Text>
            </View>

            <View style={styles.licenseItem}>
              <Text style={styles.licenseName}>Supabase JS</Text>
              <Text style={styles.licenseType}>MIT License</Text>
            </View>

            <View style={styles.licenseItem}>
              <Text style={styles.licenseName}>React Native Maps</Text>
              <Text style={styles.licenseType}>MIT License</Text>
            </View>

            <View style={styles.licenseItem}>
              <Text style={styles.licenseName}>React Native SVG</Text>
              <Text style={styles.licenseType}>MIT License</Text>
            </View>

            <View style={styles.licenseItem}>
              <Text style={styles.licenseName}>RevenueCat Purchases</Text>
              <Text style={styles.licenseType}>MIT License</Text>
            </View>

            <View style={styles.licenseItem}>
              <Text style={styles.licenseName}>AsyncStorage</Text>
              <Text style={styles.licenseType}>MIT License</Text>
            </View>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => openLink('https://github.com/derekhodges/sat_weather_app', 'GitHub Repository')}
            >
              <Ionicons name="logo-github" size={20} color="#4A90E2" />
              <Text style={styles.linkButtonText}>View Full License Information</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Support & Feedback */}
        {renderSection(
          'support',
          'Support & Feedback',
          'help-circle-outline',
          <>
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => openLink('https://github.com/derekhodges/sat_weather_app/issues', 'Issue Tracker')}
            >
              <Ionicons name="bug-outline" size={24} color="#FF6B6B" />
              <View style={styles.supportButtonText}>
                <Text style={styles.supportButtonTitle}>Report a Bug</Text>
                <Text style={styles.supportButtonDescription}>
                  Found an issue? Let us know on GitHub
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => openLink('https://github.com/derekhodges/sat_weather_app/discussions', 'Discussions')}
            >
              <Ionicons name="chatbubbles-outline" size={24} color="#4A90E2" />
              <View style={styles.supportButtonText}>
                <Text style={styles.supportButtonTitle}>Feature Requests</Text>
                <Text style={styles.supportButtonDescription}>
                  Suggest new features or improvements
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => openLink('mailto:support@satweatherapp.com', 'Email Support')}
            >
              <Ionicons name="mail-outline" size={24} color="#27ae60" />
              <View style={styles.supportButtonText}>
                <Text style={styles.supportButtonTitle}>Email Support</Text>
                <Text style={styles.supportButtonDescription}>
                  Contact us directly for help
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => openLink('https://docs.satweatherapp.com', 'Documentation')}
            >
              <Ionicons name="book-outline" size={24} color="#FF9500" />
              <View style={styles.supportButtonText}>
                <Text style={styles.supportButtonTitle}>Documentation</Text>
                <Text style={styles.supportButtonDescription}>
                  Learn more about using the app
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Made with ❤️ for weather enthusiasts
          </Text>
          <Text style={styles.copyright}>
            © 2025 Satellite Weather App. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  appIconPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  infoLabel: {
    color: '#999',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  changelogEntry: {
    marginBottom: 24,
  },
  changelogVersion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  changelogDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  changelogItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  changelogBullet: {
    color: '#4A90E2',
    marginRight: 8,
    fontSize: 16,
  },
  changelogText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  roadmapIntro: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  roadmapTierHeader: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingLeft: 4,
  },
  featurePriority: {
    width: 4,
    backgroundColor: '#4A90E2',
    marginRight: 12,
    borderRadius: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  roadmapNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  acknowledgement: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
  },
  ackTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 6,
  },
  ackDescription: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 19,
    marginBottom: 6,
  },
  ackNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  disclaimer: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    fontStyle: 'italic',
  },
  licenseIntro: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 16,
  },
  licenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
  },
  licenseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  licenseType: {
    fontSize: 12,
    color: '#4A90E2',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  linkButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  supportButtonText: {
    flex: 1,
    marginLeft: 12,
  },
  supportButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  supportButtonDescription: {
    fontSize: 12,
    color: '#999',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  copyright: {
    fontSize: 12,
    color: '#444',
  },
});
