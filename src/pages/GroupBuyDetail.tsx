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

export default function GroupBuyDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatPrice } = useCurrency();

  const { data: groupBuy, isLoading } = useQuery({
    queryKey: ['group-buy-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_buys')
        .select(`
          *,
          products(id, name, description, base_price, rating, review_count, categories(name))
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;

      // Fetch images
      const { data: images } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', data.product_id)
        .order('order_index');

      // Fetch participant count with avatars
      const { data: participants } = await supabase
        .from('group_buy_participants')
        .select('id, joined_at')
        .eq('group_buy_id', id!);

      const product = data.products as any;
      return {
        ...data,
        discount_percentage: data.discount_percentage ? Number(data.discount_percentage) : null,
        product: product ? {
          id: product.id,
          name: product.name,
          description: product.description,
          base_price: Number(product.base_price),
          rating: product.rating ? Number(product.rating) : null,
          review_count: product.review_count,
          category_name: product.categories?.name || null,
          images: images?.map((i) => i.image_url) || [],
        } : null,
        participants: participants || [],
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
    (new Date(groupBuy.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const discountedPrice = groupBuy.product.base_price * (1 - (groupBuy.discount_percentage || 0) / 100);
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
          {/* Product Image */}
          <div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
              <img
                src={groupBuy.product.images[0] || '/placeholder.svg'}
                alt={groupBuy.product.name}
                className="w-full h-full object-cover"
              />
              {groupBuy.discount_percentage && (
                <Badge className="absolute top-4 left-4 bg-accent text-accent-foreground text-lg px-4 py-1.5">
                  {groupBuy.discount_percentage}% OFF
                </Badge>
              )}
              {isFilled && (
                <Badge className="absolute top-4 right-4 bg-green-600 text-white text-lg px-4 py-1.5">
                  <CheckCircle className="h-4 w-4 mr-1" /> FILLED
                </Badge>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">{groupBuy.product.category_name}</p>
              <h1 className="text-3xl font-bold font-serif text-foreground">
                {groupBuy.title || groupBuy.product.name}
              </h1>
              <p className="text-muted-foreground mt-2">{groupBuy.product.description}</p>
            </div>

            {/* Pricing */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground line-through">
                      {formatPrice(groupBuy.product.base_price)}
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      {formatPrice(discountedPrice)}
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

                {/* Progress */}
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
                  {groupBuy.max_participants && (
                    <p className="text-xs text-muted-foreground">
                      Max {groupBuy.max_participants} participants
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Participant Avatars */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {(groupBuy.participants || []).slice(0, 8).map((p: any, i: number) => (
                  <div
                    key={p.id}
                    className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium text-primary"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              {(groupBuy.participants?.length || 0) > 8 && (
                <span className="text-sm text-muted-foreground">
                  +{(groupBuy.participants?.length || 0) - 8} more
                </span>
              )}
            </div>

            {/* Actions */}
            {!isCancelled && (
              <div className="space-y-3">
                <JoinGroupBuyDialog
                  groupBuy={{
                    id: groupBuy.id,
                    product_id: groupBuy.product_id,
                    min_participants: groupBuy.min_participants,
                    current_participants: groupBuy.current_participants,
                    discount_percentage: groupBuy.discount_percentage,
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
                  discount={groupBuy.discount_percentage}
                />
              </div>
            )}

            {isCancelled && (
              <Card className="border-destructive/50">
                <CardContent className="p-4 text-center">
                  <p className="font-medium text-destructive">This group buy has been cancelled/expired.</p>
                </CardContent>
              </Card>
            )}

            {/* View product link */}
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
