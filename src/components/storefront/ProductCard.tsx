import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Product, Offer } from '@/types/database';

interface ProductOffer {
  offer: Offer;
  discountedPrice: number;
  discountAmount: number;
  discountLabel: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onAddToWishlist?: (product: Product) => void;
  variant?: 'default' | 'compact' | 'horizontal';
  showQuickAdd?: boolean;
  productOffer?: ProductOffer | null;
}

export function ProductCard({
  product,
  onAddToCart,
  onAddToWishlist,
  variant = 'default',
  showQuickAdd = true,
  productOffer,
}: ProductCardProps) {
  const isOutOfStock = product.stock_quantity <= 0;
  const displayPrice = productOffer?.discountedPrice ?? product.price;
  const originalPrice = productOffer ? product.price : product.mrp;
  const hasDiscount = productOffer 
    ? productOffer.discountAmount > 0 
    : (product.mrp && product.mrp > product.price);
  const discountLabel = productOffer?.discountLabel || (
    product.mrp && product.mrp > product.price 
      ? `${Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF`
      : ''
  );

  const primaryImage = product.images?.find(img => img.is_primary)?.image_url
    || product.images?.[0]?.image_url 
    || '/placeholder.svg';

  if (variant === 'horizontal') {
    return (
      <Link
        to={`/product/${product.slug}`}
        className={cn(
          "flex gap-4 p-4 bg-card rounded-lg border border-border hover:shadow-md transition-shadow group",
          isOutOfStock && "opacity-60"
        )}
      >
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
          <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary" className="text-[10px]">Sold Out</Badge>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{product.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.short_description || product.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-lg">₹{Number(displayPrice).toFixed(0)}</span>
            {hasDiscount && originalPrice && (
              <>
                <span className="text-sm text-muted-foreground line-through">₹{Number(originalPrice).toFixed(0)}</span>
                <Badge variant="destructive" className="text-xs">{discountLabel}</Badge>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className={cn(
      "group bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-all duration-300",
      variant === 'compact' && "text-sm",
      isOutOfStock && "opacity-60"
    )}>
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="block relative aspect-square overflow-hidden bg-muted">
        <img src={primaryImage} alt={product.name} className={cn("w-full h-full object-cover transition-transform duration-500", !isOutOfStock && "group-hover:scale-105")} />
        
        {/* Badges */}
        <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1">
          {isOutOfStock && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-background/80">Sold Out</Badge>
          )}
          {product.badge && !isOutOfStock && (
            <Badge className="bg-primary text-[10px] px-1.5 py-0.5">{product.badge}</Badge>
          )}
          {productOffer && !isOutOfStock && (
            <Badge variant="secondary" className="bg-green-500 text-white text-[10px] px-1.5 py-0.5">{productOffer.discountLabel}</Badge>
          )}
          {!productOffer && hasDiscount && discountLabel && !isOutOfStock && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">{discountLabel}</Badge>
          )}
          {product.is_bestseller && !isOutOfStock && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">Bestseller</Badge>
          )}
        </div>

        {/* Wishlist button */}
        {onAddToWishlist && !isOutOfStock && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            onClick={(e) => { e.preventDefault(); onAddToWishlist(product); }}
          >
            <Heart className="h-4 w-4" />
          </Button>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm font-semibold">Out of Stock</Badge>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-3">
        <Link to={`/product/${product.slug}`}>
          <h3 className={cn("font-medium text-foreground hover:text-primary transition-colors line-clamp-2", variant === 'compact' ? "text-sm" : "text-base")}>
            {product.name}
          </h3>
        </Link>

        {product.category && (
          <p className="text-xs text-muted-foreground mt-1">{product.category.name}</p>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mt-2">
          <span className={cn("font-bold text-foreground", variant === 'compact' ? "text-base" : "text-lg")}>
            ₹{Number(displayPrice).toFixed(0)}
          </span>
          {hasDiscount && originalPrice && (
            <span className="text-sm text-muted-foreground line-through">₹{Number(originalPrice).toFixed(0)}</span>
          )}
        </div>

        {/* Quick add button */}
        {showQuickAdd && onAddToCart && !isOutOfStock && (
          <Button
            className="w-full mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
            size={variant === 'compact' ? 'sm' : 'default'}
            onClick={() => onAddToCart(product)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        )}
        {isOutOfStock && (
          <Button className="w-full mt-3" size={variant === 'compact' ? 'sm' : 'default'} variant="secondary" disabled>
            Out of Stock
          </Button>
        )}
      </div>
    </div>
  );
}
