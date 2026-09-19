import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  FileSpreadsheet,
  History,
  Settings,
  Database,
  UserPlus,
  Search,
  ChevronDown,
  ChevronUp,
  LogOut,
  Sparkles,
  Award,
  Medal,
  Tent,
  X,
  CreditCard,
  ShoppingBag,
  Clock,
  UserCheck,
  UserCog,
  Wallet,
} from 'lucide-react';
import { User } from '../features/auth';
import { SystemSettings } from '../features/settings';
import { ScoutEmblem } from '../features/members/components/ScoutEmblem';

export type ViewMode =
  | 'dashboard'
  | 'members'
  | 'tribes'
  | 'activities'
  | 'badges'
  | 'wallets'
  | 'subscriptions'
  | 'store'
  | 'reports'
  | 'backup'
  | 'settings'
  | 'audit';

interface SidebarProps {
  user: User | null;
  settings?: SystemSettings | null;
  currentView: ViewMode;
  onNavigate: (view: ViewMode | 'add_member') => void;
  onOpenAddMember: () => void;
  onSearchMember: () => void;
  onLogout: () => void;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  isDesktopOpen?: boolean;
  onOpenAccountSettings?: () => void;
  onOpenProfileRequests?: () => void;
  pendingRequestsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  settings,
  currentView,
  onNavigate,
  onOpenAddMember,
  onSearchMember,
  onLogout,
  mobileMenuOpen = false,
  onCloseMobileMenu,
  isDesktopOpen = true,
  onOpenAccountSettings,
  onOpenProfileRequests,
  pendingRequestsCount = 0,
}) => {
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const handleNavClick = (view: ViewMode) => {
    onNavigate(view);
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const navItems = [
    {
      id: 'dashboard' as ViewMode,
      label: 'الرئيسية',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'tribes' as ViewMode,
      label: 'العشائر والاجتماعات',
      icon: Award,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'members' as ViewMode,
      label: 'سجل الأعضاء',
      icon: Users,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'activities' as ViewMode,
      label: 'أنشطة ومعسكرات',
      icon: Tent,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'badges' as ViewMode,
      label: 'الأوسمة والشارات',
      icon: Medal,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'wallets' as ViewMode,
      label: 'محفظة الكشافة',
      icon: Wallet,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'subscriptions' as ViewMode,
      label: 'الاشتراك السنوي',
      icon: CreditCard,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'store' as ViewMode,
      label: 'المتجر',
      icon: ShoppingBag,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'reports' as ViewMode,
      label: 'التقارير والإحصائيات',
      icon: FileSpreadsheet,
      roles: ['ADMIN', 'DATA_ENTRY', 'LEADER'],
    },
    {
      id: 'audit' as ViewMode,
      label: 'سجل العمليات (Audit)',
      icon: History,
      roles: ['ADMIN'],
    },
    {
      id: 'settings' as ViewMode,
      label: 'إعدادات النظام والمستخدمين',
      icon: Settings,
      roles: ['ADMIN'],
    },
    {
      id: 'backup' as ViewMode,
      label: 'النسخ الاحتياطي واستعادة البيانات',
      icon: Database,
      roles: ['ADMIN', 'DATA_ENTRY'],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobileMenu}
        />
      )}

      {/* Main Right-Side RTL Sidebar */}
      <aside
        id="app-sidebar"
        className={`fixed top-0 right-0 z-50 h-full w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xl transition-all duration-300 ease-in-out lg:static lg:z-auto lg:h-full lg:shrink-0 lg:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isDesktopOpen ? 'lg:flex lg:translate-x-0' : 'lg:hidden'}`}
      >
        {/* Top Header & Branding */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
              <ScoutEmblem
                size={32}
                logoUrl={settings?.scout_logo_url}
                groupName={settings?.scout_group_name}
                groupNameEn={settings?.scout_group_name_en}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <h1 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug truncate">
                {settings?.school_name || 'مدرسة القديس يوسف بالعبور'}
              </h1>
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block shrink-0"></span>
                {settings?.system_name || 'نظام إدارة الكشافة المحلي'}
              </p>
            </div>
          </div>

          <button
            onClick={onCloseMobileMenu}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer shrink-0"
            title="إغلاق القائمة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 text-sm select-none">
          {/* Main Sections Navigation */}
          <div>
            <p className="px-3 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2">
              الأقسام الرئيسية
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                if (!user || !item.roles.includes(user.role)) return null;
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-right font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Actions Accordion */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              id="btn-quick-actions-accordion"
              onClick={() => setQuickActionsOpen(!quickActionsOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>العمليات السريعة / Quick Actions</span>
              </div>
              {quickActionsOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {quickActionsOpen && (
              <div className="mt-1.5 space-y-1 pr-2">
                {/* 1. Add Member */}
                <button
                  id="qa-add-member"
                  onClick={() => {
                    onOpenAddMember();
                    if (onCloseMobileMenu) onCloseMobileMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>إضافة عضو جديد</span>
                </button>

                {/* 2. Search Member */}
                <button
                  id="qa-search-member"
                  onClick={() => {
                    onSearchMember();
                    if (onCloseMobileMenu) onCloseMobileMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>بحث عن عضو</span>
                </button>

                {/* 3. Members List */}
                <button
                  id="qa-members-list"
                  onClick={() => handleNavClick('members')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>سجل الأعضاء</span>
                </button>

                {/* 4. Reports */}
                <button
                  id="qa-reports"
                  onClick={() => handleNavClick('reports')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>التقارير</span>
                </button>

                {/* 5. Backup (Admin only) */}
                {isAdmin && (
                  <button
                    id="qa-backup"
                    onClick={() => handleNavClick('backup')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>النسخة الاحتياطية</span>
                  </button>
                )}

                {/* 6. Admin Profile Requests Review */}
                {isAdmin && onOpenProfileRequests && (
                  <button
                    id="qa-profile-requests"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      onOpenProfileRequests();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                      <span>طلبات تعديل الحسابات</span>
                    </div>
                    {pendingRequestsCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-black">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                )}

                {/* 7. Edit Personal Profile */}
                {onOpenAccountSettings && (
                  <button
                    id="qa-account-settings"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      onOpenAccountSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
                  >
                    <UserCog className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>تعديل بيانات حسابي</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Card & Logout & Copyright Footer */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex-shrink-0 space-y-3 transition-colors">
          {/* User Badge */}
          {user && (
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                id="btn-sidebar-user-profile"
                onClick={onOpenAccountSettings}
                className="flex items-center gap-2.5 overflow-hidden text-right hover:opacity-80 transition cursor-pointer flex-1"
                title="اضغط لفتح إعدادات الحساب والملف الشخصي"
              >
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-white dark:border-slate-700">
                  {user.photo_path ? (
                    <img
                      src={user.photo_path}
                      alt={user.full_name || user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (user.full_name || user.username).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {user.full_name || user.username}
                  </p>
                  <span
                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded truncate max-w-[125px] ${
                      user.role === 'ADMIN'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : user.role === 'LEADER'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {user.role === 'ADMIN'
                      ? 'مدير النظام (Admin)'
                      : user.role === 'LEADER'
                      ? user.tribe_name
                        ? `قائد: ${user.tribe_name}`
                        : 'قائد عشيرة (Leader)'
                      : 'مدخل بيانات (Data Entry)'}
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {onOpenAccountSettings && (
                  <button
                    id="btn-sidebar-settings-icon"
                    onClick={onOpenAccountSettings}
                    title="تعديل بيانات الحساب والصورة"
                    className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <UserCog className="w-4 h-4" />
                  </button>
                )}

                <button
                  id="btn-sidebar-logout"
                  onClick={onLogout}
                  title="تسجيل الخروج"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Copyright Section (Strict Requirement #3) */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed font-sans px-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Copyright ©</p>
            <p className="font-medium text-slate-800 dark:text-slate-200">Eng. Jan Gamal Zikry</p>
            <a
              href="mailto:Jan.Zikry@gmail.com"
              dir="ltr"
              className="text-emerald-700 dark:text-emerald-400 hover:underline block truncate text-center"
            >
              Jan.Zikry@gmail.com
            </a>
            <p dir="ltr" className="text-slate-700 dark:text-slate-300 font-mono font-semibold tracking-wider text-center select-all mt-0.5">
              <bdi dir="ltr">01003634538</bdi>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
