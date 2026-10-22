/**
 * The phone/browser notification, on top of the sound and the on-screen
 * alert: it shows when the page is in the background, if the person allowed
 * notifications. Best-effort everywhere: none of this is guaranteed (iOS only
 * notifies installed web apps; a locked phone may not run the page at all).
 */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** True when asking would show the browser's prompt (not decided yet). */
export function canAskForNotifications(): boolean {
  return notificationsSupported() && Notification.permission === 'default';
}

export async function askForNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Shows a notification while the page is not in view (on screen, the page
 * shows its own alert) and vibrates the phone either way.
 */
export function notify(title: string, body: string, tag: string, vibrate: number[] = [180, 80, 180]): void {
  try {
    navigator.vibrate?.(vibrate);
  } catch {
    // Not every browser lets a page vibrate.
  }
  if (!notificationsSupported() || Notification.permission !== 'granted' || document.visibilityState === 'visible') {
    return;
  }
  try {
    const notification = new Notification(title, { body, tag, icon: '/favicon.svg' });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
