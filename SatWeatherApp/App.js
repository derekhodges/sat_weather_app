import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View, AppState } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { AppProvider } from './src/context/AppContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { MainScreen } from './src/screens/MainScreen';
import AuthScreen from './src/screens/AuthScreen';
import { initAnalytics, shutdownAnalytics, logError } from './src/services/analytics';

// Auth gate component - only shows auth screen if enabled and user not authenticated
function AuthGate() {
  const { isAuthenticated, authEnabled, loading } = useAuth();
  const [hasSkipped, setHasSkipped] = useState(false);

  // Show loading while checking auth state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  // If auth is disabled, go straight to main screen
  if (!authEnabled) {
    return <MainScreen />;
  }

  // If user is authenticated or has skipped login, show main screen
  if (isAuthenticated || hasSkipped) {
    return <MainScreen />;
  }

  // Otherwise show auth screen with option to skip
  return <AuthScreen onSkip={() => setHasSkipped(true)} />;
}

export default function App() {
  // Keep screen awake while app is open
  useKeepAwake();

  // Initialize analytics and handle app lifecycle
  useEffect(() => {
    initAnalytics().catch(err => console.error('Failed to init analytics:', err));

    // Track app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        shutdownAnalytics().catch(err => console.error('Failed to shutdown analytics:', err));
      } else if (nextAppState === 'active') {
        initAnalytics().catch(err => console.error('Failed to reinit analytics:', err));
      }
    });

    // Global error handler
    const errorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logError(error, 'global_error_handler', { isFatal });
      errorHandler(error, isFatal);
    });

    return () => {
      subscription?.remove();
      shutdownAnalytics().catch(err => console.error('Shutdown error:', err));
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppProvider>
            <AuthGate />
            <StatusBar style="light" />
          </AppProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
