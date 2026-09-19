import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ClipboardList,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  PackageCheck,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Printer,
  Trash2,
  User,
  Phone,
  Calendar,
  XCircle,
  Package,
  FileText,
} from 'lucide-react';
import { StoreOrder, StoreOrderStatus } from '../types';
import { storeService } from '../services/storeService';
import { OrderReceiptModal } from './OrderReceiptModal';

interface ReservationsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParentItems?: () => void;
}

export const ReservationsManagerModal: React.FC<ReservationsManagerModalProps> = ({
  isOpen,
  onClose,
  onRefreshParentItems,
}) => {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | StoreOrderStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order for Receipt & WhatsApp sharing
  const [receiptOrder, setReceiptOrder] = useState<StoreOrder | null>(null);

  // In-app Action Modals (Replaces window.confirm to guarantee compatibility in iframe & mobile)
  const [orderToPay, setOrderToPay] = useState<StoreOrder | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<StoreOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchOrders = async (isSilent = false) => {
    if (isSilent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await storeService.getOrders();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Fetch orders error:', err);
      setError(err.message || 'فشل تحميل قائمة الحجوزات والطلبات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      // Search
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const matchNum = order.order_number.toLowerCase().includes(q);
      const matchBuyer = order.buyer_name.toLowerCase().includes(q);
      const matchPhone = (order.buyer_phone || '').includes(q);
      const matchItems = (order.items || []).some((itm) =>
        itm.item_name.toLowerCase().includes(q)
      );

      return matchNum || matchBuyer || matchPhone || matchItems;
    });
  }, [orders, statusFilter, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    let pending = 0;
    let waiting = 0;
    let sold = 0;
    let cancelled = 0;

    orders.forEach((o) => {
      if (o.status === 'PENDING') pending++;
      else if (o.status === 'WAITING_PICKUP') waiting++;
      else if (o.status === 'SOLD') sold++;
      else if (o.status === 'CANCELLED') cancelled++;
    });

    return { all: orders.length, pending, waiting, sold, cancelled };
  }, [orders]);

  // Confirm Reservation -> Moves to WAITING_PICKUP
  const handleConfirmOrder = async (orderId: number) => {
    setActionLoadingId(orderId);
    try {
      const res = await storeService.confirmOrder(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? res.order : o))
      );
      showToast('تم تأكيد الحجز بنجاح وتحويله إلى "في انتظار الاستلام"', 'success');
      if (onRefreshParentItems) onRefreshParentItems();
    } catch (err: any) {
      showToast(err.message || 'فشل تأكيد الحجز', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Pay Order -> Opens confirmation modal
  const handlePayOrder = (order: StoreOrder) => {
    setOrderToPay(order);
  };

  // Execute Payment after confirmation
  const handleExecutePay = async (order: StoreOrder) => {
    setActionLoadingId(order.id);
    try {
      const res = await storeService.payOrder(order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? res.order : o))
      );
      setOrderToPay(null);
      showToast(
        `تم تسجيل سداد الطلب (${order.order_number}) بنجاح وتحويله إلى "تم البيع"`,
        'success'
      );
      if (onRefreshParentItems) onRefreshParentItems();
    } catch (err: any) {
      console.error('Payment error:', err);
      showToast(err.message || 'فشل تسجيل السداد', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel Order -> Opens cancellation modal
  const handleCancelOrder = (order: StoreOrder) => {
    setOrderToCancel(order);
  };

  // Execute Cancel after confirmation
  const handleExecuteCancel = async (order: StoreOrder) => {
    setActionLoadingId(order.id);
    try {
      await storeService.cancelOrder(order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'CANCELLED' } : o))
      );
      setOrderToCancel(null);
      showToast(
        `تم إلغاء الطلب (${order.order_number}) وإرجاع الكميات تلقائياً إلى المخزون المتاح`,
        'success'
      );
      if (onRefreshParentItems) onRefreshParentItems();
    } catch (err: any) {
      console.error('Cancel order error:', err);
      showToast(err.message || 'فشل إلغاء الحجز', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Receipt & WhatsApp Share Modal
  const handlePrintReceipt = (order: StoreOrder) => {
    setReceiptOrder(order);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  إدارة عمليات الحجز وتأكيد الطلبات
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  {orders.length} طلب
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تأكيد الحجوزات، تحويلها إلى انتظار الاستلام، وتسجيل السداد والبيع
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3 shrink-0">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>الكل</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قيد الانتظار (جديد)</span>
              {counts.pending > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                  {counts.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatusFilter('WAITING_PICKUP')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'WAITING_PICKUP'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-800 border border-blue-200 hover:bg-blue-50'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>في انتظار الاستلام</span>
              {counts.waiting > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px]">
                  {counts.waiting}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatusFilter('SOLD')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'SOLD'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم البيع</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">
                {counts.sold}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'CANCELLED'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>ملغي</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {counts.cancelled}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full">
            <input
              type="text"
              placeholder="بحث برقم الحجز، اسم صاحب الطلب، الهاتف، أو الصنف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Orders List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">جاري تحميل سجلات الحجوزات...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ClipboardList className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">لا توجد حجوزات مطابقة</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                لم يتم العثور على أي طلبات حجز تحت هذا التصنيف أو معايير البحث الحالية.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isActionLoading = actionLoadingId === order.id;
              const formattedDate = new Date(order.created_at).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={order.id}
                  id={`order-card-${order.id}`}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition overflow-hidden"
                >
                  {/* Order Card Header */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-xl bg-slate-900 text-white font-black text-xs tracking-wider">
                        {order.order_number}
                      </span>

                      {/* Status Badges */}
                      {order.status === 'PENDING' && (
                        <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>قيد الانتظار (حجز جديد)</span>
                        </span>
                      )}
                      {order.status === 'WAITING_PICKUP' && (
                        <span className="px-3 py-1 rounded-xl bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 flex items-center gap-1.5">
                          <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>في انتظار الاستلام</span>
                        </span>
                      )}
                      {order.status === 'SOLD' && (
                        <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تم البيع والتسليم</span>
                        </span>
                      )}
                      {order.status === 'CANCELLED' && (
                        <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>حجز ملغي</span>
                        </span>
                      )}

                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>

                    {/* Buyer Information Badges */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 font-black text-slate-900">
                        <User className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{order.buyer_name}</span>
                        {order.buyer_type && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                            {order.buyer_type === 'LEADER' ? 'قائد' : 'عضو'}
                          </span>
                        )}
                      </div>

                      {order.buyer_phone && (
                        <div className="flex items-center gap-1 text-slate-600 font-bold" dir="ltr">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{order.buyer_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items List in this Order */}
                  <div className="p-4 space-y-3">
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden bg-slate-50/40">
                      {(order.items || []).map((itm) => (
                        <div key={itm.id} className="p-2.5 sm:p-3 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                              {itm.image_url ? (
                                <img
                                  src={itm.image_url}
                                  alt={itm.item_name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{itm.item_name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                {itm.size && (
                                  <span className="text-emerald-700 font-bold">
                                    مقاس: {itm.size}
                                  </span>
                                )}
                                <span>سعر القطعة: {Number(itm.unit_price).toLocaleString('ar-EG')} ج.م</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <span className="px-2 py-0.5 rounded-md bg-slate-200/80 font-bold text-slate-800 text-xs">
                              {itm.quantity} قطعة
                            </span>
                            <span className="font-black text-slate-900 text-xs sm:text-sm min-w-16 text-left">
                              {Number(itm.total_price).toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes if present */}
                    {order.notes && (
                      <p className="text-xs text-slate-600 bg-amber-50/60 border border-amber-200/60 p-2.5 rounded-xl">
                        <span className="font-bold text-amber-900">ملاحظات: </span>
                        {order.notes}
                      </p>
                    )}

                    {/* Footer: Price Summary & Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-[11px] text-slate-400 font-bold block">إجمالي عدد القطع:</span>
                          <span className="text-xs font-black text-slate-800">{order.total_items} قطعة</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200" />
                        <div>
                          <span className="text-[11px] text-slate-400 font-bold block">المبلغ الإجمالي:</span>
                          <span className="text-base font-black text-emerald-700">
                            {Number(order.total_price).toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                      </div>

                      {/* Dynamic Action Buttons based on status */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Print / WhatsApp Receipt button */}
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(order)}
                          className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="عرض الإيصال وتحويله لصورة وإرساله عبر الواتساب"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>إيصال (صورة / واتساب)</span>
                        </button>

                        {/* If PENDING: Show Confirm Button */}
                        {order.status === 'PENDING' && (
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleConfirmOrder(order.id)}
                            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            <PackageCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>تأكيد الحجز (في انتظار الاستلام)</span>
                          </button>
                        )}

                        {/* If WAITING_PICKUP or PENDING: Show Pay Button */}
                        {(order.status === 'WAITING_PICKUP' || order.status === 'PENDING') && (
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handlePayOrder(order)}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                          >
                            <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>السداد (تحويل إلى تم البيع)</span>
                          </button>
                        )}

                        {/* Cancel order button if not already completed/cancelled */}
                        {order.status !== 'SOLD' && order.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleCancelOrder(order)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer disabled:opacity-50"
                          >
                            <span>إلغاء</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>يتم تحديث المخزون وحسابات المبيعات تلقائياً مع كل حركة تأكيد أو سداد.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* Confirm Payment Modal (Works 100% in Mobile & iframe) */}
      {orderToPay && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm">
              <DollarSign className="w-7 h-7 stroke-[2.5]" />
            </div>
            
            <h3 className="text-lg font-black text-slate-900">
              تأكيد سداد الطلب واستلام المبلغ
            </h3>
            
            <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-right space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">رقم الحجز:</span>
                <span className="font-bold text-slate-800 font-mono">{orderToPay.order_number}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">اسم المشتري:</span>
                <span className="font-bold text-slate-900">{orderToPay.buyer_name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">عدد القطع:</span>
                <span className="font-bold text-slate-800">{orderToPay.total_items} قطعة</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs text-slate-600 font-bold">المبلغ المطلوب تحصيله:</span>
                <span className="text-base font-black text-emerald-700">
                  {Number(orderToPay.total_price).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-6">
              بالتأكيد، سيتم تحويل حالة الطلب إلى <strong className="text-emerald-700">"تم البيع"</strong>، وإضافة المبلغ إلى سجل المبيعات الرسمية.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setOrderToPay(null)}
                disabled={actionLoadingId === orderToPay.id}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={actionLoadingId === orderToPay.id}
                onClick={() => handleExecutePay(orderToPay)}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === orderToPay.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري التسجيل...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد السداد والبيع</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancellation Modal (Works 100% in Mobile & iframe) */}
      {orderToCancel && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-sm">
              <Trash2 className="w-7 h-7" />
            </div>
            
            <h3 className="text-lg font-black text-slate-900">
              إلغاء طلب الحجز وإعادة المخزون
            </h3>
            
            <p className="text-xs text-slate-600 mt-2 mb-6">
              هل أنت متأكد من رغبتك في إلغاء الطلب رقم <strong className="text-slate-900 font-mono">({orderToCancel.order_number})</strong> الخاص بـ <strong className="text-slate-900">"{orderToCancel.buyer_name}"</strong>؟
              <br />
              <span className="text-emerald-700 font-bold block mt-2">
                سيتم استرجاع جميع القطع المحجوزة تلقائياً إلى مخزون المتجر المتاح.
              </span>
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                disabled={actionLoadingId === orderToCancel.id}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={actionLoadingId === orderToCancel.id}
                onClick={() => handleExecuteCancel(orderToCancel)}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === orderToCancel.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري الإلغاء...</span>
                  </>
                ) : (
                  <span>تأكيد الإلغاء</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating In-App Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-70 animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-none" dir="rtl">
          <div
            className={`px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold text-white ${
              toast.type === 'success'
                ? 'bg-emerald-900/95 border-emerald-700 shadow-emerald-950/40'
                : 'bg-rose-900/95 border-rose-700 shadow-rose-950/40'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Official Receipt & WhatsApp Share Modal */}
      <OrderReceiptModal
        isOpen={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(null)}
        order={receiptOrder}
      />
    </div>
  );
};
