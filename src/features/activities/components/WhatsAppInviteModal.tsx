import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Copy,
  Check,
  Search,
  Filter,
  Users,
  Send,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
  Shield,
  Phone,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Edit3,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Activity, ActivityParticipant } from '../types';
import { Member } from '../../members/types';
import { Tribe } from '../../tribes/types';
import { tribesService } from '../../tribes/services/tribesService';

interface SystemSettings {
  school_name?: string;
  system_name?: string;
  current_year?: string;
}

interface WhatsAppInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
  participants?: ActivityParticipant[];
  allMembers: Member[];
  settings?: SystemSettings | null;
  onSuccess?: (msg: string) => void;
}

/**
 * Normalizes phone numbers for WhatsApp API (wa.me)
 * Handles Egyptian mobile formats (010, 011, 012, 015) and international numbers
 */
export function formatWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  // Strip all non-digit characters
  let cleaned = phone.replace(/[^\d]/g, '');

  // Strip international leading 00
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Egyptian standard 11 digits starting with 01
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '20' + cleaned.substring(1);
  }

  // Egyptian 10 digits missing leading 0 (e.g. 10xxxxxxxx)
  if (!cleaned.startsWith('20') && cleaned.length === 10 && cleaned.startsWith('1')) {
    return '20' + cleaned;
  }

  return cleaned;
}

/**
 * Builds the official WhatsApp invitation text
 */
export function buildActivityInvitationText({
  activity,
  studentName,
  guardianName,
  isRegistered = false,
  paymentStatus,
  paidAmount,
  customNotes,
  systemName = 'إدارة الكشافة',
  schoolName = '',
}: {
  activity: Activity;
  studentName?: string;
  guardianName?: string;
  isRegistered?: boolean;
  paymentStatus?: string;
  paidAmount?: number;
  customNotes?: string;
  systemName?: string;
  schoolName?: string;
}): string {
  const dates: string[] = [];
  if (activity.start_date) dates.push(`من ${activity.start_date}`);
  if (activity.end_date) dates.push(`إلى ${activity.end_date}`);
  const dateText = dates.length > 0 ? dates.join(' ') : 'سيتم تحديده والإبلاغ به لاحقاً';

  const feeText =
    activity.fee && Number(activity.fee) > 0 ? `${activity.fee} جنيه مصري` : 'مجاناً (بدون رسوم)';

  const greeting = guardianName?.trim()
    ? `تحية كشفية طيبة لولي الأمر الفاضل / *${guardianName.trim()}* ⚜️`
    : studentName?.trim()
    ? `تحية كشفية طيبة لولي أمر الكشاف/ة: *${studentName.trim()}* ⚜️`
    : `تحية كشفية طيبة لولي الأمر المحترم ⚜️`;

  const intro = isRegistered
    ? `نحيط سيادتكم علماً بتفاصيل اشتراك ابنكم/ابنتكم *${studentName || ''}* في:`
    : `يسر إدارة الكشافة دعوتكم لمشاركة ابنكم/ابنتكم *${studentName || ''}* في:`;

  const typeIcon = activity.type === 'معسكر' ? '🏕️' : '🎯';

  const lines = [
    `السلام عليكم ورحمة الله وبركاته 🌹`,
    greeting,
    ``,
    intro,
    `${typeIcon} *${activity.type}: ${activity.name}*`,
    ``,
    `📋 *تفاصيل وبيانات ${activity.type}:*`,
    `📍 *المكان:* ${activity.location || 'مقر الكشافة'}${activity.address ? ` (${activity.address})` : ''}`,
    `📅 *الميعاد:* ${dateText}`,
    `💰 *قيمة الاشتراك:* ${feeText}`,
  ];

  // If registered participant, add payment info
  if (isRegistered && paymentStatus) {
    lines.push(`💳 *حالة سداد الاشتراك:* ${paymentStatus} (${paidAmount || 0} ج.م)`);
  }

  if (activity.leader_name) {
    lines.push(`👤 *القائد المسؤول:* ${activity.leader_name}`);
  }
  if (activity.deputy_name) {
    lines.push(`🛡️ *نائب القائد:* ${activity.deputy_name}`);
  }

  lines.push(``);
  lines.push(`📝 *الملاحظات والتعليمات الهامة:*`);

  const notesBody = customNotes?.trim() || activity.description?.trim();
  if (notesBody) {
    lines.push(notesBody);
  } else {
    lines.push(`• يرجى الالتزام بالزي الكشفي الكامل.`);
    lines.push(`• إحضار المستلزمات الشخصية المقررة والحضور في موعد التجمع المحدد.`);
  }

  lines.push(``);
  lines.push(`📞 للتأكيد أو الاستفسار يرجى التواصل مع قيادة النشاط.`);
  lines.push(`مع أطيب التحيات الكشفية والتقدير،`);
  lines.push(schoolName ? `⚜️ *${schoolName}*` : `⚜️ *${systemName}*`);

  return lines.join('\n');
}

export const WhatsAppInviteModal: React.FC<WhatsAppInviteModalProps> = ({
  isOpen,
  onClose,
  activity,
  participants = [],
  allMembers,
  settings,
  onSuccess,
}) => {
  // Active Tab: 'MEMBERS' (All scout members / prospective) vs 'PARTICIPANTS' (Already enrolled)
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'PARTICIPANTS'>('MEMBERS');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  const [selectedTribeId, setSelectedTribeId] = useState<string>('ALL');
  const [tribesList, setTribesList] = useState<Tribe[]>([]);
  const [phoneFilterOnly, setPhoneFilterOnly] = useState(true);

  // Editable Custom Message State
  const [isEditingCustomNote, setIsEditingCustomNote] = useState(false);
  const [customNote, setCustomNote] = useState(activity?.description || '');
  const [copiedGeneralMessage, setCopiedGeneralMessage] = useState(false);

  // Track sent members in current session for UX feedback
  const [sentMemberIds, setSentMemberIds] = useState<Set<number>>(new Set());

  // Reset/sync state when modal opens or activity changes
  useEffect(() => {
    if (activity) {
      setCustomNote(activity.description || '');
    }
    if (participants.length > 0) {
      setActiveTab('PARTICIPANTS');
    } else {
      setActiveTab('MEMBERS');
    }
  }, [activity, participants.length, isOpen]);

  // Load tribes for filtering
  useEffect(() => {
    tribesService
      .getTribes()
      .then((data) => setTribesList(data))
      .catch(() => {});
  }, []);

  // Prepare standard invitation preview text (General)
  const generalPreviewText = useMemo(() => {
    if (!activity) return '';
    return buildActivityInvitationText({
      activity,
      customNotes: customNote,
      systemName: settings?.system_name || 'إدارة الكشافة',
      schoolName: settings?.school_name || '',
    });
  }, [activity, customNote, settings]);

  const handleCopyGeneralText = () => {
    navigator.clipboard.writeText(generalPreviewText);
    setCopiedGeneralMessage(true);
    setTimeout(() => setCopiedGeneralMessage(false), 2500);
  };

  // Filtered lists of Members or Participants
  const filteredList = useMemo(() => {
    if (!activity) return [];
    if (activeTab === 'PARTICIPANTS') {
      return participants.filter((p) => {
        const matchesSearch =
          !searchQuery.trim() ||
          p.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.member_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.father_phone && p.father_phone.includes(searchQuery)) ||
          (p.mother_phone && p.mother_phone.includes(searchQuery)) ||
          (p.guardian_name && p.guardian_name.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStage = selectedStage === 'ALL' || p.school_stage === selectedStage;
        const hasPhone = !phoneFilterOnly || Boolean(p.father_phone || p.mother_phone);

        return matchesSearch && matchesStage && hasPhone;
      });
    }

    return allMembers.filter((m) => {
      const matchesSearch =
        !searchQuery.trim() ||
        m.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.member_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.father_phone && m.father_phone.includes(searchQuery)) ||
        (m.mother_phone && m.mother_phone.includes(searchQuery)) ||
        (m.guardian_name && m.guardian_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStage = selectedStage === 'ALL' || m.school_stage === selectedStage;
      const matchesTribe =
        selectedTribeId === 'ALL' ||
        (selectedTribeId && m.tribe_id?.toString() === selectedTribeId);
      const hasPhone = !phoneFilterOnly || Boolean(m.father_phone || m.mother_phone);

      return matchesSearch && matchesStage && matchesTribe && hasPhone;
    });
  }, [activeTab, activity, participants, allMembers, searchQuery, selectedStage, selectedTribeId, phoneFilterOnly]);

  // Helper to trigger WhatsApp message window
  const handleOpenWhatsApp = (
    phone: string,
    studentName: string,
    guardianName?: string,
    memberId?: number,
    isRegistered = false,
    paymentStatus?: string,
    paidAmount?: number
  ) => {
    if (!activity) return;
    const formattedPhone = formatWhatsAppPhone(phone);
    if (!formattedPhone) return;

    const text = buildActivityInvitationText({
      activity,
      studentName,
      guardianName,
      isRegistered,
      paymentStatus,
      paidAmount,
      customNotes: customNote,
      systemName: settings?.system_name || 'إدارة الكشافة',
      schoolName: settings?.school_name || '',
    });

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    if (memberId) {
      setSentMemberIds((prev) => new Set(prev).add(memberId));
    }
  };

  // Find next uncontacted member
  const nextUncontacted = useMemo(() => {
    return filteredList.find((item) => {
      const id = 'member_id' in item ? item.member_id : item.id;
      const hasPhone = Boolean(item.father_phone || item.mother_phone);
      return hasPhone && !sentMemberIds.has(id);
    });
  }, [filteredList, sentMemberIds]);

  const handleSendNext = () => {
    if (!nextUncontacted || !activity) return;
    const phone = nextUncontacted.father_phone || nextUncontacted.mother_phone || '';
    const id = 'member_id' in nextUncontacted ? nextUncontacted.member_id : nextUncontacted.id;
    const isReg = activeTab === 'PARTICIPANTS';
    const payStatus = 'payment_status' in nextUncontacted ? nextUncontacted.payment_status : undefined;
    const paidAmt = 'paid_amount' in nextUncontacted ? nextUncontacted.paid_amount : undefined;

    handleOpenWhatsApp(
      phone,
      nextUncontacted.student_name,
      nextUncontacted.guardian_name || undefined,
      id,
      isReg,
      payStatus,
      paidAmt
    );
  };

  // Ensure all hooks have run before early return
  if (!isOpen || !activity) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-linear-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl border border-white/20">
              <MessageCircle className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/20 text-white">
                  {activity.type}
                </span>
                <span className="text-xs text-emerald-100 font-semibold">
                  قيمة الاشتراك: {activity.fee} ج.م
                </span>
                {activity.start_date && (
                  <span className="text-xs text-emerald-100 font-semibold">
                    • الميعاد: {activity.start_date}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white mt-0.5 flex items-center gap-2">
                <span>إرسال دعوة {activity.type} عبر الواتساب لأولياء الأمور</span>
              </h3>
              <p className="text-xs text-emerald-100/90 font-medium">
                {activity.name} • {activity.location}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top Info Banner & Message Preview Accordion */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>معاينة نص الرسالة التي ستصل لولي الأمر عبر الواتساب:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingCustomNote(!isEditingCustomNote)}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 text-slate-500" />
                  <span>{isEditingCustomNote ? 'إغلاق التعديل' : 'تعديل الملاحظات'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyGeneralText}
                  className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                  title="نسخ نص الرسالة بالكامل للجروب"
                >
                  {copiedGeneralMessage ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-200" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرسالة</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editing Custom Notes if open */}
            {isEditingCustomNote && (
              <div className="p-3 bg-white rounded-xl border border-amber-300 space-y-2 text-xs">
                <div className="flex items-center justify-between text-amber-900 font-bold">
                  <span>تعديل الملاحظات والتعليمات المرفقة في الرسالة:</span>
                  <button
                    type="button"
                    onClick={() => setCustomNote(activity.description || '')}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    استرجاع الوصف الأصلي
                  </button>
                </div>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  rows={3}
                  placeholder="اكتب تعليمات النشاط، التجمع، الملابس، الأغراض المطلوبة..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* WhatsApp Styled Message Bubble */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl font-sans text-xs text-slate-800 whitespace-pre-line leading-relaxed shadow-2xs max-h-36 overflow-y-auto">
              {generalPreviewText}
            </div>
          </div>

          {/* Recipient Scope Switcher Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('MEMBERS')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'MEMBERS'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>جميع أعضاء الكشافة ({allMembers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PARTICIPANTS')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'PARTICIPANTS'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>المشتركون المسجلون بالنشاط ({participants.length})</span>
              </button>
            </div>

            {/* Fast Next Parent Button */}
            {nextUncontacted && (
              <button
                type="button"
                onClick={handleSendNext}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="إرسال لولي الأمر التالي في القائمة"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال لولي الأمر التالي ({nextUncontacted.student_name})</span>
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث بالاسم أو الكود أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden text-xs"
              />
            </div>

            {/* School Grade Filter */}
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden cursor-pointer"
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

            {/* Tribe Filter (only for members tab) */}
            {activeTab === 'MEMBERS' && (
              <select
                value={selectedTribeId}
                onChange={(e) => setSelectedTribeId(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">جميع العشائر</option>
                {tribesList.map((t) => (
                  <option key={t.id} value={t.id.toString()}>
                    عشيرة: {t.name}
                  </option>
                ))}
              </select>
            )}

            {/* Toggle: Only members with recorded phone number */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <input
                id="check_phone_only"
                type="checkbox"
                checked={phoneFilterOnly}
                onChange={(e) => setPhoneFilterOnly(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
              />
              <label htmlFor="check_phone_only" className="text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                من لديهم هاتف مسجل فقط
              </label>
            </div>
          </div>

          {/* Recipients List Status Bar */}
          <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-medium">
            <span>
              عدد أولياء الأمور المتاحين: <b className="text-slate-900">{filteredList.length}</b>
            </span>
            {sentMemberIds.size > 0 && (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                تمت مراسلة {sentMemberIds.size} ولي أمر في هذه الجلسة
              </span>
            )}
          </div>

          {/* Members / Participants Grid */}
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-2xl">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold">لا يوجد أولياء أمور مطابقون لشروط البحث المحددة</p>
              <p className="text-[11px] text-slate-400">
                تأكد من إزالة شروط التصفية أو التأكد من أرقام الهواتف المسجلة للأعضاء
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {filteredList.map((item) => {
                const memberId = 'member_id' in item ? item.member_id : item.id;
                const isSent = sentMemberIds.has(memberId);
                const fatherPhone = item.father_phone?.trim();
                const motherPhone = item.mother_phone?.trim();
                const hasPhone = Boolean(fatherPhone || motherPhone);

                const isRegistered = activeTab === 'PARTICIPANTS';
                const paymentStatus = 'payment_status' in item ? item.payment_status : undefined;
                const paidAmount = 'paid_amount' in item ? item.paid_amount : undefined;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-2.5 ${
                      isSent
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'bg-white border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div>
                      {/* Top bar: Member code + Status */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {item.member_code}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.school_stage && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              {item.school_stage}
                            </span>
                          )}
                          {item.tribe_name && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                              {item.tribe_name}
                            </span>
                          )}
                          {isSent && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              تم الإرسال
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Student & Guardian Names */}
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>{item.student_name}</span>
                        {item.member_type === 'قائد' && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-bold">
                            قائد
                          </span>
                        )}
                      </div>

                      {item.guardian_name && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          ولي الأمر: <span className="font-medium text-slate-700">{item.guardian_name}</span>
                        </div>
                      )}

                      {/* Payment info if registered participant */}
                      {isRegistered && paymentStatus && (
                        <div className="mt-1 flex items-center gap-2 text-[11px]">
                          <span className="text-slate-500">حالة السداد:</span>
                          <span
                            className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                              paymentStatus === 'مدفوع'
                                ? 'bg-emerald-100 text-emerald-800'
                                : paymentStatus === 'جزئي'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {paymentStatus} ({paidAmount || 0} ج.م)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp & Call Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                      {hasPhone ? (
                        <div className="flex items-center gap-1.5 w-full flex-wrap">
                          {/* Father Phone Button */}
                          {fatherPhone && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenWhatsApp(
                                  fatherPhone,
                                  item.student_name,
                                  item.guardian_name || undefined,
                                  memberId,
                                  isRegistered,
                                  paymentStatus,
                                  paidAmount
                                )
                              }
                              className="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                              title={`إرسال لواتساب الأب (${fatherPhone})`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>{fatherPhone}</span>
                            </button>
                          )}

                          {/* Mother Phone Button if different */}
                          {motherPhone && motherPhone !== fatherPhone && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenWhatsApp(
                                  motherPhone,
                                  item.student_name,
                                  item.guardian_name || undefined,
                                  memberId,
                                  isRegistered,
                                  paymentStatus,
                                  paidAmount
                                )
                              }
                              className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                              title={`إرسال لواتساب الأم (${motherPhone})`}
                            >
                              <MessageCircle className="w-3 h-3 text-emerald-600" />
                              <span className="text-[11px]">الأم: {motherPhone}</span>
                            </button>
                          )}

                          {/* Phone Call Shortcut */}
                          <a
                            href={`tel:${fatherPhone || motherPhone}`}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                            title="اتصال هاتفي مباشر"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1 w-full">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>لا يوجد رقم هاتف مسجل لولي الأمر في بيانات هذا العضو</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>
              يتم إرسال الدعوة مباشرة عبر تطبيق أو ويب واتساب متضمنة كافة تفاصيل النشاط والاشتراك والملاحظات.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyGeneralText}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>نسخ نص الدعوة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
