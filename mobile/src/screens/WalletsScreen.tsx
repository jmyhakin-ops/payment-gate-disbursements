import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { walletsApi } from '../services/api';

function fmtKES(n: number) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const WALLET_GRADIENTS: [string, string][] = [
  ['#1e3a5f', '#0c2340'],
  ['#1a3a2a', '#0c2018'],
  ['#3b1d7a', '#1e0f40'],
  ['#3a1a1a', '#2d0f0f'],
  ['#1a2a3a', '#0a1828'],
];

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#10b981', PROCESSING: '#3b82f6', PENDING_CHECKER: '#f59e0b',
  PENDING_DIRECTOR: '#a855f7', FAILED: '#ef4444', CANCELLED: '#64748b',
};

export default function WalletsScreen() {
  const [selectedWallet, setSelectedWallet] = useState<any>(null);

  const { data: wallets, isLoading: walletsLoading, refetch: refetchWallets } = useQuery({
    queryKey: ['mobile-wallets-detail'],
    queryFn: () => walletsApi.list().then(r => r.data.data ?? []),
  });

  const { data: ledger, isLoading: ledgerLoading, refetch: refetchLedger } = useQuery({
    queryKey: ['mobile-ledger', selectedWallet?.id],
    queryFn: () => walletsApi.ledger(selectedWallet.id, { limit: 30, page: 1 }).then(r => r.data),
    enabled: !!selectedWallet,
  });

  const walletsArr: any[] = wallets ?? [];
  const active = selectedWallet ?? walletsArr[0];
  const entries: any[] = ledger?.data ?? [];

  const totalBalance = walletsArr.reduce((sum, w) => sum + Number(w.balance), 0);
  const totalReserved = walletsArr.reduce((sum, w) => sum + Number(w.reservedBalance), 0);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#1e1b4b', '#0f172a']} style={s.header}>
        <Text style={s.headerTitle}>Wallets</Text>
        <Text style={s.headerSub}>{walletsArr.length} wallet{walletsArr.length !== 1 ? 's' : ''}</Text>

        {/* Total balance banner */}
        <View style={s.totalBanner}>
          <View>
            <Text style={s.totalLabel}>TOTAL AVAILABLE</Text>
            <Text style={s.totalAmount}>{fmtKES(totalBalance - totalReserved)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.totalLabel}>RESERVED</Text>
            <Text style={s.reservedAmount}>{fmtKES(totalReserved)}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={walletsLoading || ledgerLoading} onRefresh={() => { refetchWallets(); refetchLedger(); }} tintColor="#6366f1" />}
      >
        {/* Wallet cards */}
        <Text style={s.sectionTitle}>My Wallets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.walletScroll}>
          {walletsArr.map((w: any, i: number) => {
            const [c1, c2] = WALLET_GRADIENTS[i % WALLET_GRADIENTS.length];
            const isActive = active?.id === w.id;
            const avail = Number(w.balance) - Number(w.reservedBalance);
            return (
              <TouchableOpacity key={w.id} onPress={() => setSelectedWallet(w)} activeOpacity={0.9}>
                <LinearGradient
                  colors={[c1, c2]}
                  style={[s.walletCard, isActive && s.walletCardActive]}
                >
                  <View style={s.walletCardTop}>
                    <View style={s.walletTypePill}>
                      <Text style={s.walletTypePillText}>{w.type}</Text>
                    </View>
                    <View style={[s.activeDot, { backgroundColor: avail > 0 ? '#10b981' : '#ef4444' }]} />
                  </View>
                  <Text style={s.walletBalance}>{fmtKES(avail)}</Text>
                  <Text style={s.walletName}>{w.name}</Text>
                  {Number(w.reservedBalance) > 0 && (
                    <View style={s.reservedPill}>
                      <Text style={s.reservedPillText}>Reserved: {fmtKES(Number(w.reservedBalance))}</Text>
                    </View>
                  )}
                  {isActive && (
                    <View style={s.selectedMark}>
                      <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
          {walletsArr.length === 0 && (
            <View style={s.noWallets}>
              <Text style={s.noWalletsText}>No wallets configured</Text>
              <Text style={s.noWalletsSub}>Contact your administrator</Text>
            </View>
          )}
        </ScrollView>

        {/* Selected wallet detail */}
        {active && (
          <>
            <View style={s.detailCard}>
              <Text style={s.detailCardTitle}>{active.name}</Text>
              <View style={s.detailGrid}>
                {[
                  { l: 'Balance', v: fmtKES(Number(active.balance)), color: '#10b981' },
                  { l: 'Reserved', v: fmtKES(Number(active.reservedBalance)), color: '#f59e0b' },
                  { l: 'Available', v: fmtKES(Number(active.balance) - Number(active.reservedBalance)), color: '#6366f1' },
                  { l: 'Currency', v: active.currency ?? 'KES', color: '#94a3b8' },
                ].map(({ l, v, color }) => (
                  <View key={l} style={s.detailCell}>
                    <Text style={s.detailCellLabel}>{l}</Text>
                    <Text style={[s.detailCellValue, { color }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Action buttons */}
            <View style={s.actionRow}>
              <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/(tabs)/payments/new')}>
                <LinearGradient colors={['#4f46e5', '#6d28d9']} style={s.actionBtnGrad}>
                  <Text style={s.actionBtnEmoji}>💸</Text>
                </LinearGradient>
                <Text style={s.actionBtnLabel}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/(tabs)/payments')}>
                <View style={[s.actionBtnGrad, { backgroundColor: '#1e3a5f' }]}>
                  <Text style={s.actionBtnEmoji}>📊</Text>
                </View>
                <Text style={s.actionBtnLabel}>History</Text>
              </TouchableOpacity>
            </View>

            {/* Ledger */}
            <Text style={s.sectionTitle}>Recent Transactions</Text>
            {ledgerLoading ? (
              <View style={s.ledgerLoading}>
                <Text style={{ color: '#475569' }}>Loading ledger...</Text>
              </View>
            ) : entries.length === 0 ? (
              <View style={s.ledgerEmpty}>
                <Text style={s.ledgerEmptyText}>No transactions yet for this wallet</Text>
              </View>
            ) : entries.map((e: any) => (
              <TouchableOpacity
                key={e.id}
                style={s.ledgerRow}
                onPress={() => router.push(`/(tabs)/payments/${e.transactionId}` as any)}
                activeOpacity={0.8}
              >
                <View style={[s.ledgerIcon, { backgroundColor: e.type === 'CREDIT' ? '#04291e' : '#291204' }]}>
                  <Text style={{ fontSize: 18 }}>{e.type === 'CREDIT' ? '⬆' : '⬇'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ledgerDesc} numberOfLines={1}>{e.description ?? e.type}</Text>
                  <Text style={s.ledgerDate}>{fmtDate(e.createdAt)}</Text>
                </View>
                <Text style={[s.ledgerAmount, { color: e.type === 'CREDIT' ? '#10b981' : '#ef4444' }]}>
                  {e.type === 'CREDIT' ? '+' : '-'}{fmtKES(Number(e.amount))}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f1e' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 16, paddingHorizontal: 20, gap: 4 },
  headerTitle: { color: '#f1f5f9', fontSize: 26, fontWeight: '800' },
  headerSub: { color: '#475569', fontSize: 13 },
  totalBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#ffffff10', borderRadius: 16, padding: 14, marginTop: 12 },
  totalLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  totalAmount: { color: '#f1f5f9', fontSize: 22, fontWeight: '900', marginTop: 4 },
  reservedAmount: { color: '#f59e0b', fontSize: 18, fontWeight: '800', marginTop: 4 },
  body: { flex: 1 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  walletScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  walletCard: { width: 220, borderRadius: 20, padding: 18, height: 160, marginBottom: 4 },
  walletCardActive: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10 },
  walletCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  walletTypePill: { backgroundColor: '#ffffff15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  walletTypePillText: { color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  walletBalance: { color: '#f1f5f9', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  walletName: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  reservedPill: { backgroundColor: '#f59e0b22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8, alignSelf: 'flex-start' },
  reservedPillText: { color: '#f59e0b', fontSize: 10, fontWeight: '600' },
  selectedMark: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  noWallets: { width: 220, alignItems: 'center', justifyContent: 'center', padding: 30 },
  noWalletsText: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  noWalletsSub: { color: '#475569', fontSize: 13, marginTop: 4 },

  detailCard: { marginHorizontal: 16, backgroundColor: '#1e293b', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#334155' },
  detailCardTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailCell: { width: '47%', backgroundColor: '#0f172a', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  detailCellLabel: { color: '#475569', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  detailCellValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },

  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 16 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
  actionBtnGrad: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionBtnEmoji: { fontSize: 24 },
  actionBtnLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

  ledgerLoading: { alignItems: 'center', padding: 30 },
  ledgerEmpty: { alignItems: 'center', padding: 30 },
  ledgerEmptyText: { color: '#475569', fontSize: 14 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, backgroundColor: '#1e293b', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  ledgerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  ledgerDesc: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  ledgerDate: { color: '#475569', fontSize: 11, marginTop: 2 },
  ledgerAmount: { fontSize: 14, fontWeight: '800' },
});
