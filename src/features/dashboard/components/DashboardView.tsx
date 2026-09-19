import React from 'react';
import {
  Users,
  UserCheck,
  Award,
  BookOpen,
  HeartPulse,
  ChevronLeft,
  Tent,
  CreditCard,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import { DashboardStats } from '../types';
import { User } from '../../auth/types';
import { Member } from '../../members/types';
import { WeeklyBirthdaysCard } from './WeeklyBirthdaysCard';

export interface DashboardViewProps {
  user: User;
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (view: string) => void;
  onSelectMember: (member: Member) => void;
  onLogout?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  stats,
  loading,
  onNavigate,
  onSelectMember,
}) => {
  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span className="text-xs font-bold text-emerald-700 tracking-wide uppercase">نظام إدارة الكشافة المحلي</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            مرحباً بك، {user.username}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            لوحة التحكم الرئيسية لكشافة مدرسة القديس يوسف بالعبور
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            {isAdmin ? 'مدير النظام (ADMIN)' : 'مدخل بيانات (DATA_ENTRY)'}
          </span>
        </div>
      </div>

      {/* Quick Access Banners: Subscriptions & Scout Store */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Annual Subscription Quick Access Banner */}
        <div
          onClick={() => onNavigate('subscriptions')}
          className="bg-gradient-to-r from-emerald-800 to-teal-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition group border border-emerald-700"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">الاشتراك السنوي</h3>
                <span className="text-[10px] font-bold bg-white/20 text-emerald-100 px-2 py-0.5 rounded-full">
                  موحد
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5 line-clamp-1">
                متابعة وتحصيل الاشتراكات السنوية وطباعة الإيصالات
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-200 group-hover:text-white transition shrink-0">
            <span>سجل الاشتراكات</span>
            <ChevronLeft className="w-4 h-4 transition group-hover:-translate-x-1" />
          </div>
        </div>

        {/* Scout Store Quick Access Banner */}
        <div
          onClick={() => onNavigate('store')}
          className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition group border border-slate-700"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 transition">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">متجر ومهمات الكشافة</h3>
                <span className="text-[10px] font-bold bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full">
                  قسم المتجر
                </span>
              </div>
              <p className="text-xs text-slate-300/80 mt-0.5 line-clamp-1">
                إدارة الزي الرسمي، الشارات، المقاسات المتوفرة والمخزون
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-200 group-hover:text-white transition shrink-0">
            <span>فتح المتجر</span>
            <ChevronLeft className="w-4 h-4 transition group-hover:-translate-x-1" />
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Members */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4 hover:border-slate-300 transition">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي الأعضاء</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : stats?.totalMembers || 0}
            </p>
          </div>
        </div>

        {/* Females Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4 hover:border-slate-300 transition">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200/70 text-indigo-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">عدد العضوات</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : stats?.totalFemales || 0}
            </p>
          </div>
        </div>

        {/* Leaders Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4 hover:border-slate-300 transition">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">عدد القادة</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : stats?.totalLeaders || 0}
            </p>
          </div>
        </div>

        {/* Total Tribes */}
        <div
          onClick={() => onNavigate('tribes')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4 hover:border-emerald-300 cursor-pointer transition"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0">
            <Tent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي العشائر</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">
              {loading ? '...' : stats?.totalTribes || 0}
            </p>
          </div>
        </div>

        {/* Medical Cases */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4 hover:border-slate-300 transition col-span-2 sm:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200/70 text-rose-700 flex items-center justify-center shrink-0">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">الحالات المرضية</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">
              {loading ? '...' : stats?.medicalConditionsCount || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Weekly Birthdays Card */}
      <WeeklyBirthdaysCard
        initialBirthdays={stats?.weeklyBirthdays || []}
        loading={loading}
        onSelectMember={onSelectMember}
      />

      {/* Grid: Stages Breakdown & Tribes Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              توزيع الأعضاء حسب المراحل الدراسية
            </h3>
            <span className="text-xs text-slate-400 font-medium">إحصاء فوري</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-center">
              <p className="text-xs text-slate-500 font-semibold">ابتدائي</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats?.stages?.['ابتدائي'] || 0}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-center">
              <p className="text-xs text-slate-500 font-semibold">إعدادي</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats?.stages?.['إعدادي'] || 0}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-center">
              <p className="text-xs text-slate-500 font-semibold">ثانوي</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats?.stages?.['ثانوي'] || 0}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-center">
              <p className="text-xs text-slate-500 font-semibold">أخرى</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {loading ? '...' : (stats?.stages?.['أخرى'] ?? stats?.stages?.['جامعة'] ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Tribes Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Tent className="w-4 h-4 text-emerald-700" />
              توزيع الأعضاء حسب العشيرة (Tribes Breakdown)
            </h3>
            <button
              onClick={() => onNavigate('tribes')}
              className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              عرض العشائر
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats?.tribesBreakdown && stats.tribesBreakdown.length > 0 ? (
            <div className="space-y-3">
              {stats.tribesBreakdown.slice(0, 4).map((t) => {
                const total = stats.totalMembers || 1;
                const percentage = Math.round((t.count / total) * 100);
                return (
                  <div key={t.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800">{t.name}</span>
                      <span className="text-slate-500 font-mono">
                        {t.count} عضو ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              لا توجد عشائر مسجلة حتى الآن. يمكنك إضافة عشيرة من قسم العشيرة.
            </div>
          )}
        </div>
      </div>

      {/* Recent Registrations Table */}
      {stats?.recentMembers && stats.recentMembers.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              أحدث الأعضاء المسجلين
            </h3>
            <button
              onClick={() => onNavigate('members')}
              className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">كود العضو</th>
                  <th className="py-3 px-4">اسم الطالبة</th>
                  <th className="py-3 px-4">الرقم القومي</th>
                  <th className="py-3 px-4">المرحلة</th>
                  <th className="py-3 px-4">العشيرة</th>
                  <th className="py-3 px-4">الصفة</th>
                  <th className="py-3 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">{m.member_code || `sc${String(m.id).padStart(6, '0')}`}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.student_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{m.national_id}</td>
                    <td className="py-3 px-4 text-slate-700">{m.school_stage}</td>
                    <td className="py-3 px-4 text-slate-600">{m.tribe_name || <span className="text-slate-400">غير محدد</span>}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                          m.member_type === 'قائد'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {m.member_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectMember(m)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200 cursor-pointer"
                      >
                        عرض البطاقة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
