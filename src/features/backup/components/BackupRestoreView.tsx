import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  FileCheck,
  FileSpreadsheet,
  HardDrive,
  CheckCircle2,
  FileText,
  Users,
  ShieldCheck,
  Info,
  RefreshCw,
  Image,
  Package,
  Archive,
  Layers,
  Sparkles,
} from 'lucide-react';
import { backupService } from '../services/backupService';
import { User } from '../../auth/types';

interface BackupRestoreViewProps {
  user: User;
  onSuccess: (msg: string) => void;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({ user, onSuccess }) => {
  // Batch Import (CSV / Excel)
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    count: number;
    skippedCount: number;
    skippedDetails?: string[];
    downloadedPhotosCount?: number;
  } | null>(null);

  // Full System State (.zip)
  const [fullSystemFile, setFullSystemFile] = useState<File | null>(null);
  const [showFullSystemConfirm, setShowFullSystemConfirm] = useState(false);

  // SQLite State
  const [sqliteFile, setSqliteFile] = useState<File | null>(null);
  const [showSqliteConfirm, setShowSqliteConfirm] = useState(false);

  // Excel State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [showExcelConfirm, setShowExcelConfirm] = useState(false);

  // Persistent Backup Status
  const [backupStatus, setBackupStatus] = useState<{
    totalMembers: number;
    totalTribes: number;
    hasSnapshot: boolean;
    snapshotCount: number;
    snapshotDate: string | null;
    hasBackupExcel: boolean;
  } | null>(null);
  const [reapplying, setReapplying] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user.role === 'ADMIN';

  const loadStatus = () => {
    backupService
      .getBackupStatus()
      .then((st) => setBackupStatus(st))
      .catch(() => {});
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleReapplyLastBackup = async () => {
    if (!isAdmin) return;
    setReapplying(true);
    setError(null);
    try {
      const res = await backupService.reapplyLastBackup();
      onSuccess(res.message || 'تمت إعادة تطبيق النسخة المحفوظة بنجاح');
      loadStatus();
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'تعذرت استعادة النسخة المحفوظة');
    } finally {
      setReapplying(false);
    }
  };

  // 1. CSV Template Download
  const handleDownloadCsvTemplate = () => {
    const url = backupService.getCsvTemplateUrl();
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Scout_Members_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccess('تم تنزيل نموذج CSV فارغ بنجاح');
  };

  // 2. CSV Members Export Download
  const handleDownloadCsvMembers = () => {
    const url = backupService.getCsvExportUrl();
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Scout_Members_Export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccess('تم تنزيل معلومات الأعضاء في ملف CSV بنجاح');
  };

  // 3. Batch Members Import (CSV / Excel)
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        setError('يرجى اختيار ملف بصيغة CSV أو Excel (.xlsx)');
        setImportFile(null);
        return;
      }
      setImportFile(file);
      setError(null);
      setImportResult(null);
    }
  };

  const handleExecuteBatchImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const res = await backupService.batchImportMembers(importFile);
      setImportResult({
        count: res.count,
        skippedCount: res.skippedCount,
        skippedDetails: res.skippedDetails,
        downloadedPhotosCount: res.downloadedPhotosCount,
      });
      onSuccess(res.message || `تم استيراد وإضافة ${res.count} عضو بنجاح`);
      setImportFile(null);
    } catch (err: any) {
      setError(err.message || 'فشلت عملية استيراد الأعضاء من الملف');
    } finally {
      setImportLoading(false);
    }
  };

  // Full System ZIP Backup Download
  const handleDownloadFullSystemBackup = () => {
    const url = backupService.getFullSystemBackupDownloadUrl();
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccess('بدأ تجهيز وتحميل النسخة الاحتياطية الشاملة للنظام (قاعدة البيانات + صور الأعضاء وشعار المجموعة)');
  };

  // SQLite Download
  const handleDownloadSqliteBackup = () => {
    const url = backupService.getBackupDownloadUrl();
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccess('بدأ تحميل النسخة الاحتياطية لقاعدة البيانات (scout.db)');
  };

  // Excel Full Backup Download
  const handleDownloadExcelBackup = () => {
    const url = backupService.getExcelBackupDownloadUrl();
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccess('بدأ تحميل النسخة الاحتياطية الكاملة بصيغة Excel (.xlsx)');
  };

  // Full System ZIP File Select
  const handleFullSystemFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.zip') && !lower.endsWith('.db') && !lower.endsWith('.sqlite')) {
        setError('يرجى اختيار ملف نسخة احتياطية شاملة بصيغة .zip أو .db');
        setFullSystemFile(null);
        return;
      }
      setFullSystemFile(file);
      setError(null);
    }
  };

  // Full System Restore Execute
  const handleExecuteFullSystemRestore = async () => {
    if (!fullSystemFile) return;
    setLoading(true);
    setError(null);

    try {
      const res = await backupService.restoreFullSystemBackup(fullSystemFile);
      onSuccess(res.message || 'تم استعادة النظام بالكامل بنجاح');
      setShowFullSystemConfirm(false);
      setFullSystemFile(null);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'فشلت عملية استعادة النسخة الاحتياطية الشاملة');
    } finally {
      setLoading(false);
    }
  };

  // SQLite File Select
  const handleSqliteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
        setError('يرجى اختيار ملف قاعدة بيانات بصيغة .db فقط');
        setSqliteFile(null);
        return;
      }
      setSqliteFile(file);
      setError(null);
    }
  };

  // Excel File Select
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('يرجى اختيار ملف Excel بصيغة .xlsx فقط');
        setExcelFile(null);
        return;
      }
      setExcelFile(file);
      setError(null);
    }
  };

  // SQLite Restore Execute
  const handleExecuteSqliteRestore = async () => {
    if (!sqliteFile) return;
    setLoading(true);
    setError(null);

    try {
      const res = await backupService.restoreBackup(sqliteFile);
      onSuccess(res.message || 'تم استعادة النسخة الاحتياطية بنجاح');
      setShowSqliteConfirm(false);
      setSqliteFile(null);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'فشلت عملية استعادة النسخة الاحتياطية');
    } finally {
      setLoading(false);
    }
  };

  // Excel Restore Execute
  const handleExecuteExcelRestore = async () => {
    if (!excelFile) return;
    setLoading(true);
    setError(null);

    try {
      const res = await backupService.restoreExcelBackup(excelFile);
      onSuccess(res.message || 'تم استعادة واستيراد بيانات Excel بنجاح');
      setShowExcelConfirm(false);
      setExcelFile(null);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'فشلت عملية استعادة بيانات Excel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
              <Database className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">النسخ الاحتياطي واستعادة البيانات</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تنزيل نماذج CSV، استيراد الأعضاء دفعة واحدة، والنسخ الاحتياطي لقاعدة البيانات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              صلاحية الحساب: {isAdmin ? 'مدير النظام (ADMIN)' : 'مدخل بيانات (DATA ENTRY)'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-xs font-bold">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 0: FULL SYSTEM BACKUP & RESTORE (.ZIP BUNDLE)         */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg space-y-5 border border-emerald-500/30 relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-700/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">النسخة الاحتياطية الشاملة لكامل النظام (Full System Backup .ZIP)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  موصى بها
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                تحفظ وتسترد النظام بالكامل: قاعدة البيانات بكافة تفاصيلها (الأعضاء وحالاتهم، القادة، العشائر، الاشتراكات والرسوم، المحافظ المالية، الأوسمة، سجلات العمليات) بالإضافة إلى <strong>مجلد الصور الشخصية وشعار المجموعة الكشفية</strong>.
              </p>
            </div>
          </div>
          {!isAdmin && (
            <span className="text-[11px] text-amber-300 bg-amber-950/60 px-3 py-1 rounded-lg border border-amber-500/40">
              استعادة النظام الشاملة مخصصة لمدير النظام
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Download Full Backup ZIP */}
          <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700/80 flex flex-col justify-between hover:border-emerald-500/50 transition">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">تصدير وتحميل حزمة النظام الشاملة</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  يقوم السيرفر بإنشاء ملف مضغوط (<span className="font-mono text-emerald-300 font-bold">.zip</span>) يحتوي على:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>ملف قاعدة البيانات الكامل (<span className="font-mono text-slate-200">scout.db</span>) بجميع الجداول.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>مجلد الصور المرفوعة وشعار المجموعة الكشفية (<span className="font-mono text-slate-200">photos/</span>).</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>تقرير وإحصائيات النظام (<span className="font-mono text-slate-200">manifest.json</span>).</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              id="btn_download_full_system_backup"
              onClick={handleDownloadFullSystemBackup}
              className="mt-5 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل النسخة الاحتياطية الشاملة (.zip)</span>
            </button>
          </div>

          {/* Card 2: Restore Full Backup ZIP */}
          <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700/80 flex flex-col justify-between hover:border-amber-500/50 transition">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">استعادة النظام الشاملة على أي جهاز أو سيرفر فارغ</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  ارفع ملف النسخة الاحتياطية (<span className="font-mono text-amber-300 font-bold">.zip</span> أو <span className="font-mono text-amber-300 font-bold">.db</span>) ليتم استرداد كافة البيانات والصور والشعار دفعة واحدة.
                </p>
              </div>

              <div>
                <input
                  id="input_restore_full_system_file"
                  type="file"
                  accept=".zip,.db,.sqlite"
                  disabled={!isAdmin}
                  onChange={handleFullSystemFileChange}
                  className="w-full text-xs text-slate-400 disabled:opacity-50 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600 cursor-pointer"
                />
              </div>

              {fullSystemFile && (
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 flex items-center gap-2 text-xs text-slate-200 font-mono">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{fullSystemFile.name} ({(fullSystemFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            <button
              id="btn_open_full_system_restore_confirm"
              disabled={!fullSystemFile || !isAdmin}
              onClick={() => setShowFullSystemConfirm(true)}
              className="mt-5 w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>استعادة النظام بالكامل من الملف</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: CSV DOWNLOAD SECTION (MATCHING SCREENSHOT 12.png) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black text-slate-900">تحميل ملف CSV</h3>
          </div>
          <span className="text-[11px] text-slate-400">ملفات متوافقة مع Excel باللغة العربية (UTF-8)</span>
        </div>

        {/* Buttons (Exact UI representation matching the screenshot) */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Button 1: Download Empty CSV Template */}
          <button
            id="btn_download_csv_template"
            onClick={handleDownloadCsvTemplate}
            className="w-full sm:w-auto flex-1 py-3 px-5 bg-white hover:bg-slate-50 active:bg-slate-100 text-blue-600 border border-slate-200 rounded-xl shadow-xs transition text-xs font-bold flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span>تنزيل نموذج CSV فارغ</span>
            <Download className="w-4 h-4 text-blue-600 shrink-0" />
          </button>

          {/* Button 2: Download User Info in CSV */}
          <button
            id="btn_download_csv_users"
            onClick={handleDownloadCsvMembers}
            className="w-full sm:w-auto flex-1 py-3 px-5 bg-white hover:bg-slate-50 active:bg-slate-100 text-blue-600 border border-slate-200 rounded-xl shadow-xs transition text-xs font-bold flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span>تنزيل معلومات المستخدم في ملف CSV</span>
            <Download className="w-4 h-4 text-blue-600 shrink-0" />
          </button>
        </div>

        {/* Upload & Batch Import Box */}
        <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/70 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-black text-slate-800">
              رفع ملف CSV / Excel لإضافة مجموعة أعضاء دفعة واحدة
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
            قم بتعبئة نموذج CSV المفرغ ببيانات الأعضاء ثم ارفعه هنا. سيقوم النظام بالتحقق التلقائي من الأرقام القومية، وإنشاء الأكواد التسلسلية، وإضافتهم فوراً دفعة واحدة.
          </p>
          <div className="mb-3 p-2.5 bg-blue-50/80 border border-blue-100 rounded-lg text-[11px] text-blue-900 flex items-start gap-2">
            <Image className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>دعم استرداد الصور تلقائياً:</strong> يحتوي النموذج على عامود <code>رابط الصورة</code>. يمكنك وضع روابط الصور المباشرة أو روابط مشاركة Google Drive وسيقوم النظام بتنزيلها وحفظها محلياً للأعضاء تلقائياً.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:flex-1">
              <input
                id="input_batch_import_file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImportFileChange}
                className="w-full text-xs text-slate-600 file:mr-0 file:ml-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-slate-700 file:border file:border-slate-300 hover:file:bg-slate-100 cursor-pointer"
              />
            </div>

            <button
              id="btn_execute_batch_import"
              disabled={!importFile || importLoading}
              onClick={handleExecuteBatchImport}
              className="w-full sm:w-auto py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{importLoading ? 'جاري الاستيراد والإضافة...' : 'رفع وإضافة الأعضاء دفعة واحدة'}</span>
            </button>
          </div>

          {importFile && (
            <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2 text-xs text-slate-700 font-mono">
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">الملف المحدد: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          {/* Import Result Notification */}
          {importResult && (
            <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تمت إضافة {importResult.count} عضو جديد بنجاح إلى قاعدة البيانات!</span>
              </div>
              {importResult.downloadedPhotosCount !== undefined && importResult.downloadedPhotosCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100/70 py-1 px-2.5 rounded-lg w-fit font-bold">
                  <Image className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم استرداد وحفظ ({importResult.downloadedPhotosCount}) صورة شخصية محلياً بنجاح من الروابط المرفقة</span>
                </div>
              )}
              {importResult.skippedCount > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60 text-slate-700">
                  <p className="font-bold text-amber-800 mb-1">
                    تم تخطي ({importResult.skippedCount}) صف لأسباب تتعلق بالتحقق أو التكرار:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 max-h-28 overflow-y-auto">
                    {importResult.skippedDetails?.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: EXCEL BACKUP & RESTORE (.XLSX)                     */}
      {/* ============================================================ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-black text-slate-900">النسخ الاحتياطي الكامل عبر جداول Excel (.xlsx)</h3>
          </div>
          {!isAdmin && (
            <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
              الاستعادة الشاملة تتطلب حساب مدير النظام
            </span>
          )}
        </div>

        {/* Persistence Status & Quick Reapply */}
        {backupStatus && (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <span className="font-bold text-slate-800">
                  قاعدة البيانات النشطة: {backupStatus.totalMembers} عضو مسجل، {backupStatus.totalTribes} عشيرة
                </span>
                {backupStatus.hasSnapshot && (
                  <span className="block text-[11px] text-emerald-800 font-medium mt-0.5">
                    تم تأمين نسخة حفظ دائم تضم ({backupStatus.snapshotCount}) عضو على القرص الصلب
                  </span>
                )}
              </div>
            </div>

            {(backupStatus.hasBackupExcel || backupStatus.hasSnapshot) && isAdmin && (
              <button
                type="button"
                id="btn_reapply_last_backup"
                disabled={reapplying}
                onClick={handleReapplyLastBackup}
                className="py-1.5 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reapplying ? 'animate-spin' : ''}`} />
                <span>{reapplying ? 'جاري الاستعادة...' : 'إعادة تطبيق أحدث نسخة محفوظة'}</span>
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Excel Export */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">تصدير نسخة احتياطية بصيغة Excel</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                يقوم النظام بتوليد ملف Excel متكامل ومبوب يحتوي على صفحات مصنفة بدقة:
                <span className="block mt-1 font-bold text-emerald-800">
                  (ورقة مصنفة للأعضاء + ورقة مستقلة للقادة برقم التليفون + ورقة العشائر + ورقة سجل العمليات)
                </span>
              </p>
            </div>

            <button
              id="btn_download_excel_backup"
              disabled={!isAdmin}
              onClick={handleDownloadExcelBackup}
              className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل ملف Excel النسخة الكاملة (.xlsx)</span>
            </button>
          </div>

          {/* Excel Import */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">استعادة قاعدة البيانات من ملف Excel كامل</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                استعادة وإعادة ضبط قاعدة البيانات وتعبئة الأعضاء والعشائر من ملف Excel تم تصديره سابقاً من النظام.
              </p>

              <div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={!isAdmin}
                  onChange={handleExcelFileChange}
                  className="w-full text-xs text-slate-500 disabled:opacity-50 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              {excelFile && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-xs text-slate-700 font-mono">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{excelFile.name}</span>
                </div>
              )}
            </div>

            <button
              disabled={!excelFile || !isAdmin}
              onClick={() => setShowExcelConfirm(true)}
              className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>استعادة وتطبيق من Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: SQLITE RAW BACKUP & RESTORE (.DB)                  */}
      {/* ============================================================ */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-black text-slate-900">نسخ احتياطي واستعادة قاعدة بيانات SQLite الأصلية (.db)</h3>
          </div>
          {!isAdmin && (
            <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
              مخصص لمدير النظام (ADMIN)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* SQLite Export */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                <Download className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">تحميل ملف SQLite المباشر</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                نسخة ثنائية متطابقة من ملف قاعدة البيانات <span className="font-mono font-bold text-slate-700">scout.db</span>
              </p>
            </div>

            <button
              id="btn_create_backup"
              disabled={!isAdmin}
              onClick={handleDownloadSqliteBackup}
              className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل قاعدة البيانات (.db)</span>
            </button>
          </div>

          {/* SQLite Restore */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
                <Upload className="w-5 h-5 text-amber-700" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">استعادة ملف SQLite</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                استبدال قاعدة البيانات بملف <span className="font-mono">.db</span> سابق.
              </p>

              <div>
                <input
                  id="input_restore_file"
                  type="file"
                  accept=".db,.sqlite"
                  disabled={!isAdmin}
                  onChange={handleSqliteFileChange}
                  className="w-full text-xs text-slate-500 disabled:opacity-50 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              {sqliteFile && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-xs text-slate-700 font-mono">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{sqliteFile.name}</span>
                </div>
              )}
            </div>

            <button
              id="btn_open_restore_confirm"
              disabled={!sqliteFile || !isAdmin}
              onClick={() => setShowSqliteConfirm(true)}
              className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>استعادة ملف SQLite</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Full System Restore (.ZIP) */}
      {showFullSystemConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center animate-scale-in">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">تأكيد استعادة النظام الشاملة</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              أنت على وشك استبدال واسترجاع كافة بيانات النظام والصور من الملف:{' '}
              <span className="font-mono font-bold text-slate-900 block mt-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                {fullSystemFile?.name}
              </span>
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-right text-xs text-amber-900 mb-5 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ماذا سيحدث أثناء عملية الاستعادة:</span>
              </p>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5 pr-2">
                <li>استبدال قاعدة البيانات بكافة الجداول (الأعضاء، القادة، العشائر، الرسوم، المحافظ).</li>
                <li>استخراج كافة الصور والشعارات المحفوظة في ملف الـ ZIP وتحديث مجلد الصور.</li>
                <li>إعادة تحميل قاعدة البيانات النشطة وتحديث شاشات التطبيق تلقائياً.</li>
              </ul>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold text-right flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn_confirm_full_system_restore"
                disabled={loading}
                onClick={handleExecuteFullSystemRestore}
                className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs shadow-sm cursor-pointer"
              >
                {loading ? 'جاري استعادة النظام...' : 'تأكيد واستعادة النظام كاملاً'}
              </button>
              <button
                id="btn_cancel_full_system_restore"
                disabled={loading}
                onClick={() => { setShowFullSystemConfirm(false); setError(null); }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: SQLite */}
      {showSqliteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center animate-scale-in">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">تأكيد استعادة ملف قاعدة بيانات SQLite</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              هل أنت متأكد من استبدال قاعدة البيانات بالملف{' '}
              <span className="font-mono font-bold text-slate-900">{sqliteFile?.name}</span>؟
            </p>
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold text-right flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn_confirm_restore"
                disabled={loading}
                onClick={handleExecuteSqliteRestore}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer"
              >
                {loading ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}
              </button>
              <button
                id="btn_cancel_restore"
                disabled={loading}
                onClick={() => { setShowSqliteConfirm(false); setError(null); }}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Excel */}
      {showExcelConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center animate-scale-in">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">تأكيد استعادة بيانات Excel</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              هل أنت متأكد من استعادة البيانات واستيرادها من ملف{' '}
              <span className="font-mono font-bold text-slate-900">{excelFile?.name}</span>؟
              سيتم فحص البيانات واستيراد الأعضاء والعشائر وسجلات العمليات.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold text-right flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn_confirm_excel_restore"
                disabled={loading}
                onClick={handleExecuteExcelRestore}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer"
              >
                {loading ? 'جاري الاستيراد...' : 'تأكيد الاستيراد'}
              </button>
              <button
                id="btn_cancel_excel_restore"
                disabled={loading}
                onClick={() => { setShowExcelConfirm(false); setError(null); }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
