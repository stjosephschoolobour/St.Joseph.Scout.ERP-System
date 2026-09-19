import React, { useState } from 'react';
import {
  X,
  Sliders,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { WalletMember, AdjustWalletRequest } from '../types';
import { walletService } from '../services/walletService';

interface WalletAdjustModalProps {
  member: WalletMember;
  onClose: () => void;
  onSuccess: (updatedBalance: number) => void;
}

export const WalletAdjustModal: React.FC<WalletAdjustModalProps> = ({
  member,
  onClose,
  onSuccess,
}) => {
  const [actionType, setActionType] = useState<'ADD' | 'DEDUCT' | 'REFUND'>('ADD');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    message: string;
    balance: number;
    receiptNumber: string;
  } | null>(null);

  const currentBal = Number(member.balance || 0);
  const parsedAmount = parseFloat(amount) || 0;

  // Calculate preview of new balance
  let previewBalance = currentBal;
  if (parsedAmount > 0) {
    if (actionType === 'ADD' || actionType === 'REFUND') {
      previewBalance = currentBal + parsedAmount;
    } else {
      previewBalance = Math.max(0, currentBal - parsedAmount);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parsedAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    if (actionType === 'DEDUCT' && parsedAmount > currentBal) {
      setError(`الرصيد الحالي (${currentBal} ج.م) لا يكفي لخصم (${parsedAmount} ج.م)`);
      return;
    }
    if (!reason.trim()) {
      setError('يرجى توضيح سبب التعديل أو التحكم بالرصيد للتوثيق والتدقيق');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: AdjustWalletRequest = {
        member_id: member.id,
        type: actionType === 'REFUND' ? 'REFUND' : 'ADJUSTMENT',
        amount: parsedAmount,
        reason: reason.trim(),
        direction: actionType === 'ADD' || actionType === 'REFUND' ? 'ADD' : 'DEDUCT',
      };

      const res = await walletService.adjustWallet(payload);
      setSuccessData({
        message: res.message,
        balance: res.balance,
        receiptNumber: res.receiptNumber,
      });
      onSuccess(res.balance);
    } catch (err: any) {
      setError(err.message || 'فشل تنفيذ عملية التحكم بالرصيد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-1.5">
                التحكم وتسوية رصيد المحفظة
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 font-bold">
                  إدارة مالية
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                تعديل الرصيد، التسوية المباشرة، أو استرداد مبالغ للمحفظة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Member Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {member.student_name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  <span>{member.member_code}</span>
                  <span>•</span>
                  <span>{member.member_type}</span>
                  {member.tribe_name && (
                    <>
                      <span>•</span>
                      <span>{member.tribe_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block font-bold">الرصيد الحالي</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {currentBal.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </span>
            </div>
          </div>

          {/* Success State */}
          {successData ? (
            <div className="py-4 space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  تم تعديل وتحكم الرصيد بنجاح!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {successData.message}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم الإيصال / المعاملة:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {successData.receiptNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الرصيد الجديد بالمحفظة:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {successData.balance.toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع عملية التحكم والتسوية <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionType('ADD');
                      setError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                      actionType === 'ADD'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>إضافة / تسوية (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionType('DEDUCT');
                      setError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                      actionType === 'DEDUCT'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-500 ring-2 ring-rose-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>خصم / سحب (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionType('REFUND');
                      setError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                      actionType === 'REFUND'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>استرداد مبلغ</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  المبلغ (جنيه مصري) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="أدخل المبلغ..."
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ج.م
                  </span>
                </div>
              </div>

              {/* Quick Amount Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 ml-1">مبالغ سريعة:</span>
                {[50, 100, 150, 200, 300, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setAmount(String(val));
                      setError(null);
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition text-slate-700 dark:text-slate-300"
                  >
                    {val} ج.م
                  </button>
                ))}
              </div>

              {/* Balance Preview Card */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/60 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>الرصيد بعد تنفيذ العملية:</span>
                  <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {previewBalance.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                  {actionType === 'ADD'
                    ? `سيتم زيادة الرصيد بمقدار +${parsedAmount || 0} ج.م`
                    : actionType === 'REFUND'
                    ? `سيتم إيداع مبلغ استرداد بقيمة +${parsedAmount || 0} ج.م`
                    : `سيتم استقطاع وخصم مبلغ -${parsedAmount || 0} ج.م من المحفظة`}
                </div>
              </div>

              {/* Reason / Notes Input (Required for audit) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>
                    سبب التعديل أو التحكم <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (يتم توثيقها في سجل التدقيق المالي)
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError(null);
                  }}
                  placeholder="اكتب سبب التعديل (مثال: تسوية خطأ، رد اشتراك، خصم يدوي، منحة كشفية...)"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                />
              </div>

              {/* Security Audit Badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>العملية مقيدة بصلاحية المدير والأدمن ويتم توثيقها رسمياً بالسجل المالي.</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Sliders className="w-4 h-4" />
                  <span>{loading ? 'جاري تنفيذ العملية...' : 'تأكيد وحفظ التعديل'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
