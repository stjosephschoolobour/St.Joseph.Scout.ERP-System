import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Share2,
  Phone,
  CheckCircle2,
  Clock,
  Package,
  FileText,
  Copy,
  ExternalLink,
  ShieldCheck,
  Building2,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas-pro';
import { StoreOrder } from '../types';
import { ScoutEmblem } from '../../members/components/ScoutEmblem';
import { SystemSettings } from '../../settings/types';
import { settingsService } from '../../settings/services/settingsService';

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: StoreOrder | null;
  settings?: SystemSettings | null;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  settings: propSettings,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Dynamic Scout Group Branding from System Settings
  const [currentSettings, setCurrentSettings] = useState<SystemSettings | null>(() => {
    return propSettings || settingsService.getCachedSettings();
  });

  useEffect(() => {
    if (propSettings) {
      setCurrentSettings(propSettings);
      return;
    }
    const cached = settingsService.getCachedSettings();
    if (cached) {
      setCurrentSettings(cached);
    } else {
      settingsService.getSettings().then(setCurrentSettings).catch(() => {});
    }
    return settingsService.subscribe(setCurrentSettings);
  }, [propSettings]);

  const scoutGroupName = currentSettings?.scout_group_name || currentSettings?.school_name || 'مجموعة مدرسة القديس يوسف الكشفية';
  const scoutGroupNameEn = currentSettings?.scout_group_name_en || "ST. JOSEPH'S SCHOOL SCOUT GROUP";
  const scoutLogoUrl = currentSettings?.scout_logo_url;

  // Selected phone number to send to via WhatsApp
  const [selectedPhone, setSelectedPhone] = useState('');
  const [phoneTypeLabel, setPhoneTypeLabel] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Determine initial phone number when order changes
  useEffect(() => {
    if (!order) return;

    const isLeader =
      order.buyer_type === 'LEADER' ||
      order.user_role === 'LEADER' ||
      (order as any).member_type_field === 'قائد';

    // Prioritization:
    // If leader -> leader phone || buyer phone || father phone
    // If member -> father phone || mother phone || buyer phone
    let phone = order.target_phone || '';
    let label = order.phone_type || (isLeader ? 'الرقم الشخصي (قائد)' : 'رقم ولي الأمر');

    if (!phone) {
      if (isLeader) {
        phone = order.leader_phone || order.buyer_phone || order.father_phone || order.mother_phone || '';
        label = 'الرقم الشخصي (قائد)';
      } else {
        phone = order.father_phone || order.mother_phone || order.buyer_phone || order.leader_phone || '';
        label = order.father_phone ? 'رقم ولي الأمر (الأب)' : order.mother_phone ? 'رقم ولي الأمر (الأم)' : 'رقم ولي الأمر';
      }
    }

    setSelectedPhone(phone);
    setPhoneTypeLabel(label);
  }, [order]);

  if (!isOpen || !order) return null;

  // Format Egyptian WhatsApp phone number: '01003634538' -> '201003634538'
  const formatWhatsAppNumber = (phoneStr: string) => {
    let clean = phoneStr.replace(/\D/g, '');
    if (clean.startsWith('0020')) {
      clean = clean.substring(2);
    } else if (clean.startsWith('00')) {
      clean = clean.substring(2);
    } else if (clean.startsWith('01') && clean.length === 11) {
      clean = '20' + clean.substring(1);
    } else if (clean.startsWith('1') && clean.length === 10) {
      clean = '20' + clean;
    }
    return clean;
  };

  // Generate formatted text receipt for WhatsApp
  const generateWhatsAppMessage = () => {
    const isSold = order.status === 'SOLD';
    const statusArabic =
      order.status === 'SOLD'
        ? '✅ تم البيع والسداد'
        : order.status === 'WAITING_PICKUP'
        ? '⏳ في انتظار الاستلام والسداد'
        : order.status === 'CANCELLED'
        ? '❌ تم الإلغاء'
        : '📋 قيد المراجعة';

    const dateStr = new Date(order.paid_at || order.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const itemsList = (order.items || [])
      .map(
        (i, idx) =>
          `🔹 *${i.item_name}*${i.size ? ` (مقاس: ${i.size})` : ''}\n   الكمية: ${i.quantity} × ${i.unit_price} ج.م = ${i.total_price} ج.م`
      )
      .join('\n');

    return `⚜️ *${scoutGroupName}* ⚜️
*متجر الكشافة الرسمي - إيصال طلب*
━━━━━━━━━━━━━━━━━━━━
📄 *رقم الإيصال:* ${order.order_number}
👤 *اسم المشتري:* ${order.buyer_name}
🏷️ *الصفة:* ${order.buyer_type === 'LEADER' ? 'قائد كشفي' : 'عضو كشفي'}
📱 *الهاتف المستهدف:* ${selectedPhone} (${phoneTypeLabel})
📅 *التاريخ:* ${dateStr}
━━━━━━━━━━━━━━━━━━━━
📦 *تفاصيل الأصناف:*
${itemsList}
━━━━━━━━━━━━━━━━━━━━
💵 *إجمالي عدد القطع:* ${order.total_items} قطعة
💰 *المبلغ الإجمالي:* ${Number(order.total_price).toLocaleString('ar-EG')} ج.م
📌 *حالة الطلب:* ${statusArabic}
${order.paid_by ? `👤 *مسؤول التحصيل:* ${order.paid_by}\n` : ''}━━━━━━━━━━━━━━━━━━━━
شكراً لكم، ونتمنى لكم نشاطاً كشفياً ممتعاً وموفقاً! ⚜️`;
  };

  // Convert Data URL to Blob reliably
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'image/png';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  // Generate PNG DataUrl of the Receipt Card with resilient fallback
  const generateReceiptDataUrl = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;
    try {
      return await toPng(receiptRef.current, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: true, // Prevents "Cannot access rules" SecurityError on remote Google Fonts
      });
    } catch (err1) {
      console.warn('html-to-image failed, falling back to html2canvas-pro:', err1);
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return canvas.toDataURL('image/png');
    }
  };

  // Download Receipt as PNG Image
  const handleDownloadImage = async () => {
    try {
      setIsGeneratingImage(true);
      const dataUrl = await generateReceiptDataUrl();
      if (!dataUrl) throw new Error('تعذر إنشاء صورة الإيصال');

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `إيصال_طلب_${order.order_number}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('تم تحميل صورة الإيصال بنجاح إلى جهازك', 'success');
    } catch (err: any) {
      console.error('Download receipt image error:', err);
      showToast('حدث خطأ أثناء تحميل صورة الإيصال', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Send via WhatsApp (as Image via Web Share API, with fallback to WhatsApp chat link & image download)
  const handleSendViaWhatsApp = async () => {
    if (!selectedPhone.trim()) {
      showToast('يرجى التأكد من كتابة رقم الهاتف أولاً', 'error');
      return;
    }

    const cleanNumber = formatWhatsAppNumber(selectedPhone);
    const messageText = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

    try {
      setIsGeneratingImage(true);
      const dataUrl = await generateReceiptDataUrl();

      if (dataUrl) {
        const blob = dataUrlToBlob(dataUrl);
        const imageFile = new File([blob], `receipt_${order.order_number}.png`, {
          type: 'image/png',
        });

        // If browser supports sharing files natively
        if (
          navigator.share &&
          navigator.canShare &&
          navigator.canShare({ files: [imageFile] })
        ) {
          await navigator.share({
            files: [imageFile],
            title: `إيصال حجز رقم ${order.order_number}`,
            text: messageText,
          });
          showToast('تم فتح تطبيق المشاركة وإرسال صورة الإيصال بنجاح', 'success');
          return;
        }

        // Fallback for Desktop:
        // Download image so user has it immediately
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `إيصال_طلب_${order.order_number}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Open WhatsApp Web or App chat with pre-filled message
      window.open(waUrl, '_blank');
      showToast(
        'تم فتح محادثة الواتساب وتنزيل صورة الإيصال لتتمكن من إرسالها مباشرة',
        'info'
      );
    } catch (err: any) {
      // User cancelled native share or fallback
      if (err?.name === 'AbortError') {
        console.log('User cancelled share');
        return;
      }
      console.error('WhatsApp share error:', err);
      // As a safe fallback, open whatsapp URL directly
      window.open(waUrl, '_blank');
      showToast('تم فتح محادثة الواتساب الخاصة بالمشتري', 'info');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Copy details to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateWhatsAppMessage());
      showToast('تم نسخ نص الإيصال بنجاح', 'success');
    } catch {
      showToast('تعذر نسخ النص', 'error');
    }
  };

  // Standard Print
  const handlePrint = () => {
    window.print();
  };

  const isLeader =
    order.buyer_type === 'LEADER' ||
    order.user_role === 'LEADER' ||
    (order as any).member_type_field === 'قائد';

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  إيصال حجز وسداد المتجر
                </h3>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {order.order_number}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تحويل الإيصال لصورة والإرسال المباشر عبر الواتساب
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {/* Target Phone Controls for WhatsApp */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>رقم الواتساب المستهدف للإرسال:</span>
              </label>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isLeader ? '👤 الرقم الشخصي للقائد' : '👨‍👩‍👧 رقم ولي أمر العضو'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="tel"
                  dir="ltr"
                  value={selectedPhone}
                  onChange={(e) => setSelectedPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>

              {/* Quick switch phone numbers if available */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {order.father_phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhone(order.father_phone || '');
                      setPhoneTypeLabel('رقم ولي الأمر (الأب)');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                      selectedPhone === order.father_phone
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    هاتف الأب
                  </button>
                )}
                {order.mother_phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhone(order.mother_phone || '');
                      setPhoneTypeLabel('رقم ولي الأمر (الأم)');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                      selectedPhone === order.mother_phone
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    هاتف الأم
                  </button>
                )}
                {order.leader_phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhone(order.leader_phone || '');
                      setPhoneTypeLabel('الرقم الشخصي (قائد)');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                      selectedPhone === order.leader_phone
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    هاتف القائد
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {isLeader
                ? 'يتم إرسال الإيصال إلى الرقم الشخصي للقائد المسجل في سجل الكشافة أو المدخل بالطلب.'
                : 'يتم إرسال الإيصال تلقائياً إلى رقم ولي الأمر (الأب أو الأم) لتوثيق مشتريات العضو وسدادها.'}
            </p>
          </div>

          {/* THE RECEIPT CARD (Rendered for view & captured by html2canvas) */}
          <div className="overflow-x-auto p-1">
            <div
              ref={receiptRef}
              className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-slate-200 shadow-lg text-slate-800 mx-auto max-w-xl relative overflow-hidden"
              style={{ minWidth: '340px' }}
            >
              {/* Subtle decorative top bar */}
              <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700" />

              {/* Receipt Header with Scout Logo */}
              <div className="text-center pb-5 border-b-2 border-dashed border-slate-200 relative">
                <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-2.5 shadow-xs p-1.5 overflow-hidden">
                  {scoutLogoUrl ? (
                    <img
                      src={scoutLogoUrl}
                      alt={scoutGroupName}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ScoutEmblem size={52} groupNameEn={scoutGroupNameEn} />
                  )}
                </div>
                <h4 className="text-base font-black text-slate-900 tracking-tight">
                  {scoutGroupName}
                </h4>
                <p className="text-xs font-bold text-emerald-800 mt-0.5">
                  متجر الكشافة ومستلزمات المعسكرات
                </p>
                <div className="inline-block mt-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                  إيصال رسمي واستلام مالي
                </div>
              </div>

              {/* Order Meta Info Grid */}
              <div className="my-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">رقم الإيصال / الطلب:</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {order.order_number}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-slate-500 block text-[11px] font-medium">حالة الطلب:</span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      order.status === 'SOLD'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : order.status === 'WAITING_PICKUP'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : order.status === 'CANCELLED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {order.status === 'SOLD'
                      ? 'تم البيع والسداد'
                      : order.status === 'WAITING_PICKUP'
                      ? 'في انتظار الاستلام'
                      : order.status === 'CANCELLED'
                      ? 'ملغي'
                      : 'قيد المراجعة'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">تاريخ الطلب:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(order.created_at).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div className="text-left">
                  <span className="text-slate-500 block text-[11px] font-medium">تاريخ السداد:</span>
                  <span className="font-bold text-slate-800">
                    {order.paid_at
                      ? new Date(order.paid_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'قيد السداد'}
                  </span>
                </div>
              </div>

              {/* Buyer Information Section */}
              <div className="my-4 p-4 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">اسم المشتري:</span>
                  <span className="font-black text-slate-900 text-sm">{order.buyer_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">الصفة الكشفية:</span>
                  <span className="font-bold text-emerald-800">
                    {order.buyer_type === 'LEADER' ? 'قائد كشفي' : 'عضو / كشاف'}
                  </span>
                </div>
                {order.tribe_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">العشيرة / الفرقة:</span>
                    <span className="font-bold text-slate-800">{order.tribe_name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">
                    {isLeader ? 'الرقم الشخصي (واتساب):' : 'رقم ولي الأمر (واتساب):'}
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs" dir="ltr">
                    {selectedPhone || order.buyer_phone || '-'}
                  </span>
                </div>
                {order.guardian_name && !isLeader && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">اسم ولي الأمر:</span>
                    <span className="font-bold text-slate-800">{order.guardian_name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="my-4 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-right divide-y divide-slate-200">
                  <thead className="bg-slate-100/80 text-slate-700 font-black">
                    <tr>
                      <th className="py-2.5 px-3">الصنف</th>
                      <th className="py-2.5 px-2 text-center">الكمية</th>
                      <th className="py-2.5 px-3 text-left">السعر</th>
                      <th className="py-2.5 px-3 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(order.items || []).map((itm, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-bold text-slate-800">
                          <div>{itm.item_name}</div>
                          {itm.size && (
                            <span className="inline-block mt-0.5 text-[10px] text-slate-500 font-normal">
                              المقاس: {itm.size}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-700">
                          {itm.quantity}
                        </td>
                        <td className="py-2 px-3 text-left font-medium text-slate-600">
                          {itm.unit_price} ج.م
                        </td>
                        <td className="py-2 px-3 text-left font-black text-slate-900">
                          {itm.total_price} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary and Grand Total */}
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800">
                    إجمالي الأصناف: {order.total_items} قطعة
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    {order.status === 'SOLD' ? 'المبلغ مسدد بالكامل' : 'المبلغ المطلوب سداده'}
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-slate-600 block">المبلغ الإجمالي:</span>
                  <span className="text-xl font-black text-emerald-800 tracking-tight">
                    {Number(order.total_price).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>

              {/* Footer notes & Official sign-off */}
              <div className="mt-5 pt-4 border-t-2 border-dashed border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
                <div>
                  <span className="block font-bold text-slate-700">
                    {order.paid_by ? `مسؤول التحصيل: ${order.paid_by}` : 'مسؤول متجر الكشافة'}
                  </span>
                  <span className="text-[10px] text-slate-400">ختم إلكتروني معتمد للمتجر</span>
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-emerald-600/30 flex items-center justify-center p-1 text-center rotate-12 bg-emerald-50/50">
                  <div className="text-[9px] font-black text-emerald-700 leading-tight">
                    معتمد<br />متجر الكشافة<br />⚜️
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="نسخ تفاصيل الإيصال كنص"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">نسخ النص</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="تحميل الإيصال كصورة PNG"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تحميل كصورة</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              إغلاق
            </button>

            <button
              type="button"
              disabled={isGeneratingImage}
              onClick={handleSendViaWhatsApp}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-700/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGeneratingImage ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري تجهيز الصورة...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>إرسال الإيصال عبر الواتساب</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-90 animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-none"
          dir="rtl"
        >
          <div
            className={`px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold text-white ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900/95 border-emerald-700 shadow-emerald-950/40'
                : toastMessage.type === 'error'
                ? 'bg-rose-900/95 border-rose-700 shadow-rose-950/40'
                : 'bg-slate-900/95 border-slate-700 shadow-slate-950/40'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};
