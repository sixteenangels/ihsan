import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Globe, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-image.jpg';
import { useEffect, useState } from 'react';

const heroSlides = [
  {
    image: 'https://images.unsplash.com/photo-1605733160314-4fc7dac4bb16?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1511556820780-d912e42b4980?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
  {
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1800&q=85',
    position: 'center',
  },
];

export function HeroSection() {
  const [activeSlide, setActiveSlide] = useState(0);
  const showSlide = (index: number) => {
    setActiveSlide((index + heroSlides.length) % heroSlides.length);
  };

  const getRandomSlide = (current: number) => {
    if (heroSlides.length <= 1) return current;

    let next = current;
    while (next === current) {
      next = Math.floor(Math.random() * heroSlides.length);
    }
    return next;
  };

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const interval = window.setInterval(() => {
      setActiveSlide((current) => getRandomSlide(current));
    }, 3800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-[64dvh] items-center overflow-hidden sm:min-h-[80vh]">
      <div className="absolute inset-0 bg-foreground" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <img
            key={slide.image}
            src={slide.image}
            alt=""
            loading={index === 0 ? 'eager' : 'lazy'}
            onError={(event) => {
              event.currentTarget.src = heroImage;
            }}
            style={{ objectPosition: slide.position }}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out ${
              index === activeSlide ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, rgba(18, 18, 18, 0.86) 0%, rgba(18, 18, 18, 0.66) 38%, rgba(18, 18, 18, 0.22) 68%, rgba(18, 18, 18, 0.06) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-primary/10 mix-blend-multiply" />
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

      <div className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-primary-foreground/20 bg-background/20 p-2 shadow-2xl backdrop-blur-md sm:flex">
        <button
          type="button"
          aria-label="Show previous hero slide"
          onClick={() => showSlide(activeSlide - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/90 text-foreground shadow-sm transition hover:bg-primary-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {heroSlides.map((slide, index) => (
          <button
            key={`indicator-${slide.image}`}
            type="button"
            aria-label={`Show hero slide ${index + 1}`}
            onClick={() => showSlide(index)}
            className={`w-3 rounded-full transition-all duration-500 ${
              index === activeSlide ? 'h-10 bg-primary opacity-100' : 'h-3 bg-primary-foreground/80 opacity-75'
            }`}
          />
        ))}
        <button
          type="button"
          aria-label="Show next hero slide"
          onClick={() => showSlide(activeSlide + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/90 text-foreground shadow-sm transition hover:bg-primary-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute bottom-20 right-4 z-10 flex gap-2 sm:hidden">
        {heroSlides.map((slide, index) => (
          <button
            key={`mobile-indicator-${slide.image}`}
            type="button"
            aria-label={`Show hero slide ${index + 1}`}
            onClick={() => showSlide(index)}
            className={`h-2 rounded-full bg-primary-foreground transition-all duration-500 ${
              index === activeSlide ? 'w-7 opacity-95' : 'w-2 opacity-50'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
