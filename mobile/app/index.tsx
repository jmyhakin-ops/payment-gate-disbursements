import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';

export default function RootIndex() {
  const { isAuthenticated, isLoading, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage().catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)" />;
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
