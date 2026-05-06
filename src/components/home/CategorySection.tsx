import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { icons } from 'lucide-react';
import { getCategoryIconName } from '@/lib/categoryIcons';

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const iconName = getCategoryIconName(name);
  const LucideIcon = (icons as any)[iconName] || icons.Package;
  return <LucideIcon className={className} />;
}

export function CategorySection() {
  const { data: categories, isLoading } = useCategories();

  return (
    <section className="py-16 bg-background">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold font-serif text-foreground mb-3">
            Shop by Category
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Discover products from around the world, organized for easy browsing
          </p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-card">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <Skeleton className="h-10 w-10 rounded-full mx-auto mb-3" />
                    <Skeleton className="h-5 w-20 mx-auto mb-2" />
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </CardContent>
                </Card>
              ))
            : categories?.map((category) => (
                <Link key={category.id} to={`/products?category=${category.name}`}>
                  <Card className="group hover:shadow-md transition-all duration-300 hover:border-primary cursor-pointer bg-card">
                    <CardContent className="p-3 sm:p-6 text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors">
                        <CategoryIcon name={category.name} className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground text-xs sm:text-sm group-hover:text-primary transition-colors leading-tight">
                        {category.name}
                      </h3>
                      <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5">
                        ({category.product_count || 0})
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}
