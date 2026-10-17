import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../src/services/api';

const { width } = Dimensions.get('window');

const WALLET_COLORS: [string, string][] = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#06b6d4'],
  ['#10b981', '#059669'],
  ['#f59e0b', '#d97706'],
];

interface Wallet {
  id: string;
  name: string;
  currency: string;
  balance: number;
  availableBalance: number;
  accountNumber: string;
  type: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
  balance: number;
}

export default function WalletsTab() {
  const [selectedWallet, setSelectedWallet] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: walletsData, refetch: refetchWallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallets').then((r) => r.data),
  });

  const { data: ledgerData, refetch: refetchLedger } = useQuery({
    queryKey: ['ledger', selectedWallet],
    queryFn: () =>
      selectedWallet
        ? api.get(`/wallets/${selectedWallet}/ledger?limit=20`).then((r) => r.data)
        : Promise.resolve({ transactions: [] }),
    enabled: !!selectedWallet,
  });

  const wallets: Wallet[] = walletsData?.wallets ?? [];
  const transactions: Transaction[] = ledgerData?.transactions ?? [];

  React.useEffect(() => {
    if (wallets.length > 0 && !selectedWallet) {
      setSelectedWallet(wallets[0].id);
    }
  }, [wallets]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchWallets(), refetchLedger()]);
    setRefreshing(false);
  };

  const formatMoney = (amount: number, currency = 'KES') => {
    return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const selectedWalletData = wallets.find((w) => w.id === selectedWallet);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
    >
      {/* Header */}
      <LinearGradient colors={['#1e1b4b', '#312e81']} style={styles.header}>
        <Text style={styles.headerTitle}>Wallets</Text>
        <Text style={styles.headerSubtitle}>{wallets.length} account{wallets.length !== 1 ? 's' : ''}</Text>
      </LinearGradient>

      {/* Wallet Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll} contentContainerStyle={styles.cardsContainer}>
        {wallets.map((wallet, idx) => (
          <TouchableOpacity key={wallet.id} onPress={() => setSelectedWallet(wallet.id)} activeOpacity={0.85}>
            <LinearGradient
              colors={WALLET_COLORS[idx % WALLET_COLORS.length]}
              style={[styles.walletCard, selectedWallet === wallet.id && styles.walletCardSelected]}
            >
              <View style={styles.walletCardHeader}>
                <Text style={styles.walletName}>{wallet.name}</Text>
                <View style={styles.walletTypeBadge}>
                  <Text style={styles.walletTypeText}>{wallet.type}</Text>
                </View>
              </View>
              <Text style={styles.walletBalance}>{formatMoney(wallet.balance, wallet.currency)}</Text>
              <View style={styles.walletAvail}>
                <Text style={styles.walletAvailLabel}>Available</Text>
                <Text style={styles.walletAvailAmount}>{formatMoney(wallet.availableBalance, wallet.currency)}</Text>
              </View>
              <Text style={styles.walletAccount}>{wallet.accountNumber}</Text>
              {selectedWallet === wallet.id && (
                <View style={styles.selectedIndicator} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        ))}

        {wallets.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="wallet-outline" size={40} color="#6366f1" />
            <Text style={styles.emptyCardText}>No wallets yet</Text>
            <Text style={styles.emptyCardSub}>Contact your admin to set up wallets</Text>
          </View>
        )}
      </ScrollView>

      {/* Summary Row */}
      {selectedWalletData && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="arrow-down-circle" size={22} color="#10b981" />
            <Text style={styles.summaryLabel}>Total In</Text>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>
              {formatMoney(transactions.filter((t) => t.type === 'CREDIT').reduce((a, t) => a + t.amount, 0))}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="arrow-up-circle" size={22} color="#ef4444" />
            <Text style={styles.summaryLabel}>Total Out</Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
              {formatMoney(transactions.filter((t) => t.type === 'DEBIT').reduce((a, t) => a + t.amount, 0))}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="swap-horizontal" size={22} color="#6366f1" />
            <Text style={styles.summaryLabel}>Transactions</Text>
            <Text style={[styles.summaryValue, { color: '#6366f1' }]}>{transactions.length}</Text>
          </View>
        </View>
      )}

      {/* Ledger */}
      <View style={styles.ledgerSection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyLedger}>
            <Ionicons name="receipt-outline" size={36} color="#94a3b8" />
            <Text style={styles.emptyLedgerText}>No transactions yet</Text>
          </View>
        ) : (
          transactions.map((tx, idx) => (
            <View key={tx.id} style={[styles.txRow, idx < transactions.length - 1 && styles.txRowBorder]}>
              <View style={[styles.txIcon, { backgroundColor: tx.type === 'CREDIT' ? '#dcfce7' : '#fee2e2' }]}>
                <Ionicons
                  name={tx.type === 'CREDIT' ? 'arrow-down' : 'arrow-up'}
                  size={16}
                  color={tx.type === 'CREDIT' ? '#16a34a' : '#dc2626'}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
              </View>
              <View style={styles.txAmounts}>
                <Text style={[styles.txAmount, { color: tx.type === 'CREDIT' ? '#16a34a' : '#dc2626' }]}>
                  {tx.type === 'CREDIT' ? '+' : '-'}{formatMoney(tx.amount)}
                </Text>
                <Text style={styles.txBalance}>Bal: {formatMoney(tx.balance)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#a5b4fc', marginTop: 4 },
  cardsScroll: { marginTop: -12 },
  cardsContainer: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  walletCard: { width: width * 0.72, borderRadius: 20, padding: 20, marginRight: 4, position: 'relative', overflow: 'hidden' },
  walletCardSelected: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
  walletCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  walletName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  walletTypeBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  walletTypeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  walletBalance: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  walletAvail: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center' },
  walletAvailLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  walletAvailAmount: { fontSize: 13, color: '#fff', fontWeight: '600' },
  walletAccount: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' },
  selectedIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 },
  emptyCard: { width: width * 0.72, borderRadius: 20, padding: 32, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  emptyCardText: { fontSize: 16, fontWeight: '600', color: '#475569', marginTop: 12 },
  emptyCardSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 4, gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  summaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  summaryValue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  ledgerSection: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  txDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  txAmounts: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txBalance: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  emptyLedger: { alignItems: 'center', paddingVertical: 32 },
  emptyLedgerText: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
});
