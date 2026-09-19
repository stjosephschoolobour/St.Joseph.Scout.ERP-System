import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  HeartPulse,
  Phone,
  Award,
  CheckCircle,
  AlertCircle,
  Trash2,
  Camera,
  Plus,
  Tent,
  Upload,
  Info,
  Mail,
} from 'lucide-react';
import { Member, MemberFormData, SchoolStage } from '../types';
import { Tribe } from '../../tribes/types';
import { membersService } from '../services/membersService';
import { tribesService } from '../../tribes/services/tribesService';
import { validateMemberForm, calculateAge } from '../../../utils/validators';
import { getPhotoUrl } from '../../../utils/photo';

export interface MemberFormModalProps {
  memberToEdit?: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const initialFormData: MemberFormData = {
  student_name: '',
  student_name_en: '',
  guardian_name: '',
  national_id: '',
  birth_date: '',
  school_stage: 'الصف الأول الابتدائي',
  scout_join_year: new Date().getFullYear(),
  medical_condition: '',
  father_phone: '',
  mother_phone: '',
  leader_phone: '',
  mother_email: '',
  leader_email: '',
  father_job: '',
  mother_name: '',
  mother_job: '',
  address: '',
  talents_skills: '',
  member_type: 'عضوة',
  tribe_id: '',
  photo_path: '',
};

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  memberToEdit,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<MemberFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Tribes list & Quick Tribe Modal
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [isQuickTribeOpen, setIsQuickTribeOpen] = useState(false);
  const [quickTribeName, setQuickTribeName] = useState('');
  const [quickTribeCode, setQuickTribeCode] = useState('');
  const [quickTribeError, setQuickTribeError] = useState<string | null>(null);
  const [quickTribeSubmitting, setQuickTribeSubmitting] = useState(false);

  // Photo handling
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!memberToEdit;

  const loadTribes = async () => {
    try {
      const data = await tribesService.getTribes();
      setTribes(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTribes();
    }
  }, [isOpen]);

  useEffect(() => {
    if (memberToEdit) {
      setFormData({
        student_name: memberToEdit.student_name,
        student_name_en: memberToEdit.student_name_en || '',
        guardian_name: memberToEdit.guardian_name,
        national_id: memberToEdit.national_id,
        birth_date: memberToEdit.birth_date,
        school_stage: memberToEdit.school_stage,
        scout_join_year: memberToEdit.scout_join_year,
        medical_condition: memberToEdit.medical_condition || '',
        father_phone: memberToEdit.father_phone || '',
        mother_phone: memberToEdit.mother_phone || '',
        leader_phone: memberToEdit.leader_phone || (memberToEdit.member_type === 'قائد' ? (memberToEdit.father_phone || '') : ''),
        mother_email: memberToEdit.mother_email || '',
        leader_email: memberToEdit.leader_email || '',
        father_job: memberToEdit.father_job || '',
        mother_name: memberToEdit.mother_name || '',
        mother_job: memberToEdit.mother_job || '',
        address: memberToEdit.address || '',
        talents_skills: memberToEdit.talents_skills || '',
        member_type: memberToEdit.member_type,
        tribe_id: memberToEdit.tribe_id ? String(memberToEdit.tribe_id) : '',
        photo_path: memberToEdit.photo_path || '',
      });
      setPhotoPreview(memberToEdit.photo_path ? getPhotoUrl(memberToEdit.photo_path) : null);
      setPhotoFile(null);
    } else {
      setFormData({
        ...initialFormData,
        scout_join_year: new Date().getFullYear(),
      });
      setPhotoPreview(null);
      setPhotoFile(null);
    }
    setErrors({});
    setServerError(null);
  }, [memberToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof MemberFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الصورة يجب ألا يتعدى 5 ميجابايت');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormData((prev) => ({ ...prev, photo_path: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    setFormData(initialFormData);
    setPhotoFile(null);
    setPhotoPreview(null);
    setErrors({});
    setServerError(null);
  };

  // Quick Create Tribe without resetting member form
  const handleQuickCreateTribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTribeName.trim()) {
      setQuickTribeError('اسم العشيرة إجباري');
      return;
    }

    try {
      setQuickTribeSubmitting(true);
      setQuickTribeError(null);
      const res = await tribesService.createTribe({
        name: quickTribeName.trim(),
        code: quickTribeCode.trim() || `TR-${String(tribes.length + 1).padStart(3, '0')}`,
      });

      // Reload tribes and auto-select this new tribe
      const updatedTribes = await tribesService.getTribes();
      setTribes(updatedTribes);
      setFormData((prev) => ({ ...prev, tribe_id: String(res.id) }));
      setIsQuickTribeOpen(false);
      setQuickTribeName('');
      setQuickTribeCode('');
    } catch (err: any) {
      setQuickTribeError(err.message || 'فشل إنشاء العشيرة');
    } finally {
      setQuickTribeSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = validateMemberForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);

    try {
      let finalPhotoPath = formData.photo_path;

      // If a new photo file was picked, upload it first
      if (photoFile) {
        try {
          const uploadRes = await membersService.uploadPhoto(photoFile, memberToEdit?.member_code);
          if (uploadRes && uploadRes.photo_path) {
            finalPhotoPath = uploadRes.photo_path;
          } else {
            throw new Error('لم يتم حفظ مسار الصورة بنجاح');
          }
        } catch (uploadErr: any) {
          console.error('Photo upload issue:', uploadErr);
          setServerError(uploadErr.message || 'فشل رفع الصورة الشخصية. يرجى التأكد من الصورة والمحاولة مرة أخرى');
          setLoading(false);
          return;
        }
      }

      const payload: MemberFormData = {
        ...formData,
        photo_path: finalPhotoPath,
      };

      if (isEditing && memberToEdit) {
        const res = await membersService.updateMember(memberToEdit.id, payload);
        onSuccess(res.message || 'تم تحديث بيانات العضو بنجاح');
      } else {
        const res = await membersService.addMember(payload);
        onSuccess(`تمت إضافة العضو بنجاح بكود: ${res.member_code}`);
      }
      onClose();
    } catch (err: any) {
      setServerError(err.message || 'فشلت عملية الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const currentAge = formData.birth_date ? calculateAge(formData.birth_date) : null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-scale-in">
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center border border-emerald-400/30 text-white">
                {isEditing ? <Award className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {isEditing ? 'تعديل بيانات العضو' : 'إضافة عضو جديد'}
                </h2>
                <p className="text-xs text-slate-400">مدرسة القديس يوسف بالعبور - الكشافة</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-xl transition text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Member Code Status Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">كود العضوية (Member Code):</span>
              {isEditing && memberToEdit?.member_code ? (
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300">
                  {memberToEdit.member_code}
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  يتم إنشاؤه تلقائياً وبشكل دائم فريد (مثل: sc000150)
                </span>
              )}
            </div>
          </div>

          {/* Server Error Message */}
          {serverError && (
            <div className="mx-6 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 text-xs">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
            {/* Top Row: Photo Upload + Basic Info */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
              {/* Photo Box */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative group">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="معاينة الصورة"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                      <Camera className="w-6 h-6 mb-1 text-slate-300" />
                      <span className="text-[10px]">صورة شخصية</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3 text-emerald-600" />
                    <span>{photoPreview ? 'تغيير' : 'رفع صورة'}</span>
                  </button>

                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-300 rounded-lg transition cursor-pointer"
                      title="حذف الصورة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Photo Guidelines / Info */}
              <div className="space-y-1 text-slate-600 flex-1">
                <p className="font-bold text-slate-800 text-xs">الصورة الشخصية للعضو (Photo):</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  يمكنك رفع صورة شخصية واضحة للطالبة أو القائد (PNG / JPG حتى 5MB). تظهر الصورة في
                  بطاقة العضوية والتقارير.
                </p>
              </div>
            </div>

            {/* Core Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Student Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم الطالبة / العضو (بالعربية) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_student_name"
                  type="text"
                  value={formData.student_name}
                  onChange={(e) => handleChange('student_name', e.target.value)}
                  placeholder="أدخل اسم الطالبة رباعي"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                    errors.student_name ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                  }`}
                />
                {errors.student_name && (
                  <p className="text-rose-500 text-[11px] mt-1">{errors.student_name}</p>
                )}
              </div>

              {/* Student Name in English */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم الطالبة باللغة الإنجليزية
                </label>
                <input
                  id="input_student_name_en"
                  type="text"
                  dir="ltr"
                  value={formData.student_name_en || ''}
                  onChange={(e) => handleChange('student_name_en', e.target.value)}
                  placeholder="e.g. Maria George Hanna"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-left"
                />
              </div>

              {/* Guardian Name (Optional, only for regular members) */}
              {formData.member_type === 'عضوة' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>اسم ولي الأمر (اختياري)</span>
                    <span className="text-[11px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">غير إجباري</span>
                  </label>
                  <input
                    id="input_guardian_name"
                    type="text"
                    value={formData.guardian_name || ''}
                    onChange={(e) => handleChange('guardian_name', e.target.value)}
                    placeholder="أدخل اسم ولي الأمر (اختياري)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                  <p className="text-slate-400 text-[11px] mt-1">حقل اختياري ولا يمنع حفظ البيانات في حال تركه فارغاً</p>
                </div>
              )}

              {/* Father's Job */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  وظيفة الأب (مهنة الأب)
                </label>
                <input
                  id="input_father_job"
                  type="text"
                  value={formData.father_job || ''}
                  onChange={(e) => handleChange('father_job', e.target.value)}
                  placeholder="مثل: مهندس، طبيب، مدرس..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
              </div>

              {/* Mother's Job */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  وظيفة الأم (مهنة الأم)
                </label>
                <input
                  id="input_mother_job"
                  type="text"
                  value={formData.mother_job || ''}
                  onChange={(e) => handleChange('mother_job', e.target.value)}
                  placeholder="مثل: ربة منزل، مهندسة، صيدلانية..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
              </div>

              {/* National ID (14 digits) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  الرقم القومي (14 رقم) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_national_id"
                  type="text"
                  maxLength={14}
                  value={formData.national_id}
                  onChange={(e) => handleChange('national_id', e.target.value.replace(/\D/g, ''))}
                  placeholder="14 رقماً قومياً"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                    errors.national_id ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                  }`}
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>{formData.national_id.length}/14 رقماً</span>
                  {errors.national_id && (
                    <span className="text-rose-500 font-semibold">{errors.national_id}</span>
                  )}
                </div>
              </div>

              {/* Birth Date & Auto Age */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  تاريخ الميلاد <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="input_birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => handleChange('birth_date', e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                      errors.birth_date ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                    }`}
                  />
                  {currentAge !== null && !isNaN(currentAge) && (
                    <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-emerald-800 whitespace-nowrap flex items-center">
                      العمر: {currentAge} سنة
                    </div>
                  )}
                </div>
                {errors.birth_date && (
                  <p className="text-rose-500 text-[11px] mt-1">{errors.birth_date}</p>
                )}
              </div>

              {/* School Grade */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  الصف الدراسي <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select_school_stage"
                  value={formData.school_stage}
                  onChange={(e) => handleChange('school_stage', e.target.value as SchoolStage)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                >
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
              </div>

              {/* Scout Join Year */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  سنة الالتحاق بالكشافة <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_scout_join_year"
                  type="number"
                  min="1980"
                  max={new Date().getFullYear() + 1}
                  value={formData.scout_join_year}
                  onChange={(e) => handleChange('scout_join_year', e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                    errors.scout_join_year ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                  }`}
                />
                {errors.scout_join_year && (
                  <p className="text-rose-500 text-[11px] mt-1">{errors.scout_join_year}</p>
                )}
              </div>

              {/* Detailed Home Address */}
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  عنوان المنزل بالتفصيل
                </label>
                <input
                  id="input_address"
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="مثال: مدينة العبور، الحي السابع، شارع..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                />
              </div>

              {/* Talent and Skill */}
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  الموهبة والمهارة
                </label>
                <input
                  id="input_talents_skills"
                  type="text"
                  value={formData.talents_skills || ''}
                  onChange={(e) => handleChange('talents_skills', e.target.value)}
                  placeholder="مثل: رسم، عزف موسيقى، تمثيل مسرحي، سباحة، مهارات عقد كشفية..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                />
              </div>

              {/* Member Type (عضوة / قائد) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  الصفة بالكشافة <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('member_type', 'عضوة')}
                    className={`py-2 px-3 rounded-xl border font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      formData.member_type === 'عضوة'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    عضوة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('member_type', 'قائد')}
                    className={`py-2 px-3 rounded-xl border font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      formData.member_type === 'قائد'
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    قائد
                  </button>
                </div>
              </div>

              {/* Tribe Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 flex items-center gap-1">
                    <Tent className="w-3.5 h-3.5 text-emerald-600" />
                    العشيرة (Tribe)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickTribeName('');
                      setQuickTribeCode(`TR-${String(tribes.length + 1).padStart(3, '0')}`);
                      setQuickTribeError(null);
                      setIsQuickTribeOpen(true);
                    }}
                    className="text-emerald-700 hover:text-emerald-800 font-bold text-[11px] flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ إضافة عشيرة جديدة</span>
                  </button>
                </div>

                <select
                  id="select_member_tribe"
                  value={formData.tribe_id || ''}
                  onChange={(e) => handleChange('tribe_id', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                >
                  <option value="">-- بدون عشيرة (غير محدد) --</option>
                  {tribes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Medical Condition */}
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  الحالة المرضية (إن وجدت - اختياري)
                </label>
                <input
                  id="input_medical_condition"
                  type="text"
                  value={formData.medical_condition}
                  onChange={(e) => handleChange('medical_condition', e.target.value)}
                  placeholder="مثل: حساسية، ربو، سكر، أنيميا..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
              </div>

              {/* Contact Information: Dynamic based on Member Type */}
              {formData.member_type === 'قائد' ? (
                <div className="md:col-span-2 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-amber-200/70 dark:border-amber-800/70">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                        بيانات التواصل الخاصة بالقائد
                      </span>
                    </div>
                    {isEditing && memberToEdit?.member_type === 'عضوة' && (
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                        ترقية العضوة إلى قائد
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Leader Phone */}
                    <div>
                      <label className="block font-bold text-xs text-amber-950 dark:text-amber-200 mb-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          رقم تليفون القائد <span className="text-rose-500">*</span>
                        </span>
                      </label>
                      <input
                        id="input_leader_phone"
                        type="tel"
                        dir="ltr"
                        value={formData.leader_phone || ''}
                        onChange={(e) => handleChange('leader_phone', e.target.value)}
                        placeholder="01012345678"
                        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition ${
                          errors.leader_phone ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-amber-300 dark:border-amber-700'
                        }`}
                      />
                      {errors.leader_phone ? (
                        <p className="text-rose-500 text-[11px] mt-1 font-semibold">{errors.leader_phone}</p>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                          رقم تليفون القائد للتواصل الكشفي والإداري وإرسال الدعوات
                        </p>
                      )}
                    </div>

                    {/* Leader Personal Email */}
                    <div>
                      <label className="block font-bold text-xs text-amber-950 dark:text-amber-200 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>البريد الإلكتروني الخاص بالقائد</span>
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                          اختياري
                        </span>
                      </label>
                      <input
                        id="input_leader_email"
                        type="email"
                        dir="ltr"
                        value={formData.leader_email || ''}
                        onChange={(e) => handleChange('leader_email', e.target.value)}
                        placeholder="leader@example.com"
                        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-mono text-sm text-left focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition ${
                          errors.leader_email ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-amber-300 dark:border-amber-700'
                        }`}
                      />
                      {errors.leader_email ? (
                        <p className="text-rose-500 text-[11px] mt-1 font-semibold">{errors.leader_email}</p>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                          البريد الإلكتروني الشخصي للقائد للمراسلات والإشعارات
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Father Phone */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      رقم تليفون الأب (اختياري)
                    </label>
                    <input
                      id="input_father_phone"
                      type="tel"
                      dir="ltr"
                      value={formData.father_phone}
                      onChange={(e) => handleChange('father_phone', e.target.value)}
                      placeholder="01012345678"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                        errors.father_phone ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.father_phone && (
                      <p className="text-rose-500 text-[11px] mt-1">{errors.father_phone}</p>
                    )}
                  </div>

                  {/* Mother Phone */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      رقم تليفون الأم (اختياري)
                    </label>
                    <input
                      id="input_mother_phone"
                      type="tel"
                      dir="ltr"
                      value={formData.mother_phone}
                      onChange={(e) => handleChange('mother_phone', e.target.value)}
                      placeholder="01112345678"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                        errors.mother_phone ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.mother_phone && (
                      <p className="text-rose-500 text-[11px] mt-1">{errors.mother_phone}</p>
                    )}
                  </div>

                  {/* Mother Email */}
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>البريد الإلكتروني الخاص بالأم</span>
                      </span>
                      <span className="text-[11px] font-normal text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                        اختياري
                      </span>
                    </label>
                    <input
                      id="input_mother_email"
                      type="email"
                      dir="ltr"
                      value={formData.mother_email || ''}
                      onChange={(e) => handleChange('mother_email', e.target.value)}
                      placeholder="mother@example.com"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-sm text-left focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition ${
                        errors.mother_email ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.mother_email ? (
                      <p className="text-rose-500 text-[11px] mt-1 font-semibold">{errors.mother_email}</p>
                    ) : (
                      <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-1">
                        البريد الإلكتروني لوالدة الطالبة لإرسال الإشعارات والتقارير الرسمية
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons: حفظ, مسح, إلغاء */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  id="btn_submit_member"
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  {loading ? 'جاري الحفظ...' : 'حفظ'}
                </button>

                <button
                  id="btn_clear_member_form"
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer border border-slate-200"
                >
                  <Trash2 className="w-4 h-4" />
                  مسح
                </button>
              </div>

              <button
                id="btn_cancel_member_form"
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer border border-slate-200"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Mini Quick Tribe Modal (Does not clear member form) */}
      {isQuickTribeOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Tent className="w-4 h-4 text-emerald-600" />
                إضافة عشيرة جديدة سريعة
              </h4>
              <button
                type="button"
                onClick={() => setIsQuickTribeOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickTribeError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-lg font-bold">
                {quickTribeError}
              </div>
            )}

            <form onSubmit={handleQuickCreateTribe} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم العشيرة *</label>
                <input
                  type="text"
                  value={quickTribeName}
                  onChange={(e) => setQuickTribeName(e.target.value)}
                  placeholder="مثال: عشيرة الصقور"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">كود العشيرة</label>
                <input
                  type="text"
                  value={quickTribeCode}
                  onChange={(e) => setQuickTribeCode(e.target.value)}
                  placeholder="TR-002"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickTribeOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={quickTribeSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition"
                >
                  {quickTribeSubmitting ? 'جاري الإنشاء...' : 'حفظ واختيار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
