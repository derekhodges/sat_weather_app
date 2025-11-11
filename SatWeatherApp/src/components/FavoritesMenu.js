import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';

export const FavoritesMenu = () => {
  const {
    showFavoritesMenu,
    setShowFavoritesMenu,
    favorites,
    addToFavorites,
    removeFavorite,
    loadFavorite,
    generateFavoriteName,
  } = useApp();

  const [deletingId, setDeletingId] = useState(null);

  const handleAddToFavorites = async () => {
    const success = await addToFavorites();
    // Menu will update automatically, no need for alert
  };

  const handleRemoveFavorite = (favorite) => {
    Alert.alert(
      'Remove Favorite',
      `Remove "${favorite.name}" from favorites?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFavorite(favorite.id);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleLoadFavorite = (favorite) => {
    loadFavorite(favorite);
  };

  const currentViewName = generateFavoriteName();

  return (
    <Modal
      visible={showFavoritesMenu}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowFavoritesMenu(false)}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => setShowFavoritesMenu(false)}
      >
        <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Favorites</Text>
            <TouchableOpacity
              onPress={() => setShowFavoritesMenu(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Add to Favorites button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddToFavorites}
            disabled={favorites.length >= 10}
          >
            <Text style={styles.addButtonText}>
              ★ Add to Favorites
            </Text>
            <Text style={styles.currentViewText}>{currentViewName}</Text>
          </TouchableOpacity>

          {favorites.length >= 10 && (
            <Text style={styles.warningText}>
              Maximum 10 favorites reached
            </Text>
          )}

          {/* Favorites list */}
          <View style={styles.divider} />

          <ScrollView style={styles.favoritesList}>
            {favorites.length === 0 ? (
              <Text style={styles.emptyText}>
                No favorites yet. Add your first favorite above!
              </Text>
            ) : (
              favorites.map((favorite) => (
                <View key={favorite.id} style={styles.favoriteItem}>
                  <TouchableOpacity
                    style={styles.favoriteContent}
                    onPress={() => handleLoadFavorite(favorite)}
                  >
                    <Text style={styles.favoriteName}>{favorite.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveFavorite(favorite)}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
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
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '85%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  addButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentViewText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  warningText: {
    color: '#ff6b6b',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
  },
  favoritesList: {
    maxHeight: 400,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 32,
    fontSize: 14,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  favoriteContent: {
    flex: 1,
    padding: 16,
  },
  favoriteName: {
    color: '#fff',
    fontSize: 14,
  },
  removeButton: {
    padding: 16,
    paddingLeft: 8,
  },
  removeButtonText: {
    color: '#ff6b6b',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
