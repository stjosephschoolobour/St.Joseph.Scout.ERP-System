import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  CreditCard,
  Wallet,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { EligibleSubscriptionRolloverMember, BulkRolloverResponse } from '../types';
import { walletService } from '../services/walletService';

interface SubscriptionRolloverModalProps {
  initialYear?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const SubscriptionRolloverModal: React.FC<SubscriptionRolloverModalProps> = ({
  initialYear = new Date().getFullYear(),
  onClose,
  onSuccess,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [subscriptionType, setSubscriptionType] = useState<'اشتراك سنوي' | 'اشتراك سنوي بالزي'>('اشتراك سنوي');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [fee, setFee] = useState<number>(0);
  const [feeRegular, setFeeRegular] = useState<number>(0);
  const [feeWithUniform, setFeeWithUniform] = useState<number>(0);
  const [members, setMembers] = useState<EligibleSubscriptionRolloverMember[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [notes, setNotes] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterEligibility, setFilterEligibility] = useState<'ALL' | 'ELIGIBLE_ONLY' | 'INSUFFICIENT'>(
    'ELIGIBLE_ONLY'
  );

  const [resultsData, setResultsData] = useState<BulkRolloverResponse | null>(null);

  // Load data for the selected year and subscription type
  const loadData = async (
    yearToLoad: number,
    typeToLoad: 'اشتراك سنوي' | 'اشتراك سنوي بالزي' = subscriptionType
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await walletService.getEligibleSubscriptionRollover(yearToLoad, typeToLoad);
      setFee(res.fee);
      setFeeRegular(res.feeRegular || res.fee);
      setFeeWithUniform(res.feeWithUniform || res.fee);
      setMembers(res.members || []);

      // By default, select all eligible members
      const eligibleIds = (res.members || [])
        .filter((m) => m.is_eligible)
        .map((m) => m.member_id);
      setSelectedMemberIds(eligibleIds);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات ترحيل الاشتراكات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedYear, subscriptionType);
  }, [selectedYear, subscriptionType]);

  const handleTypeChange = (newType: 'اشتراك سنوي' | 'اشتراك سنوي بالزي') => {
    setSubscriptionType(newType);
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Eligibility filter
      if (filterEligibility === 'ELIGIBLE_ONLY' && !m.is_eligible) {
        return false;
      }
      if (filterEligibility === 'INSUFFICIENT' && m.is_eligible) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = m.student_name.toLowerCase().includes(q);
        const matchCode = m.member_code.toLowerCase().includes(q);
        const matchTribe = m.tribe_name?.toLowerCase().includes(q);
        const matchStage = m.school_stage?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchTribe && !matchStage) {
          return false;
        }
      }

      return true;
    });
  }, [members, filterEligibility, searchQuery]);

  const eligibleCount = members.filter((m) => m.is_eligible).length;
  const insufficientCount = members.filter((m) => !m.is_eligible).length;
  const totalSelectedAmount = selectedMemberIds.length * fee;

  const handleToggleSelectAll = () => {
    const currentEligibleIds = filteredMembers
      .filter((m) => m.is_eligible)
      .map((m) => m.member_id);

    const allAreSelected = currentEligibleIds.every((id) =>
      selectedMemberIds.includes(id)
    );

    if (allAreSelected) {
      // Unselect all current filtered
      setSelectedMemberIds((prev) =>
        prev.filter((id) => !currentEligibleIds.includes(id))
      );
    } else {
      // Select all current eligible
      const union = Array.from(new Set([...selectedMemberIds, ...currentEligibleIds]));
      setSelectedMemberIds(union);
    }
  };

  const handleToggleMember = (memberId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleExecuteRollover = async () => {
    if (selectedMemberIds.length === 0) {
      setError('يرجى اختيار عضو واحد على الأقل للترحيل');
      return;
    }
    if (fee <= 0) {
      setError('لم يتم تحديد قيمة الاشتراك السنوي لهذه السنة');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await walletService.bulkRolloverSubscriptions({
        year: selectedYear,
        subscription_type: subscriptionType,
        member_ids: selectedMemberIds,
        notes: notes.trim() || undefined,
      });

      setResultsData(res);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'فشل تنفيذ عملية ترحيل الاشتراكات');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-800 to-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-white border border-white/20">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                ترحيل اشتراكات الأعضاء من المحفظة
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 font-bold">
                  سداد آلي ذكي
                </span>
              </h2>
              <p className="text-xs text-teal-100/90 mt-0.5">
                خصم قيمة الاشتراك السنوي من رصيد محفظة العضو وتحديث حالة الاشتراك إلى "مسدد"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Year & Subscription Type Selector Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  سنة الاشتراك:
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={loading || submitting || !!resultsData}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      سنة {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => loadData(selectedYear, subscriptionType)}
                  disabled={loading || submitting}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="تحديث البيانات"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Type Selection */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('اشتراك سنوي')}
                  disabled={loading || submitting || !!resultsData}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    subscriptionType === 'اشتراك سنوي'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>اشتراك سنوي عادي</span>
                  <span className="font-mono bg-black/15 px-1.5 py-0.2 rounded text-[11px]">
                    {feeRegular > 0 ? `${feeRegular} ج.م` : 'غير محدد'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('اشتراك سنوي بالزي')}
                  disabled={loading || submitting || !!resultsData}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    subscriptionType === 'اشتراك سنوي بالزي'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>اشتراك سنوي بالزي</span>
                  <span className="font-mono bg-black/15 px-1.5 py-0.2 rounded text-[11px]">
                    {feeWithUniform > 0 ? `${feeWithUniform} ج.م` : 'غير محدد'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Results State (After execution) */}
          {resultsData ? (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3.5 text-emerald-900 dark:text-emerald-200">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">
                    اكتملت عملية ترحيل الاشتراكات بنجاح!
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {resultsData.message}
                  </p>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">عدد الأعضاء المرحلة اشتراكاتهم</span>
                  <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {resultsData.processedCount}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">إجمالي المبالغ المسددة والمرحلة</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {resultsData.totalAmount.toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  تفاصيل إيصالات الترحيل الصادرة
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {resultsData.results.map((r) => (
                    <div
                      key={r.memberId}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {r.studentName}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          ({r.memberCode})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {r.receiptNumber}
                        </span>
                        <span className="text-slate-500 font-mono">
                          المتبقي: {r.balanceAfter} ج.م
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold block">
                      مؤهلين للترحيل الفوري
                    </span>
                    <span className="text-lg font-black text-emerald-800 dark:text-emerald-200">
                      {eligibleCount} عضو
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                      المحدد للترحيل حالياً
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {selectedMemberIds.length} عضو ({totalSelectedAmount.toLocaleString()} ج.م)
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold block">
                      غير مسددين (رصيد غير كافٍ)
                    </span>
                    <span className="text-lg font-black text-amber-800 dark:text-amber-200">
                      {insufficientCount} عضو
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم، الكود، العشيرة..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFilterEligibility('ELIGIBLE_ONLY')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        filterEligibility === 'ELIGIBLE_ONLY'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      المؤهلين فقط ({eligibleCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterEligibility('ALL')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        filterEligibility === 'ALL'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      الكل ({members.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>تحديد / إلغاء الكل</span>
                  </button>
                </div>
              </div>

              {/* Members Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <div className="max-h-72 overflow-y-auto">
                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                      <span className="text-xs">جاري فحص المحافظ والاشتراكات...</span>
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500">
                      لا يوجد أعضاء يطابقون خيارات البحث أو التصفية الحالية
                    </div>
                  ) : (
                    <table className="w-full text-right border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-bold z-10">
                        <tr>
                          <th className="p-2.5 w-10 text-center">اختيار</th>
                          <th className="p-2.5">العضو / القائد</th>
                          <th className="p-2.5">الكود</th>
                          <th className="p-2.5">المرحلة والعشيرة</th>
                          <th className="p-2.5 text-left">رصيد المحفظة</th>
                          <th className="p-2.5 text-left">المتبقي بعد الترحيل</th>
                          <th className="p-2.5 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMembers.map((m) => {
                          const isSelected = selectedMemberIds.includes(m.member_id);
                          return (
                            <tr
                              key={m.member_id}
                              onClick={() => m.is_eligible && handleToggleMember(m.member_id)}
                              className={`transition cursor-pointer ${
                                !m.is_eligible
                                  ? 'opacity-50 bg-slate-50/40 dark:bg-slate-800/20 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  disabled={!m.is_eligible}
                                  checked={isSelected}
                                  onChange={() => handleToggleMember(m.member_id)}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <span>{m.student_name}</span>
                                  {m.member_type === 'قائد' && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                      قائد
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">
                                {m.member_code}
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-slate-400">
                                {m.school_stage} {m.tribe_name ? `• ${m.tribe_name}` : ''}
                              </td>
                              <td className="p-2.5 text-left font-black text-slate-900 dark:text-slate-100 font-mono">
                                {m.balance.toLocaleString()} ج.م
                              </td>
                              <td className="p-2.5 text-left font-mono">
                                {m.is_eligible ? (
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {m.remaining_balance.toLocaleString()} ج.م
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                {m.is_eligible ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                    مؤهل للترحيل
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                    رصيد غير كافٍ
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات إضافية على عملية الترحيل (اختياري)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: ترحيل اشتراكات الدفعة الأولى من رصيد المحفظة..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Security Audit Badge */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  عملية الترحيل مخصصة للمدير والأدمن وتقوم بخصم الاشتراك وتوليد إيصالات مالية رسمية لكل عضو.
                </span>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  الإجمالي المحدد:{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                    {totalSelectedAmount.toLocaleString()} ج.م
                  </span>{' '}
                  ({selectedMemberIds.length} عضو)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRollover}
                    disabled={submitting || selectedMemberIds.length === 0 || fee <= 0}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black flex items-center gap-2 transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowRightLeft className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                    <span>
                      {submitting
                        ? 'جاري الترحيل والسداد...'
                        : `تأكيد ترحيل الاشتراكات (${selectedMemberIds.length})`}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
