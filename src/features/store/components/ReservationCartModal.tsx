import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Package,
  User,
  Phone,
  FileText,
  Send,
  Sparkles,
} from 'lucide-react';
import { StoreCartItem, StoreOrder } from '../types';
import { storeService } from '../services/storeService';

interface ReservationCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: StoreCartItem[];
  onUpdateQuantity: (itemId: number, size: string | undefined, delta: number) => void;
  onRemoveItem: (itemId: number, size: string | undefined) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: StoreOrder) => void;
  currentUser?: {
    username?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    tribe_name?: string;
  };
}

export const ReservationCartModal: React.FC<ReservationCartModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
  currentUser,
}) => {
  const [buyerName, setBuyerName] = useState(
    currentUser?.full_name || currentUser?.username || ''
  );
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculations
  const totalItemsCount = cartItems.reduce((acc, itm) => acc + itm.quantity, 0);
  const totalPrice = cartItems.reduce(
    (acc, itm) => acc + Number(itm.item.price) * itm.quantity,
    0
  );

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      setError('سلة الحجز فارغة، يرجى اختيار صنف واحد على الأقل.');
      return;
    }

    if (!buyerName.trim()) {
      setError('يرجى إدخال اسم الحاجز / العضو أو القائد.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim() || undefined,
        buyer_type: currentUser?.role === 'LEADER' ? 'LEADER' : 'MEMBER',
        notes: notes.trim() || undefined,
        items: cartItems.map((ci) => ({
          item_id: ci.item.id,
          size: ci.size,
          quantity: ci.quantity,
        })),
      };

      const res = await storeService.createOrder(payload);
      onClearCart();
      onOrderSuccess(res.order);
      onClose();
    } catch (err: any) {
      console.error('Submit booking error:', err);
      setError(err.message || 'فشل تسجيل طلب الحجز، يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                سلة الحجز وإتمام الطلب
              </h2>
              <p className="text-xs text-emerald-200">
                {totalItemsCount} قطعة مختارة بإجمالي {totalPrice.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmitBooking}>
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Cart Items List */}
            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">سلة الحجز فارغة</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  قم بالضغط على أي صنف من بطاقات المتجر لاختيار المقاس والكمية وإضافتها لسلة الحجز.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    الأصناف المحجوزة ({cartItems.length} صنف):
                  </span>
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>إفراغ السلة</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 overflow-hidden bg-white">
                  {cartItems.map((item, idx) => {
                    const lineTotal = Number(item.item.price) * item.quantity;
                    return (
                      <div
                        key={`${item.item.id}-${item.size || 'default'}-${idx}`}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                      >
                        {/* Thumbnail & Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                            {item.item.image_url ? (
                              <img
                                src={item.item.image_url}
                                alt={item.item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                              {item.item.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              {item.size ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                  مقاس: {item.size}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">مقاس موحد</span>
                              )}
                              <span className="text-[11px] text-slate-500 font-bold">
                                {Number(item.item.price).toLocaleString('ar-EG')} ج.م للقطعة
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Controls & Price */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Stepper */}
                          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.item.id, item.size, -1)}
                              className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="min-w-6 text-center text-xs font-black text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={item.quantity >= item.item.stock}
                              onClick={() => onUpdateQuantity(item.item.id, item.size, 1)}
                              className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Line Total */}
                          <div className="text-left min-w-16">
                            <p className="text-xs sm:text-sm font-black text-slate-900">
                              {lineTotal.toLocaleString('ar-EG')} <span className="text-[10px] font-bold text-emerald-700">ج.م</span>
                            </p>
                          </div>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.item.id, item.size)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                            title="إزالة من السلة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Buyer Details Form */}
            {cartItems.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-700" />
                  <span>بيانات صاحب الحجز للتواصل والاستلام</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      اسم الحاجز (العضو / القائد) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="أدخل الاسم الكامل..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      رقم الهاتف للتواصل
                    </label>
                    <input
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="مثال: 01012345678"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    ملاحظات إضافية (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي ملاحظات بخصوص موعد الاستلام أو المقاسات أو التعليمات الخاصة..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 resize-none"
                  />
                </div>

                {/* Total Summary Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-between shadow-md">
                  <div>
                    <span className="text-[11px] text-slate-300 font-bold">المبلغ الإجمالي المطلوب سداده عند الاستلام:</span>
                    <p className="text-xs text-emerald-400 mt-0.5">
                      يتم السداد والاستلام من مقر إدارة الكشافة بالمدرسة
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="text-xl sm:text-2xl font-black text-white">
                      {totalPrice.toLocaleString('ar-EG')}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 mr-1">ج.م</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>

            <button
              type="submit"
              disabled={cartItems.length === 0 || isSubmitting}
              className="flex-1 py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري تسجيل الحجز...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>تأكيد وإرسال طلب الحجز ({totalPrice.toLocaleString('ar-EG')} ج.م)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
