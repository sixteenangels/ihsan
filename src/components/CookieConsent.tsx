import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface CookieConsentProps {
  suppressed?: boolean;
}

export function CookieConsent({ suppressed = false }: CookieConsentProps) {
  const { isEnabled } = useFeatureFlags();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (suppressed) {
      setShow(false);
      return;
    }

    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [suppressed]);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setShow(false);
  };

  if (suppressed || !show || !isEnabled('cookie_consent')) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] animate-in slide-in-from-bottom md:bottom-4 md:left-auto md:right-4 md:max-w-md">
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-1">We use cookies</p>
            <p className="text-xs text-muted-foreground mb-3">
              We use cookies to improve your experience, remember your preferences, and analyze site traffic. By continuing, you agree to our use of cookies.
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="rounded-xl" onClick={handleAccept}>Accept</Button>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={handleDecline}>Decline</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
