import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  FileText,
  User,
  Clock,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit,
  PlusCircle,
  Database,
  LogIn,
  LogOut,
} from 'lucide-react';
import { AuditLogItem } from '../types';

interface AuditLogViewProps {
  logs: AuditLogItem[];
  loading: boolean;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs, loading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter((item) => {
    const matchesSearch =
      !searchTerm.trim() ||
      item.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.member_name && item.member_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.details && item.details.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = actionFilter === 'ALL' || item.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: AuditLogItem['action']) => {
    switch (action) {
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <LogIn className="w-3 h-3" />
            تسجيل دخول
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <LogOut className="w-3 h-3" />
            تسجيل خروج
          </span>
        );
      case 'ADD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <PlusCircle className="w-3 h-3" />
            إضافة عضو
          </span>
        );
      case 'EDIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Edit className="w-3 h-3" />
            تعديل بيانات
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <Trash2 className="w-3 h-3" />
            حذف عضو
          </span>
        );
      case 'BACKUP':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Database className="w-3 h-3" />
            نسخ احتياطي
          </span>
        );
      case 'RESTORE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <Database className="w-3 h-3" />
            استعادة بيانات
          </span>
        );
      default:
        return <span>{action}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">سجل الرقابة والعمليات (Audit Log)</h2>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل آمن وتوثيق فوري لجميع عمليات النظام مع أسماء المستخدمين وتفاصيل الإجراءات
          </p>
        </div>
        <div className="px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold">
          محمي من التعديل والحذف
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في السجل بالمستخدم أو اسم العضو أو التفاصيل..."
            className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">نوع العملية:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">جميع العمليات</option>
            <option value="LOGIN">تسجيل دخول</option>
            <option value="LOGOUT">تسجيل خروج</option>
            <option value="ADD">إضافة عضو</option>
            <option value="EDIT">تعديل بيانات</option>
            <option value="DELETE">حذف عضو</option>
            <option value="BACKUP">نسخ احتياطي</option>
            <option value="RESTORE">استعادة بيانات</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">جاري تحميل السجل...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-600">لا توجد سجلات مطابقة للبحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">المستخدم</th>
                  <th className="py-3 px-4">نوع العملية</th>
                  <th className="py-3 px-4">رقم العضو</th>
                  <th className="py-3 px-4">اسم العضو</th>
                  <th className="py-3 px-4">تفاصيل العملية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{log.id}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-mono whitespace-nowrap">
                      {log.date} {log.time}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{log.user}</td>
                    <td className="py-2.5 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {log.member_id ? `#${log.member_id}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {log.member_name || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate" title={log.details || ''}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
