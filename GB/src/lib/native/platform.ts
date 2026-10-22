import { Capacitor } from '@capacitor/core';

/**
 * Whether this is the installed phone app (Android/iPhone, see
 * capacitor.config.ts) and not a browser. There some things are done the
 * phone's way: notifications, the location with the phone locked.
 */
export const isNativeApp = Capacitor.isNativePlatform();

export function nativePlatform(): 'android' | 'ios' | null {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' ? platform : null;
}
