import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Lock,
  Camera,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { UserProfileRequest } from '../types';
import { profileService } from '../services/profileService';

interface ProfileRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export const ProfileRequestsModal: React.FC<ProfileRequestsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [requests, setRequests] = useState<UserProfileRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await profileService.getPendingRequests();
      setRequests(res.requests || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل في جلب طلبات تعديل الحسابات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
      setRejectingId(null);
      setRejectReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApprove = async (request: UserProfileRequest) => {
    if (!window.confirm(`هل أنت متأكد من اعتماد وموافقة تعديلات حساب ${request.full_name || request.username}؟`)) {
      return;
    }

    setActionLoadingId(request.id);
    try {
      await profileService.approveRequest(request.id);
      if (onSuccess) onSuccess(`تمت الموافقة على تعديل حساب ${request.full_name || request.username}`);
      await fetchRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل في الموافقة على الطلب');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingId) return;

    setActionLoadingId(rejectingId);
    try {
      await profileService.rejectRequest(rejectingId, rejectReason.trim());
      if (onSuccess) onSuccess('تم رفض طلب التعديل بنجاح');
      setRejectingId(null);
      setRejectReason('');
      await fetchRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل في رفض الطلب');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div
      id="profile-requests-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden transition-colors my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  طلبات تعديل بيانات الحسابات
                </h3>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {pendingCount} معلق
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مراجعة واعتماد أو رفض تعديلات الصورة، الهواتف، العناوين، وكلمات السر للقادة والمستخدمين
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="btn-close-profile-requests"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">الحالة:</span>
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === st
                  ? 'bg-slate-900 text-white dark:bg-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {st === 'PENDING'
                ? `المعلقة (${requests.filter((r) => r.status === 'PENDING').length})`
                : st === 'APPROVED'
                ? 'المقبولة'
                : st === 'REJECTED'
                ? 'المرفوضة'
                : 'الكل'}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">جاري تحميل طلبات التعديل...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">لا توجد طلبات في هذا القسم حالياً</p>
              <p className="text-xs mt-1">عند قيام أي قائد أو مستخدم بتعديل حسابه، ستظهر طلباته هنا للموافقة عليها.</p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isPending = req.status === 'PENDING';
              const isApproved = req.status === 'APPROVED';
              const isRejected = req.status === 'REJECTED';

              const hasPhotoChange =
                req.requested_photo_path && req.requested_photo_path !== req.current_photo_path;
              const hasPhoneChange =
                req.requested_phone && req.requested_phone !== req.current_phone;
              const hasEmailChange =
                req.requested_email && req.requested_email !== req.current_email;
              const hasAddressChange =
                req.requested_address && req.requested_address !== req.current_address;

              return (
                <div
                  key={req.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isPending
                      ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20'
                      : isApproved
                      ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 opacity-90'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-80'
                  }`}
                >
                  {/* Top Bar: User details & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {req.requested_photo_path || req.current_photo_path ? (
                          <img
                            src={req.requested_photo_path || req.current_photo_path || ''}
                            alt={req.full_name || req.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (req.full_name || req.username || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {req.full_name || req.username}
                          </h4>
                          <span className="text-xs text-slate-500 font-mono">@{req.username}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>{req.role === 'LEADER' ? 'قائد' : req.role === 'DATA_ENTRY' ? 'مدخل بيانات' : 'مستخدم'}</span>
                          {req.tribe_name && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{req.tribe_name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(req.created_at).toLocaleString('ar-EG')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div>
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>بانتظار موافقتك</span>
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>تمت الموافقة</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>مرفوض</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Changes Grid / Comparison */}
                  <div className="py-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Photo Change */}
                    {hasPhotoChange && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold block text-slate-700 dark:text-slate-300">تغيير الصورة الشخصية:</span>
                          <div className="flex items-center gap-2 mt-1">
                            {req.current_photo_path ? (
                              <img
                                src={req.current_photo_path}
                                alt="Current"
                                className="w-8 h-8 rounded-lg object-cover border"
                                title="الصورة القديمة"
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400">بدون سابقة</span>
                            )}
                            <span className="text-slate-400">⬅</span>
                            <img
                              src={req.requested_photo_path || ''}
                              alt="New"
                              className="w-8 h-8 rounded-lg object-cover border-2 border-emerald-500"
                              title="الصورة الجديدة المطلوبة"
                            />
                            <span className="text-emerald-600 font-semibold text-[11px]">صورة جديدة</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Phone Change */}
                    {hasPhoneChange && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                        <Phone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-slate-700 dark:text-slate-300">رقم التليفون:</span>
                          <div className="mt-0.5 space-y-0.5 font-mono" dir="ltr">
                            {req.current_phone && (
                              <p className="line-through text-slate-400 text-[11px]">{req.current_phone}</p>
                            )}
                            <p className="text-emerald-700 dark:text-emerald-400 font-bold">{req.requested_phone}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Email Change */}
                    {hasEmailChange && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                        <Mail className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-slate-700 dark:text-slate-300">البريد الإلكتروني:</span>
                          <div className="mt-0.5 space-y-0.5 font-mono" dir="ltr">
                            {req.current_email && (
                              <p className="line-through text-slate-400 text-[11px]">{req.current_email}</p>
                            )}
                            <p className="text-emerald-700 dark:text-emerald-400 font-bold">{req.requested_email}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Address Change */}
                    {hasAddressChange && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-slate-700 dark:text-slate-300">العنوان:</span>
                          <div className="mt-0.5 space-y-0.5">
                            {req.current_address && (
                              <p className="line-through text-slate-400 text-[11px]">{req.current_address}</p>
                            )}
                            <p className="text-emerald-700 dark:text-emerald-400 font-medium">{req.requested_address}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Password Change Requested */}
                    {req.has_new_password && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                        <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300">طلب تغيير كلمة المرور</span>
                          <p className="text-[11px] text-slate-500">تم إدخال كلمة سر جديدة ومطابقة كلمة السر السابقة بنجاح</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rejection Notes or Review Details */}
                  {req.admin_notes && (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
                      <span className="font-bold">سبب الرفض / الملاحظات: </span>
                      <span>{req.admin_notes}</span>
                    </div>
                  )}

                  {req.reviewed_by && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      تمت المراجعة بواسطة: <span className="font-semibold text-slate-600 dark:text-slate-300">{req.reviewed_by}</span> في{' '}
                      {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString('ar-EG') : ''}
                    </p>
                  )}

                  {/* Reject reason input prompt */}
                  {rejectingId === req.id && (
                    <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 space-y-2">
                      <label className="block text-xs font-bold text-rose-700 dark:text-rose-400">
                        سبب رفض طلب التعديل (سيظهر للمستخدم):
                      </label>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="مثال: يرجى كتابة العنوان بالتفصيل، أو رقم الهاتف غير مطابق"
                        className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason('');
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmReject}
                          disabled={actionLoadingId === req.id}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
                        >
                          {actionLoadingId === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>تأكيد الرفض</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons for Pending Requests */}
                  {isPending && rejectingId !== req.id && (
                    <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        id={`btn-reject-request-${req.id}`}
                        onClick={() => {
                          setRejectingId(req.id);
                          setRejectReason('');
                        }}
                        disabled={actionLoadingId === req.id}
                        className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        <span>رفض الطلب</span>
                      </button>

                      <button
                        type="button"
                        id={`btn-approve-request-${req.id}`}
                        onClick={() => handleApprove(req)}
                        disabled={actionLoadingId === req.id}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {actionLoadingId === req.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span>قبول واعتماد التعديلات</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
