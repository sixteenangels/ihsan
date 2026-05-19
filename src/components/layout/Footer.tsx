import { Link } from 'react-router-dom';
import { Plane, Ship, Package } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-card pb-24 md:pb-0">
      <div className="container px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-10 grid grid-cols-1 gap-4 border-b border-border pb-8 sm:mb-12 sm:gap-6 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Ship className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Sea Shipping</h4>
              <p className="text-sm text-muted-foreground">45-50 days - Lowest cost</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Plane className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Air Normal</h4>
              <p className="text-sm text-muted-foreground">7-10 days - Balanced</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Air Express</h4>
              <p className="text-sm text-muted-foreground">1-3 days - Fastest</p>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h5 className="mb-4 font-semibold text-foreground">Shop</h5>
            <ul className="space-y-2">
              <li><Link to="/products" className="text-sm text-muted-foreground transition-colors hover:text-primary">All Products</Link></li>
              <li><Link to="/flash-deals" className="text-sm text-muted-foreground transition-colors hover:text-primary">Flash Deals</Link></li>
              <li><Link to="/group-buys" className="text-sm text-muted-foreground transition-colors hover:text-primary">Group Buys</Link></li>
              <li><Link to="/categories" className="text-sm text-muted-foreground transition-colors hover:text-primary">Categories</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 font-semibold text-foreground">Support</h5>
            <ul className="space-y-2">
              <li><Link to="/help" className="text-sm text-muted-foreground transition-colors hover:text-primary">Help Center</Link></li>
              <li><Link to="/track-order" className="text-sm text-muted-foreground transition-colors hover:text-primary">Track Order</Link></li>
              <li><Link to="/delivery-zones" className="text-sm text-muted-foreground transition-colors hover:text-primary">Delivery Zones</Link></li>
              <li><Link to="/customs-estimator" className="text-sm text-muted-foreground transition-colors hover:text-primary">Customs Estimator</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 font-semibold text-foreground">Company</h5>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-sm text-muted-foreground transition-colors hover:text-primary">About Us</Link></li>
              <li><Link to="/contact" className="text-sm text-muted-foreground transition-colors hover:text-primary">Contact</Link></li>
              <li><Link to="/careers" className="text-sm text-muted-foreground transition-colors hover:text-primary">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 font-semibold text-foreground">Legal</h5>
            <ul className="space-y-2">
              <li><Link to="/privacy-policy" className="text-sm text-muted-foreground transition-colors hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="text-sm text-muted-foreground transition-colors hover:text-primary">Terms of Service</Link></li>
              <li><Link to="/returns-policy" className="text-sm text-muted-foreground transition-colors hover:text-primary">Returns Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2 md:items-start">
            <BrandMark />
            <span className="text-sm text-muted-foreground">{BRAND_TAGLINE}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            (c) {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
