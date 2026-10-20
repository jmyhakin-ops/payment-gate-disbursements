import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Platform, Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi, walletsApi, suppliersApi, settingsApi } from '../services/api';

/** All supported payment rails with display metadata */
const ALL_RAILS = [
  { value: 'MPESA_B2C',         label: 'M-Pesa B2C',   subtitle: 'Send to M-Pesa wallets', icon: 'phone-portrait-outline', color: '#10b981', bg: '#ecfdf5' },
  { value: 'MPESA_B2B_PAYBILL', label: 'M-Pesa Paybill', subtitle: 'Pay to Paybill number', icon: 'business-outline',       color: '#10b981', bg: '#ecfdf5' },
  { value: 'MPESA_B2B_TILL',    label: 'Buy Goods Till', subtitle: 'Pay via till number',    icon: 'cart-outline',           color: '#10b981', bg: '#ecfdf5' },
  { value: 'PESALINK',          label: 'PesaLink',      subtitle: 'Instant bank transfer',   icon: 'swap-horizontal-outline', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'RTGS',              label: 'RTGS / EFT',    subtitle: 'High-value bank transfer', icon: 'library-outline',        color: '#8b5cf6', bg: '#f5f3ff' },
  { value: 'EQUITY_JENGA',      label: 'Equity Jenga',  subtitle: 'Equity Bank API',         icon: 'flash-outline',          color: '#ef4444', bg: '#fef2f2' },
  { value: 'KCB_OPEN_BANKING',  label: 'KCB',           subtitle: 'KCB Open Banking',        icon: 'key-outline',            color: '#f59e0b', bg: '#fffbeb' },
];

function fmtKES(n: number) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

export default function NewPaymentScreen() {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [rail, setRail] = useState('MPESA_B2C');
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientBank, setRecipientBank] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  // ── Fetch configured payment gateways from the web app ───────────────────
  const { data: gatewayConfig } = useQuery({
    queryKey: ['configured-rails'],
    queryFn: () => settingsApi.configuredRails().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  // Build the list of rails to show — enabled ones first, disabled grayed out
  const enabledRailValues: string[] = gatewayConfig?.enabledRails ?? [];
  const RAILS = ALL_RAILS.map((r) => ({
    ...r,
    configured: enabledRailValues.length === 0 || enabledRailValues.includes(r.value),
  })).sort((a, b) => (b.configured ? 1 : 0) - (a.configured ? 1 : 0));

  const { data: wallets } = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list().then(r => r.data.data ?? []) });
  const { data: supplierData } = useQuery({
    queryKey: ['suppliers-pick-mobile', supplierSearch],
    queryFn: () => suppliersApi.list({ search: supplierSearch, status: 'ACTIVE', limit: 10 }).then(r => r.data.data ?? []),
    enabled: supplierOpen,
  });

  const isMpesa = rail.startsWith('MPESA');
  const isBank = ['PESALINK', 'RTGS', 'EQUITY_JENGA', 'KCB_OPEN_BANKING'].includes(rail);
  const selectedWallet = (wallets ?? []).find((w: any) => w.id === walletId);
  const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const charges = rail === 'PESALINK' ? (numAmount <= 999 ? 35 : numAmount <= 9999 ? 55 : 75)
    : rail === 'RTGS' ? 450
    : ['EQUITY_JENGA', 'KCB_OPEN_BANKING'].includes(rail) ? 100 : 0;
  const selectedRailMeta = ALL_RAILS.find((r) => r.value === rail);

  const mutation = useMutation({
    mutationFn: () => paymentsApi.initiate({
      walletId, rail, amount: numAmount,
      recipientName, recipientPhone: isMpesa ? recipientPhone : undefined,
      recipientAccount: !isMpesa ? recipientAccount : undefined,
      recipientBank, description,
    }),
    onSuccess: (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['mobile-recent-tx'] });
      setSuccess(res.data.data);
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Payment Failed', e?.response?.data?.message ?? 'Please try again.');
    },
  });

  const selectSupplier = (s: any) => {
    setRecipientName(s.accountName ?? s.name);
    if (s.type === 'MPESA_B2C') { setRail('MPESA_B2C'); setRecipientPhone(s.phone ?? ''); }
    else if (s.type === 'MPESA_PAYBILL') { setRail('MPESA_B2B_PAYBILL'); setRecipientAccount(s.paybillNumber ?? ''); }
    else if (s.type === 'MPESA_TILL') { setRail('MPESA_B2B_TILL'); setRecipientAccount(s.tillNumber ?? ''); }
    else { setRail(s.type === 'RTGS' ? 'RTGS' : 'PESALINK'); setRecipientAccount(s.accountNumber ?? ''); setRecipientBank(s.bankName ?? ''); }
    setSupplierOpen(false);
  };

  if (success) return (
    <LinearGradient colors={['#030712', '#0f172a']} style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <LinearGradient colors={['#065f46', '#047857']} style={s.successCircle}>
        <Text style={{ fontSize: 44 }}>✓</Text>
      </LinearGradient>
      <Text style={s.successTitle}>Payment Submitted!</Text>
      <Text style={s.successRef}>Ref: {success.reference}</Text>
      <Text style={s.successSub}>Awaiting Checker → Director approval</Text>
      <View style={s.successBtns}>
        <TouchableOpacity style={s.successBtnPrimary} onPress={() => router.push(`/(tabs)/payments/${success.id}` as any)}>
          <Text style={s.successBtnPrimaryText}>View Transaction</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.successBtnSecondary} onPress={() => { setSuccess(null); setStep(1); setAmount(''); setDescription(''); setRecipientName(''); setRecipientPhone(''); setRecipientAccount(''); }}>
          <Text style={s.successBtnSecondaryText}>New Payment</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#1e1b4b', '#0f172a']} style={s.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>New Payment</Text>
          <Text style={s.headerSub}>Step {step} of 3</Text>
        </View>
        {/* Step indicator */}
        <View style={s.stepDots}>
          {[1, 2, 3].map(i => <View key={i} style={[s.stepDot, i <= step && s.stepDotActive]} />)}
        </View>
      </LinearGradient>

      <ScrollView style={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── STEP 1: Supplier + Rail + Wallet ── */}
        {step === 1 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>💳 Payment Method</Text>

            {/* Supplier Picker */}
            <View style={s.section}>
              <Text style={s.sLabel}>SEARCH SUPPLIER (AUTO-FILL)</Text>
              <TouchableOpacity style={s.supplierPickerBtn} onPress={() => setSupplierOpen(true)}>
                <Text style={s.supplierPickerText}>
                  {recipientName ? `✅ ${recipientName}` : '🔍 Search & select a supplier...'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Rail selection — reads from payment gateway config */}
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={s.sLabel}>PAYMENT RAIL</Text>
                {gatewayConfig && (
                  <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: gatewayConfig.hasAnyRail ? '#dcfce7' : '#fef9c3',
                    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3,
                      backgroundColor: gatewayConfig.hasAnyRail ? '#16a34a' : '#ca8a04' }} />
                    <Text style={{ fontSize: 10, fontWeight: '700',
                      color: gatewayConfig.hasAnyRail ? '#15803d' : '#92400e' }}>
                      {gatewayConfig.hasAnyRail
                        ? `${enabledRailValues.length} gateway${enabledRailValues.length !== 1 ? 's' : ''} live`
                        : 'No gateways configured'}
                    </Text>
                  </View>
                )}
              </View>
              {RAILS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[s.railCard,
                    rail === r.value && { borderColor: r.color, backgroundColor: r.bg },
                    !r.configured && { opacity: 0.55 },
                  ]}
                  onPress={() => {
                    setRail(r.value);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[s.railIconBox, { backgroundColor: rail === r.value ? r.color + '20' : '#f1f5f9' }]}>
                    <Ionicons name={r.icon as any} size={20} color={rail === r.value ? r.color : '#64748b'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.railCardLabel, rail === r.value && { color: r.color }]}>{r.label}</Text>
                    <Text style={s.railCardSub}>{r.subtitle}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {r.configured ? (
                      <View style={s.railLiveBadge}>
                        <View style={s.railLiveDot} />
                        <Text style={s.railLiveText}>Live</Text>
                      </View>
                    ) : (
                      <View style={s.railNotConfigBadge}>
                        <Text style={s.railNotConfigText}>Not Configured</Text>
                      </View>
                    )}
                    {rail === r.value && (
                      <Ionicons name="checkmark-circle" size={16} color={r.color} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Wallet */}
            <View style={s.section}>
              <Text style={s.sLabel}>SOURCE WALLET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                {(wallets ?? []).map((w: any) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[s.walletChip, walletId === w.id && s.walletChipActive]}
                    onPress={() => setWalletId(w.id)}
                  >
                    <Text style={s.walletChipName}>{w.name}</Text>
                    <Text style={[s.walletChipBal, walletId === w.id && { color: '#10b981' }]}>
                      {fmtKES(Number(w.balance) - Number(w.reservedBalance))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[s.nextBtn, (!walletId || !rail) && { opacity: 0.4 }]}
              disabled={!walletId || !rail}
              onPress={() => setStep(2)}
            >
              <LinearGradient colors={['#4f46e5', '#6d28d9']} style={s.nextBtnInner}>
                <Text style={s.nextBtnText}>Continue →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Recipient ── */}
        {step === 2 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>👤 Recipient Details</Text>

            <View style={s.section}>
              <Text style={s.sLabel}>RECIPIENT NAME *</Text>
              <TextInput
                style={s.textInput}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Full name or business name"
                placeholderTextColor="#475569"
              />
            </View>

            {isMpesa && (
              <View style={s.section}>
                <Text style={s.sLabel}>
                  {rail === 'MPESA_B2C' ? 'PHONE NUMBER *' : 'PAYBILL / TILL NUMBER *'}
                </Text>
                <TextInput
                  style={s.textInput}
                  value={recipientPhone}
                  onChangeText={setRecipientPhone}
                  placeholder={rail === 'MPESA_B2C' ? '0712345678' : '174379'}
                  placeholderTextColor="#475569"
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {isBank && (
              <>
                <View style={s.section}>
                  <Text style={s.sLabel}>ACCOUNT NUMBER *</Text>
                  <TextInput style={s.textInput} value={recipientAccount} onChangeText={setRecipientAccount} placeholder="0123456789" placeholderTextColor="#475569" keyboardType="numeric" />
                </View>
                <View style={s.section}>
                  <Text style={s.sLabel}>BANK NAME</Text>
                  <TextInput style={s.textInput} value={recipientBank} onChangeText={setRecipientBank} placeholder="e.g. Equity Bank" placeholderTextColor="#475569" />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[s.nextBtn, !recipientName && { opacity: 0.4 }]}
              disabled={!recipientName}
              onPress={() => setStep(3)}
            >
              <LinearGradient colors={['#4f46e5', '#6d28d9']} style={s.nextBtnInner}>
                <Text style={s.nextBtnText}>Continue →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: Amount + Description ── */}
        {step === 3 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>💰 Amount & Details</Text>

            <View style={s.amountBox}>
              <Text style={s.amountPrefix}>KES</Text>
              <TextInput
                style={s.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#334155"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {numAmount > 0 && (
              <View style={s.breakdown}>
                <View style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>Amount</Text>
                  <Text style={s.breakdownValue}>{fmtKES(numAmount)}</Text>
                </View>
                <View style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>Transaction Charges</Text>
                  <Text style={[s.breakdownValue, { color: '#f59e0b' }]}>+ {fmtKES(charges)}</Text>
                </View>
                <View style={[s.breakdownRow, { borderTopWidth: 1, borderTopColor: '#334155', marginTop: 6, paddingTop: 10 }]}>
                  <Text style={[s.breakdownLabel, { color: '#f1f5f9', fontWeight: '700' }]}>Total Debit</Text>
                  <Text style={[s.breakdownValue, { color: '#6366f1', fontSize: 18 }]}>{fmtKES(numAmount + charges)}</Text>
                </View>
                {selectedWallet && (numAmount + charges) > (Number(selectedWallet.balance) - Number(selectedWallet.reservedBalance)) && (
                  <Text style={s.insufficientText}>⚠️ Insufficient wallet balance</Text>
                )}
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sLabel}>PURPOSE / DESCRIPTION *</Text>
              <TextInput
                style={[s.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Purpose of this payment..."
                placeholderTextColor="#475569"
                multiline
              />
            </View>

            {/* Summary card */}
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Payment Summary</Text>
              {[
                { l: 'To', v: recipientName },
                { l: 'Rail', v: RAILS.find(r => r.value === rail)?.label ?? rail },
                { l: 'Wallet', v: selectedWallet?.name ?? '—' },
              ].map(r => (
                <View key={r.l} style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{r.l}</Text>
                  <Text style={s.summaryValue} numberOfLines={1}>{r.v}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.nextBtn, (!numAmount || !description || mutation.isPending) && { opacity: 0.4 }]}
              disabled={!numAmount || !description || mutation.isPending}
              onPress={() => {
                Alert.alert(
                  '🔐 Confirm Payment',
                  `Submit ${fmtKES(numAmount)} to ${recipientName}?\n\nThis will be sent for Checker → Director approval.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Submit', onPress: () => mutation.mutate() },
                  ]
                );
              }}
            >
              <LinearGradient colors={['#059669', '#047857']} style={s.nextBtnInner}>
                {mutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.nextBtnText}>🚀 Submit for Approval</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Supplier search modal */}
      <Modal visible={supplierOpen} animationType="slide" transparent onRequestClose={() => setSupplierOpen(false)}>
        <View style={s.suppModal}>
          <View style={s.suppModalContent}>
            <View style={s.suppModalHandle} />
            <Text style={s.suppModalTitle}>Select Supplier</Text>
            <TextInput
              style={s.suppSearch}
              value={supplierSearch}
              onChangeText={setSupplierSearch}
              placeholder="Search by name, phone, account..."
              placeholderTextColor="#475569"
              autoFocus
            />
            <ScrollView style={s.suppList}>
              {(supplierData ?? []).length === 0 ? (
                <View style={s.suppEmpty}>
                  <Text style={s.suppEmptyText}>No suppliers found</Text>
                  <Text style={s.suppEmptySub}>Add suppliers via the web portal</Text>
                </View>
              ) : (supplierData ?? []).map((sup: any) => (
                <TouchableOpacity key={sup.id} style={s.suppItem} onPress={() => selectSupplier(sup)}>
                  <Text style={s.suppItemEmoji}>{sup.type === 'MPESA_B2C' ? '📱' : sup.type?.startsWith('MPESA') ? '🏦' : '🏛️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.suppItemName}>{sup.name}</Text>
                    <Text style={s.suppItemSub}>{sup.phone ?? sup.paybillNumber ?? sup.accountNumber ?? '—'} · {sup.type}</Text>
                  </View>
                  <Text style={{ color: '#6366f1', fontSize: 18 }}>→</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.suppClose} onPress={() => setSupplierOpen(false)}>
              <Text style={s.suppCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f1e' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  stepDots: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#334155' },
  stepDotActive: { backgroundColor: '#6366f1' },
  body: { flex: 1, backgroundColor: '#f8fafc' },
  stepContent: { padding: 16 },
  stepTitle: { color: '#1e293b', fontSize: 20, fontWeight: '800', marginBottom: 20 },

  section: { marginBottom: 16 },
  sLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },

  supplierPickerBtn: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  supplierPickerText: { color: '#94a3b8', fontSize: 14 },

  railGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  railBtn: { width: '30.5%', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0', gap: 4 },
  railBtnLabel: { color: '#475569', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  railCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  railIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  railCardLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  railCardSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  railLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  railLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#16a34a' },
  railLiveText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  railNotConfigBadge: { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  railNotConfigText: { fontSize: 9, fontWeight: '800', color: '#92400e' },

  walletChip: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0', minWidth: 140 },
  walletChipActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  walletChipName: { color: '#64748b', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  walletChipBal: { color: '#0f172a', fontSize: 14, fontWeight: '900' },

  textInput: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', padding: 14, color: '#0f172a', fontSize: 15, fontWeight: '600' },

  amountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 2, borderColor: '#4f46e5', padding: 20, marginBottom: 16, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
  amountPrefix: { color: '#64748b', fontSize: 22, fontWeight: '800', marginRight: 10 },
  amountInput: { flex: 1, color: '#0f172a', fontSize: 36, fontWeight: '900' },

  breakdown: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  breakdownValue: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  insufficientText: { color: '#d97706', fontSize: 12, marginTop: 8, fontWeight: '700' },

  summaryCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  summaryTitle: { color: '#475569', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  summaryLabel: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  summaryValue: { color: '#0f172a', fontSize: 13, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },

  nextBtn: { marginTop: 8 },
  nextBtnInner: { borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  successCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { color: '#0f172a', fontSize: 26, fontWeight: '900', marginBottom: 8 },
  successRef: { color: '#4f46e5', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 8, fontWeight: '700' },
  successSub: { color: '#64748b', fontSize: 14, marginBottom: 32, textAlign: 'center', fontWeight: '500' },
  successBtns: { width: '100%', padding: 24, gap: 12 },
  successBtnPrimary: { backgroundColor: '#4f46e5', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center' },
  successBtnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  successBtnSecondary: { backgroundColor: '#f1f5f9', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  successBtnSecondaryText: { color: '#475569', fontSize: 16, fontWeight: '700' },

  suppModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.65)' },
  suppModalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', borderWidth: 1, borderColor: '#e2e8f0' },
  suppModalHandle: { width: 44, height: 5, backgroundColor: '#cbd5e1', borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  suppModalTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', paddingHorizontal: 16, marginBottom: 12 },
  suppSearch: { backgroundColor: '#f8fafc', borderRadius: 12, margin: 16, marginTop: 0, padding: 14, color: '#0f172a', fontSize: 15, borderWidth: 1.5, borderColor: '#e2e8f0', fontWeight: '600' },
  suppList: { maxHeight: 380, paddingHorizontal: 16 },
  suppItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suppItemEmoji: { fontSize: 24, width: 36, textAlign: 'center' },
  suppItemName: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  suppItemSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  suppEmpty: { alignItems: 'center', padding: 40 },
  suppEmptyText: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  suppEmptySub: { color: '#64748b', fontSize: 13, marginTop: 6 },
  suppClose: { margin: 16, backgroundColor: '#f1f5f9', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  suppCloseText: { color: '#475569', fontSize: 15, fontWeight: '700' },
});
