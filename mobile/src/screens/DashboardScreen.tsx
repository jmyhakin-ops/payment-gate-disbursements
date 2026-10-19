import React, { useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Animated, Platform, Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { paymentsApi, walletsApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';

const W = Dimensions.get('window').width;
const CARD_W = W * 0.72;

function fmtKES(n: number) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#10b981', PROCESSING: '#3b82f6', PENDING_CHECKER: '#f59e0b',
  PENDING_DIRECTOR: '#a855f7', FAILED: '#ef4444', CANCELLED: '#64748b', REJECTED: '#f43f5e',
};
const RAIL_EMOJI: Record<string, string> = {
  MPESA_B2C: '📱', MPESA_B2B_PAYBILL: '🏦', MPESA_B2B_TILL: '🛒',
  PESALINK: '🏛️', RTGS: '💸', EQUITY_JENGA: '⚡', KCB_OPEN_BANKING: '🔑',
};

function StatCard({ label, value, sub, color, icon }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[s.statCard, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[s.statIcon, { backgroundColor: color + '22' }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={s.statValue}>{value}</Text>
      {sub && <Text style={s.statSub}>{sub}</Text>}
      <Text style={[s.statLabel, { color }]}>{label}</Text>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { user, logout } = useAuthStore();
  const scrollX = useRef(new Animated.Value(0)).current;

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['mobile-dash'],
    queryFn: () => paymentsApi.dashboard().then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: walletData, refetch: refetchWallets } = useQuery({
    queryKey: ['mobile-wallets'],
    queryFn: () => walletsApi.list().then(r => r.data.data ?? []),
  });

  const { data: txData, refetch: refetchTx } = useQuery({
    queryKey: ['mobile-recent-tx'],
    queryFn: () => paymentsApi.list({ limit: 10, sortBy: 'createdAt', sortDir: 'desc' }).then(r => r.data.data ?? []),
  });

  const wallets: any[] = walletData ?? [];
  const txs: any[] = txData ?? [];
  const pending = (summary?.pendingApprovals ?? 0) + (summary?.pendingDirector ?? 0);

  const doRefresh = () => { refetch(); refetchWallets(); refetchTx(); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={s.root}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={doRefresh} tintColor="#6366f1" />}
    >
      {/* Header gradient */}
      <LinearGradient colors={['#1e1b4b', '#0f172a']} style={s.headerGrad}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>{greeting} 👋</Text>
            <Text style={s.userName}>{user?.firstName} {user?.lastName}</Text>
            <View style={s.rolePill}>
              <Text style={s.rolePillText}>{user?.role?.replace(/_/g, ' ')}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
            <LinearGradient colors={['#4f46e5', '#7c3aed']} style={s.avatarGrad}>
              <Text style={s.avatarText}>
                {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Wallet carousel */}
        <Text style={s.sectionLabel}>YOUR WALLETS</Text>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        >
          {wallets.length === 0 ? (
            <TouchableOpacity style={[s.walletCard, { width: CARD_W }]} onPress={() => router.push('/(tabs)/wallets')}>
              <Text style={s.walletCardName}>No wallets yet</Text>
              <Text style={s.walletCardSub}>Tap to configure →</Text>
            </TouchableOpacity>
          ) : wallets.map((w: any, i: number) => {
            const colors: [string, string][] = [['#1e3a5f', '#0c2340'], ['#1a3a2a', '#0c2018'], ['#3b1d7a', '#1e0f40'], ['#3a1a1a', '#2d0f0f']];
            const [c1, c2] = colors[i % colors.length];
            return (
              <TouchableOpacity key={w.id} onPress={() => router.push('/(tabs)/wallets')} activeOpacity={0.9}>
                <LinearGradient colors={[c1, c2]} style={[s.walletCard, { width: CARD_W }]}>
                  <View style={s.walletCardHeader}>
                    <Text style={s.walletCardType}>{w.type}</Text>
                    <View style={s.walletDot} />
                  </View>
                  <Text style={s.walletCardBalance}>{fmtKES(Number(w.balance))}</Text>
                  <Text style={s.walletCardName}>{w.name}</Text>
                  {Number(w.reservedBalance) > 0 && (
                    <Text style={s.walletCardReserved}>
                      Reserved: {fmtKES(Number(w.reservedBalance))}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </Animated.ScrollView>
      </LinearGradient>

      <View style={s.body}>
        {/* Pending alert */}
        {pending > 0 && (
          <TouchableOpacity onPress={() => router.push('/(tabs)/approvals')}>
            <LinearGradient colors={['#3b1d7a', '#1e0f40']} style={s.alertBanner}>
              <Text style={s.alertEmoji}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>{pending} Pending Approval{pending > 1 ? 's' : ''}</Text>
                <Text style={s.alertSub}>Tap to review and authorize</Text>
              </View>
              <Text style={s.alertArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* KPI stats */}
        <Text style={s.heading}>This Month</Text>
        <View style={s.statsGrid}>
          <StatCard label="Volume" value={fmtKES(summary?.totalAmountProcessed ?? 0)} icon="💰" color="#10b981" />
          <StatCard label="Transactions" value={String(summary?.completedTransactions ?? 0)} sub="completed" icon="✅" color="#3b82f6" />
          <StatCard label="Pending" value={String(summary?.pendingApprovals ?? 0)} icon="⏳" color="#f59e0b" />
          <StatCard label="Failed" value={String(summary?.failedTransactions ?? 0)} icon="❌" color="#ef4444" />
        </View>

        {/* Quick actions */}
        <Text style={s.heading}>Quick Actions</Text>
        <View style={s.quickActions}>
          {[
            { emoji: '💳', label: 'New Payment', route: '/(tabs)/payments/new', color: '#4f46e5' },
            { emoji: '✅', label: 'Approvals', route: '/(tabs)/approvals', color: '#059669', badge: pending },
            { emoji: '💼', label: 'Wallets', route: '/(tabs)/wallets', color: '#0ea5e9' },
            { emoji: '📊', label: 'History', route: '/(tabs)/payments', color: '#8b5cf6' },
          ].map(a => (
            <TouchableOpacity
              key={a.label}
              style={s.quickBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(a.route as any);
              }}
              activeOpacity={0.8}
            >
              <View style={[s.quickBtnIcon, { backgroundColor: a.color + '22', borderColor: a.color + '44' }]}>
                <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
                {!!a.badge && a.badge > 0 && (
                  <View style={s.quickBadge}><Text style={s.quickBadgeText}>{a.badge}</Text></View>
                )}
              </View>
              <Text style={s.quickBtnLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent transactions */}
        <View style={s.recentHeader}>
          <Text style={s.heading}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/payments')}>
            <Text style={s.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {txs.length === 0 ? (
          <View style={s.emptyTx}>
            <Text style={s.emptyTxEmoji}>💳</Text>
            <Text style={s.emptyTxText}>No transactions yet</Text>
          </View>
        ) : txs.map((tx: any) => (
          <TouchableOpacity
            key={tx.id}
            style={s.txRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/(tabs)/payments/${tx.id}` as any);
            }}
            activeOpacity={0.8}
          >
            <View style={s.txIconWrap}>
              <Text style={{ fontSize: 22 }}>{RAIL_EMOJI[tx.rail] ?? '💳'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.txRecipient} numberOfLines={1}>{tx.recipientName ?? '—'}</Text>
              <Text style={s.txRef}>{tx.reference} · {timeAgo(tx.createdAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.txAmount}>{fmtKES(Number(tx.amount))}</Text>
              <View style={[s.txStatus, { backgroundColor: (STATUS_COLORS[tx.status] ?? '#64748b') + '22' }]}>
                <Text style={[s.txStatusText, { color: STATUS_COLORS[tx.status] ?? '#64748b' }]}>
                  {tx.status?.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f1e' },
  headerGrad: { paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 20 },
  greeting: { color: '#64748b', fontSize: 13 },
  userName: { color: '#f1f5f9', fontSize: 22, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  rolePill: { backgroundColor: '#4f46e522', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: '#4f46e544' },
  rolePillText: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
  avatarBtn: {},
  avatarGrad: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  sectionLabel: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 10 },

  walletCard: { borderRadius: 20, padding: 20, height: 150 },
  walletCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  walletCardType: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  walletDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  walletCardBalance: { color: '#f1f5f9', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  walletCardName: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  walletCardReserved: { color: '#f59e0b', fontSize: 11, marginTop: 4 },
  walletCardSub: { color: '#6366f1', fontSize: 13 },

  body: { padding: 16 },

  alertBanner: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, borderWidth: 1, borderColor: '#7c3aed44' },
  alertEmoji: { fontSize: 24 },
  alertTitle: { color: '#e2d9f3', fontSize: 14, fontWeight: '700' },
  alertSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  alertArrow: { color: '#a78bfa', fontSize: 20 },

  heading: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: { width: (W - 52) / 2, backgroundColor: '#1e293b', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#334155' },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#33415544' },
  statValue: { color: '#f1f5f9', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  statSub: { color: '#475569', fontSize: 11, marginTop: 2 },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },

  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  quickBtn: { alignItems: 'center', flex: 1 },
  quickBtnIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1.5 },
  quickBtnLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  quickBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  quickBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { color: '#6366f1', fontSize: 13, fontWeight: '600' },

  emptyTx: { alignItems: 'center', padding: 40 },
  emptyTxEmoji: { fontSize: 36, marginBottom: 10 },
  emptyTxText: { color: '#475569', fontSize: 14 },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  txIconWrap: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  txRecipient: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  txRef: { color: '#475569', fontSize: 11, marginTop: 3 },
  txAmount: { color: '#10b981', fontSize: 14, fontWeight: '800' },
  txStatus: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  txStatusText: { fontSize: 9, fontWeight: '700' },
});
