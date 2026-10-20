import React, { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth.store';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { requestNotificationPermissions, showLocalNotification, setBadgeCount } from '../src/services/notifications';
import { notificationsApi } from '../src/services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30000 },
  },
});

// ─── Global JS error handler ─────────────────────────────────────────────────
// Catches unhandled JS exceptions and surfaces them visually
if (typeof ErrorUtils !== 'undefined') {
  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    if (isFatal) {
      console.error('[FATAL CRASH]', error.message, error.stack);
    }
    if (prevHandler) prevHandler(error, isFatal);
  });
}

export default function RootLayout() {
  const { loadFromStorage, token, user } = useAuthStore();
  const prevNotifCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadFromStorage().catch(() => {});
    requestNotificationPermissions();
  }, []);

  // Poll for new notifications every 20 seconds when app is active and user is logged in
  const pollNotifications = useCallback(async () => {
    if (!token || !user) return;
    try {
      const res = await notificationsApi.list({ unreadOnly: true, limit: 5 });
      const data = res.data;
      const unreadCount = data?.meta?.unreadCount ?? 0;
      const notifications = data?.data ?? [];

      setBadgeCount(unreadCount);

      // If there are new notifications since last check, show the latest one as popup
      if (unreadCount > prevNotifCount.current && prevNotifCount.current >= 0) {
        const latest = notifications[0];
        if (latest) {
          const meta = latest.metadata as any;
          const isApproval = meta?.action === 'APPROVAL_NEEDED';
          showLocalNotification(
            latest.subject || (isApproval ? '🔔 Approval Required' : '📢 KenyaPay Update'),
            latest.message,
            { transactionId: latest.transactionId, action: meta?.action },
            isApproval ? 'approvals' : 'payments',
          );
        }
      }
      prevNotifCount.current = unreadCount;
    } catch {}
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      // Initial poll
      pollNotifications();
      // Set up interval
      pollTimer.current = setInterval(pollNotifications, 20000);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [token, user, pollNotifications]);

  // Also re-poll when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && token) {
        pollNotifications();
      }
    });
    return () => sub.remove();
  }, [token, pollNotifications]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="dark" backgroundColor="transparent" translucent={true} />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
