import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, Ship, Plane, Package, ArrowLeft, ShoppingBag } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export default function Cart() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const {
    items,
    selectedShipping,
    removeFromCart,
    updateQuantity,
    setShipping,
    clearCart,
    subtotal,
    shippingCost,
    total,
  } = useCart();

  // Get common shipping options from first item (simplified)
  const shippingOptions = items.length > 0 ? items[0].product.shippingOptions : [];

  const getShippingIcon = (type: string) => {
    switch (type) {
      case 'sea':
        return <Ship className="h-5 w-5" />;
      case 'air_express':
        return <Package className="h-5 w-5" />;
      default:
        return <Plane className="h-5 w-5" />;
    }
  };

  const handleCheckout = () => {
    if (!selectedShipping) {
      toast.error('Please select a shipping method');
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="p-6 rounded-full bg-card border border-border w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Your cart is empty
            </h1>
            <p className="text-muted-foreground mb-6">
              Discover amazing products from around the world
            </p>
            <Link to="/products">
              <Button size="lg">Start Shopping</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        {/* Breadcrumb */}
        <Link
          to="/products"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Continue Shopping
        </Link>

        <h1 className="text-3xl font-bold font-serif text-foreground mb-8">
          Shopping Cart
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-foreground line-clamp-1">
                            {item.product.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {item.variant.color}
                            {item.variant.size && ` • ${item.variant.size}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium text-foreground">
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="font-semibold text-primary">
                          {formatPrice(item.variant.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outline"
              className="text-muted-foreground"
              onClick={clearCart}
            >
              Clear Cart
            </Button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Shipping Selection */}
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Select Shipping</h4>
                  {shippingOptions.map((option) => (
                    <div
                      key={option.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        option.available
                          ? selectedShipping?.id === option.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                          : 'border-border opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => option.available && setShipping(option)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-primary">
                            {getShippingIcon(option.type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {option.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {option.estimatedDays}
                            </p>
                          </div>
                        </div>
                        <p className="font-medium text-foreground">
                          {formatPrice(option.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-foreground">
                      {selectedShipping
                        ? formatPrice(shippingCost)
                        : 'Select shipping'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-xl font-bold text-primary">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Secure checkout powered by trusted payment providers
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
