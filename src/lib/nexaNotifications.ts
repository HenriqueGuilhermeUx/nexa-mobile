import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ALERTS_CHANNEL = 'nexa-alerts';
const REMINDERS_CHANNEL = 'nexa-reminders';

let handlerConfigured = false;

export type NexaNotificationPermission = {
  granted: boolean;
  newlyGranted: boolean;
  canAskAgain: boolean;
};

export type NexaReminderInput = {
  title: string;
  body: string;
  at: Date | string;
  data?: Record<string, string | number | boolean | null>;
};

function ensureHandler() {
  if (handlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  handlerConfigured = true;
}

export async function initializeNexaNotifications() {
  ensureHandler();

  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL, {
    name: 'Avisos Nexa',
    description: 'Avisos importantes da sua conta e do Assistente Nexa.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL, {
    name: 'Lembretes Nexa',
    description: 'Lembretes, tarefas e compromissos que você pediu à Nexa.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    sound: 'default',
  });
}

export async function ensureNexaNotificationPermission(): Promise<NexaNotificationPermission> {
  await initializeNexaNotifications();

  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return {
      granted: true,
      newlyGranted: false,
      canAskAgain: current.canAskAgain,
    };
  }

  if (!current.canAskAgain) {
    return {
      granted: false,
      newlyGranted: false,
      canAskAgain: false,
    };
  }

  const requested = await Notifications.requestPermissionsAsync();
  return {
    granted: requested.status === 'granted',
    newlyGranted: requested.status === 'granted',
    canAskAgain: requested.canAskAgain,
  };
}

export async function showNexaNotification(
  title: string,
  body: string,
  data: Record<string, string | number | boolean | null> = {},
) {
  await initializeNexaNotifications();

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data,
    },
    trigger: Platform.OS === 'android'
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          channelId: ALERTS_CHANNEL,
        }
      : null,
  });
}

export async function scheduleNexaReminder(input: NexaReminderInput) {
  await initializeNexaNotifications();

  const at = input.at instanceof Date ? input.at : new Date(input.at);
  if (Number.isNaN(at.getTime())) {
    throw new Error('Invalid Nexa reminder date');
  }
  if (at.getTime() <= Date.now() + 1000) {
    throw new Error('Nexa reminder must be scheduled in the future');
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: 'default',
      data: {
        source: 'nexa_assistant',
        type: 'reminder',
        ...(input.data || {}),
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      ...(Platform.OS === 'android' ? { channelId: REMINDERS_CHANNEL } : {}),
    },
  });
}

export async function cancelNexaReminder(notificationId: string) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function listScheduledNexaNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}
