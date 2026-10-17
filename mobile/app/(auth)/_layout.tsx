import { Stack } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { token } = useAuthStore();

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
