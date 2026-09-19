import React, { useState, useEffect } from 'react';
import { X, Award, CheckCircle2, User, Calendar, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { Badge, AwardBadgePayload } from '../types';
import { badgeService } from '../services/badgeService';
import { getBadgeLucideIcon, getBadgeColorClasses } from './BadgeIcon';

interface AwardBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: number;
  memberName: string;
  memberCode?: string | null;
  memberType?: string;
  onSuccess?: () => void;
}

export const AwardBadgeModal: React.FC<AwardBadgeModalProps> = ({
  isOpen,
  onClose,
  memberId,
  memberName,
  memberCode,
  memberType = 'عضوة',
  onSuccess,
}) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | ''>('');
  const [awardedAt, setAwardedAt] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('استيفاء الشروط الكشفية والتفوق الميداني');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBadges();
      setSelectedBadgeId('');
      setError(null);
      setAwardedAt(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, memberId]);

  const loadBadges = async () => {
    try {
      setIsLoading(true);
      const allBadges = await badgeService.getBadges();
      setBadges(allBadges);
      if (allBadges.length > 0) {
        setSelectedBadgeId(allBadges[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل قائمة الأوسمة');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedBadge = badges.find((b) => b.id === Number(selectedBadgeId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBadgeId) {
      setError('يرجى اختيار الوسام أولاً');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload: AwardBadgePayload = {
        badge_id: Number(selectedBadgeId),
        awarded_at: awardedAt,
        reason: reason.trim(),
        notes: notes.trim(),
      };

      await badgeService.awardBadge(memberId, payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'فشل منح الوسام للعضو');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-scale-in text-right">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Award className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h3 className="font-black text-base">منح وسام كشفي تقديري</h3>
              <p className="text-xs text-amber-100 font-medium">
                تكريم وتقدير جهود الأعضاء والقادة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Member Recipient Info Box */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  المكرّم ({memberType}):
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {memberName}
                </h4>
              </div>
            </div>
            {memberCode && (
              <span className="font-mono text-xs font-bold px-2.5 py-1 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-lg">
                {memberCode}
              </span>
            )}
          </div>

          {/* Select Badge */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              اختر الوسام الكشفي المراد منحه:
            </label>
            {isLoading ? (
              <p className="text-xs text-slate-400">جاري تحميل الأوسمة...</p>
            ) : (
              <select
                id="select_badge_award"
                value={selectedBadgeId}
                onChange={(e) => setSelectedBadgeId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.category})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Badge Details Preview Box */}
          {selectedBadge && (
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const IconComp = getBadgeLucideIcon(selectedBadge.icon);
                  const colors = getBadgeColorClasses(selectedBadge.color);
                  return (
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      <IconComp className="w-4.5 h-4.5" />
                    </div>
                  );
                })()}
                <div>
                  <h5 className="text-xs font-black text-amber-900 dark:text-amber-200">
                    {selectedBadge.name}
                  </h5>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                    فئة: {selectedBadge.category}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                <p>
                  <strong className="text-slate-900 dark:text-slate-100">شرح الوسام: </strong>
                  {selectedBadge.description}
                </p>
                <p className="text-amber-800 dark:text-amber-400 font-medium">
                  <strong className="text-amber-900 dark:text-amber-300">شروط الاستحقاق: </strong>
                  {selectedBadge.requirements}
                </p>
              </div>
            </div>
          )}

          {/* Date of Award */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>تاريخ المنح:</span>
            </label>
            <input
              type="date"
              value={awardedAt}
              onChange={(e) => setAwardedAt(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Reason / Occasion */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>سبب التكريم / المناسبة:</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: التميز في مخيم الشتاء، اجتياز اختبارات الإسعافات..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>ملاحظات إضافية (اختياري):</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="أي ملاحظات أو تفاصيل حول منح الوسام..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
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
              disabled={isSubmitting || !selectedBadgeId}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
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
