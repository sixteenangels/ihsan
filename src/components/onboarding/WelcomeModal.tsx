import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MapPin, Heart, Bell, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { CategoryIconDisplay } from '@/components/categories/CategoryIconDisplay';
import { cn } from '@/lib/utils';

const INTERESTS = [
  'Electronics', 'Fashion', 'Beauty', 'Home & Kitchen', 'Sports',
  'Toys & Games', 'Auto Parts', 'Food & Beverages', 'Health',
];

const REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
  'Volta', 'Northern', 'Upper East', 'Upper West', 'Bono',
  'Bono East', 'Ahafo', 'Savannah', 'North East', 'Oti', 'Western North',
];

let customerPreferencesTableUnavailable = false;

interface LegacyPreferences {
  region?: string;
  interests?: string[];
  notifications?: boolean;
  dealAlertsEnabled?: boolean;
}

function getShownKey(userId: string) {
  return `welcome-shown-${userId}`;
}

function getOnboardedKey(userId: string) {
  return `onboarded-${userId}`;
}

function getLegacyPreferencesKey(userId: string) {
  return `preferences-${userId}`;
}

function parseLegacyPreferences(rawValue: string | null): LegacyPreferences | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as LegacyPreferences;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.error('Failed to parse saved welcome preferences:', error);
    return null;
  }
}

function isMissingCustomerPreferencesTable(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'PGRST205'
  );
}

interface WelcomeModalProps {
  suppressed?: boolean;
}

export function WelcomeModal({ suppressed = false }: WelcomeModalProps) {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const isWelcomeModalEnabled = isEnabled('welcome_modal');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [region, setRegion] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [orderUpdatesEnabled, setOrderUpdatesEnabled] = useState(true);
  const [dealAlertsEnabled, setDealAlertsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (suppressed) {
      setOpen(false);
      return;
    }

    if (!user || !isWelcomeModalEnabled) {
      setOpen(false);
      return;
    }

    let isActive = true;
    let openTimer: ReturnType<typeof setTimeout> | null = null;

    const loadPreferences = async () => {
      const shownKey = getShownKey(user.id);
      const onboardedKey = getOnboardedKey(user.id);
      const legacyPreferences = parseLegacyPreferences(localStorage.getItem(getLegacyPreferencesKey(user.id)));

      let onboardingCompletedAt: string | null = null;

      try {
        const { data, error } = customerPreferencesTableUnavailable
          ? { data: null, error: null }
          : await supabase
              .from('customer_preferences')
              .select('region, interests, order_updates_enabled, deal_alerts_enabled, onboarding_completed_at')
              .eq('user_id', user.id)
              .maybeSingle();

        if (error) throw error;
        if (!isActive) return;

        if (data) {
          setRegion(data.region ?? '');
          setSelectedInterests(data.interests ?? []);
          setOrderUpdatesEnabled(data.order_updates_enabled ?? true);
          setDealAlertsEnabled(data.deal_alerts_enabled ?? true);
          onboardingCompletedAt = data.onboarding_completed_at;
        } else if (legacyPreferences) {
          setRegion(legacyPreferences.region ?? '');
          setSelectedInterests(legacyPreferences.interests ?? []);
          setOrderUpdatesEnabled(legacyPreferences.notifications ?? true);
          setDealAlertsEnabled(legacyPreferences.dealAlertsEnabled ?? legacyPreferences.notifications ?? true);
        }
      } catch (error) {
        if (isMissingCustomerPreferencesTable(error)) {
          customerPreferencesTableUnavailable = true;
        } else {
          console.error('Failed to load customer preferences:', error);
        }

        if (isActive && legacyPreferences) {
          setRegion(legacyPreferences.region ?? '');
          setSelectedInterests(legacyPreferences.interests ?? []);
          setOrderUpdatesEnabled(legacyPreferences.notifications ?? true);
          setDealAlertsEnabled(legacyPreferences.dealAlertsEnabled ?? legacyPreferences.notifications ?? true);
        }
      }

      if (!isActive) return;

      const hasShown = localStorage.getItem(shownKey) === 'true';
      const hasCompletedLocalOnboarding = localStorage.getItem(onboardedKey) === 'true';
      const hasCompletedServerOnboarding = Boolean(onboardingCompletedAt);

      if (!hasShown && !hasCompletedLocalOnboarding && !hasCompletedServerOnboarding) {
        openTimer = setTimeout(() => {
          localStorage.setItem(shownKey, 'true');
          setStep(1);
          setOpen(true);
        }, 1500);
      }
    };

    void loadPreferences();

    return () => {
      isActive = false;
      if (openTimer) {
        clearTimeout(openTimer);
      }
    };
  }, [isWelcomeModalEnabled, suppressed, user]);

  const persistLocalPreferences = () => {
    if (!user) return;

    localStorage.setItem(getShownKey(user.id), 'true');
    localStorage.setItem(getOnboardedKey(user.id), 'true');
    localStorage.setItem(
      getLegacyPreferencesKey(user.id),
      JSON.stringify({
        region,
        interests: selectedInterests,
        notifications: orderUpdatesEnabled,
        dealAlertsEnabled,
      }),
    );
  };

  const handleFinish = async () => {
    if (!user) {
      setOpen(false);
      return;
    }

    setIsSaving(true);

    const payload: TablesInsert<'customer_preferences'> = {
      user_id: user.id,
      region: region || null,
      interests: selectedInterests,
      order_updates_enabled: orderUpdatesEnabled,
      deal_alerts_enabled: dealAlertsEnabled,
      onboarding_completed_at: new Date().toISOString(),
    };

    try {
      const { error } = customerPreferencesTableUnavailable
        ? { error: null }
        : await supabase
            .from('customer_preferences')
            .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success(
        customerPreferencesTableUnavailable
          ? 'Your preferences have been saved on this device.'
          : 'Your preferences have been saved.',
      );
    } catch (error) {
      if (isMissingCustomerPreferencesTable(error)) {
        customerPreferencesTableUnavailable = true;
        toast.success('Your preferences have been saved on this device.');
      } else {
        console.error('Failed to save onboarding preferences:', error);
        toast.error('Preferences were saved on this device, but could not be synced yet.');
      }
    } finally {
      persistLocalPreferences();
      setOpen(false);
      setIsSaving(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest],
    );
  };

  if (suppressed || !user || !isWelcomeModalEnabled) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && user) {
          localStorage.setItem(getShownKey(user.id), 'true');
        }
        setOpen(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">
            {step === 1 && 'Welcome to AJYN!'}
            {step === 2 && 'What interests you?'}
            {step === 3 && 'Stay updated'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Let us personalize your experience. Where are you located?'}
            {step === 2 && "Select categories you love and we'll show you the best deals."}
            {step === 3 && 'Choose how you want to hear from us about orders and deals.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-6 flex justify-center gap-2">
            {[1, 2, 3].map((currentStep) => (
              <div
                key={currentStep}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  currentStep === step ? 'bg-primary' : currentStep < step ? 'bg-primary/50' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <Label>Your Region in Ghana</Label>
              </div>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your region" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {REGIONS.map((regionName) => (
                    <SelectItem key={regionName} value={regionName}>{regionName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="mb-4 flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <Label>Pick your interests</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    aria-pressed={selectedInterests.includes(interest)}
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                      selectedInterests.includes(interest)
                        ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80'
                        : 'border-border text-foreground hover:bg-muted',
                    )}
                    onClick={() => toggleInterest(interest)}
                  >
                    {selectedInterests.includes(interest) && <Check className="mr-1 h-3 w-3" />}
                    <CategoryIconDisplay
                      categoryName={interest}
                      className="mr-1 h-3.5 w-3.5"
                    />
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <Label>Notification Preferences</Label>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Order Updates</p>
                    <p className="text-sm text-muted-foreground">Get notified when your order status changes</p>
                  </div>
                  <Switch checked={orderUpdatesEnabled} onCheckedChange={setOrderUpdatesEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Deal Alerts</p>
                    <p className="text-sm text-muted-foreground">Flash deals, offers, and limited-time drops</p>
                  </div>
                  <Switch checked={dealAlertsEnabled} onCheckedChange={setDealAlertsEnabled} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((currentStep) => currentStep - 1)} disabled={isSaving}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleFinish} disabled={isSaving}>
              Skip
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((currentStep) => currentStep + 1)} disabled={isSaving}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={isSaving}>
              <Check className="mr-1 h-4 w-4" /> Get Started
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
