import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, Phone, Mail, Plus, Trash2, Loader2, Edit2, Check, X, Package, Clock, Truck, CheckCircle, XCircle, RefreshCcw, ShoppingBag, Gift, Award, Copy, Cake, Wallet, Bell, Headphones } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useRefundRequests } from '@/hooks/useRefundRequests';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TwoFactorManage } from '@/components/auth/TwoFactorManage';
import { SessionManagement } from '@/components/auth/SessionManagement';
import { RefundRequestDialog } from '@/components/orders/RefundRequestDialog';
import { useReferral } from '@/hooks/useReferral';
import { useLoyaltyPoints } from '@/hooks/useLoyaltyPoints';
import { WalletSection } from '@/components/profile/WalletSection';
import { AlertsSection } from '@/components/profile/AlertsSection';
import { PushNotificationSettings } from '@/components/profile/PushNotificationSettings';
import { SupportCenterSection } from '@/components/profile/SupportCenterSection';

interface Profile {
  name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
}

interface Address {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
}

interface OrderItem {
  id: string;
  product_name: string;
  variant_details: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  estimated_delivery_start: string;
  estimated_delivery_end: string;
  order_items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  payment_received: { label: 'Payment Received', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  order_placed: { label: 'Order Placed', color: 'bg-blue-100 text-blue-800', icon: ShoppingBag },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-800', icon: Loader2 },
  packed_for_delivery: { label: 'Packed', color: 'bg-purple-100 text-purple-800', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  in_transit: { label: 'In Transit', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  in_ghana: { label: 'In Ghana', color: 'bg-orange-100 text-orange-800', icon: Package },
  ready_for_delivery: { label: 'Ready for Delivery', color: 'bg-teal-100 text-teal-800', icon: Package },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-red-100 text-red-800', icon: XCircle },
};

function ReferralTab() {
  const { referralCode, referralLink, referrals, isLoading, generateCode, isGenerating } = useReferral();
  const totalReferrals = Math.max(referralCode?.total_referrals ?? 0, referrals.length);

  const handleCopyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied!');
    }
  };

  const handleShareWhatsApp = () => {
    if (referralLink) {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Join AJYN with my referral link: ${referralLink}`)}`, '_blank');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Refer a Friend
        </CardTitle>
        <CardDescription>Share your referral link and earn rewards when friends join</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!referralCode ? (
          <div className="text-center py-8">
            <Gift className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Generate your unique referral code to start inviting friends</p>
            <Button onClick={() => generateCode()} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Referral Code
            </Button>
          </div>
        ) : (
          <>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
              <p className="text-2xl font-bold text-primary">{referralCode.code}</p>
            </div>
            {referralLink && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Share your link</p>
                <div className="flex gap-2">
                  <Input value={referralLink} readOnly className="text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleShareWhatsApp}>
                  Share on WhatsApp
                </Button>
              </div>
            )}
            <div>
              <p className="font-medium text-foreground mb-2">
                Total Referrals: {totalReferrals}
              </p>
              <div className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading referral activity
                  </div>
                ) : referrals.length > 0 ? (
                  referrals.slice(0, 5).map((referral, index) => (
                    <div key={referral.id} className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-sm font-medium text-foreground">Referral #{index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {format(new Date(referral.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    New signups using your link will appear here after their account is created.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LoyaltyTab() {
  const { pointsHistory, totalPoints, isLoading } = useLoyaltyPoints();
  const { formatPrice } = useCurrency();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Loyalty Points
        </CardTitle>
        <CardDescription>Earn points with every purchase</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-6 bg-primary/5 rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
          <p className="text-4xl font-bold text-primary">{totalPoints}</p>
          <p className="text-sm text-muted-foreground mt-1">points</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : pointsHistory.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No points activity yet. Make a purchase to start earning!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Recent Activity</h4>
            {pointsHistory.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={entry.type === 'earn' ? 'default' : 'secondary'}>
                  {entry.type === 'earn' ? '+' : '-'}{entry.points} pts
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { refundRequests, isLoading: refundsLoading } = useRefundRequests();
  const [profile, setProfile] = useState<Profile>({ name: null, email: null, phone: null, birthday: null });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [activeTab, setActiveTab] = useState('profile');

  const [addressForm, setAddressForm] = useState({
    label: '',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Ghana',
    is_default: false,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('name, email, phone, birthday')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data);
    }
    setLoading(false);
  }, [user]);

  const fetchAddresses = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('Error fetching addresses:', error);
    } else {
      setAddresses(data || []);
    }
  }, [user]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        created_at,
        estimated_delivery_start,
        estimated_delivery_end,
        order_items (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      setOrders(data || []);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchAddresses();
      fetchOrders();
    }
  }, [user, fetchProfile, fetchAddresses, fetchOrders]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: profile.name, phone: profile.phone, birthday: profile.birthday })
      .eq('user_id', user!.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
      setEditingProfile(false);
    }
    setSaving(false);
  };

  const handleSaveAddress = async () => {
    setSaving(true);
    
    if (addressForm.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user!.id);
    }

    if (editingAddress) {
      const { error } = await supabase
        .from('addresses')
        .update(addressForm)
        .eq('id', editingAddress.id);

      if (error) {
        toast.error('Failed to update address');
      } else {
        toast.success('Address updated');
      }
    } else {
      const { error } = await supabase
        .from('addresses')
        .insert({ ...addressForm, user_id: user!.id });

      if (error) {
        toast.error('Failed to add address');
      } else {
        toast.success('Address added');
      }
    }

    setAddressDialogOpen(false);
    setEditingAddress(null);
    resetAddressForm();
    fetchAddresses();
    setSaving(false);
  };

  const handleDeleteAddress = async (id: string) => {
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete address');
    } else {
      toast.success('Address deleted');
      fetchAddresses();
    }
  };

  const openEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label || '',
      full_name: address.full_name,
      phone: address.phone,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state || '',
      postal_code: address.postal_code || '',
      country: address.country,
      is_default: address.is_default,
    });
    setAddressDialogOpen(true);
  };

  const resetAddressForm = () => {
    setAddressForm({
      label: '',
      full_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'Ghana',
      is_default: false,
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-4xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8">
        <h1 className="mb-6 text-2xl font-bold font-serif text-foreground md:mb-8 md:text-3xl">My Account</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-muted/70 p-2 sm:grid-cols-3 md:mb-8 lg:grid-cols-5 xl:grid-cols-9">
            <TabsTrigger value="profile" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <MapPin className="h-4 w-4" />
              <span>Addresses</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <Package className="h-4 w-4" />
              <span>Orders</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <Wallet className="h-4 w-4" />
              <span>Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <Bell className="h-4 w-4" />
              <span>Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <Headphones className="h-4 w-4" />
              <span>Support</span>
            </TabsTrigger>
            <TabsTrigger value="refunds" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <RefreshCcw className="h-4 w-4" />
              <span>Refunds</span>
            </TabsTrigger>
            <TabsTrigger value="referral" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <Gift className="h-4 w-4" />
              <span>Referral</span>
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm">
              <Award className="h-4 w-4" />
              <span>Points</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Manage your personal details</CardDescription>
                </div>
                {!editingProfile ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)} className="self-start sm:self-auto">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2 self-start sm:self-auto">
                    <Button variant="outline" size="sm" onClick={() => setEditingProfile(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Name
                    </Label>
                    {editingProfile ? (
                      <Input
                        value={profile.name || ''}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        placeholder="Your name"
                      />
                    ) : (
                      <p className="text-foreground">{profile.name || 'Not set'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </Label>
                    <p className="text-muted-foreground">{profile.email || user?.email}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Phone
                    </Label>
                    {editingProfile ? (
                      <Input
                        value={profile.phone || ''}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="Your phone number"
                      />
                    ) : (
                      <p className="text-foreground">{profile.phone || 'Not set'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Cake className="h-4 w-4" /> Birthday
                    </Label>
                    {editingProfile ? (
                      <Input
                        type="date"
                        value={profile.birthday || ''}
                        onChange={(e) => setProfile({ ...profile, birthday: e.target.value })}
                        placeholder="Your birthday"
                      />
                    ) : (
                      <p className="text-foreground">
                        {profile.birthday
                          ? new Date(profile.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                          : 'Not set'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <TwoFactorManage />
            <SessionManagement />
            <PushNotificationSettings />
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Saved Addresses
                  </CardTitle>
                  <CardDescription>Manage your delivery addresses</CardDescription>
                </div>
                <Dialog open={addressDialogOpen} onOpenChange={(open) => {
                  setAddressDialogOpen(open);
                  if (!open) {
                    setEditingAddress(null);
                    resetAddressForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="self-start sm:self-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Address
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Label (optional)</Label>
                          <Input
                            value={addressForm.label}
                            onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                            placeholder="Home, Office, etc."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Full Name *</Label>
                          <Input
                            value={addressForm.full_name}
                            onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })}
                            placeholder="Recipient name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone *</Label>
                        <Input
                          value={addressForm.phone}
                          onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address Line 1 *</Label>
                        <Input
                          value={addressForm.address_line1}
                          onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                          placeholder="Street address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address Line 2</Label>
                        <Input
                          value={addressForm.address_line2}
                          onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                          placeholder="Apt, suite, etc."
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>City *</Label>
                          <Input
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            placeholder="City"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Region/State</Label>
                          <Input
                            value={addressForm.state}
                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                            placeholder="Region"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Postal Code</Label>
                          <Input
                            value={addressForm.postal_code}
                            onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                            placeholder="Postal code"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Country *</Label>
                          <Input
                            value={addressForm.country}
                            onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                            placeholder="Country"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addressForm.is_default}
                          onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                          className="rounded border-border"
                        />
                        <span className="text-sm">Set as default address</span>
                      </label>
                      <Button
                        onClick={handleSaveAddress}
                        disabled={saving || !addressForm.full_name || !addressForm.phone || !addressForm.address_line1 || !addressForm.city || !addressForm.country}
                        className="w-full"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {editingAddress ? 'Update Address' : 'Save Address'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {addresses.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No addresses saved yet</p>
                ) : (
                  <div className="space-y-4">
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{address.label || 'Address'}</span>
                            {address.is_default && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground">{address.full_name}</p>
                          <p className="text-sm text-muted-foreground">{address.phone}</p>
                          <p className="text-sm text-muted-foreground">
                            {address.address_line1}
                            {address.address_line2 && `, ${address.address_line2}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.city}, {address.state} {address.postal_code}
                          </p>
                          <p className="text-sm text-muted-foreground">{address.country}</p>
                        </div>
                        <div className="flex gap-2 self-start sm:self-auto">
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEditAddress(address)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive"
                            onClick={() => handleDeleteAddress(address.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order History
                </CardTitle>
                <CardDescription>View and track your orders</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No orders yet</h3>
                    <p className="text-muted-foreground mb-6">Start shopping to see your orders here</p>
                    <Link to="/products">
                      <Button className="w-full sm:w-auto">Browse Products</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="p-4 bg-muted/50 border-b border-border">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Order</p>
                                <p className="font-semibold text-foreground">{order.order_number}</p>
                              </div>
                              <div className="hidden sm:block text-muted-foreground">-</div>
                              <div>
                                <p className="text-sm text-muted-foreground">Placed</p>
                                <p className="font-medium text-foreground">
                                  {new Date(order.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="space-y-2 mb-4">
                            {order.order_items.slice(0, 2).map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-foreground">
                                  {item.product_name} x {item.quantity}
                                </span>
                                <span className="text-muted-foreground">{formatPrice(item.total_price)}</span>
                              </div>
                            ))}
                            {order.order_items.length > 2 && (
                              <p className="text-sm text-muted-foreground">
                                +{order.order_items.length - 2} more items
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Truck className="h-4 w-4" />
                              <span>
                               {order.estimated_delivery_start && order.estimated_delivery_end ? (
                                  <>
                                    Est. delivery:{' '}
                                    {new Date(order.estimated_delivery_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    {' - '}
                                    {new Date(order.estimated_delivery_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </>
                                ) : (
                                  'Delivery date pending'
                                )}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                              <Link to={`/track-order/${order.id}`}>
                                <Button variant="outline" size="sm" className="w-full sm:w-auto">Track Order</Button>
                              </Link>
                              {order.status === 'delivered' && (
                                <RefundRequestDialog
                                  order={{
                                    id: order.id,
                                    order_number: order.order_number,
                                    total_amount: order.total_amount,
                                    status: order.status,
                                  }}
                                />
                              )}
                              <p className="font-semibold text-primary">{formatPrice(order.total_amount)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet">
            <WalletSection />
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <AlertsSection />
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support">
            <SupportCenterSection />
          </TabsContent>

          {/* Refunds Tab */}
          <TabsContent value="refunds">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCcw className="h-5 w-5" />
                  Refunds & Returns
                </CardTitle>
                <CardDescription>View your refund requests and returns</CardDescription>
              </CardHeader>
              <CardContent>
                {refundsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : refundRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <RefreshCcw className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No refund requests</h3>
                    <p className="text-muted-foreground mb-6">
                      You haven't requested any refunds yet. If you need to return an item, go to your order and select "Request Refund".
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {refundRequests.map((request) => (
                      <div key={request.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-foreground">
                              Order {request.order?.order_number || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Requested on {new Date(request.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <Badge
                            className={
                              request.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : request.status === 'approved'
                                ? 'bg-primary/20 text-primary'
                                : request.status === 'rejected'
                                ? 'bg-destructive/20 text-destructive'
                                : 'bg-green-100 text-green-800'
                            }
                          >
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="text-muted-foreground">Reason: </span>
                            <span className="text-foreground">{request.reason}</span>
                          </p>
                          {request.details && (
                            <p>
                              <span className="text-muted-foreground">Details: </span>
                              <span className="text-foreground">{request.details}</span>
                            </p>
                          )}
                          <p>
                            <span className="text-muted-foreground">Amount: </span>
                            <span className="font-semibold text-primary">
                              {formatPrice(request.refund_amount || request.order?.total_amount || 0)}
                            </span>
                          </p>
                          {request.admin_notes && (
                            <div className="mt-2 p-3 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-1">Admin response:</p>
                              <p className="text-foreground">{request.admin_notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referral Tab */}
          <TabsContent value="referral">
            <ReferralTab />
          </TabsContent>

          {/* Loyalty Tab */}
          <TabsContent value="loyalty">
            <LoyaltyTab />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
