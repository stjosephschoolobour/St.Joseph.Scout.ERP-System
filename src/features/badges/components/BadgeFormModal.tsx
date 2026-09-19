import React, { useState, useEffect } from 'react';
import { X, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge, BadgeFormPayload } from '../types';
import { badgeService } from '../services/badgeService';
import { getBadgeLucideIcon, getBadgeColorClasses } from './BadgeIcon';

interface BadgeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  badgeToEdit?: Badge | null;
  onSuccess: () => void;
}

const AVAILABLE_ICONS = [
  { id: 'Award', label: 'وسام' },
  { id: 'Medal', label: 'ميدالية' },
  { id: 'Shield', label: 'درع' },
  { id: 'Heart', label: 'قلب / محبة' },
  { id: 'Cross', label: 'إسعاف طبي' },
  { id: 'Compass', label: 'بوصلة' },
  { id: 'Tent', label: 'خيمة' },
  { id: 'Flame', label: 'شعلة' },
  { id: 'Crown', label: 'تاج قيادة' },
  { id: 'Star', label: 'نجمة' },
  { id: 'Zap', label: 'طاقة / لياقة' },
  { id: 'Trophy', label: 'كأس تميز' },
  { id: 'Sparkles', label: 'بريق / ابتكار' },
];

const AVAILABLE_COLORS = [
  { id: 'amber', label: 'ذهبي / كهرماني' },
  { id: 'emerald', label: 'زمردي / أخضر' },
  { id: 'blue', label: 'أزرق كشفي' },
  { id: 'purple', label: 'بنفسجي ملكي' },
  { id: 'rose', label: 'وردي / عاطفي' },
  { id: 'red', label: 'أحمر قاني' },
  { id: 'orange', label: 'برتقالي مشرق' },
  { id: 'cyan', label: 'سماوي / مائي' },
  { id: 'indigo', label: 'نيلي عميق' },
];

const CATEGORIES = [
  'جدارة وشجاعة',
  'سلوك وأخلاق',
  'مخيمات',
  'مهارات طبية',
  'فنون خلوية',
  'خدمة مجتمعية',
  'قيادة وإشراف',
  'شرف وأمانة',
  'رياضة ولياقة',
  'إبداع وابتكار',
  'عامة',
];

export const BadgeFormModal: React.FC<BadgeFormModalProps> = ({
  isOpen,
  onClose,
  badgeToEdit,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('جدارة وشجاعة');
  const [icon, setIcon] = useState('Award');
  const [color, setColor] = useState('amber');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (badgeToEdit) {
        setName(badgeToEdit.name);
        setNameEn(badgeToEdit.name_en || '');
        setCategory(badgeToEdit.category || 'جدارة وشجاعة');
        setIcon(badgeToEdit.icon || 'Award');
        setColor(badgeToEdit.color || 'amber');
        setDescription(badgeToEdit.description || '');
        setRequirements(badgeToEdit.requirements || '');
      } else {
        setName('');
        setNameEn('');
        setCategory('جدارة وشجاعة');
        setIcon('Award');
        setColor('amber');
        setDescription('');
        setRequirements('');
      }
      setError(null);
    }
  }, [isOpen, badgeToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !requirements.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة: اسم الوسام، شرحه، وشروط الحصول عليه');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload: BadgeFormPayload = {
        name: name.trim(),
        name_en: nameEn.trim() || undefined,
        category,
        icon,
        color,
        description: description.trim(),
        requirements: requirements.trim(),
      };

      if (badgeToEdit) {
        await badgeService.updateBadge(badgeToEdit.id, payload);
      } else {
        await badgeService.createBadge(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'فشلت العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const PreviewIcon = getBadgeLucideIcon(icon);
  const previewColors = getBadgeColorClasses(color);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-scale-in text-right">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">
                {badgeToEdit ? 'تعديل بيانات الوسام الكشفي' : 'إضافة وسام كشفي جديد'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                تحديد الشرح الدقيق وشروط الاستحقاق والأيقونة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Live Preview Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${previewColors.bg} ${previewColors.text} ${previewColors.border} shadow-xs`}
            >
              <PreviewIcon className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                  {name || 'اسم الوسام الكشفي'}
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {category}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {description || 'سيظهر هنا شرح الوسام ودوافعه الكشفية'}
              </p>
            </div>
          </div>

          {/* Badge Name & Name EN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                اسم الوسام (عربي) *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: وسام الفارس الكشفي"
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                الاسم بالإنجليزية (اختياري)
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Scout Knight Medal"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none dir-ltr"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              فئة الوسام
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Icon & Color pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                الأيقونة الرمزية
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {AVAILABLE_ICONS.map((ic) => (
                  <option key={ic.id} value={ic.id}>
                    {ic.label} ({ic.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                اللون والنمط
              </label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {AVAILABLE_COLORS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description (شرح الوسام) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              شرح الوسام (ما يعنيه ويحتفي به) *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              required
              placeholder="اكتب شرحاً واضحاً لما يمثله الوسام ودوره في المسيرة الكشفية..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />
          </div>

          {/* Requirements (شروط الحصول عليه) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              شروط الحصول على الوسام (معايير الاستحقاق) *
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              required
              placeholder="اكتب الشروط الواجب توفرها في العضو أو القائد لمنحه الوسام بالتفصيل..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{badgeToEdit ? 'حفظ التعديلات' : 'إضافة الوسام'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
