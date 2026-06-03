import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-image.jpg';
import { useEffect, useState } from 'react';

const heroSlides = [
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=85',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1800&q=85',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1800&q=85',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1800&q=85',
];

export function HeroSection() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-[64dvh] items-center overflow-hidden sm:min-h-[80vh]">
      <div className="absolute inset-0 bg-foreground" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <img
            key={slide}
            src={slide}
            alt=""
            loading={index === 0 ? 'eager' : 'lazy'}
            onError={(event) => {
              event.currentTarget.src = heroImage;
            }}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out ${
              index === activeSlide ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, rgba(18, 18, 18, 0.9) 0%, rgba(18, 18, 18, 0.72) 38%, rgba(18, 18, 18, 0.38) 68%, rgba(18, 18, 18, 0.2) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-primary/15 mix-blend-multiply" />
      </div>

      {/* Content */}
      <div className="container relative z-10 px-3 py-12 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h1 className="mb-4 text-[2.35rem] font-bold font-serif leading-[0.98] text-primary-foreground sm:text-4xl md:mb-6 md:text-5xl lg:text-6xl">
            Shopping the world,
            <br />
            <span className="text-primary-foreground">simplified.</span>
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

      <div className="absolute bottom-5 right-5 z-10 hidden gap-2 sm:flex">
        {heroSlides.map((slide, index) => (
          <button
            key={`indicator-${slide}`}
            type="button"
            aria-label={`Show hero slide ${index + 1}`}
            onClick={() => setActiveSlide(index)}
            className={`h-1.5 rounded-full bg-primary-foreground transition-all duration-500 ${
              index === activeSlide ? 'w-8 opacity-90' : 'w-1.5 opacity-45'
            }`}
          />
        ))}
      </div>
      <div className="absolute bottom-20 right-4 z-10 flex gap-2 sm:hidden">
        {heroSlides.map((slide, index) => (
          <button
            key={`mobile-indicator-${slide}`}
            type="button"
            aria-label={`Show hero slide ${index + 1}`}
            onClick={() => setActiveSlide(index)}
            className={`h-2 rounded-full bg-primary-foreground transition-all duration-500 ${
              index === activeSlide ? 'w-7 opacity-95' : 'w-2 opacity-50'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
