import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, RefreshControl,
  Modal, Animated, Dimensions, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';
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

const RAIL_ICON: Record<string, string> = {
  MPESA_B2C: 'phone-portrait',
  MPESA_B2B_PAYBILL: 'business',
  MPESA_B2B_TILL: 'cart',
  PESALINK: 'swap-horizontal',
  RTGS: 'library',
  EQUITY_JENGA: 'flash',
  KCB_OPEN_BANKING: 'key',
};

// ─── Checker Queue roles ──────────────────────────────────────────────────────
const CHECKER_ROLES = ['CHECKER', 'FINANCE_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'];
// ─── Director Sign-off roles ──────────────────────────────────────────────────
const DIRECTOR_ROLES = ['DIRECTOR', 'ORG_ADMIN', 'SUPER_ADMIN'];

// ────────────────────────────────────────────────────────────────────────────
// DIRECTOR APPROVAL MODAL — Full amount OR custom amount + PIN
// ────────────────────────────────────────────────────────────────────────────
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
  const slideAnim = useRef(new Animated.Value(300)).current;

  React.useEffect(() => {
    if (visible) {
      setMode('approve'); setPin(''); setReason('');
      setUseCustomAmount(false); setCustomAmount('');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!payment) return null;

  const requestedAmt = Number(payment.amount ?? 0);
  const parsedCustom = parseFloat(customAmount.replace(/,/g, ''));
  const finalAmount = useCustomAmount && !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : requestedAmt;
  const canSubmit = pin.length >= 4 && (mode === 'approve' || reason.trim().length > 5);
  const customExceedsRequested = useCustomAmount && parsedCustom > requestedAmt;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />

          {/* Header gradient */}
          <LinearGradient
            colors={mode === 'approve' ? ['#0c2340', '#0f3460'] : ['#2d0f1e', '#3a0d1a']}
            style={s.sheetHeader}
          >
            <View style={[s.sheetHeaderIcon, { backgroundColor: mode === 'approve' ? '#1e40af' : '#9f1239' }]}>
              <Ionicons name={mode === 'approve' ? 'shield-checkmark' : 'close-circle'} size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetHeaderTitle}>
                {mode === 'approve' ? 'Director Authorization' : 'Reject Payment'}
              </Text>
              <Text style={s.sheetHeaderRef} numberOfLines={1}>{payment.reference}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.sheetCloseBtn}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Payment summary card */}
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Recipient</Text>
                <Text style={s.summaryValue} numberOfLines={1}>{payment.recipientName ?? '—'}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Payment Rail</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={(RAIL_ICON[payment.rail] ?? 'card') as any} size={14} color="#6366f1" />
                  <Text style={s.summaryValue}>{payment.rail?.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Requested</Text>
                <Text style={[s.summaryValue, { color: '#f59e0b', fontWeight: '800', fontSize: 16 }]}>
                  {formatKES(requestedAmt)}
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Submitted by</Text>
                <Text style={s.summaryValue}>{payment.maker?.firstName} {payment.maker?.lastName}</Text>
              </View>
              {payment.checkerNote && (
                <View style={[s.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={s.summaryLabel}>Checker Note</Text>
                  <Text style={[s.summaryValue, { color: '#22d3ee', maxWidth: '65%' }]} numberOfLines={2}>
                    {payment.checkerNote}
                  </Text>
                </View>
              )}
            </View>

            {/* ── APPROVE MODE ── */}
            {mode === 'approve' && (
              <>
                {/* Amount selector */}
                <Text style={s.fieldLabel}>AUTHORIZED AMOUNT</Text>
                <View style={s.amountToggleRow}>
                  <TouchableOpacity
                    style={[s.amountToggleBtn, !useCustomAmount && s.amountToggleBtnActive]}
                    onPress={() => setUseCustomAmount(false)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={!useCustomAmount ? '#10b981' : '#475569'} />
                    <Text style={[s.amountToggleLabel, !useCustomAmount && { color: '#10b981' }]}>Full Amount</Text>
                    <Text style={[s.amountToggleValue, !useCustomAmount && { color: '#10b981' }]}>
                      {formatKES(requestedAmt)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.amountToggleBtn, useCustomAmount && s.amountToggleBtnActive]}
                    onPress={() => setUseCustomAmount(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={18} color={useCustomAmount ? '#10b981' : '#475569'} />
                    <Text style={[s.amountToggleLabel, useCustomAmount && { color: '#10b981' }]}>Custom Amount</Text>
                    <Text style={[s.amountToggleValue, useCustomAmount && { color: '#10b981' }]}>
                      {useCustomAmount && parsedCustom > 0 ? formatKES(parsedCustom) : 'Enter amount →'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {useCustomAmount && (
                  <View style={s.customAmtCard}>
                    <Text style={s.fieldLabel}>ENTER AMOUNT TO APPROVE (KES)</Text>
                    <View style={s.customAmtInputRow}>
                      <Text style={s.kesCurrency}>KES</Text>
                      <TextInput
                        style={s.customAmtInput}
                        value={customAmount}
                        onChangeText={setCustomAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#334155"
                        autoFocus
                      />
                    </View>
                    {customExceedsRequested && (
                      <View style={s.warningRow}>
                        <Ionicons name="warning" size={14} color="#f59e0b" />
                        <Text style={s.warningText}>Custom amount exceeds requested amount</Text>
                      </View>
                    )}
                    {!isNaN(parsedCustom) && parsedCustom > 0 && parsedCustom < requestedAmt && (
                      <View style={s.infoRow}>
                        <Ionicons name="information-circle" size={14} color="#60a5fa" />
                        <Text style={s.infoText}>
                          Approving {formatKES(parsedCustom)} of {formatKES(requestedAmt)} requested.
                          Excess will be released back to wallet.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Final amount box */}
                <LinearGradient colors={['#042f2e', '#064e3b']} style={s.finalAmtBox}>
                  <Text style={s.finalAmtLabel}>FINAL AUTHORIZED AMOUNT</Text>
                  <Text style={s.finalAmtValue}>{formatKES(finalAmount)}</Text>
                  {useCustomAmount && parsedCustom > 0 && parsedCustom !== requestedAmt && (
                    <Text style={s.finalAmtNote}>
                      {parsedCustom < requestedAmt
                        ? `↓ Partial — KES ${(requestedAmt - parsedCustom).toLocaleString()} released back`
                        : `↑ Exceeds requested by KES ${(parsedCustom - requestedAmt).toLocaleString()}`}
                    </Text>
                  )}
                </LinearGradient>
              </>
            )}

            {/* ── REJECT MODE ── */}
            {mode === 'reject' && (
              <>
                <Text style={s.fieldLabel}>REJECTION REASON *</Text>
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
                {reason.trim().length > 0 && reason.trim().length <= 5 && (
                  <Text style={s.warningText}>Please provide a more detailed reason (min 6 chars)</Text>
                )}
              </>
            )}

            {/* Director PIN */}
            <Text style={s.fieldLabel}>DIRECTOR PIN *</Text>
            <View style={s.pinDotsRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[
                    s.pinDot,
                    pin.length > i && s.pinDotFilled,
                    pin.length === i && s.pinDotCurrent,
                  ]}
                />
              ))}
            </View>
            <TextInput
              style={s.pinInput}
              value={pin}
              onChangeText={setPin}
              placeholder="Enter your 4–6 digit PIN"
              placeholderTextColor="#334155"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              textAlign="center"
            />

            {/* Approve / Reject toggle */}
            <View style={s.modeRow}>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'approve' && s.modeBtnApprove]}
                onPress={() => setMode('approve')}
              >
                <Ionicons name="checkmark" size={16} color={mode === 'approve' ? '#10b981' : '#475569'} />
                <Text style={[s.modeBtnText, mode === 'approve' && { color: '#10b981' }]}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'reject' && s.modeBtnReject]}
                onPress={() => setMode('reject')}
              >
                <Ionicons name="close" size={16} color={mode === 'reject' ? '#ef4444' : '#475569'} />
                <Text style={[s.modeBtnText, mode === 'reject' && { color: '#ef4444' }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={s.sheetFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.submitBtn,
                mode === 'approve' ? s.submitBtnApprove : s.submitBtnReject,
                (!canSubmit || customExceedsRequested) && { opacity: 0.4 },
              ]}
              disabled={!canSubmit || loading || customExceedsRequested}
              onPress={() => {
                const amt = useCustomAmount && parsedCustom > 0 ? parsedCustom : undefined;
                onSubmit(payment.id, mode, pin, reason, amt);
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={mode === 'approve' ? 'shield-checkmark' : 'close-circle'}
                    size={18}
                    color="#fff"
                  />
                  <Text style={s.submitBtnText}>
                    {mode === 'approve' ? 'Authorize Payment' : 'Reject Payment'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CHECKER MODAL — Manager reviews maker's payment
// ────────────────────────────────────────────────────────────────────────────
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
  const [note, setNote] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;

  React.useEffect(() => {
    if (visible) {
      setMode('approve'); setReason(''); setNote('');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!payment) return null;
  const canSubmit = mode === 'approve' || reason.trim().length > 5;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />

          <LinearGradient
            colors={mode === 'approve' ? ['#0c2340', '#0f3460'] : ['#2d0f1e', '#3a0d1a']}
            style={s.sheetHeader}
          >
            <View style={[s.sheetHeaderIcon, { backgroundColor: mode === 'approve' ? '#1d4ed8' : '#be123c' }]}>
              <Ionicons name={mode === 'approve' ? 'checkmark-circle' : 'close-circle'} size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetHeaderTitle}>Checker Review</Text>
              <Text style={s.sheetHeaderRef}>{payment.reference}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.sheetCloseBtn}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={s.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Summary */}
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>To</Text>
                <Text style={s.summaryValue}>{payment.recipientName ?? '—'}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Rail</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={(RAIL_ICON[payment.rail] ?? 'card') as any} size={14} color="#6366f1" />
                  <Text style={s.summaryValue}>{payment.rail?.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Amount</Text>
                <Text style={[s.summaryValue, { color: '#10b981', fontWeight: '800', fontSize: 18 }]}>
                  {formatKES(Number(payment.amount))}
                </Text>
              </View>
              <View style={[s.summaryRow, { borderBottomWidth: 0 }]}>
                <Text style={s.summaryLabel}>Maker</Text>
                <Text style={s.summaryValue}>{payment.maker?.firstName} {payment.maker?.lastName}</Text>
              </View>
            </View>

            {/* Description */}
            {payment.description && (
              <View style={s.descCard}>
                <Text style={s.fieldLabel}>PAYMENT PURPOSE</Text>
                <Text style={s.descText}>"{payment.description}"</Text>
              </View>
            )}

            {/* Checker note (optional) */}
            <Text style={s.fieldLabel}>YOUR NOTE (optional)</Text>
            <TextInput
              style={[s.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note for the Director..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            {/* Rejection reason */}
            {mode === 'reject' && (
              <>
                <Text style={s.fieldLabel}>REJECTION REASON *</Text>
                <TextInput
                  style={s.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="State a clear reason for rejection..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                />
              </>
            )}

            {/* Mode toggle */}
            <View style={s.modeRow}>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'approve' && s.modeBtnApprove]}
                onPress={() => setMode('approve')}
              >
                <Ionicons name="checkmark" size={16} color={mode === 'approve' ? '#10b981' : '#475569'} />
                <Text style={[s.modeBtnText, mode === 'approve' && { color: '#10b981' }]}>
                  Approve to Director
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'reject' && s.modeBtnReject]}
                onPress={() => setMode('reject')}
              >
                <Ionicons name="close" size={16} color={mode === 'reject' ? '#ef4444' : '#475569'} />
                <Text style={[s.modeBtnText, mode === 'reject' && { color: '#ef4444' }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={s.sheetFooter}>
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
              onPress={() => onSubmit(payment.id, mode, mode === 'reject' ? reason : note)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name={mode === 'approve' ? 'arrow-forward-circle' : 'close-circle'} size={18} color="#fff" />
                  <Text style={s.submitBtnText}>
                    {mode === 'approve' ? 'Forward to Director' : 'Reject Payment'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PAYMENT CARD
// ────────────────────────────────────────────────────────────────────────────
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
  const initials = ((payment.recipientName ?? '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2)).toUpperCase();
  const accentColor = isDirector ? '#7c3aed' : '#0ea5e9';

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <View style={[s.card, { borderColor: accentColor + '40' }]}>
          <LinearGradient colors={[accentColor, accentColor + 'cc']} style={s.cardAccent} />
          <View style={s.cardBody}>
            <View style={s.cardTopRow}>
              <LinearGradient colors={isDirector ? ['#4c1d95', '#5b21b6'] : ['#075985', '#0369a1']} style={s.cardAvatar}>
                <Text style={s.cardAvatarText}>{initials}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName} numberOfLines={1}>
                  {payment.recipientName ?? payment.recipientPhone ?? '—'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <Ionicons name={(RAIL_ICON[payment.rail] ?? 'card') as any} size={12} color="#64748b" />
                  <Text style={s.cardSub}>{payment.rail?.replace(/_/g, ' ')} · {timeAgo(payment.createdAt)}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <Text style={[s.cardAmount, { color: accentColor }]}>{formatKES(Number(payment.amount))}</Text>
                <View style={[s.rolePill, { backgroundColor: accentColor + '25', borderColor: accentColor + '60', borderWidth: 1 }]}>
                  <Text style={[s.rolePillText, { color: accentColor }]}>
                    {isDirector ? '🛡️ Director' : '✅ Checker'}
                  </Text>
                </View>
              </View>
            </View>

            {payment.description && (
              <View style={s.cardDesc}>
                <Text style={s.cardDescText} numberOfLines={1}>"{payment.description}"</Text>
              </View>
            )}

            <View style={s.cardFooter}>
              <Text style={s.cardRef}>#{payment.reference}</Text>
              <Text style={s.cardMaker}>by {payment.maker?.firstName} {payment.maker?.lastName}</Text>
            </View>

            <View style={[s.cardCta, { borderTopColor: accentColor + '30' }]}>
              <Text style={[s.cardCtaText, { color: accentColor }]}>
                {isDirector ? 'Tap to authorize →' : 'Tap to review & forward →'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN APPROVALS SCREEN
// ────────────────────────────────────────────────────────────────────────────
export default function ApprovalsScreen() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const isChecker = CHECKER_ROLES.includes(user?.role ?? '');
  const isDirector = DIRECTOR_ROLES.includes(user?.role ?? '');

  // Default to checker tab if user has checker role, director tab if only director
  const [tab, setTab] = useState<'checker' | 'director'>(
    isChecker ? 'checker' : 'director'
  );
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [directorModalOpen, setDirectorModalOpen] = useState(false);
  const [checkerModalOpen, setCheckerModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Checker queue — payments waiting for manager review
  const { data: checkerData, isLoading: checkerLoading, refetch: refetchChecker } = useQuery({
    queryKey: ['mobile-approvals-checker'],
    queryFn: () => paymentsApi.pendingApprovals().then((r) => r.data.data ?? []),
    enabled: isChecker,
    refetchInterval: 30_000,
  });

  // Director queue — payments already approved by checker, waiting for director
  const { data: directorData, isLoading: directorLoading, refetch: refetchDirector } = useQuery({
    queryKey: ['mobile-approvals-director'],
    queryFn: () => paymentsApi.directorApprovals().then((r) => r.data.data ?? []),
    enabled: isDirector,
    refetchInterval: 30_000,
  });

  const checkerMutation = useMutation({
    mutationFn: ({ id, action, reason }: any) => paymentsApi.checkerAction(id, action, reason),
    onSuccess: (_, vars) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['mobile-approvals-checker'] });
      qc.invalidateQueries({ queryKey: ['mobile-approvals-director'] });
      setCheckerModalOpen(false);
      Alert.alert(
        vars.action === 'approve' ? '✅ Forwarded to Director!' : '❌ Payment Rejected',
        vars.action === 'approve'
          ? 'Payment has been verified and sent to the Director for final authorization.'
          : 'Payment has been rejected. The maker will be notified.',
      );
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
      qc.invalidateQueries({ queryKey: ['mobile-recent-tx'] });
      setDirectorModalOpen(false);
      Alert.alert(
        vars.action === 'approve' ? '🛡️ Payment Authorized!' : '❌ Payment Rejected',
        vars.action === 'approve'
          ? `Payment of ${vars.approvedAmount ? formatKES(vars.approvedAmount) : 'full amount'} has been authorized and will be disbursed shortly.`
          : 'Payment has been rejected. The maker has been notified.',
      );
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Authorization Failed', e?.response?.data?.message ?? 'Invalid PIN or session expired.');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      isChecker ? refetchChecker() : Promise.resolve(),
      isDirector ? refetchDirector() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const payments = tab === 'director' ? (directorData ?? []) : (checkerData ?? []);
  const isLoading = tab === 'director' ? directorLoading : checkerLoading;
  const checkerCount = checkerData?.length ?? 0;
  const directorCount = directorData?.length ?? 0;

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={s.header}>
        <View>
          <Text style={s.headerTitle}>Approvals</Text>
          <Text style={s.headerSub}>
            {checkerCount + directorCount} pending · Auto-refreshes every 30s
          </Text>
        </View>
        {/* Role badges */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isChecker && (
            <View style={s.roleBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#22d3ee" />
              <Text style={[s.roleBadgeText, { color: '#22d3ee' }]}>Checker</Text>
            </View>
          )}
          {isDirector && (
            <View style={[s.roleBadge, { borderColor: '#a78bfa' }]}>
              <Ionicons name="shield-checkmark" size={12} color="#a78bfa" />
              <Text style={[s.roleBadgeText, { color: '#a78bfa' }]}>Director</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Tab switcher — always shown if user has either or both roles */}
      <View style={s.tabRow}>
        {isChecker && (
          <TouchableOpacity
            style={[s.tabBtn, tab === 'checker' && s.tabBtnCheckerActive]}
            onPress={() => setTab('checker')}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={tab === 'checker' ? '#0ea5e9' : '#475569'}
            />
            <Text style={[s.tabBtnText, tab === 'checker' && s.tabBtnTextCheckerActive]}>
              Checker Queue
            </Text>
            {checkerCount > 0 && (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeText}>{checkerCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {isDirector && (
          <TouchableOpacity
            style={[s.tabBtn, tab === 'director' && s.tabBtnDirectorActive]}
            onPress={() => setTab('director')}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={tab === 'director' ? '#a78bfa' : '#475569'}
            />
            <Text style={[s.tabBtnText, tab === 'director' && s.tabBtnTextDirectorActive]}>
              Director Sign-off
            </Text>
            {directorCount > 0 && (
              <View style={[s.tabBadge, { backgroundColor: '#7c3aed' }]}>
                <Text style={s.tabBadgeText}>{directorCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Info banner */}
      <View style={[s.infoBanner,
        tab === 'director'
          ? { backgroundColor: '#1e1030', borderColor: '#7c3aed' }
          : { backgroundColor: '#0c1c2e', borderColor: '#0ea5e9' }
      ]}>
        <Ionicons
          name={tab === 'director' ? 'shield-checkmark' : 'checkmark-done'}
          size={16}
          color={tab === 'director' ? '#a78bfa' : '#38bdf8'}
        />
        <Text style={[s.infoBannerText, { color: tab === 'director' ? '#c4b5fd' : '#7dd3fc' }]}>
          {tab === 'director'
            ? '🛡️ Final authorization. Approved payments are immediately disbursed.'
            : '✅ Checker queue. Verify payments and forward to Director for final sign-off.'}
        </Text>
      </View>

      {/* Payment list */}
      {isLoading && !refreshing ? (
        <View style={s.loader}>
          <ActivityIndicator color="#6366f1" size="large" />
          <Text style={s.loaderText}>Loading {tab === 'director' ? 'director' : 'checker'} queue...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
        >
          {payments.length === 0 ? (
            <View style={s.empty}>
              <LinearGradient colors={['#1e293b', '#0f172a']} style={s.emptyIconBox}>
                <Ionicons
                  name={tab === 'director' ? 'shield-checkmark' : 'checkmark-done-circle'}
                  size={48}
                  color={tab === 'director' ? '#7c3aed' : '#0ea5e9'}
                />
              </LinearGradient>
              <Text style={s.emptyTitle}>All caught up! 🎉</Text>
              <Text style={s.emptySub}>
                No pending {tab === 'director' ? 'director' : 'checker'} approvals right now.
              </Text>
              <Text style={s.emptySub2}>Pull down to refresh</Text>
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

// ────────────────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2, fontWeight: '500' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc' },
  roleBadgeText: { fontSize: 11, fontWeight: '800', color: '#0891b2' },

  // Tab row
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0' },
  tabBtnCheckerActive: { borderColor: '#0284c7', backgroundColor: '#f0f9ff' },
  tabBtnDirectorActive: { borderColor: '#7c3aed', backgroundColor: '#f5f3ff' },
  tabBtnText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  tabBtnTextCheckerActive: { color: '#0284c7' },
  tabBtnTextDirectorActive: { color: '#7c3aed' },
  tabBadge: { backgroundColor: '#0284c7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  // Banner
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginTop: 4, borderRadius: 12, padding: 12, borderWidth: 1 },
  infoBannerText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },

  // List
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { color: '#64748b', fontSize: 14, fontWeight: '600' },

  // Card
  card: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
    flexDirection: 'row', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  cardAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cardName: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  cardSub: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  cardAmount: { fontSize: 17, fontWeight: '900' },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  rolePillText: { fontSize: 10, fontWeight: '800' },
  cardDesc: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  cardDescText: { color: '#475569', fontSize: 12, fontStyle: 'italic' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardRef: { color: '#4f46e5', fontSize: 11, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardMaker: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  cardCta: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', alignItems: 'center' },
  cardCtaText: { fontSize: 13, fontWeight: '700' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  emptyTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  emptySub: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  emptySub2: { color: '#94a3b8', fontSize: 12, marginTop: 6 },

  // Bottom sheet modal
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%', borderWidth: 1, borderColor: '#e2e8f0' },
  handle: { width: 44, height: 5, backgroundColor: '#cbd5e1', borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetHeaderIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetHeaderTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  sheetHeaderRef: { color: '#64748b', fontSize: 12, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 18 },
  sheetFooter: { flexDirection: 'row', gap: 12, padding: 18, borderTopWidth: 1, borderTopColor: '#f1f5f9' },

  // Summary card
  summaryCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#edf2f7' },
  summaryLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  summaryValue: { color: '#0f172a', fontSize: 14, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },

  fieldLabel: { color: '#334155', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  // Amount toggle
  amountToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  amountToggleBtn: { flex: 1, backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', gap: 4 },
  amountToggleBtnActive: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  amountToggleLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  amountToggleValue: { color: '#0f172a', fontSize: 14, fontWeight: '800' },

  // Custom amount
  customAmtCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  customAmtInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kesCurrency: { color: '#64748b', fontSize: 18, fontWeight: '800' },
  customAmtInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, color: '#059669', fontSize: 24, fontWeight: '900', borderWidth: 1.5, borderColor: '#cbd5e1' },

  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  warningText: { color: '#d97706', fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  infoText: { color: '#2563eb', fontSize: 12, flex: 1, lineHeight: 17, fontWeight: '500' },

  // Final amount
  finalAmtBox: { borderRadius: 16, padding: 18, marginBottom: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  finalAmtLabel: { color: '#059669', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  finalAmtValue: { color: '#047857', fontSize: 30, fontWeight: '900', marginTop: 4 },
  finalAmtNote: { color: '#065f46', fontSize: 12, marginTop: 4, textAlign: 'center', fontWeight: '500' },

  // Description + Note
  descCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  descText: { color: '#475569', fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  noteInput: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', padding: 12, color: '#0f172a', fontSize: 14, height: 70, textAlignVertical: 'top', marginBottom: 12 },

  // Rejection
  reasonInput: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1.5, borderColor: '#ef4444', padding: 12, color: '#0f172a', fontSize: 14, height: 90, textAlignVertical: 'top', marginBottom: 12 },

  // PIN
  pinDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  pinDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: '#cbd5e1' },
  pinDotFilled: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pinDotCurrent: { borderColor: '#4f46e5' },
  pinInput: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1.5, borderColor: '#cbd5e1', paddingVertical: 14, paddingHorizontal: 20, color: '#0f172a', fontSize: 22, letterSpacing: 12, marginBottom: 16 },

  // Mode toggle
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0' },
  modeBtnApprove: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  modeBtnReject: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  modeBtnText: { color: '#64748b', fontSize: 13, fontWeight: '700' },

  // Footer buttons
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontSize: 15, fontWeight: '700' },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  submitBtnApprove: { backgroundColor: '#059669' },
  submitBtnReject: { backgroundColor: '#dc2626' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
