import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JoinGroupBuyDialog } from '@/components/groupbuy/JoinGroupBuyDialog';
import { GroupBuyShareSheet } from '@/components/groupbuy/GroupBuyShareSheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/useCurrency';
import { Users, Clock, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { getGroupBuySavingsPercent, getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import type { Database } from '@/integrations/supabase/types';

type GroupBuyParticipantSummary = Pick<
  Database['public']['Tables']['group_buy_participants']['Row'],
  'id' | 'joined_at'
>;

interface GroupBuyDetailData {
  id: string;
  product_id: string;
  title: string | null;
  min_participants: number;
  max_participants: number | null;
  current_participants: number | null;
  discount_percentage: number | null;
  group_price: number | null;
  expires_at: string;
  status: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    rating: number | null;
    review_count: number | null;
    category_name: string | null;
    images: string[];
  } | null;
  participants: GroupBuyParticipantSummary[];
}

export default function GroupBuyDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatPrice } = useCurrency();

  const { data: groupBuy, isLoading } = useQuery({
    queryKey: ['group-buy-detail', id],
    queryFn: async (): Promise<GroupBuyDetailData> => {
      const { data, error } = await supabase
        .from('group_buys')
        .select(`
          *,
          products(id, name, description, base_price, rating, review_count, categories(name))
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;

      const { data: images } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', data.product_id)
        .order('order_index');

      const { data: participants } = await supabase
        .from('group_buy_participants')
        .select('id, joined_at')
        .eq('group_buy_id', id!);

      const productData = data.products as {
        id: string;
        name: string;
        description: string | null;
        base_price: number;
        rating: number | null;
        review_count: number | null;
        categories: { name: string } | null;
      } | null;

      return {
        ...data,
        discount_percentage: data.discount_percentage ? Number(data.discount_percentage) : null,
        group_price: data.group_price != null ? Number(data.group_price) : null,
        product: productData
          ? {
              id: productData.id,
              name: productData.name,
              description: productData.description,
              base_price: Number(productData.base_price),
              rating: productData.rating ? Number(productData.rating) : null,
              review_count: productData.review_count,
              category_name: productData.categories?.name || null,
              images: images?.map((image) => image.image_url) || [],
            }
          : null,
        participants: (participants || []) as GroupBuyParticipantSummary[],
      };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!groupBuy || !groupBuy.product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Group Buy Not Found</h1>
          <Link to="/group-buys"><Button>Browse Group Buys</Button></Link>
        </main>
        <Footer />
      </div>
    );
  }

  const progress = ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100;
  const daysLeft = Math.ceil(
    (new Date(groupBuy.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const groupPrice = getGroupBuyUnitPrice({
    basePrice: groupBuy.product.base_price,
    groupPrice: groupBuy.group_price,
    discountPercentage: groupBuy.discount_percentage,
  });
  const savingsPercent = getGroupBuySavingsPercent({
    basePrice: groupBuy.product.base_price,
    groupPrice: groupBuy.group_price,
    discountPercentage: groupBuy.discount_percentage,
  });
  const isFilled = groupBuy.status === 'filled';
  const isCancelled = groupBuy.status === 'cancelled' || groupBuy.status === 'closed';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 pb-24 md:pb-8">
        <Link to="/group-buys" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Group Buys
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
              <img
                src={groupBuy.product.images[0] || '/placeholder.svg'}
                alt={groupBuy.product.name}
                className="w-full h-full object-cover"
              />
              {savingsPercent > 0 ? (
                <Badge className="absolute top-4 left-4 bg-accent text-accent-foreground text-lg px-4 py-1.5">
                  {savingsPercent}% OFF
                </Badge>
              ) : null}
              {isFilled ? (
                <Badge className="absolute top-4 right-4 bg-green-600 text-white text-lg px-4 py-1.5">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  FILLED
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">{groupBuy.product.category_name}</p>
              <h1 className="text-3xl font-bold font-serif text-foreground">
                {groupBuy.title || groupBuy.product.name}
              </h1>
              <p className="text-muted-foreground mt-2">{groupBuy.product.description}</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground line-through">
                      {formatPrice(groupBuy.product.base_price)}
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      {formatPrice(groupPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        {daysLeft > 0 ? `${daysLeft} days left` : 'Ending soon'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {groupBuy.current_participants || 0} / {groupBuy.min_participants} joined
                      </span>
                    </div>
                    <span className="font-medium text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={Math.min(progress, 100)} className="h-3" />
                  {groupBuy.max_participants ? (
                    <p className="text-xs text-muted-foreground">
                      Max {groupBuy.max_participants} participants
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {groupBuy.participants.slice(0, 8).map((participant, index) => (
                  <div
                    key={participant.id}
                    className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium text-primary"
                  >
                    {index + 1}
                  </div>
                ))}
              </div>
              {groupBuy.participants.length > 8 ? (
                <span className="text-sm text-muted-foreground">
                  +{groupBuy.participants.length - 8} more
                </span>
              ) : null}
            </div>

            {!isCancelled ? (
              <div className="space-y-3">
                <JoinGroupBuyDialog
                  groupBuy={{
                    id: groupBuy.id,
                    product_id: groupBuy.product_id,
                    min_participants: groupBuy.min_participants,
                    current_participants: groupBuy.current_participants,
                    discount_percentage: groupBuy.discount_percentage,
                    group_price: groupBuy.group_price,
                    expires_at: groupBuy.expires_at,
                    product: {
                      name: groupBuy.product.name,
                      base_price: groupBuy.product.base_price,
                    },
                  }}
                />
                <GroupBuyShareSheet
                  groupBuyId={groupBuy.id}
                  title={groupBuy.title || groupBuy.product.name}
                  price={groupPrice}
                  savingsPercent={savingsPercent}
                />
              </div>
            ) : (
              <Card className="border-destructive/50">
                <CardContent className="p-4 text-center">
                  <p className="font-medium text-destructive">This group buy has been cancelled or expired.</p>
                </CardContent>
              </Card>
            )}

            <Link to={`/product/${groupBuy.product.id}`}>
              <Button variant="outline" className="w-full">View Full Product Details</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
