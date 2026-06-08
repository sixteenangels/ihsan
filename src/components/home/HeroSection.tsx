import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import {
  HERO_CAROUSEL_SETTING_KEY,
  normalizeHeroCarouselImages,
} from '@/lib/heroCarousel';

const textThemes = [
  {
    headline: '#fff7ed',
    accent: '#ff8a33',
    body: 'rgba(255, 247, 237, 0.88)',
    badge: 'rgba(255, 247, 237, 0.86)',
  },
  {
    headline: '#fef3c7',
    accent: '#fbbf24',
    body: 'rgba(254, 243, 199, 0.88)',
    badge: 'rgba(254, 243, 199, 0.86)',
  },
  {
    headline: '#ecfdf5',
    accent: '#86efac',
    body: 'rgba(236, 253, 245, 0.88)',
    badge: 'rgba(236, 253, 245, 0.86)',
  },
  {
    headline: '#eff6ff',
    accent: '#93c5fd',
    body: 'rgba(239, 246, 255, 0.88)',
    badge: 'rgba(239, 246, 255, 0.86)',
  },
  {
    headline: '#fff1f2',
    accent: '#fda4af',
    body: 'rgba(255, 241, 242, 0.88)',
    badge: 'rgba(255, 241, 242, 0.86)',
  },
];

export function HeroSection() {
  const [activeSlide, setActiveSlide] = useState(0);
  const { data: storeSettings } = useStoreSettings();
  const heroSlides = useMemo(() => {
    const managedSlides = normalizeHeroCarouselImages(storeSettings?.[HERO_CAROUSEL_SETTING_KEY]);

    return managedSlides.map((slide) => ({
      image: slide.url,
      position: slide.position,
    }));
  }, [storeSettings]);
  const activeTextTheme = textThemes[activeSlide % textThemes.length];

  useEffect(() => {
    if (activeSlide >= heroSlides.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, heroSlides.length]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;
    if (heroSlides.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setActiveSlide((current) => {
        let next = current;
        while (next === current) {
          next = Math.floor(Math.random() * heroSlides.length);
        }
        return next;
      });
    }, 3800);

    return () => window.clearInterval(interval);
  }, [heroSlides.length]);

  return (
    <section className="relative flex min-h-[58dvh] items-center overflow-hidden sm:min-h-[80vh]">
      <div className="absolute inset-0 bg-foreground" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <img
            key={slide.image}
            src={slide.image}
            alt=""
            loading={index === 0 ? 'eager' : 'lazy'}
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
      <div className="container relative z-10 px-3 pb-6 pt-8 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h1
            className="mb-4 text-[2.35rem] font-bold font-serif leading-[0.98] transition-colors duration-700 sm:text-4xl md:mb-6 md:text-5xl lg:text-6xl"
            style={{ color: activeTextTheme.headline }}
          >
            Shopping the world,
            <br />
            <span className="transition-colors duration-700" style={{ color: activeTextTheme.accent }}>
              simplified.
            </span>
          </h1>
          <p
            className="mb-4 max-w-lg text-sm leading-6 transition-colors duration-700 sm:text-lg md:mb-8 md:text-xl"
            style={{ color: activeTextTheme.body }}
          >
            Cross-border shopping made simple. Join group buys, choose your shipping,
            and get products from around the world at transparent prices.
          </p>

          <div className="mb-3 flex flex-col items-start gap-2 sm:mb-12 sm:flex-row sm:gap-4">
            <Link to="/products" className="w-fit">
              <Button size="sm" className="h-10 px-6 text-[10px] sm:h-11 sm:px-8 sm:text-lg">
                Shop Now
                <ArrowRight className="ml-1 h-3 w-3 sm:ml-2 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <Link to="/group-buys" className="w-fit">
              <Button
                size="sm"
                variant="outline"
                className="h-10 border-[#ffd0a3]/90 bg-[#120a06]/35 px-6 text-[10px] text-[#ffd0a3] shadow-[0_10px_28px_-22px_rgba(255,138,51,0.75)] hover:border-[#ffe0c2] hover:bg-[#ffb066]/15 hover:text-[#ffe6cf] sm:h-11 sm:px-8 sm:text-lg"
              >
                Explore Group Buys
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="grid justify-items-start gap-1.5 sm:flex sm:flex-wrap sm:gap-6">
            <div
              className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-2 text-[10px] leading-none backdrop-blur transition-colors duration-700 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:backdrop-blur-0"
              style={{ color: activeTextTheme.badge }}
            >
              <Globe className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              <span>Ship from 20+ Countries</span>
            </div>
            <div
              className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-2 text-[10px] leading-none backdrop-blur transition-colors duration-700 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:backdrop-blur-0"
              style={{ color: activeTextTheme.badge }}
            >
              <Truck className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              <span>Flexible Shipping Options</span>
            </div>
            <div
              className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-2 text-[10px] leading-none backdrop-blur transition-colors duration-700 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:backdrop-blur-0"
              style={{ color: activeTextTheme.badge }}
            >
              <Shield className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              <span>Secure Payments</span>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
