import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { paymentsApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { router } from 'expo-router';

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

function ApprovalCard({ payment, onApprove, onReject, isDirector }: any) {
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [pin, setPin] = useState('');

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.refBadge}>
          <Text style={styles.refText}>{payment.reference}</Text>
        </View>
        <Text style={styles.amount}>{formatKES(payment.amount)}</Text>
      </View>

      <Text style={styles.recipient} numberOfLines={1}>
        👤 {payment.recipientName ?? payment.recipientPhone ?? payment.recipientAccount}
      </Text>
      <Text style={styles.rail}>
        {payment.rail?.replace('MPESA_', 'M-Pesa ').replace('_', ' ')} ·{' '}
        {new Date(payment.createdAt).toLocaleDateString('en-KE')}
      </Text>
      {payment.description && (
        <Text style={styles.description} numberOfLines={2}>"{payment.description}"</Text>
      )}
      <Text style={styles.maker}>
        Created by: {payment.maker?.firstName} {payment.maker?.lastName}
      </Text>

      {isDirector && (
        <View style={styles.pinField}>
          <Text style={styles.pinLabel}>Your Authorization PIN</Text>
          <TextInput
            style={styles.pinInput}
            placeholder="Enter PIN to authorize"
            placeholderTextColor="#475569"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="numeric"
            maxLength={6}
          />
        </View>
      )}

      {showReject ? (
        <>
          <TextInput
            style={styles.reasonInput}
            placeholder="Reason for rejection..."
            placeholderTextColor="#475569"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={() => setShowReject(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => onReject(payment.id, reason)}
            >
              <Text style={styles.rejectBtnText}>Confirm Reject</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtnOutline]}
            onPress={() => setShowReject(true)}
          >
            <Text style={styles.rejectOutlineText}>✗ Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.approveBtn, isDirector && !pin && { opacity: 0.5 }]}
            disabled={isDirector && !pin}
            onPress={() => onApprove(payment.id, pin)}
          >
            <Text style={styles.approveBtnText}>
              {isDirector ? '🛡 Authorize' : '✓ Approve'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ApprovalsScreen() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isDirector = user?.role === 'DIRECTOR' || user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';

  const { data: checkerData, isLoading: checkerLoading, refetch: refetchChecker } = useQuery({
    queryKey: ['mobile-approvals-checker'],
    queryFn: () => paymentsApi.pendingApprovals().then(r => r.data.data),
    enabled: !isDirector,
  });

  const { data: directorData, isLoading: directorLoading, refetch: refetchDirector } = useQuery({
    queryKey: ['mobile-approvals-director'],
    queryFn: () => paymentsApi.directorApprovals().then(r => r.data.data),
    enabled: isDirector,
  });

  const checkerMutation = useMutation({
    mutationFn: ({ id, action, reason }: any) =>
      paymentsApi.checkerAction(id, action, reason),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries(['mobile-approvals-checker']);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Action Failed', 'Please try again.');
    },
  });

  const directorMutation = useMutation({
    mutationFn: ({ id, action, pin, reason }: any) =>
      paymentsApi.directorAction(id, action, pin, reason),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Authorized', 'Payment has been authorized and will be processed shortly.');
      qc.invalidateQueries(['mobile-approvals-director']);
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Authorization Failed', e?.response?.data?.message ?? 'Invalid PIN or action failed.');
    },
  });

  const payments = isDirector ? (directorData ?? []) : (checkerData ?? []);
  const isLoading = isDirector ? directorLoading : checkerLoading;
  const refetch = isDirector ? refetchDirector : refetchChecker;

  const handleApprove = (id: string, pin?: string) => {
    if (isDirector) {
      Alert.alert(
        '🛡 Authorize Payment',
        'I confirm I have reviewed this payment and authorize the disbursement of funds.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Authorize', onPress: () => directorMutation.mutate({ id, action: 'approve', pin }) },
        ]
      );
    } else {
      checkerMutation.mutate({ id, action: 'approve' });
    }
  };

  const handleReject = (id: string, reason: string) => {
    if (!reason.trim()) { Alert.alert('Required', 'Please provide a reason for rejection'); return; }
    if (isDirector) {
      directorMutation.mutate({ id, action: 'reject', reason });
    } else {
      checkerMutation.mutate({ id, action: 'reject', reason });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isDirector ? '🛡 Director Approvals' : '✅ Checker Queue'}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{payments.length}</Text>
        </View>
      </View>

      {isDirector && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ You are the final authorizer. Payments approved here will be immediately disbursed.
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ margin: 40 }} />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#6366f1" />
          }
          renderItem={({ item }) => (
            <ApprovalCard
              payment={item}
              isDirector={isDirector}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🎉</Text>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyText}>No pending approvals</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  title: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', flex: 1 },
  countBadge: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  warningBanner: {
    backgroundColor: '#7c2d12', marginHorizontal: 16, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  warningText: { color: '#fca5a5', fontSize: 12, lineHeight: 18 },
  list: { padding: 12, paddingBottom: 40, gap: 10 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  refBadge: { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  refText: { color: '#6366f1', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  amount: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  recipient: { color: '#f1f5f9', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  rail: { color: '#64748b', fontSize: 12, marginBottom: 6 },
  description: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  maker: { color: '#64748b', fontSize: 11, marginBottom: 12 },
  pinField: { marginBottom: 12 },
  pinLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  pinInput: {
    backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 14, paddingVertical: 10, color: '#f1f5f9', fontSize: 16,
    textAlign: 'center', letterSpacing: 6,
  },
  reasonInput: {
    backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#ef4444',
    paddingHorizontal: 12, paddingVertical: 10, color: '#f1f5f9', fontSize: 13,
    height: 70, textAlignVertical: 'top', marginBottom: 10,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveBtn: { backgroundColor: '#059669' },
  approveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rejectBtnOutline: { borderWidth: 1.5, borderColor: '#ef4444' },
  rejectOutlineText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },
  rejectBtn: { backgroundColor: '#ef4444' },
  rejectBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelBtn: { backgroundColor: '#334155' },
  cancelBtnText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
  emptyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptyText: { color: '#64748b', fontSize: 13 },
});
