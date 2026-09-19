import React, { useState, useEffect } from 'react';
import {
  Printer,
  Edit,
  ShieldCheck,
  User,
  Phone,
  HeartPulse,
  Tent,
  MapPin,
  Sparkles,
  Briefcase,
  Award,
  Plus,
  Mail,
} from 'lucide-react';
import { Member } from '../types';
import { calculateAge } from '../../../utils/validators';
import { getPhotoUrl } from '../../../utils/photo';
import { badgeService } from '../../badges/services/badgeService';
import { MemberBadge } from '../../badges/types';
import { BadgeIcon } from '../../badges/components/BadgeIcon';
import { AwardBadgeModal } from '../../badges/components/AwardBadgeModal';
import { authService } from '../../auth/services/authService';
import { Wallet, Coins, History, IdCard } from 'lucide-react';
import { walletService } from '../../wallets/services/walletService';
import { TopUpModal } from '../../wallets/components/TopUpModal';
import { WalletHistoryModal } from '../../wallets/components/WalletHistoryModal';
import { ScoutIdCardModal } from './ScoutIdCardModal';
import { ScoutEmblem } from './ScoutEmblem';
import { settingsService } from '../../settings/services/settingsService';
import { SystemSettings } from '../../settings/types';

export interface MemberCardModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (member: Member) => void;
}

export const MemberCardModal: React.FC<MemberCardModalProps> = ({
  member,
  isOpen,
  onClose,
  onEdit,
}) => {
  const [memberBadges, setMemberBadges] = useState<MemberBadge[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);

  // Dynamic Scout Group Branding from System Settings
  const [currentSettings, setCurrentSettings] = useState<SystemSettings | null>(() => {
    return settingsService.getCachedSettings();
  });

  useEffect(() => {
    const cached = settingsService.getCachedSettings();
    if (cached) {
      setCurrentSettings(cached);
    } else {
      settingsService.getSettings().then(setCurrentSettings).catch(() => {});
    }
    return settingsService.subscribe(setCurrentSettings);
  }, []);

  const scoutGroupName = currentSettings?.scout_group_name || 'مجموعة الكشافة والمرشدات';
  const schoolName = currentSettings?.school_name || 'مدرسة القديس يوسف بالعبور';
  const scoutGroupNameEn = currentSettings?.scout_group_name_en;
  const scoutLogoUrl = currentSettings?.scout_logo_url;
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState(false);

  // Wallet states
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const currentUser = authService.getUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  const loadBadges = async () => {
    if (!member) return;
    try {
      setIsLoadingBadges(true);
      const badges = await badgeService.getMemberBadges(member.id);
      setMemberBadges(badges);
    } catch (err) {
      console.error('Failed to load member badges:', err);
    } finally {
      setIsLoadingBadges(false);
    }
  };

  const loadWallet = async () => {
    if (!member) return;
    try {
      const res = await walletService.getMemberWallet(member.id);
      setWalletBalance(res.balance);
    } catch {
      setWalletBalance(null);
    }
  };

  useEffect(() => {
    if (isOpen && member) {
      loadBadges();
      loadWallet();
    } else {
      setMemberBadges([]);
      setWalletBalance(null);
    }
  }, [isOpen, member?.id]);

  if (!isOpen || !member) return null;

  const age = calculateAge(member.birth_date);

  const handlePrint = () => {
    window.print();
  };

  const handleRevokeBadge = async (b: any) => {
    if (!window.confirm(`هل أنت متأكد من سحب وسام "${b.name}" من هذا العضو؟`)) {
      return;
    }
    try {
      await badgeService.revokeBadge(member.id, b.badge_id || b.id);
      loadBadges();
    } catch (err: any) {
      alert(err?.message || 'فشل سحب الوسام');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-scale-in text-right">
          {/* Printable Card Area */}
          <div id="scout_member_card" className="p-7 bg-white dark:bg-slate-900 relative">
            {/* Card Top Banner */}
            <div className="flex items-center justify-between pb-5 border-b-2 border-slate-900 dark:border-slate-700">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center p-1 text-white shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {scoutLogoUrl ? (
                    <img
                      src={scoutLogoUrl}
                      alt={scoutGroupName}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ScoutEmblem size={44} groupNameEn={scoutGroupNameEn} />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    بطاقة عضوية الكشافة
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                    {scoutGroupName} ({schoolName})
                  </p>
                </div>
              </div>
              <div className="text-left">
                <span
                  className={`inline-block px-3 py-1 rounded-lg text-xs font-black tracking-wide ${
                    member.member_type === 'قائد'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  }`}
                >
                  {member.member_type}
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold mt-1 dir-ltr text-right">
                  {member.member_code || `sc${String(member.id).padStart(6, '0')}`}
                </p>
              </div>
            </div>

            {/* Member Photo + Name Block + Badges */}
            <div className="mt-5 flex items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                {member.photo_path ? (
                  <img
                    src={getPhotoUrl(member.photo_path)}
                    alt={member.student_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400">
                    <User className="w-8 h-8" />
                    <span className="text-[9px] mt-0.5 font-bold">بدون صورة</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    {member.member_code || `sc${String(member.id).padStart(6, '0')}`}
                  </span>
                  {member.tribe_name && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1">
                      <Tent className="w-3 h-3" />
                      {member.tribe_name}
                    </span>
                  )}
                </div>

                {/* Member Name + Badges Icons Beside Name */}
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <h2 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100">
                    {member.student_name}
                  </h2>

                  {/* Scout Badges Beside Name */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {memberBadges.map((badge) => (
                      <BadgeIcon
                        key={badge.award_id || badge.badge_id}
                        badge={badge}
                        size="sm"
                        showTooltip={true}
                        canRevoke={isAdmin}
                        onRevoke={handleRevokeBadge}
                      />
                    ))}

                    {/* Admin Award Badge Quick Trigger */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAwardModalOpen(true);
                        }}
                        className="p-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                        title="منح وسام كشفي لهذا العضو"
                      >
                        <Plus className="w-3 h-3" />
                        <span>منح وسام</span>
                      </button>
                    )}
                  </div>
                </div>

                {member.student_name_en && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 dir-ltr text-right mt-0.5">
                    {member.student_name_en}
                  </p>
                )}
              </div>
            </div>

            {/* Badges Ribbon Showcase (If member has badges) */}
            {memberBadges.length > 0 && (
              <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200">
                    <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>الأوسمة والشارات التقديرية الحاصل عليها ({memberBadges.length}):</span>
                  </div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                    (مرر الفأرة فوق أي وسام لقراءة شرحه وشروطه)
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {memberBadges.map((b) => (
                    <div
                      key={`strip-${b.award_id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 shadow-2xs"
                    >
                      <BadgeIcon badge={b} size="xs" showTooltip={true} />
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        {b.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scout Wallet Strip */}
            <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                    رصيد المحفظة الكشفية
                  </p>
                  <p className="text-base font-black text-emerald-950 dark:text-emerald-100 font-mono">
                    {walletBalance !== null ? `${walletBalance.toLocaleString()} ج.م` : '0 ج.م'}
                  </p>
                </div>
              </div>

              {/* Action buttons (No print) */}
              <div className="flex items-center gap-1.5 no-print">
                <button
                  type="button"
                  onClick={() => setIsTopUpOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>شحن رصيد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>كشف الحساب</span>
                </button>
              </div>
            </div>

            {/* Detailed Info Grid */}
            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    الرقم القومي
                  </p>
                  <p className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 mt-1">
                    {member.national_id}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    تاريخ الميلاد
                  </p>
                  <p className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 mt-1">
                    {member.birth_date}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">العمر</p>
                  <p className="font-black text-sm text-emerald-950 dark:text-emerald-200 mt-0.5">
                    {age} سنة
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    الصف الدراسي
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {member.school_stage}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    سنة الالتحاق
                  </p>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {member.scout_join_year}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    العشيرة (Tribe)
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {member.tribe_name || (
                      <span className="text-slate-400 font-normal">غير محدد</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Guardian Name if exists */}
              {member.guardian_name && member.guardian_name.trim() && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    اسم ولي الأمر:
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {member.guardian_name}
                  </p>
                </div>
              )}

              {/* Parents Jobs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-500" />
                    وظيفة الأب
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {member.father_job || (
                      <span className="text-slate-400 font-normal">غير مسجل</span>
                    )}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-500" />
                    وظيفة الأم
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {member.mother_job || (
                      <span className="text-slate-400 font-normal">غير مسجل</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Address */}
              {member.address && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    العنوان بالتفصيل:
                  </p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {member.address}
                  </p>
                </div>
              )}

              {/* Talents & Skills */}
              {member.talents_skills && (
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    الموهبة والمهارة:
                  </p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {member.talents_skills}
                  </p>
                </div>
              )}

              {/* Health Condition */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5 mb-1">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  الحالة المرضية:
                </p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {member.medical_condition && member.medical_condition.trim() ? (
                    <span className="text-rose-700 dark:text-rose-400 font-bold">
                      {member.medical_condition}
                    </span>
                  ) : (
                    <span className="text-slate-400">لا توجد حالات مرضية مسجلة (سليمة)</span>
                  )}
                </p>
              </div>

              {/* Contact Information (Phone & Email) */}
              {member.member_type === 'قائد' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-amber-900 dark:text-amber-300 font-bold">
                        رقم تليفون القائد
                      </p>
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                        {member.leader_phone || member.father_phone || 'غير مسجل'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-amber-900 dark:text-amber-300 font-bold">
                        البريد الإلكتروني الخاص للقائد
                      </p>
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate" dir="ltr">
                        {member.leader_email || 'غير مسجل'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                      <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          هاتف الأب
                        </p>
                        <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                          {member.father_phone || 'غير مسجل'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                      <Phone className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          هاتف الأم
                        </p>
                        <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                          {member.mother_phone || 'غير مسجل'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                    <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                        البريد الإلكتروني الخاص بالأم
                      </p>
                      <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate" dir="ltr">
                        {member.mother_email || 'غير مسجل'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Stamp */}
              <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-[10px] text-slate-400">
                <span>تاريخ استخراج البطاقة: {new Date().toLocaleDateString('ar-EG')}</span>
                <span>ختم إدارة {scoutGroupName}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons (no-print) */}
          <div className="bg-slate-100 dark:bg-slate-800 px-6 py-4 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 no-print">
            <div className="flex items-center gap-2">
              <button
                id="btn_card_edit"
                onClick={() => {
                  onClose();
                  onEdit(member);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                تعديل
              </button>

              <button
                id="btn_card_id_modal"
                onClick={() => setIsIdCardModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="معاينة الوجه الأمامي والخلفي للكارنيه وطباعته ومشاركته"
              >
                <IdCard className="w-4 h-4" />
                كارنيه الكشافة (CR80)
              </button>

              <button
                id="btn_card_print"
                onClick={handlePrint}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                طباعة الملف
              </button>
            </div>

            <button
              id="btn_card_close"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-300 dark:border-slate-600 transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Award Badge Modal */}
      {isAwardModalOpen && (
        <AwardBadgeModal
          isOpen={isAwardModalOpen}
          onClose={() => setIsAwardModalOpen(false)}
          memberId={member.id}
          memberName={member.student_name}
          memberCode={member.member_code}
          memberType={member.member_type}
          onSuccess={() => {
            loadBadges();
          }}
        />
      )}

      {/* Wallet Top-Up Modal */}
      {isTopUpOpen && (
        <TopUpModal
          isOpen={isTopUpOpen}
          onClose={() => setIsTopUpOpen(false)}
          member={{
            id: member.id,
            student_name: member.student_name,
            member_code: member.member_code || `sc${String(member.id).padStart(6, '0')}`,
            member_type: member.member_type,
            balance: walletBalance ?? 0,
            photo_path: member.photo_path,
          }}
          memberId={member.id}
          memberName={member.student_name}
          memberCode={member.member_code}
          currentBalance={walletBalance ?? 0}
          onSuccess={() => {
            loadWallet();
          }}
        />
      )}

      {/* Wallet History Modal */}
      {isHistoryOpen && (
        <WalletHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          memberId={member.id}
          onOpenTopUp={() => {
            setIsHistoryOpen(false);
            setIsTopUpOpen(true);
          }}
        />
      )}

      {/* Scout ID Card Modal */}
      {isIdCardModalOpen && (
        <ScoutIdCardModal
          isOpen={isIdCardModalOpen}
          member={member}
          onClose={() => setIsIdCardModalOpen(false)}
        />
      )}
    </>
  );
};
