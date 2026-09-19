import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  DollarSign,
  Calendar,
  Search,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Printer,
  Edit3,
  Users,
  Award,
  User,
  Phone,
  Receipt,
  Plus,
  ArrowUpDown,
  RefreshCw,
  ArrowRightLeft,
  Wallet,
  Shirt,
} from 'lucide-react';
import {
  SubscriptionYearOption,
  AnnualSubscriptionData,
  AnnualPaymentMember,
  SubscriptionType,
} from '../types';
import { subscriptionsService } from '../services/subscriptionsService';
import { SubscriptionFeeModal } from './SubscriptionFeeModal';
import { PaymentModal } from './PaymentModal';
import { BulkPaymentModal } from './BulkPaymentModal';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { SubscriptionRolloverModal } from '../../wallets/components/SubscriptionRolloverModal';
import { walletService } from '../../wallets/services/walletService';

interface AnnualSubscriptionsViewProps {
  userRole?: string;
}

export const AnnualSubscriptionsView: React.FC<AnnualSubscriptionsViewProps> = ({
  userRole,
}) => {
  const [years, setYears] = useState<SubscriptionYearOption[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<AnnualSubscriptionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'مسدد' | 'غير مسدد'>('all');
  const [subscriptionTypeFilter, setSubscriptionTypeFilter] = useState<'all' | SubscriptionType>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'عضوة' | 'قائد'>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [tribeFilter, setTribeFilter] = useState<string>('all');

  // Multi-selection for bulk action
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals state
  const [isFeeModalOpen, setIsFeeModalOpen] = useState<boolean>(false);
  const [paymentModalMember, setPaymentModalMember] = useState<AnnualPaymentMember | null>(null);
  const [receiptModalMember, setReceiptModalMember] = useState<AnnualPaymentMember | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState<boolean>(false);

  // Permission check: Admin or Manager (Data Entry)
  const canManage = !userRole || userRole === 'ADMIN' || userRole === 'DATA_ENTRY';

  // Load Years
  const loadYears = async (targetYear?: number) => {
    try {
      const res = await subscriptionsService.getYears();
      setYears(res.years);
      if (targetYear) {
        setSelectedYear(targetYear);
      } else if (!selectedYear && res.years.length > 0) {
        setSelectedYear(res.currentYear || res.years[0].year);
      }
    } catch (err: any) {
      console.error('Failed to load years:', err);
    }
  };

  // Load subscription data for selected year
  const loadYearData = async (year: number) => {
    try {
      setLoading(true);
      const res = await subscriptionsService.getSubscriptionData(year);
      setData(res);
      setSelectedIds([]);
    } catch (err: any) {
      console.error('Failed to load subscription data:', err);
      setFeedback({ type: 'error', message: err.message || 'فشل تحميل بيانات الاشتراك' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadYearData(selectedYear);
    }
  }, [selectedYear]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Quick single click payment
  const handleQuickPay = async (
    member: AnnualPaymentMember,
    type: SubscriptionType = 'اشتراك سنوي'
  ) => {
    if (!data) return;
    try {
      const amount = type === 'اشتراك سنوي بالزي' ? data.feeWithUniform : data.unifiedFee;
      const res = await subscriptionsService.recordPayment({
        year: selectedYear,
        member_id: member.member_id,
        status: 'مسدد',
        subscription_type: type,
        paid_amount: amount,
      });
      showToast(res.message);
      loadYearData(selectedYear);
    } catch (err: any) {
      showToast(err.message || 'فشل تسجيل السداد', 'error');
    }
  };

  // Cancel payment
  const handleCancelPayment = async (member: AnnualPaymentMember) => {
    if (!window.confirm(`هل أنت متأكد من إلغاء سداد الاشتراك للعضو (${member.student_name}) لسنة ${selectedYear}؟`)) {
      return;
    }
    try {
      const res = await subscriptionsService.cancelPayment(selectedYear, member.member_id);
      showToast(res.message);
      loadYearData(selectedYear);
    } catch (err: any) {
      showToast(err.message || 'فشل إلغاء السداد', 'error');
    }
  };

  // Rollover / Refund paid subscription into Member Wallet
  const handleRefundToWallet = async (member: AnnualPaymentMember) => {
    const amount = member.paid_amount || data?.unifiedFee || 0;
    if (
      !confirm(
        `هل أنت متأكد من ترحيل واسترداد اشتراك عام ${selectedYear} للعضو (${member.student_name}) إلى رصيد محفظته؟\n\n- سيتم إلغاء حالة السداد لاشتراك ${selectedYear}\n- سيتم إيداع مبلغ ${amount} ج.م في محفظة العضو الكشفية`
      )
    ) {
      return;
    }
    try {
      const res = await walletService.refundSubscriptionToWallet({
        year: selectedYear,
        member_id: member.member_id,
        notes: `ترحيل اشتراك ${selectedYear} وإعادته للمحفظة الكشفية`,
      });
      showToast(res.message);
      loadYearData(selectedYear);
    } catch (err: any) {
      showToast(err.message || 'فشل ترحيل الاشتراك إلى المحفظة', 'error');
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      await subscriptionsService.exportExcel(selectedYear);
      showToast('تم تصدير كشف الاشتراكات إلى Excel بنجاح');
    } catch (err: any) {
      showToast(err.message || 'فشل تصدير Excel', 'error');
    }
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  // Extract distinct tribes for filter
  const distinctTribes = useMemo(() => {
    if (!data) return [];
    const tribes = new Set<string>();
    data.members.forEach((m) => {
      if (m.tribe_name) tribes.add(m.tribe_name);
    });
    return Array.from(tribes).sort();
  }, [data]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.student_name.toLowerCase().includes(q);
        const matchCode = m.member_code.toLowerCase().includes(q);
        const matchNatId = m.national_id.includes(q);
        const matchPhone = m.phone ? m.phone.includes(q) : false;
        if (!matchName && !matchCode && !matchNatId && !matchPhone) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        if (m.status !== statusFilter) return false;
      }

      // Subscription Type Filter (for paid members)
      if (subscriptionTypeFilter !== 'all') {
        if (m.status === 'مسدد' && m.subscription_type !== subscriptionTypeFilter) return false;
        if (m.status !== 'مسدد') return false;
      }

      // Type
      if (typeFilter !== 'all') {
        if (m.member_type !== typeFilter) return false;
      }

      // Stage
      if (stageFilter !== 'all') {
        if (m.school_stage !== stageFilter) return false;
      }

      // Tribe
      if (tribeFilter !== 'all') {
        if (m.tribe_name !== tribeFilter) return false;
      }

      return true;
    });
  }, [data, searchQuery, statusFilter, typeFilter, stageFilter, tribeFilter]);

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // select only unpaid in current view
      const unpaids = filteredMembers.filter((m) => m.status !== 'مسدد').map((m) => m.member_id);
      setSelectedIds(unpaids);
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleMember = (memberId: number) => {
    setSelectedIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectedMemberNames = useMemo(() => {
    if (!data) return [];
    return data.members
      .filter((m) => selectedIds.includes(m.member_id))
      .map((m) => `${m.student_name} (${m.member_code})`);
  }, [data, selectedIds]);

  return (
    <div id="annual_subscriptions_view" className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between shadow-md transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold mr-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Header with Year Picker & Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/20">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">الاشتراك السنوي للأعضاء والقادة</h1>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                موحد على الجميع
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              متابعة وتحصيل الاشتراكات السنوية للكشافة. قيمة الاشتراك متغيرة لكل سنة ولكنها موحدة على
              جميع الأعضاء والقادة.
            </p>
          </div>
        </div>

        {/* Year Selector Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-slate-600">السنة:</span>
            <select
              id="select_subscription_year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent font-bold text-slate-900 text-sm outline-none cursor-pointer"
            >
              {years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year} {y.amount > 0 ? `(${y.amount} ج.م)` : '(غير محدد)'}
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn_open_fee_modal"
            onClick={() => setIsFeeModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="تحديد أو تعديل قيمة الاشتراك الموحدة لهذا العام"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
            <span>تحديد قيمة الاشتراك</span>
          </button>

          <button
            id="btn_export_subscriptions_excel"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            title="تصدير كشف الاشتراكات إلى ملف Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">تصدير Excel</span>
          </button>

          <button
            id="btn_print_subscriptions_report"
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            title="طباعة كشف التحصيل"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">طباعة</span>
          </button>

          <button
            onClick={() => {
              setRefreshing(true);
              loadYearData(selectedYear);
            }}
            disabled={refreshing}
            className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dual Subscription Fee Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
              الاشتراكات السنوية المعتمدة لعام {selectedYear}
            </span>
            <span className="text-[11px] bg-white/10 text-white px-2 py-0.5 rounded-md font-bold">
              نوعان معتمدان
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Regular fee */}
            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/15">
              <span className="text-[11px] text-emerald-200 block font-medium">الاشتراك السنوي العادي</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black font-mono">{data ? data.unifiedFee : 0}</span>
                <span className="text-xs text-emerald-100 font-bold">ج.م / فرد</span>
              </div>
            </div>

            {/* Fee with uniform */}
            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-teal-300/30">
              <div className="flex items-center gap-1.5 text-[11px] text-teal-200 font-medium">
                <Shirt className="w-3.5 h-3.5 text-teal-300" />
                <span>الاشتراك السنوي بالزي الكشفي</span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black font-mono text-teal-200">
                  {data ? data.feeWithUniform : 0}
                </span>
                <span className="text-xs text-teal-100 font-bold">ج.م / فرد</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-emerald-100/80">
            {data?.feeDescription || `الاشتراك السنوي المعتمد لمجموعة الكشافة والمرشدات لعام ${selectedYear}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <button
              onClick={() => setIsRolloverModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer border border-emerald-400/40"
              title="ترحيل وسداد اشتراكات الأعضاء تلقائياً من رصيد المحفظة"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>ترحيل الاشتراكات من المحفظة</span>
            </button>
          )}
          <button
            onClick={() => setIsFeeModalOpen(true)}
            className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
            <span>تحديد أو تعديل قيم الاشتراكات</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Members */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">إجمالي المستهدفين</span>
              <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {data.stats.totalMembers}
              </span>
              <span className="text-xs text-slate-500 font-medium">عضو وقائد</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
              <span>عضوات: <strong className="text-slate-700">{data.stats.girlsCount}</strong></span>
              <span>قادة: <strong className="text-slate-700">{data.stats.leadersCount}</strong></span>
            </div>
          </div>

          {/* Card 2: Paid Members & Collection Rate */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700 mb-2">
              <span className="text-xs font-bold">الأعضاء المسددون</span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-800 font-mono">
                {data.stats.paidCount}
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                {data.stats.collectionRate}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, data.stats.collectionRate)}%` }}
              ></div>
            </div>
          </div>

          {/* Card 3: Total Collected Amount */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-teal-700 mb-2">
              <span className="text-xs font-bold">المبالغ المحصلة</span>
              <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-teal-900 font-mono">
                {data.stats.totalCollected.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-500">ج.م</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span>عادي: <strong className="text-emerald-700 font-mono">{data.stats.regularCount || 0}</strong></span>
              <span>بالزي: <strong className="text-teal-700 font-mono">{data.stats.uniformCount || 0}</strong></span>
            </div>
          </div>

          {/* Card 4: Unpaid Members & Remaining */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-amber-700 mb-2">
              <span className="text-xs font-bold">غير المسددين</span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-900 font-mono">
                {data.stats.unpaidCount}
              </span>
              <span className="text-xs text-amber-700 font-medium">متبقي سدادهم</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span>المتبقي تحصيله (تقديري):</span>
              <span className="font-bold text-amber-800 font-mono">
                {(data.stats.unpaidCount * data.unifiedFee).toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input_search_subscriptions"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، كود العضو، أو الهاتف..."
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              id="select_filter_status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">كل حالات السداد</option>
              <option value="مسدد">مسدد فقط</option>
              <option value="غير مسدد">غير مسدد فقط</option>
            </select>
          </div>

          {/* Subscription Type Filter */}
          <div>
            <select
              id="select_filter_subscription_type"
              value={subscriptionTypeFilter}
              onChange={(e) => setSubscriptionTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">كل أنواع الاشتراكات</option>
              <option value="اشتراك سنوي">اشتراك سنوي عادي</option>
              <option value="اشتراك سنوي بالزي">اشتراك سنوي بالزي</option>
            </select>
          </div>

          {/* Member Type Filter */}
          <div>
            <select
              id="select_filter_type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">كل الصفات (عضوات وقادة)</option>
              <option value="عضوة">عضوات فقط</option>
              <option value="قائد">قادة فقط</option>
            </select>
          </div>

          {/* School Grade Filter */}
          <div>
            <select
              id="select_filter_stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">جميع الصفوف والمراحل</option>
              <optgroup label="المرحلة الابتدائية">
                <option value="الصف الأول الابتدائي">الصف الأول الابتدائي</option>
                <option value="الصف الثاني الابتدائي">الصف الثاني الابتدائي</option>
                <option value="الصف الثالث الابتدائي">الصف الثالث الابتدائي</option>
                <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
              </optgroup>
              <optgroup label="المرحلة الإعدادية">
                <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
              </optgroup>
              <optgroup label="المرحلة الثانوية">
                <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
              </optgroup>
              <optgroup label="خيارات أخرى">
                <option value="أخرى">أخرى</option>
              </optgroup>
            </select>
          </div>

          {/* Tribe Filter */}
          <div>
            <select
              id="select_filter_tribe"
              value={tribeFilter}
              onChange={(e) => setTribeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">كل العشائر</option>
              {distinctTribes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-selection Action Toolbar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <span>تم تحديد ({selectedIds.length}) من غير المسددين</span>
              <span>•</span>
              <span>المبلغ الإجمالي: {selectedIds.length * (data?.unifiedFee || 0)} ج.م</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn_bulk_pay_selected"
                onClick={() => setIsBulkModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تسجيل سداد جماعي للمحددين</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Members Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-slate-800">كشف سداد الاشتراكات السنوية</h2>
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-full">
              {filteredMembers.length} فرد
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              مسدد ({filteredMembers.filter((m) => m.status === 'مسدد').length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
              غير مسدد ({filteredMembers.filter((m) => m.status !== 'مسدد').length})
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-xs font-bold">جاري تحميل بيانات الاشتراكات...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-bold text-slate-600">لا توجد بيانات تطابق الفلاتر المحددة</p>
            <p className="text-xs text-slate-400 mt-1">جرب تغيير كلمات البحث أو إعادة تعيين الفلاتر</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredMembers.some((m) => m.status !== 'مسدد') &&
                        filteredMembers
                          .filter((m) => m.status !== 'مسدد')
                          .every((m) => selectedIds.includes(m.member_id))
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      title="تحديد كل غير المسددين في الصفحة"
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 font-bold">كود العضو</th>
                  <th className="py-3 px-3 font-bold">الاسم</th>
                  <th className="py-3 px-3 font-bold">الصفة</th>
                  <th className="py-3 px-3 font-bold">الصف الدراسي</th>
                  <th className="py-3 px-3 font-bold">العشيرة</th>
                  <th className="py-3 px-3 font-bold">رقم الهاتف</th>
                  <th className="py-3 px-3 font-bold text-center">حالة السداد</th>
                  <th className="py-3 px-3 font-bold text-center">نوع الاشتراك</th>
                  <th className="py-3 px-3 font-bold">المبلغ المسدد</th>
                  <th className="py-3 px-3 font-bold">تاريخ السداد / الإيصال</th>
                  <th className="py-3 px-3 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m) => {
                  const isPaid = m.status === 'مسدد';
                  const isSelected = selectedIds.includes(m.member_id);

                  return (
                    <tr
                      key={m.member_id}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleMember(m.member_id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Member Code */}
                      <td className="py-3 px-3 font-mono font-bold text-emerald-800">
                        {m.member_code}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {m.member_type === 'قائد' ? (
                            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span>{m.student_name}</span>
                        </div>
                        {m.student_name_en && (
                          <span className="text-[10px] text-slate-400 font-sans block">
                            {m.student_name_en}
                          </span>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.member_type === 'قائد'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {m.member_type}
                        </span>
                      </td>

                      {/* School Stage */}
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {m.school_stage}
                      </td>

                      {/* Tribe */}
                      <td className="py-3 px-3 text-slate-600">
                        {m.tribe_name ? (
                          <span className="font-medium text-slate-700">{m.tribe_name}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">--</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {m.phone ? (
                          <a
                            href={`tel:${m.phone}`}
                            className="hover:text-emerald-700 flex items-center gap-1"
                            title="اتصال"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{m.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px]">--</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              مسدد
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" />
                              غير مسدد
                            </>
                          )}
                        </span>
                      </td>

                      {/* Subscription Type */}
                      <td className="py-3 px-3 text-center">
                        {isPaid ? (
                          m.subscription_type === 'اشتراك سنوي بالزي' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              <Shirt className="w-3 h-3 text-teal-600" />
                              اشتراك بالزي
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              اشتراك عادي
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[10px]">--</span>
                        )}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-3 font-mono font-bold">
                        {isPaid ? (
                          <span className="text-emerald-700">{m.paid_amount} ج.م</span>
                        ) : (
                          <span className="text-slate-400">0 ج.م</span>
                        )}
                      </td>

                      {/* Payment Date & Receipt */}
                      <td className="py-3 px-3 text-[11px]">
                        {isPaid ? (
                          <div>
                            <span className="font-medium text-slate-700 block font-mono">
                              {m.payment_date || '-'}
                            </span>
                            {m.receipt_number && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {m.receipt_number}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">--</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {!isPaid ? (
                            <>
                              <button
                                id={`btn_quick_pay_${m.member_id}`}
                                onClick={() => handleQuickPay(m, 'اشتراك سنوي')}
                                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition shadow-2xs cursor-pointer text-[10px] flex items-center gap-1"
                                title={`سداد اشتراك عادي مباشر (${data?.unifiedFee || 0} ج.م)`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>عادي ({data?.unifiedFee || 0} ج.م)</span>
                              </button>

                              <button
                                id={`btn_quick_pay_uniform_${m.member_id}`}
                                onClick={() => handleQuickPay(m, 'اشتراك سنوي بالزي')}
                                className="px-2 py-1 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition shadow-2xs cursor-pointer text-[10px] flex items-center gap-1"
                                title={`سداد اشتراك بالزي مباشر (${data?.feeWithUniform || 0} ج.م)`}
                              >
                                <Shirt className="w-3 h-3" />
                                <span>بالزي ({data?.feeWithUniform || 0} ج.م)</span>
                              </button>

                              <button
                                id={`btn_open_pay_modal_${m.member_id}`}
                                onClick={() => setPaymentModalMember(m)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="خيارات السداد المتقدمة (نقداً أو من المحفظة)"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Print Receipt button */}
                              <button
                                id={`btn_receipt_${m.member_id}`}
                                onClick={() => setReceiptModalMember(m)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="معاينة وطباعة إيصال السداد"
                              >
                                <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                              </button>

                              {/* Rollover / Refund to wallet button (Admin & Manager) */}
                              {canManage && (
                                <button
                                  id={`btn_wallet_refund_${m.member_id}`}
                                  onClick={() => handleRefundToWallet(m)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer"
                                  title="ترحيل واسترداد هذا الاشتراك إلى رصيد المحفظة"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Edit details */}
                              <button
                                id={`btn_edit_payment_${m.member_id}`}
                                onClick={() => setPaymentModalMember(m)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="تعديل تفاصيل السداد"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                              </button>

                              {/* Cancel payment */}
                              <button
                                id={`btn_cancel_payment_${m.member_id}`}
                                onClick={() => handleCancelPayment(m)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                title="إلغاء السداد"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* 1. Set / Edit Unified Fee Modal */}
      <SubscriptionFeeModal
        isOpen={isFeeModalOpen}
        year={selectedYear}
        currentAmount={data?.unifiedFee || 0}
        currentAmountWithUniform={data?.feeWithUniform || 0}
        currentDescription={data?.feeDescription || ''}
        onClose={() => setIsFeeModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          loadYears(selectedYear);
          loadYearData(selectedYear);
        }}
      />

      {/* 2. Edit Payment Details Modal */}
      <PaymentModal
        isOpen={!!paymentModalMember}
        year={selectedYear}
        unifiedFee={data?.unifiedFee || 0}
        feeWithUniform={data?.feeWithUniform || 0}
        member={paymentModalMember}
        onClose={() => setPaymentModalMember(null)}
        onSuccess={(msg) => {
          showToast(msg);
          loadYearData(selectedYear);
        }}
      />

      {/* 3. Bulk Payment Modal */}
      <BulkPaymentModal
        isOpen={isBulkModalOpen}
        year={selectedYear}
        unifiedFee={data?.unifiedFee || 0}
        feeWithUniform={data?.feeWithUniform || 0}
        selectedIds={selectedIds}
        selectedNames={selectedMemberNames}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          setSelectedIds([]);
          loadYearData(selectedYear);
        }}
      />

      {/* 4. Payment Receipt Modal */}
      <PaymentReceiptModal
        isOpen={!!receiptModalMember}
        year={selectedYear}
        unifiedFee={data?.unifiedFee || 0}
        member={receiptModalMember}
        onClose={() => setReceiptModalMember(null)}
      />

      {/* 5. Subscription Rollover from Wallet Modal */}
      {isRolloverModalOpen && (
        <SubscriptionRolloverModal
          initialYear={selectedYear}
          onClose={() => setIsRolloverModalOpen(false)}
          onSuccess={() => {
            loadYearData(selectedYear);
          }}
        />
      )}
    </div>
  );
};
