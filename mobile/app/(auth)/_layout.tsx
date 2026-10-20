import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
