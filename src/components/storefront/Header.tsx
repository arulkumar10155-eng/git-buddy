import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Category, StoreInfo } from '@/types/database';

interface AnnouncementSettings {
  text: string;
  is_active: boolean;
  link?: string;
}

export function Header() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [announcement, setAnnouncement] = useState<AnnouncementSettings | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, signOut } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (user) fetchCartCount();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    const [categoriesRes, storeRes, announcementRes] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .is('parent_id', null)
        .order('sort_order'),
      supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'store_info')
        .single(),
      supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'announcement')
        .single(),
    ]);
    
    setCategories((categoriesRes.data || []) as Category[]);
    if (storeRes.data) setStoreInfo(storeRes.data.value as unknown as StoreInfo);
    if (announcementRes.data) setAnnouncement(announcementRes.data.value as unknown as AnnouncementSettings);
    setIsLoading(false);
  };

  const fetchCartCount = async () => {
    if (!user) return;
    const { data: cart } = await supabase
      .from('cart')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (cart) {
      const { count } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true })
        .eq('cart_id', cart.id);
      setCartCount(count || 0);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      {/* Top announcement bar */}
      {announcement?.is_active && announcement?.text && (
        <div className="bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 py-1.5 text-center text-sm">
            {announcement.link ? (
              <Link to={announcement.link} className="hover:underline">
                {announcement.text}
              </Link>
            ) : (
              announcement.text
            )}
          </div>
        </div>
      )}

      {/* Main header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <nav className="flex flex-col gap-4 mt-6">
                <Link to="/" className="text-lg font-semibold">Home</Link>
                <Link to="/products" className="text-lg font-semibold">All Products</Link>
                {categories.map((cat) => (
                  <Link key={cat.id} to={`/products?category=${cat.slug}`} className="text-muted-foreground">
                    {cat.name}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : storeInfo?.logo_url ? (
              <img src={storeInfo.logo_url} alt={storeInfo.name} className="h-10" />
            ) : (
              <span className="text-2xl font-bold text-primary">{storeInfo?.name || 'Store'}</span>
            )}
          </Link>

          {/* Desktop search */}
          <GlobalSearch className="hidden lg:block flex-1 max-w-xl" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              {isSearchOpen ? <X className="h-5 w-5" /> : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </Button>

            {user && (
              <Button variant="ghost" size="icon" asChild>
                <Link to="/wishlist">
                  <Heart className="h-5 w-5" />
                </Link>
              </Button>
            )}

            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="/cart">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {cartCount}
                  </Badge>
                )}
              </Link>
            </Button>

            {user ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                  <Link to="/account">
                    <User className="h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:flex">
                  Logout
                </Button>
              </div>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Login</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile search bar */}
        {isSearchOpen && (
          <div className="lg:hidden mt-3">
            <GlobalSearch onClose={() => setIsSearchOpen(false)} autoFocus />
          </div>
        )}
      </div>

      {/* Desktop navigation */}
      <nav className="hidden lg:block border-t border-border">
        <div className="container mx-auto px-4">
          <ul className="flex items-center gap-6 py-2">
            <li>
              <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">
                All Products
              </Link>
            </li>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i}><Skeleton className="h-4 w-16" /></li>
              ))
            ) : (
              categories.slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/products?category=${cat.slug}`}
                    className="text-sm font-medium hover:text-primary transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
}
