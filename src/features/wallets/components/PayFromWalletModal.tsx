import React, { useState, useEffect } from 'react';
import {
  Wallet,
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Tent,
  ArrowRight,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { walletService } from '../services/walletService';
import { httpClient } from '../../../core/http/httpClient';

interface PayFromWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: number;
    student_name: string;
    member_code: string;
    balance?: number;
  } | null;
  onSuccess?: () => void;
}

export const PayFromWalletModal: React.FC<PayFromWalletModalProps> = ({
  isOpen,
  onClose,
  member,
  onSuccess,
}) => {
  const [payType, setPayType] = useState<'SUBSCRIPTION' | 'ACTIVITY'>('SUBSCRIPTION');
  const [subscriptionType, setSubscriptionType] = useState<'اشتراك سنوي' | 'اشتراك سنوي بالزي'>('اشتراك سنوي');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [subFee, setSubFee] = useState<number>(0);
  const [subFeeWithUniform, setSubFeeWithUniform] = useState<number>(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<number | ''>('');
  const [activityFee, setActivityFee] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && member) {
      // Fetch annual subscription fee
      httpClient
        .get<any>('/api/annual-subscriptions')
        .then((data) => {
          if (data.fee?.amount) {
            setSubFee(Number(data.fee.amount));
          }
          if (data.fee?.amount_with_uniform !== undefined && data.fee?.amount_with_uniform !== null) {
            setSubFeeWithUniform(Number(data.fee.amount_with_uniform));
          } else if (data.fee?.amount) {
            setSubFeeWithUniform(Number(data.fee.amount));
          }
          if (data.currentYear) {
            setYear(Number(data.currentYear));
          }
        })
        .catch(() => {});

      // Fetch open activities
      httpClient
        .get<any>('/api/activities')
        .then((data) => {
          const openActs = (data.activities || []).filter((a: any) => a.status !== 'ملغي');
          setActivities(openActs);
          if (openActs.length > 0) {
            setSelectedActivityId(openActs[0].id);
            setActivityFee(Number(openActs[0].fee || 0));
          }
        })
        .catch(() => {});
    }
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const currentBal = Number(member.balance || 0);
  const activeSubFee = subscriptionType === 'اشتراك سنوي بالزي' ? (subFeeWithUniform || subFee) : subFee;
  const requiredAmount = payType === 'SUBSCRIPTION' ? activeSubFee : activityFee;
  const hasSufficientBalance = currentBal >= requiredAmount && requiredAmount > 0;

  const handleActivityChange = (actId: number) => {
    setSelectedActivityId(actId);
    const found = activities.find((a) => a.id === actId);
    if (found) {
      setActivityFee(Number(found.fee || 0));
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSufficientBalance) {
      setError('رصيد المحفظة الحالي غير كافٍ لإتمام السداد');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (payType === 'SUBSCRIPTION') {
        const res = await walletService.paySubscriptionFromWallet({
          member_id: member.id,
          year,
          subscription_type: subscriptionType,
          notes,
        });
        setSuccessMsg(res.message);
      } else {
        if (!selectedActivityId) {
          setError('يرجى اختيار النشاط المراد سداد رسومه');
          return;
        }
        const res = await walletService.payActivityFromWallet({
          member_id: member.id,
          activity_id: Number(selectedActivityId),
          amount: activityFee,
          notes,
        });
        setSuccessMsg(res.message);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'فشلت عملية السداد من المحفظة');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessMsg(null);
    setError(null);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-scale-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">دفع وسداد من المحفظة الكشفية</h3>
              <p className="text-xs text-teal-100">خصم مباشر من رصيد العضو المتاح</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Balance Bar */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              {member.student_name}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono dir-ltr">
              {member.member_code}
            </span>
          </div>
          <div className="text-left">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">رصيد المحفظة</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {currentBal.toLocaleString()} ج.م
            </span>
          </div>
        </div>

        {/* Success View */}
        {successMsg ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                تم السداد بنجاح!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {successMsg}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              تم
            </button>
          </div>
        ) : (
          <form onSubmit={handlePay} className="p-4 sm:p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Payment Category Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ما الذي ترغب في سداده؟
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayType('SUBSCRIPTION')}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                    payType === 'SUBSCRIPTION'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                    الاشتراك السنوي
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    لسنة {year} ({subFee} ج.م)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPayType('ACTIVITY')}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                    payType === 'ACTIVITY'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Tent className="w-3.5 h-3.5" />
                    نشاط أو معسكر
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    رسوم المشاركة بالمعسكر
                  </span>
                </button>
              </div>
            </div>

            {/* If Subscription: Select Type (Regular vs Uniform) */}
            {payType === 'SUBSCRIPTION' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع الاشتراك السنوي
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubscriptionType('اشتراك سنوي')}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-0.5 cursor-pointer ${
                      subscriptionType === 'اشتراك سنوي'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold">اشتراك سنوي عادي</span>
                    <span className="text-xs font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                      {subFee} ج.م
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubscriptionType('اشتراك سنوي بالزي')}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-0.5 cursor-pointer ${
                      subscriptionType === 'اشتراك سنوي بالزي'
                        ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 text-teal-900 dark:text-teal-300 ring-2 ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold">اشتراك سنوي بالزي</span>
                    <span className="text-xs font-extrabold font-mono text-teal-700 dark:text-teal-400">
                      {subFeeWithUniform || subFee} ج.م
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* If Activity: Select Activity */}
            {payType === 'ACTIVITY' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اختر النشاط أو المعسكر
                </label>
                {activities.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200">
                    لا توجد أنشطة مفتوحة حالياً للتسجيل
                  </p>
                ) : (
                  <select
                    value={selectedActivityId}
                    onChange={(e) => handleActivityChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none"
                  >
                    {activities.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.name} ({act.fee} ج.م)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Payment Summary Box */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>المبلغ المطلوب خصمه:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {requiredAmount} ج.م
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>الرصيد المتاح بالمحفظة:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {currentBal.toLocaleString()} ج.م
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                <span>الرصيد المتبقي بعد السداد:</span>
                <span className={hasSufficientBalance ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600'}>
                  {hasSufficientBalance
                    ? `${(currentBal - requiredAmount).toLocaleString()} ج.م`
                    : 'الرصيد غير كافٍ'}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ملاحظات (اختياري)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="بيان إضافي..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading || !hasSufficientBalance || requiredAmount <= 0}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5"
              >
                {loading ? 'جاري السداد...' : 'تأكيد الخصم والسداد'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
