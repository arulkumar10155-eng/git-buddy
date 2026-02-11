import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle, Clock, XCircle,
  Loader2, Download, RefreshCw, Search
} from 'lucide-react';
import type { Order, OrderItem, OrderStatus, ShippingAddress, Delivery, DeliveryStatus, Payment } from '@/types/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';

const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const DELIVERY_STATUSES: DeliveryStatus[] = ['pending', 'assigned', 'picked', 'in_transit', 'delivered', 'failed'];

const statusColors: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'secondary', confirmed: 'default', packed: 'default', shipped: 'default',
  delivered: 'default', cancelled: 'destructive', returned: 'destructive',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setOrders((data || []) as unknown as Order[]);
    setIsLoading(false);
  };

  const fetchOrderDetails = async (orderId: string) => {
    const [itemsRes, deliveryRes, paymentsRes] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', orderId),
      supabase.from('deliveries').select('*').eq('order_id', orderId).single(),
      supabase.from('payments').select('*').eq('order_id', orderId),
    ]);
    setOrderItems((itemsRes.data || []) as unknown as OrderItem[]);
    setDelivery(deliveryRes.data as unknown as Delivery || null);
    setPayments((paymentsRes.data || []) as unknown as Payment[]);
  };

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    fetchOrderDetails(order.id);
  };

  const handleBack = () => {
    setSelectedOrder(null);
    setOrderItems([]);
    setDelivery(null);
    setPayments([]);
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Status updated' });
      setSelectedOrder({ ...selectedOrder, status: newStatus });
      fetchOrders();
    }
    setIsUpdating(false);
  };

  const handleDeliveryUpdate = async (field: string, value: string) => {
    if (!delivery) return;
    setIsUpdatingDelivery(true);
    const updateData: Record<string, any> = { [field]: value };
    if (field === 'status' && value === 'delivered') updateData.delivered_at = new Date().toISOString();
    const { error } = await supabase.from('deliveries').update(updateData).eq('id', delivery.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Delivery updated' });
      setDelivery({ ...delivery, ...updateData } as Delivery);
    }
    setIsUpdatingDelivery(false);
  };

  const handleRefund = async () => {
    if (!selectedOrder || !refundAmount) return;
    setIsRefunding(true);
    const { error } = await supabase.from('payments').insert({
      order_id: selectedOrder.id,
      amount: -Number(refundAmount),
      method: selectedOrder.payment_method || 'online',
      status: 'refunded',
      refund_amount: Number(refundAmount),
      refund_reason: refundReason || null,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      await supabase.from('orders').update({ payment_status: 'refunded' }).eq('id', selectedOrder.id);
      toast({ title: 'Refund processed' });
      setSelectedOrder({ ...selectedOrder, payment_status: 'refunded' });
      setRefundDialogOpen(false);
      setRefundAmount('');
      setRefundReason('');
      fetchOrderDetails(selectedOrder.id);
      fetchOrders();
    }
    setIsRefunding(false);
  };

  const getAddress = (): ShippingAddress | null => {
    if (!selectedOrder?.shipping_address) return null;
    return selectedOrder.shipping_address as ShippingAddress;
  };

  const generateInvoicePDF = () => {
    if (!selectedOrder) return;
    const doc = new jsPDF();
    const addr = getAddress();
    
    // Header
    doc.setFontSize(18);
    doc.text('INVOICE', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Order #: ${selectedOrder.order_number}`, 15, 35);
    doc.text(`Date: ${new Date(selectedOrder.created_at).toLocaleDateString('en-IN')}`, 15, 42);
    doc.text(`Status: ${selectedOrder.status.toUpperCase()}`, 15, 49);
    doc.text(`Payment: ${selectedOrder.payment_status?.toUpperCase()} (${selectedOrder.payment_method?.toUpperCase() || 'N/A'})`, 15, 56);

    // Shipping address
    if (addr) {
      doc.setFontSize(11);
      doc.text('Ship To:', 130, 35);
      doc.setFontSize(9);
      doc.text(addr.full_name, 130, 42);
      doc.text(addr.address_line1, 130, 48);
      if (addr.address_line2) doc.text(addr.address_line2, 130, 54);
      doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, 130, addr.address_line2 ? 60 : 54);
      doc.text(`Phone: ${addr.mobile_number}`, 130, addr.address_line2 ? 66 : 60);
    }

    // Items table header
    let y = 75;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 15, y);
    doc.text('Variant', 90, y);
    doc.text('Qty', 130, y);
    doc.text('Price', 150, y);
    doc.text('Total', 175, y);
    y += 3;
    doc.line(15, y, 195, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    orderItems.forEach((item) => {
      doc.text(item.product_name.substring(0, 40), 15, y);
      doc.text(item.variant_name || '-', 90, y);
      doc.text(String(item.quantity), 130, y);
      doc.text(`₹${Number(item.price).toFixed(2)}`, 150, y);
      doc.text(`₹${Number(item.total).toFixed(2)}`, 175, y);
      y += 7;
    });

    // Totals
    y += 5;
    doc.line(130, y, 195, y);
    y += 7;
    doc.text('Subtotal:', 130, y); doc.text(`₹${Number(selectedOrder.subtotal).toFixed(2)}`, 175, y); y += 6;
    doc.text('Discount:', 130, y); doc.text(`-₹${Number(selectedOrder.discount).toFixed(2)}`, 175, y); y += 6;
    doc.text('Shipping:', 130, y); doc.text(`₹${Number(selectedOrder.shipping_charge).toFixed(2)}`, 175, y); y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', 130, y); doc.text(`₹${Number(selectedOrder.total).toFixed(2)}`, 175, y);

    doc.save(`Invoice-${selectedOrder.order_number}.pdf`);
  };

  const generateChallanPDF = () => {
    if (!selectedOrder) return;
    const doc = new jsPDF();
    const addr = getAddress();

    doc.setFontSize(16);
    doc.text('DELIVERY CHALLAN', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Order #: ${selectedOrder.order_number}`, 15, 35);
    doc.text(`Date: ${new Date(selectedOrder.created_at).toLocaleDateString('en-IN')}`, 15, 42);

    if (addr) {
      doc.setFontSize(11);
      doc.text('Deliver To:', 15, 55);
      doc.setFontSize(10);
      doc.text(addr.full_name, 15, 63);
      doc.text(addr.address_line1, 15, 70);
      if (addr.address_line2) doc.text(addr.address_line2, 15, 77);
      let ay = addr.address_line2 ? 84 : 77;
      doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, 15, ay);
      doc.text(`Phone: ${addr.mobile_number}`, 15, ay + 7);
      if (addr.landmark) doc.text(`Landmark: ${addr.landmark}`, 15, ay + 14);
    }

    let y = 110;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('S.No', 15, y);
    doc.text('Item', 30, y);
    doc.text('Variant', 110, y);
    doc.text('Qty', 160, y);
    y += 3;
    doc.line(15, y, 195, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    orderItems.forEach((item, idx) => {
      doc.text(String(idx + 1), 15, y);
      doc.text(item.product_name.substring(0, 45), 30, y);
      doc.text(item.variant_name || '-', 110, y);
      doc.text(String(item.quantity), 160, y);
      y += 7;
    });

    if (delivery?.is_cod) {
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text(`COD Amount to Collect: ₹${Number(delivery.cod_amount).toFixed(2)}`, 15, y);
    }

    y += 20;
    doc.text('Received By: ___________________', 15, y);
    doc.text('Date: ___________________', 120, y);

    doc.save(`Challan-${selectedOrder.order_number}.pdf`);
  };

  const filteredOrders = orders.filter(o =>
    o.order_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Order detail view
  if (selectedOrder) {
    const address = getAddress();
    return (
      <AdminLayout title={`Order ${selectedOrder.order_number}`} description="Manage order details">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={handleBack} size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateInvoicePDF}>
              <Download className="h-4 w-4 mr-1" /> Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={generateChallanPDF}>
              <Download className="h-4 w-4 mr-1" /> Challan
            </Button>
            <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" /> Refund
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Process Refund</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Refund Amount (Max: ₹{Number(selectedOrder.total).toFixed(2)})</Label>
                    <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="Enter amount" max={Number(selectedOrder.total)} />
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Refund reason" rows={3} />
                  </div>
                  <Button onClick={handleRefund} disabled={isRefunding || !refundAmount} className="w-full">
                    {isRefunding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Process Refund
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Status */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={selectedOrder.status} onValueChange={handleStatusUpdate} disabled={isUpdating}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {/* Payment status - editable for COD */}
                  {selectedOrder.payment_method === 'cod' ? (
                    <Select
                      value={selectedOrder.payment_status}
                      onValueChange={async (val) => {
                        const typedVal = val as 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
                        await supabase.from('orders').update({ payment_status: typedVal }).eq('id', selectedOrder.id);
                        // Also update payment record
                        const { data: paymentRecord } = await supabase.from('payments').select('id').eq('order_id', selectedOrder.id).eq('method', 'cod').single();
                        if (paymentRecord) {
                          await supabase.from('payments').update({ status: typedVal }).eq('id', paymentRecord.id);
                        }
                        setSelectedOrder({ ...selectedOrder, payment_status: typedVal });
                        fetchOrders();
                        toast({ title: 'Payment status updated' });
                      }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Received</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={selectedOrder.payment_status === 'paid' ? 'default' : 'secondary'}>
                      Payment: {selectedOrder.payment_status}
                    </Badge>
                  )}
                  <Badge variant="outline">{selectedOrder.payment_method?.toUpperCase() || 'N/A'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-base">Order Items</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{item.product_name}</p>
                        {item.variant_name && (
                          <Badge variant="outline" className="text-xs mt-0.5">Variant: {item.variant_name}</Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.sku || 'N/A'} · Qty: {item.quantity} × ₹{Number(item.price).toFixed(2)}</p>
                      </div>
                      <p className="font-semibold text-sm">₹{Number(item.total).toFixed(2)}</p>
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-₹{Number(selectedOrder.discount).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>₹{Number(selectedOrder.shipping_charge).toFixed(2)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-bold"><span>Total</span><span>₹{Number(selectedOrder.total).toFixed(2)}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery */}
            {delivery && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select value={delivery.status} onValueChange={v => handleDeliveryUpdate('status', v)} disabled={isUpdatingDelivery}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DELIVERY_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Partner</Label>
                      <Input className="h-9" value={delivery.partner_name || ''} onChange={e => handleDeliveryUpdate('partner_name', e.target.value)} placeholder="BlueDart, Delhivery" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tracking #</Label>
                      <Input className="h-9" value={delivery.tracking_number || ''} onChange={e => handleDeliveryUpdate('tracking_number', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tracking URL</Label>
                      <Input className="h-9" value={delivery.tracking_url || ''} onChange={e => handleDeliveryUpdate('tracking_url', e.target.value)} />
                    </div>
                  </div>
                  {delivery.is_cod && (
                    <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs">
                      <span className="font-medium text-amber-800 dark:text-amber-200">COD: ₹{Number(delivery.cod_amount).toFixed(2)}</span>
                      <span className="ml-2 text-amber-700 dark:text-amber-300">Collected: {delivery.cod_collected ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Refund history */}
            {payments.filter(p => p.status === 'refunded').length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-base">Refund History</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {payments.filter(p => p.status === 'refunded').map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-destructive/5 rounded text-sm">
                      <div>
                        <p className="font-medium">₹{Number(p.refund_amount).toFixed(2)}</p>
                        {p.refund_reason && <p className="text-xs text-muted-foreground">{p.refund_reason}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Summary</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span className="font-medium">{selectedOrder.order_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(selectedOrder.created_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{new Date(selectedOrder.created_at).toLocaleTimeString()}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Shipping</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4">
                {address ? (
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium">{address.full_name}</p>
                    <p className="text-muted-foreground">{address.address_line1}</p>
                    {address.address_line2 && <p className="text-muted-foreground">{address.address_line2}</p>}
                    <p className="text-muted-foreground">{address.city}, {address.state} - {address.pincode}</p>
                    <p className="text-muted-foreground mt-1">Ph: {address.mobile_number}</p>
                  </div>
                ) : <p className="text-muted-foreground text-sm">No address</p>}
              </CardContent>
            </Card>

            {selectedOrder.notes && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Orders grid view
  return (
    <AdminLayout title="Orders" description="View and manage customer orders">
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-lg h-40" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No orders found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredOrders.map((order) => {
            const items = (order as any).order_items || [];
            return (
              <Card
                key={order.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRowClick(order)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{order.order_number}</span>
                    <Badge variant={statusColors[order.status]} className="text-[10px]">
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-xl font-bold">₹{Number(order.total).toFixed(0)}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant={order.payment_status === 'paid' ? 'default' : 'outline'} className="text-[10px]">
                      {order.payment_status}
                    </Badge>
                    <span>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  {/* Show item count and variant info */}
                  <div className="text-xs text-muted-foreground border-t pt-2 mt-1">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                    {items.some((i: any) => i.variant_name) && (
                      <span className="ml-1">
                        ({items.filter((i: any) => i.variant_name).map((i: any) => i.variant_name).join(', ')})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}