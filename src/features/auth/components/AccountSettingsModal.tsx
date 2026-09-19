import React, { useState, useEffect, useRef } from 'react';
import {
  User as UserIcon,
  Camera,
  Phone,
  Mail,
  MapPin,
  Lock,
  Moon,
  Sun,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { User, UserProfileRequest, ProfileFormData } from '../types';
import { profileService } from '../services/profileService';
import { useTheme } from '../../../core/theme/ThemeContext';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onProfileUpdated?: (updatedUser?: User) => void;
  onSuccess?: (msg: string) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  onSuccess,
}) => {
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  // Form fields
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [photoPath, setPhotoPath] = useState('');

  // Password fields
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Requests state
  const [pendingRequest, setPendingRequest] = useState<UserProfileRequest | null>(null);
  const [lastRejectedRequest, setLastRejectedRequest] = useState<UserProfileRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset messages
    setErrorMessage(null);
    setSuccessMessage(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordSection(false);

    // Populate initial state from currentUser
    setPhone(currentUser.phone || '');
    setEmail(currentUser.email || '');
    setAddress(currentUser.address || '');
    setPhotoPath(currentUser.photo_path || '');

    // Fetch fresh profile & request status
    const loadProfileData = async () => {
      setLoading(true);
      try {
        const data = await profileService.getProfile();
        if (data.user) {
          setPhone(data.user.phone || '');
          setEmail(data.user.email || '');
          setAddress(data.user.address || '');
          setPhotoPath(data.user.photo_path || '');
        }
        setPendingRequest(data.pending_request);
        setLastRejectedRequest(data.last_rejected_request);
      } catch (err: any) {
        console.error('Failed to load profile details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  // Handle Photo Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setErrorMessage(null);

    try {
      const res = await profileService.uploadPhoto(file);
      if (res?.photo_path) {
        setPhotoPath(res.photo_path);
        setSuccessMessage('تم رفع الصورة بنجاح');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل في رفع الصورة');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Theme Change
  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    try {
      await profileService.updateTheme(newTheme);
    } catch {
      // Local theme is already applied
    }
  };

  // Cancel Pending Request
  const handleCancelRequest = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء طلب التعديل المعلق؟')) return;

    setCancellingRequest(true);
    try {
      await profileService.cancelProfileRequest();
      setPendingRequest(null);
      setSuccessMessage('تم إلغاء طلب التعديل بنجاح');
      if (onSuccess) onSuccess('تم إلغاء طلب التعديل');
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل في إلغاء الطلب');
    } finally {
      setCancellingRequest(false);
    }
  };

  // Submit Changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Password validation
    if (showPasswordSection || newPassword) {
      if (!currentPassword) {
        setErrorMessage('يرجى إدخال كلمة المرور الحالية لتأكيد التغيير');
        return;
      }
      if (newPassword.length < 4) {
        setErrorMessage('كلمة المرور الجديدة يجب أن لا تقل عن 4 خانات');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('كلمة المرور وتأكيدها غير متطابقين');
        return;
      }
    }

    setSaving(true);

    try {
      const payload: ProfileFormData = {
        photo_path: photoPath || undefined,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        theme_preference: theme,
      };

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
        payload.confirm_password = confirmPassword;
      }

      const res = await profileService.submitProfileRequest(payload);

      if (res.auto_approved) {
        setSuccessMessage('تم حفظ وتطبيق التعديلات على حسابك بنجاح');
        if (onProfileUpdated) onProfileUpdated(res.user);
        if (onSuccess) onSuccess('تم تحديث بيانات الحساب بنجاح');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setSuccessMessage('تم إرسال طلب التعديل بنجاح، وهو الآن بانتظار موافقة الإدارة أو المدير.');
        setPendingRequest(res.request || ({
          id: Date.now(),
          user_id: currentUser.id,
          requested_photo_path: photoPath,
          requested_phone: phone,
          requested_email: email,
          requested_address: address,
          status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserProfileRequest));
        if (onSuccess) onSuccess('تم إرسال طلب التعديل بانتظار موافقة المدير');
      }

      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="account-settings-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden transition-colors my-auto">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                إعدادات الحساب والملف الشخصي
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تعديل البيانات الشخصية، الصورة، كلمة السر، ومظهر النظام
              </p>
            </div>
          </div>
          <button
            id="btn-close-account-settings"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Notifications & Banners */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-red-800 dark:text-red-300 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Pending Request Banner for Non-Admin Users */}
          {pendingRequest && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-amber-950 dark:text-amber-100">
                    طلب تعديل الحساب قيد المراجعة حالياً
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                    تعديلاتك بانتظار اعتماد وموافقة المدير أو مسؤول النظام (Admin) لتصبح سارية.
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
                    تاريخ الطلب: {new Date(pendingRequest.created_at).toLocaleString('ar-EG')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-cancel-profile-request"
                onClick={handleCancelRequest}
                disabled={cancellingRequest}
                className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {cancellingRequest ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                )}
                <span>إلغاء الطلب</span>
              </button>
            </div>
          )}

          {/* Last Rejected Request Banner */}
          {!pendingRequest && lastRejectedRequest && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">ملاحظة من الإدارة حول طلب التعديل السابق:</span>
                <span>{lastRejectedRequest.admin_notes || 'تم رفض طلب التعديل السابق من قبل المدير.'}</span>
              </div>
            </div>
          )}

          {/* Section 1: Profile Photo & Basic Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            {/* Photo Avatar with upload button */}
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-md flex items-center justify-center">
                {photoPath ? (
                  <img
                    src={photoPath}
                    alt={currentUser.full_name || currentUser.username}
                    className="w-full h-full object-cover"
                    onError={() => setPhotoPath('')}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 text-white flex items-center justify-center font-bold text-2xl">
                    {(currentUser.full_name || currentUser.username).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Upload Overlay Button */}
              <button
                type="button"
                id="btn-upload-profile-photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-transform hover:scale-105 cursor-pointer disabled:opacity-50"
                title="تغيير الصورة الشخصية"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>

            {/* Account Info */}
            <div className="flex-1 text-center sm:text-right space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 justify-center sm:justify-start">
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {currentUser.full_name || currentUser.username}
                </h4>
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full self-center sm:self-auto ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : currentUser.role === 'LEADER'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {currentUser.role === 'ADMIN'
                    ? 'مدير النظام (Admin)'
                    : currentUser.role === 'LEADER'
                    ? currentUser.tribe_name
                      ? `قائد: ${currentUser.tribe_name}`
                      : 'قائد عشيرة (Leader)'
                    : 'مدخل بيانات (Data Entry)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                اسم المستخدم: @{currentUser.username}
              </p>
              {currentUser.member_code && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  الكود الكشفي: <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{currentUser.member_code}</span>
                </p>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                {isAdmin
                  ? 'يتم تطبيق تعديلاتك مباشرة بصفتك مديراً للنظام.'
                  : 'أي تعديلات على البيانات أو الصورة تتطلب اعتماد وموافقة المدير أو مسؤول النظام.'}
              </p>
            </div>
          </div>

          {/* Section 2: Contact Information (Phone, Email, Address) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>البيانات الشخصية ووسائل التواصل</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  رقم التليفون
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-profile-phone"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 01003634538"
                    className="w-full pr-9 pl-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  البريد الإلكتروني (Email)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-profile-email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full pr-9 pl-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                العنوان السكني
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                <textarea
                  id="input-profile-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="المدينة، الحي، اسم الشارع، رقم العمارة..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Theme Selector (الوضع الليلي والنهاري) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              اختيار مظهر النظام (الوضع الليلي والنهاري)
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {/* Light Mode Card */}
              <button
                type="button"
                id="btn-theme-light"
                onClick={() => handleThemeChange('light')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition cursor-pointer text-right ${
                  theme === 'light'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    theme === 'light'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold">الوضع النهاري (Light)</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    واجهة فاتحة ومريحة للقراءة
                  </p>
                </div>
              </button>

              {/* Dark Mode Card */}
              <button
                type="button"
                id="btn-theme-dark"
                onClick={() => handleThemeChange('dark')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition cursor-pointer text-right ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    theme === 'dark'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold">الوضع الليلي (Dark)</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    واجهة داكنة مريحة للعين ليلاً
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 4: Change Password (تعديل كلمة السر) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-500" />
                <span>تعديل كلمة السر والأمان</span>
              </h4>
              <button
                type="button"
                id="btn-toggle-password-section"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {showPasswordSection ? 'إلغاء تغيير كلمة السر' : 'تغيير كلمة السر'}
              </button>
            </div>

            {showPasswordSection && (
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    كلمة المرور الحالية <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-current-password"
                      type={showCurrentPass ? 'text' : 'password'}
                      dir="ltr"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الحالية"
                      className="w-full pl-10 pr-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      كلمة المرور الجديدة <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="input-new-password"
                        type={showNewPass ? 'text' : 'password'}
                        dir="ltr"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="كلمة مرور جديدة (4 خانات فأكثر)"
                        className="w-full pl-10 pr-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      تأكيد كلمة المرور الجديدة <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="input-confirm-password"
                        type={showConfirmPass ? 'text' : 'password'}
                        dir="ltr"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="أعد كتابة كلمة المرور"
                        className="w-full pl-10 pr-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="btn-cancel-account-settings"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              id="btn-save-account-settings"
              disabled={saving || loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isAdmin ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>
                {saving
                  ? 'جاري المعالجة...'
                  : isAdmin
                  ? 'حفظ وتطبيق التعديلات'
                  : 'حفظ وإرسال للموافقة'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
