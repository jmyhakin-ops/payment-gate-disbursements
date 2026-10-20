import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Animated, Dimensions, SafeAreaView,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../services/api';

const { width: W } = Dimensions.get('window');

export default function LoginScreen() {
  const { setUser, setTokens, biometricEnabled, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
    ]).start();

    // Check biometrics safely without crashing
    checkBiometricSafe();
  }, [isAuthenticated]);

  const checkBiometricSafe = async () => {
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvail(!!(hasHw && isEnrolled && biometricEnabled));
    } catch {
      setBiometricAvail(false);
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  };

  const triggerBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock KenyaPay',
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      if (result.success) {
        doLogin(true);
      }
    } catch (e: any) {
      Alert.alert('Biometric Error', e?.message || 'Authentication could not be completed');
    }
  };

  const doLogin = async (isBiometric = false) => {
    if (!isBiometric && (!email.trim() || !password)) {
      shake();
      Alert.alert('Required Fields', 'Please enter your email and password to sign in.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const { user, accessToken, refreshToken } = res.data.data;
      await setTokens(accessToken, refreshToken);
      setUser(user);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      router.replace('/(tabs)');
    } catch (e: any) {
      shake();
      const msg = e?.response?.data?.message || 'Invalid email or password. Please try again.';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              s.container,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { translateX: shakeAnim }] },
            ]}
          >
            {/* Header / Brand */}
            <View style={s.brandHeader}>
              <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.logoBadge}
              >
                <Text style={s.logoSymbol}>KP</Text>
              </LinearGradient>

              <Text style={s.brandName}>KenyaPay</Text>
              <View style={s.pill}>
                <View style={s.pillDot} />
                <Text style={s.pillText}>ENTERPRISE PAYMENT GATEWAY</Text>
              </View>
            </View>

            {/* Main Card - Bright, Pure White with Soft Shadow */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Sign In</Text>
              <Text style={s.cardSub}>Welcome to your multi-rail treasury portal</Text>

              {/* Email Field */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>WORK EMAIL</Text>
                <View
                  style={[
                    s.inputContainer,
                    focusedField === 'email' && s.inputContainerFocused,
                  ]}
                >
                  <Text style={s.inputIcon}>✉️</Text>
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="director@company.co.ke"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={s.fieldGroup}>
                <View style={s.labelRow}>
                  <Text style={s.label}>PASSWORD</Text>
                </View>
                <View
                  style={[
                    s.inputContainer,
                    focusedField === 'password' && s.inputContainerFocused,
                  ]}
                >
                  <Text style={s.inputIcon}>🔒</Text>
                  <TextInput
                    style={s.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPw}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onSubmitEditing={() => doLogin()}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPw(!showPw)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={s.eyeIcon}>{showPw ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                onPress={() => doLogin()}
                disabled={loading}
                activeOpacity={0.88}
                style={s.btnWrap}
              >
                <LinearGradient
                  colors={['#4f46e5', '#4338ca']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.signInBtn, loading && { opacity: 0.75 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={s.signInBtnText}>Authorize & Sign In  →</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Biometrics */}
              {biometricAvail && (
                <TouchableOpacity
                  style={s.bioBtn}
                  onPress={triggerBiometric}
                  activeOpacity={0.7}
                >
                  <Text style={s.bioBtnText}>⚡ Sign In with Biometrics</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Security Compliance Strip */}
            <View style={s.securityRow}>
              <View style={s.securityBadge}>
                <Text style={s.securityBadgeIcon}>🛡️</Text>
                <Text style={s.securityBadgeText}>CBK Licensed Rails</Text>
              </View>
              <View style={s.securityBadge}>
                <Text style={s.securityBadgeIcon}>🔒</Text>
                <Text style={s.securityBadgeText}>AES-256 TLS 1.3</Text>
              </View>
              <View style={s.securityBadge}>
                <Text style={s.securityBadgeIcon}>⚡</Text>
                <Text style={s.securityBadgeText}>Dual Maker-Checker</Text>
              </View>
            </View>

            {/* Footer */}
            <Text style={s.footerText}>
              KenyaPay v1.0.0 · Unified Kenya Banking & M-Pesa Rails
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc', // Ultra-bright luxury platinum slate
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },

  // Brand Header
  brandHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  logoSymbol: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a', // Rich dark obsidian
    letterSpacing: -0.5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  pillText: {
    color: '#4f46e5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Pure White Card
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 22,
  },

  fieldGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 52,
  },
  inputContainerFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#4f46e5',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    fontSize: 15,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  eyeIcon: {
    fontSize: 16,
    paddingLeft: 8,
  },

  btnWrap: {
    marginTop: 8,
    borderRadius: 14,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  signInBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  bioBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bioBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },

  // Security Row
  securityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  securityBadgeIcon: {
    fontSize: 12,
  },
  securityBadgeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },

  footerText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '500',
  },
});
