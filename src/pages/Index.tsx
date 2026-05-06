import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { CategorySection } from '@/components/home/CategorySection';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { GroupBuySection } from '@/components/home/GroupBuySection';
import { RecentlyViewedProducts } from '@/components/products/RecentlyViewedProducts';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <CategorySection />
        <FeaturedProducts />
        <div className="container">
          <RecentlyViewedProducts />
        </div>
        <GroupBuySection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
