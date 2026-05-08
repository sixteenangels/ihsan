import { useNavigate } from 'react-router-dom';
import { Heart, Loader2, ShoppingBag } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlist } from '@/hooks/useWishlist';
import { useProducts, type ProductWithDetails } from '@/hooks/useProducts';
import { ProductCard } from '@/components/products/ProductCard';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

function toProductCardFormat(product: ProductWithDetails) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    category: product.category_name || 'Uncategorized',
    basePrice: product.base_price,
    images: product.images.length > 0 ? product.images : ['https://via.placeholder.com/400'],
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size || undefined,
      color: variant.color || undefined,
      price: variant.price,
      stock: variant.stock || 0,
    })),
    shippingOptions: [],
    isGroupBuyEligible: product.is_group_buy_eligible || false,
    isFlashDeal: product.is_flash_deal || false,
    isFreeShippingEligible: product.is_free_shipping || false,
    rating: product.rating || 0,
    reviewCount: product.review_count || 0,
  };
}

export default function Wishlist() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { wishlist, isLoading: wishlistLoading } = useWishlist();
  const { data: products, isLoading: productsLoading } = useProducts();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const isLoading = authLoading || wishlistLoading || productsLoading;

  const wishlistProducts = products?.filter((p) =>
    wishlist.some((w) => w.product_id === p.id)
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-8 flex items-center gap-3">
          <Heart className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
          <h1 className="text-2xl font-bold font-serif text-foreground sm:text-3xl">My Wishlist</h1>
        </div>

        {wishlistProducts.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Your wishlist is empty</h2>
            <p className="mb-6 text-sm text-muted-foreground sm:text-base">
              Save products you love to your wishlist and find them here anytime
            </p>
            <Button onClick={() => navigate('/products')}>
              <ShoppingBag className="h-4 w-4 mr-2" />
              Browse Products
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground sm:text-base">
              {wishlistProducts.length} item{wishlistProducts.length !== 1 ? 's' : ''} saved
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {wishlistProducts.map((product) => (
                <ProductCard key={product.id} product={toProductCardFormat(product)} />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
