import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Key,
  UserPlus,
  UserCheck,
  UserX,
  Save,
  AlertCircle,
  School,
  Calendar,
  Wifi,
  Smartphone,
  Copy,
  Check,
  Trash2,
  Edit,
  Phone,
  Award,
  RefreshCw,
  Info,
  ExternalLink,
  Crown,
  Link as LinkIcon,
  Clock,
  Image as ImageIcon,
  Upload,
  X,
  Shield,
  Eye,
  Sparkles,
} from 'lucide-react';
import { SystemSettings } from '../types';
import { User as UserType, UserRole } from '../../auth/types';
import { profileService, ProfileRequestsModal } from '../../auth';
import { settingsService } from '../services/settingsService';
import { tribesService } from '../../tribes/services/tribesService';
import { membersService } from '../../members/services/membersService';
import { Tribe } from '../../tribes/types';
import { Member } from '../../members/types';
import { ScoutEmblem } from '../../members/components/ScoutEmblem';
import { getPhotoUrl } from '../../../utils/photo';

interface SettingsViewProps {
  currentUser: UserType;
  settings: SystemSettings | null;
  onSettingsUpdated: () => void;
  onSuccess: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  settings,
  onSettingsUpdated,
  onSuccess,
}) => {
  const [schoolName, setSchoolName] = useState(settings?.school_name || 'مدرسة القديس يوسف بالعبور');
  const [systemName, setSystemName] = useState(settings?.system_name || 'نظام إدارة الكشافة');
  const [currentYear, setCurrentYear] = useState(settings?.current_year || new Date().getFullYear().toString());
  const [scoutGroupName, setScoutGroupName] = useState(settings?.scout_group_name || 'مجموعة مدرسة القديس يوسف الكشفية');
  const [scoutGroupNameEn, setScoutGroupNameEn] = useState(settings?.scout_group_name_en || "ST. JOSEPH'S SCHOOL SCOUT GROUP");
  const [groupSlogan, setGroupSlogan] = useState(settings?.group_slogan || 'كن مستعداً');
  const [scoutLogoUrl, setScoutLogoUrl] = useState(settings?.scout_logo_url || '');
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customLogoUrlInput, setCustomLogoUrlInput] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoFileInputRef = React.useRef<HTMLInputElement>(null);

  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [tribesList, setTribesList] = useState<Tribe[]>([]);
  const [dbLeadersList, setDbLeadersList] = useState<Member[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Network Info State
  const [networkInfo, setNetworkInfo] = useState<{ port: number; localIps: string[]; urls: string[] } | null>(null);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [newFullName, setNewFullName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('LEADER');
  const [newTribeId, setNewTribeId] = useState<string>('');
  const [newPhone, setNewPhone] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  // Password change modal state
  const [changingPassUser, setChangingPassUser] = useState<UserType | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editMemberId, setEditMemberId] = useState<string>('');
  const [editIsCustomName, setEditIsCustomName] = useState(false);
  const [editRole, setEditRole] = useState<UserRole>('LEADER');
  const [editTribeId, setEditTribeId] = useState<string>('');
  const [editPhone, setEditPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete user confirmation state
  const [deletingUser, setDeletingUser] = useState<UserType | null>(null);
  const [deletingProgress, setDeletingProgress] = useState(false);

  // Profile requests state
  const [isProfileRequestsModalOpen, setIsProfileRequestsModalOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Prevent overwriting active form edits when settings prop is refreshed
  const hasInitializedRef = React.useRef(false);

  useEffect(() => {
    if (settings && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setSchoolName(settings.school_name || 'مدرسة القديس يوسف بالعبور');
      setSystemName(settings.system_name || 'نظام إدارة الكشافة');
      setCurrentYear(settings.current_year || new Date().getFullYear().toString());
      setScoutGroupName(settings.scout_group_name || 'مجموعة مدرسة القديس يوسف الكشفية');
      setScoutGroupNameEn(settings.scout_group_name_en || "ST. JOSEPH'S SCHOOL SCOUT GROUP");
      setGroupSlogan(settings.group_slogan || 'كن مستعداً');
      setScoutLogoUrl(settings.scout_logo_url || '');
    }
  }, [settings]);

  const loadData = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const [usersResult, tribesResult, membersResult] = await Promise.allSettled([
        settingsService.getUsers(),
        tribesService.getTribes(),
        membersService.getMembers(),
      ]);

      const errMessages: string[] = [];

      if (usersResult.status === 'fulfilled') {
        setUsersList(usersResult.value);
      } else {
        console.error('Error loading users:', usersResult.reason);
        errMessages.push(usersResult.reason?.message || 'فشل جلب قائمة المستخدمين');
      }

      if (tribesResult.status === 'fulfilled') {
        setTribesList(tribesResult.value);
      } else {
        console.error('Error loading tribes:', tribesResult.reason);
        errMessages.push(tribesResult.reason?.message || 'فشل جلب قائمة العشائر');
      }

      if (membersResult.status === 'fulfilled') {
        const allMembers = membersResult.value || [];
        const leaders = allMembers.filter((m) => m.member_type === 'قائد');
        const others = allMembers.filter((m) => m.member_type !== 'قائد');
        setDbLeadersList([...leaders, ...others]);
      } else {
        console.error('Error loading members:', membersResult.reason);
        errMessages.push(membersResult.reason?.message || 'فشل جلب سجل الأعضاء');
      }

      if (errMessages.length > 0) {
        setError(errMessages.join(' - '));
      }

      // Load pending profile requests count
      profileService.getPendingRequestsCount()
        .then((res) => setPendingRequestsCount(res.count || 0))
        .catch(() => {});
    } catch (err: any) {
      setError(err.message || 'فشل جلب قائمة المستخدمين والعشائر');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadNetworkInfo = async () => {
    setLoadingNetwork(true);
    try {
      const info = await settingsService.getNetworkInfo();
      setNetworkInfo(info);
    } catch {
      // Fallback network info
      setNetworkInfo({
        port: 3000,
        localIps: ['127.0.0.1'],
        urls: ['http://localhost:3000'],
      });
    } finally {
      setLoadingNetwork(false);
    }
  };

  useEffect(() => {
    loadData();
    loadNetworkInfo();
  }, []);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صالح بصيغة PNG أو JPG أو SVG أو WEBP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الصورة كبير، الحد الأقصى المسموح به هو 5 ميجابايت');
      return;
    }

    setError(null);

    // Read file locally as preview only - DO NOT upload or overwrite server logo until "Save" is clicked
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setScoutLogoUrl(dataUrl);
        setPendingLogoFile(file);
        onSuccess('تمت إضافة الشعار بالمعاينة فقط. لن يتم تغيير الشعار القديم حتى تضغط على "حفظ إعدادات وهوية المجموعة".');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomLogoUrl = () => {
    if (!customLogoUrlInput.trim()) {
      setError('يرجى إدخال رابط صالح للصورة');
      return;
    }
    setScoutLogoUrl(customLogoUrlInput.trim());
    setPendingLogoFile(null);
    setShowUrlInput(false);
    setCustomLogoUrlInput('');
    onSuccess('تم تطبيق رابط الشعار بالمعاينة! اضغط على "حفظ إعدادات وهوية المجموعة" لتثبيته.');
  };

  const handleResetToDefaultLogo = () => {
    setScoutLogoUrl('');
    setPendingLogoFile(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
    setShowUrlInput(false);
    setCustomLogoUrlInput('');
    onSuccess('تمت استعادة الشعار الكشفي القياسي بالمعاينة. اضغط على "حفظ إعدادات وهوية المجموعة" للتطبيق.');
  };

  const handleRestoreSavedSettings = () => {
    if (settings) {
      setSchoolName(settings.school_name || 'مدرسة القديس يوسف بالعبور');
      setSystemName(settings.system_name || 'نظام إدارة الكشافة');
      setCurrentYear(settings.current_year || new Date().getFullYear().toString());
      setScoutGroupName(settings.scout_group_name || 'مجموعة مدرسة القديس يوسف الكشفية');
      setScoutGroupNameEn(settings.scout_group_name_en || "ST. JOSEPH'S SCHOOL SCOUT GROUP");
      setGroupSlogan(settings.group_slogan || 'كن مستعداً');
      setScoutLogoUrl(settings.scout_logo_url || '');
      setPendingLogoFile(null);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
      setShowUrlInput(false);
      setCustomLogoUrlInput('');
      onSuccess('تمت استعادة الإعدادات والشعار المحفوظين من الخادم');
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      let finalLogoUrl = scoutLogoUrl;

      // Only perform backend file upload now, when the user explicitly clicks "Save"
      if (pendingLogoFile) {
        setIsUploadingLogo(true);
        try {
          const uploadRes = await membersService.uploadPhoto(pendingLogoFile, 'scout_logo');
          if (uploadRes && uploadRes.photo_path) {
            finalLogoUrl = uploadRes.photo_path;
            setScoutLogoUrl(uploadRes.photo_path);
          }
        } catch (uploadErr: any) {
          console.warn('Backend logo upload fallback to data URL:', uploadErr);
        } finally {
          setIsUploadingLogo(false);
          setPendingLogoFile(null);
        }
      }

      await settingsService.updateSettings({
        school_name: schoolName,
        system_name: systemName,
        current_year: currentYear,
        scout_group_name: scoutGroupName,
        scout_group_name_en: scoutGroupNameEn,
        group_slogan: groupSlogan,
        scout_logo_url: finalLogoUrl,
      });
      hasInitializedRef.current = true;
      onSettingsUpdated();
      onSuccess('تم حفظ إعدادات النظام وتثبيت شعار المجموعة الكشفية بنجاح');
    } catch (err: any) {
      setError(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLeaderSelect = (val: string) => {
    setSelectedMemberId(val);
    if (!val) {
      setNewFullName('');
      setIsCustomName(false);
      return;
    }
    if (val === '__custom__') {
      setIsCustomName(true);
      setNewFullName('');
      return;
    }
    setIsCustomName(false);
    const chosen = dbLeadersList.find((m) => m.id.toString() === val);
    if (chosen) {
      setNewFullName(chosen.student_name);
      // Auto-populate phone
      const phone = chosen.father_phone || chosen.mother_phone;
      if (phone) {
        setNewPhone(phone);
      }
      // Auto-select assigned tribe if member already belongs to a tribe
      if (chosen.tribe_id) {
        setNewTribeId(chosen.tribe_id.toString());
      }
      // Auto-suggest username if empty
      if (!newUsername.trim()) {
        const codeNum = chosen.member_code?.replace(/[^0-9]/g, '') || chosen.id.toString();
        setNewUsername(`leader_${codeNum}`);
      }
    }
  };

  const handleEditLeaderSelect = (val: string) => {
    setEditMemberId(val);
    if (!val) {
      setEditIsCustomName(false);
      return;
    }
    if (val === '__custom__') {
      setEditIsCustomName(true);
      return;
    }
    setEditIsCustomName(false);
    const chosen = dbLeadersList.find((m) => m.id.toString() === val);
    if (chosen) {
      setEditFullName(chosen.student_name);
      if (chosen.father_phone || chosen.mother_phone) {
        setEditPhone(chosen.father_phone || chosen.mother_phone || '');
      }
      if (chosen.tribe_id) {
        setEditTribeId(chosen.tribe_id.toString());
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setAddingUser(true);
    setError(null);
    try {
      const parsedMemberId =
        selectedMemberId && selectedMemberId !== '__custom__' ? parseInt(selectedMemberId, 10) : null;
      await settingsService.addUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        full_name: newFullName.trim() || undefined,
        member_id: parsedMemberId,
        tribe_id: newTribeId ? parseInt(newTribeId, 10) : null,
        phone: newPhone.trim() || undefined,
      });
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setSelectedMemberId('');
      setIsCustomName(false);
      setNewRole('LEADER');
      setNewTribeId('');
      setNewPhone('');
      onSuccess('تم إنشاء حساب القائد وربطه بنجاح بنظام الكشافة');
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل إضافة المستخدم');
    } finally {
      setAddingUser(false);
    }
  };

  const handleToggleUserActive = async (user: UserType) => {
    const nextState = user.is_active !== 1;
    try {
      await settingsService.updateUser(user.id, { is_active: nextState });
      onSuccess(nextState ? `تم تفعيل حساب ${user.username}` : `تم تعطيل حساب ${user.username}`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تغيير حالة المستخدم');
    }
  };

  const handleOpenEditUser = (user: UserType) => {
    setEditingUser(user);
    setEditFullName(user.full_name || '');
    setEditRole(user.role);
    setEditTribeId(user.tribe_id ? user.tribe_id.toString() : '');
    setEditPhone(user.phone || '');
    if (user.member_id) {
      setEditMemberId(user.member_id.toString());
      setEditIsCustomName(false);
    } else {
      setEditMemberId('');
      setEditIsCustomName(true);
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const parsedMemberId =
        editMemberId && editMemberId !== '__custom__' ? parseInt(editMemberId, 10) : null;
      await settingsService.updateUser(editingUser.id, {
        full_name: editFullName.trim(),
        member_id: parsedMemberId,
        role: editRole,
        tribe_id: editTribeId ? parseInt(editTribeId, 10) : null,
        phone: editPhone.trim(),
      });
      onSuccess(`تم تحديث بيانات المستخدم ${editingUser.username} وربطه بنجاح`);
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تحديث بيانات المستخدم');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSavePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPassUser || !newPasswordVal.trim()) return;
    setUpdatingPass(true);
    try {
      await settingsService.updateUser(changingPassUser.id, { new_password: newPasswordVal });
      onSuccess(`تم تغيير كلمة مرور ${changingPassUser.username} بنجاح`);
      setChangingPassUser(null);
      setNewPasswordVal('');
    } catch (err: any) {
      setError(err.message || 'فشل تغيير كلمة المرور');
    } finally {
      setUpdatingPass(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeletingProgress(true);
    try {
      await settingsService.deleteUser(deletingUser.id);
      onSuccess(`تم حذف حساب ${deletingUser.username} بنجاح`);
      setDeletingUser(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل حذف المستخدم');
    } finally {
      setDeletingProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
            <Settings className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">إعدادات النظام وإدارة حسابات القادة</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة حسابات القادة والمستخدمين، ربطهم بالعشائر، والربط بالشبكة المحلية (Wi-Fi) للدخول من الموبايل
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                setError(null);
                loadData();
              }}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium cursor-pointer transition shadow-xs"
            >
              إعادة المحاولة
            </button>
            <button
              onClick={() => setError(null)}
              className="text-xs font-bold text-rose-800 hover:underline cursor-pointer px-2 py-1"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* 1. Local Network Access Guide (LAN & Wi-Fi) */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-indigo-700/50 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
              <Wifi className="w-6 h-6 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                الدخول للنظام عبر الشبكة المحلية (LAN & Wi-Fi)
                <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  متاح لجميع الأجهزة والموبايل
                </span>
              </h3>
              <p className="text-xs text-indigo-200 mt-1 leading-relaxed">
                يمكن لأي قائد أو مستخدم فتح النظام من هاتفه المحمول أو جهازه بكتابة عنوان IP الخاص بهذا الجهاز.
              </p>
            </div>
          </div>

          <button
            onClick={loadNetworkInfo}
            disabled={loadingNetwork}
            className="px-3.5 py-2 bg-indigo-800/60 hover:bg-indigo-700 text-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-600/40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingNetwork ? 'animate-spin' : ''}`} />
            تحديث الروابط
          </button>
        </div>

        {/* IP Addresses & URLs List */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              روابط الدخول المباشرة من متصفح الموبايل أو الأجهزة الأخرى:
            </p>
            {(() => {
              const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
              const allUrls: { url: string; label: string; isPrimary: boolean }[] = [];
              if (currentOrigin && currentOrigin.startsWith('http')) {
                allUrls.push({
                  url: currentOrigin,
                  label: 'الرابط المباشر الفعّال حالياً (المعتمد)',
                  isPrimary: true,
                });
              }
              if (networkInfo?.urls) {
                networkInfo.urls.forEach((u) => {
                  if (!allUrls.some((item) => item.url === u)) {
                    allUrls.push({
                      url: u,
                      label: 'رابط الشبكة المحلية (Wi-Fi / LAN)',
                      isPrimary: false,
                    });
                  }
                });
              }

              if (allUrls.length === 0) {
                return (
                  <div className="p-3 bg-indigo-950/50 rounded-xl text-xs text-indigo-300 font-mono">
                    http://[IP-جهازك]:3000
                  </div>
                );
              }

              return allUrls.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                    item.isPrimary
                      ? 'bg-emerald-950/40 border-emerald-500/50 hover:border-emerald-400'
                      : 'bg-indigo-950/60 border-indigo-800/60 hover:border-indigo-600'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                        item.isPrimary
                          ? 'bg-emerald-700 text-white'
                          : 'bg-indigo-800 text-indigo-200'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span dir="ltr" className="font-mono text-sm font-bold text-emerald-300 select-all truncate">
                          {item.url}
                        </span>
                        {item.isPrimary && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40 shrink-0">
                            فعّال ومجرّب
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium">{item.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopyUrl(item.url)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        item.isPrimary
                          ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          : 'bg-indigo-700/70 hover:bg-indigo-600 text-white'
                      }`}
                    >
                      {copiedUrl === item.url ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span className="text-emerald-300">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الرابط</span>
                        </>
                      )}
                    </button>
                    {item.isPrimary && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-emerald-800/50 hover:bg-emerald-700 text-emerald-200 rounded-lg text-xs transition"
                        title="فتح في نافذة جديدة"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Quick Instructions Step by Step */}
          <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-800/40 space-y-2.5 text-xs text-indigo-200">
            <h4 className="font-black text-white flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-400" />
              خطوات دخول القادة من الموبايل:
            </h4>
            <ol className="space-y-1.5 list-decimal list-inside pr-1 text-slate-300 leading-relaxed">
              <li>
                <strong className="text-white">نفس شبكة الواي فاي:</strong> تأكد أن موبايل القائد متصل بنفس شبكة الراوتر (Wi-Fi) المتصل بها هذا الكمبيوتر.
              </li>
              <li>
                <strong className="text-white">فتح المتصفح:</strong> افتح متصفح الموبايل (Safari أو Chrome) واكتب الرابط الأخضر الموضح بالأعلى.
              </li>
              <li>
                <strong className="text-white">تسجيل الدخول:</strong> يدخل القائد باستخدام اسم المستخدم وكلمة المرور المسجلة له بالأسفل.
              </li>
              <li>
                <strong className="text-white">جدار الحماية (Firewall):</strong> إذا لم يفتح، تأكد من السماح للمنفذ <code className="bg-indigo-900 px-1 py-0.5 rounded text-white font-mono">3000</code> في Windows Firewall.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* 2. User & Leader Management */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              إدارة حسابات القادة والمستخدمين
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إنشاء حسابات للقادة لمتابعة عشيرتهم، تسجيل الحضور، وجدولة الاجتماعات والأنشطة
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              id="btn-settings-review-profile-requests"
              type="button"
              onClick={() => setIsProfileRequestsModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>طلبات تعديل الحسابات</span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[10px] font-black animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <div className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
              إجمالي الحسابات: <strong className="font-mono text-emerald-700">{usersList.length}</strong>
            </div>
          </div>
        </div>

        {/* Highlight Banner if there are pending profile requests */}
        {pendingRequestsCount > 0 && (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  يوجد {pendingRequestsCount} طلب تعديل حساب بانتظار موافقتك
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  قام قادة أو مستخدمون بطلب تحديث بياناتهم الشخصية (الصورة، العنوان، رقم الهاتف، الإيميل أو كلمة المرور).
                </p>
              </div>
            </div>
            <button
              id="btn-banner-review-profile-requests"
              type="button"
              onClick={() => setIsProfileRequestsModalOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <span>مراجعة واعتماد الطلبات الآن</span>
            </button>
          </div>
        )}

        {/* Add User Sub-form */}
        <form onSubmit={handleCreateUser} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-700" />
              إضافة قائد أو مستخدم جديد للنظام
            </h4>
            <span className="text-[11px] text-slate-500">
              * اختر القائد من قاعدة البيانات لربط بياناته وعشيرته تلقائياً
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المستخدم (للدخول) *</label>
              <input
                id="input_new_username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="مثال: leader_sarah"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور *</label>
              <input
                id="input_new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="4 أحرف على الأقل"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Leader Dropdown from Database */}
            <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 text-emerald-800">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  الاسم الكامل للقائد (من قاعدة البيانات)
                </span>
                {selectedMemberId && selectedMemberId !== '__custom__' && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                    تم الربط
                  </span>
                )}
              </label>
              <select
                id="select_new_leader_dropdown"
                value={selectedMemberId}
                onChange={(e) => handleLeaderSelect(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-600 shadow-xs"
              >
                <option value="">-- اضغط لاختيار قائد مسجل في قاعدة البيانات --</option>
                {dbLeadersList.filter((m) => m.member_type === 'قائد').length > 0 && (
                  <optgroup label="⭐ القادة المسجلون في الكشافة">
                    {dbLeadersList
                      .filter((m) => m.member_type === 'قائد')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          👤 {m.student_name} ({m.member_code} {m.tribe_name ? `• عشيرة: ${m.tribe_name}` : ''})
                        </option>
                      ))}
                  </optgroup>
                )}
                {dbLeadersList.filter((m) => m.member_type !== 'قائد').length > 0 && (
                  <optgroup label="📋 باقي أعضاء الكشافة">
                    {dbLeadersList
                      .filter((m) => m.member_type !== 'قائد')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.student_name} ({m.member_code} • {m.member_type || 'عضو'})
                        </option>
                      ))}
                  </optgroup>
                )}
                <option value="__custom__">✏️ إدخال اسم يدوي مخصص (غير مسجل في الأعضاء)...</option>
              </select>

              {/* Custom manual name input if chosen */}
              {isCustomName && (
                <div className="mt-1.5">
                  <input
                    id="input_new_fullname_custom"
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="اكتب الاسم الكامل للقائد يدوياً..."
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Visual Confirmation of Linked Leader */}
              {selectedMemberId && selectedMemberId !== '__custom__' && (
                (() => {
                  const chosen = dbLeadersList.find((m) => m.id.toString() === selectedMemberId);
                  if (!chosen) return null;
                  return (
                    <div className="mt-1.5 p-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 flex flex-wrap items-center justify-between gap-1">
                      <div className="flex items-center gap-1 font-bold">
                        <LinkIcon className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>كود:</span>
                        <span className="font-mono bg-white px-1 py-0.2 rounded border border-emerald-200 text-emerald-800">
                          {chosen.member_code}
                        </span>
                        <span>- {chosen.student_name}</span>
                      </div>
                      {chosen.tribe_name && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                          عشيرة: {chosen.tribe_name}
                        </span>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الصلاحية (Role) *</label>
              <select
                id="select_new_role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-emerald-600"
              >
                <option value="LEADER">قائد عشيرة (LEADER)</option>
                <option value="DATA_ENTRY">مدخل بيانات (DATA_ENTRY)</option>
                <option value="ADMIN">مدير النظام (ADMIN)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">العشيرة المسندة للقائد</label>
              <select
                id="select_new_tribe"
                value={newTribeId}
                onChange={(e) => setNewTribeId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none cursor-pointer focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">-- بدون عشيرة محددة --</option>
                {tribesList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم الهاتف</label>
              <div className="flex gap-2">
                <input
                  id="input_new_phone"
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  id="btn_add_user_submit"
                  type="submit"
                  disabled={addingUser}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs whitespace-nowrap transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {addingUser ? '...' : 'إضافة'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Users Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">اسم المستخدم / القائد</th>
                <th className="py-3 px-4">الصلاحية (Role)</th>
                <th className="py-3 px-4">العشيرة التابعة</th>
                <th className="py-3 px-4">الهاتف</th>
                <th className="py-3 px-4">حالة الحساب</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loadingUsers ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    جاري تحميل المستخدمين...
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا يوجد مستخدمين مسجلين
                  </td>
                </tr>
              ) : (
                usersList.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                          {(u.full_name || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{u.full_name || u.username}</span>
                            {u.username === currentUser.username && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                                (أنت)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {u.full_name && (
                              <span className="text-[11px] font-mono text-slate-400">@{u.username}</span>
                            )}
                            {u.member_code && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                                <LinkIcon className="w-2.5 h-2.5 text-emerald-600" />
                                كود: {u.member_code}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold border ${
                          u.role === 'ADMIN'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : u.role === 'LEADER'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-blue-50 text-blue-900 border-blue-200'
                        }`}
                      >
                        {u.role === 'ADMIN'
                          ? 'مدير النظام (ADMIN)'
                          : u.role === 'LEADER'
                          ? 'قائد عشيرة (LEADER)'
                          : 'مدخل بيانات (DATA_ENTRY)'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.tribe_name ? (
                        <div className="flex items-center gap-1 font-bold text-emerald-700">
                          <Award className="w-3.5 h-3.5" />
                          <span>{u.tribe_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {u.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {u.phone}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          u.is_active === 1
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {u.is_active === 1 ? 'مفعل نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          title="تعديل بيانات الحساب والعشيرة"
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setChangingPassUser(u);
                            setNewPasswordVal('');
                          }}
                          title="تغيير كلمة المرور"
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        {u.username !== 'admin' && (
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            title={u.is_active === 1 ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              u.is_active === 1
                                ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {u.is_active === 1 ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}

                        {u.username !== 'admin' && (
                          <button
                            onClick={() => setDeletingUser(u)}
                            title="حذف الحساب"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. General System Info Form & Scout Group Branding */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <School className="w-5 h-5 text-emerald-700" />
              البيانات الأساسية وهوية المجموعة الكشفية
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تخصيص هوية وشعار المجموعة الكشفية لتطبيقها آلياً على الكارنيهات، الإيصالات، وكافة المطبوعات الرسمية
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              نظام متعدد المجموعات الكشفية
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveSystemSettings} className="space-y-6">
          {/* Scout Emblem / Logo Configuration Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              
              {/* Logo Preview & Info */}
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-2 border-emerald-600/30 p-2 shadow-sm flex items-center justify-center overflow-hidden">
                    {scoutLogoUrl ? (
                      <img
                        src={getPhotoUrl(scoutLogoUrl) || scoutLogoUrl}
                        alt="شعار المجموعة الكشفية"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ScoutEmblem size={72} groupNameEn={scoutGroupNameEn} />
                    )}
                  </div>
                  {scoutLogoUrl && (
                    <button
                      type="button"
                      onClick={handleResetToDefaultLogo}
                      title="حذف الشعار واستعادة الشعار الافتراضي"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-slate-900">
                      شعار المجموعة الكشفية (Scout Group Emblem)
                    </h4>
                    {pendingLogoFile ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                        معاينة غير محفوظة (اضغط حفظ بالأسفل للتثبيت)
                      </span>
                    ) : scoutLogoUrl ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        شعار مخصص للمجموعة
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        شعار الكشافة الافتراضي
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
                    يظهر هذا الشعار مباشرة على وجه الكارنيه، كعلامة مائية أمنية في الخلف، وفي رأس إيصالات المتجر وكافة الصادرات والمطبوعات.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    الصيغ المدعومة: PNG (يفضل خلفية شفافة)، SVG، JPG، WEBP (بحد أقصى 5 ميجابايت).
                  </p>
                </div>
              </div>

              {/* Upload & Action Buttons */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                  id="scout_logo_file_input"
                />
                
                <button
                  type="button"
                  onClick={() => logoFileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {isUploadingLogo ? 'جاري التحميل...' : 'رفع شعار جديد'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <LinkIcon className="w-4 h-4 text-slate-500" />
                  {showUrlInput ? 'إخفاء الرابط' : 'إدخال رابط'}
                </button>

                {scoutLogoUrl && (
                  <button
                    type="button"
                    onClick={handleResetToDefaultLogo}
                    className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    استعادة الافتراضي
                  </button>
                )}
              </div>
            </div>

            {/* Custom URL Input Accordion */}
            {showUrlInput && (
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="url"
                  dir="ltr"
                  value={customLogoUrlInput}
                  onChange={(e) => setCustomLogoUrlInput(e.target.value)}
                  placeholder="https://example.com/scout-logo.png"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-600 outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomLogoUrl}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  تطبيق الرابط
                </button>
              </div>
            )}
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المجموعة الكشفية (باللغة العربية)
                <span className="text-emerald-700 mr-1">*</span>
              </label>
              <input
                id="input_settings_scout_group_name"
                type="text"
                value={scoutGroupName}
                onChange={(e) => setScoutGroupName(e.target.value)}
                placeholder="مثال: مجموعة مدرسة القديس يوسف الكشفية"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none font-bold text-slate-900"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                يظهر في رأس الكارنيه، الإيصالات، والشهادات الرسمية
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المجموعة (باللغة الإنجليزية)
                <span className="text-emerald-700 mr-1">*</span>
              </label>
              <input
                id="input_settings_scout_group_name_en"
                type="text"
                dir="ltr"
                value={scoutGroupNameEn}
                onChange={(e) => setScoutGroupNameEn(e.target.value)}
                placeholder="مثال: ST. JOSEPH'S SCHOOL SCOUT GROUP"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none font-bold text-slate-900"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                يظهر في ترويسة الكارنيه باللغة الإنجليزية
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المؤسسة / المدرسة الراعية
              </label>
              <input
                id="input_settings_school_name"
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="مثال: مدرسة القديس يوسف بالعبور"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none font-medium text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                اسم الهيئة أو المدرسة التابع لها الفوج
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                شعار المجموعة اللفظي (Slogan)
              </label>
              <input
                id="input_settings_group_slogan"
                type="text"
                value={groupSlogan}
                onChange={(e) => setGroupSlogan(e.target.value)}
                placeholder="مثال: كن مستعداً"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none font-medium text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                الشعار الكشفي المعتمد للفوج أو المجموعة
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم النظام</label>
              <input
                id="input_settings_system_name"
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none font-medium text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                الاسم الظاهر في شريط العنوان وتطبيق الويب
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">السنة الكشفية الحالية</label>
              <input
                id="input_settings_current_year"
                type="text"
                value={currentYear}
                onChange={(e) => setCurrentYear(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none font-medium text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                السنة المعمول بها في تسجيل الرتب والعضويات
              </span>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white border border-emerald-300 shadow-xs flex items-center justify-center p-1 overflow-hidden shrink-0">
                {scoutLogoUrl ? (
                  <img src={getPhotoUrl(scoutLogoUrl) || scoutLogoUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <ScoutEmblem size={40} groupNameEn={scoutGroupNameEn} />
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  معاينة فورية لرأس الكارنيه والمطبوعات:
                </span>
                <h5 className="text-sm font-black text-slate-900 leading-tight">
                  {scoutGroupName || 'اسم المجموعة الكشفية'}
                </h5>
                <p className="text-[10px] font-mono text-slate-600 font-bold tracking-wide uppercase">
                  {scoutGroupNameEn || "SCOUT GROUP"}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={handleRestoreSavedSettings}
                disabled={savingSettings}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="إلغاء التعديلات غير المحفوظة واستعادة البيانات من قاعدة البيانات"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                استعادة المحفوظ
              </button>

              <button
                id="btn_save_settings"
                type="submit"
                disabled={savingSettings}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? 'جاري حفظ التعديلات...' : 'حفظ إعدادات وهوية المجموعة'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                تعديل بيانات المستخدم: {editingUser.username}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-800">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    الاسم الكامل للقائد (من قاعدة البيانات)
                  </span>
                  {editMemberId && editMemberId !== '__custom__' && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold border border-emerald-300">
                      ✓ مرتبط بقاعدة البيانات
                    </span>
                  )}
                </label>
                <select
                  value={editMemberId}
                  onChange={(e) => handleEditLeaderSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none cursor-pointer focus:ring-2 focus:ring-blue-600 focus:bg-white"
                >
                  <option value="">-- اختر قائد من قاعدة البيانات للربط --</option>
                  {dbLeadersList.filter((m) => m.member_type === 'قائد').length > 0 && (
                    <optgroup label="⭐ القادة المسجلون">
                      {dbLeadersList
                        .filter((m) => m.member_type === 'قائد')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            👤 {m.student_name} ({m.member_code} {m.tribe_name ? `• ${m.tribe_name}` : ''})
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {dbLeadersList.filter((m) => m.member_type !== 'قائد').length > 0 && (
                    <optgroup label="📋 باقي أعضاء الكشافة">
                      {dbLeadersList
                        .filter((m) => m.member_type !== 'قائد')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.student_name} ({m.member_code})
                          </option>
                        ))}
                    </optgroup>
                  )}
                  <option value="__custom__">✏️ إدخال اسم يدوي مخصص...</option>
                </select>

                {editIsCustomName && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="الاسم الكامل للقائد"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الصلاحية (Role)</label>
                <select
                  value={editRole}
                  disabled={editingUser.username === 'admin'}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-600 focus:bg-white"
                >
                  <option value="LEADER">قائد عشيرة (LEADER)</option>
                  <option value="DATA_ENTRY">مدخل بيانات (DATA_ENTRY)</option>
                  <option value="ADMIN">مدير النظام (ADMIN)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العشيرة المسندة للقائد</label>
                <select
                  value={editTribeId}
                  onChange={(e) => setEditTribeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none cursor-pointer focus:ring-2 focus:ring-blue-600 focus:bg-white"
                >
                  <option value="">-- بدون عشيرة محددة --</option>
                  {tribesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف / الواتساب</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="py-2.5 px-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {changingPassUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              تغيير كلمة مرور: {changingPassUser.username}
            </h3>
            <p className="text-xs text-slate-500">
              أدخل كلمة المرور الجديدة (سيتم تشفيرها وحفظها بأمان)
            </p>

            <form onSubmit={handleSavePasswordChange} className="space-y-4">
              <input
                type="password"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="كلمة المرور الجديدة"
                required
                autoFocus
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  disabled={updatingPass}
                  className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {updatingPass ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button
                  type="button"
                  onClick={() => setChangingPassUser(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">حذف الحساب نهائياً</h3>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من رغبتك في حذف حساب <strong className="text-slate-800">{deletingUser.username}</strong>؟ لن يتمكن من تسجيل الدخول بعد الآن.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleDeleteUser}
                disabled={deletingProgress}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {deletingProgress ? 'جاري الحذف...' : 'نعم، حذف'}
              </button>
              <button
                onClick={() => setDeletingUser(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Profile Requests Review Modal */}
      <ProfileRequestsModal
        isOpen={isProfileRequestsModalOpen}
        onClose={() => setIsProfileRequestsModalOpen(false)}
        onSuccess={(msg) => {
          onSuccess(msg);
          loadData();
        }}
      />
    </div>
  );
};
