import React, { useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Animated, Platform, Dimensions, SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { paymentsApi, walletsApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';

const { width: W } = Dimensions.get('window');
const CARD_W = W * 0.76;

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

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: '#ecfdf5', text: '#059669' },
  PROCESSING: { bg: '#eff6ff', text: '#2563eb' },
  PENDING_CHECKER: { bg: '#fffbeb', text: '#d97706' },
  PENDING_DIRECTOR: { bg: '#faf5ff', text: '#7c3aed' },
  FAILED: { bg: '#fef2f2', text: '#dc2626' },
  CANCELLED: { bg: '#f1f5f9', text: '#475569' },
  REJECTED: { bg: '#fff1f2', text: '#e11d48' },
};

const RAIL_EMOJI: Record<string, string> = {
  MPESA_B2C: '📱', MPESA_B2B_PAYBILL: '🏦', MPESA_B2B_TILL: '🛒',
  PESALINK: '🏛️', RTGS: '💸', EQUITY_JENGA: '⚡', KCB_OPEN_BANKING: '🔑',
};

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: color + '15' }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={s.statValue}>{value}</Text>
      {sub && <Text style={s.statSub}>{sub}</Text>}
      <Text style={[s.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuthStore();
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

  const doRefresh = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    refetch();
    refetchWallets();
    refetchTx();
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={doRefresh} tintColor="#4f46e5" />}
      >
        {/* Top Header - Bright Luxury Indigo Banner */}
        <LinearGradient
          colors={['#4f46e5', '#4338ca', '#3730a3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.headerGrad}
        >
          <View style={s.headerTop}>
            <View>
              <Text style={s.greeting}>{greeting} 👋</Text>
              <Text style={s.userName}>{user?.firstName || 'Director'} {user?.lastName || ''}</Text>
              <View style={s.rolePill}>
                <Text style={s.rolePillText}>{(user?.role || 'ORGANIZATION DIRECTOR').replace(/_/g, ' ')}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.avatarBtn}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.85}
            >
              <View style={s.avatarBg}>
                <Text style={s.avatarText}>
                  {(user?.firstName?.[0] ?? 'K') + (user?.lastName?.[0] ?? 'P')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Wallets Carousel Header */}
          <Text style={s.sectionLabel}>ACTIVE TREASURY BALANCES</Text>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 16 }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          >
            {wallets.length === 0 ? (
              <TouchableOpacity
                style={[s.walletCard, { width: CARD_W, backgroundColor: '#ffffff' }]}
                onPress={() => router.push('/(tabs)/wallets')}
              >
                <Text style={s.walletCardName}>Treasury Operational Wallet</Text>
                <Text style={s.walletCardBalance}>KES 0.00</Text>
                <Text style={s.walletCardSub}>Tap to configure rails →</Text>
              </TouchableOpacity>
            ) : (
              wallets.map((w: any, i: number) => {
                const isFirst = i === 0;
                return (
                  <TouchableOpacity
                    key={w.id || i}
                    onPress={() => router.push('/(tabs)/wallets')}
                    activeOpacity={0.92}
                  >
                    <View style={[s.walletCard, { width: CARD_W, backgroundColor: isFirst ? '#ffffff' : '#f8fafc' }]}>
                      <View style={s.walletCardHeader}>
                        <View style={s.walletTypeBadge}>
                          <Text style={s.walletCardType}>{w.type || 'MULTI-RAIL'}</Text>
                        </View>
                        <View style={s.walletDot} />
                      </View>
                      <Text style={s.walletCardBalance}>{fmtKES(Number(w.balance || 0))}</Text>
                      <Text style={s.walletCardName}>{w.name || 'Primary Float Wallet'}</Text>
                      {Number(w.reservedBalance) > 0 && (
                        <Text style={s.walletCardReserved}>
                          Reserved: {fmtKES(Number(w.reservedBalance))}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </Animated.ScrollView>
        </LinearGradient>

        {/* Content Body - Clean Bright White Background */}
        <View style={s.body}>
          {/* Pending Approvals Notice Banner */}
          {pending > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/approvals')}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#fffbeb', '#fef3c7']}
                style={s.alertBanner}
              >
                <Text style={s.alertEmoji}>🔔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.alertTitle}>{pending} Pending Authorization{pending > 1 ? 's' : ''}</Text>
                  <Text style={s.alertSub}>Tap to review checker & director queues</Text>
                </View>
                <Text style={s.alertArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Quick Action Buttons */}
          <View style={s.quickActions}>
            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => router.push('/(tabs)/payments/new')}
              activeOpacity={0.8}
            >
              <View style={[s.quickBtnIcon, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}>
                <Text style={{ fontSize: 22 }}>⚡</Text>
              </View>
              <Text style={s.quickBtnLabel}>New Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => router.push('/(tabs)/approvals')}
              activeOpacity={0.8}
            >
              <View style={[s.quickBtnIcon, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={{ fontSize: 22 }}>🛡️</Text>
                {pending > 0 && (
                  <View style={s.quickBadge}>
                    <Text style={s.quickBadgeText}>{pending}</Text>
                  </View>
                )}
              </View>
              <Text style={s.quickBtnLabel}>Approvals</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => router.push('/(tabs)/wallets')}
              activeOpacity={0.8}
            >
              <View style={[s.quickBtnIcon, { backgroundColor: '#fdf4ff', borderColor: '#f5d0fe' }]}>
                <Text style={{ fontSize: 22 }}>💼</Text>
              </View>
              <Text style={s.quickBtnLabel}>Float Balances</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => router.push('/(tabs)/users')}
              activeOpacity={0.8}
            >
              <View style={[s.quickBtnIcon, { backgroundColor: '#fefce8', borderColor: '#fef08a' }]}>
                <Text style={{ fontSize: 22 }}>👥</Text>
              </View>
              <Text style={s.quickBtnLabel}>Team Roles</Text>
            </TouchableOpacity>
          </View>

          {/* KPI Metrics Grid */}
          <Text style={s.heading}>Performance & Disbursements</Text>
          <View style={s.statsGrid}>
            <StatCard
              label="TOTAL DISBURSED"
              value={fmtKES(Number(summary?.totalDisbursed ?? 0))}
              sub={`${summary?.successCount ?? 0} successful payouts`}
              color="#059669"
              icon="💰"
            />
            <StatCard
              label="ACTIVE RAILS"
              value="5 Active"
              sub="M-Pesa, PesaLink, RTGS"
              color="#4f46e5"
              icon="⚡"
            />
            <StatCard
              label="CHECKER QUEUE"
              value={`${summary?.pendingApprovals ?? 0} Items`}
              sub="Awaiting first review"
              color="#d97706"
              icon="📋"
            />
            <StatCard
              label="DIRECTOR PIN QUEUE"
              value={`${summary?.pendingDirector ?? 0} Items`}
              sub="Final authorization"
              color="#7c3aed"
              icon="🔐"
            />
          </View>

          {/* Recent Disbursements List */}
          <View style={s.recentHeader}>
            <Text style={s.heading}>Recent Disbursements</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/payments')}>
              <Text style={s.seeAll}>View All →</Text>
            </TouchableOpacity>
          </View>

          {txs.length === 0 ? (
            <View style={s.emptyTx}>
              <Text style={s.emptyTxEmoji}>💳</Text>
              <Text style={s.emptyTxText}>No transactions recorded yet.</Text>
            </View>
          ) : (
            txs.slice(0, 6).map((tx: any) => {
              const statusCfg = STATUS_CONFIG[tx.status] || { bg: '#f1f5f9', text: '#475569' };
              const emoji = RAIL_EMOJI[tx.rail] || '💸';

              return (
                <TouchableOpacity
                  key={tx.id}
                  style={s.txRow}
                  onPress={() => router.push(`/(tabs)/payments/${tx.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={s.txIconWrap}>
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txRecipient} numberOfLines={1}>
                      {tx.recipientName || tx.accountNumber || 'Payment'}
                    </Text>
                    <Text style={s.txRef}>
                      {tx.reference} · {timeAgo(tx.createdAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.txAmount}>{fmtKES(Number(tx.amount))}</Text>
                    <View style={[s.txStatus, { backgroundColor: statusCfg.bg }]}>
                      <Text style={[s.txStatusText, { color: statusCfg.text }]}>
                        {tx.status?.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc', // Ultra-bright luxury platinum slate
  },
  headerGrad: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 8,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: {
    color: '#e0e7ff',
    fontSize: 13,
    fontWeight: '600',
  },
  userName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  rolePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  rolePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  avatarBtn: {},
  avatarBg: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '900',
  },

  sectionLabel: {
    color: '#e0e7ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  walletCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  walletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  walletTypeBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  walletCardType: {
    color: '#4f46e5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  walletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  walletCardBalance: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  walletCardName: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  walletCardReserved: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  walletCardSub: {
    color: '#4f46e5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },

  body: {
    padding: 16,
  },

  alertBanner: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  alertEmoji: {
    fontSize: 22,
  },
  alertTitle: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '800',
  },
  alertSub: {
    color: '#b45309',
    fontSize: 12,
    marginTop: 2,
  },
  alertArrow: {
    color: '#92400e',
    fontSize: 18,
    fontWeight: '900',
  },

  heading: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 4,
    letterSpacing: -0.3,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  quickBtn: {
    alignItems: 'center',
    flex: 1,
  },
  quickBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    position: 'relative',
  },
  quickBtnLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  quickBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: (W - 42) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 0.6,
  },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seeAll: {
    color: '#4f46e5',
    fontSize: 13,
    fontWeight: '700',
  },

  emptyTx: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTxEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTxText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txRecipient: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  txRef: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '900',
  },
  txStatus: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  txStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
});
