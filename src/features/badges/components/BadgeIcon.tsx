import React, { useState, useRef, useEffect } from 'react';
import {
  Award,
  Medal,
  Shield,
  Heart,
  Compass,
  Tent,
  Flame,
  Crown,
  Star,
  Zap,
  Trophy,
  Sparkles,
  HeartPulse,
  Trash2,
  Calendar,
  UserCheck,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { Badge, MemberBadge } from '../types';

interface BadgeIconProps {
  badge: Badge | MemberBadge;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  canRevoke?: boolean;
  onRevoke?: (badge: Badge | MemberBadge) => void;
  className?: string;
}

export const getBadgeLucideIcon = (iconName?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'shield':
      return Shield;
    case 'heart':
      return Heart;
    case 'compass':
      return Compass;
    case 'tent':
      return Tent;
    case 'flame':
      return Flame;
    case 'crown':
      return Crown;
    case 'star':
      return Star;
    case 'zap':
      return Zap;
    case 'trophy':
      return Trophy;
    case 'cross':
    case 'medical':
      return HeartPulse;
    case 'sparkles':
      return Sparkles;
    case 'medal':
      return Medal;
    case 'award':
    default:
      return Award;
  }
};

export const getBadgeColorClasses = (colorName?: string) => {
  switch (colorName?.toLowerCase()) {
    case 'rose':
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800',
        badgeBg: 'bg-rose-500',
        ring: 'ring-rose-400',
        gradient: 'from-rose-500 to-pink-600',
      };
    case 'red':
      return {
        bg: 'bg-red-50 dark:bg-red-950/40',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        badgeBg: 'bg-red-500',
        ring: 'ring-red-400',
        gradient: 'from-red-500 to-rose-600',
      };
    case 'blue':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
        badgeBg: 'bg-blue-500',
        ring: 'ring-blue-400',
        gradient: 'from-blue-500 to-indigo-600',
      };
    case 'emerald':
    case 'green':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        badgeBg: 'bg-emerald-500',
        ring: 'ring-emerald-400',
        gradient: 'from-emerald-500 to-teal-600',
      };
    case 'purple':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800',
        badgeBg: 'bg-purple-500',
        ring: 'ring-purple-400',
        gradient: 'from-purple-500 to-indigo-600',
      };
    case 'indigo':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        text: 'text-indigo-600 dark:text-indigo-400',
        border: 'border-indigo-200 dark:border-indigo-800',
        badgeBg: 'bg-indigo-500',
        ring: 'ring-indigo-400',
        gradient: 'from-indigo-500 to-purple-600',
      };
    case 'orange':
      return {
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800',
        badgeBg: 'bg-orange-500',
        ring: 'ring-orange-400',
        gradient: 'from-orange-500 to-amber-600',
      };
    case 'cyan':
      return {
        bg: 'bg-cyan-50 dark:bg-cyan-950/40',
        text: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-200 dark:border-cyan-800',
        badgeBg: 'bg-cyan-500',
        ring: 'ring-cyan-400',
        gradient: 'from-cyan-500 to-blue-600',
      };
    case 'amber':
    case 'yellow':
    case 'gold':
    default:
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        badgeBg: 'bg-amber-500',
        ring: 'ring-amber-400',
        gradient: 'from-amber-400 to-amber-600',
      };
  }
};

export const BadgeIcon: React.FC<BadgeIconProps> = ({
  badge,
  size = 'md',
  showTooltip = true,
  canRevoke = false,
  onRevoke,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const IconComponent = getBadgeLucideIcon(badge.icon);
  const colors = getBadgeColorClasses(badge.color);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const sizeClasses = {
    xs: {
      wrapper: 'w-6 h-6 rounded-md',
      icon: 'w-3.5 h-3.5',
    },
    sm: {
      wrapper: 'w-7 h-7 rounded-lg',
      icon: 'w-4 h-4',
    },
    md: {
      wrapper: 'w-8 h-8 rounded-xl',
      icon: 'w-4.5 h-4.5',
    },
    lg: {
      wrapper: 'w-11 h-11 rounded-2xl',
      icon: 'w-6 h-6',
    },
  }[size];

  const memberBadge = badge as MemberBadge;
  const isAwarded = !!memberBadge.awarded_at;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => showTooltip && setIsOpen(true)}
      onMouseLeave={() => showTooltip && setIsOpen(false)}
    >
      {/* Badge Button / Icon Thumbnail */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-label={badge.name}
        className={`relative flex items-center justify-center border transition-all duration-200 cursor-pointer shadow-2xs hover:scale-110 active:scale-95 ${sizeClasses.wrapper} ${colors.bg} ${colors.text} ${colors.border} hover:shadow-md hover:ring-2 ${colors.ring} dark:shadow-none`}
        title={badge.name}
      >
        <IconComponent className={sizeClasses.icon} />
        {/* Tiny star sparkle badge on corner */}
        <span
          className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${colors.badgeBg} ring-1 ring-white dark:ring-slate-900`}
        />
      </button>

      {/* Hover / Click Tooltip Box with complete explanation and requirements */}
      {isOpen && showTooltip && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 bottom-full mb-2 right-1/2 translate-x-1/2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl text-right animate-scale-in"
          style={{ minWidth: '270px' }}
        >
          {/* Header with icon & badge name */}
          <div className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs border ${colors.bg} ${colors.text} ${colors.border}`}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {badge.category || 'وسام جدارة'}
                </span>
                {badge.name_en && (
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono dir-ltr">
                    {badge.name_en}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                {badge.name}
              </h4>
            </div>
          </div>

          {/* Body: Description & Requirements */}
          <div className="mt-3 space-y-2.5 text-xs">
            {/* Description (شرح الوسام) */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold mb-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>شرح الوسام:</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                {badge.description}
              </p>
            </div>

            {/* Requirements (شروط الحصول عليه) */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/50">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-bold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>شروط ومعايير الاستحقاق:</span>
              </div>
              <p className="text-amber-950 dark:text-amber-200 leading-relaxed text-[11px] whitespace-pre-line font-medium">
                {badge.requirements}
              </p>
            </div>

            {/* Award Info (if given to member) */}
            {isAwarded && (
              <div className="bg-slate-100/70 dark:bg-slate-800/40 p-2 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                    <Calendar className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                    تاريخ المنح:
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 dir-ltr">
                    {memberBadge.awarded_at}
                  </span>
                </div>
                {memberBadge.awarded_by && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                      <UserCheck className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                      ممنوح من قبل:
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {memberBadge.awarded_by}
                    </span>
                  </div>
                )}
                {memberBadge.reason && (
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-800 dark:text-slate-200">السبب/المناسبة: </span>
                    {memberBadge.reason}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Revoke Option */}
          {canRevoke && onRevoke && isAwarded && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRevoke(badge);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-lg text-[11px] font-bold border border-rose-200 dark:border-rose-800 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>سحب الوسام</span>
              </button>
            </div>
          )}

          {/* Arrow Tip */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-solid border-t-white dark:border-t-slate-900 border-t-8 border-x-transparent border-x-8 border-b-0 drop-shadow-xs pointer-events-none" />
        </div>
      )}
    </div>
  );
};
