import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, User, Award, Calendar, Receipt, AlertCircle, Wallet, Shirt } from 'lucide-react';
import { AnnualPaymentMember, SubscriptionType } from '../types';
import { subscriptionsService } from '../services/subscriptionsService';
import { walletService } from '../../wallets/services/walletService';

interface PaymentModalProps {
  isOpen: boolean;
  year: number;
  unifiedFee: number;
  feeWithUniform?: number;
  member: AnnualPaymentMember | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  year,
  unifiedFee,
  feeWithUniform = unifiedFee,
  member,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<'مسدد' | 'غير مسدد'>('مسدد');
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('اشتراك سنوي');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'WALLET'>('CASH');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | string>(unifiedFee);
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && member) {
      const today = new Date().toISOString().split('T')[0];
      const initialType = member.subscription_type || 'اشتراك سنوي';
      const expectedAmount = initialType === 'اشتراك سنوي بالزي' ? feeWithUniform : unifiedFee;

      setStatus(member.status === 'مسدد' ? 'مسدد' : 'مسدد');
      setSubscriptionType(initialType);
      setAmount(member.paid_amount > 0 ? member.paid_amount : expectedAmount);
      setPaymentDate(member.payment_date || today);
      setReceiptNumber(
        member.receipt_number || `REC-${year}-${String(member.member_id).padStart(4, '0')}`
      );
      setNotes(member.notes || '');
      setPaymentMethod('CASH');
      setError(null);

      // Fetch wallet balance
      walletService
        .getMemberWallet(member.member_id)
        .then((res) => {
          setWalletBalance(res.balance);
        })
        .catch(() => {
          setWalletBalance(null);
        });
    }
  }, [isOpen, member, year, unifiedFee, feeWithUniform]);

  if (!isOpen || !member) return null;

  const handleTypeChange = (newType: SubscriptionType) => {
    setSubscriptionType(newType);
    const prevExpected = subscriptionType === 'اشتراك سنوي بالزي' ? feeWithUniform : unifiedFee;
    const newExpected = newType === 'اشتراك سنوي بالزي' ? feeWithUniform : unifiedFee;
    // If current amount matches the previous expected amount or is empty, auto-update to new expected amount
    if (amount === prevExpected || amount === '' || amount === 0) {
      setAmount(newExpected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const parsedAmount = status === 'مسدد' ? parseFloat(String(amount)) : 0;
      const defaultAmount = subscriptionType === 'اشتراك سنوي بالزي' ? feeWithUniform : unifiedFee;

      if (paymentMethod === 'WALLET' && status === 'مسدد') {
        const required = isNaN(parsedAmount) ? defaultAmount : parsedAmount;
        if (walletBalance === null || walletBalance < required) {
          setError(`رصيد المحفظة الحالي (${walletBalance ?? 0} ج.م) غير كافٍ لسداد ${required} ج.م`);
          setLoading(false);
          return;
        }
      }

      const res = await subscriptionsService.recordPayment({
        year,
        member_id: member.member_id,
        status,
        subscription_type: subscriptionType,
        paid_amount: isNaN(parsedAmount) ? defaultAmount : parsedAmount,
        payment_date: status === 'مسدد' ? paymentDate : undefined,
        receipt_number: status === 'مسدد' ? receiptNumber : undefined,
        notes: notes.trim() || undefined,
        payment_method: paymentMethod,
      });

      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل عملية السداد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        id="payment_modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">تسجيل سداد الاشتراك السنوي</h2>
              <p className="text-xs text-slate-400 mt-0.5">لسنة {year}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Preview Card */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  member.member_type === 'قائد'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {member.member_type === 'قائد' ? <Award className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">{member.student_name}</h3>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      member.member_type === 'قائد'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {member.member_type}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>كود: <strong className="font-mono text-slate-700">{member.member_code}</strong></span>
                  <span>•</span>
                  <span>الصف: <strong className="text-slate-700">{member.school_stage}</strong></span>
                  {member.tribe_name && (
                    <>
                      <span>•</span>
                      <span>عشيرة: <strong className="text-slate-700">{member.tribe_name}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="text-left">
              <span className="text-[11px] text-slate-400 block font-medium">الاشتراك المعتمد</span>
              <span className="text-xs font-bold text-emerald-700 block">عادي: {unifiedFee} ج.م</span>
              <span className="text-xs font-bold text-teal-700 block">بالزي: {feeWithUniform} ج.م</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              حالة السداد <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('مسدد')}
                className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  status === 'مسدد'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                مسدد بالكامل
              </button>
              <button
                type="button"
                onClick={() => setStatus('غير مسدد')}
                className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  status === 'غير مسدد'
                    ? 'bg-rose-50 text-rose-800 border-rose-500 ring-2 ring-rose-500/20'
                    : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                غير مسدد (إلغاء السداد)
              </button>
            </div>
          </div>

          {status === 'مسدد' && (
            <>
              {/* Subscription Type: Regular vs With Uniform */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع الاشتراك السنوي <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('اشتراك سنوي')}
                    className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                      subscriptionType === 'اشتراك سنوي'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-500 ring-2 ring-emerald-500/20 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <span className="text-xs block font-bold">اشتراك سنوي عادي</span>
                      <span className="text-[11px] text-emerald-700 font-mono font-extrabold">{unifiedFee} ج.م</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('اشتراك سنوي بالزي')}
                    className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                      subscriptionType === 'اشتراك سنوي بالزي'
                        ? 'bg-teal-50 text-teal-900 border-teal-500 ring-2 ring-teal-500/20 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs block font-bold">اشتراك سنوي بالزي</span>
                        <Shirt className="w-3 h-3 text-teal-600" />
                      </div>
                      <span className="text-[11px] text-teal-700 font-mono font-extrabold">{feeWithUniform} ج.م</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Payment Method (Cash vs Wallet) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  طريقة السداد
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    💵 نقداً (كاش)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('WALLET')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      paymentMethod === 'WALLET'
                        ? 'bg-teal-50 text-teal-800 border-teal-500 ring-2 ring-teal-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-teal-600" />
                    <span>من رصيد المحفظة</span>
                  </button>
                </div>

                {/* Wallet Balance Notification */}
                {paymentMethod === 'WALLET' && (
                  <div className="mt-2 p-2.5 bg-teal-50/80 border border-teal-200 rounded-xl text-xs flex items-center justify-between">
                    <span className="text-teal-900 font-medium">الرصيد المتاح بالمحفظة:</span>
                    <span className="font-bold text-teal-800 text-sm">
                      {walletBalance !== null ? `${walletBalance.toLocaleString()} ج.م` : 'جاري الفحص...'}
                    </span>
                  </div>
                )}
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المبلغ المسدد (ج.م) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input_payment_amount"
                      type="number"
                      min="0"
                      step="5"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-left focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ج.م
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    القيمة المعتمدة: {subscriptionType === 'اشتراك سنوي بالزي' ? `${feeWithUniform} ج.م (بالزي)` : `${unifiedFee} ج.م (عادي)`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    تاريخ السداد <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input_payment_date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Receipt Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  رقم الإيصال أو الوصل
                </label>
                <input
                  id="input_receipt_number"
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="مثال: REC-2026-0001"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات التحصيل (اختياري)
            </label>
            <input
              id="input_payment_notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية بخصوص السداد..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              id="btn_save_member_payment"
              type="submit"
              disabled={loading}
              className={`px-5 py-2 text-sm font-bold text-white rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                status === 'مسدد'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-rose-700 hover:bg-rose-800'
              } disabled:opacity-50`}
            >
              {loading ? 'جاري الحفظ...' : status === 'مسدد' ? 'حفظ السداد' : 'تأكيد إلغاء السداد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
