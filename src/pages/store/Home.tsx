import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Truck, Shield, RefreshCw, Headphones } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOffers } from '@/hooks/useOffers';
import type { Product, Banner, Category } from '@/types/database';

function FullPageShimmer() {
  return (
    <StorefrontLayout>
      {/* Banner shimmer */}
      <Skeleton className="w-full aspect-[3/1] md:aspect-[4/1]" />
      {/* Features shimmer */}
      <div className="py-4 bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        </div>
      </div>
      {/* Categories shimmer */}
      <div className="container mx-auto px-4 py-10">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto" />
              <Skeleton className="h-4 w-16 mx-auto mt-2" />
            </div>
          ))}
        </div>
      </div>
      {/* Products shimmer */}
      <div className="container mx-auto px-4 py-10">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Bestsellers shimmer */}
      <div className="bg-muted py-10">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border overflow-hidden">
                <Skeleton className="aspect-square" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [middleBanners, setMiddleBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [bestsellerProducts, setBestsellerProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getProductOffer, isLoading: isOffersLoading } = useOffers();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentBanner((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [banners.length]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bannersRes, middleBannersRes, categoriesRes, featuredRes, bestsellersRes, newRes] = await Promise.all([
        supabase.from('banners').select('*').eq('is_active', true).eq('position', 'home_top').order('sort_order'),
        supabase.from('banners').select('*').eq('is_active', true).eq('position', 'home_middle').order('sort_order'),
        supabase.from('categories').select('*').eq('is_active', true).is('parent_id', null).order('sort_order').limit(8),
        supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).eq('is_featured', true).limit(8),
        supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).eq('is_bestseller', true).limit(8),
        supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).order('created_at', { ascending: false }).limit(8),
      ]);

      setBanners((bannersRes.data || []) as Banner[]);
      setMiddleBanners((middleBannersRes.data || []) as Banner[]);
      setCategories((categoriesRes.data || []) as Category[]);
      setFeaturedProducts((featuredRes.data || []) as Product[]);
      setBestsellerProducts((bestsellersRes.data || []) as Product[]);
      setNewArrivals((newRes.data || []) as Product[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to cart' });
      return;
    }

    try {
      let { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
      if (!cart) {
        const { data: newCart } = await supabase.from('cart').insert({ user_id: user.id }).select().single();
        cart = newCart;
      }

      if (cart) {
        const { data: existingItem } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('cart_id', cart.id)
          .eq('product_id', product.id)
          .single();

        if (existingItem) {
          await supabase.from('cart_items').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
        } else {
          await supabase.from('cart_items').insert({ cart_id: cart.id, product_id: product.id, quantity: 1 });
        }
        toast({ title: 'Added to cart', description: `${product.name} has been added to your cart` });
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({ title: 'Error', description: 'Failed to add item to cart', variant: 'destructive' });
    }
  };

  const handleAddToWishlist = async (product: Product) => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to wishlist' });
      return;
    }

    try {
      await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
      toast({ title: 'Added to wishlist', description: `${product.name} has been added to your wishlist` });
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Already in wishlist', description: 'This item is already in your wishlist' });
      } else {
        toast({ title: 'Error', description: 'Failed to add item to wishlist', variant: 'destructive' });
      }
    }
  };

  // Wait for both data and offers to load
  if (isLoading || isOffersLoading) return <FullPageShimmer />;

  return (
    <StorefrontLayout>
      {/* Hero Banner Slider */}
      {banners.length > 0 && (
        <section className="relative">
          <div className="relative overflow-hidden aspect-[3/1] md:aspect-[4/1]">
            {banners.map((banner, index) => (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-500 ${index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                <Link to={banner.redirect_url || '/products'}>
                  <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover" />
                </Link>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <>
              <Button variant="secondary" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 z-20 opacity-70 hover:opacity-100" onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}>
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button variant="secondary" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 z-20 opacity-70 hover:opacity-100" onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}>
                <ChevronRight className="h-6 w-6" />
              </Button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {banners.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${index === currentBanner ? 'bg-primary' : 'bg-white/50'}`}
                    onClick={() => setCurrentBanner(index)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Features Strip */}
      <section className="bg-muted py-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 justify-center">
              <Truck className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-sm">Free Shipping</p>
                <p className="text-xs text-muted-foreground">On orders above ₹500</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-sm">Secure Payment</p>
                <p className="text-xs text-muted-foreground">100% secure checkout</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <RefreshCw className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-sm">Easy Returns</p>
                <p className="text-xs text-muted-foreground">7-day return policy</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <Headphones className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-sm">24/7 Support</p>
                <p className="text-xs text-muted-foreground">Dedicated support</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Shop by Category</h2>
            <Button variant="ghost" asChild>
              <Link to="/products">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {categories.map((category) => (
              <Link key={category.id} to={`/products?category=${category.slug}`} className="group text-center">
                <div className="aspect-square rounded-full overflow-hidden bg-muted border-2 border-transparent group-hover:border-primary transition-colors mx-auto w-20 h-20 sm:w-24 sm:h-24">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <span className="text-2xl font-bold text-muted-foreground">{category.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {category.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="bg-muted py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Featured Products</h2>
              <Button variant="ghost" asChild>
                <Link to="/products?featured=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Middle Banners */}
      {middleBanners.length > 0 && (
        <section className="container mx-auto px-4 py-10">
          <div className={`grid gap-6 ${middleBanners.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {middleBanners.map((banner) => (
              <Card key={banner.id} className="overflow-hidden group cursor-pointer">
                <CardContent className="p-0">
                  <Link to={banner.redirect_url || '/products'}>
                    <div className="aspect-[2/1] overflow-hidden">
                      <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Fallback promo banners if no middle banners */}
      {middleBanners.length === 0 && (
        <section className="container mx-auto px-4 py-10">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="overflow-hidden group cursor-pointer">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-r from-primary to-primary/80 flex items-center p-8">
                  <div className="text-primary-foreground">
                    <p className="text-sm font-medium mb-1">SPECIAL OFFER</p>
                    <h3 className="text-2xl font-bold mb-2">Up to 50% OFF</h3>
                    <p className="text-sm opacity-90 mb-4">On selected items</p>
                    <Button variant="secondary" size="sm" asChild>
                      <Link to="/products?offer=true">Shop Now</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden group cursor-pointer">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-r from-amber-500 to-orange-500 flex items-center p-8">
                  <div className="text-white">
                    <p className="text-sm font-medium mb-1">NEW ARRIVALS</p>
                    <h3 className="text-2xl font-bold mb-2">Fresh Collection</h3>
                    <p className="text-sm opacity-90 mb-4">Just dropped this week</p>
                    <Button variant="secondary" size="sm" asChild>
                      <Link to="/products?new=true">Explore</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Bestsellers */}
      {bestsellerProducts.length > 0 && (
        <section className="container mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Best Sellers</h2>
            <Button variant="ghost" asChild>
              <Link to="/products?bestseller=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {bestsellerProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} />
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="bg-muted py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">New Arrivals</h2>
              <Button variant="ghost" asChild>
                <Link to="/products?new=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {newArrivals.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </StorefrontLayout>
  );
}
