import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../api/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);

    const { data: { user } } = await supabase.auth.getUser();
    if (user && token) {
      await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('id', user.id);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export function setupNotificationListener(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (response: Notifications.NotificationResponse) => void
) {
  const receivedListener = Notifications.addNotificationReceivedListener(onNotificationReceived);
  const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

  return () => {
    Notifications.removeNotificationSubscription(receivedListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
}
