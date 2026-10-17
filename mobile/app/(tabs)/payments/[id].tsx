import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/auth.store';

const RAIL_ICONS: Record<string, string> = {
  MPESA_B2C: 'phone-portrait-outline',
  MPESA_B2B_PAYBILL: 'business-outline',
  MPESA_B2B_TILL: 'storefront-outline',
  PESALINK: 'swap-horizontal-outline',
  RTGS: 'library-outline',
  EQUITY_JENGA: 'card-outline',
  KCB_OPEN: 'globe-outline',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#fef3c7', text: '#b45309', label: 'Pending' },
  MAKER_SUBMITTED: { bg: '#dbeafe', text: '#1d4ed8', label: 'Maker Submitted' },
  CHECKER_APPROVED: { bg: '#ede9fe', text: '#6d28d9', label: 'Checker Approved' },
  DIRECTOR_APPROVED: { bg: '#d1fae5', text: '#065f46', label: 'Director Approved' },
  PROCESSING: { bg: '#e0f2fe', text: '#0369a1', label: 'Processing' },
  COMPLETED: { bg: '#dcfce7', text: '#166534', label: 'Completed' },
  FAILED: { bg: '#fee2e2', text: '#991b1b', label: 'Failed' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
  CANCELLED: { bg: '#f1f5f9', text: '#475569', label: 'Cancelled' },
};

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api.get(`/payments/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      api.post(`/payments/${id}/${action}`, { notes: `${action}d via mobile app` }),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      Alert.alert('Success', `Payment ${action}d successfully`);
    },
    onError: () => Alert.alert('Error', 'Action failed. Please try again.'),
  });

  const handleAction = (action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'Approve' : 'Reject';
    Alert.alert(
      `${label} Payment`,
      `Are you sure you want to ${action} this payment of ${formatMoney(payment?.amount, payment?.currency)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: () => approveMutation.mutate(action),
        },
      ]
    );
  };

  const formatMoney = (amount?: number, currency = 'KES') => {
    if (!amount) return 'KES 0.00';
    return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading payment details…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load payment</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const payment = data.payment;
  const status = STATUS_COLORS[payment.status] ?? STATUS_COLORS.PENDING;
  const railIcon = RAIL_ICONS[payment.paymentRail] ?? 'send-outline';

  const canApprove =
    (user?.role === 'CHECKER' && payment.status === 'MAKER_SUBMITTED') ||
    (user?.role === 'DIRECTOR' && payment.status === 'CHECKER_APPROVED') ||
    (user?.role === 'ORG_ADMIN' && payment.status === 'CHECKER_APPROVED');

  const timeline = payment.approvalSteps ?? [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={['#1e1b4b', '#4338ca']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Details</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.content}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <View style={[styles.railIconWrap, { backgroundColor: '#eef2ff' }]}>
            <Ionicons name={railIcon as any} size={28} color="#6366f1" />
          </View>
          <Text style={styles.amountLabel}>Payment Amount</Text>
          <Text style={styles.amount}>{formatMoney(payment.amount, payment.currency)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
          <Text style={styles.refText}>Ref: {payment.reference}</Text>
        </View>

        {/* Payment Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Payment Information</Text>
          {[
            { label: 'Rail', value: payment.paymentRail?.replace(/_/g, ' ') },
            { label: 'Recipient', value: payment.recipientName ?? 'N/A' },
            { label: 'Account / Phone', value: payment.recipientAccount ?? payment.recipientPhone ?? 'N/A' },
            { label: 'Narrative', value: payment.narrative ?? 'N/A' },
            { label: 'Batch', value: payment.batchId ?? 'Single Payment' },
            { label: 'Initiated By', value: `${payment.maker?.firstName ?? ''} ${payment.maker?.lastName ?? ''}`.trim() || 'N/A' },
            { label: 'Initiated At', value: formatDate(payment.createdAt) },
          ].map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Approval Timeline */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Approval Timeline</Text>
          {timeline.length === 0 ? (
            <Text style={styles.emptyTimeline}>No approval actions yet</Text>
          ) : (
            timeline.map((step: any, idx: number) => (
              <View key={idx} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: step.action === 'APPROVED' ? '#10b981' : step.action === 'REJECTED' ? '#ef4444' : '#6366f1' }]} />
                {idx < timeline.length - 1 && <View style={styles.timelineLine} />}
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineRole}>{step.role ?? 'Approver'} — {step.action}</Text>
                  <Text style={styles.timelineUser}>{step.user?.firstName} {step.user?.lastName}</Text>
                  <Text style={styles.timelineDate}>{formatDate(step.createdAt)}</Text>
                  {step.notes && <Text style={styles.timelineNotes}>{step.notes}</Text>}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Transaction Receipt */}
        {payment.providerReference && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Transaction Receipt</Text>
            {[
              { label: 'Provider Ref', value: payment.providerReference },
              { label: 'Processed At', value: formatDate(payment.processedAt) },
              { label: 'Fee', value: formatMoney(payment.fee ?? 0) },
              { label: 'Exchange Rate', value: payment.exchangeRate ? `1 USD = KES ${payment.exchangeRate}` : 'N/A' },
            ].map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {canApprove && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleAction('reject')}
              disabled={approveMutation.isPending}
            >
              <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleAction('approve')}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  loadingText: { fontSize: 14, color: '#64748b' },
  errorText: { fontSize: 16, color: '#ef4444', fontWeight: '600' },
  backBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#6366f1', borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  content: { padding: 16, gap: 16 },
  amountCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
  railIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  amountLabel: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  amount: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
  refText: { fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 13, color: '#64748b', flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1e293b', flex: 1.5, textAlign: 'right' },
  emptyTimeline: { fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingVertical: 16 },
  timelineRow: { flexDirection: 'row', marginBottom: 8, position: 'relative' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: 12, zIndex: 1 },
  timelineLine: { position: 'absolute', left: 5.5, top: 16, bottom: -8, width: 1, backgroundColor: '#e2e8f0' },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineRole: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  timelineUser: { fontSize: 12, color: '#6366f1', marginTop: 2 },
  timelineDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  timelineNotes: { fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fecaca' },
  rejectBtnText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  approveBtn: { backgroundColor: '#6366f1' },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
