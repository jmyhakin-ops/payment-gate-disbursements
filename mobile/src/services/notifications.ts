import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are shown when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions on Android/iOS
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('approvals', {
        name: 'Payment Approvals',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4f46e5',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
      });
      await Notifications.setNotificationChannelAsync('payments', {
        name: 'Payment Updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        enableVibrate: true,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (e) {
    console.error('Error requesting notification permissions:', e);
    return false;
  }
}

/**
 * Show a local notification (used when polling finds new approvals)
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId: string = 'approvals'
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null, // show immediately
    });
  } catch (e) {
    console.error('Error showing notification:', e);
  }
}

/**
 * Get the badge count
 */
export async function setBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {}
}
