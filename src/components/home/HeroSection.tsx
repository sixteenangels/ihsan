import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-image.jpg';

export function HeroSection() {
  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Global shopping"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative z-10">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-serif text-primary-foreground mb-6 leading-tight">
            Shop Global.
            <br />
            <span className="text-primary">Save Together.</span>
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-lg">
            Cross-border shopping made simple. Join group buys, choose your shipping,
            and get products from around the world at transparent prices.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link to="/products">
              <Button size="lg" className="text-lg px-8">
                Shop Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/group-buys">
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20"
              >
                Explore Group Buys
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Globe className="h-5 w-5" />
              <span className="text-sm">Ship from 20+ Countries</span>
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Truck className="h-5 w-5" />
              <span className="text-sm">Flexible Shipping Options</span>
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Shield className="h-5 w-5" />
              <span className="text-sm">Secure Payments</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
