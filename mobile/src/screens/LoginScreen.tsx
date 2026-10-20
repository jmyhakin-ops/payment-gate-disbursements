import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../services/api';

const { width: W, height: H } = Dimensions.get('window');

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
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
      return;
    }

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    // Logo pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

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
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      shake();
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      const response = await authApi.login(email.trim().toLowerCase(), password);
      const res = response.data?.data ?? response.data;
      setUser(res.user);
      await setTokens(res.accessToken, res.refreshToken);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.replace('/(tabs)');
    } catch (err: any) {
      shake();
      Alert.alert('Login Failed', err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        fallbackLabel: 'Use Password',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        router.replace('/(tabs)');
      }
    } catch {
      // silent fail
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="#f8fafc" barStyle="dark-content" />

      {/* Top status bar area - solid white, clock/wifi visible */}
      <View style={styles.statusBarPlaceholder} />

      {/* Subtle top accent gradient strip */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccentStrip}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ═══ HERO SECTION ═══ */}
          <Animated.View
            style={[
              styles.hero,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Logo badge */}
            <Animated.View
              style={[
                styles.logoWrapper,
                { transform: [{ scale: Animated.multiply(logoScale, logoPulse) }] },
              ]}
            >
              <LinearGradient
                colors={['#6366f1', '#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Text style={styles.logoMonogram}>KP</Text>
              </LinearGradient>
              {/* Glow ring */}
              <View style={styles.logoGlow} />
              {/* Active dot */}
              <View style={styles.activeDot}>
                <View style={styles.activeDotInner} />
              </View>
            </Animated.View>

            <Text style={styles.appName}>KenyaPay</Text>
            <Text style={styles.appTagline}>Enterprise Payment Gateway</Text>

            {/* Trust badges */}
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>🔒</Text>
                <Text style={styles.badgeText}>256-bit SSL</Text>
              </View>
              <View style={styles.badgeDivider} />
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>🇰🇪</Text>
                <Text style={styles.badgeText}>CBK Compliant</Text>
              </View>
              <View style={styles.badgeDivider} />
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>✓</Text>
                <Text style={styles.badgeText}>PCI DSS</Text>
              </View>
            </View>
          </Animated.View>

          {/* ═══ CARD FORM ═══ */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { translateX: shakeAnim },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Access your payment dashboard</Text>

            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputWrapperFocused,
                ]}
              >
                <Text style={styles.inputIcon}>✉</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@company.com"
                  placeholderTextColor="#cbd5e1"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
                {email.length > 0 && (
                  <TouchableOpacity onPress={() => setEmail('')} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputWrapperFocused,
                ]}
              >
                <Text style={styles.inputIcon}>🔑</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#cbd5e1"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                  <Text style={styles.eyeBtnText}>{showPw ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={styles.signInBtn}
            >
              <LinearGradient
                colors={loading ? ['#a5b4fc', '#c4b5fd'] : ['#6366f1', '#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                {loading ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.signInBtnText}>  Signing in…</Text>
                  </View>
                ) : (
                  <Text style={styles.signInBtnText}>Sign In  →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            {biometricAvail && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Biometric */}
                <TouchableOpacity onPress={handleBiometric} style={styles.bioBtn} activeOpacity={0.8}>
                  <Text style={styles.bioBtnIcon}>🔐</Text>
                  <Text style={styles.bioBtnText}>Sign in with Biometrics</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          {/* ═══ BOTTOM ═══ */}
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <Text style={styles.footerVersion}>KenyaPay v3.5.0  ·  Enterprise Edition</Text>
            <Text style={styles.footerCopy}>© 2026 KenyaPay. All rights reserved.</Text>
            <View style={styles.footerBadgeRow}>
              <Text style={styles.footerBadge}>🌍 Kenya</Text>
              <Text style={styles.footerBadgeDot}>·</Text>
              <Text style={styles.footerBadge}>💳 Mpesa · Airtel · Bank Transfer</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex: { flex: 1 },
  statusBarPlaceholder: {
    height: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44,
    backgroundColor: '#f8fafc',
  },
  topAccentStrip: {
    height: 3,
    width: '100%',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: '#f8fafc',
  },

  // ── HERO ──
  hero: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 28,
  },
  logoWrapper: {
    width: 96,
    height: 96,
    borderRadius: 28,
    marginBottom: 16,
    position: 'relative',
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
  },
  logoMonogram: {
    fontSize: 38,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  logoGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: 'rgba(99,102,241,0.25)',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDotInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10b981',
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -1,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeIcon: { fontSize: 12 },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.2,
  },
  badgeDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },

  // ── CARD ──
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '400',
    marginBottom: 28,
  },

  // ── FIELDS ──
  fieldGroup: { marginBottom: 18 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapperFocused: {
    borderColor: '#6366f1',
    backgroundColor: '#fafbff',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    color: '#94a3b8',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
  },
  eyeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeBtnText: { fontSize: 17 },

  // ── SIGN IN BTN ──
  signInBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  signInGradient: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  signInBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ── DIVIDER ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },

  // ── BIOMETRIC ──
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fafbff',
    height: 52,
    gap: 10,
  },
  bioBtnIcon: { fontSize: 20 },
  bioBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4f46e5',
  },

  // ── FOOTER ──
  footer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerVersion: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
  },
  footerCopy: {
    fontSize: 11,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  footerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBadge: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  footerBadgeDot: {
    fontSize: 11,
    color: '#cbd5e1',
  },
});
