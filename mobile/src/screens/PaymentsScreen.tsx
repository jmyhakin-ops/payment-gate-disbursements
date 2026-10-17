import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { paymentsApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, [string, string]> = {
  COMPLETED: ['#10b981', '#d1fae5'],
  FAILED: ['#ef4444', '#fee2e2'],
  PENDING_DIRECTOR: ['#f59e0b', '#fef3c7'],
  PENDING_CHECKER: ['#f59e0b', '#fef3c7'],
  PROCESSING: ['#6366f1', '#e0e7ff'],
  CANCELLED: ['#6b7280', '#1e293b'],
};

const RAIL_ICONS: Record<string, string> = {
  MPESA_B2C: '📱', MPESA_B2B: '🏦', MPESA_PAYBILL: '🏦',
  MPESA_TILL: '🛒', BANK: '🏛️', RTGS: '💸',
  EQUITY_JENGA: '🔷', KCB_OPENBANKING: '🟩',
};

const STATUS_FILTERS = ['ALL', 'PENDING_CHECKER', 'PENDING_DIRECTOR', 'COMPLETED', 'FAILED'];

export default function PaymentsScreen() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const params: Record<string, any> = { page, limit: 25 };
  if (search) params.search = search;
  if (statusFilter !== 'ALL') params.status = statusFilter;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mobile-payments', params],
    queryFn: () => paymentsApi.list(params).then(r => r.data),
    keepPreviousData: true,
  });

  const payments: any[] = data?.data ?? [];
  const hasMore = data?.pagination?.page < data?.pagination?.pages;

  const renderItem = ({ item }: { item: any }) => {
    const [textColor, bgColor] = STATUS_COLORS[item.status] ?? ['#6b7280', '#1e293b'];
    return (
      <TouchableOpacity
        style={styles.paymentCard}
        onPress={() => router.push(`/(tabs)/payments/${item.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={styles.cardRow}>
          <View style={styles.railIcon}>
            <Text style={{ fontSize: 20 }}>{RAIL_ICONS[item.rail] ?? '💳'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recipientName} numberOfLines={1}>
              {item.recipientName ?? item.recipientPhone ?? item.paybillNumber ?? item.reference}
            </Text>
            <Text style={styles.txRef}>{item.reference} · {new Date(item.createdAt).toLocaleDateString('en-KE')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatKES(item.amount)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
              <Text style={[styles.statusText, { color: textColor }]}>
                {item.status?.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Search payments..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status Filter Chips */}
      <FlatList
        data={STATUS_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => i}
        contentContainerStyle={styles.chipsRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, statusFilter === item && styles.chipActive]}
            onPress={() => { setStatusFilter(item); setPage(1); }}
          >
            <Text style={[styles.chipText, statusFilter === item && { color: '#fff' }]}>
              {item.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Payment List */}
      <FlatList
        data={payments}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => { setPage(1); refetch(); }} tintColor="#6366f1" />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color="#6366f1" style={{ margin: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>💸</Text>
              <Text style={styles.emptyText}>No payments found</Text>
            </View>
          )
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setPage(p => p + 1)}>
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/payments/new' as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  searchContainer: { padding: 12 },
  searchInput: {
    backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#f1f5f9', fontSize: 14, borderWidth: 1, borderColor: '#334155',
  },
  chipsRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  list: { padding: 12, paddingBottom: 100, gap: 8 },
  paymentCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#334155' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  railIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center',
  },
  recipientName: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  txRef: { color: '#64748b', fontSize: 11, marginTop: 2 },
  amount: { color: '#f1f5f9', fontSize: 14, fontWeight: '800' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#64748b', fontSize: 14 },
  loadMoreBtn: {
    backgroundColor: '#1e293b', borderRadius: 12, margin: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  loadMoreText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 32 },
});
