import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, Moon, Sun } from 'lucide-react';
import { authService } from '../services/authService';
import { User as UserType } from '../types';
import { useTheme } from '../../../core/theme/ThemeContext';

interface LoginScreenProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authService.login(username.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setFailedCount((prev) => prev + 1);
      setError(err.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  const handleExit = () => {
    setUsername('');
    setPassword('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950 flex items-center justify-center p-4 relative">
      {/* Top Floating Dark/Light Toggle */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition flex items-center gap-2 text-xs font-bold shadow-md cursor-pointer"
          title={theme === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>الوضع النهاري</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-300" />
              <span>الوضع الليلي</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right">
        {/* Header Banner */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-6 text-center border-b border-slate-800">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-400/40 shadow-sm">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">نظام إدارة الكشافة</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">مدرسة القديس يوسف بالعبور</p>
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>نظام محلي آمن - Offline SQLite</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">تنبيه تسجيل الدخول</p>
                <p className="mt-0.5">{error}</p>
                {failedCount >= 3 && failedCount < 5 && (
                  <p className="text-[11px] text-red-500 mt-1 font-mono">
                    عدد المحاولات الخاطئة: {failedCount} من 5 محاولات قبل القفل المؤقت.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              اسم المستخدم
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="login_username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                required
                autoFocus
                className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="login_password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                required
                className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              id="login_submit_button"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>

            <button
              id="login_exit_button"
              type="button"
              onClick={handleExit}
              className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition text-xs cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              مسح البيانات
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <div>جميع حقوق الملكية الفكرية محفوظة © 2026</div>
            <div className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 dir-ltr">
              Eng. Jan Gamal <span className="font-mono text-emerald-600 dark:text-emerald-400">01003634538</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
