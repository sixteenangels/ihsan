import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, Key, Mail, Map, Shield, Database, Loader2, Award, Gift, ToggleLeft } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsState {
  emailNotifications: boolean;
  orderEmailsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  mapProvider: string;
  otpEnabled: boolean;
  otpLength: number;
  otpExpiryMinutes: number;
  maintenanceMode: boolean;
  maintenanceStartTime: string;
  maintenanceEndTime: string;
  debugMode: boolean;
  loyaltyEnabled: boolean;
  loyaltyPointsPerOrder: number;
  loyaltyMinOrderAmount: number;
  referralEnabled: boolean;
  // Feature flags
  feature_group_buys: boolean;
  feature_flash_deals: boolean;
  feature_reviews: boolean;
  feature_qa: boolean;
  feature_wishlist: boolean;
  feature_compare: boolean;
  feature_bundles: boolean;
  feature_price_drop_alerts: boolean;
  feature_recently_viewed: boolean;
  feature_live_chat: boolean;
  feature_abandoned_cart: boolean;
  feature_welcome_modal: boolean;
  feature_cookie_consent: boolean;
  feature_push_notifications: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  emailNotifications: true,
  orderEmailsEnabled: true,
  marketingEmailsEnabled: false,
  mapProvider: 'openstreetmap',
  otpEnabled: true,
  otpLength: 6,
  otpExpiryMinutes: 10,
  maintenanceMode: false,
  maintenanceStartTime: '',
  maintenanceEndTime: '',
  debugMode: false,
  loyaltyEnabled: true,
  loyaltyPointsPerOrder: 1,
  loyaltyMinOrderAmount: 0,
  referralEnabled: true,
  feature_group_buys: true,
  feature_flash_deals: true,
  feature_reviews: true,
  feature_qa: true,
  feature_wishlist: true,
  feature_compare: true,
  feature_bundles: true,
  feature_price_drop_alerts: true,
  feature_recently_viewed: true,
  feature_live_chat: true,
  feature_abandoned_cart: true,
  feature_welcome_modal: true,
  feature_cookie_consent: true,
  feature_push_notifications: true,
};

const FEATURE_TOGGLES = [
  { key: 'feature_group_buys' as const, label: 'Group Buys', description: 'Allow customers to create and join group buys' },
  { key: 'feature_flash_deals' as const, label: 'Flash Deals', description: 'Show flash deal products and countdown timers' },
  { key: 'feature_reviews' as const, label: 'Product Reviews', description: 'Let customers leave product reviews' },
  { key: 'feature_qa' as const, label: 'Product Q&A', description: 'Allow questions and answers on product pages' },
  { key: 'feature_wishlist' as const, label: 'Wishlist', description: 'Let customers save products to a wishlist' },
  { key: 'feature_compare' as const, label: 'Product Comparison', description: 'Allow side-by-side product comparison' },
  { key: 'feature_bundles' as const, label: 'Frequently Bought Together', description: 'Show bundle suggestions on product pages' },
  { key: 'feature_price_drop_alerts' as const, label: 'Price Drop Alerts', description: 'Let customers subscribe to price drop notifications' },
  { key: 'feature_recently_viewed' as const, label: 'Recently Viewed Products', description: 'Show recently viewed products section' },
  { key: 'feature_live_chat' as const, label: 'Live Chat Widget', description: 'Show the floating live chat support button' },
  { key: 'feature_abandoned_cart' as const, label: 'Abandoned Cart Reminder', description: 'Show reminder popup for items left in cart' },
  { key: 'feature_welcome_modal' as const, label: 'Welcome Onboarding Modal', description: 'Show onboarding wizard for new users' },
  { key: 'feature_cookie_consent' as const, label: 'Cookie Consent Banner', description: 'Show cookie consent popup to visitors' },
  { key: 'feature_push_notifications' as const, label: 'Push Notifications', description: 'Enable browser push notification prompts' },
];

export function AdminSettings() {
  const queryClient = useQueryClient();

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('key, value');
      if (error) throw error;
      const map: Record<string, any> = {};
      data?.forEach((row) => { map[row.key] = row.value; });
      return map;
    },
  });

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (dbSettings) {
      setSettings(prev => {
        const next = { ...DEFAULT_SETTINGS };
        for (const key of Object.keys(next) as (keyof SettingsState)[]) {
          if (dbSettings[key] !== undefined && dbSettings[key] !== null) {
            (next as any)[key] = dbSettings[key];
          }
        }
        return next;
      });
    }
  }, [dbSettings]);

  const saveMutation = useMutation({
    mutationFn: async (settingsToSave: SettingsState) => {
      const entries = Object.entries(settingsToSave);
      for (const [key, value] of entries) {
        const { data: existing } = await supabase
          .from('store_settings')
          .select('id')
          .eq('key', key)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('store_settings')
            .update({ value: JSON.parse(JSON.stringify(value)), updated_at: new Date().toISOString() })
            .eq('key', key);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('store_settings')
            .insert({ key, value: JSON.parse(JSON.stringify(value)) });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif">System Settings</h1>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <ToggleLeft className="h-4 w-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="maps" className="gap-2">
            <Map className="h-4 w-4" />
            Maps
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="loyalty" className="gap-2">
            <Award className="h-4 w-4" />
            Loyalty
          </TabsTrigger>
          <TabsTrigger value="referral" className="gap-2">
            <Gift className="h-4 w-4" />
            Referral
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure general platform settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">Temporarily disable the store for maintenance</p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, maintenanceMode: checked }))}
                />
              </div>

              <div className="p-4 border border-border rounded-lg space-y-4">
                <div>
                  <Label className="text-sm font-medium">Scheduled Maintenance</Label>
                  <p className="text-xs text-muted-foreground">Set a start and end time to automatically enable/disable maintenance mode</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="maint-start" className="text-xs">Start Time</Label>
                    <Input
                      id="maint-start"
                      type="datetime-local"
                      value={settings.maintenanceStartTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, maintenanceStartTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maint-end" className="text-xs">End Time</Label>
                    <Input
                      id="maint-end"
                      type="datetime-local"
                      value={settings.maintenanceEndTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, maintenanceEndTime: e.target.value }))}
                    />
                  </div>
                </div>
                {settings.maintenanceStartTime && settings.maintenanceEndTime && (
                  <p className="text-xs text-muted-foreground">
                    Maintenance will auto-activate from{' '}
                    <strong>{new Date(settings.maintenanceStartTime).toLocaleString()}</strong> to{' '}
                    <strong>{new Date(settings.maintenanceEndTime).toLocaleString()}</strong>.
                    {new Date(settings.maintenanceEndTime) < new Date() && (
                      <span className="text-destructive ml-1">This schedule has already passed.</span>
                    )}
                  </p>
                )}
                {settings.maintenanceStartTime && !settings.maintenanceEndTime && (
                  <p className="text-xs text-destructive">Please set an end time for the schedule.</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Debug Mode</Label>
                  <p className="text-sm text-muted-foreground">Enable detailed logging for troubleshooting</p>
                </div>
                <Switch
                  checked={settings.debugMode}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, debugMode: checked }))}
                />
              </div>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Database Status</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border border-border rounded-lg">
                    <p className="text-sm text-muted-foreground">Connection</p>
                    <Badge variant="default" className="mt-1 bg-green-600">Connected</Badge>
                  </div>
                  <div className="p-3 border border-border rounded-lg">
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-medium">Lovable Cloud</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Toggles */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ToggleLeft className="h-5 w-5 text-primary" />
                Optional Features
              </CardTitle>
              <CardDescription>
                Enable or disable platform features. Disabled features will be hidden from customers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {FEATURE_TOGGLES.map((toggle) => (
                <div key={toggle.key} className="flex items-center justify-between py-2">
                  <div>
                    <Label>{toggle.label}</Label>
                    <p className="text-sm text-muted-foreground">{toggle.description}</p>
                  </div>
                  <Switch
                    checked={settings[toggle.key]}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, [toggle.key]: checked }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>Configure email notifications and delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Enable email notifications for the platform</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, emailNotifications: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Order Emails</Label>
                  <p className="text-sm text-muted-foreground">Send order confirmation and update emails</p>
                </div>
                <Switch
                  checked={settings.orderEmailsEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, orderEmailsEnabled: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">Send promotional and marketing emails</p>
                </div>
                <Switch
                  checked={settings.marketingEmailsEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, marketingEmailsEnabled: checked }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maps Settings */}
        <TabsContent value="maps">
          <Card>
            <CardHeader>
              <CardTitle>Map Configuration</CardTitle>
              <CardDescription>Configure map provider for order tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Map Provider</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, mapProvider: 'openstreetmap' }))}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      settings.mapProvider === 'openstreetmap'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">OpenStreetMap</p>
                    <p className="text-sm text-muted-foreground">Free, open-source maps</p>
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, mapProvider: 'mapbox' }))}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      settings.mapProvider === 'mapbox'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">Mapbox</p>
                    <p className="text-sm text-muted-foreground">Premium maps (requires API key)</p>
                  </button>
                </div>
              </div>
              {settings.mapProvider === 'mapbox' && (
                <div className="space-y-2">
                  <Label htmlFor="mapbox-key">Mapbox API Key</Label>
                  <Input id="mapbox-key" type="password" placeholder="pk.xxxxxxxx" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure OTP and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>OTP Verification</Label>
                  <p className="text-sm text-muted-foreground">Require OTP for sensitive actions</p>
                </div>
                <Switch
                  checked={settings.otpEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, otpEnabled: checked }))}
                />
              </div>
              {settings.otpEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="otp-length">OTP Length</Label>
                    <Input
                      id="otp-length"
                      type="number"
                      min={4}
                      max={8}
                      value={settings.otpLength}
                      onChange={(e) => setSettings(prev => ({ ...prev, otpLength: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp-expiry">OTP Expiry (minutes)</Label>
                    <Input
                      id="otp-expiry"
                      type="number"
                      min={1}
                      max={60}
                      value={settings.otpExpiryMinutes}
                      onChange={(e) => setSettings(prev => ({ ...prev, otpExpiryMinutes: parseInt(e.target.value) }))}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage external service API keys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Security Notice</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  API keys are securely stored and encrypted. They are never exposed in the frontend code.
                  To update API keys, please use the Lovable Cloud secrets management.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">Google OAuth</p>
                    <p className="text-sm text-muted-foreground">For Google Sign-In</p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Configured</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">Email Service</p>
                    <p className="text-sm text-muted-foreground">For transactional emails</p>
                  </div>
                  <Badge variant="secondary">Using Default</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">Map Service</p>
                    <p className="text-sm text-muted-foreground">For order tracking maps</p>
                  </div>
                  <Badge variant="secondary">OpenStreetMap</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loyalty Settings */}
        <TabsContent value="loyalty">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Loyalty Programme
              </CardTitle>
              <CardDescription>Configure how customers earn loyalty points on orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Loyalty Programme</Label>
                  <p className="text-sm text-muted-foreground">Customers earn points on qualifying orders</p>
                </div>
                <Switch
                  checked={settings.loyaltyEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, loyaltyEnabled: checked }))}
                />
              </div>
              {settings.loyaltyEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Points Earned Per Order (per ₵1 spent)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={settings.loyaltyPointsPerOrder}
                      onChange={(e) => setSettings(prev => ({ ...prev, loyaltyPointsPerOrder: parseInt(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">E.g. 1 means 1 point per ₵1 spent</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Order Amount to Qualify (₵)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={settings.loyaltyMinOrderAmount}
                      onChange={(e) => setSettings(prev => ({ ...prev, loyaltyMinOrderAmount: parseFloat(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">Set 0 for no minimum</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referral Settings */}
        <TabsContent value="referral">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Referral Programme
              </CardTitle>
              <CardDescription>Enable or disable the referral programme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Referral Programme</Label>
                  <p className="text-sm text-muted-foreground">Allow customers to share referral codes and earn rewards</p>
                </div>
                <Switch
                  checked={settings.referralEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, referralEnabled: checked }))}
                />
              </div>
              {settings.referralEnabled && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-medium text-foreground">How it works</h4>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Customer shares their unique referral link</li>
                    <li>New user signs up using the link</li>
                    <li>Referrer receives a discount coupon automatically</li>
                    <li>Referred user can start shopping right away</li>
                  </ol>
                  <p className="text-sm text-muted-foreground mt-2">
                    Reward details (discount %, max uses, expiry) are configured in <strong>Promotions → Referral Reward Settings</strong>.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
