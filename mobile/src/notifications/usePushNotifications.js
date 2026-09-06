import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from '../api/client';

export function usePushNotifications() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    let Notifications;
    try { Notifications = require('expo-notifications'); } catch { return; }
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
          });
        }
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        if (mounted && token) {
          try { await api.registrarPush(token); } catch {}
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);
}
