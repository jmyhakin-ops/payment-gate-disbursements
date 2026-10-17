import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Image,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../services/api';

export default function LoginScreen() {
  const { setUser, setTokens, biometricEnabled, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/(tabs)');
  }, [isAuthenticated]);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled && biometricEnabled);
    if (compatible && enrolled && biometricEnabled) {
      handleBiometricLogin();
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with biometrics',
        cancelLabel: 'Use password',
        fallbackLabel: 'Use password',
      });
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Re-authenticate using stored credentials
        await doLogin(undefined, undefined, true);
      }
    } catch (e) {
      // Silently fail — user can use password
    }
  };

  const doLogin = async (em?: string, pw?: string, biometric = false) => {
    const loginEmail = em ?? email;
    const loginPw = pw ?? password;
    if (!biometric && (!loginEmail || !loginPw)) {
      Alert.alert('Missing Fields', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(loginEmail, loginPw, show2FA ? twoFactorToken : undefined);
      const { user, accessToken, refreshToken, requiresTwoFactor } = res.data.data;
      if (requiresTwoFactor) {
        setShow2FA(true);
        setLoading(false);
        return;
      }
      await setTokens(accessToken, refreshToken);
      setUser(user);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error?.response?.data?.message ?? 'Login failed. Please check your credentials.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>💳</Text>
          </View>
          <Text style={styles.appName}>KenyaPay</Text>
          <Text style={styles.tagline}>Multi-Rail Payment Platform</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{show2FA ? 'Two-Factor Authentication' : 'Welcome Back'}</Text>
          <Text style={styles.subtitle}>
            {show2FA
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Sign in to your account to continue'
            }
          </Text>

          {!show2FA ? (
            <>
              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.co.ke"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0 }]}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    autoComplete="password"
                  />
                  <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
                    <Text style={styles.eyeText}>{showPw ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/forgot-password')}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={() => doLogin()}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {biometricAvailable && (
                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.8}
                >
                  <Text style={styles.biometricText}>🔐 Sign in with Biometrics</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {/* 2FA Code */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#94a3b8"
                  value={twoFactorToken}
                  onChangeText={t => setTwoFactorToken(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={() => doLogin()}
                disabled={loading || twoFactorToken.length !== 6}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginBtnText}>Verify & Login</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShow2FA(false)} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>← Back to login</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.secureNote}>🔒 256-bit encrypted · Secure connection</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  logoIcon: { fontSize: 36 },
  appName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: '#64748b', marginTop: 4 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: '#334155',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 18 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#f1f5f9', fontSize: 15,
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12,
  },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },
  forgotBtn: { alignItems: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  loginBtn: {
    backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  biometricBtn: {
    marginTop: 12, borderWidth: 1, borderColor: '#334155', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', backgroundColor: '#0f172a',
  },
  biometricText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  otpInput: { textAlign: 'center', fontSize: 28, letterSpacing: 12, fontWeight: '700' },
  secureNote: { textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 24 },
});
