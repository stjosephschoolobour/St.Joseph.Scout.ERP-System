import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Users,
  Award,
  HeartPulse,
  Calendar,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { ReportData, ReportTab } from '../types';
import { Member } from '../../members/types';
import { settingsService } from '../../settings/services/settingsService';
import { SystemSettings } from '../../settings/types';
import { ScoutEmblem } from '../../members/components/ScoutEmblem';

export interface ReportsViewProps {
  data: ReportData | null;
  loading: boolean;
  onViewCard: (member: Member) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ data, loading }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [settings, setSettings] = useState<SystemSettings | null>(() => {
    return settingsService.getCachedSettings();
  });

  useEffect(() => {
    const cached = settingsService.getCachedSettings();
    if (cached) {
      setSettings(cached);
    } else {
      settingsService.getSettings().then(setSettings).catch(() => {});
    }
    return settingsService.subscribe(setSettings);
  }, []);

  const scoutGroupName = settings?.scout_group_name || 'مجموعة الكشافة والمرشدات';
  const schoolName = settings?.school_name || 'مدرسة القديس يوسف بالعبور';
  const scoutGroupNameEn = settings?.scout_group_name_en;
  const scoutLogoUrl = settings?.scout_logo_url;

  if (loading || !data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <p className="text-slate-500 font-bold">جاري تحميل بيانات التقارير...</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!data.allMembers || data.allMembers.length === 0) return;

    const headers = [
      'م',
      'كود العضو',
      'اسم الطالبة (عربي)',
      'اسم الطالبة (إنجليزي)',
      'وظيفة الأب',
      'وظيفة الأم',
      'الرقم القومي',
      'تاريخ الميلاد',
      'الصف الدراسي',
      'العشيرة',
      'سنة الالتحاق',
      'الصفة',
      'العنوان',
      'الموهبة والمهارة',
      'الحالة المرضية',
      'هاتف الأب',
      'هاتف الأم',
    ];

    const rows = data.allMembers.map((m, idx) => [
      idx + 1,
      `"${m.member_code || `sc${String(m.id).padStart(6, '0')}`}"`,
      `"${m.student_name.replace(/"/g, '""')}"`,
      `"${(m.student_name_en || '').replace(/"/g, '""')}"`,
      `"${(m.father_job || '').replace(/"/g, '""')}"`,
      `"${(m.mother_job || '').replace(/"/g, '""')}"`,
      `'${m.national_id}`,
      m.birth_date,
      m.school_stage,
      `"${(m.tribe_name || '').replace(/"/g, '""')}"`,
      m.scout_join_year,
      m.member_type,
      `"${(m.address || '').replace(/"/g, '""')}"`,
      `"${(m.talents_skills || '').replace(/"/g, '""')}"`,
      `"${(m.medical_condition || '').replace(/"/g, '""')}"`,
      `'${m.father_phone || ''}`,
      `'${m.mother_phone || ''}`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Scout_Report_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Report Header & Action Buttons */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
            {scoutLogoUrl ? (
              <img
                src={scoutLogoUrl}
                alt={scoutGroupName}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ScoutEmblem size={38} groupNameEn={scoutGroupNameEn} />
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">تقارير وإحصائيات الكشافة</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {scoutGroupName} ({schoolName}) - استخراج وطباعة السجلات الرسمية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            تصدير CSV (Excel)
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير / PDF
          </button>
        </div>
      </div>

      {/* Tabs (no-print) */}
      <div className="flex flex-wrap gap-2 no-print">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          إجمالي الأعضاء
        </button>

        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'stages'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          حسب الصف الدراسي
        </button>

        <button
          onClick={() => setActiveTab('leaders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'leaders'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          تقرير القادة ({data.totalLeaders})
        </button>

        <button
          onClick={() => setActiveTab('females')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'females'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          تقرير العضوات ({data.totalFemales})
        </button>

        <button
          onClick={() => setActiveTab('medical')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'medical'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          الحالات المرضية ({data.medicalCasesCount})
        </button>

        <button
          onClick={() => setActiveTab('join_year')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'join_year'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          حسب سنة الالتحاق
        </button>
      </div>

      {/* Printable Report Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="pb-4 mb-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
              {scoutLogoUrl ? (
                <img
                  src={scoutLogoUrl}
                  alt={scoutGroupName}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ScoutEmblem size={38} groupNameEn={scoutGroupNameEn} />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {activeTab === 'summary' && 'تقرير الملخص العام لإجمالي الكشافة'}
                {activeTab === 'stages' && 'تقرير الأعضاء والقادة حسب المراحل الدراسية'}
                {activeTab === 'leaders' && 'سجل قادة وقائدات الكشافة'}
                {activeTab === 'females' && 'سجل عضوات الكشافة'}
                {activeTab === 'medical' && 'كشف الحالات المرضية الخاصة والأدوية'}
                {activeTab === 'join_year' && 'توزيع الأعضاء حسب سنوات الالتحاق'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {scoutGroupName} ({schoolName}) — تقرير رسمي معتمد
              </p>
            </div>
          </div>
          <div className="text-left text-xs text-slate-400 font-mono">
            تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>

        {/* Tab 1: Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                <p className="text-xs text-blue-700 font-bold">إجمالي الأعضاء والقادة</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{data.total}</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                <p className="text-xs text-indigo-700 font-bold">عدد العضوات</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{data.totalFemales}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
                <p className="text-xs text-amber-700 font-bold">عدد القادة</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{data.totalLeaders}</p>
              </div>
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-center">
                <p className="text-xs text-rose-700 font-bold">الحالات المرضية</p>
                <p className="text-3xl font-black text-rose-600 mt-1">{data.medicalCasesCount}</p>
              </div>
            </div>

            {/* Stages Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">الصف الدراسي</th>
                    <th className="py-3 px-4">عدد العضوات</th>
                    <th className="py-3 px-4">عدد القادة</th>
                    <th className="py-3 px-4">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(Object.entries(data.stagesBreakdown) as [string, { total: number; females: number; leaders: number }][]).map(([stage, counts]) => (
                    <tr key={stage} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{stage}</td>
                      <td className="py-3 px-4 text-indigo-700 font-semibold">{counts.females}</td>
                      <td className="py-3 px-4 text-amber-700 font-semibold">{counts.leaders}</td>
                      <td className="py-3 px-4 font-bold text-blue-800">{counts.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Stages */}
        {activeTab === 'stages' && (
          <div className="space-y-6">
            {(Object.entries(data.stagesBreakdown) as [string, { total: number; females: number; leaders: number }][]).map(([stage, counts]) => {
              const membersInStage = data.allMembers.filter((m) => m.school_stage === stage);
              return (
                <div key={stage} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                    <h4 className="font-bold text-base text-slate-900">
                      {stage} ({counts.total} عضو)
                    </h4>
                    <span className="text-xs text-slate-500 font-medium">
                      عضوات: {counts.females} | قادة: {counts.leaders}
                    </span>
                  </div>
                  {membersInStage.length === 0 ? (
                    <p className="text-xs text-slate-400">لا يوجد أعضاء مسجلين بهذه المرحلة</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold">
                          <tr>
                            <th className="py-2 px-3">الاسم</th>
                            <th className="py-2 px-3">الرقم القومي</th>
                            <th className="py-2 px-3">سنة الالتحاق</th>
                            <th className="py-2 px-3">الصفة</th>
                            <th className="py-2 px-3">تليفون ولي الأمر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {membersInStage.map((m) => (
                            <tr key={m.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{m.student_name}</td>
                              <td className="py-2 px-3 font-mono">{m.national_id}</td>
                              <td className="py-2 px-3 font-mono">{m.scout_join_year}</td>
                              <td className="py-2 px-3">{m.member_type}</td>
                              <td className="py-2 px-3 font-mono">{m.father_phone || m.mother_phone || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Leaders */}
        {activeTab === 'leaders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">اسم القائد</th>
                  <th className="py-3 px-4">الرقم القومي</th>
                  <th className="py-3 px-4">المرحلة</th>
                  <th className="py-3 px-4">سنة الالتحاق</th>
                  <th className="py-3 px-4">رقم الهاتف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.allMembers
                  .filter((m) => m.member_type === 'قائد')
                  .map((m, idx) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{m.student_name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{m.national_id}</td>
                      <td className="py-3 px-4">{m.school_stage}</td>
                      <td className="py-3 px-4 font-mono">{m.scout_join_year}</td>
                      <td className="py-3 px-4 font-mono text-xs">{m.father_phone || m.mother_phone || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Females */}
        {activeTab === 'females' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">اسم العضوة</th>
                  <th className="py-3 px-4">رقم الهاتف</th>
                  <th className="py-3 px-4">الرقم القومي</th>
                  <th className="py-3 px-4">المرحلة</th>
                  <th className="py-3 px-4">سنة الالتحاق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.allMembers
                  .filter((m) => m.member_type === 'عضوة')
                  .map((m, idx) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{m.student_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{m.father_phone || m.mother_phone || '-'}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{m.national_id}</td>
                      <td className="py-3 px-4">{m.school_stage}</td>
                      <td className="py-3 px-4 font-mono">{m.scout_join_year}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: Medical Cases */}
        {activeTab === 'medical' && (
          <div>
            {data.medicalCases.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <HeartPulse className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-600">لا توجد حالات مرضية مسجلة بين الأعضاء</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-red-50 text-red-900 text-xs font-bold border-b border-red-200">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">الاسم</th>
                      <th className="py-3 px-4">المرحلة</th>
                      <th className="py-3 px-4">الصفة</th>
                      <th className="py-3 px-4">الحالة المرضية / الإرشادات</th>
                      <th className="py-3 px-4">تليفون الطوارئ (الأب / الأم)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {data.medicalCases.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-red-50/50">
                        <td className="py-3 px-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{m.student_name}</td>
                        <td className="py-3 px-4">{m.school_stage}</td>
                        <td className="py-3 px-4">{m.member_type}</td>
                        <td className="py-3 px-4 font-bold text-red-700">{m.medical_condition}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">
                          {m.father_phone && <div>الأب: {m.father_phone}</div>}
                          {m.mother_phone && <div>الأم: {m.mother_phone}</div>}
                          {!m.father_phone && !m.mother_phone && '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Join Year */}
        {activeTab === 'join_year' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(data.joinYearBreakdown)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([year, count]) => (
                <div key={year} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 font-bold">دفعة عام {year}</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{count} عضو</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
