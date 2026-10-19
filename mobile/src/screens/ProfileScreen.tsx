import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Platform, Share,
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
  root: { flex: 1, backgroundColor: '#0a0f1e' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#0f172a' },
  name: { color: '#f1f5f9', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  rolePill: { backgroundColor: '#4f46e522', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8, borderWidth: 1, borderColor: '#4f46e544' },
  rolePillText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  email: { color: '#475569', fontSize: 13, marginTop: 6 },
  statsRow: { flexDirection: 'row', width: '100%', marginTop: 18, backgroundColor: '#ffffff0a', borderRadius: 16, padding: 14, gap: 0 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  statLabel: { color: '#475569', fontSize: 10, marginTop: 3, fontWeight: '600', letterSpacing: 0.5 },

  body: { flex: 1, padding: 16 },
  menuGroup: { marginBottom: 20 },
  menuGroupLabel: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 },
  menuCard: { backgroundColor: '#1e293b', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#334155' },
  menuItemIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  menuItemLabel: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  menuItemSub: { color: '#475569', fontSize: 12, marginTop: 2 },
  chevron: { color: '#334155', fontSize: 24, fontWeight: '300' },

  versionBox: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  versionLogo: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  versionAppName: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  versionText: { color: '#334155', fontSize: 11 },
});
