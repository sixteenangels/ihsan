import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MapPin, Heart, Bell, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const INTERESTS = [
  'Electronics', 'Fashion', 'Beauty', 'Home & Kitchen', 'Sports',
  'Toys & Games', 'Auto Parts', 'Food & Beverages', 'Health',
];

const REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
  'Volta', 'Northern', 'Upper East', 'Upper West', 'Bono',
  'Bono East', 'Ahafo', 'Savannah', 'North East', 'Oti', 'Western North',
];

export function WelcomeModal() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [region, setRegion] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      const hasOnboarded = localStorage.getItem(`onboarded-${user.id}`);
      if (!hasOnboarded) {
        const timer = setTimeout(() => setOpen(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const handleFinish = async () => {
    if (user) {
      localStorage.setItem(`onboarded-${user.id}`, 'true');
      // Save region to profile if set
      if (region) {
        await supabase.from('profiles').update({ phone: undefined }).eq('user_id', user.id);
        // Store preferences in store_settings or localStorage
        localStorage.setItem(`preferences-${user.id}`, JSON.stringify({ region, interests: selectedInterests, notifications: notificationsEnabled }));
      }
    }
    setOpen(false);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  if (!user || !isEnabled('welcome_modal')) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">
            {step === 1 && 'Welcome to Ihsan!'}
            {step === 2 && 'What interests you?'}
            {step === 3 && 'Stay updated'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Let us personalize your experience. Where are you located?'}
            {step === 2 && 'Select categories you love — we\'ll show you the best deals.'}
            {step === 3 && 'Get notified about deals, order updates, and more.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  s === step ? 'bg-primary' : s < step ? 'bg-primary/50' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-primary" />
                <Label>Your Region in Ghana</Label>
              </div>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-primary" />
                <Label>Pick your interests</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map(interest => (
                  <Badge
                    key={interest}
                    variant={selectedInterests.includes(interest) ? 'default' : 'outline'}
                    className="cursor-pointer text-sm py-2 px-3"
                    onClick={() => toggleInterest(interest)}
                  >
                    {selectedInterests.includes(interest) && <Check className="h-3 w-3 mr-1" />}
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-primary" />
                <Label>Notification Preferences</Label>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Order Updates</p>
                    <p className="text-sm text-muted-foreground">Get notified when your order status changes</p>
                  </div>
                  <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Deal Alerts</p>
                    <p className="text-sm text-muted-foreground">Flash deals and special offers</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>
          ) : (
            <Button variant="ghost" onClick={handleFinish}>Skip</Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish}>
              <Check className="h-4 w-4 mr-1" /> Get Started
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
