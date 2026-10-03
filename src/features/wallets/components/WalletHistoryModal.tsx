import React, { useState, useEffect } from 'react';
import {
  Wallet,
  X,
  Printer,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Calendar,
  FileText,
  CreditCard,
  User,
  Plus,
} from 'lucide-react';
import { walletService } from '../services/walletService';
import { WalletTransaction } from '../types';
import { getPhotoUrl } from '../../../utils/photo';

interface WalletHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: number | null;
  onOpenTopUp?: (member: any) => void;
}

export const WalletHistoryModal: React.FC<WalletHistoryModalProps> = ({
  isOpen,
  onClose,
  memberId,
  onOpenTopUp,
}) => {
  const [data, setData] = useState<{
    member: any;
    balance: number;
    transactions: WalletTransaction[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!memberId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await walletService.getMemberWallet(memberId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل كشف الحساب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && memberId) {
      fetchHistory();
    } else {
      setData(null);
    }
  }, [isOpen, memberId]);

  if (!isOpen || !memberId) return null;

  const handlePrint = () => {
    window.print();
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'TOPUP':
        return 'شحن رصيد';
      case 'SUBSCRIPTION':
        return 'اشتراك سنوي';
      case 'ACTIVITY':
        return 'نشاط / معسكر';
      case 'STORE':
        return 'مشتريات متجر';
      case 'REFUND':
        return 'استرداد مالي';
      case 'ADJUSTMENT':
        return 'تعديل رصيد';
      default:
        return cat;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === 'DEPOSIT' || type === 'REFUND') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <ArrowDownLeft className="w-3 h-3" />
          إيداع
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <ArrowUpRight className="w-3 h-3" />
        خصم / سداد
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-scale-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">كشف حساب المحفظة الكشفية</h3>
              <p className="text-xs text-slate-400">سجل الإيداعات والمدفوعات والمتبقي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة كشف</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Member & Balance Summary */}
        {data && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {data.member.photo_path ? (
                  <img
                    src={getPhotoUrl(data.member.photo_path)}
                    alt={data.member.student_name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                    {data.member.student_name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {data.member.student_name}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {data.member.member_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="font-mono dir-ltr">{data.member.member_code}</span>
                    {data.member.tribe_name && (
                      <>
                        <span>•</span>
                        <span>عشيرة: {data.member.tribe_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Balance Card & Quick Top-up Button */}
              <div className="flex items-center gap-3 bg-white dark:bg-slate-850 p-2.5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="text-left">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                    الرصيد المتاح حالياً
                  </span>
                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {Number(data.balance || 0).toLocaleString()}{' '}
                    <span className="text-xs font-normal">ج.م</span>
                  </span>
                </div>
                {onOpenTopUp && (
                  <button
                    onClick={() => {
                      onOpenTopUp({
                        ...data.member,
                        balance: data.balance,
                      });
                    }}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                    title="شحن رصيد للمحفظة"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">شحن رصيد</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-2 text-emerald-600" />
              <p className="text-xs">جاري تحميل سجل الحركات...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-rose-500 text-xs bg-rose-50 dark:bg-rose-950/30 rounded-xl">
              {error}
            </div>
          ) : !data || data.transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                لا توجد معاملات مسجلة في المحفظة حتى الآن
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                يمكنك شحن رصيد المحفظة للبدء في استخدامها لسداد الاشتراكات والأنشطة
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 sm:p-3">التاريخ والوقت</th>
                    <th className="p-2.5 sm:p-3">النوع</th>
                    <th className="p-2.5 sm:p-3">البيان / التصنيف</th>
                    <th className="p-2.5 sm:p-3 text-left">المبلغ</th>
                    <th className="p-2.5 sm:p-3 text-left">الرصيد بعد</th>
                    <th className="p-2.5 sm:p-3 text-center">رقم الإيصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {data.transactions.map((tx) => {
                    const isPositive = tx.type === 'DEPOSIT' || tx.type === 'REFUND';
                    const dateStr = tx.created_at ? tx.created_at.replace('T', ' ').slice(0, 16) : '-';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-2.5 sm:p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 dir-ltr text-right">
                          {dateStr}
                        </td>
                        <td className="p-2.5 sm:p-3 whitespace-nowrap">
                          {getTypeBadge(tx.type)}
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {getCategoryLabel(tx.category)}
                          </div>
                          {tx.description && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                              {tx.description}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 sm:p-3 text-left font-black text-sm whitespace-nowrap">
                          <span
                            className={
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {isPositive ? '+' : '-'}
                            {Number(tx.amount).toLocaleString()} ج.م
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 text-left font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap font-mono">
                          {Number(tx.balance_after).toLocaleString()} ج.م
                        </td>
                        <td className="p-2.5 sm:p-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400 dir-ltr">
                          {tx.receipt_number || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            إجمالي الحركات: {data?.transactions.length || 0} عملية
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
