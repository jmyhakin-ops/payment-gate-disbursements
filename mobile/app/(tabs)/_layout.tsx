import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth.store';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconsName;
  outlineName: IoniconsName;
  label: string;
  focused: boolean;
  color: string;
  badge?: number;
}

function TabIcon({ name, outlineName, label, focused, color, badge }: TabIconProps) {
  return (
    <View style={{ alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 6 : 4 }}>
      <View style={{ position: 'relative' }}>
        <Ionicons name={focused ? name : outlineName} size={24} color={color} />
        {badge != null && badge > 0 && (
          <View style={{
            position: 'absolute', top: -4, right: -8,
            backgroundColor: '#ef4444', borderRadius: 8,
            minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
          }}>
            <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text style={{
        fontSize: 10, fontWeight: focused ? '700' : '500',
        marginTop: 3, color,
        letterSpacing: 0.2,
      }}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const role = user?.role;
  const isDirectorOrAbove = ['SUPER_ADMIN', 'ORG_ADMIN', 'DIRECTOR', 'CHECKER', 'FINANCE_MANAGER'].includes(role ?? '');

  // Poll pending approvals count every 30s for badge
  const { data: pendingCounts } = useQuery({
    queryKey: ['pending-counts-tab'],
    queryFn: () => paymentsApi.pendingCounts(),
    enabled: isDirectorOrAbove,
    refetchInterval: 30000,
  });

  const checkerPending = pendingCounts?.checker ?? 0;
  const directorPending = pendingCounts?.director ?? 0;
  const approvalBadge = checkerPending + directorPending;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 12,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name="home"
              outlineName="home-outline"
              label="Home"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name="card"
              outlineName="card-outline"
              label="Payments"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name="shield-checkmark"
              outlineName="shield-checkmark-outline"
              label="Approvals"
              focused={focused}
              color={color}
              badge={approvalBadge}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name="wallet"
              outlineName="wallet-outline"
              label="Wallets"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name="people"
              outlineName="people-outline"
              label="Team"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name="person-circle"
              outlineName="person-circle-outline"
              label="Profile"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
