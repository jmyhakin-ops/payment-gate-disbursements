import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/auth.store';
import api from '../../src/services/api';

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Edit Profile', route: 'profile/edit' },
  { icon: 'shield-checkmark-outline', label: 'Security & 2FA', route: 'profile/security' },
  { icon: 'notifications-outline', label: 'Notification Preferences', route: 'profile/notifications' },
  { icon: 'finger-print-outline', label: 'Biometric Login', route: 'profile/biometric', toggle: true },
  { icon: 'key-outline', label: 'Change Password', route: 'profile/password' },
  { icon: 'document-text-outline', label: 'Activity Log', route: 'profile/activity' },
  { icon: 'information-circle-outline', label: 'About / Version', route: 'profile/about' },
];

export default function ProfileTab() {
  const { user, logout } = useAuthStore();
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  });

  const profile = profileData?.user ?? user;

  React.useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(setBiometricAvailable);
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to enable biometric login',
        cancelLabel: 'Cancel',
      });
      if (result.success) setBiometricEnabled(true);
    } else {
      setBiometricEnabled(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      SUPER_ADMIN: { label: 'Super Admin', color: '#7c3aed' },
      ORG_ADMIN: { label: 'Org Admin', color: '#2563eb' },
      DIRECTOR: { label: 'Director', color: '#0891b2' },
      CHECKER: { label: 'Checker', color: '#059669' },
      MAKER: { label: 'Maker', color: '#d97706' },
    };
    return badges[role] ?? { label: role, color: '#6b7280' };
  };

  const roleBadge = getRoleBadge(profile?.role ?? 'MAKER');
  const initials = profile
    ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase()
    : '??';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={['#1e1b4b', '#4338ca']} style={styles.header}>
        <View style={styles.avatarContainer}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.avatarEditBtn}>
            <Ionicons name="camera" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>
          {profile?.firstName} {profile?.lastName}
        </Text>
        <Text style={styles.email}>{profile?.email}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.roleBadge, { backgroundColor: roleBadge.color }]}>
            <Text style={styles.roleBadgeText}>{roleBadge.label}</Text>
          </View>
          {profile?.twoFactorEnabled && (
            <View style={styles.securedBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#10b981" />
              <Text style={styles.securedText}>2FA Active</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Payments Made', value: profile?.totalPayments ?? 0, icon: 'send-outline' },
          { label: 'Approvals Given', value: profile?.totalApprovals ?? 0, icon: 'checkmark-circle-outline' },
          { label: 'Pending', value: profile?.pendingApprovals ?? 0, icon: 'time-outline' },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Ionicons name={stat.icon as any} size={20} color="#6366f1" />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {MENU_ITEMS.map((item, idx) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, idx < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name={item.icon as any} size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            {item.toggle ? (
              <Switch
                value={item.label === 'Biometric Login' ? biometricEnabled : false}
                onValueChange={item.label === 'Biometric Login' ? handleBiometricToggle : undefined}
                disabled={!biometricAvailable && item.label === 'Biometric Login'}
                trackColor={{ false: '#e2e8f0', true: '#818cf8' }}
                thumbColor={biometricEnabled ? '#6366f1' : '#f1f5f9'}
              />
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Organization Info */}
      {profile?.organization && (
        <View style={styles.orgCard}>
          <View style={styles.orgHeader}>
            <Ionicons name="business-outline" size={20} color="#6366f1" />
            <Text style={styles.orgTitle}>Organization</Text>
          </View>
          <Text style={styles.orgName}>{profile.organization.name}</Text>
          <Text style={styles.orgDetail}>KRA PIN: {profile.organization.kraPin ?? 'N/A'}</Text>
          <Text style={styles.orgDetail}>Status: {profile.organization.status ?? 'ACTIVE'}</Text>
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
        {loggingOut ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.version}>KenyaPay v1.0.0 · Build 2026.10</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 60, paddingBottom: 32, alignItems: 'center', paddingHorizontal: 20 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: '#fff' },
  avatarEditBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#6366f1', borderRadius: 12, padding: 6, borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  roleBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  roleBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  securedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#064e3b', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  securedText: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 6 },
  statLabel: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 2 },
  menuSection: { margin: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1e293b' },
  orgCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  orgHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  orgTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  orgName: { fontSize: 16, fontWeight: '700', color: '#6366f1', marginBottom: 4 },
  orgDetail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginVertical: 12, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#fecaca' },
  signOutText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
  version: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginBottom: 32 },
});
