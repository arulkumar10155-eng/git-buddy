import { useEffect, useState } from 'react';
import { AdminLayout, StatCard } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { ShimmerStats, ShimmerTable } from '@/components/ui/shimmer';
import { DataTable, Column } from '@/components/admin/DataTable';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  Truck,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Order, Product } from '@/types/database';

interface DashboardStats {
  todaySales: number;
  totalOrders: number;
  newOrders: number;
  processingOrders: number;
  deliveredOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  totalCustomers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch products
      const { data: products } = await supabase
        .from('products')
        .select('*');

      // Fetch customers (profiles)
      const { data: customers } = await supabase
        .from('profiles')
        .select('id');

      const ordersData = (orders || []) as unknown as Order[];
      const productsData = (products || []) as unknown as Product[];
      const customersData = customers || [];

      // Calculate stats
      const todayOrders = ordersData.filter(
        (o) => new Date(o.created_at) >= today
      );
      const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const newOrders = ordersData.filter((o) => o.status === 'new').length;
      const processingOrders = ordersData.filter(
        (o) => o.status === 'confirmed' || o.status === 'packed'
      ).length;
      const deliveredOrders = ordersData.filter(
        (o) => o.status === 'delivered'
      ).length;
      const lowStock = productsData.filter(
        (p) => p.stock_quantity <= p.low_stock_threshold
      );

      setStats({
        todaySales,
        totalOrders: ordersData.length,
        newOrders,
        processingOrders,
        deliveredOrders,
        totalProducts: productsData.length,
        lowStockProducts: lowStock.length,
        totalCustomers: customersData.length,
      });

      setRecentOrders(ordersData.slice(0, 5));
      setLowStockProducts(lowStock.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const orderColumns: Column<Order>[] = [
    { key: 'order_number', header: 'Order #' },
    {
      key: 'total',
      header: 'Amount',
      render: (order) => `₹${Number(order.total).toFixed(2)}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <Badge
          variant={
            order.status === 'delivered'
              ? 'default'
              : order.status === 'cancelled'
              ? 'destructive'
              : 'secondary'
          }
        >
          {order.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (order) => new Date(order.created_at).toLocaleDateString(),
    },
  ];

  const productColumns: Column<Product>[] = [
    { key: 'name', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    {
      key: 'stock_quantity',
      header: 'Stock',
      render: (product) => (
        <span className="text-destructive font-medium">
          {product.stock_quantity}
        </span>
      ),
    },
    { key: 'low_stock_threshold', header: 'Threshold' },
  ];

  return (
    <AdminLayout
      title="Dashboard"
      description="Overview of your store performance"
    >
      {isLoading ? (
        <div className="space-y-6">
          <ShimmerStats />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ShimmerTable rows={5} columns={4} />
            <ShimmerTable rows={5} columns={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Today's Sales"
              value={`₹${stats?.todaySales.toFixed(2) || '0.00'}`}
              icon={<DollarSign className="h-5 w-5" />}
            />
            <StatCard
              title="New Orders"
              value={stats?.newOrders || 0}
              description="Awaiting confirmation"
              icon={<ShoppingCart className="h-5 w-5" />}
            />
            <StatCard
              title="Processing"
              value={stats?.processingOrders || 0}
              description="Being prepared"
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              title="Delivered"
              value={stats?.deliveredOrders || 0}
              description="Successfully delivered"
              icon={<Truck className="h-5 w-5" />}
            />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Products"
              value={stats?.totalProducts || 0}
              icon={<Package className="h-5 w-5" />}
            />
            <StatCard
              title="Low Stock Items"
              value={stats?.lowStockProducts || 0}
              description="Need attention"
              icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
            />
            <StatCard
              title="Total Customers"
              value={stats?.totalCustomers || 0}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              title="Total Orders"
              value={stats?.totalOrders || 0}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<Order>
                  columns={orderColumns}
                  data={recentOrders}
                  emptyMessage="No orders yet"
                  getRowId={(order) => order.id}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<Product>
                  columns={productColumns}
                  data={lowStockProducts}
                  emptyMessage="No low stock items"
                  getRowId={(product) => product.id}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
