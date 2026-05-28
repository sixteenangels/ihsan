import { Capacitor } from '@capacitor/core';

const MOBILE_SESSION_QUERY = '(max-width: 767px), (pointer: coarse)';
const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function isMobileSessionRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (Capacitor.isNativePlatform()) {
    return true;
  }

  return (
    window.matchMedia?.(MOBILE_SESSION_QUERY).matches ||
    MOBILE_USER_AGENT_PATTERN.test(window.navigator.userAgent)
  );
}
