import React, { useState, useEffect } from 'react';
import {
  Cake,
  Sparkles,
  Calendar,
  ChevronLeft,
  Phone,
  MessageCircle,
  Gift,
  PartyPopper,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { BirthdayMember } from '../types';
import { Member } from '../../members/types';
import { dashboardService } from '../services/dashboardService';

interface WeeklyBirthdaysCardProps {
  initialBirthdays?: BirthdayMember[];
  loading?: boolean;
  onSelectMember: (member: Member) => void;
}

export const WeeklyBirthdaysCard: React.FC<WeeklyBirthdaysCardProps> = ({
  initialBirthdays = [],
  loading = false,
  onSelectMember,
}) => {
  const [period, setPeriod] = useState<'week' | 'next7' | 'month'>('week');
  const [birthdaysList, setBirthdaysList] = useState<BirthdayMember[]>(initialBirthdays);
  const [fetchingPeriod, setFetchingPeriod] = useState<boolean>(false);

  // Sync with initialBirthdays when period is 'week'
  useEffect(() => {
    if (period === 'week') {
      setBirthdaysList(initialBirthdays);
    }
  }, [initialBirthdays, period]);

  // When period changes, fetch corresponding birthdays
  const handlePeriodChange = async (newPeriod: 'week' | 'next7' | 'month') => {
    setPeriod(newPeriod);
    if (newPeriod === 'week') {
      setBirthdaysList(initialBirthdays);
      return;
    }
    setFetchingPeriod(true);
    try {
      const data = await dashboardService.getBirthdays(newPeriod);
      setBirthdaysList(data);
    } catch (err) {
      console.error('Failed to load birthdays for period:', newPeriod, err);
    } finally {
      setFetchingPeriod(false);
    }
  };

  // Helper for week range description in Arabic
  const getPeriodSubtitle = () => {
    const now = new Date();
    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    if (period === 'week') {
      const day = now.getDay();
      const daysSinceSaturday = (day + 1) % 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceSaturday);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return `من السبت ${start.getDate()} ${monthNames[start.getMonth()]} حتى الجمعة ${end.getDate()} ${monthNames[end.getMonth()]}`;
    }

    if (period === 'next7') {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      return `خلال 7 أيام قادمة (حتى ${end.getDate()} ${monthNames[end.getMonth()]})`;
    }

    return `شهر ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  };

  // Count how many birthdays are today
  const todayCount = birthdaysList.filter((b) => b.isToday).length;

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs relative overflow-hidden">
      {/* Top celebratory accent gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-rose-400 to-emerald-500"></div>

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <Cake className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                أعياد ميلاد الكشافات
                {todayCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    <PartyPopper className="w-3.5 h-3.5 text-amber-600" />
                    {todayCount === 1 ? 'عيد ميلاد اليوم!' : `${todayCount} يحتفلن اليوم!`}
                  </span>
                )}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{getPeriodSubtitle()}</span>
            </p>
          </div>
        </div>

        {/* Filter Period Tabs */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-bold self-start sm:self-auto border border-slate-200/80">
          <button
            onClick={() => handlePeriodChange('week')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              period === 'week'
                ? 'bg-white text-emerald-800 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            onClick={() => handlePeriodChange('next7')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              period === 'next7'
                ? 'bg-white text-emerald-800 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الـ 7 أيام القادمة
          </button>
          <button
            onClick={() => handlePeriodChange('month')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              period === 'month'
                ? 'bg-white text-emerald-800 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            هذا الشهر
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading || fetchingPeriod ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500">جاري تحميل قائمة أعياد الميلاد...</p>
        </div>
      ) : birthdaysList.length === 0 ? (
        /* Empty State */
        <div className="py-8 px-4 text-center rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Gift className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">لا توجد أعياد ميلاد لكشافات في هذه الفترة</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {period === 'week'
              ? 'لم يصادف تاريخ ميلاد أي كشافة خلال الأسبوع الحالي. يمكنك الاطلاع على الأيام القادمة أو الشهر الحالي من الخيارات بالأعلى.'
              : 'لا توجد أعياد ميلاد مسجلة في النطاق المحدد.'}
          </p>
          {period === 'week' && (
            <button
              onClick={() => handlePeriodChange('month')}
              className="mt-3 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              عرض أعياد ميلاد هذا الشهر
            </button>
          )}
        </div>
      ) : (
        /* Birthdays Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {birthdaysList.map((scout) => {
            const contactPhone = scout.mother_phone || scout.father_phone;
            const whatsappText = encodeURIComponent(
              `السلام عليكم، كل عام والكشافة العزيزة "${scout.student_name}" بألف خير وصحة وسعادة بمناسبة عيد ميلادها 🎂🎉 - مع تحيات قادة كشافة مدرسة القديس يوسف بالعبور.`
            );

            return (
              <div
                key={scout.id}
                className={`relative rounded-xl p-4 transition-all duration-200 border flex flex-col justify-between ${
                  scout.isToday
                    ? 'bg-amber-50/40 border-amber-300 shadow-xs ring-1 ring-amber-300/60'
                    : 'bg-white hover:bg-slate-50/70 border-slate-200/90 shadow-2xs'
                }`}
              >
                {/* Status timing badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    {scout.isToday ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500 text-white shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5" />
                        اليوم!
                      </span>
                    ) : scout.daysRemaining === 1 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Clock className="w-3 h-3" />
                        غداً
                      </span>
                    ) : scout.daysRemaining > 1 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Clock className="w-3 h-3" />
                        بعد {scout.daysRemaining} أيام
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        مرّ منذ {Math.abs(scout.daysRemaining)} {Math.abs(scout.daysRemaining) === 1 ? 'يوم' : 'أيام'}
                      </span>
                    )}

                    <span className="text-xs font-bold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                      {scout.dayOfWeekName}، {scout.formattedDate}
                    </span>
                  </div>

                  {/* Turning age badge */}
                  <span className="text-xs font-black text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                    تتم {scout.turningAge} سنة
                  </span>
                </div>

                {/* Scout info row */}
                <div className="flex items-start gap-3 mb-3.5">
                  {/* Photo or Avatar */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {scout.photo_path ? (
                      <img
                        src={scout.photo_path}
                        alt={scout.student_name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 font-black text-base">
                        {scout.student_name.trim().charAt(0) || <UserIcon className="w-5 h-5 text-emerald-700" />}
                      </div>
                    )}
                  </div>

                  {/* Name and labels */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 text-sm truncate" title={scout.student_name}>
                      {scout.student_name}
                    </h4>
                    <p className="text-[11px] font-mono text-emerald-700 font-bold mt-0.5">
                      {scout.member_code || `A25${String(scout.id).padStart(4, '0')}`}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                        {scout.school_stage}
                      </span>
                      {scout.tribe_name && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600 truncate">{scout.tribe_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                  <button
                    onClick={() => onSelectMember(scout)}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200/80 text-slate-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border border-slate-200/80"
                  >
                    <span>عرض البطاقة</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {contactPhone && (
                    <div className="flex items-center gap-1">
                      {/* WhatsApp Greeting Button */}
                      <a
                        href={`https://wa.me/20${contactPhone.replace(/^0+/, '')}?text=${whatsappText}`}
                        target="_blank"
                        rel="noreferrer"
                        title="إرسال تهنئة عبر واتساب لولي الأمر"
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition flex items-center justify-center"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>

                      {/* Phone Call Button */}
                      <a
                        href={`tel:${contactPhone}`}
                        title={`الاتصال بولي الأمر (${contactPhone})`}
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition flex items-center justify-center"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
