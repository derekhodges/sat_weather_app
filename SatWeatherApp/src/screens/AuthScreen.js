/**
 * Authentication Screen
 *
 * Handles user login and signup with option to skip (continue as guest).
 * Only shown when auth is enabled.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen({ onSkip }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (!result.success) {
          Alert.alert('Login Failed', result.error);
        }
      } else {
        const result = await signUp(email, password);
        if (result.success) {
          Alert.alert(
            'Success',
            'Account created! Please check your email to verify your account.',
            [{ text: 'OK', onPress: () => setMode('login') }]
          );
        } else {
          Alert.alert('Signup Failed', result.error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send password reset email to ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            const result = await resetPassword(email);
            if (result.success) {
              Alert.alert('Success', 'Password reset email sent! Check your inbox.');
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Satellite Weather</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#666"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />
          )}

          {mode === 'login' && (
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle Mode */}
          <TouchableOpacity
            onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
            disabled={loading}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip Button */}
        <TouchableOpacity
          onPress={onSkip}
          disabled={loading}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Continue as Guest</Text>
        </TouchableOpacity>

        {/* Info */}
        <Text style={styles.info}>
          Free tier available with limited features.{'\n'}
          Sign up for Premium to unlock all features!
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  form: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    alignItems: 'center',
    padding: 12,
  },
  toggleText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  skipButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 20,
  },
  skipText: {
    color: '#999',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  info: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 20,
    lineHeight: 18,
  },
});
