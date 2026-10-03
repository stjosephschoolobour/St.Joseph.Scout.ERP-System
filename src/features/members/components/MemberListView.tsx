import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit,
  Eye,
  AlertTriangle,
  UserCheck,
  Award,
  BookOpen,
  X,
  Tent,
  User as UserIcon,
  Phone,
  Sparkles,
  Gift,
  Mail,
  IdCard,
  CheckSquare,
  Square,
  MinusSquare,
  ArrowRightLeft,
  FolderDown,
  Users,
  CheckCircle2,
  Loader2,
  Camera,
} from 'lucide-react';
import { Member, SchoolStage } from '../types';
import { User } from '../../auth/types';
import { Tribe } from '../../tribes/types';
import { tribesService } from '../../tribes/services/tribesService';
import { getPhotoUrl } from '../../../utils/photo';
import { badgeService } from '../../badges/services/badgeService';
import { MemberBadgeSummaryRecord } from '../../badges/types';
import { BadgeIcon } from '../../badges/components/BadgeIcon';
import { AwardBadgeModal } from '../../badges/components/AwardBadgeModal';
import { ScoutIdCardModal } from './ScoutIdCardModal';
import { BulkTransferTribeModal } from './BulkTransferTribeModal';
import { BulkAwardBadgeModal } from './BulkAwardBadgeModal';
import { BulkExportIdCardsModal } from './BulkExportIdCardsModal';
import { membersService } from '../services/membersService';
import { backupService } from '../../backup/services/backupService';

export interface MemberListViewProps {
  members: Member[];
  user: User;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedStage: string;
  onStageChange: (val: string) => void;
  selectedType: string;
  onTypeChange: (val: string) => void;
  selectedTribe?: string;
  onTribeChange?: (val: string) => void;
  onViewCard: (member: Member) => void;
  onPreviewIdCard?: (member: Member) => void;
  onEditMember: (member: Member) => void;
  onPromoteMember?: (member: Member, leaderPhone: string, leaderEmail?: string) => Promise<void>;
  onDeleteMember: (id: number) => void;
  onOpenAddModal: () => void;
  onRefresh?: () => void;
}

export const MemberListView: React.FC<MemberListViewProps> = ({
  members,
  user,
  searchTerm,
  onSearchChange,
  selectedStage,
  onStageChange,
  selectedType,
  onTypeChange,
  selectedTribe = 'ALL',
  onTribeChange,
  onViewCard,
  onPreviewIdCard,
  onEditMember,
  onPromoteMember,
  onDeleteMember,
  onOpenAddModal,
  onRefresh,
}) => {
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [memberToPromote, setMemberToPromote] = useState<Member | null>(null);
  const [memberForIdCard, setMemberForIdCard] = useState<Member | null>(null);
  const [promoteLeaderPhone, setPromoteLeaderPhone] = useState('');
  const [promoteLeaderEmail, setPromoteLeaderEmail] = useState('');
  const [promoteError, setPromoteError] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);
  const [tribesList, setTribesList] = useState<Tribe[]>([]);

  // Badges state
  const [badgesByMemberId, setBadgesByMemberId] = useState<Record<number, MemberBadgeSummaryRecord[]>>({});
  const [memberToAward, setMemberToAward] = useState<Member | null>(null);

  // Bulk operations state (Admin only)
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkTransferModalOpen, setIsBulkTransferModalOpen] = useState(false);
  const [isBulkAwardModalOpen, setIsBulkAwardModalOpen] = useState(false);
  const [isBulkExportModalOpen, setIsBulkExportModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkNotification, setBulkNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isAdmin = user.role === 'ADMIN';

  const stagesList: (SchoolStage | 'ALL')[] = ['ALL', 'ابتدائي', 'إعدادي', 'ثانوي', 'جامعة', 'أخرى'];

  const loadBadges = async () => {
    try {
      const summary = await badgeService.getMemberBadgesSummary();
      const map: Record<number, MemberBadgeSummaryRecord[]> = {};
      summary.forEach((rec) => {
        if (!map[rec.member_id]) {
          map[rec.member_id] = [];
        }
        map[rec.member_id].push(rec);
      });
      setBadgesByMemberId(map);
    } catch (err) {
      console.error('Failed to load badges summary in member list:', err);
    }
  };

  useEffect(() => {
    tribesService.getTribes().then(setTribesList).catch(() => {});
    loadBadges();
  }, []);

  const handleConfirmDelete = () => {
    if (memberToDelete) {
      onDeleteMember(memberToDelete.id);
      setMemberToDelete(null);
    }
  };

  const handleConfirmPromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToPromote) return;
    const phone = promoteLeaderPhone.trim();
    if (!phone) {
      setPromoteError('يرجى إدخال رقم تليفون القائد');
      return;
    }
    if (!/^01[0125][0-9]{8}$/.test(phone) && !/^[0-9]{7,15}$/.test(phone)) {
      setPromoteError('رقم تليفون القائد غير صالح (مثال: 01012345678)');
      return;
    }
    const email = promoteLeaderEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPromoteError('البريد الإلكتروني للقائد غير صالح');
      return;
    }
    setPromoteError('');
    setIsPromoting(true);
    try {
      if (onPromoteMember) {
        await onPromoteMember(memberToPromote, phone, email || undefined);
      }
      setMemberToPromote(null);
      setPromoteLeaderPhone('');
      setPromoteLeaderEmail('');
    } catch (err: any) {
      setPromoteError(err?.message || 'فشلت عملية الترقية');
    } finally {
      setIsPromoting(false);
    }
  };

  // Filter members client-side if tribe filter is set and not already handled upstream
  const filteredMembers = members.filter((m) => {
    if (selectedTribe && selectedTribe !== 'ALL') {
      if (selectedTribe === 'NONE') {
        return !m.tribe_id;
      }
      return String(m.tribe_id) === selectedTribe;
    }
    return true;
  });

  // Bulk Selection Helpers
  const isAllSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedMemberIds.includes(m.id));

  const isSomeSelected =
    selectedMemberIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredMembers.map((m) => m.id));
    }
  };

  const handleToggleSelectMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectGroup = (type: 'all' | 'scouts' | 'leaders' | 'none') => {
    if (type === 'none') {
      setSelectedMemberIds([]);
    } else if (type === 'all') {
      setSelectedMemberIds(filteredMembers.map((m) => m.id));
    } else if (type === 'scouts') {
      setSelectedMemberIds(
        filteredMembers.filter((m) => m.member_type === 'عضوة').map((m) => m.id)
      );
    } else if (type === 'leaders') {
      setSelectedMemberIds(
        filteredMembers.filter((m) => m.member_type === 'قائد').map((m) => m.id)
      );
    }
  };

  // Selected member objects
  const selectedMembersList = members.filter((m) =>
    selectedMemberIds.includes(m.id)
  );

  // Bulk Delete Confirmation
  const handleConfirmBulkDelete = async () => {
    if (selectedMemberIds.length === 0) return;
    try {
      setIsDeletingBulk(true);
      const res = await membersService.bulkDeleteMembers(selectedMemberIds);
      setSelectedMemberIds([]);
      setIsBulkDeleteModalOpen(false);
      setBulkNotification({ message: res.message, type: 'success' });
      setTimeout(() => setBulkNotification(null), 4500);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setBulkNotification({
        message: err?.message || 'فشلت عملية الحذف الجماعي',
        type: 'error',
      });
      setTimeout(() => setBulkNotification(null), 4500);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleBulkActionSuccess = (msg: string) => {
    setBulkNotification({ message: msg, type: 'success' });
    setTimeout(() => setBulkNotification(null), 4500);
    setSelectedMemberIds([]);
    if (onRefresh) {
      onRefresh();
    }
    loadBadges();
  };

  return (
    <div className="space-y-5">
      {/* Top Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="search_member_input"
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث بالاسم، كود العضوية (A250001)، الرقم القومي، أو العشيرة..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            id="btn_photos_backup_all"
            onClick={() => {
              const url = backupService.getPhotosBackupDownloadUrl();
              window.open(url, '_blank');
            }}
            title="تحميل نسخة احتياطية لصور جميع الأعضاء بملف مضغوط ZIP"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-xs sm:text-sm shrink-0 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-indigo-200" />
            <span>نسخة احتياطية للصور</span>
          </button>

          <button
            id="btn_list_add_member"
            onClick={onOpenAddModal}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-xs sm:text-sm shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عضو جديد</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
          {/* Grade */}
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>الصف:</span>
          </div>
          <select
            id="select_filter_stage"
            value={selectedStage}
            onChange={(e) => onStageChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold transition bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value="ALL">جميع الصفوف والمراحل</option>
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

          {/* Type */}
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mr-2">
            <span>الصفة:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => onTypeChange('ALL')}
                className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                  selectedType === 'ALL'
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => onTypeChange('عضوة')}
                className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                  selectedType === 'عضوة'
                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                العضوات
              </button>
              <button
                onClick={() => onTypeChange('قائد')}
                className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                  selectedType === 'قائد'
                    ? 'bg-amber-600 text-white border-amber-600 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                القادة
              </button>
            </div>
          </div>

          {/* Tribe Filter */}
          {onTribeChange && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mr-auto">
              <Tent className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>العشيرة:</span>
              <select
                value={selectedTribe}
                onChange={(e) => onTribeChange(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">جميع العشائر</option>
                <option value="NONE">بدون عشيرة</option>
                {tribesList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Notification Toast */}
      {bulkNotification && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-lg animate-slide-down ${
            bulkNotification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {bulkNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{bulkNotification.message}</span>
          </div>
          <button
            onClick={() => setBulkNotification(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Bulk Actions Sticky / Prominent Toolbar */}
      {isAdmin && selectedMemberIds.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-4 shadow-xl border border-emerald-500/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 animate-scale-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-black text-sm shrink-0 shadow-inner">
              {selectedMemberIds.length}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">
                  تم تحديد ({selectedMemberIds.length}) عضو
                </span>
                <span className="text-[11px] text-emerald-400/90 font-medium">
                  من أصل {filteredMembers.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                يمكنك تطبيق الإجراء الجماعي المختار على كافة الأعضاء المحددين
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* 1. Export ID Cards */}
            <button
              onClick={() => setIsBulkExportModalOpen(true)}
              title="تصدير وطباعة كارنيهات الأعضاء المحددين وحفظها في C:\scoutsystem\scoutphoto"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FolderDown className="w-4 h-4 text-blue-200" />
              <span>تصدير وطباعة الكارنيهات</span>
            </button>

            {/* 1.5 Download Selected Photos */}
            <button
              id="btn_download_selected_photos"
              onClick={() => {
                if (selectedMemberIds.length === 0) return;
                const url = backupService.getPhotosBackupDownloadUrl(selectedMemberIds);
                window.open(url, '_blank');
              }}
              title="تحميل صور الأعضاء المحددين فقط كملف مضغوط (ZIP)"
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Camera className="w-4 h-4 text-indigo-200" />
              <span>تحميل صور المحدد (ZIP)</span>
            </button>

            {/* 2. Transfer to Tribe */}
            <button
              onClick={() => setIsBulkTransferModalOpen(true)}
              title="نقل الأعضاء المحددين إلى عشيرة كشفية محددة"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-emerald-200" />
              <span>نقل إلى عشيرة</span>
            </button>

            {/* 3. Award Badge */}
            <button
              onClick={() => setIsBulkAwardModalOpen(true)}
              title="منح وسام كشفي لجميع الأعضاء المحددين"
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-200" />
              <span>منح وسام كشفي</span>
            </button>

            {/* 4. Bulk Delete */}
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              title="حذف الأعضاء المحددين نهائياً"
              className="px-3.5 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-200" />
              <span>حذف المحدد</span>
            </button>

            {/* Deselect All */}
            <button
              onClick={() => setSelectedMemberIds([])}
              title="إلغاء التحديد"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                قائمة الأعضاء
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                {filteredMembers.length} عضو
              </span>
            </div>

            {/* Quick Group Select Chips for Admin */}
            {isAdmin && filteredMembers.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-bold border-r border-slate-200 dark:border-slate-700 pr-3 mr-2">
                <span className="text-slate-400 hidden sm:inline">تحديد سريع:</span>
                <button
                  type="button"
                  onClick={() => handleSelectGroup('all')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  الكل ({filteredMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectGroup('scouts')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  العضوات ({filteredMembers.filter((m) => m.member_type === 'عضوة').length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectGroup('leaders')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  القادة ({filteredMembers.filter((m) => m.member_type === 'قائد').length})
                </button>
                {selectedMemberIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectGroup('none')}
                    className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                )}
              </div>
            )}
          </div>

          {searchTerm && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              نتائج البحث عن:{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                "{searchTerm}"
              </span>
            </span>
          )}
        </div>

        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              لا يوجد أعضاء مطابقين للبحث أو الفلتر
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              تأكد من كتابة الاسم أو الرقم القومي بدقة أو أضف عضواً جديداً
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {/* Admin Checkbox Column */}
                  {isAdmin && (
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        title={isAllSelected ? 'إلغاء تحديد الكل' : 'تحديد جميع المعروضين'}
                        className="p-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : isSomeSelected ? (
                          <MinusSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">الصورة</th>
                  <th className="py-3 px-3.5">كود العضو</th>
                  <th className="py-3 px-3.5">الاسم والأوسمة</th>
                  <th className="py-3 px-3.5">رقم الهاتف</th>
                  <th className="py-3 px-3.5">الرقم القومي</th>
                  <th className="py-3 px-3.5">الصف الدراسي</th>
                  <th className="py-3 px-3.5">العشيرة</th>
                  <th className="py-3 px-3.5">الصفة</th>
                  <th className="py-3 px-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMembers.map((m, idx) => {
                  const memberBadges = badgesByMemberId[m.id] || [];
                  const isSelected = selectedMemberIds.includes(m.id);
                  return (
                    <tr
                      key={m.id}
                      className={`transition ${
                        isSelected
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Admin Checkbox Cell */}
                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectMember(m.id)}
                            title={isSelected ? 'إلغاء التحديد' : 'تحديد العضو'}
                            className="p-1 text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                            )}
                          </button>
                        </td>
                      )}

                      <td className="py-3 px-3.5 font-mono text-slate-400 text-[11px]">{idx + 1}</td>

                      {/* Photo Thumbnail */}
                      <td className="py-2.5 px-3.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                          {m.photo_path ? (
                            <img
                              src={getPhotoUrl(m.photo_path)}
                              alt={m.student_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Member Code */}
                      <td className="py-3 px-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {m.member_code || `A25${String(m.id).padStart(4, '0')}`}
                      </td>

                      {/* Name + Scout Badges Icons */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {m.student_name}
                          </span>
                          {/* Render badge icons if any */}
                          {memberBadges.length > 0 && (
                            <div className="flex items-center gap-1">
                              {memberBadges.map((b) => (
                                <BadgeIcon
                                  key={`tbl-${b.award_id}`}
                                  badge={{
                                    id: b.badge_id,
                                    award_id: b.award_id,
                                    member_id: b.member_id,
                                    badge_id: b.badge_id,
                                    awarded_at: b.awarded_at,
                                    awarded_by: b.awarded_by,
                                    reason: b.reason,
                                    notes: b.notes,
                                    name: b.badge_name,
                                    name_en: b.badge_name_en,
                                    category: b.badge_category,
                                    icon: b.badge_icon,
                                    color: b.badge_color,
                                    description: b.badge_description,
                                    requirements: b.badge_requirements,
                                  }}
                                  size="xs"
                                  showTooltip={true}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-mono text-slate-700 dark:text-slate-300 text-xs">
                          {m.member_type === 'قائد'
                            ? (m.leader_phone || m.father_phone || '-')
                            : (m.mother_phone || m.father_phone || '-')}
                        </div>
                        {(m.member_type === 'قائد' ? m.leader_email : m.mother_email) && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5" dir="ltr">
                            <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                            <span className="truncate max-w-[140px]">
                              {m.member_type === 'قائد' ? m.leader_email : m.mother_email}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-700 dark:text-slate-300">
                        {m.national_id}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                          {m.school_stage}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        {m.tribe_name ? (
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-md text-[11px] font-bold border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                            <Tent className="w-3 h-3" />
                            {m.tribe_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                            m.member_type === 'قائد'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {m.member_type === 'قائد' ? (
                            <Award className="w-3 h-3" />
                          ) : (
                            <UserCheck className="w-3 h-3" />
                          )}
                          {m.member_type}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewCard(m)}
                            title="عرض البطاقة"
                            className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Preview & Print ID Card (CR80) */}
                          <button
                            onClick={() => {
                              if (onPreviewIdCard) {
                                onPreviewIdCard(m);
                              } else {
                                setMemberForIdCard(m);
                              }
                            }}
                            title="كارنيه الكشافة: معاينة، طباعة ومشاركة"
                            className="p-1.5 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition cursor-pointer"
                          >
                            <IdCard className="w-4 h-4" />
                          </button>

                          {/* Admin Award Badge Quick Trigger */}
                          {isAdmin && (
                            <button
                              onClick={() => setMemberToAward(m)}
                              title="منح وسام كشفي"
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition cursor-pointer"
                            >
                              <Gift className="w-4 h-4" />
                            </button>
                          )}

                          {m.member_type === 'عضوة' && (
                            <button
                              onClick={() => {
                                setMemberToPromote(m);
                                setPromoteLeaderPhone(
                                  m.leader_phone || m.father_phone || m.mother_phone || ''
                                );
                                setPromoteError('');
                              }}
                              title="ترقية العضوة إلى قائد"
                              className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition cursor-pointer"
                            >
                              <Award className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditMember(m)}
                            title="تعديل العضو"
                            className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setMemberToDelete(m)}
                              title="حذف العضو"
                              className="p-1.5 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Delete Confirmation Modal (ADMIN only) */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 text-center animate-scale-in">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              هل أنت متأكد من حذف هذا العضو؟
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              سيتم حذف بيانات{' '}
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {memberToDelete.student_name}
              </span>{' '}
              (كود: {memberToDelete.member_code || memberToDelete.id} - الرقم القومي:{' '}
              {memberToDelete.national_id}) نهائياً من قاعدة البيانات وتسجيل العملية في سجل الرقابة.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn_confirm_delete"
                onClick={handleConfirmDelete}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer"
              >
                حذف نهائي
              </button>
              <button
                id="btn_cancel_delete"
                onClick={() => setMemberToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote to Leader Modal */}
      {memberToPromote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 animate-scale-in text-right">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-1 text-center">
              ترقية العضوة إلى رتبة قائد
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 text-center">
              تغيير صفة العضو في السجلات الرسمية للكشافة
            </p>

            <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">اسم الطالبة:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {memberToPromote.student_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                <span className="text-slate-600 dark:text-slate-400 font-medium">كود العضو:</span>
                <span className="font-mono font-bold text-amber-900 dark:text-amber-300">
                  {memberToPromote.member_code}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                <span className="text-slate-600 dark:text-slate-400 font-medium">الصف الدراسي:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {memberToPromote.school_stage}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmPromote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>
                    رقم تليفون القائد <span className="text-rose-500">*</span>
                  </span>
                </label>
                <input
                  id="input_promote_leader_phone"
                  type="tel"
                  dir="ltr"
                  autoFocus
                  value={promoteLeaderPhone}
                  onChange={(e) => {
                    setPromoteLeaderPhone(e.target.value);
                    if (promoteError) setPromoteError('');
                  }}
                  placeholder="01012345678"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition ${
                    promoteError
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {promoteError ? (
                  <p className="text-rose-500 text-[11px] font-semibold mt-1">{promoteError}</p>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                    يتطلب النظام إدخال رقم تليفون القائد للتواصل الكشفي والإداري وإرسال التنبيهات.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>البريد الإلكتروني الخاص بالقائد</span>
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                    اختياري
                  </span>
                </label>
                <input
                  id="input_promote_leader_email"
                  type="email"
                  dir="ltr"
                  value={promoteLeaderEmail}
                  onChange={(e) => {
                    setPromoteLeaderEmail(e.target.value);
                    if (promoteError) setPromoteError('');
                  }}
                  placeholder="leader@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-sm text-left text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                />
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                  البريد الإلكتروني الشخصي للقائد للمراسلات الرسمية والإشعارات
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  id="btn_confirm_promote"
                  disabled={isPromoting}
                  className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isPromoting ? (
                    <span>جاري الترقية...</span>
                  ) : (
                    <>
                      <Award className="w-4 h-4" />
                      <span>تأكيد الترقية لقائد</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  id="btn_cancel_promote"
                  disabled={isPromoting}
                  onClick={() => {
                    setMemberToPromote(null);
                    setPromoteLeaderPhone('');
                    setPromoteLeaderEmail('');
                    setPromoteError('');
                  }}
                  className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Award Badge Modal from Member Table */}
      {memberToAward && (
        <AwardBadgeModal
          isOpen={!!memberToAward}
          onClose={() => setMemberToAward(null)}
          memberId={memberToAward.id}
          memberName={memberToAward.student_name}
          memberCode={memberToAward.member_code}
          memberType={memberToAward.member_type}
          onSuccess={() => {
            loadBadges();
          }}
        />
      )}

      {/* Scout ID Card Preview & Print Modal */}
      {memberForIdCard && (
        <ScoutIdCardModal
          isOpen={!!memberForIdCard}
          member={memberForIdCard}
          onClose={() => setMemberForIdCard(null)}
        />
      )}

      {/* Bulk Delete Modal (Admin Only) */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 text-center animate-scale-in">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">
              تأكيد حذف مجموعة الأعضاء المحددة
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              أنت على وشك حذف بيانات{' '}
              <span className="font-bold text-rose-600 dark:text-rose-400">
                ({selectedMemberIds.length}) عضو
              </span>{' '}
              دفعة واحدة، بما يشمل سجلات العضوية، الأوسمة، والمعاملات المالية المرتبطة نهائياً من قاعدة البيانات.
            </p>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 font-semibold mb-6">
              ⚠️ هذا الإجراء غير قابل للتراجع وسيتم توثيقه في سجل الرقابة المباشر.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isDeletingBulk}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeletingBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>نعم، حذف الكل ({selectedMemberIds.length})</span>
                )}
              </button>
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Transfer to Tribe Modal */}
      {isBulkTransferModalOpen && (
        <BulkTransferTribeModal
          isOpen={isBulkTransferModalOpen}
          selectedMembers={selectedMembersList}
          tribes={tribesList}
          onClose={() => setIsBulkTransferModalOpen(false)}
          onSuccess={handleBulkActionSuccess}
        />
      )}

      {/* Bulk Award Badge Modal */}
      {isBulkAwardModalOpen && (
        <BulkAwardBadgeModal
          isOpen={isBulkAwardModalOpen}
          selectedMembers={selectedMembersList}
          onClose={() => setIsBulkAwardModalOpen(false)}
          onSuccess={handleBulkActionSuccess}
        />
      )}

      {/* Bulk Export & Print ID Cards Modal */}
      {isBulkExportModalOpen && (
        <BulkExportIdCardsModal
          isOpen={isBulkExportModalOpen}
          selectedMembers={selectedMembersList}
          onClose={() => setIsBulkExportModalOpen(false)}
          onSuccess={handleBulkActionSuccess}
        />
      )}
    </div>
  );
};
