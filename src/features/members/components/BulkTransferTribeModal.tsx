import React, { useState } from 'react';
import {
  X,
  Tent,
  AlertCircle,
  Users,
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react';
import { Member } from '../types';
import { Tribe } from '../../tribes/types';
import { membersService } from '../services/membersService';

interface BulkTransferTribeModalProps {
  isOpen: boolean;
  selectedMembers: Member[];
  tribes: Tribe[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const BulkTransferTribeModal: React.FC<BulkTransferTribeModalProps> = ({
  isOpen,
  selectedMembers,
  tribes,
  onClose,
  onSuccess,
}) => {
  const [selectedTribeId, setSelectedTribeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.length === 0) {
      setError('لا توجد أعضاء محددين للنقل');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const targetId = selectedTribeId === '' || selectedTribeId === 'NONE'
        ? null
        : parseInt(selectedTribeId, 10);

      const memberIds = selectedMembers.map((m) => m.id);
      const res = await membersService.bulkTransferTribe(memberIds, targetId);

      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'فشلت عملية النقل الجماعي للعشيرة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetTribe = tribes.find((t) => String(t.id) === selectedTribeId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 text-right animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base">نقل جماعي للعشائر الكشفية</h3>
              <p className="text-xs text-emerald-100 font-medium">
                تنسيب مجموعة من الأعضاء إلى عشيرة محددة أو إخلائها
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Selection summary */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {selectedMembers.length}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  عدد الأعضاء المحددين للنقل
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedMembers.slice(0, 3).map((m) => m.student_name).join('، ')}
                  {selectedMembers.length > 3 ? ` و ${selectedMembers.length - 3} آخرين` : ''}
                </span>
              </div>
            </div>
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>

          {/* Tribe selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              اختر العشيرة المستهدفة: <span className="text-rose-500">*</span>
            </label>
            <select
              id="select_bulk_transfer_tribe"
              value={selectedTribeId}
              onChange={(e) => setSelectedTribeId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="">-- اختر العشيرة --</option>
              {tribes.map((t) => (
                <option key={t.id} value={t.id}>
                  عشيرة: {t.name} (كود: {t.code || t.id})
                </option>
              ))}
              <option value="NONE">بدون عشيرة (إلغاء التنسيب)</option>
            </select>
          </div>

          {targetTribe && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Tent className="w-4 h-4 text-emerald-600" />
                <span>عشيرة {targetTribe.name}</span>
              </div>
              <p className="text-[11px]">
                سيتم تحديث انتماء الأعضاء المحددين فوراً وتحديث قوائم العشيرة وسجلات الحضور المرتبطة.
              </p>
            </div>
          )}

          {/* Buttons */}
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
              disabled={isSubmitting || selectedTribeId === ''}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري نقل الأعضاء...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد النقل الجماعي</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
