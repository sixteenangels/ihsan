import { useEffect } from 'react';
import { useCompare } from '@/contexts/CompareContext';
import { useProducts } from '@/hooks/useProducts';
import { useComparisonHistory } from '@/hooks/useComparisonHistory';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Star, Truck, Zap, Users, History, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatStoreDateTime } from '@/lib/date-utils';

export default function Compare() {
  const { user } = useAuth();
  const { compareItems, removeFromCompare, clearCompare, addToCompare } = useCompare();
  const { data: allProducts } = useProducts();
  const { history, saveComparison, deleteHistory } = useComparisonHistory();

  const products = allProducts?.filter((p) => compareItems.includes(p.id)) || [];

  useEffect(() => {
    if (user && compareItems.length >= 2) {
      saveComparison(compareItems);
    }
  }, [compareItems, saveComparison, user]);

  const loadFromHistory = (productIds: string[]) => {
    clearCompare();
    productIds.forEach((id) => addToCompare(id));
  };

  const getProductNames = (productIds: string[]) => {
    return productIds
      .map((id) => allProducts?.find((p) => p.id === id)?.name || 'Unknown')
      .join(', ');
  };

  if (compareItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container mx-auto flex-1 px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
          <div className="py-16 text-center">
            <h1 className="text-2xl font-bold">No Products to Compare</h1>
            <p className="mb-6 text-muted-foreground">Add products to compare them side by side</p>
            <Link to="/products">
              <Button>Browse Products</Button>
            </Link>
          </div>

          {user && history.length > 0 && (
            <div className="mx-auto mt-12 max-w-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <History className="h-5 w-5" />
                Previous Comparisons
              </h2>
              <div className="space-y-3">
                {history.map((entry) => (
                  <Card key={entry.id} className="rounded-2xl border-border/70 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          {formatStoreDateTime(entry.compared_at)}
                        </p>
                        <p className="line-clamp-1 text-sm">{getProductNames(entry.product_ids)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => loadFromHistory(entry.product_ids)}>
                          Load
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteHistory(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Compare Products ({products.length})</h1>
          <Button variant="outline" onClick={clearCompare} className="w-full sm:w-auto">
            Clear All
          </Button>
        </div>

        <div className="space-y-4 md:hidden">
          {products.map((product) => {
            const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
            return (
              <Card key={product.id} className="rounded-2xl border-border/70 p-3.5 shadow-sm sm:p-4">
                <div className="mb-4 flex items-start gap-3">
                  <img
                    src={product.images?.[0] || '/placeholder.svg'}
                    alt={product.name}
                    className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <Link to={`/product/${product.id}`} className="font-medium hover:text-primary">
                        {product.name}
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-2 -mt-2 h-8 w-8"
                        onClick={() => removeFromCompare(product.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-lg font-bold text-primary">GHS {product.base_price.toLocaleString()}</p>
                    <div className="mt-1 flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{product.rating || 0}</span>
                      <span className="text-muted-foreground">({product.review_count || 0})</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Category</span>
                    <span className="text-right">{product.category_name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Stock</span>
                    <Badge variant={totalStock > 10 ? 'default' : totalStock > 0 ? 'secondary' : 'destructive'}>
                      {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.is_free_shipping && (
                      <Badge variant="secondary" className="gap-1">
                        <Truck className="h-3 w-3" /> Free Shipping
                      </Badge>
                    )}
                    {product.is_flash_deal && (
                      <Badge variant="secondary" className="gap-1 bg-orange-500 text-white">
                        <Zap className="h-3 w-3" /> Flash Deal
                      </Badge>
                    )}
                    {product.is_group_buy_eligible && (
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" /> Group Buy
                      </Badge>
                    )}
                  </div>
                  <Link to={`/product/${product.id}`}>
                    <Button className="h-11 w-full rounded-xl">View Details</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="min-w-[150px] border-b bg-muted/50 p-4 text-left">Feature</th>
                {products.map((product) => (
                  <th key={product.id} className="min-w-[250px] border-b bg-muted/50 p-4">
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-2 -top-2"
                        onClick={() => removeFromCompare(product.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <img
                        src={product.images?.[0] || '/placeholder.svg'}
                        alt={product.name}
                        className="mx-auto mb-2 h-32 w-32 rounded-lg object-cover"
                      />
                      <Link to={`/product/${product.id}`} className="font-medium hover:text-primary">
                        {product.name}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b p-4 font-medium">Price</td>
                {products.map((product) => (
                  <td key={product.id} className="border-b p-4 text-center">
                    <span className="text-xl font-bold text-primary">GHS {product.base_price.toLocaleString()}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b p-4 font-medium">Rating</td>
                {products.map((product) => (
                  <td key={product.id} className="border-b p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{product.rating || 0}</span>
                      <span className="text-muted-foreground">({product.review_count || 0})</span>
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b p-4 font-medium">Category</td>
                {products.map((product) => (
                  <td key={product.id} className="border-b p-4 text-center">
                    {product.category_name || 'N/A'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b p-4 font-medium">Stock</td>
                {products.map((product) => {
                  const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
                  return (
                    <td key={product.id} className="border-b p-4 text-center">
                      <Badge variant={totalStock > 10 ? 'default' : totalStock > 0 ? 'secondary' : 'destructive'}>
                        {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                      </Badge>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="border-b p-4 font-medium">Features</td>
                {products.map((product) => (
                  <td key={product.id} className="border-b p-4 text-center">
                    <div className="flex flex-wrap justify-center gap-2">
                      {product.is_free_shipping && (
                        <Badge variant="secondary" className="gap-1">
                          <Truck className="h-3 w-3" /> Free Shipping
                        </Badge>
                      )}
                      {product.is_flash_deal && (
                        <Badge variant="secondary" className="gap-1 bg-orange-500 text-white">
                          <Zap className="h-3 w-3" /> Flash Deal
                        </Badge>
                      )}
                      {product.is_group_buy_eligible && (
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" /> Group Buy
                        </Badge>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium">Action</td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    <Link to={`/product/${product.id}`}>
                      <Button>View Details</Button>
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}
