import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ShareMenu = ({ visible, onClose, isAnimating, onSaveScreenshot, onShareImage, onSaveGif, onShareGif }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menu}>
            <Text style={styles.title}>
              {isAnimating ? 'Share Animation' : 'Share Image'}
            </Text>

            {isAnimating ? (
              <>
                {/* Animation options */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onSaveGif();
                  }}
                >
                  <Ionicons name="download-outline" size={24} color="#fff" />
                  <Text style={styles.menuText}>Save Animation Frames</Text>
                  <Text style={styles.menuSubtext}>All frames as photos</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onShareGif();
                  }}
                >
                  <Ionicons name="share-social-outline" size={24} color="#fff" />
                  <Text style={styles.menuText}>Share Current Frame</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Static image options */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onSaveScreenshot();
                  }}
                >
                  <Ionicons name="download-outline" size={24} color="#fff" />
                  <Text style={styles.menuText}>Save Screenshot</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onShareImage();
                  }}
                >
                  <Ionicons name="share-social-outline" size={24} color="#fff" />
                  <Text style={styles.menuText}>Share Image</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.menuItem, styles.cancelItem]}
              onPress={onClose}
            >
              <Ionicons name="close-outline" size={24} color="#999" />
              <Text style={[styles.menuText, styles.cancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    maxWidth: 400,
  },
  menu: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
  },
  menuSubtext: {
    color: '#999',
    fontSize: 12,
    marginLeft: 16,
  },
  cancelItem: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  cancelText: {
    color: '#999',
  },
});

export default ShareMenu;
