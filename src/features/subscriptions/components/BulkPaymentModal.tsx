import React, { useState } from 'react';
import { X, CheckCircle, Users, Calendar, AlertCircle, Shirt } from 'lucide-react';
import { subscriptionsService } from '../services/subscriptionsService';
import { SubscriptionType } from '../types';

interface BulkPaymentModalProps {
  isOpen: boolean;
  year: number;
  unifiedFee: number;
  feeWithUniform?: number;
  selectedIds: number[];
  selectedNames: string[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const BulkPaymentModal: React.FC<BulkPaymentModalProps> = ({
  isOpen,
  year,
  unifiedFee,
  feeWithUniform = unifiedFee,
  selectedIds,
  selectedNames,
  onClose,
  onSuccess,
}) => {
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('اشتراك سنوي');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('سداد جماعي موحد');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentUnitPrice = subscriptionType === 'اشتراك سنوي بالزي' ? feeWithUniform : unifiedFee;
  const totalAmount = selectedIds.length * currentUnitPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    try {
      setLoading(true);
      setError(null);
      const res = await subscriptionsService.recordBulkPayment({
        year,
        member_ids: selectedIds,
        subscription_type: subscriptionType,
        payment_date: paymentDate,
        notes: notes.trim() || undefined,
      });

      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل السداد الجماعي');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        id="bulk_payment_modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">تسجيل سداد جماعي</h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">لسنة {year}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subscription Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              نوع الاشتراك السنوي <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSubscriptionType('اشتراك سنوي')}
                className={`p-3 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  subscriptionType === 'اشتراك سنوي'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="font-bold text-xs">اشتراك سنوي عادي</span>
                <span className="text-sm font-extrabold font-mono mt-1 text-emerald-700">
                  {unifiedFee} ج.م / فرد
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSubscriptionType('اشتراك سنوي بالزي')}
                className={`p-3 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  subscriptionType === 'اشتراك سنوي بالزي'
                    ? 'bg-teal-50 text-teal-900 border-teal-500 ring-2 ring-teal-500/20'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">اشتراك سنوي بالزي</span>
                  <Shirt className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <span className="text-sm font-extrabold font-mono mt-1 text-teal-700">
                  {feeWithUniform} ج.م / فرد
                </span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs">
            <div>
              <span className="text-slate-500 block">عدد الأعضاء المحددين:</span>
              <span className="text-base font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <Users className="w-4 h-4 text-emerald-600" />
                {selectedIds.length} فرد
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">إجمالي المبلغ المحصل:</span>
              <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
                {totalAmount.toLocaleString()} ج.م ({currentUnitPrice} ج.م × {selectedIds.length})
              </span>
            </div>
          </div>

          {/* Names Preview List */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              قائمة الأعضاء والقادة المحددين:
            </label>
            <div className="max-h-28 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
              {selectedNames.map((name, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-4 text-slate-400 text-[10px] font-mono">{idx + 1}.</span>
                  <span className="font-medium text-slate-800">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              تاريخ السداد الموحد <span className="text-rose-500">*</span>
            </label>
            <input
              id="input_bulk_payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات السداد الجماعي
            </label>
            <input
              id="input_bulk_payment_notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: سداد نقدي جماعي باجتماع الجمعة..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              id="btn_confirm_bulk_payment"
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? 'جاري السداد...' : `تأكيد سداد (${selectedIds.length}) فرد`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
