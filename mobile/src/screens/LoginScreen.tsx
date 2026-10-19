import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../services/api';

const W = Dimensions.get('window').width;

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

  React.useEffect(() => {
    if (isAuthenticated) { router.replace('/(tabs)'); return; }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
    checkBiometric();
  }, [isAuthenticated]);

  const checkBiometric = async () => {
    const ok = (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync()) && biometricEnabled;
    setBiometricAvail(ok);
    if (ok) triggerBiometric();
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const triggerBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Login to KenyaPay', cancelLabel: 'Use password',
    });
    if (result.success) doLogin(true);
  };

  const doLogin = async (biometric = false) => {
    if (!biometric && (!email.trim() || !password)) {
      shake();
      Alert.alert('Required', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const { user, accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      shake();
      Alert.alert('Login Failed', e?.response?.data?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#030712', '#0f172a', '#1e1b4b']} style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { translateX: shakeAnim }] }]}>

            {/* Logo */}
            <View style={s.logoWrap}>
              <LinearGradient colors={['#4f46e5', '#7c3aed']} style={s.logoCircle}>
                <Text style={s.logoEmoji}>₿</Text>
              </LinearGradient>
              <Text style={s.logoText}>KenyaPay</Text>
              <Text style={s.logoSub}>Enterprise Payment Platform</Text>
            </View>

            {/* Card */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Welcome Back</Text>
              <Text style={s.cardSub}>Sign in to your account</Text>

              {/* Email */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>Email Address</Text>
                <View style={[s.inputBox, focusedField === 'email' && s.inputBoxFocused]}>
                  <Text style={s.inputIcon}>✉️</Text>
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@company.co.ke"
                    placeholderTextColor="#475569"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>Password</Text>
                <View style={[s.inputBox, focusedField === 'password' && s.inputBoxFocused]}>
                  <Text style={s.inputIcon}>🔒</Text>
                  <TextInput
                    style={s.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#475569"
                    secureTextEntry={!showPw}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onSubmitEditing={() => doLogin()}
                  />
                  <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={s.eyeBtn}>{showPw ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign in button */}
              <TouchableOpacity
                onPress={() => doLogin()}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#4f46e5', '#6d28d9']} style={[s.signInBtn, loading && { opacity: 0.7 }]}>
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.signInBtnText}>Sign In →</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Biometric */}
              {biometricAvail && (
                <TouchableOpacity style={s.bioBtn} onPress={triggerBiometric}>
                  <Text style={s.bioBtnText}>🔐 Use Biometrics</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Security badges */}
            <View style={s.badges}>
              {['🔒 256-bit Encrypted', '🛡️ CBK Compliant', '✅ ISO 27001'].map(b => (
                <View key={b} style={s.badge}>
                  <Text style={s.badgeText}>{b}</Text>
                </View>
              ))}
            </View>

            <Text style={s.footer}>
              KenyaPay © {new Date().getFullYear()} · Multi-Rail Payment Platform
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  content: { alignItems: 'center' },

  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  logoEmoji: { color: '#fff', fontSize: 36, fontWeight: '900' },
  logoText: { color: '#f1f5f9', fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  logoSub: { color: '#64748b', fontSize: 13, marginTop: 4 },

  card: { width: '100%', backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155', marginBottom: 24 },
  cardTitle: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  cardSub: { color: '#64748b', fontSize: 14, marginBottom: 24 },

  fieldWrap: { marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 14, borderWidth: 1.5, borderColor: '#334155', paddingHorizontal: 14, height: 52 },
  inputBoxFocused: { borderColor: '#6366f1' },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, color: '#f1f5f9', fontSize: 15 },
  eyeBtn: { fontSize: 18, paddingLeft: 8 },

  signInBtn: { borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  signInBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  bioBtn: { marginTop: 14, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155', borderRadius: 14 },
  bioBtnText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },

  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
  badge: { backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#334155' },
  badgeText: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  footer: { color: '#334155', fontSize: 11, textAlign: 'center' },
});
