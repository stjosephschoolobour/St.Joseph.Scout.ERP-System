import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Edit2,
  Trash2,
  Users,
  Shield,
  Search,
  X,
  UserPlus,
  UserMinus,
  Crown,
  RefreshCw,
  Eye,
  CalendarCheck,
} from 'lucide-react';
import { Tribe, TribeFormData } from '../types';
import { Member } from '../../members/types';
import { User } from '../../auth/types';
import { tribesService } from '../services/tribesService';
import { membersService } from '../../members/services/membersService';
import { TribeAttendanceModal } from './TribeAttendanceModal';

export interface TribesViewProps {
  user: User;
  onSelectMember: (member: Member) => void;
  onOpenAddMember?: () => void;
  onSuccess?: (msg: string) => void;
  onRefreshData?: () => void;
}

export const TribesView: React.FC<TribesViewProps> = ({
  user,
  onSelectMember,
  onSuccess,
  onRefreshData,
}) => {
  const isAdmin = user.role === 'ADMIN';

  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tribe Form Modal (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTribe, setEditingTribe] = useState<Tribe | null>(null);
  const [formData, setFormData] = useState<TribeFormData>({
    name: '',
    code: '',
    leader_id: '',
    deputy_id: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Manage Tribe Members Modal
  const [selectedTribeForMembers, setSelectedTribeForMembers] = useState<Tribe | null>(null);
  const [tribeMembersList, setTribeMembersList] = useState<Member[]>([]);
  const [loadingTribeMembers, setLoadingTribeMembers] = useState(false);
  const [addMembersModalOpen, setAddMembersModalOpen] = useState(false);
  const [selectedMemberIdsToAdd, setSelectedMemberIdsToAdd] = useState<number[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Delete Confirmation Modal
  const [deletingTribe, setDeletingTribe] = useState<Tribe | null>(null);

  // Tribe Attendance Modal
  const [selectedTribeForAttendance, setSelectedTribeForAttendance] = useState<Tribe | null>(null);

  const fetchTribesAndMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tribesData, membersData] = await Promise.all([
        tribesService.getTribes(),
        membersService.getMembers(),
      ]);
      setTribes(tribesData);
      setAllMembers(membersData);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات العشائر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTribesAndMembers();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    if (onSuccess) onSuccess(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Open Create Tribe
  const handleOpenCreate = () => {
    setEditingTribe(null);
    const nextNum = tribes.length + 1;
    setFormData({
      name: '',
      code: `TR-${String(nextNum).padStart(3, '0')}`,
      leader_id: '',
      deputy_id: '',
      description: '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  // Open Edit Tribe
  const handleOpenEdit = (tribe: Tribe) => {
    setEditingTribe(tribe);
    setFormData({
      name: tribe.name,
      code: tribe.code,
      leader_id: tribe.leader_id ? String(tribe.leader_id) : '',
      deputy_id: tribe.deputy_id ? String(tribe.deputy_id) : '',
      description: tribe.description || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  // Submit Tribe Form (Create or Edit)
  const handleSubmitTribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'اسم العشيرة إجباري';
    }
    if (formData.leader_id && formData.deputy_id && formData.leader_id === formData.deputy_id) {
      errors.deputy_id = 'لا يمكن أن يكون القائد ونائب القائد نفس الشخص';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      if (editingTribe) {
        await tribesService.updateTribe(editingTribe.id, formData);
        showNotification(`تم تحديث عشيرة "${formData.name}" بنجاح`);
      } else {
        await tribesService.createTribe(formData);
        showNotification(`تم إنشاء عشيرة "${formData.name}" بنجاح`);
      }
      setIsFormOpen(false);
      await fetchTribesAndMembers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setFormErrors({ submit: err.message || 'فشلت العملية' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Tribe
  const handleDeleteTribe = async () => {
    if (!deletingTribe) return;
    try {
      setSubmitting(true);
      await tribesService.deleteTribe(deletingTribe.id);
      showNotification(`تم حذف عشيرة "${deletingTribe.name}" بنجاح`);
      setDeletingTribe(null);
      await fetchTribesAndMembers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setError(err.message || 'فشل حذف العشيرة');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Tribe Members View
  const handleOpenTribeMembers = async (tribe: Tribe) => {
    setSelectedTribeForMembers(tribe);
    setLoadingTribeMembers(true);
    try {
      const details = await tribesService.getTribe(tribe.id);
      setTribeMembersList(details.members || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTribeMembers(false);
    }
  };

  // Remove Member from Tribe
  const handleRemoveMemberFromTribe = async (memberId: number) => {
    if (!selectedTribeForMembers) return;
    try {
      await tribesService.removeMemberFromTribe(selectedTribeForMembers.id, memberId);
      setTribeMembersList((prev) => prev.filter((m) => m.id !== memberId));
      showNotification('تم إزالة العضو من العشيرة بنجاح');
      await fetchTribesAndMembers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.message || 'فشل إزالة العضو');
    }
  };

  // Add Selected Members to Tribe
  const handleConfirmAddMembers = async () => {
    if (!selectedTribeForMembers || selectedMemberIdsToAdd.length === 0) return;
    try {
      setSubmitting(true);
      await tribesService.addMembersToTribe(selectedTribeForMembers.id, selectedMemberIdsToAdd);
      showNotification(`تمت إضافة ${selectedMemberIdsToAdd.length} عضو إلى العشيرة`);
      setSelectedMemberIdsToAdd([]);
      setAddMembersModalOpen(false);
      // Reload tribe members
      const details = await tribesService.getTribe(selectedTribeForMembers.id);
      setTribeMembersList(details.members || []);
      await fetchTribesAndMembers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة الأعضاء');
    } finally {
      setSubmitting(false);
    }
  };

  // Candidate members to add (Members not currently in this tribe)
  const candidateMembers = allMembers.filter(
    (m) =>
      m.tribe_id !== selectedTribeForMembers?.id &&
      (memberSearchQuery === '' ||
        m.student_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.member_code?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.national_id.includes(memberSearchQuery))
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            عشائر الكشافة (Tribes)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة الفرق والعشائر، وتعيين القادة والنواب، وتوزيع الأعضاء
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={fetchTribesAndMembers}
            disabled={loading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              id="btn-add-tribe"
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عشيرة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Leader Specific Welcome Banner */}
      {user.role === 'LEADER' && (
        <div className="p-4 bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-2xl shadow-sm border border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/80 flex items-center justify-center text-emerald-300 shrink-0 border border-emerald-700/50">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                مرحباً بك، القائد {user.full_name || user.username}!
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                {user.tribe_name ? (
                  <>
                    أنت مسؤول عن متابعة وتسجيل حضور عشيرة: <strong className="text-white underline">{user.tribe_name}</strong>
                  </>
                ) : (
                  'يمكنك تصفح العشائر وجدولة الاجتماعات وتسجيل حضور الأعضاء.'
                )}
              </p>
            </div>
          </div>
          {user.tribe_id && (
            <button
              onClick={() => {
                const myTribe = tribes.find((t) => t.id === user.tribe_id);
                if (myTribe) setSelectedTribeForAttendance(myTribe);
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>سجل حضور عشيرتك الآن</span>
            </button>
          )}
        </div>
      )}

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-between animate-fade-in">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      )}

      {/* Tribes Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">جاري تحميل بيانات العشائر...</div>
      ) : tribes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">لا توجد عشائر مسجلة حالياً</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك البدء بإنشاء عشيرة جديدة وتعيين قائد لها وتوزيع الأعضاء عليها.
          </p>
          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition mt-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء أول عشيرة</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tribes.map((tribe) => {
            const isMyTribe = user.role === 'LEADER' && user.tribe_id === tribe.id;
            return (
              <div
                key={tribe.id}
                className={`bg-white rounded-2xl border transition flex flex-col justify-between overflow-hidden relative ${
                  isMyTribe
                    ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300'
                }`}
              >
                {isMyTribe && (
                  <div className="bg-emerald-600 text-white text-[10px] font-black px-3 py-1 text-center tracking-wider">
                    عشيرتك المسؤولة (Your Assigned Tribe)
                  </div>
                )}
                <div className="p-5 space-y-4">
                  {/* Top Title & Code */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {tribe.code}
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1">{tribe.name}</h3>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{tribe.member_count || 0} عضو</span>
                    </div>
                  </div>

                {tribe.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{tribe.description}</p>
                )}

                {/* Leader & Deputy Information */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      قائد العشيرة:
                    </span>
                    <span className="font-bold text-slate-800">
                      {tribe.leader_name || <span className="text-slate-400 font-normal">لم يعيّن</span>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      نائب القائد:
                    </span>
                    <span className="font-bold text-slate-800">
                      {tribe.deputy_name || <span className="text-slate-400 font-normal">لم يعيّن</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    id={`btn-attendance-tribe-${tribe.id}`}
                    onClick={() => setSelectedTribeForAttendance(tribe)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition cursor-pointer"
                    title="تسجيل حضور وغياب اجتماعات العشيرة"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>سجل الحضور</span>
                  </button>

                  <button
                    id={`btn-view-tribe-${tribe.id}`}
                    onClick={() => handleOpenTribeMembers(tribe)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>الأعضاء ({tribe.member_count || 0})</span>
                  </button>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      id={`btn-edit-tribe-${tribe.id}`}
                      onClick={() => handleOpenEdit(tribe)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200 cursor-pointer"
                      title="تعديل العشيرة"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      id={`btn-delete-tribe-${tribe.id}`}
                      onClick={() => setDeletingTribe(tribe)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200 cursor-pointer"
                      title="حذف العشيرة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}

      {/* --- MODAL 1: Create / Edit Tribe --- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                {editingTribe ? 'تعديل بيانات العشيرة' : 'إضافة عشيرة جديدة'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTribe} className="space-y-4 text-xs">
              {formErrors.submit && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold">
                  {formErrors.submit}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Code */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">كود العشيرة</label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="TR-001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    اسم العشيرة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: عشيرة النسور"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  {formErrors.name && <p className="text-rose-500 text-[11px] mt-1">{formErrors.name}</p>}
                </div>
              </div>

              {/* Assign Leader */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  قائد العشيرة (من الأعضاء المسجلين)
                </label>
                <select
                  value={formData.leader_id || ''}
                  onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- بدون قائد حالياً --</option>
                  {allMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.student_name} ({m.member_code} - {m.member_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign Deputy */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  نائب قائد العشيرة
                </label>
                <select
                  value={formData.deputy_id || ''}
                  onChange={(e) => setFormData({ ...formData, deputy_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- بدون نائب حالياً --</option>
                  {allMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.student_name} ({m.member_code} - {m.member_type})
                    </option>
                  ))}
                </select>
                {formErrors.deputy_id && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.deputy_id}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">وصف أو ملاحظات</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف مختصر للعشيرة أو أهدافها..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {submitting ? 'جاري الحفظ...' : editingTribe ? 'حفظ التعديلات' : 'إنشاء العشيرة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Manage Tribe Members --- */}
      {selectedTribeForMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                    {selectedTribeForMembers.code}
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    أعضاء عشيرة: {selectedTribeForMembers.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  إجمالي الأعضاء الحاليين: {tribeMembersList.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTribeForAttendance(selectedTribeForMembers)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4 text-emerald-600" />
                  <span>سجل الحضور والغياب</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setSelectedMemberIdsToAdd([]);
                      setMemberSearchQuery('');
                      setAddMembersModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إضافة أعضاء للعشيرة</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedTribeForMembers(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="p-5 flex-1 overflow-y-auto">
              {loadingTribeMembers ? (
                <div className="py-8 text-center text-slate-400 text-xs">جاري تحميل الأعضاء...</div>
              ) : tribeMembersList.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">لا يوجد أعضاء منضمين لهذه العشيرة حالياً</p>
                  {isAdmin && (
                    <p className="text-[11px] text-slate-500">
                      اضغط على زر "إضافة أعضاء للعشيرة" أعلاه لإلحاق طالبات وقادة.
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">كود العضو</th>
                        <th className="py-2.5 px-3">اسم الطالبة</th>
                        <th className="py-2.5 px-3">الصف</th>
                        <th className="py-2.5 px-3">الصفة</th>
                        <th className="py-2.5 px-3">الدور بالعشيرة</th>
                        <th className="py-2.5 px-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tribeMembersList.map((m) => {
                        const isLeader = selectedTribeForMembers.leader_id === m.id;
                        const isDeputy = selectedTribeForMembers.deputy_id === m.id;

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                              {m.member_code || `A25${String(m.id).padStart(4, '0')}`}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{m.student_name}</td>
                            <td className="py-2.5 px-3 text-slate-600">{m.school_stage}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-2 py-0.2 rounded text-[10px] font-bold ${
                                  m.member_type === 'قائد'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {m.member_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {isLeader && (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] inline-flex items-center gap-1">
                                  <Crown className="w-3 h-3" />
                                  قائد العشيرة
                                </span>
                              )}
                              {isDeputy && (
                                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[10px] inline-flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  نائب القائد
                                </span>
                              )}
                              {!isLeader && !isDeputy && (
                                <span className="text-slate-400 font-normal">عضو عادي</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => onSelectMember(m)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-[11px] transition cursor-pointer"
                                >
                                  البطاقة
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleRemoveMemberFromTribe(m.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                    title="إزالة من العشيرة"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
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

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedTribeForMembers(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Add Members Selector to Tribe --- */}
      {addMembersModalOpen && selectedTribeForMembers && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                إضافة أعضاء إلى: {selectedTribeForMembers.name}
              </h4>
              <button
                onClick={() => setAddMembersModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم أو الكود أو الرقم القومي..."
                  className="w-full pr-9 pl-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-3 flex-1 overflow-y-auto space-y-1">
              {candidateMembers.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  لا توجد نتائج مطابقة أو أن جميع الأعضاء مسجلون بالفعل.
                </div>
              ) : (
                candidateMembers.map((m) => {
                  const isChecked = selectedMemberIdsToAdd.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedMemberIdsToAdd((prev) => prev.filter((id) => id !== m.id));
                            } else {
                              setSelectedMemberIdsToAdd((prev) => [...prev, m.id]);
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{m.student_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {m.member_code} • {m.school_stage} • {m.member_type}
                            {m.tribe_name ? ` (حالياً في: ${m.tribe_name})` : ' (بدون عشيرة)'}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">
                تم تحديد: {selectedMemberIdsToAdd.length} عضو
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddMembersModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddMembers}
                  disabled={submitting || selectedMemberIdsToAdd.length === 0}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'جاري الإضافة...' : 'تأكيد الإضافة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Delete Tribe Confirmation --- */}
      {deletingTribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">تأكيد حذف العشيرة</h3>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من حذف عشيرة "{deletingTribe.name}"؟ لن يتم حذف الأعضاء المنتمين لها ولكن سيتم فك ارتباطهم بها.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTribe(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteTribe}
                disabled={submitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {submitting ? 'جاري الحذف...' : 'نعم، حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: Tribe Attendance Modal --- */}
      {selectedTribeForAttendance && (
        <TribeAttendanceModal
          tribe={selectedTribeForAttendance}
          isOpen={!!selectedTribeForAttendance}
          onClose={() => setSelectedTribeForAttendance(null)}
          onSelectMember={onSelectMember}
          onSuccess={showNotification}
        />
      )}
    </div>
  );
};
