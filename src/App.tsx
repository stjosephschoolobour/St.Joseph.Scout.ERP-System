import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';

// Domain Features & Services
import {
  User,
  authService,
  LoginScreen,
  AccountSettingsModal,
  ProfileRequestsModal,
  profileService,
} from './features/auth';
import { DashboardStats, dashboardService, DashboardView } from './features/dashboard';
import { Member, membersService, MemberListView, MemberFormModal, MemberCardModal } from './features/members';
import { TribesView } from './features/tribes';
import { ActivitiesView } from './features/activities';
import { BadgesView } from './features/badges/components/BadgesView';
import { WalletsView } from './features/wallets/WalletsView';
import { ReportData, reportsService, ReportsView } from './features/reports';
import { BackupRestoreView } from './features/backup';
import { SystemSettings, settingsService, SettingsView } from './features/settings';
import { AuditLogItem, auditService, AuditLogView } from './features/audit';
import { AnnualSubscriptionsView } from './features/subscriptions/components/AnnualSubscriptionsView';
import { StoreView } from './features/store';

// Shared Layout Components
import { Sidebar, ViewMode } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';

export type { ViewMode };

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  // Profile Settings & Request modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [reportsData, setReportsData] = useState<ReportData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);

  // Search & Filter state for members view
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedTribe, setSelectedTribe] = useState('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [memberCardToView, setMemberCardToView] = useState<Member | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Initial auth & settings load
  useEffect(() => {
    const initApp = async () => {
      const storedUser = authService.getUser();
      if (storedUser && authService.getToken()) {
        try {
          const user = await authService.checkAuth();
          if (user) {
            setCurrentUser(user);
          } else {
            authService.clearAuth();
          }
        } catch {
          authService.clearAuth();
        }
      }
      setIsInitializing(false);
    };

    initApp();
  }, []);

  // Load active data
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Dashboard stats & Settings
      const [dashStats, sysSettings] = await Promise.all([
        dashboardService.getDashboardStats().catch(() => null),
        settingsService.getSettings().catch(() => null),
      ]);

      if (dashStats) setStats(dashStats);
      if (sysSettings) setSettings(sysSettings);

      // 2. Load members
      const memberList = await membersService.getMembers({
        q: searchTerm,
        stage: selectedStage,
        type: selectedType,
      }).catch(() => []);
      setMembers(memberList);

      // 3. Load reports if in reports view
      if (currentView === 'reports') {
        const reps = await reportsService.getReportsSummary().catch(() => null);
        if (reps) setReportsData(reps);
      }

      // 4. Load audit logs if in audit view
      if (currentView === 'audit' && currentUser.role === 'ADMIN') {
        const logs = await auditService.getAuditLogs().catch(() => []);
        setAuditLogs(logs);
      }

      // 5. Load pending profile requests count for Admin
      if (currentUser.role === 'ADMIN') {
        profileService.getPendingRequestsCount()
          .then((res) => setPendingRequestsCount(res.count || 0))
          .catch(() => {});
      }
    } catch (err: any) {
      console.error('Data load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentView, searchTerm, selectedStage, selectedType]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, currentView, searchTerm, selectedStage, selectedType, loadData]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
    showToast(`مرحباً بك، ${user.username} في نظام إدارة الكشافة`);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setCurrentView('dashboard');
    showToast('تم تسجيل الخروج بنجاح');
  };

  const handleOpenAddMember = () => {
    setMemberToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleEditMember = (member: Member) => {
    setMemberToEdit(member);
    setIsFormModalOpen(true);
  };

  const handlePromoteMember = async (member: Member, leaderPhone: string, leaderEmail?: string) => {
    try {
      const res = await membersService.promoteToLeader(member.id, leaderPhone, leaderEmail);
      showToast(res.message || `تمت ترقية العضوة (${member.student_name}) إلى قائد بنجاح`);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'فشلت عملية الترقية', 'error');
      throw err;
    }
  };

  const handleDeleteMember = async (id: number) => {
    try {
      const res = await membersService.deleteMember(id);
      showToast(res.message || 'تم حذف العضو بنجاح');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'فشلت عملية الحذف', 'error');
    }
  };

  const handleNavigate = (view: ViewMode | 'add_member') => {
    if (view === 'add_member') {
      handleOpenAddMember();
    } else {
      setCurrentView(view);
    }
    setMobileMenuOpen(false);
  };

  const handleSearchFocus = () => {
    setCurrentView('members');
    setTimeout(() => {
      const input = document.getElementById('search_member_input');
      if (input) input.focus();
    }, 100);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-bold text-sm">جاري تهيئة نظام الكشافة المحلي (SQLite)...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-100 dark:bg-slate-950 flex font-sans selection:bg-emerald-200 dir-rtl text-slate-900 dark:text-slate-100 transition-colors">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 animate-bounce duration-300 no-print">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs sm:text-sm font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
                : 'bg-rose-950 text-rose-100 border-rose-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition mr-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Right Sidebar (RTL) */}
      <Sidebar
        user={currentUser}
        settings={settings}
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAddMember={handleOpenAddMember}
        onSearchMember={handleSearchFocus}
        onLogout={handleLogout}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        isDesktopOpen={desktopSidebarOpen}
        onOpenAccountSettings={() => setIsAccountModalOpen(true)}
        onOpenProfileRequests={() => setIsRequestsModalOpen(true)}
        pendingRequestsCount={pendingRequestsCount}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100 dark:bg-slate-950">
        {/* Top Header */}
        <TopHeader
          currentView={currentView}
          isSidebarOpen={desktopSidebarOpen}
          currentUser={currentUser}
          systemName={settings?.system_name}
          schoolName={settings?.school_name}
          onOpenAccountSettings={() => setIsAccountModalOpen(true)}
          onOpenProfileRequests={() => setIsRequestsModalOpen(true)}
          pendingRequestsCount={pendingRequestsCount}
          onToggleMobileMenu={() => {
            // If on mobile / smaller screens toggle mobile drawer, on desktop toggle desktop sidebar
            if (window.innerWidth < 1024) {
              setMobileMenuOpen((prev) => !prev);
            } else {
              setDesktopSidebarOpen((prev) => !prev);
            }
          }}
        />

        {/* View Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-100 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && (
              <DashboardView
                user={currentUser}
                stats={stats}
                loading={loading}
                onNavigate={handleNavigate}
                onSelectMember={(m) => setMemberCardToView(m)}
                onLogout={handleLogout}
              />
            )}

            {currentView === 'members' && (
              <MemberListView
                members={members}
                user={currentUser}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedStage={selectedStage}
                onStageChange={setSelectedStage}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedTribe={selectedTribe}
                onTribeChange={setSelectedTribe}
                onViewCard={(m) => setMemberCardToView(m)}
                onEditMember={handleEditMember}
                onPromoteMember={handlePromoteMember}
                onDeleteMember={handleDeleteMember}
                onOpenAddModal={handleOpenAddMember}
                onRefresh={loadData}
              />
            )}

            {currentView === 'tribes' && (
              <TribesView
                user={currentUser}
                onSelectMember={(m) => setMemberCardToView(m)}
                onOpenAddMember={handleOpenAddMember}
                onSuccess={(msg) => {
                  showToast(msg);
                  loadData();
                }}
              />
            )}

            {currentView === 'activities' && (
              <ActivitiesView
                user={currentUser}
                settings={settings}
                onSuccess={(msg) => {
                  showToast(msg);
                  loadData();
                }}
              />
            )}

            {currentView === 'badges' && (
              <BadgesView
                currentUser={currentUser}
                onSelectMember={(m) => setMemberCardToView(m)}
              />
            )}

            {currentView === 'wallets' && (
              <WalletsView
                currentUser={currentUser}
                onSelectMember={(m) => setMemberCardToView(m)}
              />
            )}

            {currentView === 'subscriptions' && (
              <AnnualSubscriptionsView userRole={currentUser.role} />
            )}

            {currentView === 'store' && (
              <StoreView userRole={currentUser.role} currentUser={currentUser} />
            )}

            {currentView === 'reports' && (
              <ReportsView
                data={reportsData}
                loading={loading}
                onViewCard={(m) => setMemberCardToView(m)}
              />
            )}

            {currentView === 'backup' && (currentUser.role === 'ADMIN' || currentUser.role === 'DATA_ENTRY') && (
              <BackupRestoreView
                user={currentUser}
                onSuccess={(msg) => {
                  showToast(msg);
                  loadData();
                }}
              />
            )}

            {currentView === 'settings' && currentUser.role === 'ADMIN' && (
              <SettingsView
                currentUser={currentUser}
                settings={settings}
                onSettingsUpdated={loadData}
                onSuccess={(msg) => {
                  showToast(msg);
                }}
              />
            )}

            {currentView === 'audit' && currentUser.role === 'ADMIN' && (
              <AuditLogView logs={auditLogs} loading={loading} />
            )}
          </div>
        </main>
      </div>

      {/* Add / Edit Member Modal */}
      <MemberFormModal
        isOpen={isFormModalOpen}
        memberToEdit={memberToEdit}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          loadData();
        }}
      />

      {/* Member Card Modal */}
      <MemberCardModal
        isOpen={!!memberCardToView}
        member={memberCardToView}
        onClose={() => setMemberCardToView(null)}
        onEdit={(m) => {
          setMemberCardToView(null);
          handleEditMember(m);
        }}
      />

      {/* Account Settings & Profile Edit Modal */}
      {currentUser && (
        <AccountSettingsModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          currentUser={currentUser}
          onProfileUpdated={(updatedUser) => {
            if (updatedUser) {
              setCurrentUser(updatedUser);
              authService.setUser(updatedUser);
            }
            loadData();
          }}
          onSuccess={(msg) => showToast(msg)}
        />
      )}

      {/* Admin Profile Requests Review Modal */}
      {currentUser?.role === 'ADMIN' && (
        <ProfileRequestsModal
          isOpen={isRequestsModalOpen}
          onClose={() => setIsRequestsModalOpen(false)}
          onSuccess={(msg) => {
            showToast(msg);
            loadData();
          }}
        />
      )}
    </div>
  );
}
