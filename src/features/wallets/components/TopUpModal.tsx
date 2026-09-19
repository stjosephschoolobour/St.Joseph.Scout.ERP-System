import React, { useState } from 'react';
import {
  Wallet,
  X,
  CheckCircle2,
  AlertCircle,
  Printer,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  User,
} from 'lucide-react';
import { walletService } from '../services/walletService';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  member?: {
    id: number;
    student_name: string;
    member_code: string;
    member_type?: string;
    balance?: number;
    photo_path?: string;
  } | null;
  memberId?: number;
  memberName?: string;
  memberCode?: string;
  memberType?: string;
  currentBalance?: number;
  photoPath?: string;
  onSuccess?: () => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  onClose,
  member: memberProp,
  memberId,
  memberName,
  memberCode,
  memberType,
  currentBalance,
  photoPath,
  onSuccess,
}) => {
  const member = memberProp || (memberId ? {
    id: memberId,
    student_name: memberName || '',
    member_code: memberCode || `sc${String(memberId).padStart(6, '0')}`,
    member_type: memberType,
    balance: currentBalance ?? 0,
    photo_path: photoPath,
  } : null);

  const [amount, setAmount] = useState<number | ''>(100);
  const [paymentMethod, setPaymentMethod] = useState('نقداً (كاش)');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    balance: number;
    receiptNumber: string;
    amount: number;
  } | null>(null);

  if (!isOpen || !member) return null;

  const quickAmounts = [50, 100, 150, 200, 300, 500];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('يرجى إدخال مبلغ إيداع صحيح أكبر من الصفر');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await walletService.topUpWallet({
        member_id: member.id,
        amount: numAmount,
        payment_method: paymentMethod,
        notes,
      });

      setSuccessData({
        balance: res.balance,
        receiptNumber: res.receiptNumber,
        amount: numAmount,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'فشل إتمام عملية شحن الرصيد');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleClose = () => {
    setSuccessData(null);
    setAmount(100);
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-scale-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">شحن رصيد المحفظة الكشفية</h3>
              <p className="text-xs text-emerald-100">إيداع رصيد مالي لسداد الاشتراكات والأنشطة</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Preview Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {member.photo_path ? (
                <img
                  src={member.photo_path}
                  alt={member.student_name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                  {member.student_name.slice(0, 1)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {member.student_name}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {member.member_type || 'عضو'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 dir-ltr text-right">
                  {member.member_code}
                </div>
              </div>
            </div>
            <div className="text-left">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">الرصيد الحالي</span>
              <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                {Number(member.balance || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </span>
            </div>
          </div>
        </div>

        {/* Success View */}
        {successData ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                تم شحن الرصيد بنجاح!
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                تم إيداع مبلغ <span className="font-bold text-slate-800 dark:text-slate-200">{successData.amount} ج.م</span> في محفظة {member.student_name}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-right space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">رقم إيصال الإيداع:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 dir-ltr">{successData.receiptNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">المبلغ المودع:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{successData.amount} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">الرصيد الجديد المتاح:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{successData.balance.toLocaleString()} ج.م</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                طباعة إيصال
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                مبلغ الشحن (بالجنيه المصري) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="أدخل المبلغ..."
                  className="w-full px-3.5 py-2.5 pl-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-base font-bold focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ج.م
                </span>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                      amount === amt
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    +{amt} ج.م
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                طريقة التوريد / الإيداع
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              >
                <option value="نقداً (كاش)">💵 نقداً (كاش - باليد)</option>
                <option value="فودافون كاش / إنستاباي">📱 فودافون كاش / إنستاباي</option>
                <option value="تحويل بنكي">🏦 تحويل بنكي</option>
                <option value="إيداع ولي أمر">👨‍👩‍👧 إيداع ولي أمر</option>
                <option value="مكافأة تميز كشفي">⭐ مكافأة تميز كشفي</option>
                <option value="أخرى">📝 طريقة أخرى</option>
              </select>
            </div>

            {/* Notes / Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ملاحظات أو بيان العملية (اختياري)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: تسليم كاش لأمين الصندوق، أو رقم تحويل..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Expected Balance Preview */}
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 flex items-center justify-between text-xs">
              <span className="text-emerald-800 dark:text-emerald-300 font-medium">الرصيد بعد الشحن سيكون:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                {(Number(member.balance || 0) + Number(amount || 0)).toLocaleString()} ج.م
              </span>
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
                disabled={loading || !amount || Number(amount) <= 0}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5"
              >
                {loading ? (
                  <span>جاري الإيداع...</span>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    <span>تأكيد شحن الرصيد</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
