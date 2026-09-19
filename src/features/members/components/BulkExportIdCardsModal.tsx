import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas-pro';
import JSZip from 'jszip';
import {
  X,
  CreditCard,
  HeartPulse,
  Award,
  Phone,
  Calendar,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Download,
  FolderDown,
  Printer,
  FileImage,
  Loader2,
  FolderCheck,
  User,
  MapPin,
} from 'lucide-react';
import { Member, BulkCardExportItem } from '../types';
import { MemberBadge } from '../../badges/types';
import { badgeService } from '../../badges/services/badgeService';
import { membersService } from '../services/membersService';
import { getPhotoUrl } from '../../../utils/photo';
import { ScoutEmblem } from './ScoutEmblem';
import { SystemSettings } from '../../settings/types';
import { settingsService } from '../../settings/services/settingsService';

interface BulkExportIdCardsModalProps {
  isOpen: boolean;
  selectedMembers: Member[];
  onClose: () => void;
  settings?: SystemSettings | null;
  onSuccess?: (message: string) => void;
}

const BLOOD_TYPES = ['O+ POS', 'A+ POS', 'B+ POS', 'AB+ POS', 'O- NEG', 'A- NEG', 'B- NEG', 'AB- NEG'] as const;

export const BulkExportIdCardsModal: React.FC<BulkExportIdCardsModalProps> = ({
  isOpen,
  selectedMembers,
  onClose,
  settings: propSettings,
  onSuccess,
}) => {
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

  // Configuration options
  const [exportBothSides, setExportBothSides] = useState<boolean>(true);
  const [targetDirectory, setTargetDirectory] = useState<string>('C:\\scoutsystem\\scoutphoto');
  const [downloadZipAlso, setDownloadZipAlso] = useState<boolean>(true);

  // Status tracking
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMemberName, setCurrentMemberName] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [completedResult, setCompletedResult] = useState<{
    count: number;
    targetDir: string;
    zipDownloaded: boolean;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Card generation canvas refs
  const frontCardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);

  // Current active member being rendered on the hidden DOM stage
  const [activeMember, setActiveMember] = useState<Member | null>(null);
  const [activeQrCode, setActiveQrCode] = useState<string>('');
  const [activeBadges, setActiveBadges] = useState<MemberBadge[]>([]);

  if (!isOpen) return null;

  const captureElement = async (el: HTMLElement): Promise<string> => {
    try {
      return await toPng(el, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: true,
      });
    } catch (err) {
      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return canvas.toDataURL('image/png');
    }
  };

  const startExportProcess = async () => {
    if (selectedMembers.length === 0) {
      setErrorMessage('لا يوجد أعضاء محددين لتصدير بطاقاتهم');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setCompletedResult(null);
    setLogs([]);

    const exportedCards: BulkCardExportItem[] = [];
    const zip = new JSZip();
    const folder = zip.folder('scoutphoto');

    const total = selectedMembers.length;

    try {
      for (let i = 0; i < total; i++) {
        const m = selectedMembers[i];
        setCurrentIndex(i + 1);
        setCurrentMemberName(m.student_name);

        // 1. Generate QR Code
        const qrUrl = await QRCode.toDataURL(
          JSON.stringify({
            code: m.member_code,
            name: m.student_name,
            nid: m.national_id,
            group: scoutGroupName,
            stage: m.school_stage,
          }),
          { margin: 1, width: 256, color: { dark: '#0b3d22', light: '#ffffff' } }
        );

        // 2. Fetch member badges
        let mBadges: MemberBadge[] = [];
        try {
          mBadges = await badgeService.getMemberBadges(m.id);
        } catch {}

        // Set state to update the hidden card templates
        setActiveMember(m);
        setActiveQrCode(qrUrl);
        setActiveBadges(mBadges);

        // Allow DOM to re-render the card frames
        await new Promise((r) => setTimeout(r, 120));

        let frontBase64 = '';
        let backBase64 = '';

        if (frontCardRef.current) {
          frontBase64 = await captureElement(frontCardRef.current);
        }

        if (exportBothSides && backCardRef.current) {
          backBase64 = await captureElement(backCardRef.current);
        }

        exportedCards.push({
          member_id: m.id,
          student_name: m.student_name,
          member_code: m.member_code || `sc${String(m.id).padStart(6, '0')}`,
          front_base64: frontBase64,
          back_base64: backBase64 || undefined,
        });

        // Add to ZIP archive
        const cleanName = (m.student_name || 'عضو').replace(/[/\\?%*:|"<>]/g, '_').trim();
        const cleanCode = (m.member_code || `sc${String(m.id).padStart(6, '0')}`).replace(/[/\\?%*:|"<>]/g, '_').trim();

        if (frontBase64 && folder) {
          const frontRaw = frontBase64.replace(/^data:image\/\w+;base64,/, '');
          folder.file(`${cleanCode}_${cleanName}_وجه.png`, frontRaw, { base64: true });
        }
        if (backBase64 && folder) {
          const backRaw = backBase64.replace(/^data:image\/\w+;base64,/, '');
          folder.file(`${cleanCode}_${cleanName}_ظهر.png`, backRaw, { base64: true });
        }

        setLogs((prev) => [
          ...prev,
          `تم بنجاح تجهيز كارنيه: ${m.student_name} (${cleanCode})`,
        ]);
      }

      // Send to server to write directly to C:\scoutsystem\scoutphoto
      const serverRes = await membersService.bulkExportCards(exportedCards, targetDirectory);

      // Trigger ZIP download in browser as well
      let zipDownloaded = false;
      if (downloadZipAlso) {
        const content = await zip.generateAsync({ type: 'blob' });
        const blobUrl = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `كارنيهات_الكشافة_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        zipDownloaded = true;
      }

      setCompletedResult({
        count: exportedCards.length,
        targetDir: serverRes.target_directory || targetDirectory,
        zipDownloaded,
      });

      if (onSuccess) {
        onSuccess(`تم تصدير ${exportedCards.length} كارنيه بنجاح إلى (${serverRes.target_directory || targetDirectory})`);
      }
    } catch (err: any) {
      console.error('Bulk export error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء تصدير الكارنيهات');
    } finally {
      setIsProcessing(false);
    }
  };

  const curCondition = activeMember?.medical_condition || '';
  const curBlood = BLOOD_TYPES.find((b) => curCondition.toUpperCase().includes(b.split(' ')[0])) || 'O+ POS';
  const curYear = new Date().getFullYear();
  const curFormattedCode = activeMember?.member_code || (activeMember ? `SC-${curYear}-${String(activeMember.id).padStart(4, '0')}` : '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto text-right flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <FolderDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">
                تصدير وطباعة كارنيهات الأعضاء المحددة
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                توليد بطاقات CR80 عالية الدقة وحفظها في المجلد المخصص
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {completedResult ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  تم التصدير بنجاح!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  تم حفظ صور كارنيهات عدد <b>({completedResult.count})</b> عضو بدقة عالية (PNG).
                </p>
              </div>

              {/* Target path display box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-right space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <FolderCheck className="w-4 h-4 text-emerald-600" />
                  <span>المسار المحفوظ على الجهاز:</span>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold select-all dir-ltr text-left">
                  {completedResult.targetDir}
                </div>
                {completedResult.zipDownloaded && (
                  <p className="text-[11px] text-slate-500">
                    • تم أيضاً تنزيل أرشيف مضغوط (ZIP) تلقائياً يحتوي على كافة البطاقات.
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Selected Count Notice */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    {selectedMembers.length}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      عدد الأعضاء المحددين للتصدير
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      سيتم تصدير بطاقة كارنيه لكل عضو مسجل
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                  دقة 2.5x Retina
                </span>
              </div>

              {/* Settings / Options */}
              <div className="space-y-3.5">
                {/* Target Path Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    المسار المستهدف على الجهاز لحفظ الصور:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={targetDirectory}
                      onChange={(e) => setTargetDirectory(e.target.value)}
                      disabled={isProcessing}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dir-ltr text-left"
                      placeholder="C:\scoutsystem\scoutphoto"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                    المسار الافتراضي المطلوب: <b>C:\scoutsystem\scoutphoto</b>
                  </span>
                </div>

                {/* Toggles */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportBothSides}
                      onChange={(e) => setExportBothSides(e.target.checked)}
                      disabled={isProcessing}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>تصدير الوجهين معاً (الوجه الأمامي + الوجه الخلفي مع الأوسمة والطوارئ)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={downloadZipAlso}
                      onChange={(e) => setDownloadZipAlso(e.target.checked)}
                      disabled={isProcessing}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>تنزيل نسخة كملف مضغوط (ZIP) على المتصفح تلقائياً</span>
                  </label>
                </div>
              </div>

              {/* Progress Indicator */}
              {isProcessing && (
                <div className="space-y-2.5 p-4 bg-slate-900 text-white rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      جاري معالجة الكارنيهات ({currentIndex} من {selectedMembers.length})...
                    </span>
                    <span className="font-mono text-blue-300 font-bold">
                      {Math.round((currentIndex / selectedMembers.length) * 100)}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-200"
                      style={{ width: `${(currentIndex / selectedMembers.length) * 100}%` }}
                    ></div>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate">
                    العضو الحالي: <strong className="text-white">{currentMemberName}</strong>
                  </p>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        {!completedResult && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={startExportProcess}
              disabled={isProcessing || selectedMembers.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التصدير...</span>
                </>
              ) : (
                <>
                  <FolderDown className="w-4 h-4" />
                  <span>بدء التصدير إلى ({targetDirectory})</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* HIDDEN OFF-SCREEN STAGE FOR HIGH-RES HTML CAPTURE                         */}
      {/* Rendered only when an active member is being captured                     */}
      {/* ========================================================================= */}
      {activeMember && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            opacity: 1,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          {/* 1. FRONT FACE */}
          <div
            ref={frontCardRef}
            id="bulk-capture-front"
            className="relative bg-white text-slate-900 rounded-[18px] border border-slate-300 shadow-xl overflow-hidden select-none"
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
            {/* Background Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <ScoutEmblem
                watermark={true}
                size={240}
                className="opacity-18"
                logoUrl={scoutLogoUrl}
                groupName={scoutGroupName}
                groupNameEn={scoutGroupNameEn}
              />
            </div>

            {/* Front Card Content */}
            <div className="relative z-10 w-full h-full p-3.5 flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/40">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-amber-500/40 shadow-xs flex items-center justify-center shrink-0">
                    <ScoutEmblem
                      size={28}
                      logoUrl={scoutLogoUrl}
                      groupName={scoutGroupName}
                      groupNameEn={scoutGroupNameEn}
                    />
                  </div>
                  <div className="text-right">
                    <h4 className="text-[#0b4d2c] font-black text-[12px] leading-tight drop-shadow-2xs">
                      {scoutGroupName}
                    </h4>
                    <p className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">
                      {scoutGroupNameEn}
                    </p>
                  </div>
                </div>

                <div className="text-left">
                  <span className="bg-[#13492c] text-[#f7d67b] text-[8px] font-black px-2 py-0.5 rounded-full border border-[#f7d67b]/50 tracking-wider">
                    بطاقة هوية كشفية معتمدة
                  </span>
                </div>
              </div>

              {/* Center Body */}
              <div className="flex items-center justify-between my-auto py-1">
                {/* Details Column */}
                <div className="flex-1 text-right pr-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold text-slate-500">فصيلة الدم:</span>
                    <span className="bg-[#ffe4e6] text-[#b91c1c] text-[11px] font-black font-mono px-2.5 py-0.5 rounded-[6px] border border-[#fecdd3] shadow-xs">
                      {curBlood}
                    </span>
                  </div>

                  <h2 className="text-[#13492c] font-black text-[21px] leading-tight tracking-tight drop-shadow-2xs">
                    {activeMember.student_name}
                  </h2>

                  <p className="text-[#475569] text-[11.5px] font-bold mt-1 flex items-center gap-1">
                    <span>عشيرة {activeMember.tribe_name || 'النصر'}</span>
                    <span className="text-slate-300">•</span>
                    <span>
                      {activeMember.member_type === 'قائد'
                        ? 'قائد كشفي معتمد'
                        : activeMember.school_stage || 'كشاف متقدم'}
                    </span>
                  </p>

                  <div className="mt-2">
                    <span className="text-[9.5px] text-[#64748b] font-bold block">
                      رقم العضوية الكشفية
                    </span>
                    <span className="text-[#0f3d24] text-[19px] font-mono font-black tracking-wider block">
                      {curFormattedCode}
                    </span>
                  </div>
                </div>

                {/* Member Photo */}
                <div className="flex flex-col items-center shrink-0 ml-1">
                  <div className="w-[94px] h-[116px] rounded-xl overflow-hidden border-2 border-[#caa455] bg-[#f8fafc] shadow-md relative">
                    {activeMember.photo_path ? (
                      <img
                        src={getPhotoUrl(activeMember.photo_path)}
                        alt={activeMember.student_name}
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
                  <div className="bg-[#0b4d2c] text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center gap-1.5 shadow-xs mt-1.5 w-[94px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{activeMember.member_type === 'قائد' ? 'قائد نشط' : 'عضو نشط'}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-xs flex items-center justify-center">
                    <div className="w-full h-full rounded-full border border-amber-600/40 bg-amber-400/90 flex items-center justify-center">
                      <Award className="w-4 h-4 text-amber-950" />
                    </div>
                  </div>

                  <div className="w-8 h-8 bg-white p-0.5 rounded-md border border-slate-300 flex items-center justify-center shadow-xs">
                    {activeQrCode ? (
                      <img src={activeQrCode} alt="QR" className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-slate-100"></div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                      EXPIRES / الانتهاء
                    </span>
                    <span className="text-[12px] font-mono font-black text-slate-800 block text-left">
                      08/25
                    </span>
                  </div>

                  <div className="border-r border-slate-200 pr-3">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                      VALID FROM / صالح من
                    </span>
                    <span className="text-[12px] font-mono font-black text-slate-800 block text-left">
                      09/24
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#b58e38] via-[#f7d67b] to-[#b58e38]"></div>
            </div>
          </div>

          {/* 2. BACK FACE */}
          <div
            ref={backCardRef}
            id="bulk-capture-back"
            className="relative bg-white text-slate-900 rounded-[18px] border border-slate-300 shadow-xl overflow-hidden select-none"
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
            {/* Background Watermark */}
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

            <div className="relative z-10 w-full h-full p-3.5 flex flex-col justify-between">
              {/* Header */}
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
                  {curFormattedCode}
                </span>
              </div>

              {/* Middle Badges and Contacts */}
              <div className="space-y-1.5 text-right my-auto">
                <div className="bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-amber-950 flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-600" />
                      الأوسمة والشارات المكتسبة:
                    </span>
                    <span className="text-[8px] font-bold text-amber-800">
                      {activeBadges.length > 0 ? `${activeBadges.length} أوسمة مسجلة` : 'سجل قيد التدريب'}
                    </span>
                  </div>

                  {activeBadges.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap max-h-[34px] overflow-hidden">
                      {activeBadges.slice(0, 4).map((b) => (
                        <span
                          key={b.award_id}
                          className="bg-white text-slate-800 text-[8px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 shadow-2xs"
                        >
                          <span className="text-amber-600">{b.icon || '🏅'}</span>
                          <span>{b.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[8.5px] text-slate-500 italic">
                      عضو نشط في مرحلة التأهيل الكشفي واجتياز الشارات.
                    </p>
                  )}
                </div>

                {/* Medical Condition */}
                <div className="bg-rose-50/85 p-1.5 rounded-lg border border-rose-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-rose-950 flex items-center gap-1">
                      <HeartPulse className="w-3 h-3 text-rose-600" />
                      الحالة الصحية:
                    </span>
                    <span className="text-[8.5px] font-black font-mono text-rose-700 bg-white px-1.5 py-0.2 rounded border border-rose-300">
                      فصيلة: {curBlood}
                    </span>
                  </div>
                  <p className="text-[8.5px] text-slate-700 font-medium mt-0.5 line-clamp-1">
                    {activeMember.medical_condition
                      ? activeMember.medical_condition
                      : 'سليم طبياً - لا توجد حساسيات دوائية مسجلة'}
                  </p>
                </div>

                {/* Emergency Contacts */}
                <div className="bg-slate-50/90 p-1.5 rounded-lg border border-slate-200">
                  <span className="text-[9px] font-black text-slate-800 flex items-center gap-1 mb-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    أرقام الطوارئ:
                  </span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ولي الأمر:</span>
                      <span className="font-mono font-bold text-slate-900 dir-ltr">
                        {activeMember.father_phone || activeMember.mother_phone || 'غير مسجل'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">هاتف القائد:</span>
                      <span className="font-mono font-bold text-slate-900 dir-ltr">
                        {activeMember.leader_phone || '01000000000'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Bar */}
              <div className="pt-1.5 border-t border-slate-200/90 flex items-end justify-between text-[7px] text-slate-500">
                <div className="max-w-[270px] leading-tight">
                  <p className="font-semibold text-slate-600">
                    هذه البطاقة وثيقة كشفية رسمية. يرجى إبرازها أثناء المخيمات والأنشطة.
                  </p>
                </div>
                <div className="text-left font-mono font-bold text-[8px] text-slate-700">
                  <span>*SCT-ID-{activeMember.id}*</span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#b58e38] via-[#f7d67b] to-[#b58e38]"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
