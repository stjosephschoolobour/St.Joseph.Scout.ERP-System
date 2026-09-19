import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { subscriptionsService } from '../services/subscriptionsService';

interface SubscriptionFeeModalProps {
  isOpen: boolean;
  year: number;
  currentAmount: number;
  currentAmountWithUniform?: number;
  currentDescription: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const SubscriptionFeeModal: React.FC<SubscriptionFeeModalProps> = ({
  isOpen,
  year,
  currentAmount,
  currentAmountWithUniform,
  currentDescription,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number | string>(currentAmount || '');
  const [amountWithUniform, setAmountWithUniform] = useState<number | string>(currentAmountWithUniform || '');
  const [description, setDescription] = useState(currentDescription || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(currentAmount || 0);
      setAmountWithUniform(currentAmountWithUniform !== undefined && currentAmountWithUniform !== null ? currentAmountWithUniform : (currentAmount || 0));
      setDescription(currentDescription || `الاشتراك السنوي الموحد لعام ${year}`);
      setError(null);
    }
  }, [isOpen, currentAmount, currentAmountWithUniform, currentDescription, year]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(String(amount));
    const parsedAmountWithUniform = parseFloat(String(amountWithUniform));

    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('يرجى إدخال قيمة صحيحة للاشتراك السنوي العادي');
      return;
    }
    if (isNaN(parsedAmountWithUniform) || parsedAmountWithUniform < 0) {
      setError('يرجى إدخال قيمة صحيحة للاشتراك السنوي بالزي');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await subscriptionsService.setUnifiedFee(
        year,
        parsedAmount,
        parsedAmountWithUniform,
        description.trim()
      );
      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تحديث قيمة الاشتراك السنوي');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        id="subscription_fee_modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <DollarSign className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">تحديد أسعار الاشتراكات السنوية</h2>
              <p className="text-xs text-emerald-100/90 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                لسنة {year} (اشتراك عادي / اشتراك بالزي)
              </p>
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

          {/* Rule Notice */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 leading-relaxed">
            <span className="font-bold block mb-0.5">أنواع الاشتراك السنوي:</span>
            يوجد نوعان للاشتراك: <strong>اشتراك سنوي عادي</strong> و <strong>اشتراك سنوي بالزي</strong>، ولكل نوع سعر محدد يتم اعتماده تلقائياً عند السداد أو الترحيل.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              قيمة الاشتراك السنوي العادي (ج.م) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input_unified_fee_amount"
                type="number"
                min="0"
                step="5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: 200"
                required
                autoFocus
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-left font-mono text-lg"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                ج.م
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              قيمة الاشتراك السنوي بالزي (ج.م) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input_unified_fee_uniform_amount"
                type="number"
                min="0"
                step="5"
                value={amountWithUniform}
                onChange={(e) => setAmountWithUniform(e.target.value)}
                placeholder="مثال: 350"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-left font-mono text-lg"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                ج.م
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              وصف أو بيان الاشتراك (اختياري)
            </label>
            <input
              id="input_unified_fee_description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`مثال: الاشتراك السنوي الموحد لعام ${year}`}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              id="btn_submit_unified_fee"
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ الأسعار'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
