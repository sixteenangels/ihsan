import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { CategorySection } from '@/components/home/CategorySection';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { GroupBuySection } from '@/components/home/GroupBuySection';
import { RecentlyViewedProducts } from '@/components/products/RecentlyViewedProducts';
import { ResumeCheckoutBanner } from '@/components/checkout/ResumeCheckoutBanner';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <div className="container px-4 pt-6 sm:px-6">
          <ResumeCheckoutBanner />
        </div>
        <CategorySection />
        <FeaturedProducts />
        <div className="container px-4 sm:px-6">
          <RecentlyViewedProducts />
        </div>
        <GroupBuySection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
