import { Link } from 'react-router-dom';
import { Plane, Ship, Package } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-16 hidden md:block">
      <div className="container py-12">
        {/* Shipping Info Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 pb-8 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Ship className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Sea Shipping</h4>
              <p className="text-sm text-muted-foreground">45-50 days • Lowest cost</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Plane className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Air Normal</h4>
              <p className="text-sm text-muted-foreground">7-10 days • Balanced</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Air Express</h4>
              <p className="text-sm text-muted-foreground">1-3 days • Fastest</p>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h5 className="font-semibold text-foreground mb-4">Shop</h5>
            <ul className="space-y-2">
              <li><Link to="/products" className="text-sm text-muted-foreground hover:text-primary transition-colors">All Products</Link></li>
              <li><Link to="/flash-deals" className="text-sm text-muted-foreground hover:text-primary transition-colors">Flash Deals</Link></li>
              <li><Link to="/group-buys" className="text-sm text-muted-foreground hover:text-primary transition-colors">Group Buys</Link></li>
              <li><Link to="/categories" className="text-sm text-muted-foreground hover:text-primary transition-colors">Categories</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-foreground mb-4">Support</h5>
            <ul className="space-y-2">
              <li><Link to="/help" className="text-sm text-muted-foreground hover:text-primary transition-colors">Help Center</Link></li>
              <li><Link to="/track-order" className="text-sm text-muted-foreground hover:text-primary transition-colors">Track Order</Link></li>
              <li><Link to="/delivery-zones" className="text-sm text-muted-foreground hover:text-primary transition-colors">Delivery Zones</Link></li>
              <li><Link to="/customs-estimator" className="text-sm text-muted-foreground hover:text-primary transition-colors">Customs Estimator</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-foreground mb-4">Company</h5>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">About Us</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Careers</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-foreground mb-4">Legal</h5>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Returns Policy</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-serif text-primary">Ihsan</span>
            <span className="text-sm text-muted-foreground">• Global Shopping Made Simple</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ihsan. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
