import React, { useState, useEffect } from 'react';
import { X, Printer, Shield, CheckCircle2 } from 'lucide-react';
import { AnnualPaymentMember } from '../types';
import { settingsService } from '../../settings/services/settingsService';
import { SystemSettings } from '../../settings/types';
import { ScoutEmblem } from '../../members/components/ScoutEmblem';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  year: number;
  unifiedFee: number;
  member: AnnualPaymentMember | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  year,
  unifiedFee,
  member,
  onClose,
}) => {
  const [currentSettings, setCurrentSettings] = useState<SystemSettings | null>(() => {
    return settingsService.getCachedSettings();
  });

  useEffect(() => {
    const cached = settingsService.getCachedSettings();
    if (cached) {
      setCurrentSettings(cached);
    } else {
      settingsService.getSettings().then(setCurrentSettings).catch(() => {});
    }
    return settingsService.subscribe(setCurrentSettings);
  }, []);

  if (!isOpen || !member) return null;

  const scoutGroupName = currentSettings?.scout_group_name || 'مجموعة الكشافة والمرشدات';
  const schoolName = currentSettings?.school_name || 'مدرسة القديس يوسف بالعبور';
  const scoutGroupNameEn = currentSettings?.scout_group_name_en;
  const scoutLogoUrl = currentSettings?.scout_logo_url;

  const handlePrint = () => {
    window.print();
  };

  const amountNumber = member.paid_amount || unifiedFee;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white">
      <div
        id="payment_receipt_modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none"
      >
        {/* Top Action Bar (hidden in print) */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base">معاينة إيصال سداد الاشتراك السنوي</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              طباعة الإيصال
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Content */}
        <div className="p-8 print:p-10 space-y-6 text-slate-800 bg-white" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center p-1 shadow-xs overflow-hidden">
                {scoutLogoUrl ? (
                  <img
                    src={scoutLogoUrl}
                    alt={scoutGroupName}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ScoutEmblem size={46} groupNameEn={scoutGroupNameEn} />
                )}
              </div>
              <div className="space-y-0.5">
                <h1 className="text-lg font-black text-emerald-950">{scoutGroupName}</h1>
                <h2 className="text-xs font-bold text-emerald-800">{schoolName}</h2>
                <p className="text-[11px] text-slate-500">نظام الإدارة الكشفية والإدارية المعتمد</p>
              </div>
            </div>
            <div className="text-left space-y-1">
              <div className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 font-black text-sm font-mono">
                {member.receipt_number || `REC-${year}-${String(member.member_id).padStart(4, '0')}`}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                التاريخ: {member.payment_date || new Date().toISOString().split('T')[0]}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center py-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              إيصال استلام اشتراك كشفي سنوي - عام {year}
            </h3>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {member.subscription_type || 'اشتراك سنوي'}
              </span>
            </div>
          </div>

          {/* Member Details Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-sm">
            <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200 divide-x divide-x-reverse divide-slate-200">
              <div className="p-3">
                <span className="text-xs text-slate-500 block font-semibold">اسم العضو / القائد:</span>
                <span className="font-extrabold text-slate-900 text-base mt-0.5 block">
                  {member.student_name}
                </span>
                {member.student_name_en && (
                  <span className="text-xs text-slate-500 font-medium font-sans">
                    {member.student_name_en}
                  </span>
                )}
              </div>
              <div className="p-3">
                <span className="text-xs text-slate-500 block font-semibold">كود العضو:</span>
                <span className="font-mono font-extrabold text-emerald-800 text-base mt-0.5 block">
                  {member.member_code}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 bg-white border-b border-slate-200 divide-x divide-x-reverse divide-slate-200 text-xs">
              <div className="p-3">
                <span className="text-slate-500 block font-semibold">الصفة:</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{member.member_type}</span>
              </div>
              <div className="p-3">
                <span className="text-slate-500 block font-semibold">الصف الدراسي:</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{member.school_stage}</span>
              </div>
              <div className="p-3">
                <span className="text-slate-500 block font-semibold">العشيرة:</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {member.tribe_name || 'غير محدد'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-600 block font-semibold">المبلغ المستلم:</span>
                <span className="text-lg font-black text-emerald-900 mt-0.5 block">
                  {amountNumber} جنيهاً مصرياً فقط لا غير
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-100/80 px-3 py-1.5 rounded-lg border border-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                مسدد بالكامل
              </div>
            </div>
          </div>

          {/* Notes if any */}
          {member.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">ملاحظات:</span>
              <p className="text-slate-600">{member.notes}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
            <div className="text-center space-y-12">
              <p className="font-bold text-slate-700">توقيع المستلم (أمين الصندوق / القائد):</p>
              <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
            </div>
            <div className="text-center space-y-12">
              <p className="font-bold text-slate-700">خاتم مجموعة الكشافة والمرشدات:</p>
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 mx-auto flex items-center justify-center text-[10px] text-slate-400">
                خاتم المجموعة
              </div>
            </div>
          </div>

          <div className="text-center pt-2 text-[10px] text-slate-400 border-t border-slate-100">
            تم إصدار هذا الإيصال إلكترونياً من نظام إدارة الكشافة - {scoutGroupName} ({schoolName})
          </div>
        </div>
      </div>
    </div>
  );
};
