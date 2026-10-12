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

export async function initializeNexaNotifications() {}

export async function ensureNexaNotificationPermission(): Promise<NexaNotificationPermission> {
  if (typeof Notification === 'undefined') {
    return { granted: false, newlyGranted: false, canAskAgain: false };
  }

  if (Notification.permission === 'granted') {
    return { granted: true, newlyGranted: false, canAskAgain: true };
  }

  if (Notification.permission === 'denied') {
    return { granted: false, newlyGranted: false, canAskAgain: false };
  }

  const permission = await Notification.requestPermission();
  return {
    granted: permission === 'granted',
    newlyGranted: permission === 'granted',
    canAskAgain: permission !== 'denied',
  };
}

export async function showNexaNotification(title: string, body: string) {
  const permission = await ensureNexaNotificationPermission();
  if (!permission.granted || typeof Notification === 'undefined') {
    throw new Error('Browser notifications are not available.');
  }
  new Notification(title, { body });
  return `web-notification-${Date.now()}`;
}

export async function scheduleNexaReminder(_input: NexaReminderInput) {
  throw new Error('Scheduled reminders are not enabled in the Nexa Global web pilot.');
}

export async function cancelNexaReminder(_notificationId: string) {}

export async function listScheduledNexaNotifications() {
  return [];
}
