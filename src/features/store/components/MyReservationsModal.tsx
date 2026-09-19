import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  Clock,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertCircle,
  RefreshCw,
  Package,
  FileText,
} from 'lucide-react';
import { StoreOrder } from '../types';
import { storeService } from '../services/storeService';
import { OrderReceiptModal } from './OrderReceiptModal';

interface MyReservationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParentItems?: () => void;
}

export const MyReservationsModal: React.FC<MyReservationsModalProps> = ({
  isOpen,
  onClose,
  onRefreshParentItems,
}) => {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<StoreOrder | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<StoreOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchMyOrders = async (isSilent = false) => {
    if (isSilent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await storeService.getOrders();
      setOrders(res.orders || []);
    } catch (err: any) {
      console.error('Fetch my orders error:', err);
      setError(err.message || 'فشل تحميل قائمة حجوزاتك');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMyOrders();
    }
  }, [isOpen]);

  const handleCancelOrder = (order: StoreOrder) => {
    setOrderToCancel(order);
  };

  const handleExecuteCancel = async (order: StoreOrder) => {
    setCancellingId(order.id);
    try {
      await storeService.cancelOrder(order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'CANCELLED' } : o))
      );
      setOrderToCancel(null);
      showToast(`تم إلغاء الحجز رقم (${order.order_number}) بنجاح وإعادة الكمية للمخزون`, 'success');
      if (onRefreshParentItems) onRefreshParentItems();
    } catch (err: any) {
      showToast(err.message || 'فشل إلغاء الحجز', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                حجوزاتي ومتابعة الطلبات
              </h2>
              <p className="text-xs text-emerald-200">
                متابعة حالة الحجز ومواعيد الاستلام من إدارة الكشافة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchMyOrders(true)}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">جاري تحميل طلبات الحجز الخاصة بك...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">لا توجد حجوزات سابقة</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                لم تقم بتسجيل أي حجوزات بعد. يمكنك اختيار الأصناف من المتجر وإضافتها لسلة الحجز.
              </p>
            </div>
          ) : (
            orders.map((order) => {
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
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-xs">
                        {order.order_number}
                      </span>

                      {order.status === 'PENDING' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>قيد المراجعة</span>
                        </span>
                      )}
                      {order.status === 'WAITING_PICKUP' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 flex items-center gap-1">
                          <PackageCheck className="w-3 h-3 text-blue-600" />
                          <span>جاهز للاستلام والسداد</span>
                        </span>
                      )}
                      {order.status === 'SOLD' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>تم الاستلام والبيع</span>
                        </span>
                      )}
                      {order.status === 'CANCELLED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>حجز ملغي</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formattedDate}</span>
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-slate-100 rounded-xl bg-slate-50/50 p-2.5 border border-slate-100">
                    {(order.items || []).map((itm) => (
                      <div key={itm.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{itm.item_name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {itm.size && <span className="font-bold text-emerald-700 ml-2">المقاس: {itm.size}</span>}
                            <span>الكمية: {itm.quantity} قطعة</span>
                          </p>
                        </div>
                        <span className="font-black text-slate-900">
                          {Number(itm.total_price).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-500 font-bold block">المبلغ الإجمالي المطلوب:</span>
                      <span className="text-base font-black text-emerald-700">
                        {Number(order.total_price).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptOrder(order)}
                        className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="عرض الإيصال وإرساله كصورة عبر الواتساب"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>إيصال (واتساب وصورة)</span>
                      </button>

                      {order.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={cancellingId === order.id}
                          onClick={() => handleCancelOrder(order)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer disabled:opacity-50"
                        >
                          إلغاء الحجز
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Cancel Order Confirmation Modal */}
      {orderToCancel && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <XCircle className="w-6 h-6" />
            </div>
            
            <h3 className="text-base font-black text-slate-900">
              تأكيد إلغاء حجز الطلب
            </h3>
            
            <p className="text-xs text-slate-600 mt-2 mb-5">
              هل أنت متأكد من رغبتك في إلغاء الطلب رقم <strong className="text-slate-900 font-mono">({orderToCancel.order_number})</strong>؟ سيتم إلغاء الحجز وإعادة الأصناف إلى المتجر.
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                disabled={cancellingId === orderToCancel.id}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={cancellingId === orderToCancel.id}
                onClick={() => handleExecuteCancel(orderToCancel)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {cancellingId === orderToCancel.id ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

      {/* Floating In-App Toast */}
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
