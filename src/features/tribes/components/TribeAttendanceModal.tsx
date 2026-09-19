import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Printer,
  Users,
  Award,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  Tribe,
  TribeMeeting,
  MemberAttendanceItem,
  MeetingAttendanceData,
  TribeAttendanceSummaryItem,
  AttendanceStatus,
} from '../types';
import { Member } from '../../members/types';
import { tribesService } from '../services/tribesService';

interface TribeAttendanceModalProps {
  tribe: Tribe;
  isOpen: boolean;
  onClose: () => void;
  onSelectMember?: (member: Member) => void;
  onSuccess?: (msg: string) => void;
}

export const TribeAttendanceModal: React.FC<TribeAttendanceModalProps> = ({
  tribe,
  isOpen,
  onClose,
  onSelectMember,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'meetings' | 'summary'>('meetings');
  const [meetings, setMeetings] = useState<TribeMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Attendance Recording Session
  const [activeMeeting, setActiveMeeting] = useState<TribeMeeting | null>(null);
  const [attendanceSheet, setAttendanceSheet] = useState<MemberAttendanceItem[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');

  // Add Single Meeting Form
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [meetingDate, setMeetingDate] = useState<string>(() => {
    const today = new Date();
    // Default to upcoming Saturday if today is not Saturday
    const day = today.getDay(); // 0 is Sun, 6 is Sat
    const daysUntilSaturday = (6 - day + 7) % 7;
    const sat = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (daysUntilSaturday === 0 ? 0 : daysUntilSaturday));
    return sat.toISOString().split('T')[0];
  });
  const [meetingTitle, setMeetingTitle] = useState('اجتماع السبت الأسبوعي');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  // Bulk Saturday Generator
  const [showBulkGenerator, setShowBulkGenerator] = useState(false);
  const [bulkMonth, setBulkMonth] = useState<number>(() => new Date().getMonth());
  const [bulkYear, setBulkYear] = useState<number>(() => new Date().getFullYear());
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Cumulative Summary State
  const [summaryList, setSummaryList] = useState<TribeAttendanceSummaryItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [totalHeldMeetings, setTotalHeldMeetings] = useState(0);

  // Delete Meeting state
  const [meetingToDelete, setMeetingToDelete] = useState<TribeMeeting | null>(null);
  const [deletingMeeting, setDeletingMeeting] = useState(false);

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    if (onSuccess) onSuccess(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Fetch Meetings
  const fetchMeetings = async () => {
    try {
      setLoadingMeetings(true);
      setErrorMsg(null);
      const res = await tribesService.getTribeMeetings(tribe.id);
      setMeetings(res.meetings || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل جلب اجتماعات العشيرة');
    } finally {
      setLoadingMeetings(false);
    }
  };

  // Fetch Summary
  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      setErrorMsg(null);
      const res = await tribesService.getTribeAttendanceSummary(tribe.id);
      setSummaryList(res.summary || []);
      setTotalHeldMeetings(res.total_meetings || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل جلب ملخص حضور العشيرة');
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMeetings();
      fetchSummary();
    }
  }, [isOpen, tribe.id]);

  if (!isOpen) return null;

  // Open Attendance Sheet for a Meeting
  const handleOpenAttendance = async (meeting: TribeMeeting) => {
    setActiveMeeting(meeting);
    setAttendanceSearchQuery('');
    setLoadingAttendance(true);
    try {
      const data: MeetingAttendanceData = await tribesService.getMeetingAttendance(tribe.id, meeting.id);
      setAttendanceSheet(data.records || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل جلب كشف الحضور');
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Change individual member status in sheet
  const handleStatusChange = (memberId: number, newStatus: AttendanceStatus) => {
    setAttendanceSheet((prev) =>
      prev.map((item) => (item.member_id === memberId ? { ...item, status: newStatus } : item))
    );
  };

  // Change individual member note in sheet
  const handleNoteChange = (memberId: number, note: string) => {
    setAttendanceSheet((prev) =>
      prev.map((item) => (item.member_id === memberId ? { ...item, notes: note } : item))
    );
  };

  // Bulk mark all
  const handleMarkAll = (status: AttendanceStatus) => {
    setAttendanceSheet((prev) => prev.map((item) => ({ ...item, status })));
  };

  // Save Attendance Sheet
  const handleSaveAttendance = async () => {
    if (!activeMeeting) return;
    try {
      setSavingAttendance(true);
      const recordsToSave = attendanceSheet.map((item) => ({
        member_id: item.member_id,
        status: item.status,
        notes: item.notes,
      }));

      await tribesService.saveMeetingAttendance(tribe.id, activeMeeting.id, recordsToSave);
      notify(`تم حفظ سجل حضور اجتماع ${activeMeeting.meeting_date} بنجاح`);
      setActiveMeeting(null);
      await fetchMeetings();
      await fetchSummary();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ سجل الحضور');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Create Single Meeting
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingDate) return;
    try {
      setCreatingMeeting(true);
      await tribesService.createMeeting(tribe.id, {
        meeting_date: meetingDate,
        title: meetingTitle,
        notes: meetingNotes,
      });
      notify('تمت إضافة الاجتماع بنجاح');
      setShowAddMeetingModal(false);
      setMeetingNotes('');
      await fetchMeetings();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إضافة الاجتماع');
    } finally {
      setCreatingMeeting(false);
    }
  };

  // Bulk Generate Saturdays for selected Month
  const handleGenerateSaturdays = async () => {
    try {
      setBulkGenerating(true);
      const saturdays: string[] = [];
      const daysInMonth = new Date(bulkYear, bulkMonth + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const curDate = new Date(bulkYear, bulkMonth, d, 12, 0, 0);
        if (curDate.getDay() === 6) {
          // Saturday
          const yyyy = curDate.getFullYear();
          const mm = String(curDate.getMonth() + 1).padStart(2, '0');
          const dd = String(curDate.getDate()).padStart(2, '0');
          saturdays.push(`${yyyy}-${mm}-${dd}`);
        }
      }

      if (saturdays.length === 0) {
        setErrorMsg('لم يتم العثور على أي أيام سبت في هذا الشهر');
        return;
      }

      await tribesService.createMeeting(tribe.id, {
        bulk: true,
        dates: saturdays,
        title: 'اجتماع السبت الأسبوعي',
      });

      notify(`تم إنشاء ${saturdays.length} اجتماعات لأيام السبت لشهر ${monthNamesArabic[bulkMonth]} بنجاح`);
      setShowBulkGenerator(false);
      await fetchMeetings();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل توليد الاجتماعات');
    } finally {
      setBulkGenerating(false);
    }
  };

  // Delete Meeting
  const handleConfirmDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    try {
      setDeletingMeeting(true);
      await tribesService.deleteMeeting(tribe.id, meetingToDelete.id);
      notify('تم حذف الاجتماع وسجل حضوره بنجاح');
      setMeetingToDelete(null);
      await fetchMeetings();
      await fetchSummary();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حذف الاجتماع');
    } finally {
      setDeletingMeeting(false);
    }
  };

  // Filtered attendance sheet records for search
  const filteredAttendanceRecords = attendanceSheet.filter((r) => {
    if (!attendanceSearchQuery) return true;
    const q = attendanceSearchQuery.toLowerCase();
    return (
      r.student_name.toLowerCase().includes(q) ||
      (r.member_code && r.member_code.toLowerCase().includes(q)) ||
      (r.school_stage && r.school_stage.toLowerCase().includes(q))
    );
  });

  // Current stats in active attendance sheet
  const currentSheetStats = {
    total: attendanceSheet.length,
    present: attendanceSheet.filter((r) => r.status === 'PRESENT').length,
    absent: attendanceSheet.filter((r) => r.status === 'ABSENT').length,
    excused: attendanceSheet.filter((r) => r.status === 'EXCUSED').length,
    late: attendanceSheet.filter((r) => r.status === 'LATE').length,
  };

  // Print attendance sheet
  const handlePrintAttendance = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/90 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black">{tribe.name}</h3>
                <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded border border-white/30">
                  {tribe.code}
                </span>
                <span className="text-xs bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-400/40">
                  {tribe.member_count || 0} كشافة
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                سجل الاجتماعات، تسجيل الحضور والغياب الأسبوعي، ومتابعة الالتزام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications Bar */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="cursor-pointer">
              <X className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="cursor-pointer">
              <X className="w-4 h-4 text-rose-600" />
            </button>
          </div>
        )}

        {/* Navigation Tabs (Only when not in active sheet recording) */}
        {!activeMeeting && (
          <div className="px-5 pt-3 border-b border-slate-200/90 flex items-center gap-3 bg-slate-50/50 text-xs font-bold">
            <button
              onClick={() => setActiveTab('meetings')}
              className={`pb-3 border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'meetings'
                  ? 'border-emerald-600 text-emerald-700 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>أيام الاجتماعات وسجل الحضور ({meetings.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('summary');
                fetchSummary();
              }}
              className={`pb-3 border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'summary'
                  ? 'border-emerald-600 text-emerald-700 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>ملخص نسب حضور الكشافات</span>
            </button>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* =========================================================
              VIEW 1: RECORDING ATTENDANCE SHEET FOR A SPECIFIC MEETING 
             ========================================================= */}
          {activeMeeting ? (
            <div className="space-y-4">
              {/* Meeting Info & Action Header */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <button
                    onClick={() => setActiveMeeting(null)}
                    className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-bold mb-1.5 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>العودة لقائمة الاجتماعات</span>
                  </button>
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>{activeMeeting.title}</span>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                      {activeMeeting.day_name}، {activeMeeting.meeting_date}
                    </span>
                  </h4>
                  {activeMeeting.notes && (
                    <p className="text-xs text-slate-500 mt-0.5">{activeMeeting.notes}</p>
                  )}
                </div>

                {/* Quick actions: Mark all present / absent */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleMarkAll('PRESENT')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>الكل حاضر</span>
                  </button>
                  <button
                    onClick={() => handleMarkAll('ABSENT')}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-rose-600" />
                    <span>الكل غائب</span>
                  </button>
                </div>
              </div>

              {/* Counters Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <div className="text-slate-500 font-semibold text-[11px]">إجمالي الأعضاء</div>
                  <div className="text-base font-black text-slate-800 mt-0.5">{currentSheetStats.total}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>حاضر</span>
                  </div>
                  <div className="text-base font-black text-emerald-800 mt-0.5">{currentSheetStats.present}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-rose-700 font-bold text-[11px] flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" />
                    <span>غائب</span>
                  </div>
                  <div className="text-base font-black text-rose-800 mt-0.5">{currentSheetStats.absent}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-amber-700 font-bold text-[11px] flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>بعذر</span>
                  </div>
                  <div className="text-base font-black text-amber-800 mt-0.5">{currentSheetStats.excused}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>متأخر</span>
                  </div>
                  <div className="text-base font-black text-blue-800 mt-0.5">{currentSheetStats.late}</div>
                </div>
              </div>

              {/* Search filter in sheet */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                    placeholder="بحث باسم الكشافة أو كود العضوية..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {attendanceSearchQuery && (
                    <button
                      onClick={() => setAttendanceSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Attendance Table */}
              {loadingAttendance ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span>جاري تحميل كشف الحضور...</span>
                </div>
              ) : attendanceSheet.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                  لا يوجد أعضاء منضمين لهذه العشيرة حالياً. يرجى إضافة كشافات إلى العشيرة أولاً لتسجيل الحضور.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">الكشافة</th>
                          <th className="p-3">كود العضوية</th>
                          <th className="p-3">الصف</th>
                          <th className="p-3 text-center">حالة الحضور</th>
                          <th className="p-3">ملاحظات / سبب الغياب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {filteredAttendanceRecords.map((record, index) => (
                          <tr
                            key={record.member_id}
                            className={`transition hover:bg-slate-50/70 ${
                              record.status === 'ABSENT'
                                ? 'bg-rose-50/20'
                                : record.status === 'EXCUSED'
                                ? 'bg-amber-50/20'
                                : ''
                            }`}
                          >
                            <td className="p-3 text-slate-400 font-mono text-[11px]">{index + 1}</td>
                            <td className="p-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                                  {record.photo_path ? (
                                    <img
                                      src={record.photo_path}
                                      alt=""
                                      className="w-full h-full object-cover rounded-lg"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    record.student_name.trim().charAt(0)
                                  )}
                                </div>
                                <span>{record.student_name}</span>
                              </div>
                            </td>
                            <td className="p-3 font-mono text-emerald-700 font-bold text-[11px]">
                              {record.member_code}
                            </td>
                            <td className="p-3 text-slate-600">{record.school_stage}</td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 max-w-[280px] mx-auto">
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(record.member_id, 'PRESENT')}
                                  className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                                    record.status === 'PRESENT'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                  <span>حاضر</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(record.member_id, 'ABSENT')}
                                  className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                                    record.status === 'ABSENT'
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                                  }`}
                                >
                                  <X className="w-3 h-3" />
                                  <span>غائب</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(record.member_id, 'EXCUSED')}
                                  className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                                    record.status === 'EXCUSED'
                                      ? 'bg-amber-500 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                                  }`}
                                >
                                  <span>بعذر</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(record.member_id, 'LATE')}
                                  className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                                    record.status === 'LATE'
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
                                  }`}
                                >
                                  <span>متأخر</span>
                                </button>
                              </div>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={record.notes}
                                onChange={(e) => handleNoteChange(record.member_id, e.target.value)}
                                placeholder="ملاحظات (اختياري)..."
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attendance Sheet Actions Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveMeeting(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء ورجوع
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintAttendance}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="طباعة كشف الحضور"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingAttendance ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>حفظ وتثبيت سجل الحضور</span>
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'meetings' ? (
            /* =========================================================
               VIEW 2: MEETINGS LIST & ACTION BUTTONS
               ========================================================= */
            <div className="space-y-4">
              {/* Actions Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>جدول اجتماعات العشيرة الأسبوعية</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    أضف أيام الاجتماعات وسجل الحضور لكل اجتماع بشكل منفصل
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Bulk Saturday Generator Button */}
                  <button
                    onClick={() => setShowBulkGenerator(true)}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>توليد سبوت الشهر آلياً</span>
                  </button>

                  {/* Add Single Meeting Button */}
                  <button
                    onClick={() => setShowAddMeetingModal(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة اجتماع</span>
                  </button>
                </div>
              </div>

              {/* Meetings List */}
              {loadingMeetings ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span>جاري تحميل قائمة الاجتماعات...</span>
                </div>
              ) : meetings.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    <CalendarPlus className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">لا توجد اجتماعات مسجلة لهذه العشيرة بعد</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    ابدأ بإضافة يوم اجتماع (مثلاً يوم السبت القادم) أو استخدم ميزة "توليد سبوت الشهر آلياً" لإضافة جميع أيام السبت بنقرة واحدة!
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setShowBulkGenerator(true)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      توليد سبوت هذا الشهر
                    </button>
                    <button
                      onClick={() => setShowAddMeetingModal(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      إضافة اجتماع محدد
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {meetings.map((m) => (
                    <div
                      key={m.id}
                      className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-3"
                    >
                      <div>
                        {/* Top row: Date & status badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-black">
                              {m.day_name}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {m.meeting_date}
                            </span>
                          </div>

                          {m.is_recorded ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>حضور {m.attendance_rate}%</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>لم يسجل بعد</span>
                            </span>
                          )}
                        </div>

                        {/* Title & Notes */}
                        <h4 className="font-black text-slate-900 text-sm mt-2">{m.title}</h4>
                        {m.notes && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{m.notes}</p>
                        )}

                        {/* Attendance breakdown pills (if recorded) */}
                        {m.is_recorded ? (
                          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-bold flex-wrap">
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              حاضر: {m.present_count}
                            </span>
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              غائب: {m.absent_count}
                            </span>
                            {m.excused_count > 0 && (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                بعذر: {m.excused_count}
                              </span>
                            )}
                            {m.late_count > 0 && (
                              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                متأخر: {m.late_count}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                            جاهز لتسجيل الحضور للأعضاء ({tribe.member_count || 0} كشافة)
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Record Attendance & Delete */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleOpenAttendance(m)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            m.is_recorded
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                          }`}
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                          <span>{m.is_recorded ? 'تعديل سجل الحضور' : 'تسجيل الحضور الآن'}</span>
                        </button>

                        <button
                          onClick={() => setMeetingToDelete(m)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200 cursor-pointer"
                          title="حذف هذا الاجتماع"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* =========================================================
               VIEW 3: CUMULATIVE MEMBER ATTENDANCE SUMMARY
               ========================================================= */
            <div className="space-y-4">
              {/* Summary Overview Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 font-semibold">إجمالي الاجتماعات المنعقدة</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{totalHeldMeetings} اجتماع</div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                  <span className="text-xs text-emerald-700 font-bold">متوسط نسبة حضور العشيرة</span>
                  <div className="text-xl font-black text-emerald-800 mt-1">
                    {summaryList.length > 0
                      ? Math.round(
                          summaryList.reduce((acc, curr) => acc + curr.attendance_rate, 0) / summaryList.length
                        )
                      : 100}
                    %
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
                  <span className="text-xs text-blue-700 font-bold">إجمالي كشافات العشيرة</span>
                  <div className="text-xl font-black text-blue-800 mt-1">{summaryList.length} كشافة</div>
                </div>
              </div>

              {/* Members Attendance Report Table */}
              {loadingSummary ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span>جاري تحميل تقرير الحضور...</span>
                </div>
              ) : summaryList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                  لا توجد كشافات مسجلة في هذه العشيرة لعرض التقرير.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">الكشافة</th>
                        <th className="p-3">كود العضوية</th>
                        <th className="p-3">الصف</th>
                        <th className="p-3 text-center">حضور</th>
                        <th className="p-3 text-center">غياب</th>
                        <th className="p-3 text-center">بعذر / تأخير</th>
                        <th className="p-3 text-center">نسبة الالتزام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {summaryList.map((item, idx) => (
                        <tr key={item.member_id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                                {item.student_name.trim().charAt(0)}
                              </div>
                              <span>{item.student_name}</span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-emerald-700 font-bold text-[11px]">
                            {item.member_code}
                          </td>
                          <td className="p-3 text-slate-600">{item.school_stage}</td>
                          <td className="p-3 text-center font-bold text-emerald-700">
                            {item.present_count}
                          </td>
                          <td className="p-3 text-center font-bold text-rose-700">
                            {item.absent_count}
                          </td>
                          <td className="p-3 text-center text-slate-600">
                            {item.excused_count + item.late_count}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    item.attendance_rate >= 80
                                      ? 'bg-emerald-500'
                                      : item.attendance_rate >= 60
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${item.attendance_rate}%` }}
                                ></div>
                              </div>
                              <span
                                className={`font-black text-xs ${
                                  item.attendance_rate >= 80
                                    ? 'text-emerald-700'
                                    : item.attendance_rate >= 60
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {item.attendance_rate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>قائد العشيرة: {tribe.leader_name || 'لم يحدد'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* =========================================================
          SUB-MODAL 1: ADD SINGLE MEETING MODAL
         ========================================================= */}
      {showAddMeetingModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-emerald-600" />
                <span>إضافة موعد اجتماع جديد للعشيرة</span>
              </h4>
              <button
                onClick={() => setShowAddMeetingModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="space-y-3.5 text-xs">
              {/* Meeting Date */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  تاريخ الاجتماع <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">عنوان / اسم الاجتماع</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="مثال: اجتماع السبت الأسبوعي"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">ملاحظات الاجتماع (اختياري)</label>
                <textarea
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  rows={2}
                  placeholder="مثال: تدريب على العقد والربطات الكشفية، تجهيز النشاط الرياضي..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMeetingModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingMeeting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {creatingMeeting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>حفظ وإضافة الاجتماع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-MODAL 2: BULK SATURDAY GENERATOR MODAL
         ========================================================= */}
      {showBulkGenerator && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>توليد اجتماعات السبت آلياً</span>
              </h4>
              <button
                onClick={() => setShowBulkGenerator(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هذه الميزة تقوم بحساب جميع أيام <strong>السبت</strong> في الشهر المختار وإضافتها كاجتماعات أسبوعية منتظمة لعشيرة <strong>{tribe.name}</strong> بنقرة واحدة دون تكرار التواريخ الموجودة.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">الشهر</label>
                <select
                  value={bulkMonth}
                  onChange={(e) => setBulkMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {monthNamesArabic.map((m, idx) => (
                    <option key={idx} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">السنة</label>
                <input
                  type="number"
                  value={bulkYear}
                  onChange={(e) => setBulkYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              سيتم إنشاء جدول اجتماعات لكل سبت في شهر {monthNamesArabic[bulkMonth]} {bulkYear} بعنوان "اجتماع السبت الأسبوعي".
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowBulkGenerator(false)}
                className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleGenerateSaturdays}
                disabled={bulkGenerating}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {bulkGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>توليد وحفظ الاجتماعات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-MODAL 3: CONFIRM DELETE MEETING
         ========================================================= */}
      {meetingToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3 animate-scale-in text-xs">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-slate-900 text-center">حذف الاجتماع</h4>
            <p className="text-slate-600 text-center leading-relaxed">
              هل أنت متأكد من حذف اجتماع <strong>"{meetingToDelete.title}"</strong> بتاريخ{' '}
              <strong>{meetingToDelete.meeting_date}</strong>؟
              <br />
              <span className="text-rose-600 font-bold text-[11px]">
                سيتم حذف سجل الحضور المسجل لهذا الاجتماع نهائياً.
              </span>
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setMeetingToDelete(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMeeting}
                disabled={deletingMeeting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
              >
                {deletingMeeting ? 'جاري الحذف...' : 'نعم، حذف الاجتماع'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
