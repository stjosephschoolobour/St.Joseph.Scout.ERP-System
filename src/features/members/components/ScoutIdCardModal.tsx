import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas-pro';
import {
  Printer,
  X,
  CreditCard,
  HeartPulse,
  Award,
  Phone,
  Calendar,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileText,
  Layers,
  MapPin,
  CheckCircle2,
  Check,
  User,
  Share2,
  Download,
  Copy,
  MessageCircle,
  Send,
  ExternalLink,
  FileImage,
  Image as ImageIcon,
} from 'lucide-react';
import { Member } from '../types';
import { MemberBadge } from '../../badges/types';
import { badgeService } from '../../badges/services/badgeService';
import { getPhotoUrl } from '../../../utils/photo';
import { ScoutEmblem } from './ScoutEmblem';
import { SystemSettings } from '../../settings/types';
import { settingsService } from '../../settings/services/settingsService';

interface ScoutIdCardModalProps {
  isOpen: boolean;
  member: Member | null;
  onClose: () => void;
  settings?: SystemSettings | null;
}

const BLOOD_TYPES = ['O+ POS', 'A+ POS', 'B+ POS', 'AB+ POS', 'O- NEG', 'A- NEG', 'B- NEG', 'AB- NEG'] as const;

export const ScoutIdCardModal: React.FC<ScoutIdCardModalProps> = ({
  isOpen,
  member,
  onClose,
  settings: propSettings,
}) => {
  const frontCardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);

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

  const [activeTab, setActiveTab] = useState<'both' | 'front' | 'back'>('both');
  const [printLayout, setPrintLayout] = useState<'a4' | 'cr80'>('a4');
  const [bloodType, setBloodType] = useState<string>('O+ POS');
  const [validFrom, setValidFrom] = useState<string>('09/24');
  const [validUntil, setValidUntil] = useState<string>('08/25');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Sharing & Image Generation States
  const [isGeneratingImages, setIsGeneratingImages] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [frontDataUrl, setFrontDataUrl] = useState<string | null>(null);
  const [backDataUrl, setBackDataUrl] = useState<string | null>(null);
  const [frontBlob, setFrontBlob] = useState<Blob | null>(null);
  const [backBlob, setBackBlob] = useState<Blob | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState<boolean>(false);

  // Initialize dates and blood type based on member data
  useEffect(() => {
    if (!member) return;

    // Detect blood type from medical condition if present
    const condition = member.medical_condition || '';
    const match = BLOOD_TYPES.find((b) =>
      condition.toUpperCase().includes(b.split(' ')[0]) || condition.includes(b)
    );
    if (match) {
      setBloodType(match);
    } else {
      setBloodType('O+ POS');
    }

    // Determine default dates
    const joinYear = member.scout_join_year || new Date().getFullYear();
    const startYearYY = String(joinYear).slice(-2);
    const endYearYY = String(Number(joinYear) + 1).slice(-2);
    setValidFrom(`09/${startYearYY}`);
    setValidUntil(`08/${endYearYY}`);

    // Generate QR Code
    const qrPayload = JSON.stringify({
      org: "St. Joseph's Scout Group",
      code: member.member_code || `SCT-${member.id}`,
      name: member.student_name,
      nat_id: member.national_id,
      stage: member.school_stage,
      type: member.member_type,
      valid: `09/${startYearYY} - 08/${endYearYY}`,
      url: `https://stjoseph-scouts.edu.eg/verify/${member.member_code || member.id}`,
    });

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#0f291e',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('QR Code error:', err));

    // Fetch earned badges for the back face
    setLoadingBadges(true);
    badgeService
      .getMemberBadges(member.id)
      .then((data) => {
        setBadges(data || []);
      })
      .catch((err) => {
        console.error('Error loading member badges:', err);
        setBadges([]);
      })
      .finally(() => setLoadingBadges(false));

    // Reset generated images on member change
    setFrontDataUrl(null);
    setBackDataUrl(null);
    setFrontBlob(null);
    setBackBlob(null);
  }, [member]);

  // Check native share support when files are generated
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      setCanNativeShare(true);
    }
  }, []);

  if (!isOpen || !member) return null;

  // Member code (e.g. A250151)
  const formattedCode =
    member.member_code || `A25${String(member.id).padStart(4, '0')}`;

  const safeMemberName = (member.student_name || 'scout').trim().replace(/[\s/\\?%*:|"<>]+/g, '_');

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

  // Resilient capture function that avoids CSS color parser errors (like oklch) and cross-origin font errors
  const captureElementToPng = async (element: HTMLElement): Promise<string> => {
    // Strategy 1: html-to-image with skipFonts: true (Uses native browser SVG rendering without reading cross-origin CSS rules)
    try {
      return await toPng(element, {
        pixelRatio: 2.5, // Crisp 2.5x Retina resolution
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: true, // Prevents "Cannot access rules" SecurityError on remote Google Fonts
      });
    } catch (err1) {
      console.warn('html-to-image failed, falling back to html2canvas-pro:', err1);
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return canvas.toDataURL('image/png');
    }
  };

  // Generate high-resolution card images for front and back faces
  const generateCardImages = async (): Promise<{
    frontDataUrl: string;
    backDataUrl: string;
    frontBlob: Blob;
    backBlob: Blob;
  } | null> => {
    if (!frontCardRef.current || !backCardRef.current) return null;

    setIsGeneratingImages(true);

    // Ensure elements are unhidden and properly displayed in DOM during capture
    const frontParent = frontCardRef.current.parentElement;
    const backParent = backCardRef.current.parentElement;

    const originalFrontStyle = frontParent
      ? {
          position: frontParent.style.position,
          left: frontParent.style.left,
          opacity: frontParent.style.opacity,
          pointerEvents: frontParent.style.pointerEvents,
          display: frontParent.style.display,
        }
      : null;

    const originalBackStyle = backParent
      ? {
          position: backParent.style.position,
          left: backParent.style.left,
          opacity: backParent.style.opacity,
          pointerEvents: backParent.style.pointerEvents,
          display: backParent.style.display,
        }
      : null;

    try {
      if (frontParent) {
        frontParent.style.position = 'relative';
        frontParent.style.left = '0';
        frontParent.style.opacity = '1';
        frontParent.style.pointerEvents = 'auto';
        frontParent.style.display = 'flex';
      }
      if (backParent) {
        backParent.style.position = 'relative';
        backParent.style.left = '0';
        backParent.style.opacity = '1';
        backParent.style.pointerEvents = 'auto';
        backParent.style.display = 'flex';
      }

      // Small delay to allow any pending layout / paint calculation
      await new Promise((r) => setTimeout(r, 60));

      const [fDataUrl, bDataUrl] = await Promise.all([
        captureElementToPng(frontCardRef.current),
        captureElementToPng(backCardRef.current),
      ]);

      const fBlob = dataUrlToBlob(fDataUrl);
      const bBlob = dataUrlToBlob(bDataUrl);

      setFrontDataUrl(fDataUrl);
      setBackDataUrl(bDataUrl);
      setFrontBlob(fBlob);
      setBackBlob(bBlob);

      return {
        frontDataUrl: fDataUrl,
        backDataUrl: bDataUrl,
        frontBlob: fBlob,
        backBlob: bBlob,
      };
    } catch (err) {
      console.error('Failed to generate card images:', err);
      return null;
    } finally {
      if (frontParent && originalFrontStyle) {
        frontParent.style.position = originalFrontStyle.position;
        frontParent.style.left = originalFrontStyle.left;
        frontParent.style.opacity = originalFrontStyle.opacity;
        frontParent.style.pointerEvents = originalFrontStyle.pointerEvents;
        frontParent.style.display = originalFrontStyle.display;
      }
      if (backParent && originalBackStyle) {
        backParent.style.position = originalBackStyle.position;
        backParent.style.left = originalBackStyle.left;
        backParent.style.opacity = originalBackStyle.opacity;
        backParent.style.pointerEvents = originalBackStyle.pointerEvents;
        backParent.style.display = originalBackStyle.display;
      }
      setIsGeneratingImages(false);
    }
  };

  // Open sharing dialog and trigger image generation
  const handleOpenShareModal = async () => {
    let images = null;
    if (frontDataUrl && backDataUrl && frontBlob && backBlob) {
      images = {
        frontDataUrl,
        backDataUrl,
        frontBlob,
        backBlob,
      };
    } else {
      images = await generateCardImages();
    }

    if (!images) {
      alert('تعذر توليد صور الكارنيه، يرجى المحاولة مرة أخرى.');
      return;
    }

    setIsShareModalOpen(true);
  };

  // Native Web Share API (WhatsApp, Telegram, AirDrop, etc.)
  const handleNativeShare = async () => {
    if (!frontBlob || !backBlob) return;

    try {
      const frontFile = new File([frontBlob], `كارنيه_${safeMemberName}_الوجه_الأمامي.png`, { type: 'image/png' });
      const backFile = new File([backBlob], `كارنيه_${safeMemberName}_الوجه_الخلفي.png`, { type: 'image/png' });

      const shareText = `*${scoutGroupName}*\nكارنيه العضوية الكشفية المعتمد (CR80 ID)\n👤 الاسم: ${member.student_name}\n🎖️ رقم العضوية: ${formattedCode}\n⚜️ المرحلة: ${member.school_stage || 'كشاف'}\n🩸 فصيلة الدم: ${bloodType}`;

      if (navigator.canShare && navigator.canShare({ files: [frontFile, backFile] })) {
        await navigator.share({
          title: `كارنيه كشفي - ${member.student_name}`,
          text: shareText,
          files: [frontFile, backFile],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `كارنيه كشفي - ${member.student_name}`,
          text: shareText,
        });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Native share error or dismissed:', err);
      }
    }
  };

  // Direct WhatsApp Share (formatted message)
  const handleWhatsAppShare = () => {
    const message =
      `*${scoutGroupName}*\n` +
      `⚜️ *بطاقة العضوية الكشفية الرسمية (CR80 ID)*\n\n` +
      `👤 *اسم العضو:* ${member.student_name}\n` +
      `🎖️ *رقم العضوية:* ${formattedCode}\n` +
      `🏕️ *المرحلة والعشيرة:* ${member.school_stage || 'كشاف'} - عشيرة ${member.tribe_name || 'النصر'}\n` +
      `🩸 *فصيلة الدم:* ${bloodType}\n` +
      `📅 *فترة الصلاحية:* من ${validFrom} إلى ${validUntil}\n` +
      `📞 *رقم الطوارئ المسجل:* ${member.father_phone || member.mother_phone || 'غير مسجل'}\n\n` +
      `🌐 *رابط التحقق الإلكتروني الرسمي:*\nhttps://stjoseph-scouts.edu.eg/verify/${member.member_code || member.id}\n\n` +
      `_تم إرفاق صورتي الكارنيه (الوجه الأمامي والخلفي)_`;

    const encoded = encodeURIComponent(message);
    const rawPhone = member.father_phone || member.mother_phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');

    let waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    if (cleanPhone.length >= 10) {
      const intlPhone = cleanPhone.startsWith('2')
        ? cleanPhone
        : `2${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}`;
      waUrl = `https://wa.me/${intlPhone}?text=${encoded}`;
    }

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Copy Image to Clipboard
  const handleCopyImageToClipboard = async (type: 'front' | 'back') => {
    const blob = type === 'front' ? frontBlob : backBlob;
    if (!blob) return;

    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopyToast(
          type === 'front'
            ? 'تم نسخ صورة الوجه الأمامي! يمكنك لصقها مباشرة في واتساب أو أي برنامج (Ctrl+V)'
            : 'تم نسخ صورة الوجه الخلفي! يمكنك لصقها مباشرة في واتساب أو أي برنامج (Ctrl+V)'
        );
        setTimeout(() => setCopyToast(null), 4000);
      } else {
        throw new Error('Clipboard write not supported');
      }
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      setCopyToast('خاصية النسخ المباشر غير مدعومة بالمتصفح، يمكنك تحميل الصورة واستخدامها');
      setTimeout(() => setCopyToast(null), 4000);
    }
  };

  // Download Image Helper
  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Front, Back, or Both Images
  const handleDownloadImages = async (type: 'front' | 'back' | 'both') => {
    let fUrl = frontDataUrl;
    let bUrl = backDataUrl;

    if (!fUrl || !bUrl) {
      const res = await generateCardImages();
      if (!res) return;
      fUrl = res.frontDataUrl;
      bUrl = res.backDataUrl;
    }

    if (type === 'front' || type === 'both') {
      downloadDataUrl(fUrl!, `كارنيه_${safeMemberName}_الوجه_الأمامي.png`);
    }

    if (type === 'back' || type === 'both') {
      if (type === 'both') {
        setTimeout(() => {
          downloadDataUrl(bUrl!, `كارنيه_${safeMemberName}_الوجه_الخلفي.png`);
        }, 300);
      } else {
        downloadDataUrl(bUrl!, `كارنيه_${safeMemberName}_الوجه_الخلفي.png`);
      }
    }
  };

  // Reliable Printing via clean isolated iframe
  const handlePrint = () => {
    setIsPrinting(true);

    try {
      // 1. Create a dedicated offscreen iframe to bypass modal stacking and overflow constraints
      const printFrame = document.createElement('iframe');
      printFrame.setAttribute('title', 'Print Scout Card');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);

      const frontEl = frontCardRef.current;
      const backEl = backCardRef.current;

      const frontHtml = frontEl ? frontEl.outerHTML : '';
      const backHtml = backEl ? backEl.outerHTML : '';

      const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <meta charset="utf-8">
              <title>كارنيه كشافة - ${member.student_name}</title>
              <style>
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  margin: 0;
                  padding: 0;
                }
                body {
                  background: #ffffff !important;
                  display: flex;
                  flex-direction: ${printLayout === 'cr80' ? 'column' : 'row'};
                  flex-wrap: wrap;
                  align-items: center;
                  justify-content: center;
                  gap: ${printLayout === 'cr80' ? '0' : '28px'};
                  padding: ${printLayout === 'cr80' ? '0' : '20mm 15mm'};
                  font-family: system-ui, -apple-system, sans-serif;
                }
                @page {
                  size: ${printLayout === 'cr80' ? '85.6mm 53.98mm' : 'A4 portrait'};
                  margin: ${printLayout === 'cr80' ? '0mm' : '10mm'};
                }
                @media print {
                  body {
                    padding: ${printLayout === 'cr80' ? '0' : '15mm 10mm'};
                  }
                }
              </style>
            </head>
            <body>
              ${activeTab === 'both' || activeTab === 'front' ? frontHtml : ''}
              ${activeTab === 'both' || activeTab === 'back' ? backHtml : ''}
            </body>
          </html>
        `);
        frameDoc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch (err) {
            console.warn('Iframe print blocked, falling back to window.print():', err);
            window.print();
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(printFrame);
              } catch {}
              setIsPrinting(false);
            }, 1000);
          }
        }, 400);
      } else {
        window.print();
        setIsPrinting(false);
      }
    } catch (err) {
      console.error('Print execution failed:', err);
      try {
        window.print();
      } catch {}
      setIsPrinting(false);
    }
  };

  return (
    <>
      {/* Print Stylesheet for direct window.print() fallback */}
      <style>{`
        @media print {
          /* Hide non-modal content */
          body > *:not(#root) {
            display: none !important;
          }
          /* Reset modal container so it flows freely onto the page */
          .fixed.z-50 {
            position: static !important;
            background: white !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .fixed.z-50 > div {
            border: none !important;
            box-shadow: none !important;
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            animation: none !important;
            transform: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          #scout-id-print-zone, #scout-id-print-zone * {
            visibility: visible !important;
          }
          #scout-id-print-zone {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: ${printLayout === 'cr80' ? '0' : '15mm 10mm'} !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          @page {
            size: ${printLayout === 'cr80' ? '85.6mm 53.98mm' : 'A4 portrait'};
            margin: ${printLayout === 'cr80' ? '0mm' : '10mm'};
          }
        }
      `}</style>

      {/* Main Modal Backdrop */}
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-scale-in text-right flex flex-col max-h-[95vh]">
          
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/90 text-white flex items-center justify-center shadow-xs">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  معاينة وطباعة ومشاركة الكارنيه الكشفي
                  <span className="text-[11px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                    معيار CR80 المعتمد
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {scoutGroupName} • {member.student_name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Share Button (Converts to 2 images and shares) */}
              <button
                id="btn_share_id_card"
                onClick={handleOpenShareModal}
                disabled={isGeneratingImages}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                title="تحويل الكارنيه إلى صورتين ومشاركتهما عبر وسائل التواصل الاجتماعي"
              >
                {isGeneratingImages ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-blue-200" />
                    <span>جاري توليد الصورتين...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>مشاركة الكارنيه</span>
                  </>
                )}
              </button>

              {/* Print Button */}
              <button
                id="btn_print_id_card"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                title="طباعة الكارنيه مباشرة"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'جاري فتح الطباعة...' : 'طباعة الكارنيه'}</span>
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Control Toolbar */}
          <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            {/* View Selector Tabs */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('both')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'both'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>الوجهان معاً</span>
              </button>
              <button
                onClick={() => setActiveTab('front')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'front'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>الوجه الأمامي</span>
              </button>
              <button
                onClick={() => setActiveTab('back')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'back'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>الوجه الخلفي</span>
              </button>
            </div>

            {/* Quick Customization Options */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Blood Type */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] font-medium">فصيلة الدم:</span>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="bg-transparent font-bold text-rose-600 dark:text-rose-400 focus:outline-hidden cursor-pointer"
                >
                  {BLOOD_TYPES.map((b) => (
                    <option key={b} value={b} className="text-slate-900 bg-white">
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Validity Dates */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] font-medium">صالح من / إلى:</span>
                <input
                  type="text"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="w-12 text-center font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                  placeholder="MM/YY"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="text"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-12 text-center font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                  placeholder="MM/YY"
                />
              </div>

              {/* Print Layout Preference */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setPrintLayout('a4')}
                  title="طباعة على ورقة A4 كاملة مع إرشادات القص"
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    printLayout === 'a4'
                      ? 'bg-slate-900 text-white dark:bg-emerald-600'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ورقة A4 (قص وتغليف)
                </button>
                <button
                  onClick={() => setPrintLayout('cr80')}
                  title="طباعة مباشرة لطابعات بطاقات PVC البلاستيكية (Zebra/Evolis/Fargo)"
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    printLayout === 'cr80'
                      ? 'bg-slate-900 text-white dark:bg-emerald-600'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  حجم CR80 PVC
                </button>
              </div>

              {/* Quick Image Export action in toolbar */}
              <button
                onClick={() => handleDownloadImages('both')}
                disabled={isGeneratingImages}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                title="تحميل الوجهين كصورتين PNG عالية الدقة"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>تحميل الصورتين</span>
              </button>
            </div>
          </div>

          {/* Cards Display Canvas */}
          <div className="p-6 sm:p-8 overflow-y-auto bg-slate-100 dark:bg-slate-950 flex-1 flex flex-col items-center justify-center">
            
            <div id="scout-id-print-zone" className="w-full flex flex-col items-center">
              
              {/* Layout description banner (hidden on print) */}
              <div className="mb-6 no-print text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  معاينة طبق الأصل لبطاقة الكارنيه الكشفي الرسمي (معيار CR80 ID - قياس 85.6 × 53.98 مم)
                </p>
              </div>

              {/* Cards Container */}
              <div
                className={`w-full flex flex-wrap items-center justify-center gap-8 ${
                  printLayout === 'a4' ? 'print:flex-row print:gap-8 print:justify-center' : 'print:flex-col print:gap-0'
                }`}
              >
                
                {/* ==================================================== */}
                {/* 1. FRONT CARD FACE (الوجه الأمامي)                 */}
                {/* ==================================================== */}
                <div
                  className={`flex flex-col items-center transition-all duration-150 ${
                    activeTab === 'back'
                      ? 'fixed -left-[9999px] top-0 pointer-events-none opacity-0'
                      : 'flex'
                  }`}
                >
                  <span className="no-print text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    الوجه الأمامي (Front Face)
                  </span>

                  {/* The CR80 Physical Card Frame */}
                  <div
                    ref={frontCardRef}
                    id="card-front-face"
                    className="relative bg-white text-slate-900 rounded-[18px] border border-slate-300/80 shadow-xl overflow-hidden select-none"
                    style={{
                      width: '430px',
                      height: '272px',
                      minWidth: '430px',
                      minHeight: '272px',
                      maxWidth: '430px',
                      maxHeight: '272px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Background Scout Logo Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <ScoutEmblem
                        watermark={true}
                        size={220}
                        className="opacity-15"
                        logoUrl={scoutLogoUrl}
                        groupName={scoutGroupName}
                        groupNameEn={scoutGroupNameEn}
                      />
                    </div>

                    {/* Card Content Layout */}
                    <div className="relative z-10 w-full h-full p-4 flex flex-col justify-between">
                      
                      {/* Top Row: Badges, Header Typography, and Scout Emblem Logo */}
                      <div className="flex items-start justify-between">
                        
                        {/* Top Left Badges: CR80 ID & بطاقة عضو */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="bg-[#0b4d2c] text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-[4px] shadow-xs">
                            CR80 ID
                          </span>
                          <span className="border border-[#b8a776] bg-[#fbf9f4] text-[#4d4022] text-[10px] font-bold px-2 py-0.5 rounded-[4px]">
                            {member.member_type === 'قائد' ? 'بطاقة قائد' : 'بطاقة عضو'}
                          </span>
                        </div>

                        {/* Top Center/Right: School & Scout Group Title */}
                        <div className="flex items-center gap-2.5 text-right">
                          <div>
                            <h4 className="text-[#13492c] font-black text-[12.5px] leading-tight tracking-tight">
                              {scoutGroupName}
                            </h4>
                            <p className="text-[#334155] font-bold text-[8.5px] tracking-wider uppercase font-sans mt-0.5">
                              {scoutGroupNameEn}
                            </p>
                          </div>
                          
                          {/* Official Scout Emblem Logo */}
                          <ScoutEmblem
                            size={44}
                            logoUrl={scoutLogoUrl}
                            groupName={scoutGroupName}
                            groupNameEn={scoutGroupNameEn}
                          />
                        </div>
                      </div>

                      {/* Mid-Row: Member Details (Left/Center) & Member Photo (Right) */}
                      <div className="flex items-center justify-between mt-1 px-1">
                        
                        {/* Member Text Details */}
                        <div className="flex-1 pr-1 text-right">
                          
                          {/* Blood Type Pill */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-slate-500">فصيلة الدم:</span>
                            <span className="bg-[#ffe4e6] text-[#b91c1c] text-[11px] font-black font-mono px-2.5 py-0.5 rounded-[6px] border border-[#fecdd3] shadow-xs">
                              {bloodType}
                            </span>
                          </div>

                          {/* Student / Leader Arabic Name */}
                          <h2 className="text-[#13492c] font-black text-[21px] leading-tight tracking-tight drop-shadow-2xs">
                            {member.student_name}
                          </h2>

                          {/* Tribe / Stage Subtitle */}
                          <p className="text-[#475569] text-[11.5px] font-bold mt-1 flex items-center gap-1">
                            <span>عشيرة {member.tribe_name || 'النصر'}</span>
                            <span className="text-slate-300">•</span>
                            <span>
                              {member.member_type === 'قائد'
                                ? 'قائد كشفي معتمد'
                                : member.school_stage || 'كشاف متقدم'}
                            </span>
                          </p>

                          {/* Scout Membership Code Block */}
                          <div className="mt-2">
                            <span className="text-[9.5px] text-[#64748b] font-bold block">
                              رقم العضوية الكشفية
                            </span>
                            <span className="text-[#0f3d24] text-[19px] font-mono font-black tracking-wider block">
                              {formattedCode}
                            </span>
                          </div>
                        </div>

                        {/* Member Photo & Status Badge */}
                        <div className="flex flex-col items-center shrink-0 ml-1">
                          {/* Photo Container */}
                          <div className="w-[94px] h-[116px] rounded-xl overflow-hidden border-2 border-[#caa455] bg-[#f8fafc] shadow-md relative">
                            {/* Golden corner fold accent */}
                            <div className="absolute top-0 right-0 w-0 h-0 border-t-[14px] border-t-[#caa455] border-l-[14px] border-l-transparent z-10 pointer-events-none"></div>

                            {member.photo_path ? (
                              <img
                                src={getPhotoUrl(member.photo_path)}
                                alt={member.student_name}
                                crossOrigin="anonymous"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                                <User className="w-9 h-9" />
                                <span className="text-[9px] font-bold mt-1">بدون صورة</span>
                              </div>
                            )}
                          </div>

                          {/* Active Status Pill */}
                          <div className="bg-[#0b4d2c] text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center gap-1.5 shadow-xs mt-1.5 w-[94px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>{member.member_type === 'قائد' ? 'قائد نشط' : 'عضو نشط'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Seal, QR Code, and Validity Dates */}
                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between mt-auto">
                        
                        {/* Bottom Left: Golden Seal & QR Code */}
                        <div className="flex items-center gap-2">
                          {/* Golden Seal / Medal Icon */}
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-xs flex items-center justify-center">
                            <div className="w-full h-full rounded-full border border-amber-600/40 bg-amber-400/90 flex items-center justify-center">
                              <Award className="w-4 h-4 text-amber-950" />
                            </div>
                          </div>

                          {/* Scannable QR Code */}
                          <div className="w-8 h-8 bg-white p-0.5 rounded-md border border-slate-300 flex items-center justify-center shadow-xs">
                            {qrCodeDataUrl ? (
                              <img src={qrCodeDataUrl} alt="QR" className="w-full h-full" />
                            ) : (
                              <div className="w-full h-full bg-slate-100"></div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Right: Validity Dates */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                              EXPIRES / تاريخ الانتهاء
                            </span>
                            <span className="text-[12px] font-mono font-black text-slate-800 block text-left">
                              {validUntil}
                            </span>
                          </div>

                          <div className="border-r border-slate-200 pr-3">
                            <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                              VALID FROM / صالح من
                            </span>
                            <span className="text-[12px] font-mono font-black text-slate-800 block text-left">
                              {validFrom}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Bottom Edge Gold Accent Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#b58e38] via-[#f7d67b] to-[#b58e38]"></div>
                  </div>
                </div>

                {/* ==================================================== */}
                {/* 2. BACK CARD FACE (الوجه الخلفي)                    */}
                {/* ==================================================== */}
                <div
                  className={`flex flex-col items-center transition-all duration-150 ${
                    activeTab === 'front'
                      ? 'fixed -left-[9999px] top-0 pointer-events-none opacity-0'
                      : 'flex'
                  }`}
                >
                  <span className="no-print text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    الوجه الخلفي (Back Face)
                  </span>

                  {/* The CR80 Physical Card Frame (Back) */}
                  <div
                    ref={backCardRef}
                    id="card-back-face"
                    className="relative bg-white text-slate-900 rounded-[18px] border border-slate-300/80 shadow-xl overflow-hidden select-none"
                    style={{
                      width: '430px',
                      height: '272px',
                      minWidth: '430px',
                      minHeight: '272px',
                      maxWidth: '430px',
                      maxHeight: '272px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Background Scout Logo Watermark (as requested: علامة مائية للشعار) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <ScoutEmblem
                        watermark={true}
                        size={230}
                        className="opacity-18"
                        logoUrl={scoutLogoUrl}
                        groupName={scoutGroupName}
                        groupNameEn={scoutGroupNameEn}
                      />
                    </div>

                    {/* Content Layout for Back */}
                    <div className="relative z-10 w-full h-full p-3.5 flex flex-col justify-between">
                      
                      {/* Top Header of Back */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/40">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-right">
                            <h5 className="text-[#13492c] font-black text-[10.5px] leading-tight">
                              {scoutGroupName}
                            </h5>
                            <p className="text-[7.5px] text-slate-500 font-semibold tracking-wider uppercase">
                              OFFICIAL EMERGENCY & SCOUT HONORS RECORD
                            </p>
                          </div>
                        </div>

                        <span className="text-[9px] font-mono font-black text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {formattedCode}
                        </span>
                      </div>

                      {/* Middle Section: Badges + Health + Emergency Contacts */}
                      <div className="space-y-1.5 text-right my-auto">
                        
                        {/* Section 1: الأوسمة والشارات المكتسبة */}
                        <div className="bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/80">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-amber-950 flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-600" />
                              الأوسمة والشارات المكتسبة:
                            </span>
                            <span className="text-[8px] font-bold text-amber-800">
                              {badges.length > 0 ? `${badges.length} أوسمة مسجلة` : 'سجل قيد التدريب'}
                            </span>
                          </div>

                          {badges.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap max-h-[34px] overflow-hidden">
                              {badges.slice(0, 4).map((b) => (
                                <span
                                  key={b.award_id}
                                  className="inline-flex items-center gap-1 text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-800 border border-amber-300 shadow-2xs"
                                >
                                  <span>{b.icon || '🏅'}</span>
                                  <span>{b.name}</span>
                                </span>
                              ))}
                              {badges.length > 4 && (
                                <span className="text-[8px] font-bold text-amber-900 px-1">
                                  +{badges.length - 4} أخرى
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 py-0.5 text-[8.5px] text-slate-600 font-medium">
                              <span className="text-amber-700">⭐ كشاف مبتدئ</span>
                              <span>•</span>
                              <span className="text-slate-500">جاري إتمام متطلبات شارات الجدارة والخدمة العامة</span>
                            </div>
                          )}
                        </div>

                        {/* Section 2: الحالة الصحية والطبية */}
                        <div className="bg-rose-50/85 p-1.5 rounded-lg border border-rose-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-rose-950 flex items-center gap-1">
                              <HeartPulse className="w-3 h-3 text-rose-600" />
                              الحالة الصحية:
                            </span>
                            <span className="text-[8.5px] font-black font-mono text-rose-700 bg-white px-1.5 py-0.2 rounded border border-rose-300">
                              فصيلة: {bloodType}
                            </span>
                          </div>
                          <p className="text-[8.5px] text-slate-700 font-medium mt-0.5 line-clamp-1">
                            {member.medical_condition
                              ? member.medical_condition
                              : 'سليم طبياً - لا توجد حساسيات دوائية أو أمراض مزمنة مسجلة'}
                          </p>
                        </div>

                        {/* Section 3: أرقام الطوارئ */}
                        <div className="bg-slate-50/90 p-1.5 rounded-lg border border-slate-200">
                          <span className="text-[9px] font-black text-slate-800 flex items-center gap-1 mb-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            أرقام الطوارئ والتواصل السريع:
                          </span>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8.5px]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">هاتف ولي الأمر:</span>
                              <span className="font-mono font-bold text-slate-900 dir-ltr">
                                {member.father_phone || member.mother_phone || 'غير مسجل'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">هاتف القائد:</span>
                              <span className="font-mono font-bold text-slate-900 dir-ltr">
                                {member.leader_phone || '01000000000'}
                              </span>
                            </div>
                            <div className="col-span-2 flex items-center gap-1 text-[8px] text-slate-500 pt-0.5 border-t border-slate-200/60 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{member.address || 'القاهرة - مدينة العبور'}</span>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Bottom Disclaimer & Security Bar */}
                      <div className="pt-1.5 border-t border-slate-200/90 flex items-end justify-between text-[7px] text-slate-500">
                        <div className="max-w-[270px] leading-tight">
                          <p className="font-semibold text-slate-600">
                            هذه البطاقة وثيقة كشفية رسمية. يرجى إبرازها أثناء المخيمات والأنشطة. في حال العثور عليها يرجى تسليمها لإدارة المدرسة.
                          </p>
                        </div>

                        <div className="text-left font-mono font-bold text-[8px] text-slate-700 flex flex-col items-end">
                          <span className="tracking-widest">*SCT-ID-{member.id}*</span>
                          <span className="text-[7px] text-emerald-800 font-sans font-bold">ختم الكشافة المعتمد</span>
                        </div>
                      </div>

                    </div>

                    {/* Bottom Edge Gold Accent Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#b58e38] via-[#f7d67b] to-[#b58e38]"></div>
                  </div>
                </div>

              </div>

              {/* Instructions below cards (hidden on print) */}
              <div className="mt-8 no-print max-w-xl bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 text-center space-y-1.5">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  خيارات الطباعة والمشاركة الذكية:
                </p>
                <p>
                  • انقر على <b>"مشاركة الكارنيه"</b> لتحويل الوجهين إلى صورتين فوراً ومشاركتهما عبر واتساب أو نسخها أو تنزيلها.
                </p>
                <p>
                  • لطابعات البطاقات البلاستيكية (Card Printers)، اختر تخطيط <b>"حجم CR80 PVC"</b>، أو اختر <b>"ورقة A4"</b> للطباعة المنزلية والتغليف الحراري.
                </p>
              </div>

            </div>

          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                رقم العضوية: <strong className="font-mono text-slate-700 dark:text-slate-200">{formattedCode}</strong>
              </span>

              {copyToast && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-fade-in bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {copyToast}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>

              <button
                id="btn_footer_share"
                onClick={handleOpenShareModal}
                disabled={isGeneratingImages}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة الكارنيه</span>
              </button>

              <button
                id="btn_footer_print"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'جاري الطباعة...' : 'طباعة الكارنيه الآن'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ==================================================== */}
      {/* SOCIAL MEDIA SHARING & IMAGE CONVERSION MODAL       */}
      {/* ==================================================== */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto text-right">
            
            {/* Share Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-white border border-white/20">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">مشاركة كارنيه العضوية الكشفية</h3>
                  <p className="text-xs text-blue-100">
                    تم تحويل الكارنيه إلى صورتين بدقة عالية (الوجه الأمامي والخلفي)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Image Previews (Side-by-side or stacked on mobile) */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2.5">
                  معاينة الصورتين الناتجتين:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front Preview */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                    <div className="w-full aspect-[430/272] bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      {frontDataUrl ? (
                        <img
                          src={frontDataUrl}
                          alt="الوجه الأمامي"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Sparkles className="w-6 h-6 animate-spin text-slate-400" />
                      )}
                    </div>
                    <div className="w-full flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">الوجه الأمامي</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyImageToClipboard('front')}
                          className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-600 transition flex items-center gap-1 cursor-pointer"
                          title="نسخ الصورة للحافظة للصقها مباشرة في واتساب أو أي برنامج"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                          <span>نسخ</span>
                        </button>
                        <button
                          onClick={() => handleDownloadImages('front')}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-bold border border-blue-200 dark:border-blue-800 transition flex items-center gap-1 cursor-pointer"
                          title="تحميل صورة الوجه الأمامي"
                        >
                          <Download className="w-3 h-3" />
                          <span>تحميل</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Back Preview */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                    <div className="w-full aspect-[430/272] bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      {backDataUrl ? (
                        <img
                          src={backDataUrl}
                          alt="الوجه الخلفي"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Sparkles className="w-6 h-6 animate-spin text-slate-400" />
                      )}
                    </div>
                    <div className="w-full flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">الوجه الخلفي</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyImageToClipboard('back')}
                          className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-600 transition flex items-center gap-1 cursor-pointer"
                          title="نسخ الصورة للحافظة للصقها مباشرة في واتساب أو أي برنامج"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                          <span>نسخ</span>
                        </button>
                        <button
                          onClick={() => handleDownloadImages('back')}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-bold border border-blue-200 dark:border-blue-800 transition flex items-center gap-1 cursor-pointer"
                          title="تحميل صورة الوجه الخلفي"
                        >
                          <Download className="w-3 h-3" />
                          <span>تحميل</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Toast Message */}
              {copyToast && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{copyToast}</span>
                </div>
              )}

              {/* Social Channels & Actions */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  طرق الإرسال والمشاركة:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* WhatsApp Direct */}
                  <button
                    id="btn_share_whatsapp"
                    onClick={handleWhatsAppShare}
                    className="p-3.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/40 text-[#128C7E] dark:text-[#25D366] rounded-2xl transition flex items-center justify-between cursor-pointer group text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-xs">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">إرسال عبر واتساب (WhatsApp)</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          {member.father_phone ? `إلى ولي الأمر (${member.father_phone})` : 'مشاركة نص وبيانات العضوية'}
                        </div>
                      </div>
                    </div>
                    <Send className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
                  </button>

                  {/* Native Device Share Sheet */}
                  <button
                    id="btn_native_share"
                    onClick={handleNativeShare}
                    className="p-3.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-2xl transition flex items-center justify-between cursor-pointer group text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">مشاركة عبر تطبيقات النظام</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          تطبيقات الهاتف (تيليجرام، فيسبوك، ماسنجر...)
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-60 group-hover:opacity-100 transition" />
                  </button>

                  {/* Download Both Images */}
                  <button
                    id="btn_download_both"
                    onClick={() => handleDownloadImages('both')}
                    className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl transition flex items-center justify-between cursor-pointer group text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">تحميل الصورتين معاً (PNG)</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          حفظ الوجه الأمامي والخلفي بجودة عالية
                        </div>
                      </div>
                    </div>
                    <Check className="w-4 h-4 opacity-60 group-hover:opacity-100 transition" />
                  </button>

                  {/* Copy Front Image to Clipboard */}
                  <button
                    id="btn_copy_front_clipboard"
                    onClick={() => handleCopyImageToClipboard('front')}
                    className="p-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl transition flex items-center justify-between cursor-pointer group text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center shadow-xs">
                        <Copy className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">نسخ الكارنيه للحافظة (Clipboard)</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          للصق المباشر (Ctrl+V) في أي محادثة
                        </div>
                      </div>
                    </div>
                    <FileImage className="w-4 h-4 opacity-60 group-hover:opacity-100 transition" />
                  </button>

                </div>
              </div>

            </div>

            {/* Share Footer */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                صيغة الملفات: PNG فائقة الدقة (2.5x Retina)
              </span>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تم
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
