import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, RefreshControl,
  Modal, Animated, Dimensions, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { paymentsApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { LinearGradient } from 'expo-linear-gradient';

const W = Dimensions.get('window').width;

function formatKES(n: number) {
  return `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const RAIL_EMOJI: Record<string, string> = {
  MPESA_B2C: '📱', MPESA_B2B_PAYBILL: '🏦', MPESA_B2B_TILL: '🛒',
  PESALINK: '🏛️', RTGS: '💸', EQUITY_JENGA: '⚡', KCB_OPEN_BANKING: '🔑',
};

// ─── Director Approval Modal ───────────────────────────────────────────────
function DirectorApprovalModal({
  visible, payment, onClose, onSubmit, loading,
}: {
  visible: boolean;
  payment: any;
  onClose: () => void;
  onSubmit: (id: string, action: 'approve' | 'reject', pin: string, reason: string, approvedAmount?: number) => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setMode('approve'); setPin(''); setReason('');
      setUseCustomAmount(false); setCustomAmount('');
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!payment) return null;

  const requestedAmt = Number(payment.amount ?? 0);
  const parsedCustom = parseFloat(customAmount.replace(/,/g, ''));
  const finalAmount = useCustomAmount && !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : requestedAmt;

  const canSubmit = pin.length >= 4 && (mode === 'approve' || reason.trim().length > 5);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <Animated.View style={[s.modalSheet, {
          transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
        }]}>
          {/* Handle bar */}
          <View style={s.modalHandle} />

          {/* Header */}
          <LinearGradient
            colors={mode === 'approve' ? ['#1a3a2a', '#0f2d1e'] : ['#3a1a1a', '#2d0f0f']}
            style={s.modalHeader}
          >
            <Text style={s.modalHeaderEmoji}>{mode === 'approve' ? '🛡️' : '❌'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.modalHeaderTitle}>
                {mode === 'approve' ? 'Authorize Payment' : 'Reject Payment'}
              </Text>
              <Text style={s.modalHeaderRef}>{payment.reference}</Text>
            </View>
          </LinearGradient>

          <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
            {/* Payment summary */}
            <View style={s.paymentSummaryBox}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Recipient</Text>
                <Text style={s.summaryValue} numberOfLines={1}>{payment.recipientName ?? '—'}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Rail</Text>
                <Text style={s.summaryValue}>
                  {RAIL_EMOJI[payment.rail] ?? '💳'} {payment.rail?.replace(/_/g, ' ')}
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Requested</Text>
                <Text style={[s.summaryValue, { color: '#f59e0b', fontWeight: '800' }]}>
                  {formatKES(requestedAmt)}
                </Text>
              </View>
              <View style={[s.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={s.summaryLabel}>Maker</Text>
                <Text style={s.summaryValue}>
                  {payment.maker?.firstName} {payment.maker?.lastName}
                </Text>
              </View>
            </View>

            {/* APPROVE mode extras */}
            {mode === 'approve' && (
              <>
                {/* Amount options */}
                <Text style={s.sectionLabel}>AUTHORIZED AMOUNT</Text>
                <View style={s.amountOptionsRow}>
                  <TouchableOpacity
                    style={[s.amountOption, !useCustomAmount && s.amountOptionActive]}
                    onPress={() => setUseCustomAmount(false)}
                  >
                    <Text style={[s.amountOptionLabel, !useCustomAmount && s.amountOptionLabelActive]}>
                      Full Amount
                    </Text>
                    <Text style={[s.amountOptionValue, !useCustomAmount && { color: '#10b981' }]}>
                      {formatKES(requestedAmt)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.amountOption, useCustomAmount && s.amountOptionActive]}
                    onPress={() => setUseCustomAmount(true)}
                  >
                    <Text style={[s.amountOptionLabel, useCustomAmount && s.amountOptionLabelActive]}>
                      Custom Amount
                    </Text>
                    <Text style={[s.amountOptionValue, useCustomAmount && { color: '#10b981' }]}>
                      {useCustomAmount && parsedCustom > 0 ? formatKES(parsedCustom) : 'Set amount →'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {useCustomAmount && (
                  <View style={s.customAmtBox}>
                    <Text style={s.inputLabel}>Enter Amount to Approve (KES)</Text>
                    <View style={s.customAmtRow}>
                      <Text style={s.currencyPrefix}>KES</Text>
                      <TextInput
                        style={s.customAmtInput}
                        value={customAmount}
                        onChangeText={setCustomAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#475569"
                        autoFocus
                      />
                    </View>
                    {parsedCustom > requestedAmt && (
                      <Text style={s.amtWarning}>⚠️ Custom amount exceeds requested amount</Text>
                    )}
                    {parsedCustom > 0 && parsedCustom < requestedAmt && (
                      <Text style={s.amtInfo}>
                        ℹ️ Approving {formatKES(parsedCustom)} of {formatKES(requestedAmt)} requested
                      </Text>
                    )}
                  </View>
                )}

                {/* Final approval box */}
                <View style={s.finalApprovalBox}>
                  <Text style={s.finalApprovalLabel}>FINAL AUTHORIZED AMOUNT</Text>
                  <Text style={s.finalApprovalAmount}>{formatKES(finalAmount)}</Text>
                </View>
              </>
            )}

            {/* REJECT reason */}
            {mode === 'reject' && (
              <>
                <Text style={s.sectionLabel}>REJECTION REASON *</Text>
                <TextInput
                  style={s.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="State a clear reason for rejection..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </>
            )}

            {/* PIN */}
            <Text style={s.sectionLabel}>DIRECTOR PIN *</Text>
            <View style={s.pinDots}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[s.pinDot, pin.length > i && s.pinDotFilled]} />
              ))}
            </View>
            <TextInput
              style={s.pinInput}
              value={pin}
              onChangeText={setPin}
              placeholder="Enter your 4–6 digit PIN"
              placeholderTextColor="#475569"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              textAlign="center"
            />

            {/* Mode toggle */}
            <View style={s.modeToggleRow}>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'approve' && s.modeBtnActive]}
                onPress={() => setMode('approve')}
              >
                <Text style={[s.modeBtnText, mode === 'approve' && { color: '#10b981' }]}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'reject' && s.modeBtnRejectActive]}
                onPress={() => setMode('reject')}
              >
                <Text style={[s.modeBtnText, mode === 'reject' && { color: '#ef4444' }]}>✗ Reject</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.submitBtn,
                mode === 'approve' ? s.submitBtnApprove : s.submitBtnReject,
                !canSubmit && { opacity: 0.4 },
              ]}
              disabled={!canSubmit || loading}
              onPress={() => {
                const amt = useCustomAmount && parsedCustom > 0 ? parsedCustom : undefined;
                onSubmit(payment.id, mode, pin, reason, amt);
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitBtnText}>
                    {mode === 'approve' ? '🛡️ Authorize' : '❌ Reject'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Checker Approval Modal ────────────────────────────────────────────────
function CheckerModal({
  visible, payment, onClose, onSubmit, loading,
}: {
  visible: boolean;
  payment: any;
  onClose: () => void;
  onSubmit: (id: string, action: 'approve' | 'reject', reason: string) => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (visible) { setMode('approve'); setReason(''); }
  }, [visible]);

  if (!payment) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { maxHeight: '75%' }]}>
          <View style={s.modalHandle} />
          <LinearGradient
            colors={mode === 'approve' ? ['#1a3a2a', '#0f2d1e'] : ['#3a1a1a', '#2d0f0f']}
            style={s.modalHeader}
          >
            <Text style={s.modalHeaderEmoji}>{mode === 'approve' ? '✅' : '❌'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.modalHeaderTitle}>Checker Review</Text>
              <Text style={s.modalHeaderRef}>{payment.reference}</Text>
            </View>
          </LinearGradient>

          <View style={s.paymentSummaryBox}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>To</Text>
              <Text style={s.summaryValue}>{payment.recipientName ?? '—'}</Text>
            </View>
            <View style={[s.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={s.summaryLabel}>Amount</Text>
              <Text style={[s.summaryValue, { color: '#10b981', fontWeight: '800', fontSize: 18 }]}>
                {formatKES(Number(payment.amount))}
              </Text>
            </View>
          </View>

          {mode === 'reject' && (
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={s.sectionLabel}>REJECTION REASON *</Text>
              <TextInput
                style={s.reasonInput}
                value={reason}
                onChangeText={setReason}
                placeholder="State reason..."
                placeholderTextColor="#475569"
                multiline numberOfLines={3}
                textAlignVertical="top"
                autoFocus
              />
            </View>
          )}

          <View style={s.modeToggleRow}>
            <TouchableOpacity style={[s.modeBtn, mode === 'approve' && s.modeBtnActive]} onPress={() => setMode('approve')}>
              <Text style={[s.modeBtnText, mode === 'approve' && { color: '#10b981' }]}>✓ Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, mode === 'reject' && s.modeBtnRejectActive]} onPress={() => setMode('reject')}>
              <Text style={[s.modeBtnText, mode === 'reject' && { color: '#ef4444' }]}>✗ Reject</Text>
            </TouchableOpacity>
          </View>

          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.submitBtn,
                mode === 'approve' ? s.submitBtnApprove : s.submitBtnReject,
                (mode === 'reject' && !reason.trim()) && { opacity: 0.4 },
              ]}
              disabled={loading || (mode === 'reject' && !reason.trim())}
              onPress={() => onSubmit(payment.id, mode, reason)}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitBtnText}>
                    {mode === 'approve' ? '✅ Confirm Approve' : '❌ Confirm Reject'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Payment Card ──────────────────────────────────────────────────────────
function PaymentCard({ payment, isDirector, onPress }: { payment: any; isDirector: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const railEmoji = RAIL_EMOJI[payment.rail] ?? '💳';
  const initials = ((payment.recipientName ?? '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2)).toUpperCase();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <View style={s.card}>
          {/* Status strip */}
          <View style={[s.cardStrip, isDirector ? { backgroundColor: '#7c3aed' } : { backgroundColor: '#0ea5e9' }]} />

          <View style={s.cardInner}>
            {/* Avatar + main info */}
            <View style={s.cardTopRow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardRecipient} numberOfLines={1}>
                  {payment.recipientName ?? payment.recipientPhone ?? '—'}
                </Text>
                <Text style={s.cardSub}>
                  {railEmoji} {payment.rail?.replace(/_/g, ' ')} · {timeAgo(payment.createdAt)}
                </Text>
              </View>
              <View style={s.cardAmountBox}>
                <Text style={s.cardAmount}>{formatKES(Number(payment.amount))}</Text>
                <View style={[s.rolePill, isDirector ? s.rolePillDirector : s.rolePillChecker]}>
                  <Text style={s.rolePillText}>{isDirector ? 'Director' : 'Checker'}</Text>
                </View>
              </View>
            </View>

            {/* Description */}
            {payment.description && (
              <View style={s.descRow}>
                <Text style={s.descText} numberOfLines={1}>"{payment.description}"</Text>
              </View>
            )}

            {/* Bottom meta */}
            <View style={s.cardMeta}>
              <Text style={s.cardRef}>#{payment.reference}</Text>
              <Text style={s.cardMaker}>
                by {payment.maker?.firstName} {payment.maker?.lastName}
              </Text>
            </View>

            {/* CTA */}
            <View style={[s.ctaRow, isDirector && { borderTopColor: '#3b1d7a' }]}>
              <Text style={s.ctaText}>Tap to review →</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function ApprovalsScreen() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isDirector = ['DIRECTOR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
  const isChecker = ['CHECKER', 'FINANCE', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');

  const [tab, setTab] = useState<'checker' | 'director'>(isDirector ? 'director' : 'checker');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [directorModalOpen, setDirectorModalOpen] = useState(false);
  const [checkerModalOpen, setCheckerModalOpen] = useState(false);

  const { data: checkerData, isLoading: checkerLoading, refetch: refetchChecker } = useQuery({
    queryKey: ['mobile-approvals-checker'],
    queryFn: () => paymentsApi.pendingApprovals().then(r => r.data.data ?? []),
    enabled: isChecker,
    refetchInterval: 30000,
  });

  const { data: directorData, isLoading: directorLoading, refetch: refetchDirector } = useQuery({
    queryKey: ['mobile-approvals-director'],
    queryFn: () => paymentsApi.directorApprovals().then(r => r.data.data ?? []),
    enabled: isDirector,
    refetchInterval: 30000,
  });

  const checkerMutation = useMutation({
    mutationFn: ({ id, action, reason }: any) => paymentsApi.checkerAction(id, action, reason),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['mobile-approvals-checker'] });
      setCheckerModalOpen(false);
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Action Failed', e?.response?.data?.message ?? 'Please try again.');
    },
  });

  const directorMutation = useMutation({
    mutationFn: ({ id, action, pin, reason, approvedAmount }: any) =>
      paymentsApi.directorAction(id, action, pin, reason, approvedAmount),
    onSuccess: (_, vars) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['mobile-approvals-director'] });
      setDirectorModalOpen(false);
      Alert.alert(
        vars.action === 'approve' ? '🛡️ Payment Authorized!' : '❌ Payment Rejected',
        vars.action === 'approve'
          ? 'The payment has been authorized and will be disbursed shortly.'
          : 'The payment has been rejected and the maker has been notified.',
      );
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Authorization Failed', e?.response?.data?.message ?? 'Invalid PIN or session expired.');
    },
  });

  const payments = tab === 'director' ? (directorData ?? []) : (checkerData ?? []);
  const isLoading = tab === 'director' ? directorLoading : checkerLoading;
  const refetch = tab === 'director' ? refetchDirector : refetchChecker;

  const checkerCount = checkerData?.length ?? 0;
  const directorCount = directorData?.length ?? 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={s.header}>
        <Text style={s.headerTitle}>Approvals</Text>
        <Text style={s.headerSub}>
          {(checkerCount + directorCount)} pending action{(checkerCount + directorCount) !== 1 ? 's' : ''}
        </Text>
      </LinearGradient>

      {/* Tabs */}
      {isChecker && isDirector && (
        <View style={s.tabBar}>
          <TouchableOpacity style={[s.tab, tab === 'checker' && s.tabActive]} onPress={() => setTab('checker')}>
            <Text style={[s.tabText, tab === 'checker' && s.tabTextActive]}>
              Checker Queue {checkerCount > 0 ? `(${checkerCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 'director' && s.tabActive]} onPress={() => setTab('director')}>
            <Text style={[s.tabText, tab === 'director' && s.tabTextActive]}>
              Director Sign-off {directorCount > 0 ? `(${directorCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Director warning */}
      {tab === 'director' && (
        <View style={s.directorBanner}>
          <Text style={s.directorBannerText}>
            🛡️ You are the FINAL authorizer. Payments approved here will be immediately disbursed to the recipient.
          </Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={s.centerLoader}>
          <ActivityIndicator color="#6366f1" size="large" />
          <Text style={s.loaderText}>Loading approvals...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#6366f1" />}
        >
          {payments.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🎉</Text>
              <Text style={s.emptyTitle}>All caught up!</Text>
              <Text style={s.emptySub}>No pending {tab === 'director' ? 'director ' : ''}approvals</Text>
            </View>
          ) : (
            payments.map((p: any) => (
              <PaymentCard
                key={p.id}
                payment={p}
                isDirector={tab === 'director'}
                onPress={() => {
                  setSelectedPayment(p);
                  if (tab === 'director') setDirectorModalOpen(true);
                  else setCheckerModalOpen(true);
                }}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Director Modal */}
      <DirectorApprovalModal
        visible={directorModalOpen}
        payment={selectedPayment}
        onClose={() => setDirectorModalOpen(false)}
        loading={directorMutation.isPending}
        onSubmit={(id, action, pin, reason, approvedAmount) =>
          directorMutation.mutate({ id, action, pin, reason, approvedAmount })
        }
      />

      {/* Checker Modal */}
      <CheckerModal
        visible={checkerModalOpen}
        payment={selectedPayment}
        onClose={() => setCheckerModalOpen(false)}
        loading={checkerMutation.isPending}
        onSubmit={(id, action, reason) => checkerMutation.mutate({ id, action, reason })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: '#64748b', fontSize: 13, marginTop: 2 },

  tabBar: { flexDirection: 'row', backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#0f172a' },
  tabActive: { backgroundColor: '#6366f1' },
  tabText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  directorBanner: {
    backgroundColor: '#1e1030', marginHorizontal: 12, marginTop: 8, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#7c3aed',
  },
  directorBannerText: { color: '#c4b5fd', fontSize: 12, lineHeight: 18 },

  list: { padding: 12, paddingBottom: 40, gap: 12 },
  centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { color: '#64748b', fontSize: 14 },

  // Card
  card: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', flexDirection: 'row' },
  cardStrip: { width: 4 },
  cardInner: { flex: 1, padding: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardRecipient: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', flex: 1 },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmountBox: { alignItems: 'flex-end', gap: 4 },
  cardAmount: { color: '#10b981', fontSize: 17, fontWeight: '800' },
  rolePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  rolePillChecker: { backgroundColor: '#0c4a6e' },
  rolePillDirector: { backgroundColor: '#3b1d7a' },
  rolePillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  descRow: { backgroundColor: '#0f172a', borderRadius: 8, padding: 8, marginBottom: 8 },
  descText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  cardRef: { color: '#6366f1', fontSize: 11, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardMaker: { color: '#475569', fontSize: 11 },
  ctaRow: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155', alignItems: 'center' },
  ctaText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptySub: { color: '#475569', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%', borderWidth: 1, borderColor: '#1e293b',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  modalHeaderEmoji: { fontSize: 28 },
  modalHeaderTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  modalHeaderRef: { color: '#64748b', fontSize: 12, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  modalBody: { padding: 16 },

  paymentSummaryBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  summaryLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  summaryValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  sectionLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 4 },

  amountOptionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  amountOption: { flex: 1, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#334155', alignItems: 'center' },
  amountOptionActive: { borderColor: '#10b981', backgroundColor: '#042f2e' },
  amountOptionLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  amountOptionLabelActive: { color: '#10b981' },
  amountOptionValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '800', marginTop: 4 },

  customAmtBox: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  inputLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  customAmtRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyPrefix: { color: '#64748b', fontSize: 16, fontWeight: '700' },
  customAmtInput: { flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#10b981', fontSize: 22, fontWeight: '800', borderWidth: 1, borderColor: '#334155' },
  amtWarning: { color: '#f59e0b', fontSize: 12, marginTop: 8 },
  amtInfo: { color: '#60a5fa', fontSize: 12, marginTop: 8 },

  finalApprovalBox: { backgroundColor: '#042f2e', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#10b981' },
  finalApprovalLabel: { color: '#10b981', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  finalApprovalAmount: { color: '#10b981', fontSize: 28, fontWeight: '900', marginTop: 4 },

  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 },
  pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1e293b', borderWidth: 1.5, borderColor: '#334155' },
  pinDotFilled: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pinInput: {
    backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155',
    paddingVertical: 14, paddingHorizontal: 20, color: '#f1f5f9', fontSize: 18,
    letterSpacing: 8, marginBottom: 16,
  },

  reasonInput: {
    backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1.5, borderColor: '#ef4444',
    padding: 12, color: '#f1f5f9', fontSize: 14, height: 90,
    textAlignVertical: 'top', marginBottom: 16,
  },

  modeToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  modeBtnActive: { borderColor: '#10b981', backgroundColor: '#042f2e' },
  modeBtnRejectActive: { borderColor: '#ef4444', backgroundColor: '#2d0f0f' },
  modeBtnText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },

  modalFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#1e293b', alignItems: 'center' },
  cancelBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '700' },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  submitBtnApprove: { backgroundColor: '#059669' },
  submitBtnReject: { backgroundColor: '#dc2626' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
