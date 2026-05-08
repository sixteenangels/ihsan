import { Link } from 'react-router-dom';
import { useCategories } from '@/hooks/useCategories';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCategoryLabel, getCategoryIconComponent } from '@/lib/categoryIcons';

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const LucideIcon = getCategoryIconComponent(name);
  return <LucideIcon className={className} />;
}

export function CategorySection() {
  const { data: categories, isLoading } = useCategories();

  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="container px-4 sm:px-6">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="mb-3 text-2xl font-bold font-serif text-foreground sm:text-3xl">
            Shop by Category
          </h2>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            Discover products from around the world, organized for easy browsing
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-card">
                  <CardContent className="p-4 text-center sm:p-6">
                    <Skeleton className="h-10 w-10 rounded-full mx-auto mb-3" />
                    <Skeleton className="h-5 w-20 mx-auto mb-2" />
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </CardContent>
                </Card>
              ))
            : categories?.map((category) => (
                <Link key={category.id} to={`/products?category=${category.name}`}>
                  <Card className="group hover:shadow-md transition-all duration-300 hover:border-primary cursor-pointer bg-card">
                    <CardContent className="p-4 text-center sm:p-6">
                      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20 sm:h-12 sm:w-12">
                        <CategoryIcon name={category.name} className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-sm">
                        {formatCategoryLabel(category.name)}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
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
