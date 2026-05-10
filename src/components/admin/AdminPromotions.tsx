import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Tag, Zap, Percent, DollarSign, Gift, Save } from 'lucide-react';
import { format } from 'date-fns';
import { couponSchema, validateForm } from '@/lib/validations/admin';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/audit-log';
import type { Enums, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type CouponType = Enums<'coupon_type'>;
type CouponRow = Tables<'coupons'>;
type CouponInsert = TablesInsert<'coupons'>;
type FlashDealProductRow = Pick<
  Tables<'products'>,
  'id' | 'name' | 'base_price' | 'is_flash_deal' | 'is_active' | 'flash_deal_ends_at'
>;
type StoreSettingValue = Tables<'store_settings'>['value'];
type StoreSettingsMap = Record<string, StoreSettingValue>;
type CouponFormState = {
  code: string;
  type: CouponType;
  value: string;
  min_order_amount: string;
  max_uses: string;
  starts_at: string;
  expires_at: string;
  marketing_label: string;
  auto_apply: boolean;
  first_order_only: boolean;
};

function parseNumericSetting(value: StoreSettingValue | undefined) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function AdminPromotions() {
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState<CouponFormState>({
    code: '',
    type: 'percentage',
    value: '',
    min_order_amount: '',
    max_uses: '',
    starts_at: '',
    expires_at: '',
    marketing_label: '',
    auto_apply: false,
    first_order_only: false,
  });

  // Flash deal end times tracked locally
  const [flashEndTimes, setFlashEndTimes] = useState<Record<string, string>>({});

  // Referral settings
  const [refDiscount, setRefDiscount] = useState('10');
  const [refMaxUses, setRefMaxUses] = useState('1');
  const [refExpiryDays, setRefExpiryDays] = useState('14');

  const { data: coupons, isLoading: couponsLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async (): Promise<CouponRow[]> => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: flashDealProducts, isLoading: flashDealsLoading } = useQuery({
    queryKey: ['admin-flash-deals-products'],
    queryFn: async (): Promise<FlashDealProductRow[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, base_price, is_flash_deal, is_active, flash_deal_ends_at')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Load referral settings from store_settings
  const { data: storeSettings } = useQuery({
    queryKey: ['admin-store-settings-promotions'],
    queryFn: async (): Promise<StoreSettingsMap> => {
      const { data } = await supabase.from('store_settings').select('key, value');
      const map: StoreSettingsMap = {};
      data?.forEach((record) => {
        map[record.key] = record.value;
      });
      return map;
    },
  });

  useEffect(() => {
    if (storeSettings) {
      const discount = parseNumericSetting(storeSettings.referral_discount_percent);
      const maxUses = parseNumericSetting(storeSettings.referral_max_uses);
      const expiryDays = parseNumericSetting(storeSettings.referral_expiry_days);

      if (discount != null) setRefDiscount(String(discount));
      if (maxUses != null) setRefMaxUses(String(maxUses));
      if (expiryDays != null) setRefExpiryDays(String(expiryDays));
    }
  }, [storeSettings]);

  // Initialize flash end times
  useEffect(() => {
    if (flashDealProducts) {
      const times: Record<string, string> = {};
      flashDealProducts.forEach(p => {
        if (p.flash_deal_ends_at) {
          times[p.id] = new Date(p.flash_deal_ends_at).toISOString().slice(0, 16);
        }
      });
      setFlashEndTimes(times);
    }
  }, [flashDealProducts]);

  const handleAddCoupon = () => {
    const validation = validateForm(couponSchema, newCoupon);
    if (!validation.success) {
      const firstError = Object.values(validation.errors || {})[0];
      toast.error(firstError || 'Please fix the form errors');
      return;
    }
    addCouponMutation.mutate(newCoupon);
  };

  const addCouponMutation = useMutation({
    mutationFn: async (couponData: CouponFormState) => {
      const payload: CouponInsert = {
        code: couponData.code.toUpperCase(),
        type: couponData.type,
        value: parseFloat(couponData.value),
        min_order_amount: couponData.min_order_amount ? parseFloat(couponData.min_order_amount) : null,
        max_uses: couponData.max_uses ? parseInt(couponData.max_uses) : null,
        starts_at: couponData.starts_at ? new Date(couponData.starts_at).toISOString() : null,
        expires_at: couponData.expires_at ? new Date(couponData.expires_at).toISOString() : null,
        marketing_label: couponData.marketing_label || null,
        auto_apply: !!couponData.auto_apply,
        first_order_only: !!couponData.first_order_only,
      };
      const { data: createdCoupon, error } = await supabase
        .from('coupons')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'coupon.created',
        entityType: 'coupon',
        entityId: createdCoupon.id,
        summary: `Created coupon ${payload.code}.`,
        metadata: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success('Coupon created');
      setIsAddingCoupon(false);
      setNewCoupon({
        code: '',
        type: 'percentage',
        value: '',
        min_order_amount: '',
        max_uses: '',
        starts_at: '',
        expires_at: '',
        marketing_label: '',
        auto_apply: false,
        first_order_only: false,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleCouponActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('coupons').update({ is_active }).eq('id', id);
      if (error) throw error;

      const coupon = coupons?.find((entry) => entry.id === id);
      await logAdminAction({
        actorUserId: user?.id,
        action: is_active ? 'coupon.activated' : 'coupon.deactivated',
        entityType: 'coupon',
        entityId: id,
        summary: `${is_active ? 'Activated' : 'Deactivated'} coupon ${coupon?.code || id}.`,
        metadata: { is_active },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success('Coupon updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => {
      const coupon = coupons?.find((entry) => entry.id === id);
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'coupon.deleted',
        entityType: 'coupon',
        entityId: id,
        summary: `Deleted coupon ${coupon?.code || id}.`,
        metadata: coupon ? { code: coupon.code } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success('Coupon deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleFlashDeal = useMutation({
    mutationFn: async ({ id, is_flash_deal }: { id: string; is_flash_deal: boolean }) => {
      const update: TablesUpdate<'products'> = { is_flash_deal };
      if (!is_flash_deal) update.flash_deal_ends_at = null;
      const { error } = await supabase.from('products').update(update).eq('id', id);
      if (error) throw error;

      const product = flashDealProducts?.find((entry) => entry.id === id);
      await logAdminAction({
        actorUserId: user?.id,
        action: is_flash_deal ? 'flash_deal.enabled' : 'flash_deal.disabled',
        entityType: 'product',
        entityId: id,
        summary: `${is_flash_deal ? 'Enabled' : 'Disabled'} flash deal for ${product?.name || id}.`,
        metadata: update,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flash-deals-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-flash-deals'] });
      toast.success('Flash deal updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveFlashEndTime = useMutation({
    mutationFn: async ({ id, flash_deal_ends_at }: { id: string; flash_deal_ends_at: string }) => {
      const { error } = await supabase.from('products').update({ flash_deal_ends_at }).eq('id', id);
      if (error) throw error;

      const product = flashDealProducts?.find((entry) => entry.id === id);
      await logAdminAction({
        actorUserId: user?.id,
        action: 'flash_deal.schedule_updated',
        entityType: 'product',
        entityId: id,
        summary: `Updated flash deal end time for ${product?.name || id}.`,
        metadata: { flash_deal_ends_at },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flash-deals-products'] });
      toast.success('Flash deal end time saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveReferralSettings = useMutation({
    mutationFn: async () => {
      const entries = [
        { key: 'referral_discount_percent', value: parseFloat(refDiscount) },
        { key: 'referral_max_uses', value: parseInt(refMaxUses) },
        { key: 'referral_expiry_days', value: parseInt(refExpiryDays) },
      ];
      for (const { key, value } of entries) {
        const { data: existing } = await supabase.from('store_settings').select('id').eq('key', key).maybeSingle();
        if (existing) {
          await supabase.from('store_settings').update({ value: JSON.parse(JSON.stringify(value)), updated_at: new Date().toISOString() }).eq('key', key);
        } else {
          await supabase.from('store_settings').insert({ key, value: JSON.parse(JSON.stringify(value)) });
        }
      }

      await logAdminAction({
        actorUserId: user?.id,
        action: 'referral_settings.updated',
        entityType: 'store_settings',
        summary: 'Updated referral reward settings.',
        metadata: {
          referral_discount_percent: parseFloat(refDiscount),
          referral_max_uses: parseInt(refMaxUses),
          referral_expiry_days: parseInt(refExpiryDays),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-settings-promotions'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast.success('Referral settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (couponsLoading || flashDealsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-serif text-foreground mb-8">Promotions</h1>

      {/* Coupons */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Coupons
          </CardTitle>
          <Dialog open={isAddingCoupon} onOpenChange={setIsAddingCoupon}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Coupon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Coupon</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <Input
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., SAVE20"
                    className="uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newCoupon.type}
                      onValueChange={(value: CouponType) => setNewCoupon(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount (GHS)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      type="number"
                      value={newCoupon.value}
                      onChange={(e) => setNewCoupon(prev => ({ ...prev, value: e.target.value }))}
                      placeholder={newCoupon.type === 'percentage' ? '20' : '10'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Order Amount (optional)</Label>
                  <Input
                    type="number"
                    value={newCoupon.min_order_amount}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, min_order_amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Uses (optional)</Label>
                  <Input
                    type="number"
                    value={newCoupon.max_uses}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, max_uses: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Starts At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={newCoupon.starts_at}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, starts_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={newCoupon.expires_at}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, expires_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marketing Label (optional)</Label>
                  <Input
                    value={newCoupon.marketing_label}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, marketing_label: e.target.value }))}
                    placeholder="e.g., Welcome Offer"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    checked={newCoupon.auto_apply}
                    onCheckedChange={(checked) => setNewCoupon(prev => ({ ...prev, auto_apply: !!checked }))}
                  />
                  <div>
                    <p className="font-medium text-foreground">Auto-apply if best</p>
                    <p className="text-sm text-muted-foreground">Checkout can automatically pick this when it is the strongest valid offer.</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    checked={newCoupon.first_order_only}
                    onCheckedChange={(checked) => setNewCoupon(prev => ({ ...prev, first_order_only: !!checked }))}
                  />
                  <div>
                    <p className="font-medium text-foreground">First order only</p>
                    <p className="text-sm text-muted-foreground">Restrict this coupon to customers placing their first order.</p>
                  </div>
                </label>
                <Button onClick={handleAddCoupon} disabled={!newCoupon.code || !newCoupon.value}>
                  Create Coupon
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {coupons?.map((coupon) => (
              <div key={coupon.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {coupon.type === 'percentage' ? <Percent className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{coupon.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {coupon.type === 'percentage' ? `${coupon.value}% off` : `${formatPrice(Number(coupon.value))} off`}
                      {coupon.min_order_amount ? ` (min ${formatPrice(Number(coupon.min_order_amount))})` : ''}
                    </p>
                    {coupon.marketing_label && (
                      <p className="text-xs text-primary">{coupon.marketing_label}</p>
                    )}
                    {(coupon.auto_apply || coupon.first_order_only) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {coupon.auto_apply && (
                          <Badge variant="outline">Auto Apply</Badge>
                        )}
                        {coupon.first_order_only && (
                          <Badge variant="outline">First Order</Badge>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Uses: {coupon.current_uses || 0}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
                      {coupon.starts_at && ` | Starts: ${format(new Date(coupon.starts_at), 'PP')}`}
                      {coupon.expires_at && ` | Expires: ${format(new Date(coupon.expires_at), 'PP')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                    {coupon.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Switch
                    checked={coupon.is_active ?? true}
                    onCheckedChange={(checked) => toggleCouponActive.mutate({ id: coupon.id, is_active: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => deleteCouponMutation.mutate(coupon.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {coupons?.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No coupons yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Flash Deals */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-destructive" />
            Flash Deals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Toggle flash deal status and set end times. Flash deal products are highlighted on the storefront.
          </p>
          <div className="space-y-3">
            {flashDealProducts?.map((product) => (
              <div key={product.id} className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{formatPrice(Number(product.base_price))}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {product.is_flash_deal && (
                      <Badge className="bg-destructive text-destructive-foreground">
                        <Zap className="h-3 w-3 mr-1" />
                        Flash Deal
                      </Badge>
                    )}
                    <Switch
                      checked={product.is_flash_deal ?? false}
                      onCheckedChange={(checked) => {
                        toggleFlashDeal.mutate({ id: product.id, is_flash_deal: checked });
                        if (!checked) {
                          setFlashEndTimes(prev => {
                            const next = { ...prev };
                            delete next[product.id];
                            return next;
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                {product.is_flash_deal && (
                  <div className="flex items-end gap-2 pl-1">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Flash Deal Ends At</Label>
                      <Input
                        type="datetime-local"
                        value={flashEndTimes[product.id] || ''}
                        onChange={e => setFlashEndTimes(prev => ({ ...prev, [product.id]: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const val = flashEndTimes[product.id];
                        if (!val) { toast.error('Set an end time first'); return; }
                        saveFlashEndTime.mutate({ id: product.id, flash_deal_ends_at: new Date(val).toISOString() });
                      }}
                      disabled={saveFlashEndTime.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Referral Reward Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Referral Reward Settings
          </CardTitle>
          <CardDescription>
            Configure the coupon reward given to referrers when a new user signs up with their code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Discount Percentage (%)</Label>
              <Input type="number" value={refDiscount} onChange={e => setRefDiscount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Max Uses Per Coupon</Label>
              <Input type="number" value={refMaxUses} onChange={e => setRefMaxUses(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valid For (days)</Label>
              <Input type="number" value={refExpiryDays} onChange={e => setRefExpiryDays(e.target.value)} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Referrers will receive a <strong>{refDiscount}% off</strong> coupon, usable <strong>{refMaxUses}x</strong>, valid for <strong>{refExpiryDays} days</strong> after each successful referral.
          </p>
          <Button onClick={() => saveReferralSettings.mutate()} disabled={saveReferralSettings.isPending}>
            {saveReferralSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Referral Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
