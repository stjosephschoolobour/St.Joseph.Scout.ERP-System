import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  Users,
  ShieldCheck,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  Info,
  Gift,
  Trophy,
  History,
  Medal,
  Tent,
  UserCheck,
} from 'lucide-react';
import { Badge, MemberBadgeSummaryRecord } from '../types';
import { badgeService } from '../services/badgeService';
import { BadgeIcon, getBadgeLucideIcon, getBadgeColorClasses } from './BadgeIcon';
import { BadgeFormModal } from './BadgeFormModal';
import { AwardBadgeModal } from './AwardBadgeModal';
import { membersService } from '../../members/services/membersService';
import { Member } from '../../members/types';
import { User } from '../../auth';
import { getPhotoUrl } from '../../../utils/photo';

interface BadgesViewProps {
  currentUser?: User | null;
  onSelectMember?: (member: Member) => void;
}

export const BadgesView: React.FC<BadgesViewProps> = ({ currentUser, onSelectMember }) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [awardedHistory, setAwardedHistory] = useState<MemberBadgeSummaryRecord[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [badgeToEdit, setBadgeToEdit] = useState<Badge | null>(null);

  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [selectedMemberForAward, setSelectedMemberForAward] = useState<Member | null>(null);

  // Quick Member Selector for Header "منح وسام"
  const [isSelectingMember, setIsSelectingMember] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  const isAdmin = currentUser?.role === 'ADMIN';

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [badgesData, historyData, membersData] = await Promise.all([
        badgeService.getBadges(),
        badgeService.getMemberBadgesSummary(),
        membersService.getMembers(),
      ]);

      setBadges(badgesData);
      setAwardedHistory(historyData);
      setAllMembers(membersData);
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل بيانات الأوسمة');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteBadge = async (badge: Badge) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف وسام "${badge.name}"؟ سيتم حذف أي سجلات منح مرتبطة به.`)) {
      return;
    }

    try {
      await badgeService.deleteBadge(badge.id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'فشل حذف الوسام');
    }
  };

  const handleRevokeAward = async (record: MemberBadgeSummaryRecord) => {
    if (!window.confirm(`هل أنت متأكد من سحب وسام "${record.badge_name}" من "${record.student_name}"؟`)) {
      return;
    }

    try {
      await badgeService.revokeBadge(record.member_id, record.badge_id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'فشل سحب الوسام');
    }
  };

  // Categories list
  const categories = ['ALL', ...Array.from(new Set(badges.map((b) => b.category).filter(Boolean)))];

  // Filtered badges
  const filteredBadges = badges.filter((b) => {
    const matchesCategory = selectedCategory === 'ALL' || b.category === selectedCategory;
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.name_en && b.name_en.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.requirements.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filtered history
  const filteredHistory = awardedHistory.filter((h) => {
    const matchesSearch =
      h.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.member_code && h.member_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      h.badge_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.reason && h.reason.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner & Title Bar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                الأوسمة والشارات الكشفية
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                أوسمة التميز والجدارة
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              إدارة وتكريم الأعضاء والقادة بالأوسمة التقديرية وتوثيق شروط ومعايير الاستحقاق
            </p>
          </div>
        </div>

        {/* Action Buttons for Admin */}
        {isAdmin && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Direct Award Button */}
            <button
              onClick={() => setIsSelectingMember(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-2xl shadow-xs transition flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Gift className="w-4 h-4" />
              <span>منح وسام لعضو أو قائد</span>
            </button>

            {/* Create Badge Definition Button */}
            <button
              onClick={() => {
                setBadgeToEdit(null);
                setIsFormModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-2xl shadow-xs transition flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة وسام جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الأوسمة المعتمدة</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {badges.length}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            شارات جدارة وسلوك ومخيمات
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الأوسمة الممنوحة</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {awardedHistory.length}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-bold">
            تكريمات رسمية مسجلة
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الأعضاء الحاصلون</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {new Set(awardedHistory.map((h) => h.member_id)).size}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            كشافين وقادة متميزين
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">فئات الأوسمة</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {categories.length - 1}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            تغطي شتى المهارات الكشفية
          </span>
        </div>
      </div>

      {/* Tabs & Search Filter Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'catalog'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Medal className="w-4 h-4" />
              <span>دليل الأوسمة ({badges.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل التكريمات الممنوحة ({awardedHistory.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute inset-y-0 right-3 my-auto text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الشروط، أو العضو..."
              className="w-full pr-9 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>

        {/* Category Pills (Catalog only) */}
        {activeTab === 'catalog' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              الفئة:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat === 'ALL' ? 'الكل' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <p className="text-sm font-bold">جاري تحميل الأوسمة الكشفية...</p>
        </div>
      ) : activeTab === 'catalog' ? (
        /* Catalog Badges Grid */
        filteredBadges.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400">
            <Award className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">
              لا توجد أوسمة مطابقة لبحثك
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBadges.map((badge) => {
              const IconComp = getBadgeLucideIcon(badge.icon);
              const colors = getBadgeColorClasses(badge.color);
              return (
                <div
                  key={badge.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Top Header Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border ${colors.bg} ${colors.text} ${colors.border}`}
                        >
                          <IconComp className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {badge.category}
                            </span>
                            {badge.name_en && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono dir-ltr">
                                {badge.name_en}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mt-1">
                            {badge.name}
                          </h3>
                        </div>
                      </div>

                      {/* Awarded Count Pill */}
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1 shrink-0"
                        title="عدد الحاصلين على هذا الوسام"
                      >
                        <Users className="w-3 h-3" />
                        <span>{badge.awarded_count || 0}</span>
                      </span>
                    </div>

                    {/* Explanation / Description Box */}
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <Info className="w-3 h-3" />
                        <span>شرح الوسام:</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {badge.description}
                      </p>
                    </div>

                    {/* Requirements Box */}
                    <div className="mt-2.5 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>شروط الحصول عليه:</span>
                      </div>
                      <p className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed font-medium whitespace-pre-line">
                        {badge.requirements}
                      </p>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {/* Hover icon demonstration */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        المظهر بجوار الاسم:
                      </span>
                      <BadgeIcon badge={badge} size="md" showTooltip={true} />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedMemberForAward(null);
                              setIsSelectingMember(true);
                            }}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="منح هذا الوسام لعضو"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>منح</span>
                          </button>

                          <button
                            onClick={() => {
                              setBadgeToEdit(badge);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="تعديل الوسام"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteBadge(badge)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="حذف الوسام"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Awarded History Tab */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                سجل التكريمات والأوسمة الممنوحة
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
              {filteredHistory.length} تكريم
            </span>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Award className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                لا توجد تكريمات مسجلة حتى الآن
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5">المكرّم</th>
                    <th className="py-3 px-3.5">الكود</th>
                    <th className="py-3 px-3.5">الصفة والعشيرة</th>
                    <th className="py-3 px-3.5">الوسام الممنوح</th>
                    <th className="py-3 px-3.5">تاريخ المنح</th>
                    <th className="py-3 px-3.5">ممنوح من قِبل</th>
                    <th className="py-3 px-3.5">سبب التكريم</th>
                    {isAdmin && <th className="py-3 px-3.5 text-center">إجراء</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistory.map((rec, idx) => (
                    <tr
                      key={rec.award_id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition"
                    >
                      <td className="py-3 px-3.5 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                            {rec.photo_path ? (
                              <img
                                src={getPhotoUrl(rec.photo_path)}
                                alt={rec.student_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const found = allMembers.find((m) => m.id === rec.member_id);
                              if (found && onSelectMember) onSelectMember(found);
                            }}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer text-right"
                          >
                            {rec.student_name}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        <button
                          type="button"
                          onClick={() => {
                            const found = allMembers.find((m) => m.id === rec.member_id);
                            if (found && onSelectMember) onSelectMember(found);
                          }}
                          className="hover:underline cursor-pointer"
                        >
                          {rec.member_code || '-'}
                        </button>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.member_type === 'قائد'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {rec.member_type}
                          </span>
                          {rec.tribe_name && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              ({rec.tribe_name})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <BadgeIcon
                            badge={{
                              id: rec.badge_id,
                              award_id: rec.award_id,
                              member_id: rec.member_id,
                              badge_id: rec.badge_id,
                              awarded_at: rec.awarded_at,
                              awarded_by: rec.awarded_by,
                              reason: rec.reason,
                              notes: rec.notes,
                              name: rec.badge_name,
                              name_en: rec.badge_name_en,
                              category: rec.badge_category,
                              icon: rec.badge_icon,
                              color: rec.badge_color,
                              description: rec.badge_description,
                              requirements: rec.badge_requirements,
                            }}
                            size="sm"
                            showTooltip={true}
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rec.badge_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-400 dir-ltr text-right">
                        {rec.awarded_at}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300">
                        {rec.awarded_by}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                        {rec.reason || '-'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3.5 text-center">
                          <button
                            onClick={() => handleRevokeAward(rec)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                            title="سحب هذا الوسام"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Member Selection Dialog for Direct Awarding */}
      {isSelectingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in text-right">
            <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                <h3 className="font-black text-sm sm:text-base">اختر العضو أو القائد لمنحه الوسام</h3>
              </div>
              <button
                onClick={() => setIsSelectingMember(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute inset-y-0 right-3 my-auto text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  placeholder="ابحث بالاسم أو كود العضوية..."
                  className="w-full pr-9 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {allMembers
                  .filter((m) =>
                    m.student_name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                    (m.member_code && m.member_code.toLowerCase().includes(memberSearchTerm.toLowerCase()))
                  )
                  .slice(0, 15)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedMemberForAward(m);
                        setIsSelectingMember(false);
                        setIsAwardModalOpen(true);
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-right transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                          {m.photo_path ? (
                            <img
                              src={getPhotoUrl(m.photo_path)}
                              alt={m.student_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {m.student_name}
                          </p>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {m.member_type} {m.tribe_name ? `• ${m.tribe_name}` : ''}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {m.member_code || `sc${String(m.id).padStart(6, '0')}`}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Badge Form Modal (Create / Edit) */}
      <BadgeFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        badgeToEdit={badgeToEdit}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Award Badge Modal */}
      {selectedMemberForAward && (
        <AwardBadgeModal
          isOpen={isAwardModalOpen}
          onClose={() => {
            setIsAwardModalOpen(false);
            setSelectedMemberForAward(null);
          }}
          memberId={selectedMemberForAward.id}
          memberName={selectedMemberForAward.student_name}
          memberCode={selectedMemberForAward.member_code}
          memberType={selectedMemberForAward.member_type}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};
