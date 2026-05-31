import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-image.jpg';

export function HeroSection() {
  return (
    <section className="relative flex min-h-[64dvh] items-center overflow-hidden sm:min-h-[80vh]">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Global shopping"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/85 via-foreground/60 to-foreground/20 sm:bg-gradient-to-r" />
      </div>

      {/* Content */}
      <div className="container relative z-10 px-3 py-12 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h1 className="mb-4 text-[2.35rem] font-bold font-serif leading-[0.98] text-primary-foreground sm:text-4xl md:mb-6 md:text-5xl lg:text-6xl">
            Shopping the world,
            <br />
            <span className="text-primary">simplified.</span>
          </h1>
          <p className="mb-6 max-w-lg text-sm leading-6 text-primary-foreground/85 sm:text-lg md:mb-8 md:text-xl">
            Cross-border shopping made simple. Join group buys, choose your shipping,
            and get products from around the world at transparent prices.
          </p>

          <div className="mb-8 flex flex-col gap-3 sm:mb-12 sm:flex-row sm:gap-4">
            <Link to="/products">
              <Button size="lg" className="w-full px-6 text-base sm:w-auto sm:px-8 sm:text-lg">
                Shop Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/group-buys">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-primary-foreground/30 bg-primary-foreground/10 px-6 text-base text-primary-foreground hover:bg-primary-foreground/20 sm:w-auto sm:px-8 sm:text-lg"
              >
                Explore Group Buys
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-6">
            <div className="flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-2 text-xs text-primary-foreground/85 backdrop-blur sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:backdrop-blur-0">
              <Globe className="h-5 w-5" />
              <span>Ship from 20+ Countries</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-2 text-xs text-primary-foreground/85 backdrop-blur sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:backdrop-blur-0">
              <Truck className="h-5 w-5" />
              <span>Flexible Shipping Options</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-2 text-xs text-primary-foreground/85 backdrop-blur sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:backdrop-blur-0">
              <Shield className="h-5 w-5" />
              <span>Secure Payments</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
