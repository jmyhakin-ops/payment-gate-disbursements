import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth.store';
import { paymentsApi, walletsApi } from '../../services/api';

const { width } = Dimensions.get('window');

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const RAIL_COLORS: Record<string, string> = {
  MPESA_B2C: '#10b981', MPESA_B2B: '#059669', PESALINK: '#3b82f6',
  RTGS: '#8b5cf6', EQUITY_JENGA: '#ef4444', KCB_OPENBANKING: '#22c55e',
};

const STATUS_COLORS: Record<string, [string, string]> = {
  COMPLETED: ['#10b981', '#d1fae5'],
  FAILED: ['#ef4444', '#fee2e2'],
  PENDING_DIRECTOR: ['#f59e0b', '#fef3c7'],
  PENDING_CHECKER: ['#f59e0b', '#fef3c7'],
  PROCESSING: ['#6366f1', '#e0e7ff'],
  CANCELLED: ['#6b7280', '#f1f5f9'],
};

export default function DashboardScreen() {
  const { user } = useAuthStore();

  const { data: dashData, isLoading: loadingDash, refetch: refetchDash } = useQuery({
    queryKey: ['mobile-dashboard'],
    queryFn: () => paymentsApi.dashboard().then(r => r.data.data),
  });

  const { data: walletData, isLoading: loadingWallets, refetch: refetchWallets } = useQuery({
    queryKey: ['mobile-wallets'],
    queryFn: () => walletsApi.summary().then(r => r.data.data),
  });

  const isLoading = loadingDash || loadingWallets;

  const onRefresh = () => {
    refetchDash();
    refetchWallets();
  };

  const kpiCards = [
    { label: 'Total Disbursed', value: formatKES(dashData?.totalDisbursed ?? 0), icon: '💸', color: '#6366f1' },
    { label: 'This Month', value: formatKES(dashData?.thisMonth ?? 0), icon: '📈', color: '#10b981' },
    { label: 'Pending', value: dashData?.pending ?? 0, icon: '⏳', color: '#f59e0b' },
    { label: 'Failed', value: dashData?.failed ?? 0, icon: '❌', color: '#ef4444' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#6366f1" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeGreeting()} 👋</Text>
          <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.role}>{user?.role?.replace(/_/g, ' ')}</Text>
        </View>
        <TouchableOpacity
          style={styles.payBtn}
          onPress={() => router.push('/(tabs)/payments/new')}
          activeOpacity={0.85}
        >
          <Text style={styles.payBtnIcon}>+</Text>
          <Text style={styles.payBtnText}>Pay</Text>
        </TouchableOpacity>
      </View>

      {/* Wallet Balance Card */}
      <TouchableOpacity
        style={styles.balanceCard}
        onPress={() => router.push('/(tabs)/wallets')}
        activeOpacity={0.9}
      >
        <Text style={styles.balanceLabel}>Total Wallet Balance</Text>
        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} />
        ) : (
          <Text style={styles.balanceAmount}>{formatKES(walletData?.totalBalance ?? 0)}</Text>
        )}
        <Text style={styles.balanceSub}>
          Available: {formatKES(walletData?.availableBalance ?? 0)} · Reserved: {formatKES(walletData?.reservedAmount ?? 0)}
        </Text>
        <View style={styles.walletChip}>
          <Text style={styles.walletChipText}>View Wallets →</Text>
        </View>
      </TouchableOpacity>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        {kpiCards.map(card => (
          <View key={card.label} style={[styles.kpiCard, { borderLeftColor: card.color }]}>
            <Text style={styles.kpiIcon}>{card.icon}</Text>
            <Text style={[styles.kpiValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.kpiLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: '📱', label: 'M-Pesa B2C', rail: 'MPESA_B2C' },
            { icon: '🏦', label: 'Paybill', rail: 'MPESA_B2B' },
            { icon: '🏛️', label: 'Bank', rail: 'BANK' },
            { icon: '⏳', label: 'Approvals', rail: null, route: '/(tabs)/approvals' },
          ].map(action => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionBtn}
              onPress={() => action.route
                ? router.push(action.route as any)
                : router.push(`/(tabs)/payments/new?rail=${action.rail}` as any)
              }
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pending Approvals Alert */}
      {(dashData?.pendingChecker ?? 0) > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => router.push('/(tabs)/approvals')}
          activeOpacity={0.85}
        >
          <Text style={styles.alertIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{dashData.pendingChecker} Payments Pending Approval</Text>
            <Text style={styles.alertSub}>Tap to review and approve</Text>
          </View>
          <Text style={styles.alertArrow}>→</Text>
        </TouchableOpacity>
      )}

      {(dashData?.pendingDirector ?? 0) > 0 && (
        <TouchableOpacity
          style={[styles.alertCard, { backgroundColor: '#7c3aed' }]}
          onPress={() => router.push('/(tabs)/approvals/director' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.alertIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{dashData.pendingDirector} Payments Awaiting Your Sign-off</Text>
            <Text style={styles.alertSub}>Director authorization required</Text>
          </View>
          <Text style={styles.alertArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/payments')}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#6366f1" style={{ margin: 20 }} />
        ) : (dashData?.recentTransactions ?? []).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>No payments yet</Text>
          </View>
        ) : (dashData?.recentTransactions ?? []).slice(0, 8).map((tx: any) => {
          const [textColor, bgColor] = STATUS_COLORS[tx.status] ?? ['#6b7280', '#f1f5f9'];
          return (
            <TouchableOpacity
              key={tx.id}
              style={styles.txRow}
              onPress={() => router.push(`/(tabs)/payments/${tx.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.txRailDot, { backgroundColor: RAIL_COLORS[tx.rail] ?? '#6366f1' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc} numberOfLines={1}>{tx.recipientName ?? tx.recipientPhone ?? tx.reference}</Text>
                <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString('en-KE')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.txAmount}>{formatKES(tx.amount)}</Text>
                <View style={[styles.txStatusBadge, { backgroundColor: bgColor }]}>
                  <Text style={[styles.txStatusText, { color: textColor }]}>
                    {tx.status?.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { color: '#64748b', fontSize: 13 },
  userName: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', marginTop: 2 },
  role: { color: '#64748b', fontSize: 12, marginTop: 2 },
  payBtn: {
    backgroundColor: '#4f46e5', borderRadius: 16, paddingHorizontal: 18,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  payBtnIcon: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  balanceCard: {
    backgroundColor: '#4f46e5', borderRadius: 24, padding: 24,
    marginBottom: 16, overflow: 'hidden',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  balanceAmount: { color: '#fff', fontSize: 34, fontWeight: '800', marginVertical: 6 },
  balanceSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  walletChip: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12,
  },
  walletChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kpiCard: {
    width: (width - 48) / 2, backgroundColor: '#1e293b', borderRadius: 16,
    padding: 14, borderLeftWidth: 3,
  },
  kpiIcon: { fontSize: 20, marginBottom: 6 },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { color: '#64748b', fontSize: 11, marginTop: 2, fontWeight: '500' },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  seeAll: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  alertCard: {
    backgroundColor: '#b45309', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  alertIcon: { fontSize: 20 },
  alertTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  alertSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  alertArrow: { color: '#fff', fontSize: 20 },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e293b', borderRadius: 14, padding: 12, marginBottom: 6,
  },
  txRailDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  txDesc: { color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  txDate: { color: '#64748b', fontSize: 11, marginTop: 2 },
  txAmount: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  txStatusBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  txStatusText: { fontSize: 10, fontWeight: '600' },
  emptyState: { backgroundColor: '#1e293b', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: '#64748b', fontSize: 14 },
});
