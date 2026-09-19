import React from 'react';
import { Menu, ShieldCheck, Calendar, Moon, Sun, User as UserIcon, Bell, Clock } from 'lucide-react';
import { ViewMode } from './Sidebar';
import { User } from '../features/auth/types';
import { useTheme } from '../core/theme/ThemeContext';

interface TopHeaderProps {
  currentView: ViewMode;
  onToggleMobileMenu: () => void;
  isSidebarOpen?: boolean;
  systemName?: string;
  schoolName?: string;
  currentUser?: User | null;
  onOpenAccountSettings?: () => void;
  onOpenProfileRequests?: () => void;
  pendingRequestsCount?: number;
}

const tabTitles: Record<ViewMode, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'لوحة التحكم الرئيسية',
    subtitle: 'ملخص شامل لبيانات العضوات، القادة، والعشائر',
  },
  members: {
    title: 'سجل الأعضاء والقادة',
    subtitle: 'إدارة وتعديل وبحث بيانات الكشافة والأكواد الفريدة',
  },
  tribes: {
    title: 'إدارة العشائر (Tribes)',
    subtitle: 'تنظيم وتوزيع الأعضاء وتعيين القادة والنواب',
  },
  activities: {
    title: 'أنشطة ومعسكرات الكشافة',
    subtitle: 'إدارة المعسكرات والرحلات والأنشطة وتسجيل المشتركين والرسوم',
  },
  badges: {
    title: 'الأوسمة والشارات الكشفية',
    subtitle: 'إدارة وتخصيص الأوسمة ومنحها للأعضاء والقادة مع الشرح والشروط',
  },
  wallets: {
    title: 'محفظة الأعضاء والقادة الكشفية',
    subtitle: 'شحن رصيد وإيداع وسداد الاشتراكات والأنشطة ومشتريات المتجر',
  },
  subscriptions: {
    title: 'الاشتراك السنوي للأعضاء والقادة',
    subtitle: 'متابعة وتحصيل الاشتراكات السنوية الموحدة وتصدير الكشوفات والإيصالات',
  },
  store: {
    title: 'متجر ومهمات الكشافة',
    subtitle: 'إدارة الأدوات والزي الكشفي والمخزون والمقاسات والأسعار',
  },
  reports: {
    title: 'التقارير والإحصائيات',
    subtitle: 'استخراج وتصدير وطباعة البيانات التفصيلية والحالات المرضية',
  },
  audit: {
    title: 'سجل العمليات والأمان (Audit Log)',
    subtitle: 'مراقبة جميع التغييرات والإضافات بدقة متناهية',
  },
  settings: {
    title: 'إعدادات النظام وإدارة المستخدمين',
    subtitle: 'تخصيص البيانات المدرسية وتعيين صلاحيات الحسابات',
  },
  backup: {
    title: 'النسخ الاحتياطي والاستعادة',
    subtitle: 'حفظ وتصدير واستيراد قواعد البيانات وملفات Excel',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentView,
  onToggleMobileMenu,
  isSidebarOpen = true,
  systemName = 'نظام إدارة الكشافة',
  schoolName = 'مدرسة القديس يوسف بالعبور',
  currentUser,
  onOpenAccountSettings,
  onOpenProfileRequests,
  pendingRequestsCount = 0,
}) => {
  const { theme, toggleTheme } = useTheme();

  const currentInfo = tabTitles[currentView] || {
    title: systemName,
    subtitle: schoolName,
  };

  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs flex-shrink-0 transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile & Desktop Sidebar toggle */}
        <button
          id="btn-mobile-sidebar-toggle"
          onClick={onToggleMobileMenu}
          className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 rounded-xl transition border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer flex items-center gap-1.5"
          title={isSidebarOpen ? 'إخفاء القائمة لتوسيع الشاشة' : 'إظهار القائمة الجانبية'}
        >
          <Menu className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-bold">
            {isSidebarOpen ? 'طي القائمة' : 'القائمة'}
          </span>
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {currentInfo.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Offline Badge */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold"
          title="النظام يعمل محلياً 100% بدون إنترنت"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>محلي وآمن (Offline)</span>
        </div>

        {/* Date Display */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{today}</span>
        </div>

        {/* Pending Requests Badge for Admin */}
        {isAdmin && pendingRequestsCount > 0 && onOpenProfileRequests && (
          <button
            id="btn-header-profile-requests"
            onClick={onOpenProfileRequests}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition animate-pulse cursor-pointer"
            title="توجد طلبات تعديل حسابات جديدة بانتظار موافقتك"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">طلبات معلقة:</span>
            <span className="px-1.5 py-0.2 bg-white text-amber-700 rounded-full text-[11px] font-black">
              {pendingRequestsCount}
            </span>
          </button>
        )}

        {/* Dark / Light Theme Toggle Button */}
        <button
          id="btn-header-theme-toggle"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
          title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Account Profile Button */}
        {currentUser && onOpenAccountSettings && (
          <button
            id="btn-header-account-settings"
            onClick={onOpenAccountSettings}
            className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-right"
            title="إعدادات الحساب وتعديل الملف الشخصي"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.photo_path ? (
                <img
                  src={currentUser.photo_path}
                  alt={currentUser.full_name || currentUser.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                (currentUser.full_name || currentUser.username || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div className="hidden lg:block text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                {currentUser.full_name || currentUser.username}
              </p>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block -mt-0.5">
                إعدادات الحساب
              </span>
            </div>
          </button>
        )}
      </div>
    </header>
  );
};

