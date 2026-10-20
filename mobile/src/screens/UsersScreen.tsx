import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, RefreshControl, Platform, Alert, StatusBar,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

// ─── Role definitions (same as web app) ──────────────────────────────────────
const ROLES: Record<string, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  SUPER_ADMIN:     { label: 'Super Admin',     color: '#ef4444', bg: '#fef2f2', icon: 'shield',           desc: 'Full platform control' },
  ORG_ADMIN:       { label: 'Org Admin',       color: '#8b5cf6', bg: '#f5f3ff', icon: 'shield-checkmark', desc: 'Full organization admin' },
  FINANCE_MANAGER: { label: 'Finance Mgr',    color: '#3b82f6', bg: '#eff6ff', icon: 'bar-chart',        desc: 'Finance, reports, wallets' },
  DIRECTOR:        { label: 'Director',        color: '#6366f1', bg: '#eef2ff', icon: 'ribbon',           desc: 'Final payment authorization' },
  CHECKER:         { label: 'Checker',         color: '#0ea5e9', bg: '#f0f9ff', icon: 'checkmark-circle', desc: 'Validates & forwards payments' },
  MAKER:           { label: 'Maker',           color: '#10b981', bg: '#ecfdf5', icon: 'create',           desc: 'Creates payment requests' },
  VIEWER:          { label: 'Viewer',          color: '#64748b', bg: '#f8fafc', icon: 'eye',              desc: 'Read-only access' },
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  ACTIVE:    { color: '#16a34a', bg: '#dcfce7' },
  SUSPENDED: { color: '#dc2626', bg: '#fee2e2' },
  PENDING:   { color: '#d97706', bg: '#fef9c3' },
  INACTIVE:  { color: '#64748b', bg: '#f1f5f9' },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function UserAvatar({ firstName, lastName, size = 44, color = '#6366f1' }: any) {
  return (
    <LinearGradient
      colors={[color, color + 'aa']}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.35, fontWeight: '700' }}>
        {firstName?.[0]?.toUpperCase()}{lastName?.[0]?.toUpperCase()}
      </Text>
    </LinearGradient>
  );
}

// ─── User Detail Bottom Sheet ─────────────────────────────────────────────────
function UserDetailSheet({ user, visible, onClose, onRoleChange, onStatusChange }: any) {
  const qc = useQueryClient();
  const roleDef = ROLES[user?.role] ?? ROLES.VIEWER;
  const statusDef = STATUS_COLORS[user?.status] ?? STATUS_COLORS.INACTIVE;

  const statusMutation = useMutation({
    mutationFn: (action: string) => api.put(`/users?userId=${user.id}&action=${action}`),
    onSuccess: (_, action) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['mobile-users'] });
      onStatusChange();
      Alert.alert('Success', `User has been ${action}d.`);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Action failed'),
  });

  if (!user) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ds.overlay}>
        <View style={ds.sheet}>
          <View style={ds.sheetHandle} />
          {/* Header */}
          <LinearGradient colors={['#1e1b4b', '#312e81']} style={ds.sheetHeader}>
            <UserAvatar firstName={user.firstName} lastName={user.lastName} size={56} color={roleDef.color} />
            <View style={{ flex: 1 }}>
              <Text style={ds.sheetName}>{user.firstName} {user.lastName}</Text>
              <Text style={ds.sheetEmail}>{user.email}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <View style={[ds.miniChip, { backgroundColor: roleDef.color + '30', borderColor: roleDef.color }]}>
                  <Text style={[ds.miniChipText, { color: roleDef.color }]}>{roleDef.label}</Text>
                </View>
                <View style={[ds.miniChip, { backgroundColor: statusDef.bg, borderColor: statusDef.color }]}>
                  <Text style={[ds.miniChipText, { color: statusDef.color }]}>{user.status}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={ds.sheetClose}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={ds.sheetBody}>
            {/* Info grid */}
            <View style={ds.infoGrid}>
              {[
                { label: 'Role', value: roleDef.label, icon: 'shield-checkmark-outline' },
                { label: 'Department', value: user.department ?? '—', icon: 'business-outline' },
                { label: 'Job Title', value: user.jobTitle ?? '—', icon: 'briefcase-outline' },
                { label: 'Phone', value: user.phone ?? '—', icon: 'call-outline' },
                { label: '2FA', value: user.twoFactorEnabled ? '✅ Enabled' : '❌ Disabled', icon: 'lock-closed-outline' },
                { label: 'Email Verified', value: user.emailVerified ? 'Yes' : 'No', icon: 'mail-outline' },
                { label: 'Last Login', value: user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never', icon: 'time-outline' },
                { label: 'Member Since', value: new Date(user.createdAt).toLocaleDateString('en-KE'), icon: 'calendar-outline' },
              ].map(({ label, value, icon }) => (
                <View key={label} style={ds.infoCard}>
                  <Ionicons name={icon as any} size={16} color="#6366f1" style={{ marginBottom: 4 }} />
                  <Text style={ds.infoLabel}>{label}</Text>
                  <Text style={ds.infoValue}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Role description banner */}
            <View style={[ds.roleBanner, { backgroundColor: roleDef.bg, borderColor: roleDef.color + '40' }]}>
              <Ionicons name={roleDef.icon as any} size={18} color={roleDef.color} />
              <View style={{ flex: 1 }}>
                <Text style={[ds.roleBannerTitle, { color: roleDef.color }]}>{roleDef.label}</Text>
                <Text style={ds.roleBannerDesc}>{roleDef.desc}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={ds.actionRow}>
              <TouchableOpacity
                style={[ds.actionBtn, { borderColor: '#6366f1' }]}
                onPress={() => { onClose(); onRoleChange(user); }}
              >
                <Ionicons name="shield-outline" size={18} color="#6366f1" />
                <Text style={[ds.actionBtnText, { color: '#6366f1' }]}>Change Role</Text>
              </TouchableOpacity>

              {user.status === 'ACTIVE' ? (
                <TouchableOpacity
                  style={[ds.actionBtn, { borderColor: '#ef4444' }]}
                  onPress={() => Alert.alert('Suspend User', `Suspend ${user.firstName}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Suspend', style: 'destructive', onPress: () => statusMutation.mutate('suspend') },
                  ])}
                >
                  <Ionicons name="ban-outline" size={18} color="#ef4444" />
                  <Text style={[ds.actionBtnText, { color: '#ef4444' }]}>Suspend</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[ds.actionBtn, { borderColor: '#10b981' }]}
                  onPress={() => statusMutation.mutate('activate')}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
                  <Text style={[ds.actionBtnText, { color: '#10b981' }]}>Activate</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Change Role Sheet ────────────────────────────────────────────────────────
function ChangeRoleSheet({ user, visible, onClose }: any) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(user?.role ?? 'MAKER');

  const mutation = useMutation({
    mutationFn: (role: string) => api.put(`/users?userId=${user.id}`, { role }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['mobile-users'] });
      Alert.alert('Role Updated', `${user.firstName}'s role changed to ${ROLES[selected]?.label}`);
      onClose();
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update role'),
  });

  if (!user) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ds.overlay}>
        <View style={[ds.sheet, { maxHeight: '80%' }]}>
          <View style={ds.sheetHandle} />
          <View style={[ds.sheetHeader, { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[ds.sheetName, { color: '#0f172a' }]}>Change Role</Text>
              <Text style={[ds.sheetEmail, { color: '#64748b' }]}>{user.firstName} {user.lastName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[ds.sheetClose, { backgroundColor: '#f1f5f9' }]}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView style={ds.sheetBody}>
            {Object.entries(ROLES).map(([key, def]) => (
              <TouchableOpacity
                key={key}
                style={[ds.roleOption, selected === key && { borderColor: def.color, backgroundColor: def.bg }]}
                onPress={() => setSelected(key)}
              >
                <View style={[ds.roleOptionIcon, { backgroundColor: def.color + '20' }]}>
                  <Ionicons name={def.icon as any} size={20} color={def.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ds.roleOptionLabel, selected === key && { color: def.color }]}>{def.label}</Text>
                  <Text style={ds.roleOptionDesc}>{def.desc}</Text>
                </View>
                {selected === key && <Ionicons name="checkmark-circle" size={20} color={def.color} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={ds.sheetFooter}>
            <TouchableOpacity style={ds.cancelBtn} onPress={onClose}>
              <Text style={ds.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ds.saveBtn, mutation.isPending && { opacity: 0.6 }]}
              disabled={mutation.isPending || selected === user.role}
              onPress={() => mutation.mutate(selected)}
            >
              {mutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={ds.saveBtnText}>Save Role</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function UsersScreen() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<any>(null);

  const canManage = ['SUPER_ADMIN', 'ORG_ADMIN'].includes(me?.role ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-users', search, roleFilter, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) p.set('search', search);
      if (roleFilter) p.set('role', roleFilter);
      return api.get(`/users?${p}`).then((r) => r.data);
    },
    refetchInterval: 60_000,
  });

  const users: any[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, pages: 1 };

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.refetchQueries({ queryKey: ['mobile-users'] });
    setRefreshing(false);
  };

  return (
    <View style={ds.root}>
      {/* Header */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={ds.header}>
        <View style={{ flex: 1 }}>
          <Text style={ds.headerTitle}>Team Members</Text>
          <Text style={ds.headerSub}>{meta.total} users · reads from web app</Text>
        </View>
        {canManage && (
          <View style={[ds.inviteBadge]}>
            <Ionicons name="person-add-outline" size={14} color="#6366f1" />
            <Text style={ds.inviteBadgeText}>Invite via Web App</Text>
          </View>
        )}
      </LinearGradient>

      {/* Role filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ds.roleChipsScroll} contentContainerStyle={ds.roleChipsContainer}>
        <TouchableOpacity
          style={[ds.roleChip, !roleFilter && ds.roleChipActive]}
          onPress={() => setRoleFilter('')}
        >
          <Text style={[ds.roleChipText, !roleFilter && ds.roleChipTextActive]}>All</Text>
        </TouchableOpacity>
        {Object.entries(ROLES).map(([key, def]) => (
          <TouchableOpacity
            key={key}
            style={[ds.roleChip, roleFilter === key && { backgroundColor: def.color, borderColor: def.color }]}
            onPress={() => { setRoleFilter(roleFilter === key ? '' : key); setPage(1); }}
          >
            <Ionicons name={def.icon as any} size={12} color={roleFilter === key ? '#fff' : def.color} />
            <Text style={[ds.roleChipText, roleFilter === key && { color: '#fff' }]}>{def.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search bar */}
      <View style={ds.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={ds.searchInput}
          placeholder="Search name, email..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={(t) => { setSearch(t); setPage(1); }}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#64748b" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* User list */}
      {isLoading && !refreshing ? (
        <View style={ds.loader}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={ds.loaderText}>Loading team members...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={ds.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        >
          {users.length === 0 ? (
            <View style={ds.empty}>
              <Ionicons name="people-outline" size={52} color="#334155" />
              <Text style={ds.emptyTitle}>No users found</Text>
              <Text style={ds.emptySub}>Invite users from the web app</Text>
            </View>
          ) : (
            users.map((u) => {
              const roleDef = ROLES[u.role] ?? ROLES.VIEWER;
              const statusDef = STATUS_COLORS[u.status] ?? STATUS_COLORS.INACTIVE;
              return (
                <TouchableOpacity
                  key={u.id}
                  style={ds.userCard}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedUser(u); }}
                  activeOpacity={0.85}
                >
                  <UserAvatar firstName={u.firstName} lastName={u.lastName} color={roleDef.color} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={ds.userName}>{u.firstName} {u.lastName}</Text>
                    <Text style={ds.userEmail} numberOfLines={1}>{u.email}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                      <View style={[ds.chip, { backgroundColor: roleDef.bg, borderColor: roleDef.color + '50' }]}>
                        <Ionicons name={roleDef.icon as any} size={10} color={roleDef.color} />
                        <Text style={[ds.chipText, { color: roleDef.color }]}>{roleDef.label}</Text>
                      </View>
                      <View style={[ds.chip, { backgroundColor: statusDef.bg, borderColor: statusDef.color + '40' }]}>
                        <Text style={[ds.chipText, { color: statusDef.color }]}>{u.status}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {u.twoFactorEnabled && (
                      <View style={ds.twoFaBadge}>
                        <Ionicons name="lock-closed" size={10} color="#10b981" />
                        <Text style={ds.twoFaText}>2FA</Text>
                      </View>
                    )}
                    <Text style={ds.userJoined}>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'No login'}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#334155" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Pagination */}
          {meta.pages > 1 && (
            <View style={ds.pagination}>
              <TouchableOpacity
                style={[ds.pageBtn, page <= 1 && { opacity: 0.4 }]}
                disabled={page <= 1}
                onPress={() => setPage((p) => p - 1)}
              >
                <Ionicons name="chevron-back" size={16} color="#6366f1" />
                <Text style={ds.pageBtnText}>Prev</Text>
              </TouchableOpacity>
              <Text style={ds.pageInfo}>{page} / {meta.pages}</Text>
              <TouchableOpacity
                style={[ds.pageBtn, page >= meta.pages && { opacity: 0.4 }]}
                disabled={page >= meta.pages}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={ds.pageBtnText}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color="#6366f1" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modals */}
      <UserDetailSheet
        user={selectedUser}
        visible={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onRoleChange={(u: any) => setRoleChangeUser(u)}
        onStatusChange={() => setSelectedUser(null)}
      />
      <ChangeRoleSheet
        user={roleChangeUser}
        visible={!!roleChangeUser}
        onClose={() => setRoleChangeUser(null)}
      />
    </View>
  );
}

const ds = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 24) + 8, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2, fontWeight: '500' },
  inviteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eef2ff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#c7d2fe' },
  inviteBadgeText: { fontSize: 11, fontWeight: '800', color: '#4f46e5' },

  roleChipsScroll: { maxHeight: 48, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  roleChipsContainer: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: 'row' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  roleChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  roleChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  roleChipTextActive: { color: '#fff' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, color: '#1e293b', fontSize: 14 },

  list: { padding: 12, paddingBottom: 40, gap: 10 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  loaderText: { color: '#64748b', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 10 },
  emptyTitle: { color: '#1e293b', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#64748b', fontSize: 13 },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  userEmail: { fontSize: 12, color: '#64748b', marginTop: 1 },
  userJoined: { fontSize: 10, color: '#94a3b8' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },
  twoFaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  twoFaText: { fontSize: 9, fontWeight: '700', color: '#16a34a' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  pageBtnText: { color: '#6366f1', fontWeight: '700', fontSize: 13 },
  pageInfo: { color: '#64748b', fontSize: 13 },

  // Sheet styles
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  sheetName: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  sheetEmail: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  sheetClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 16 },
  sheetFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  miniChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  miniChipText: { fontSize: 11, fontWeight: '700' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  infoCard: { width: '47%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 13, color: '#1e293b', fontWeight: '600' },

  roleBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  roleBannerTitle: { fontSize: 13, fontWeight: '700' },
  roleBannerDesc: { fontSize: 12, color: '#64748b', marginTop: 1 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, backgroundColor: '#fff' },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  roleOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 8 },
  roleOptionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roleOptionLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  roleOptionDesc: { fontSize: 11, color: '#64748b', marginTop: 1 },

  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '700', fontSize: 14 },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#6366f1', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
