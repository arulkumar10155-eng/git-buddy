import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import type { Order, OrderItem, OrderStatus, ShippingAddress, Delivery, DeliveryStatus } from '@/types/database';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ORDER_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
];

const DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending',
  'assigned',
  'picked',
  'in_transit',
  'delivered',
  'failed',
];

const statusColors: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'secondary',
  confirmed: 'default',
  packed: 'default',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  returned: 'destructive',
};

const deliveryStatusColors: Record<DeliveryStatus, string> = {
  pending: 'bg-yellow-500',
  assigned: 'bg-blue-500',
  picked: 'bg-indigo-500',
  in_transit: 'bg-purple-500',
  delivered: 'bg-green-500',
  failed: 'bg-red-500',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setOrders((data || []) as unknown as Order[]);
    }
    setIsLoading(false);
  };

  const fetchOrderDetails = async (orderId: string) => {
    const [itemsRes, deliveryRes] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', orderId),
      supabase.from('deliveries').select('*').eq('order_id', orderId).single(),
    ]);
    setOrderItems((itemsRes.data || []) as unknown as OrderItem[]);
    setDelivery(deliveryRes.data as unknown as Delivery || null);
  };

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    fetchOrderDetails(order.id);
  };

  const handleBack = () => {
    setSelectedOrder(null);
    setOrderItems([]);
    setDelivery(null);
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', selectedOrder.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Order status updated' });
      setSelectedOrder({ ...selectedOrder, status: newStatus });
      fetchOrders();
    }
    setIsUpdating(false);
  };

  const handleDeliveryUpdate = async (field: string, value: string) => {
    if (!delivery) return;
    setIsUpdatingDelivery(true);

    const updateData: Record<string, any> = { [field]: value };
    if (field === 'status' && value === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('deliveries')
      .update(updateData)
      .eq('id', delivery.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Delivery updated' });
      setDelivery({ ...delivery, ...updateData } as Delivery);
    }
    setIsUpdatingDelivery(false);
  };

  const columns: Column<Order>[] = [
    { key: 'order_number', header: 'Order #' },
    {
      key: 'total',
      header: 'Amount',
      render: (o) => `₹${Number(o.total).toFixed(2)}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <Badge variant={statusColors[o.status]}>
          {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: (o) => (
        <Badge variant={o.payment_status === 'paid' ? 'default' : 'secondary'}>
          {o.payment_status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (o) => new Date(o.created_at).toLocaleDateString(),
    },
  ];

  const getAddress = (): ShippingAddress | null => {
    if (!selectedOrder?.shipping_address) return null;
    return selectedOrder.shipping_address as ShippingAddress;
  };

  // Get delivery progress percentage
  const getDeliveryProgress = () => {
    if (!delivery) return 0;
    const statusIndex = DELIVERY_STATUSES.indexOf(delivery.status);
    return ((statusIndex + 1) / DELIVERY_STATUSES.length) * 100;
  };

  // Order detail view
  if (selectedOrder) {
    const address = getAddress();
    return (
      <AdminLayout title={`Order ${selectedOrder.order_number}`} description="View and manage order details">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Order Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Select
                    value={selectedOrder.status}
                    onValueChange={handleStatusUpdate}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Badge variant={selectedOrder.payment_status === 'paid' ? 'default' : 'secondary'}>
                    Payment: {selectedOrder.payment_status}
                  </Badge>
                  <Badge variant="outline">
                    {selectedOrder.payment_method?.toUpperCase() || 'N/A'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                {orderItems.length === 0 ? (
                  <p className="text-muted-foreground">Loading items...</p>
                ) : (
                  <div className="space-y-4">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-start p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          {item.variant_name && (
                            <p className="text-sm text-muted-foreground">{item.variant_name}</p>
                          )}
                          <p className="text-sm text-muted-foreground">SKU: {item.sku || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity} × ₹{Number(item.price).toFixed(2)}</p>
                        </div>
                        <p className="font-semibold">₹{Number(item.total).toFixed(2)}</p>
                      </div>
                    ))}
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span>-₹{Number(selectedOrder.discount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>₹{Number(selectedOrder.shipping_charge).toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>₹{Number(selectedOrder.total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Tracking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Delivery Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                {delivery ? (
                  <div className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Progress</span>
                        <span>{Math.round(getDeliveryProgress())}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${getDeliveryProgress()}%` }}
                        />
                      </div>
                    </div>

                    {/* Status Timeline */}
                    <div className="flex justify-between">
                      {DELIVERY_STATUSES.map((status, index) => {
                        const currentIndex = DELIVERY_STATUSES.indexOf(delivery.status);
                        const isCompleted = index <= currentIndex;
                        const isCurrent = index === currentIndex;
                        return (
                          <div key={status} className="flex flex-col items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              isCompleted ? deliveryStatusColors[status] : 'bg-muted'
                            } ${isCurrent ? 'ring-2 ring-offset-2 ring-primary' : ''}`}>
                              {isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-white" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className={`text-xs mt-1 ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    {/* Delivery Info Form */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Delivery Status</Label>
                        <Select
                          value={delivery.status}
                          onValueChange={(v) => handleDeliveryUpdate('status', v)}
                          disabled={isUpdatingDelivery}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DELIVERY_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Partner Name</Label>
                        <Input
                          value={delivery.partner_name || ''}
                          onChange={(e) => handleDeliveryUpdate('partner_name', e.target.value)}
                          placeholder="e.g., BlueDart, Delhivery"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tracking Number</Label>
                        <Input
                          value={delivery.tracking_number || ''}
                          onChange={(e) => handleDeliveryUpdate('tracking_number', e.target.value)}
                          placeholder="Enter tracking number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tracking URL</Label>
                        <Input
                          value={delivery.tracking_url || ''}
                          onChange={(e) => handleDeliveryUpdate('tracking_url', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    {delivery.is_cod && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          COD Amount: ₹{Number(delivery.cod_amount).toFixed(2)}
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Collected: {delivery.cod_collected ? 'Yes' : 'No'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No delivery information available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Number</span>
                    <span className="font-medium">{selectedOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{new Date(selectedOrder.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span>{new Date(selectedOrder.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {address ? (
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{address.full_name}</p>
                    <p className="text-muted-foreground">{address.address_line1}</p>
                    {address.address_line2 && <p className="text-muted-foreground">{address.address_line2}</p>}
                    <p className="text-muted-foreground">
                      {address.city}, {address.state} - {address.pincode}
                    </p>
                    {address.landmark && <p className="text-muted-foreground">Landmark: {address.landmark}</p>}
                    <p className="text-muted-foreground mt-2">Phone: {address.mobile_number}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No address available</p>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {selectedOrder.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Order Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Orders List View
  return (
    <AdminLayout
      title="Orders"
      description="View and manage customer orders"
    >
      <DataTable<Order>
        columns={columns}
        data={orders}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchable
        searchPlaceholder="Search orders..."
        searchKeys={['order_number']}
        getRowId={(o) => o.id}
        emptyMessage="No orders found."
      />
    </AdminLayout>
  );
}
