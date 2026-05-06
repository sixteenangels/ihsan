import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export function CookieConsent() {
  const { isEnabled } = useFeatureFlags();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setShow(false);
  };

  if (!show || !isEnabled('cookie_consent')) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[60] animate-in slide-in-from-bottom">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-1">We use cookies</p>
            <p className="text-xs text-muted-foreground mb-3">
              We use cookies to improve your experience, remember your preferences, and analyze site traffic. By continuing, you agree to our use of cookies.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAccept}>Accept</Button>
              <Button size="sm" variant="outline" onClick={handleDecline}>Decline</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
