import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  AlertCircle,
  Calendar,
  FileText,
  Users,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Member } from '../types';
import { Badge } from '../../badges/types';
import { badgeService } from '../../badges/services/badgeService';
import { membersService } from '../services/membersService';
import { BadgeIcon } from '../../badges/components/BadgeIcon';

interface BulkAwardBadgeModalProps {
  isOpen: boolean;
  selectedMembers: Member[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const BulkAwardBadgeModal: React.FC<BulkAwardBadgeModalProps> = ({
  isOpen,
  selectedMembers,
  onClose,
  onSuccess,
}) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>('');
  const [awardedAt, setAwardedAt] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState<string>('اجتياز متطلبات المرحلة والتميز الكشفي');
  const [notes, setNotes] = useState<string>('');
  const [isLoadingBadges, setIsLoadingBadges] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingBadges(true);
      badgeService
        .getBadges()
        .then((res) => {
          setBadges(res);
          if (res.length > 0) setSelectedBadgeId(String(res[0].id));
        })
        .catch(() => setError('فشل تحميل قائمة الأوسمة الكشفية'))
        .finally(() => setIsLoadingBadges(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedBadge = badges.find((b) => String(b.id) === selectedBadgeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBadgeId) {
      setError('يرجى اختيار الوسام المراد منحه');
      return;
    }
    if (selectedMembers.length === 0) {
      setError('لا توجد أعضاء محددين لمنحهم الوسام');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const memberIds = selectedMembers.map((m) => m.id);
      const res = await membersService.bulkAwardBadge(
        memberIds,
        Number(selectedBadgeId),
        awardedAt,
        reason.trim(),
        notes.trim()
      );

      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'فشلت عملية منح الوسام جماعياً');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 text-right animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h3 className="font-black text-base">منح وسام كشفي جماعي</h3>
              <p className="text-xs text-amber-100 font-medium">
                تكريم كوكبة من الأعضاء ومنحهم الشارات والأوسمة دفعة واحدة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition cursor-pointer disabled:opacity-50"
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

          {/* Members count box */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {selectedMembers.length}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  الأعضاء المكرّمون
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedMembers.slice(0, 3).map((m) => m.student_name).join('، ')}
                  {selectedMembers.length > 3 ? ` و ${selectedMembers.length - 3} آخرين` : ''}
                </span>
              </div>
            </div>
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Badge selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              اختر الوسام الكشفي: <span className="text-rose-500">*</span>
            </label>
            {isLoadingBadges ? (
              <div className="p-3 text-center text-xs text-slate-500">جاري تحميل الأوسمة...</div>
            ) : (
              <select
                id="select_bulk_award_badge"
                value={selectedBadgeId}
                onChange={(e) => setSelectedBadgeId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
              >
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.category})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Badge preview card */}
          {selectedBadge && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <BadgeIcon badge={selectedBadge} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {selectedBadge.name}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                    {selectedBadge.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {selectedBadge.description || selectedBadge.requirements}
                </p>
              </div>
            </div>
          )}

          {/* Award Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              تاريخ منح الوسام:
            </label>
            <div className="relative">
              <input
                type="date"
                value={awardedAt}
                onChange={(e) => setAwardedAt(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              سبب ومنح التكريم:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: المشاركة المتميزة في المخيم السنوي"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              ملاحظات إضافية (اختياري):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات رسمية تظهر في سجلات الكشافة..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedBadgeId}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري المنح الجماعي...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>تأكيد منح الوسام</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
