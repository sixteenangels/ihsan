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
import { format } from 'date-fns';

export default function Compare() {
  const { user } = useAuth();
  const { compareItems, removeFromCompare, clearCompare, addToCompare } = useCompare();
  const { data: allProducts } = useProducts();
  const { history, saveComparison, deleteHistory } = useComparisonHistory();

  const products = allProducts?.filter(p => compareItems.includes(p.id)) || [];

  useEffect(() => {
    if (user && compareItems.length >= 2) {
      saveComparison(compareItems);
    }
  }, []);

  const loadFromHistory = (productIds: string[]) => {
    clearCompare();
    productIds.forEach(id => addToCompare(id));
  };

  const getProductNames = (productIds: string[]) => {
    return productIds
      .map(id => allProducts?.find(p => p.id === id)?.name || 'Unknown')
      .join(', ');
  };

  if (compareItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold">No Products to Compare</h1>
            <p className="text-muted-foreground mb-6">Add products to compare them side by side</p>
            <Link to="/products">
              <Button>Browse Products</Button>
            </Link>
          </div>

          {user && history.length > 0 && (
            <div className="mt-12 max-w-2xl mx-auto">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <History className="h-5 w-5" />
                Previous Comparisons
              </h2>
              <div className="space-y-3">
                {history.map(entry => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.compared_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        <p className="text-sm line-clamp-1">
                          {getProductNames(entry.product_ids)}
                        </p>
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
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Compare Products ({products.length})</h1>
          <Button variant="outline" onClick={clearCompare}>Clear All</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-4 border-b bg-muted/50 min-w-[150px]">Feature</th>
                {products.map(product => (
                  <th key={product.id} className="p-4 border-b bg-muted/50 min-w-[250px]">
                    <div className="relative">
                      <Button variant="ghost" size="icon" className="absolute -top-2 -right-2" onClick={() => removeFromCompare(product.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <img src={product.images?.[0] || '/placeholder.svg'} alt={product.name} className="w-32 h-32 object-cover mx-auto rounded-lg mb-2" />
                      <Link to={`/product/${product.id}`} className="font-medium hover:text-primary">{product.name}</Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 border-b font-medium">Price</td>
                {products.map(product => (
                  <td key={product.id} className="p-4 border-b text-center">
                    <span className="text-xl font-bold text-primary">₦{product.base_price.toLocaleString()}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 border-b font-medium">Rating</td>
                {products.map(product => (
                  <td key={product.id} className="p-4 border-b text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{product.rating || 0}</span>
                      <span className="text-muted-foreground">({product.review_count || 0})</span>
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 border-b font-medium">Category</td>
                {products.map(product => (
                  <td key={product.id} className="p-4 border-b text-center">{product.category_name || 'N/A'}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 border-b font-medium">Stock</td>
                {products.map(product => {
                  const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
                  return (
                    <td key={product.id} className="p-4 border-b text-center">
                      <Badge variant={totalStock > 10 ? 'default' : totalStock > 0 ? 'secondary' : 'destructive'}>
                        {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                      </Badge>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="p-4 border-b font-medium">Features</td>
                {products.map(product => (
                  <td key={product.id} className="p-4 border-b text-center">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {product.is_free_shipping && <Badge variant="secondary" className="gap-1"><Truck className="h-3 w-3" /> Free Shipping</Badge>}
                      {product.is_flash_deal && <Badge variant="secondary" className="gap-1 bg-orange-500 text-white"><Zap className="h-3 w-3" /> Flash Deal</Badge>}
                      {product.is_group_buy_eligible && <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Group Buy</Badge>}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium">Action</td>
                {products.map(product => (
                  <td key={product.id} className="p-4 text-center">
                    <Link to={`/product/${product.id}`}><Button>View Details</Button></Link>
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
