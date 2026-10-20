import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Platform, Share, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../services/api';
import * as SecureStore from 'expo-secure-store';

function getInitials(f?: string, l?: string) {
  return `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrator', ORG_ADMIN: 'Organization Admin',
  FINANCE: 'Finance Officer', CHECKER: 'Checker', DIRECTOR: 'Director', MAKER: 'Maker',
};

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try { await authApi.logout(); } catch {}
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
          logout();
          router.replace('/(auth)');
        },
      },
    ]);
  };

  const menuItems = [
    {
      group: 'Account',
      items: [
        { emoji: '👤', label: 'Profile Details', sub: user?.email ?? '—', onPress: () => {} },
        { emoji: '🔑', label: 'Change Password', sub: 'Update your password', onPress: () => {} },
        { emoji: '🔐', label: 'Biometric Login', sub: 'Fingerprint / Face ID', onPress: () => {} },
      ],
    },
    {
      group: 'Organization',
      items: [
        { emoji: '🏢', label: user?.organization?.name ?? 'My Organization', sub: user?.organization?.status ?? 'ACTIVE', onPress: () => {} },
        { emoji: '💳', label: 'Payment Rails', sub: 'View active rails', onPress: () => router.push('/(tabs)/payments' as any) },
      ],
    },
    {
      group: 'Support',
      items: [
        { emoji: '📞', label: 'Contact Support', sub: 'support@kenyapay.co.ke', onPress: () => {} },
        {
          emoji: '📤', label: 'Share App', sub: 'Invite your team',
          onPress: () => Share.share({ message: 'Use KenyaPay for enterprise payments in Kenya! https://payment-gate-disbursements.vercel.app' }),
        },
      ],
    },
    {
      group: 'Danger Zone',
      items: [
        { emoji: '🚪', label: 'Sign Out', sub: 'Log out of KenyaPay', onPress: handleLogout, danger: true },
      ],
    },
  ];

  return (
    <View style={s.root}>
      <LinearGradient colors={['#1e1b4b', '#0f172a']} style={s.header}>
        {/* Avatar */}
        <View style={s.avatarWrap}>
          <LinearGradient colors={['#4f46e5', '#7c3aed']} style={s.avatar}>
            <Text style={s.avatarText}>{getInitials(user?.firstName, user?.lastName)}</Text>
          </LinearGradient>
          <View style={s.onlineDot} />
        </View>
        <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
        <View style={s.rolePill}>
          <Text style={s.rolePillText}>{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</Text>
        </View>
        <Text style={s.email}>{user?.email}</Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { l: 'Role', v: user?.role?.replace(/_/g, ' ') ?? '—' },
            { l: 'Status', v: user?.status ?? 'ACTIVE' },
            { l: 'Org', v: user?.organization?.name?.split(' ')[0] ?? '—' },
          ].map(({ l, v }) => (
            <View key={l} style={s.statItem}>
              <Text style={s.statValue} numberOfLines={1}>{v}</Text>
              <Text style={s.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
        {menuItems.map(group => (
          <View key={group.group} style={s.menuGroup}>
            <Text style={s.menuGroupLabel}>{group.group.toUpperCase()}</Text>
            <View style={s.menuCard}>
              {group.items.map((item: any, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[s.menuItem, i < group.items.length - 1 && s.menuItemBorder]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.onPress?.(); }}
                  activeOpacity={0.75}
                >
                  <View style={[s.menuItemIcon, item.danger && { backgroundColor: '#2d0f0f' }]}>
                    <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.menuItemLabel, item.danger && { color: '#ef4444' }]}>{item.label}</Text>
                    <Text style={s.menuItemSub} numberOfLines={1}>{item.sub}</Text>
                  </View>
                  <Text style={[s.chevron, item.danger && { color: '#ef4444' }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* App version */}
        <View style={s.versionBox}>
          <LinearGradient colors={['#4f46e5', '#7c3aed']} style={s.versionLogo}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>₿</Text>
          </LinearGradient>
          <Text style={s.versionAppName}>KenyaPay</Text>
          <Text style={s.versionText}>v1.0.0 · Multi-Rail Payment Platform</Text>
          <Text style={s.versionText}>CBK Regulated · ISO 27001 Certified</Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 24) + 8, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 10 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#ffffff' },
  name: { color: '#0f172a', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  rolePill: { backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 8, borderWidth: 1, borderColor: '#c7d2fe' },
  rolePillText: { color: '#4f46e5', fontSize: 12, fontWeight: '800' },
  email: { color: '#64748b', fontSize: 13, marginTop: 6, fontWeight: '500' },
  statsRow: { flexDirection: 'row', width: '100%', marginTop: 18, backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, gap: 0, borderWidth: 1, borderColor: '#e2e8f0' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  statLabel: { color: '#64748b', fontSize: 10, marginTop: 3, fontWeight: '700', letterSpacing: 0.5 },

  body: { flex: 1, padding: 16 },
  menuGroup: { marginBottom: 20 },
  menuGroupLabel: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 },
  menuCard: { backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuItemIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  menuItemLabel: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  menuItemSub: { color: '#64748b', fontSize: 12, marginTop: 2, fontWeight: '500' },
  chevron: { color: '#cbd5e1', fontSize: 24, fontWeight: '300' },

  versionBox: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  versionLogo: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  versionAppName: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  versionText: { color: '#94a3b8', fontSize: 11, fontWeight: '500' },
});
