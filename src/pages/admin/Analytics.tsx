import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, ShoppingCart, TrendingUp, Users, Package, BarChart3, MousePointer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AnalyticsData {
  totalPageViews: number;
  uniqueSessions: number;
  productViews: { product_id: string; product_name: string; views: number }[];
  mostOrdered: { product_name: string; total_orders: number }[];
  pageViews: { page: string; views: number }[];
  dailyViews: { date: string; views: number }[];
  engagementByProduct: { product_id: string; product_name: string; views: number; cart_adds: number; orders: number; conversion: number }[];
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
    const since = daysAgo.toISOString();

    try {
      // Fetch analytics events
      const { data: events } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);

      // Fetch orders for most ordered
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_name, quantity')
        .gte('created_at', since);

      const eventsList = events || [];
      const pageViews = eventsList.filter(e => e.event_type === 'page_view');
      const productViewEvents = eventsList.filter(e => e.event_type === 'product_view');
      const cartAddEvents = eventsList.filter(e => e.event_type === 'add_to_cart');

      // Unique sessions
      const uniqueSessions = new Set(eventsList.map(e => e.session_id).filter(Boolean)).size;

      // Page views by page
      const pageViewsMap = new Map<string, number>();
      pageViews.forEach(e => {
        const p = e.page_path || '/';
        pageViewsMap.set(p, (pageViewsMap.get(p) || 0) + 1);
      });
      const pageViewsList = Array.from(pageViewsMap.entries())
        .map(([page, views]) => ({ page, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Product views
      const productViewsMap = new Map<string, number>();
      productViewEvents.forEach(e => {
        if (e.product_id) {
          productViewsMap.set(e.product_id, (productViewsMap.get(e.product_id) || 0) + 1);
        }
      });

      // Fetch product names for viewed products
      const productIds = Array.from(productViewsMap.keys());
      let productNames: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);
        products?.forEach(p => { productNames[p.id] = p.name; });
      }

      const productViewsList = Array.from(productViewsMap.entries())
        .map(([product_id, views]) => ({ product_id, product_name: productNames[product_id] || 'Unknown', views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Most ordered
      const orderedMap = new Map<string, number>();
      (orderItems || []).forEach(item => {
        orderedMap.set(item.product_name, (orderedMap.get(item.product_name) || 0) + item.quantity);
      });
      const mostOrdered = Array.from(orderedMap.entries())
        .map(([product_name, total_orders]) => ({ product_name, total_orders }))
        .sort((a, b) => b.total_orders - a.total_orders)
        .slice(0, 10);

      // Daily views
      const dailyMap = new Map<string, number>();
      pageViews.forEach(e => {
        const date = new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });
      const dailyViews = Array.from(dailyMap.entries()).map(([date, views]) => ({ date, views })).reverse();

      // Engagement by product
      const cartAddsMap = new Map<string, number>();
      cartAddEvents.forEach(e => {
        if (e.product_id) cartAddsMap.set(e.product_id, (cartAddsMap.get(e.product_id) || 0) + 1);
      });

      const engagementByProduct = productViewsList.map(pv => {
        const cartAdds = cartAddsMap.get(pv.product_id) || 0;
        const orders = orderedMap.get(pv.product_name) || 0;
        return {
          ...pv,
          cart_adds: cartAdds,
          orders,
          conversion: pv.views > 0 ? Math.round((orders / pv.views) * 100) : 0,
        };
      });

      setData({
        totalPageViews: pageViews.length,
        uniqueSessions: uniqueSessions,
        productViews: productViewsList,
        mostOrdered,
        pageViews: pageViewsList,
        dailyViews,
        engagementByProduct,
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to fetch analytics', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  return (
    <AdminLayout title="Analytics" description="Landing page analytics and engagement metrics">
      <div className="space-y-6">
        {/* Filter */}
        <div className="flex justify-end">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Page Views</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : data?.totalPageViews || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Visitors</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : data?.uniqueSessions || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <MousePointer className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Product Views</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : data?.productViews.reduce((s, p) => s + p.views, 0) || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Pages/Visit</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : data && data.uniqueSessions > 0 ? (data.totalPageViews / data.uniqueSessions).toFixed(1) : '0'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Views Chart (Simple bar representation) */}
        {data && data.dailyViews.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5" />
                Daily Page Views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-40">
                {data.dailyViews.map((d, i) => {
                  const maxViews = Math.max(...data.dailyViews.map(v => v.views), 1);
                  const height = (d.views / maxViews) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{d.views}</span>
                      <div className="w-full bg-primary/80 rounded-t-sm transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.date}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Most Viewed Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5" />
                Most Viewed Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : !data?.productViews.length ? (
                <p className="text-muted-foreground text-sm">No product views tracked yet. Views will appear as customers browse your store.</p>
              ) : (
                <div className="space-y-3">
                  {data.productViews.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-xs w-6 h-6 flex items-center justify-center p-0">{i + 1}</Badge>
                        <span className="text-sm truncate">{p.product_name}</span>
                      </div>
                      <Badge variant="secondary">{p.views} views</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Most Ordered Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-5 w-5" />
                Most Ordered Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : !data?.mostOrdered.length ? (
                <p className="text-muted-foreground text-sm">No orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.mostOrdered.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-xs w-6 h-6 flex items-center justify-center p-0">{i + 1}</Badge>
                        <span className="text-sm truncate">{p.product_name}</span>
                      </div>
                      <Badge>{p.total_orders} sold</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5" />
                Top Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : !data?.pageViews.length ? (
                <p className="text-muted-foreground text-sm">No page views tracked yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.pageViews.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-mono truncate max-w-[200px]">{p.page}</span>
                      <Badge variant="secondary">{p.views}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Engagement / Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5" />
                Product Engagement Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : !data?.engagementByProduct.length ? (
                <p className="text-muted-foreground text-sm">No engagement data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.engagementByProduct.map((p, i) => (
                    <div key={i} className="p-3 border rounded-lg space-y-1">
                      <p className="text-sm font-medium truncate">{p.product_name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>👁 {p.views} views</span>
                        <span>🛒 {p.cart_adds} cart</span>
                        <span>📦 {p.orders} orders</span>
                        <Badge variant={p.conversion > 5 ? "default" : "secondary"} className="text-[10px]">
                          {p.conversion}% conv
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
