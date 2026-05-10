import { useEffect, useState } from 'react';

function getIsDocumentVisible() {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.visibilityState === 'visible';
}

export function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(getIsDocumentVisible);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const syncVisibility = () => {
      setIsVisible(getIsDocumentVisible());
    };

    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('focus', syncVisibility);
    window.addEventListener('blur', syncVisibility);
    syncVisibility();

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('focus', syncVisibility);
      window.removeEventListener('blur', syncVisibility);
    };
  }, []);

  return isVisible;
}
