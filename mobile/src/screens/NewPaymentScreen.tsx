import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { paymentsApi, walletsApi } from '../../services/api';
import * as Haptics from 'expo-haptics';

const RAILS = [
  { key: 'MPESA_B2C', label: 'M-Pesa B2C', icon: '📱', desc: 'Direct to phone' },
  { key: 'MPESA_PAYBILL', label: 'M-Pesa Paybill', icon: '🏦', desc: 'Paybill payment' },
  { key: 'MPESA_TILL', label: 'Buy Goods Till', icon: '🛒', desc: 'Till payment' },
  { key: 'BANK', label: 'Bank (PesaLink)', icon: '🏛️', desc: 'Up to KES 999,999' },
  { key: 'RTGS', label: 'RTGS / EFT', icon: '💸', desc: 'Large transfers' },
];

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

export default function NewPaymentScreen() {
  const { rail: defaultRail } = useLocalSearchParams<{ rail?: string }>();

  const [step, setStep] = useState<'rail' | 'details' | 'confirm'>('rail');
  const [selectedRail, setSelectedRail] = useState(defaultRail ?? '');
  const [form, setForm] = useState({
    recipientPhone: '', recipientName: '', recipientAccount: '',
    recipientBank: '', paybillNumber: '', tillNumber: '', accountRef: '',
    amount: '', description: '', walletId: '',
  });

  const { data: walletsData } = useQuery({
    queryKey: ['mobile-wallets-list'],
    queryFn: () => walletsApi.list().then(r => r.data.data),
  });

  const wallets: any[] = walletsData ?? [];

  const mutation = useMutation({
    mutationFn: (body: any) => paymentsApi.create(body),
    onSuccess: (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const txId = res.data.data?.id;
      Alert.alert(
        '✅ Payment Submitted',
        'Your payment has been submitted and is pending approval.',
        [{ text: 'View Details', onPress: () => router.push(`/(tabs)/payments/${txId}` as any) }]
      );
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Payment Failed', e?.response?.data?.message ?? 'Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!form.amount || isNaN(Number(form.amount))) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    const body: any = {
      rail: selectedRail,
      amount: Number(form.amount),
      description: form.description,
      walletId: form.walletId || wallets[0]?.id,
    };
    if (selectedRail === 'MPESA_B2C') body.recipientPhone = form.recipientPhone;
    if (selectedRail === 'MPESA_PAYBILL') { body.paybillNumber = form.paybillNumber; body.accountRef = form.accountRef; }
    if (selectedRail === 'MPESA_TILL') body.tillNumber = form.tillNumber;
    if (selectedRail === 'BANK' || selectedRail === 'RTGS') {
      body.recipientAccount = form.recipientAccount;
      body.recipientBank = form.recipientBank;
      body.recipientName = form.recipientName;
    }
    mutation.mutate(body);
  };

  // Rail selection step
  if (step === 'rail') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>New Payment</Text>
          <Text style={styles.pageSubtitle}>Choose payment channel</Text>
          <View style={styles.railsGrid}>
            {RAILS.map(rail => (
              <TouchableOpacity
                key={rail.key}
                style={[styles.railCard, selectedRail === rail.key && styles.railCardActive]}
                onPress={() => { setSelectedRail(rail.key); Haptics.selectionAsync(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.railIcon}>{rail.icon}</Text>
                <Text style={[styles.railLabel, selectedRail === rail.key && { color: '#fff' }]}>{rail.label}</Text>
                <Text style={[styles.railDesc, selectedRail === rail.key && { color: 'rgba(255,255,255,0.7)' }]}>{rail.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.nextBtn, !selectedRail && { opacity: 0.4 }]}
            disabled={!selectedRail}
            onPress={() => setStep('details')}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Details step
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Breadcrumb */}
        <TouchableOpacity onPress={() => setStep('rail')}>
          <Text style={styles.back}>← Change Rail</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Payment Details</Text>
        <Text style={styles.railBadge}>
          {RAILS.find(r => r.key === selectedRail)?.icon} {RAILS.find(r => r.key === selectedRail)?.label}
        </Text>

        {/* Wallet Selector */}
        <Text style={styles.label}>Debit from Wallet</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {wallets.map((w: any) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.walletChip, form.walletId === w.id && styles.walletChipActive]}
              onPress={() => setForm(f => ({ ...f, walletId: w.id }))}
            >
              <Text style={[styles.walletChipText, form.walletId === w.id && { color: '#fff' }]}>
                {w.name} · {formatKES(w.balance ?? 0)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Rail-specific fields */}
        {selectedRail === 'MPESA_B2C' && (
          <Field label="M-Pesa Phone *" placeholder="07XX XXX XXX" value={form.recipientPhone}
            onChangeText={v => setForm(f => ({ ...f, recipientPhone: v }))} keyboardType="phone-pad" />
        )}
        {selectedRail === 'MPESA_PAYBILL' && (<>
          <Field label="Paybill Number *" placeholder="e.g. 522522" value={form.paybillNumber}
            onChangeText={v => setForm(f => ({ ...f, paybillNumber: v }))} keyboardType="numeric" />
          <Field label="Account Reference" placeholder="e.g. your account/invoice" value={form.accountRef}
            onChangeText={v => setForm(f => ({ ...f, accountRef: v }))} />
        </>)}
        {selectedRail === 'MPESA_TILL' && (
          <Field label="Till Number *" placeholder="e.g. 123456" value={form.tillNumber}
            onChangeText={v => setForm(f => ({ ...f, tillNumber: v }))} keyboardType="numeric" />
        )}
        {(selectedRail === 'BANK' || selectedRail === 'RTGS') && (<>
          <Field label="Bank Code" placeholder="e.g. KCB, EQUITY" value={form.recipientBank}
            onChangeText={v => setForm(f => ({ ...f, recipientBank: v.toUpperCase() }))} autoCapitalize="characters" />
          <Field label="Account Number *" placeholder="Enter account number" value={form.recipientAccount}
            onChangeText={v => setForm(f => ({ ...f, recipientAccount: v }))} keyboardType="numeric" />
          <Field label="Account Name *" placeholder="As on bank records" value={form.recipientName}
            onChangeText={v => setForm(f => ({ ...f, recipientName: v }))} />
        </>)}

        {/* Amount */}
        <Text style={styles.label}>Amount (KES) *</Text>
        <TextInput
          style={[styles.input, styles.amountInput]}
          placeholder="0.00"
          placeholderTextColor="#475569"
          value={form.amount}
          onChangeText={v => setForm(f => ({ ...f, amount: v }))}
          keyboardType="decimal-pad"
        />

        {/* Description */}
        <Field label="Description / Narration" placeholder="What is this payment for?" value={form.description}
          onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline />

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🔐 This payment will go through Maker → Checker → Director approval before funds are disbursed.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, mutation.isLoading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={mutation.isLoading}
          activeOpacity={0.85}
        >
          {mutation.isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.nextBtnText}>Submit Payment</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, placeholder, value, onChangeText, keyboardType, multiline, autoCapitalize }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  pageSubtitle: { color: '#64748b', fontSize: 13, marginBottom: 20 },
  back: { color: '#6366f1', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  railBadge: {
    alignSelf: 'flex-start', backgroundColor: '#1e293b', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6, color: '#a5b4fc',
    fontSize: 13, fontWeight: '600', marginBottom: 20,
  },
  railsGrid: { gap: 10, marginBottom: 24 },
  railCard: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  railCardActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  railIcon: { fontSize: 24, marginBottom: 6 },
  railLabel: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  railDesc: { color: '#64748b', fontSize: 12, marginTop: 2 },
  nextBtn: {
    backgroundColor: '#4f46e5', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#f1f5f9', fontSize: 15,
  },
  amountInput: { fontSize: 28, fontWeight: '800', color: '#6366f1', marginBottom: 14 },
  walletChip: {
    backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#334155',
  },
  walletChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  walletChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  infoBox: {
    backgroundColor: '#1e3a5f', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#1d4ed8',
  },
  infoText: { color: '#93c5fd', fontSize: 12, lineHeight: 18 },
});
