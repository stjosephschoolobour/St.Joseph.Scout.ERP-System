import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Plus,
  CreditCard,
  FileText,
  RefreshCw,
  Printer,
  Users,
  CheckCircle2,
  TrendingUp,
  Receipt,
  Download,
  ShieldCheck,
  ChevronDown,
  ArrowRightLeft,
  Sliders,
} from 'lucide-react';
import { walletService } from './services/walletService';
import { WalletMember, WalletSummary, WalletTransaction } from './types';
import { TopUpModal } from './components/TopUpModal';
import { WalletHistoryModal } from './components/WalletHistoryModal';
import { PayFromWalletModal } from './components/PayFromWalletModal';
import { WalletAdjustModal } from './components/WalletAdjustModal';
import { SubscriptionRolloverModal } from './components/SubscriptionRolloverModal';
import { getPhotoUrl } from '../../utils/photo';

interface WalletsViewProps {
  currentUser?: {
    id: number;
    username: string;
    role: 'ADMIN' | 'LEADER' | 'DATA_ENTRY';
    full_name?: string;
  } | null;
  onSelectMember?: (member: any) => void;
}

export const WalletsView: React.FC<WalletsViewProps> = ({ currentUser, onSelectMember }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WalletSummary>({
    total_system_balance: 0,
    total_deposits: 0,
    total_payments: 0,
    members_with_balance_count: 0,
    total_members_count: 0,
  });
  const [members, setMembers] = useState<WalletMember[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'transactions'>('members');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'HAS_BALANCE' | 'ZERO_BALANCE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modals state
  const [topUpMember, setTopUpMember] = useState<WalletMember | null>(null);
  const [historyMemberId, setHistoryMemberId] = useState<number | null>(null);
  const [payMember, setPayMember] = useState<WalletMember | null>(null);
  const [adjustMember, setAdjustMember] = useState<WalletMember | null>(null);
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState<boolean>(false);

  // Permission check: Admin or Manager (Data Entry)
  const canManage = currentUser ? (currentUser.role === 'ADMIN' || currentUser.role === 'DATA_ENTRY') : true;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [walletData, txData] = await Promise.all([
        walletService.getWallets(),
        walletService.getTransactions(250),
      ]);
      setSummary(walletData.summary);
      setMembers(walletData.members);
      setTransactions(txData.transactions);
    } catch (err: any) {
      console.error('Error loading wallets data:', err);
      setError(err.message || 'فشل تحميل بيانات المحافظ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Search
      const query = searchQuery.trim().toLowerCase();
      if (
        query &&
        !m.student_name.toLowerCase().includes(query) &&
        !m.member_code.toLowerCase().includes(query)
      ) {
        return false;
      }

      // Member type
      if (typeFilter !== 'ALL' && m.member_type !== typeFilter) {
        return false;
      }

      // Balance
      if (balanceFilter === 'HAS_BALANCE' && Number(m.balance) <= 0) {
        return false;
      }
      if (balanceFilter === 'ZERO_BALANCE' && Number(m.balance) > 0) {
        return false;
      }

      return true;
    });
  }, [members, searchQuery, typeFilter, balanceFilter]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchName = tx.student_name?.toLowerCase().includes(query);
        const matchCode = tx.member_code?.toLowerCase().includes(query);
        const matchReceipt = tx.receipt_number?.toLowerCase().includes(query);
        const matchDesc = tx.description?.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchReceipt && !matchDesc) {
          return false;
        }
      }

      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [transactions, searchQuery, categoryFilter]);

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

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              محفظة الأعضاء والقادة
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800">
                مالية كشفية
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              إدارة أرصدة الأعضاء والقادة وسداد الاشتراكات السنوية والأنشطة ومشتريات المتجر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canManage && (
            <button
              onClick={() => setIsRolloverModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="ترحيل وسداد اشتراكات الأعضاء تلقائياً من رصيد المحفظة"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>ترحيل الاشتراكات من المحفظة</span>
            </button>
          )}
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">طباعة تقرير</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Available Balance */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              إجمالي رصيد المحافظ
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {Number(summary.total_system_balance || 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mr-1.5">
              ج.م
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {summary.members_with_balance_count}
            </span>
            <span>عضو/قائد لديهم رصيد متاح</span>
          </div>
        </div>

        {/* Total Deposits */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              إجمالي مبالغ الشحن والإيداع
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {Number(summary.total_deposits || 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 mr-1.5">
              ج.م
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            تغذية نقدية وإلكترونية
          </div>
        </div>

        {/* Total Payments */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              إجمالي المدفوعات من المحفظة
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {Number(summary.total_payments || 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">
              ج.م
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            سداد اشتراكات وأنشطة ومتجر
          </div>
        </div>

        {/* Active Accounts Count */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              عدد المحافظ المسجلة
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {summary.total_members_count}
            </span>
            <span className="text-xs font-bold text-slate-400 mr-1.5">عضو وقائد</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            محفظة رقمية مفعلة لكل عضو
          </div>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'members'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>أرصدة الأعضاء والقادة</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'members'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {filteredMembers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'transactions'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>سجل المعاملات العام</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'transactions'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {filteredTransactions.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الكود أو الإيصال..."
              className="w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {activeTab === 'members' ? (
            <>
              {/* Type Filter */}
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">الصفة:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs outline-none"
                >
                  <option value="ALL">الكل (عضوات وقادة)</option>
                  <option value="عضوة">عضوات فقط</option>
                  <option value="قائد">قادة فقط</option>
                </select>
              </div>

              {/* Balance Filter */}
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">الرصيد:</span>
                <select
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs outline-none"
                >
                  <option value="ALL">جميع الأرصدة</option>
                  <option value="HAS_BALANCE">لديهم رصيد متاح فقط ({'>'} 0)</option>
                  <option value="ZERO_BALANCE">رصيد صفر (0 ج.م)</option>
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Category Filter */}
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">التصنيف:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs outline-none"
                >
                  <option value="ALL">جميع الحركات</option>
                  <option value="TOPUP">شحن رصيد وإيداع</option>
                  <option value="SUBSCRIPTION">سداد اشتراك سنوي</option>
                  <option value="ACTIVITY">سداد نشاط ومعسكر</option>
                  <option value="STORE">مشتريات متجر</option>
                  <option value="REFUND">استرداد مالي</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'members' ? (
        /* Members Wallets Table */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">العضو / القائد</th>
                  <th className="p-3">الصفة والمرحلة</th>
                  <th className="p-3">العشيرة</th>
                  <th className="p-3 text-left">الرصيد المتاح</th>
                  <th className="p-3 text-left hidden md:table-cell">إجمالي الشحن</th>
                  <th className="p-3 text-left hidden md:table-cell">إجمالي المنفق</th>
                  <th className="p-3 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-slate-600 dark:text-slate-400">لا توجد نتائج مطابقة للبحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const hasBal = Number(m.balance) > 0;
                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Member Identity */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {m.photo_path ? (
                              <img
                                src={getPhotoUrl(m.photo_path)}
                                alt={m.student_name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                                {m.student_name.slice(0, 1)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                {m.student_name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono dir-ltr text-right">
                                {m.member_code}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Type & Stage */}
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              m.member_type === 'قائد'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400'
                            }`}
                          >
                            {m.member_type}
                          </span>
                          {m.school_stage && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {m.school_stage}
                            </div>
                          )}
                        </td>

                        {/* Tribe */}
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {m.tribe_name || '-'}
                        </td>

                        {/* Available Balance */}
                        <td className="p-3 text-left">
                          <div
                            className={`font-black text-sm sm:text-base ${
                              hasBal
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {Number(m.balance || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                          </div>
                        </td>

                        {/* Total Deposits */}
                        <td className="p-3 text-left font-mono hidden md:table-cell text-slate-600 dark:text-slate-400">
                          {Number(m.total_deposits || 0).toLocaleString()} ج.م
                        </td>

                        {/* Total Spent */}
                        <td className="p-3 text-left font-mono hidden md:table-cell text-slate-600 dark:text-slate-400">
                          {Number(m.total_spent || 0).toLocaleString()} ج.م
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Top-Up Button */}
                            <button
                              onClick={() => setTopUpMember(m)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-xs flex items-center gap-1 transition-colors"
                              title="شحن رصيد المحفظة"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>شحن</span>
                            </button>

                            {/* Pay from wallet button */}
                            <button
                              onClick={() => setPayMember(m)}
                              disabled={!hasBal}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/60 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs flex items-center gap-1 transition-colors"
                              title="سداد اشتراك أو نشاط من الرصيد"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>دفع</span>
                            </button>

                            {/* Adjust / Manage balance button (Admin & Manager) */}
                            {canManage && (
                              <button
                                onClick={() => setAdjustMember(m)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-bold text-xs flex items-center gap-1 transition-colors"
                                title="التحكم وتسوية الرصيد (إضافة، خصم، أو استرداد)"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>تسوية</span>
                              </button>
                            )}

                            {/* History button */}
                            <button
                              onClick={() => setHistoryMemberId(m.id)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="كشف حساب المعاملات"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Transactions Ledger Table */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">العضو / القائد</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">التصنيف والبيان</th>
                  <th className="p-3 text-left">المبلغ</th>
                  <th className="p-3 text-left">الرصيد بعد</th>
                  <th className="p-3 text-center">رقم الإيصال</th>
                  <th className="p-3">المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-slate-600 dark:text-slate-400">لا توجد حركات مطابقة</p>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPositive = tx.type === 'DEPOSIT' || tx.type === 'REFUND';
                    const dateStr = tx.created_at ? tx.created_at.replace('T', ' ').slice(0, 16) : '-';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 dir-ltr text-right whitespace-nowrap">
                          {dateStr}
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {tx.student_name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono dir-ltr text-right">
                            {tx.member_code}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          {isPositive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <ArrowDownLeft className="w-3 h-3" />
                              إيداع
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                              <ArrowUpRight className="w-3 h-3" />
                              خصم / سداد
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {getCategoryLabel(tx.category)}
                          </div>
                          {tx.description && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                              {tx.description}
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-left font-black text-sm whitespace-nowrap">
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

                        <td className="p-3 text-left font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap font-mono">
                          {Number(tx.balance_after).toLocaleString()} ج.م
                        </td>

                        <td className="p-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400 dir-ltr">
                          {tx.receipt_number || '-'}
                        </td>

                        <td className="p-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {tx.recorded_by || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top-Up Modal */}
      {topUpMember && (
        <TopUpModal
          isOpen={!!topUpMember}
          onClose={() => setTopUpMember(null)}
          member={topUpMember}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* Wallet History Modal */}
      {historyMemberId && (
        <WalletHistoryModal
          isOpen={!!historyMemberId}
          onClose={() => setHistoryMemberId(null)}
          memberId={historyMemberId}
          onOpenTopUp={(mem) => {
            setHistoryMemberId(null);
            setTopUpMember(mem);
          }}
        />
      )}

      {/* Pay From Wallet Modal */}
      {payMember && (
        <PayFromWalletModal
          isOpen={!!payMember}
          onClose={() => setPayMember(null)}
          member={payMember}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* Wallet Adjust / Manage Modal */}
      {adjustMember && (
        <WalletAdjustModal
          member={adjustMember}
          onClose={() => setAdjustMember(null)}
          onSuccess={() => {
            setAdjustMember(null);
            loadData();
          }}
        />
      )}

      {/* Subscription Rollover Modal */}
      {isRolloverModalOpen && (
        <SubscriptionRolloverModal
          onClose={() => setIsRolloverModalOpen(false)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};
