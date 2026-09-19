import React, { useState, useEffect, useMemo } from 'react';
import {
  Tent,
  Plus,
  Search,
  MapPin,
  Calendar,
  DollarSign,
  UserCheck,
  Shield,
  Users,
  Eye,
  Edit2,
  Trash2,
  Printer,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  FileSpreadsheet,
  Filter,
  CreditCard,
  UserPlus,
  Sparkles,
  Phone,
  Layers,
  Award,
  ChevronLeft,
  MessageCircle,
  Crown,
} from 'lucide-react';
import { Activity, ActivityFormData, ActivityParticipant } from '../types';
import { Member } from '../../members/types';
import { User } from '../../auth/types';
import { activitiesService } from '../services/activitiesService';
import { membersService } from '../../members/services/membersService';
import {
  WhatsAppInviteModal,
  formatWhatsAppPhone,
  buildActivityInvitationText,
} from './WhatsAppInviteModal';

export interface SystemSettings {
  school_name: string;
  system_name: string;
  current_year: string;
}

interface ActivitiesViewProps {
  user: User;
  settings?: SystemSettings | null;
  onSuccess: (msg: string) => void;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({ user, settings, onSuccess }) => {
  const isAdmin = user.role === 'ADMIN';

  // Activities List State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters for Cards
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'معسكر' | 'نشاط'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'مفتوح' | 'جاري' | 'منتهي' | 'ملغي'>('ALL');

  // Active Selected Activity (Detail View)
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [activeActivity, setActiveActivity] = useState<(Activity & { participants: ActivityParticipant[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Participant Detail Search & Filter
  const [participantSearch, setParticipantSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'مدفوع' | 'غير مدفوع' | 'جزئي'>('ALL');

  // Add / Edit Activity Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState<ActivityFormData>({
    type: 'معسكر',
    name: '',
    location: '',
    address: '',
    start_date: '',
    end_date: '',
    fee: '',
    leader_name: '',
    deputy_name: '',
    max_participants: '',
    description: '',
    status: 'مفتوح',
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Activity Confirmation Modal
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add Participant(s) Modal State
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberStageFilter, setMemberStageFilter] = useState<string>('ALL');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [participantPaymentStatus, setParticipantPaymentStatus] = useState<'مدفوع' | 'غير مدفوع' | 'جزئي'>('مدفوع');
  const [participantPaidAmount, setParticipantPaidAmount] = useState<string>('');
  const [participantNotes, setParticipantNotes] = useState('');
  const [addingParticipantsLoading, setAddingParticipantsLoading] = useState(false);

  // Edit Single Participant Payment Modal
  const [editingParticipant, setEditingParticipant] = useState<ActivityParticipant | null>(null);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'مدفوع' | 'غير مدفوع' | 'جزئي'>('مدفوع');
  const [editPaidAmount, setEditPaidAmount] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');
  const [updatingParticipantLoading, setUpdatingParticipantLoading] = useState(false);

  // Delete Participant Confirm
  const [deletingParticipant, setDeletingParticipant] = useState<ActivityParticipant | null>(null);
  const [removingParticipantLoading, setRemovingParticipantLoading] = useState(false);

  // WhatsApp Invitations Modal State
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [whatsAppActivity, setWhatsAppActivity] = useState<Activity | null>(null);
  const [whatsAppParticipants, setWhatsAppParticipants] = useState<ActivityParticipant[]>([]);

  // Manual Leader / Deputy toggle in form
  const [isManualLeader, setIsManualLeader] = useState(false);
  const [isManualDeputy, setIsManualDeputy] = useState(false);

  // Open WhatsApp Modal for an activity
  const handleOpenWhatsAppModal = async (act: Activity) => {
    await loadAllMembers();
    setWhatsAppActivity(act);
    if (activeActivity && activeActivity.id === act.id && activeActivity.participants) {
      setWhatsAppParticipants(activeActivity.participants);
    } else {
      try {
        const full = await activitiesService.getActivity(act.id);
        setWhatsAppParticipants(full.participants || []);
      } catch {
        setWhatsAppParticipants([]);
      }
    }
    setWhatsAppModalOpen(true);
  };

  // Fetch Activities list
  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activitiesService.getActivities();
      setActivities(data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل قائمة الأنشطة والمعسكرات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    loadAllMembers();
  }, []);

  // Fetch single activity details if selected
  const fetchActiveActivityDetails = async (id: number) => {
    try {
      setDetailLoading(true);
      const data = await activitiesService.getActivity(id);
      setActiveActivity(data);
    } catch (err: any) {
      onSuccess('فشل تحميل تفاصيل النشاط');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedActivityId) {
      fetchActiveActivityDetails(selectedActivityId);
    } else {
      setActiveActivity(null);
    }
  }, [selectedActivityId]);

  // Load All Members for Enrollment Modal
  const loadAllMembers = async () => {
    if (allMembers.length > 0) return;
    try {
      setMembersLoading(true);
      const members = await membersService.getMembers();
      setAllMembers(members);
    } catch (err) {
      console.error('Failed to load members for enrollment:', err);
    } finally {
      setMembersLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    loadAllMembers();
    setIsManualLeader(false);
    setIsManualDeputy(false);
    setEditingActivity(null);
    setFormData({
      type: 'معسكر',
      name: '',
      location: '',
      address: '',
      start_date: '',
      end_date: '',
      fee: '',
      leader_name: '',
      deputy_name: '',
      max_participants: '',
      description: '',
      status: 'مفتوح',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (activity: Activity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    loadAllMembers();
    setIsManualLeader(false);
    setIsManualDeputy(false);
    setEditingActivity(activity);
    setFormData({
      type: activity.type,
      name: activity.name,
      location: activity.location,
      address: activity.address || '',
      start_date: activity.start_date || '',
      end_date: activity.end_date || '',
      fee: activity.fee.toString(),
      leader_name: activity.leader_name || '',
      deputy_name: activity.deputy_name || '',
      max_participants: activity.max_participants ? activity.max_participants.toString() : '',
      description: activity.description || '',
      status: activity.status,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Activity Form (Create / Update)
  const handleSubmitActivityForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم النشاط أو المعسكر');
      return;
    }
    if (!formData.location.trim()) {
      setFormError('يرجى إدخال المكان');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      if (editingActivity) {
        await activitiesService.updateActivity(editingActivity.id, formData);
        onSuccess('تم تحديث بيانات النشاط/المعسكر بنجاح');
      } else {
        await activitiesService.createActivity(formData);
        onSuccess(`تمت إضافة ${formData.type} "${formData.name}" بنجاح`);
      }
      setIsModalOpen(false);
      await fetchActivities();
      if (selectedActivityId) {
        await fetchActiveActivityDetails(selectedActivityId);
      }
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية الحفظ');
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Activity
  const handleConfirmDeleteActivity = async () => {
    if (!deletingActivity) return;
    setDeleteLoading(true);
    try {
      await activitiesService.deleteActivity(deletingActivity.id);
      onSuccess(`تم حذف ${deletingActivity.type} "${deletingActivity.name}" بنجاح`);
      setDeletingActivity(null);
      if (selectedActivityId === deletingActivity.id) {
        setSelectedActivityId(null);
      }
      await fetchActivities();
    } catch (err: any) {
      onSuccess(err.message || 'فشل حذف النشاط');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Open Add Participant Modal
  const handleOpenAddParticipantModal = () => {
    loadAllMembers();
    setSelectedMemberIds([]);
    setParticipantPaymentStatus('مدفوع');
    setParticipantPaidAmount(activeActivity ? activeActivity.fee.toString() : '0');
    setParticipantNotes('');
    setMemberSearchQuery('');
    setMemberStageFilter('ALL');
    setIsAddParticipantModalOpen(true);
  };

  // Available Members (excluding those already enrolled)
  const availableMembers = useMemo(() => {
    if (!activeActivity) return [];
    const enrolledIds = new Set(activeActivity.participants.map((p) => p.member_id));
    return allMembers.filter((m) => !enrolledIds.has(m.id));
  }, [allMembers, activeActivity]);

  // Filtered available members based on search and stage
  const filteredAvailableMembers = useMemo(() => {
    return availableMembers.filter((m) => {
      const matchSearch =
        !memberSearchQuery ||
        m.student_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.member_code.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.national_id.includes(memberSearchQuery) ||
        (m.tribe_name && m.tribe_name.toLowerCase().includes(memberSearchQuery.toLowerCase()));

      const matchStage = memberStageFilter === 'ALL' || m.school_stage === memberStageFilter;

      return matchSearch && matchStage;
    });
  }, [availableMembers, memberSearchQuery, memberStageFilter]);

  // Leaders and members from database for selection dropdowns
  const dbLeadersList = useMemo(() => {
    const leaders = allMembers.filter((m) => m.member_type === 'قائد');
    const others = allMembers.filter((m) => m.member_type !== 'قائد');
    return { leaders, others };
  }, [allMembers]);

  // Toggle selection for a member
  const handleToggleMemberSelection = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all filtered members
  const handleSelectAllFiltered = () => {
    if (selectedMemberIds.length === filteredAvailableMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredAvailableMembers.map((m) => m.id));
    }
  };

  // Submit Add Participants
  const handleSubmitAddParticipants = async () => {
    if (!activeActivity || selectedMemberIds.length === 0) return;
    setAddingParticipantsLoading(true);

    try {
      const paid =
        participantPaymentStatus === 'مدفوع'
          ? activeActivity.fee
          : participantPaymentStatus === 'غير مدفوع'
          ? 0
          : parseFloat(participantPaidAmount) || 0;

      const res = await activitiesService.addActivityParticipants(
        activeActivity.id,
        selectedMemberIds,
        participantPaymentStatus,
        paid,
        participantNotes
      );

      onSuccess(res.message || 'تم تسجيل اشتراك الأعضاء بنجاح');
      setIsAddParticipantModalOpen(false);
      setSelectedMemberIds([]);
      await fetchActiveActivityDetails(activeActivity.id);
      await fetchActivities();
    } catch (err: any) {
      onSuccess(err.message || 'فشلت إضافة المشتركين');
    } finally {
      setAddingParticipantsLoading(false);
    }
  };

  // Open Edit Participant Modal
  const handleOpenEditParticipantModal = (participant: ActivityParticipant) => {
    setEditingParticipant(participant);
    setEditPaymentStatus(participant.payment_status);
    setEditPaidAmount(participant.paid_amount.toString());
    setEditNotes(participant.notes || '');
  };

  // Submit Edit Participant
  const handleSubmitEditParticipant = async () => {
    if (!activeActivity || !editingParticipant) return;
    setUpdatingParticipantLoading(true);

    try {
      const paid =
        editPaymentStatus === 'مدفوع'
          ? activeActivity.fee
          : editPaymentStatus === 'غير مدفوع'
          ? 0
          : parseFloat(editPaidAmount) || 0;

      await activitiesService.updateActivityParticipant(
        activeActivity.id,
        editingParticipant.id,
        editPaymentStatus,
        paid,
        editNotes
      );

      onSuccess('تم تحديث حالة اشتراك العضو بنجاح');
      setEditingParticipant(null);
      await fetchActiveActivityDetails(activeActivity.id);
      await fetchActivities();
    } catch (err: any) {
      onSuccess(err.message || 'فشل تحديث بيانات الاشتراك');
    } finally {
      setUpdatingParticipantLoading(false);
    }
  };

  // Confirm Remove Participant
  const handleConfirmRemoveParticipant = async () => {
    if (!activeActivity || !deletingParticipant) return;
    setRemovingParticipantLoading(true);

    try {
      await activitiesService.removeActivityParticipant(activeActivity.id, deletingParticipant.id);
      onSuccess(`تم إلغاء اشتراك العضو "${deletingParticipant.student_name}" بنجاح`);
      setDeletingParticipant(null);
      await fetchActiveActivityDetails(activeActivity.id);
      await fetchActivities();
    } catch (err: any) {
      onSuccess(err.message || 'فشل إلغاء اشتراك العضو');
    } finally {
      setRemovingParticipantLoading(false);
    }
  };

  // Filtered Activities for Cards View
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      const matchesSearch =
        !searchQuery ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.address && a.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.leader_name && a.leader_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.deputy_name && a.deputy_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === 'ALL' || a.type === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [activities, searchQuery, typeFilter, statusFilter]);

  // Filtered Participants in Detail View
  const filteredParticipants = useMemo(() => {
    if (!activeActivity) return [];
    return activeActivity.participants.filter((p) => {
      const matchesSearch =
        !participantSearch ||
        p.student_name.toLowerCase().includes(participantSearch.toLowerCase()) ||
        p.member_code.toLowerCase().includes(participantSearch.toLowerCase()) ||
        p.national_id.includes(participantSearch) ||
        (p.tribe_name && p.tribe_name.toLowerCase().includes(participantSearch.toLowerCase())) ||
        (p.father_phone && p.father_phone.includes(participantSearch));

      const matchesPayment = paymentFilter === 'ALL' || p.payment_status === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [activeActivity, participantSearch, paymentFilter]);

  // Overall Statistics for banner
  const totalCampsCount = activities.filter((a) => a.type === 'معسكر').length;
  const totalActivitiesCount = activities.filter((a) => a.type === 'نشاط').length;
  const totalParticipantsAll = activities.reduce((sum, a) => sum + (a.participant_count || 0), 0);
  const totalCollectedFeesAll = activities.reduce((sum, a) => sum + (a.total_fees_collected || 0), 0);

  // Print Participant Sheet
  const handlePrintParticipants = () => {
    window.print();
  };

  // Export Participants to CSV
  const handleExportParticipantsCsv = () => {
    if (!activeActivity || !activeActivity.participants.length) {
      onSuccess('لا يوجد مشتركون لتصديرهم');
      return;
    }

    const headers = [
      'م',
      'كود العضو',
      'اسم الطالبة / القائد',
      'الرقم القومي',
      'المرحلة الدراسية',
      'العشيرة',
      'هاتف ولي الأمر',
      'حالة الدفع',
      'المبلغ المدفوع (ج.م)',
      'ملاحظات',
    ];

    const rows = activeActivity.participants.map((p, idx) => [
      idx + 1,
      p.member_code || '',
      `"${p.student_name.replace(/"/g, '""')}"`,
      `'${p.national_id}`,
      p.school_stage || '',
      p.tribe_name || 'غير محدد',
      p.father_phone || p.mother_phone || '',
      p.payment_status || '',
      p.paid_amount || 0,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `مشتركو_${activeActivity.type}_${activeActivity.name.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccess('تم تصدير كشف المشتركين بنجاح');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & OVERVIEW BANNER                                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 shadow-xs">
              <Tent className="w-7 h-7 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-slate-900">أنشطة ومعسكرات</h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {activities.length} فعالية
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                إدارة وتنظيم المعسكرات الكشفية، الأنشطة والرحلات، ومتابعة اشتراكات الأعضاء والقادة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {selectedActivityId && (
              <button
                onClick={() => setSelectedActivityId(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>العودة لجميع البطاقات</span>
              </button>
            )}

            <button
              id="btn_add_activity_modal"
              onClick={handleOpenCreateModal}
              className="flex-1 md:flex-initial py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة نشاط أو معسكر جديد</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stats */}
        {!selectedActivityId && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المعسكرات</span>
              <span className="text-lg font-black text-emerald-800">{totalCampsCount}</span>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الأنشطة والرحلات</span>
              <span className="text-lg font-black text-blue-800">{totalActivitiesCount}</span>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المشتركين المسجلين</span>
              <span className="text-lg font-black text-slate-900">{totalParticipantsAll} مشترك</span>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الاشتراكات المحصلة</span>
              <span className="text-lg font-black text-emerald-700">{totalCollectedFeesAll.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-xs font-bold">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACTIVITY DETAIL VIEW (عند الدخول على بطاقة نشاط أو معسكر)              */}
      {/* ========================================================================= */}
      {selectedActivityId && activeActivity ? (
        <div className="space-y-6 animate-fade-in">
          {/* Detailed Activity Top Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            {/* Header info */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-start gap-4">
                <div
                  className={`p-3.5 rounded-2xl border ${
                    activeActivity.type === 'معسكر'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {activeActivity.type === 'معسكر' ? <Tent className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                        activeActivity.type === 'معسكر'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-blue-100 text-blue-800 border-blue-200'
                      }`}
                    >
                      {activeActivity.type}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                        activeActivity.status === 'مفتوح'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : activeActivity.status === 'جاري'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      حالة النشاط: {activeActivity.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mt-1.5">{activeActivity.name}</h2>
                </div>
              </div>

              {/* Action Buttons in Detail */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn_whatsapp_invites_trigger"
                  onClick={() => handleOpenWhatsAppModal(activeActivity)}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="إرسال دعوة وبيانات النشاط عبر الواتساب لأولياء الأمور"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>دعوة أولياء الأمور (واتساب)</span>
                </button>

                <button
                  id="btn_add_participant_trigger"
                  onClick={handleOpenAddParticipantModal}
                  className="py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة مشترك من الأعضاء</span>
                </button>

                <button
                  onClick={(e) => handleOpenEditModal(activeActivity, e)}
                  className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="تعديل بيانات النشاط"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>

                <button
                  onClick={handleExportParticipantsCsv}
                  className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="تصدير Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تصدير CSV</span>
                </button>

                <button
                  onClick={handlePrintParticipants}
                  className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="طباعة الكشف"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            {/* Comprehensive Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Location & Address */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  المكان والعنوان
                </span>
                <p className="font-bold text-slate-900 text-sm mt-1">{activeActivity.location}</p>
                {activeActivity.address && <p className="text-slate-600 text-[11px]">{activeActivity.address}</p>}
              </div>

              {/* Dates */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  الفترة الزمنية
                </span>
                <p className="font-bold text-slate-900 text-xs mt-1">
                  {activeActivity.start_date ? `من: ${activeActivity.start_date}` : 'تاريخ البداية: غير محدد'}
                </p>
                {activeActivity.end_date && (
                  <p className="text-slate-600 text-xs">إلى: {activeActivity.end_date}</p>
                )}
              </div>

              {/* Leaders */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  القيادة والإشراف
                </span>
                <p className="font-bold text-slate-900 text-xs mt-1">
                  القائد: {activeActivity.leader_name || 'غير محدد'}
                </p>
                <p className="text-slate-600 text-xs">
                  النائب: {activeActivity.deputy_name || 'غير محدد'}
                </p>
              </div>

              {/* Financials & Capacity */}
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
                <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  الاشتراك والتحصيل
                </span>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-600">قيمة الاشتراك للعضو:</span>
                  <span className="font-black text-emerald-800">{activeActivity.fee} ج.م</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">المحصل الفعلي:</span>
                  <span className="font-black text-emerald-700">
                    {(activeActivity.total_fees_collected || 0).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* Description if present */}
            {activeActivity.description && (
              <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block mb-0.5">وصف وملاحظات النشاط:</span>
                <p className="whitespace-pre-line leading-relaxed">{activeActivity.description}</p>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* PARTICIPANTS LIST TABLE (من قام بالاشتراك)                                */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            {/* Participants Header & Filters */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    قائمة المشتركين في {activeActivity.type} ({filteredParticipants.length} مشترك)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    يمكنك تسجيل مدفوعات الأعضاء، إضافة مشتركين جدد، أو إلغاء الاشتراك
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو الكود أو الهاتف..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Payment filter */}
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as any)}
                  className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-bold text-slate-700 cursor-pointer"
                >
                  <option value="ALL">جميع حالات الدفع</option>
                  <option value="مدفوع">مدفوع بالكامل</option>
                  <option value="غير مدفوع">غير مدفوع</option>
                  <option value="جزئي">دفع جزئي</option>
                </select>
              </div>
            </div>

            {/* Participants Table */}
            {filteredParticipants.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-xs font-bold">لا يوجد مشتركون يطابقون شروط البحث حالياً</p>
                <button
                  onClick={handleOpenAddParticipantModal}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة مشترك الآن من سجل الأعضاء</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">كود العضو</th>
                      <th className="py-3 px-3">اسم الطالبة / القائد</th>
                      <th className="py-3 px-3">الصف الدراسي</th>
                      <th className="py-3 px-3">العشيرة</th>
                      <th className="py-3 px-3">هاتف ولي الأمر</th>
                      <th className="py-3 px-3 text-center">حالة الدفع</th>
                      <th className="py-3 px-3">المبلغ المسدد</th>
                      <th className="py-3 px-3">ملاحظات</th>
                      <th className="py-3 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipants.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-800">{p.member_code}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{p.student_name}</span>
                            {p.member_type === 'قائد' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-800 font-bold">
                                قائد
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{p.school_stage}</td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {p.tribe_name ? (
                            <span className="inline-flex items-center gap-1 text-slate-800">
                              <Award className="w-3 h-3 text-amber-500" />
                              {p.tribe_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {p.father_phone || p.mother_phone || '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${
                              p.payment_status === 'مدفوع'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : p.payment_status === 'جزئي'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {p.paid_amount} ج.م
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                          {p.notes || '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* WhatsApp Button */}
                            {(p.father_phone || p.mother_phone) && (
                              <button
                                onClick={() => {
                                  const phone = p.father_phone || p.mother_phone || '';
                                  const formatted = formatWhatsAppPhone(phone);
                                  const text = buildActivityInvitationText({
                                    activity: activeActivity,
                                    studentName: p.student_name,
                                    guardianName: p.guardian_name || undefined,
                                    isRegistered: true,
                                    paymentStatus: p.payment_status,
                                    paidAmount: p.paid_amount,
                                    systemName: settings?.system_name || 'إدارة الكشافة',
                                    schoolName: settings?.school_name || '',
                                  });
                                  window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                                }}
                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition cursor-pointer"
                                title="إرسال بيانات النشاط والاشتراك لولي الأمر عبر واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEditParticipantModal(p)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                              title="تعديل الدفع والملاحظات"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingParticipant(p)}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                              title="إلغاء الاشتراك"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. CARDS GRID VIEW (عرض بطاقات الأنشطة والمعسكرات)                          */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input_search_activities"
                type="text"
                placeholder="بحث بالاسم أو المكان أو القائد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Type & Status Filter Pills */}
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-between md:justify-end">
              {/* Type Pills */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setTypeFilter('معسكر')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    typeFilter === 'معسكر' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  معسكرات
                </button>
                <button
                  onClick={() => setTypeFilter('نشاط')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    typeFilter === 'نشاط' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-blue-700'
                  }`}
                >
                  أنشطة ورحلات
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-bold text-slate-700 cursor-pointer"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="مفتوح">مفتوح للتسجيل</option>
                <option value="جاري">جاري التنفيذ</option>
                <option value="منتهي">منتهي</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Tent className="w-10 h-10 mx-auto animate-bounce text-emerald-600" />
              <p className="text-xs font-bold">جاري تحميل الأنشطة والمعسكرات...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <Tent className="w-14 h-14 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-800">لا توجد أنشطة أو معسكرات مضافة بعد</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                قم بالضغط على زر "إضافة نشاط أو معسكر جديد" لبدء تسجيل المعسكرات وتحديد القائد والنائب ورسوم الاشتراك وإضافة المشتركين.
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول نشاط أو معسكر</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredActivities.map((activity) => {
                const isCamp = activity.type === 'معسكر';
                return (
                  <div
                    key={activity.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Card Top Accent Bar & Header */}
                    <div>
                      <div className={`h-2 w-full ${isCamp ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <div className="p-5 space-y-4">
                        {/* Type & Status Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-lg border ${
                              isCamp
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {isCamp ? <Tent className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {activity.type}
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              activity.status === 'مفتوح'
                                ? 'bg-emerald-100 text-emerald-800'
                                : activity.status === 'جاري'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {activity.status}
                          </span>
                        </div>

                        {/* Title & Location */}
                        <div>
                          <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-800 transition">
                            {activity.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span className="font-semibold text-slate-700 truncate">{activity.location}</span>
                          </div>
                          {activity.address && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate pr-5">{activity.address}</p>
                          )}
                        </div>

                        {/* Leadership info */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              القائد:
                            </span>
                            <span className="font-bold text-slate-800 truncate max-w-[140px]">
                              {activity.leader_name || 'غير محدد'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5 text-slate-400" />
                              النائب:
                            </span>
                            <span className="font-semibold text-slate-700 truncate max-w-[140px]">
                              {activity.deputy_name || 'غير محدد'}
                            </span>
                          </div>
                        </div>

                        {/* Key Metrics: Fee & Participants */}
                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                          <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
                            <span className="text-[10px] text-emerald-800 font-bold block">قيمة الاشتراك</span>
                            <span className="text-sm font-black text-emerald-900">{activity.fee} ج.م</span>
                          </div>
                          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-center">
                            <span className="text-[10px] text-blue-800 font-bold block">المشتركون المسجلون</span>
                            <span className="text-sm font-black text-blue-900">
                              {activity.participant_count || 0} مشترك
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-3.5 bg-slate-50/90 border-t border-slate-100 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedActivityId(activity.id)}
                          className="flex-1 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>عرض التفاصيل والمشتركين</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWhatsAppModal(activity);
                          }}
                          className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          title="إرسال دعوة عبر الواتساب لأولياء الأمور"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>دعوة واتساب</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1.5 border-t border-slate-200/60">
                        <span className="text-[11px] text-slate-400">إدارة النشاط:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleOpenEditModal(activity, e)}
                            className="px-2 py-1 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                            title="تعديل"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingActivity(activity);
                              }}
                              className="px-2 py-1 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                              title="حذف"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: ADD / EDIT ACTIVITY OR CAMP                                     */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 animate-scale-in my-8 text-right">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
                  <Tent className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {editingActivity ? 'تعديل بيانات النشاط / المعسكر' : 'إضافة نشاط أو معسكر جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitActivityForm} className="space-y-4">
              {/* Type selector (معسكر / نشاط) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع الفعالية *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'معسكر' })}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      formData.type === 'معسكر'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Tent className="w-4 h-4" />
                    <span>معسكر كشفي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'نشاط' })}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      formData.type === 'نشاط'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>نشاط أو رحلة</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم النشاط أو المعسكر *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: معسكر إعداد القادة الصيفي، رحلة وادي الريان، ..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Location & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المكان *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أرض الكشافة بأبو قير"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">العنوان بالتفصيل</label>
                  <input
                    type="text"
                    placeholder="المدينة / المحافظة / تفاصيل العنوان"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Fee & Max Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    قيمة اشتراك العضو (ج.م) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="مثال: 250"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الحد الأقصى للمشتركين (اختياري)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="اتركه فارغاً لعدد مفتوح"
                    value={formData.max_participants}
                    onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Leader & Deputy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Leader Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>اسم القائد المسئول</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualLeader(!isManualLeader)}
                      className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 transition cursor-pointer"
                    >
                      {isManualLeader ? '← اختيار من قاعدة البيانات' : '✍️ إدخال يدوي'}
                    </button>
                  </div>

                  {isManualLeader ? (
                    <input
                      type="text"
                      placeholder="اكتب اسم القائد..."
                      value={formData.leader_name}
                      onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                    />
                  ) : (
                    <select
                      value={formData.leader_name}
                      onChange={(e) => {
                        if (e.target.value === '__manual__') {
                          setIsManualLeader(true);
                        } else {
                          setFormData({ ...formData, leader_name: e.target.value });
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-medium"
                    >
                      <option value="">-- اختر القائد من قاعدة البيانات --</option>
                      {formData.leader_name &&
                        !allMembers.some((m) => m.student_name === formData.leader_name) && (
                          <option value={formData.leader_name}>
                            {formData.leader_name} (الاسم المحفوظ حالياً)
                          </option>
                        )}
                      {dbLeadersList.leaders.length > 0 && (
                        <optgroup label="قادة وقائدات الكشافة (المسجلين)">
                          {dbLeadersList.leaders.map((m) => (
                            <option key={m.id} value={m.student_name}>
                              {m.student_name} ({m.member_code} - قائد)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {dbLeadersList.others.length > 0 && (
                        <optgroup label="باقي أعضاء الكشافة">
                          {dbLeadersList.others.map((m) => (
                            <option key={m.id} value={m.student_name}>
                              {m.student_name} ({m.member_code} - {m.school_stage})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__manual__">✍️ إدخال اسم يدوي آخر...</option>
                    </select>
                  )}
                </div>

                {/* Deputy Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span>اسم النائب</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualDeputy(!isManualDeputy)}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
                    >
                      {isManualDeputy ? '← اختيار من قاعدة البيانات' : '✍️ إدخال يدوي'}
                    </button>
                  </div>

                  {isManualDeputy ? (
                    <input
                      type="text"
                      placeholder="اكتب اسم نائب القائد..."
                      value={formData.deputy_name}
                      onChange={(e) => setFormData({ ...formData, deputy_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                    />
                  ) : (
                    <select
                      value={formData.deputy_name}
                      onChange={(e) => {
                        if (e.target.value === '__manual__') {
                          setIsManualDeputy(true);
                        } else {
                          setFormData({ ...formData, deputy_name: e.target.value });
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-medium"
                    >
                      <option value="">-- اختر نائب القائد من قاعدة البيانات --</option>
                      {formData.deputy_name &&
                        !allMembers.some((m) => m.student_name === formData.deputy_name) && (
                          <option value={formData.deputy_name}>
                            {formData.deputy_name} (الاسم المحفوظ حالياً)
                          </option>
                        )}
                      {dbLeadersList.leaders.length > 0 && (
                        <optgroup label="قادة وقائدات الكشافة (المسجلين)">
                          {dbLeadersList.leaders.map((m) => (
                            <option key={m.id} value={m.student_name}>
                              {m.student_name} ({m.member_code} - قائد)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {dbLeadersList.others.length > 0 && (
                        <optgroup label="باقي أعضاء الكشافة">
                          {dbLeadersList.others.map((m) => (
                            <option key={m.id} value={m.student_name}>
                              {m.student_name} ({m.member_code} - {m.school_stage})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__manual__">✍️ إدخال اسم يدوي آخر...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Dates & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ البداية</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ النهاية</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة النشاط</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-bold"
                  >
                    <option value="مفتوح">مفتوح للتسجيل</option>
                    <option value="جاري">جاري التنفيذ</option>
                    <option value="منتهي">منتهي</option>
                    <option value="ملغي">ملغي</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات وتفاصيل إضافية
                </label>
                <textarea
                  rows={2}
                  placeholder="أي تعليمات أو ملاحظات خاصة بالنشاط..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Form Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={formSaving}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {formSaving ? 'جاري الحفظ...' : editingActivity ? 'حفظ التعديلات' : 'إضافة النشاط / المعسكر'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: ADD PARTICIPANTS FROM REGISTERED MEMBERS                        */}
      {/* ========================================================================= */}
      {isAddParticipantModalOpen && activeActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 animate-scale-in my-8 text-right flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    إضافة مشتركين في {activeActivity.type}: {activeActivity.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    اختر العضوة أو القائد من قائمة الأعضاء المسجلين بالنظام لإضافتهم فوراً
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddParticipantModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment defaults for these new participants */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">حالة الدفع</label>
                <select
                  value={participantPaymentStatus}
                  onChange={(e) => {
                    const status = e.target.value as any;
                    setParticipantPaymentStatus(status);
                    if (status === 'مدفوع') setParticipantPaidAmount(activeActivity.fee.toString());
                    else if (status === 'غير مدفوع') setParticipantPaidAmount('0');
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 font-bold"
                >
                  <option value="مدفوع">مدفوع بالكامل ({activeActivity.fee} ج.م)</option>
                  <option value="غير مدفوع">غير مدفوع (0 ج.م)</option>
                  <option value="جزئي">دفع جزء من المبلغ</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ المسدد (ج.م)</label>
                <input
                  type="number"
                  min="0"
                  value={
                    participantPaymentStatus === 'مدفوع'
                      ? activeActivity.fee
                      : participantPaymentStatus === 'غير مدفوع'
                      ? '0'
                      : participantPaidAmount
                  }
                  disabled={participantPaymentStatus !== 'جزئي'}
                  onChange={(e) => setParticipantPaidAmount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl disabled:bg-slate-100 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات الاشتراك</label>
                <input
                  type="text"
                  placeholder="ملاحظات اختيارية..."
                  value={participantNotes}
                  onChange={(e) => setParticipantNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* Search & Stage Filter for available members */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث باسم الطالبة، الكود التسلسلي، أو العشيرة..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <select
                value={memberStageFilter}
                onChange={(e) => setMemberStageFilter(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold"
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

              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="py-2 px-3 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer whitespace-nowrap"
              >
                {selectedMemberIds.length === filteredAvailableMembers.length && filteredAvailableMembers.length > 0
                  ? 'إلغاء تحديد الكل'
                  : 'تحديد كل المعروض'}
              </button>
            </div>

            {/* Scrollable Members List */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 min-h-[240px] max-h-[360px]">
              {membersLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">جاري تحميل سجل الأعضاء...</div>
              ) : filteredAvailableMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  لا توجد نتائج مطابقة، أو أن جميع الأعضاء مسجلون بالفعل في هذا النشاط.
                </div>
              ) : (
                filteredAvailableMembers.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id);
                  return (
                    <div
                      key={member.id}
                      onClick={() => handleToggleMemberSelection(member.id)}
                      className={`p-3 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                        isSelected ? 'bg-emerald-50/70' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{member.student_name}</span>
                            <span className="font-mono text-[11px] font-bold text-emerald-700 px-1.5 py-0.2 bg-emerald-50 rounded-sm">
                              {member.member_code}
                            </span>
                            {member.member_type === 'قائد' && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-sm font-bold">
                                قائد
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                            <span>الصف: {member.school_stage}</span>
                            <span>العشيرة: {member.tribe_name || 'غير محددة'}</span>
                            {member.father_phone && <span>هاتف: {member.father_phone}</span>}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-800'
                        }`}
                      >
                        {isSelected ? 'محدد' : '+ اختيار'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-4">
              <span className="text-xs font-bold text-slate-600">
                المحدد حالياً: <span className="text-emerald-700">{selectedMemberIds.length}</span> عضو
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddParticipantModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={selectedMemberIds.length === 0 || addingParticipantsLoading}
                  onClick={handleSubmitAddParticipants}
                  className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {addingParticipantsLoading
                      ? 'جاري التسجيل...'
                      : `تسجيل اشتراك (${selectedMemberIds.length}) عضو`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: EDIT PARTICIPANT PAYMENT                                        */}
      {/* ========================================================================= */}
      {editingParticipant && activeActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 animate-scale-in text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900">
                تحديث اشتراك: {editingParticipant.student_name}
              </h3>
              <button
                onClick={() => setEditingParticipant(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">حالة الدفع</label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => {
                    const status = e.target.value as any;
                    setEditPaymentStatus(status);
                    if (status === 'مدفوع') setEditPaidAmount(activeActivity.fee.toString());
                    else if (status === 'غير مدفوع') setEditPaidAmount('0');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="مدفوع">مدفوع بالكامل ({activeActivity.fee} ج.م)</option>
                  <option value="غير مدفوع">غير مدفوع (0 ج.م)</option>
                  <option value="جزئي">دفع جزئي</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ المدفوع فعلياً (ج.م)</label>
                <input
                  type="number"
                  min="0"
                  value={
                    editPaymentStatus === 'مدفوع'
                      ? activeActivity.fee
                      : editPaymentStatus === 'غير مدفوع'
                      ? '0'
                      : editPaidAmount
                  }
                  disabled={editPaymentStatus !== 'جزئي'}
                  onChange={(e) => setEditPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات</label>
                <input
                  type="text"
                  placeholder="ملاحظات إضافية..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button
                  disabled={updatingParticipantLoading}
                  onClick={handleSubmitEditParticipant}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition text-xs shadow-xs"
                >
                  {updatingParticipantLoading ? 'جاري الحفظ...' : 'حفظ التحديث'}
                </button>
                <button
                  onClick={() => setEditingParticipant(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: CONFIRM REMOVE PARTICIPANT                                      */}
      {/* ========================================================================= */}
      {deletingParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center animate-scale-in">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">تأكيد إلغاء اشتراك العضو</h3>
            <p className="text-xs text-slate-600 mb-4">
              هل أنت متأكد من إلغاء اشتراك{' '}
              <span className="font-bold text-slate-900">"{deletingParticipant.student_name}"</span> من هذا النشاط؟
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={removingParticipantLoading}
                onClick={handleConfirmRemoveParticipant}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition text-xs shadow-xs"
              >
                {removingParticipantLoading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
              <button
                onClick={() => setDeletingParticipant(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: CONFIRM DELETE ACTIVITY                                         */}
      {/* ========================================================================= */}
      {deletingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center animate-scale-in">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">
              حذف {deletingActivity.type} "{deletingActivity.name}"
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              هل أنت متأكد من حذف هذا {deletingActivity.type} بالكامل؟ سيتم حذف جميع بيانات وسجلات المشتركين فيه نهائياً.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={deleteLoading}
                onClick={handleConfirmDeleteActivity}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition text-xs shadow-xs"
              >
                {deleteLoading ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}
              </button>
              <button
                onClick={() => setDeletingActivity(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* 9. MODAL: WHATSAPP INVITATION DISPATCHER                                  */}
      {/* ========================================================================= */}
      {whatsAppModalOpen && whatsAppActivity && (
        <WhatsAppInviteModal
          isOpen={whatsAppModalOpen}
          onClose={() => setWhatsAppModalOpen(false)}
          activity={whatsAppActivity}
          participants={whatsAppParticipants}
          allMembers={allMembers}
          settings={settings}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
};
