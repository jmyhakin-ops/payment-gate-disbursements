import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { paymentsApi } from '../services/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETED:        { label: 'Completed',   color: '#10b981', bg: '#042f2e' },
  PROCESSING:       { label: 'Processing',  color: '#3b82f6', bg: '#0c1e3e' },
  PENDING_CHECKER:  { label: 'Checker',     color: '#f59e0b', bg: '#2d1e06' },
  PENDING_DIRECTOR: { label: 'Director',    color: '#a855f7', bg: '#1e0f40' },
  FAILED:           { label: 'Failed',      color: '#ef4444', bg: '#2d0f0f' },
  CANCELLED:        { label: 'Cancelled',   color: '#64748b', bg: '#1e293b' },
  REJECTED:         { label: 'Rejected',    color: '#f43f5e', bg: '#3a0e1a' },
};
const RAIL_EMOJI: Record<string, string> = {
  MPESA_B2C: '📱', MPESA_B2B_PAYBILL: '🏦', MPESA_B2B_TILL: '🛒',
  PESALINK: '🏛️', RTGS: '💸', EQUITY_JENGA: '⚡', KCB_OPEN_BANKING: '🔑',
};

function fmtKES(n: number) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

const FILTERS = ['ALL', 'PENDING_CHECKER', 'PENDING_DIRECTOR', 'COMPLETED', 'FAILED', 'REJECTED'];

export default function PaymentsScreen() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mobile-payments', search, activeFilter, page],
    queryFn: () => paymentsApi.list({
      search: search || undefined,
      status: activeFilter !== 'ALL' ? activeFilter : undefined,
      page, limit: 20, sortBy: 'createdAt', sortDir: 'desc',
    }).then(r => r.data),
    keepPreviousData: true,
  });

  const payments: any[] = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 1;

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#1e1b4b', '#0f172a']} style={s.header}>
        <Text style={s.headerTitle}>Payments</Text>
        <Text style={s.headerSub}>{total} total transactions</Text>
        {/* Search */}
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={v => { setSearch(v); setPage(1); }}
            placeholder="Search recipient, reference..."
            placeholderTextColor="#475569"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: '#64748b', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterChip, activeFilter === f && s.filterChipActive]}
              onPress={() => { setActiveFilter(f); setPage(1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[s.filterChipText, activeFilter === f && s.filterChipTextActive]}>
                {f === 'ALL' ? 'All' : f.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/payments/new'); }}>
        <LinearGradient colors={['#4f46e5', '#6d28d9']} style={s.fabInner}>
          <Text style={s.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      <ScrollView
        style={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366f1" />}
      >
        {payments.length === 0 && !isLoading ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💳</Text>
            <Text style={s.emptyTitle}>No payments found</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)/payments/new')}>
              <Text style={s.emptyBtnText}>Make First Payment</Text>
            </TouchableOpacity>
          </View>
        ) : payments.map((tx: any) => {
          const st = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.FAILED;
          const initials = ((tx.recipientName ?? '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2)).toUpperCase();
          return (
            <TouchableOpacity
              key={tx.id}
              style={s.txCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(tabs)/payments/${tx.id}` as any); }}
              activeOpacity={0.85}
            >
              {/* Avatar */}
              <View style={[s.txAvatar, { backgroundColor: st.color + '22', borderColor: st.color + '44' }]}>
                <Text style={{ fontSize: 18 }}>{RAIL_EMOJI[tx.rail] ?? '💳'}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.txRecipient} numberOfLines={1}>{tx.recipientName ?? '—'}</Text>
                <Text style={s.txMeta}>
                  {tx.reference?.substring(0, 16)} · {timeAgo(tx.createdAt)}
                </Text>
                <Text style={s.txDesc} numberOfLines={1}>{tx.description ?? tx.rail?.replace(/_/g, ' ')}</Text>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={s.txAmount}>{fmtKES(Number(tx.amount))}</Text>
                <View style={[s.txStatusPill, { backgroundColor: st.bg, borderColor: st.color + '44' }]}>
                  <Text style={[s.txStatusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Pagination */}
        {pages > 1 && (
          <View style={s.pagination}>
            <TouchableOpacity style={[s.pageBtn, page <= 1 && { opacity: 0.3 }]} disabled={page <= 1} onPress={() => setPage(p => p - 1)}>
              <Text style={s.pageBtnText}>← Prev</Text>
            </TouchableOpacity>
            <Text style={s.pageInfo}>{page} / {pages}</Text>
            <TouchableOpacity style={[s.pageBtn, page >= pages && { opacity: 0.3 }]} disabled={page >= pages} onPress={() => setPage(p => p + 1)}>
              <Text style={s.pageBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 14, paddingHorizontal: 16, gap: 10, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 14, height: 48, gap: 10 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '600' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  filterChipText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#ffffff' },

  fab: { position: 'absolute', right: 20, bottom: 90, zIndex: 50 },
  fabInner: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },

  list: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderRadius: 16,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  txAvatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  txRecipient: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  txMeta: { color: '#64748b', fontSize: 11, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '500' },
  txDesc: { color: '#475569', fontSize: 12, marginTop: 3 },
  txAmount: { color: '#059669', fontSize: 15, fontWeight: '900' },
  txStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  txStatusText: { fontSize: 10, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#4f46e5', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4 },
  pageBtn: { backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtnText: { color: '#4f46e5', fontSize: 13, fontWeight: '700' },
  pageInfo: { color: '#64748b', fontSize: 13, fontWeight: '600' },
});
