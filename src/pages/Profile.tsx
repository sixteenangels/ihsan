import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User, MapPin, Phone, Mail, Plus, Trash2, Loader2, Edit2, Check, X, Package, RefreshCcw, ShoppingBag, Gift, Award, Copy, Cake, Wallet, Bell, Headphones, Users, Camera } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useRefundRequests } from '@/hooks/useRefundRequests';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { CompactOrderHistoryCard } from '@/components/orders/CompactOrderHistoryCard';
import { OrderReviewDialog } from '@/components/orders/OrderReviewDialog';
import { RefundRequestDialog } from '@/components/orders/RefundRequestDialog';
import { AfterSalesServiceDialog } from '@/components/support/AfterSalesServiceDialog';
import { useReferral } from '@/hooks/useReferral';
import { useLoyaltyPoints } from '@/hooks/useLoyaltyPoints';
import { WalletSection } from '@/components/profile/WalletSection';
import { AlertsSection } from '@/components/profile/AlertsSection';
import { PushNotificationSettings } from '@/components/profile/PushNotificationSettings';
import { SupportCenterSection } from '@/components/profile/SupportCenterSection';
import { canRequestRefund, getRefundButtonReason } from '@/lib/orderHistory';
import { reAddOrderItemsToCart } from '@/lib/reorderOrder';

interface Profile {
  name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  avatar_url: string | null;
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

function getSafeInternalReturnPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  return value;
}

interface OrderItem {
  id: string;
  product_name: string;
  variant_details: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_id: string | null;
  product_variant_id: string | null;
  image_url?: string | null;
}

interface ProductVariantLookupRow {
  id: string;
  product_id: string;
}

interface ProductImageLookupRow {
  product_id: string;
  image_url: string;
  order_index: number | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  estimated_delivery_start: string | null;
  estimated_delivery_end: string | null;
  courier_tracking_number: string | null;
  payment_reference: string | null;
  customer_confirmed_at: string | null;
  group_buy_id: string | null;
  is_group_buy_master?: boolean | null;
  parent_order_id?: string | null;
  order_items: OrderItem[];
}

const PROFILE_AVATAR_BUCKET = 'profile-avatars';
const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function getAvatarInitials(name: string | null, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || 'AJYN member';
  const [first, second] = source.split(/\s+|@/);

  return `${first?.[0] || ''}${second?.[0] || ''}`.toUpperCase() || 'AJ';
}

function getAvatarPathFromPublicUrl(avatarUrl: string | null) {
  if (!avatarUrl) {
    return null;
  }

  try {
    const url = new URL(avatarUrl);
    const marker = `/storage/v1/object/public/${PROFILE_AVATAR_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

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
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="px-5 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Refer a Friend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-5 sm:px-6">
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
            <div className="rounded-2xl bg-muted p-4">
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
                    <div key={referral.id} className="rounded-2xl border border-border/70 bg-muted/40 p-3">
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
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="px-5 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Loyalty Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-5 sm:px-6">
        <div className="rounded-2xl bg-primary/5 p-5 text-center sm:p-6">
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
              <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
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
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { refundRequests, isLoading: refundsLoading } = useRefundRequests();
  const [profile, setProfile] = useState<Profile>({
    name: null,
    email: null,
    phone: null,
    birthday: null,
    avatar_url: null,
  });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [reviewDialogOrder, setReviewDialogOrder] = useState<Order | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const addressSetupAutoOpenedRef = useRef(false);
  const addressReturnTo = getSafeInternalReturnPath(searchParams.get('returnTo'));

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

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('name, email, phone, birthday, avatar_url')
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
        updated_at,
        estimated_delivery_start,
        estimated_delivery_end,
        courier_tracking_number,
        payment_reference,
        customer_confirmed_at,
        group_buy_id,
        is_group_buy_master,
        parent_order_id,
        order_items (*)
      `)
      .eq('user_id', user.id)
      .or('is_group_buy_master.is.null,is_group_buy_master.eq.false')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      const safeOrders = data || [];
      const orderItems = safeOrders.flatMap((order) => order.order_items || []);
      const directProductIds = [
        ...new Set(
          orderItems
            .map((item) => item.product_id)
            .filter((productId): productId is string => Boolean(productId)),
        ),
      ];
      const variantIds = [
        ...new Set(
          orderItems
            .map((item) => item.product_variant_id)
            .filter((variantId): variantId is string => Boolean(variantId)),
        ),
      ];

      let variantProductMap = new Map<string, string>();
      if (variantIds.length > 0) {
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .in('id', variantIds);

        variantProductMap = new Map(
          ((variants as ProductVariantLookupRow[] | null) || []).map((variant) => [variant.id, variant.product_id]),
        );
      }

      const imageProductIds = [
        ...new Set([
          ...directProductIds,
          ...variantIds
            .map((variantId) => variantProductMap.get(variantId))
            .filter((productId): productId is string => Boolean(productId)),
        ]),
      ];

      const productImageMap = new Map<string, string>();
      if (imageProductIds.length > 0) {
        const { data: images } = await supabase
          .from('product_images')
          .select('product_id, image_url, order_index')
          .in('product_id', imageProductIds)
          .order('order_index', { ascending: true });

        ((images as ProductImageLookupRow[] | null) || []).forEach((image) => {
          if (!productImageMap.has(image.product_id)) {
            productImageMap.set(image.product_id, image.image_url);
          }
        });
      }

      const mappedOrders = safeOrders.map((order) => ({
        ...order,
        order_items: (order.order_items || []).map((item) => {
          const resolvedProductId =
            item.product_id ||
            (item.product_variant_id ? variantProductMap.get(item.product_variant_id) || null : null);

          return {
            ...item,
            image_url: resolvedProductId ? productImageMap.get(resolvedProductId) || null : null,
          };
        }),
      }));

      setOrders(mappedOrders);
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user) {
      return;
    }

    if (!AVATAR_MIME_TYPES.has(file.type)) {
      toast.error('Please choose a JPG, PNG, WEBP, or GIF image.');
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      toast.error('Profile pictures must be 2MB or smaller.');
      return;
    }

    setAvatarUploading(true);

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : 'jpg';
    const avatarPath = `${user.id}/avatar-${Date.now()}.${safeExtension}`;
    const previousAvatarPath = getAvatarPathFromPublicUrl(profile.avatar_url);

    try {
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .upload(avatarPath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(avatarPath);
      const avatarUrl = publicUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      if (profileError) {
        await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
        throw profileError;
      }

      setProfile((currentProfile) => ({ ...currentProfile, avatar_url: avatarUrl }));

      if (previousAvatarPath && previousAvatarPath !== avatarPath) {
        await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([previousAvatarPath]);
      }

      toast.success('Profile picture updated');
    } catch (error) {
      console.error('Avatar upload failed:', error);
      toast.error('Could not update your profile picture.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile.avatar_url) {
      return;
    }

    setAvatarUploading(true);
    const avatarPath = getAvatarPathFromPublicUrl(profile.avatar_url);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile((currentProfile) => ({ ...currentProfile, avatar_url: null }));

      if (avatarPath) {
        await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
      }

      toast.success('Profile picture removed');
    } catch (error) {
      console.error('Avatar removal failed:', error);
      toast.error('Could not remove your profile picture.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveAddress = async () => {
    setSaving(true);

    try {
      const shouldReturnToPurchase = !editingAddress && Boolean(addressReturnTo);

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
          return;
        }

        toast.success('Address updated');
      } else {
        const isFirstAddress = addresses.length === 0;
        const { error } = await supabase
          .from('addresses')
          .insert({ ...addressForm, user_id: user!.id, is_default: addressForm.is_default || isFirstAddress });

        if (error) {
          toast.error('Failed to add address');
          return;
        }

        toast.success('Address added');
      }

      setAddressDialogOpen(false);
      setEditingAddress(null);
      resetAddressForm();
      await fetchAddresses();

      if (shouldReturnToPurchase && addressReturnTo) {
        navigate(addressReturnTo);
      }
    } finally {
      setSaving(false);
    }
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

  useEffect(() => {
    if (
      activeTab !== 'addresses' ||
      searchParams.get('openAddress') !== '1' ||
      addressSetupAutoOpenedRef.current
    ) {
      return;
    }

    addressSetupAutoOpenedRef.current = true;
    setEditingAddress(null);
    resetAddressForm();
    setAddressDialogOpen(true);
  }, [activeTab, searchParams]);

  const handleTrackOrder = (order: Order) => {
    navigate(`/track-order/${order.id}`);
  };

  const handleBuyAgain = async (order: Order) => {
    try {
      const added = await reAddOrderItemsToCart(order, addToCart);
      toast.success(`Added ${added} item(s) to cart`);
      navigate('/cart');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not re-add items.');
    }
  };

  const handleConfirmDelivery = async (order: Order) => {
    if (!user) return;

    const { data, error } = await supabase.rpc('confirm_order_delivery' as never, {
      order_id_input: order.id,
    } as never);

    if (error) {
      toast.error('Failed to confirm delivery');
      return;
    }

    const confirmedAt =
      Array.isArray(data) && data[0] && typeof data[0] === 'object' && 'confirmed_at' in data[0]
        ? String((data[0] as { confirmed_at: string }).confirmed_at)
        : new Date().toISOString();
    toast.success('Delivery confirmed!');
    await fetchOrders();
    setReviewDialogOrder({ ...order, status: 'delivered', customer_confirmed_at: confirmedAt });
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
      <main className="container max-w-4xl px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <h1 className="mb-6 text-2xl font-bold font-serif text-foreground md:mb-8 md:text-3xl">My Account</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mobile-scroll-pills -mx-1 mb-6 overflow-x-auto px-1 md:mb-8">
            <TabsList className="inline-flex h-auto min-w-max gap-1 rounded-2xl bg-muted/70 p-1.5">
              <TabsTrigger value="profile" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="addresses" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <MapPin className="h-4 w-4" />
                <span>Addresses</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <Package className="h-4 w-4" />
                <span>Orders</span>
              </TabsTrigger>
              <TabsTrigger value="wallet" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <Wallet className="h-4 w-4" />
                <span>Wallet</span>
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <Bell className="h-4 w-4" />
                <span>Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="support" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <Headphones className="h-4 w-4" />
                <span>Support</span>
              </TabsTrigger>
              <TabsTrigger value="refunds" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <RefreshCcw className="h-4 w-4" />
                <span>Refunds</span>
              </TabsTrigger>
              <TabsTrigger value="referral" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <Gift className="h-4 w-4" />
                <span>Referral</span>
              </TabsTrigger>
              <TabsTrigger value="loyalty" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm">
                <Award className="h-4 w-4" />
                <span>Points</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
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
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 border-2 border-primary/30 bg-primary/10 text-primary shadow-sm">
                        <AvatarImage
                          src={profile.avatar_url || undefined}
                          alt={`${profile.name || 'Profile'} avatar`}
                        />
                        <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                          {getAvatarInitials(profile.name, profile.email || user?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">Profile picture</p>
                        <p className="max-w-md text-sm text-muted-foreground">
                          Your avatar appears around group buys so shoppers can see real momentum building.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={handleAvatarUpload}
                        disabled={avatarUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                      >
                        {avatarUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                        Upload
                      </Button>
                      {profile.avatar_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveAvatar}
                          disabled={avatarUploading}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
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
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Saved Addresses
                  </CardTitle>
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
                        className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/70 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:p-4"
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
          <TabsContent value="orders" className="space-y-4">
            <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-serif text-2xl font-bold leading-tight text-foreground">
                  <Package className="h-5 w-5" />
                  Order History
                </h2>
              </div>
              <Link to="/my-orders">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Open My Orders
                </Button>
              </Link>
            </div>

            {orders.length === 0 ? (
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-foreground">No orders yet</h3>
                  <p className="mb-6 text-muted-foreground">Start shopping to see your orders here</p>
                  <Link to="/products">
                    <Button className="w-full sm:w-auto">Browse Products</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const refundOpen = canRequestRefund(order);
                  const refundReason = refundOpen
                    ? 'Refund available during the 48-hour payment window.'
                    : getRefundButtonReason(order);

                  return (
                    <CompactOrderHistoryCard
                      key={order.id}
                      order={order}
                      formatPrice={formatPrice}
                      onTrack={handleTrackOrder}
                      onConfirmDelivery={handleConfirmDelivery}
                      onReview={(selectedOrder) => setReviewDialogOrder(selectedOrder)}
                      onBuyAgain={handleBuyAgain}
                      afterSalesAction={
                        <AfterSalesServiceDialog
                          order={order}
                          triggerLabel="Request After-Sales Service"
                          className="h-9 w-full justify-center rounded-xl border-border/70 px-3 text-xs font-semibold"
                        />
                      }
                      refundAction={
                        <RefundRequestDialog
                          order={order}
                          canRequest={refundOpen}
                          disabledReason={refundReason}
                          triggerLabel="Refund"
                          className="h-8 w-full px-2 text-[11px] sm:text-xs"
                        />
                      }
                      footerSlot={
                        order.group_buy_id ? (
                          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-[0.12em]">
                            <Users className="mr-1 h-3 w-3" />
                            Group Buy
                          </Badge>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            )}
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
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCcw className="h-5 w-5" />
                  Refunds & Returns
                </CardTitle>
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
                      <div key={request.id} className="rounded-2xl border border-border/70 bg-background/70 p-3.5 sm:p-4">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                            <div className="mt-2 rounded-2xl bg-muted p-3">
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
      <OrderReviewDialog
        open={!!reviewDialogOrder}
        order={reviewDialogOrder}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialogOrder(null);
          }
        }}
        onSubmitted={() => setReviewDialogOrder(null)}
      />
    </div>
  );
}
