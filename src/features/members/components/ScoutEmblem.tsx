import React, { useState, useEffect } from 'react';
import { getPhotoUrl } from '../../../utils/photo';

interface ScoutEmblemProps {
  className?: string;
  size?: number;
  watermark?: boolean;
  logoUrl?: string;
  groupName?: string;
  groupNameEn?: string;
}

/**
 * Official Scout Emblem Component
 * Supports custom group logo uploaded via System Settings,
 * with fallback to classic Scout Fleur-de-lis emblem.
 */
export const ScoutEmblem: React.FC<ScoutEmblemProps> = ({
  className = '',
  size = 64,
  watermark = false,
  logoUrl,
  groupName,
  groupNameEn,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  const resolvedUrl = logoUrl ? getPhotoUrl(logoUrl) : null;

  // If custom scout group logo URL is provided and not errored, display it
  if (resolvedUrl && resolvedUrl.trim() !== '' && !imgError) {
    if (watermark) {
      return (
        <div
          className={`pointer-events-none select-none flex items-center justify-center ${className}`}
          aria-hidden="true"
        >
          <img
            src={resolvedUrl}
            alt=""
            style={{ width: size, height: size }}
            className="w-full h-full object-contain filter grayscale opacity-20 contrast-125 select-none"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        </div>
      );
    }

    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 drop-shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={resolvedUrl}
          alt={groupName || 'شعار الكشافة'}
          className="w-full h-full object-contain select-none"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: Default Scout Emblem (Fleur-de-lis)
  const displayEnTop = groupNameEn?.split(' - ')[0] || groupNameEn || 'OFFICIAL SCOUT';
  const displayEnBottom = groupNameEn?.includes('SCOUT') ? '' : 'SCOUT GROUP';

  if (watermark) {
    return (
      <div
        className={`pointer-events-none select-none flex items-center justify-center ${className}`}
        aria-hidden="true"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 300 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Outer circle rings */}
          <circle cx="150" cy="150" r="140" stroke="#1d4ed8" strokeWidth="8" strokeOpacity="0.35" />
          <circle cx="150" cy="150" r="128" stroke="#ca8a04" strokeWidth="6" strokeOpacity="0.4" />
          <circle cx="150" cy="150" r="105" fill="#1e3a8a" fillOpacity="0.12" />

          {/* Scout Fleur-de-lis (Fleur de Lys) Silhouette */}
          <g fill="#ca8a04" fillOpacity="0.4" stroke="#ca8a04" strokeWidth="2">
            {/* Center petal */}
            <path d="M150 40 C140 85 130 115 130 145 C130 160 138 170 150 170 C162 170 170 160 170 145 C170 115 160 85 150 40 Z" />
            <path d="M150 50 L150 165" stroke="#991b1b" strokeWidth="4" strokeOpacity="0.5" />
            
            {/* Left petal */}
            <path d="M130 145 C115 110 80 100 70 125 C60 150 90 170 120 168 C126 168 128 160 130 145 Z" />
            
            {/* Right petal */}
            <path d="M170 145 C185 110 220 100 230 125 C240 150 210 170 180 168 C174 168 172 160 170 145 Z" />
            
            {/* Bottom stem / base */}
            <path d="M135 180 C135 210 145 235 150 250 C155 235 165 210 165 180 Z" />
            
            {/* Ring tie / horizontal band */}
            <rect x="122" y="165" width="56" height="14" rx="4" fill="#991b1b" fillOpacity="0.5" />
          </g>

          {/* Center Cross / Emblem */}
          <g stroke="#991b1b" strokeWidth="6" strokeLinecap="round" strokeOpacity="0.5">
            <line x1="150" y1="90" x2="150" y2="155" />
            <line x1="135" y1="110" x2="165" y2="110" />
          </g>

          {/* Watermark text ring */}
          <path
            id="watermark-arc-top"
            d="M 40,150 A 110,110 0 0,1 260,150"
            fill="none"
          />
          <path
            id="watermark-arc-bot"
            d="M 260,150 A 110,110 0 0,1 40,150"
            fill="none"
          />
          <text fill="#1e3a8a" fillOpacity="0.45" fontSize="15" fontWeight="bold" letterSpacing="3">
            <textPath href="#watermark-arc-top" startOffset="50%" textAnchor="middle">
              {displayEnTop.slice(0, 24)}
            </textPath>
          </text>
          <text fill="#ca8a04" fillOpacity="0.5" fontSize="15" fontWeight="bold" letterSpacing="4">
            <textPath href="#watermark-arc-bot" startOffset="50%" textAnchor="middle">
              {displayEnBottom || 'SCOUT GROUP'}
            </textPath>
          </text>
        </svg>
      </div>
    );
  }

  // Full color logo badge fallback
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 drop-shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <radialGradient id="emblem-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="85%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <linearGradient id="gold-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          <linearGradient id="fleur-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="25%" stopColor="#fde047" />
            <stop offset="75%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        {/* Outer White / Gold Ring */}
        <circle cx="150" cy="150" r="146" fill="#ffffff" />
        <circle cx="150" cy="150" r="142" stroke="url(#gold-ring)" strokeWidth="8" />
        <circle cx="150" cy="150" r="134" fill="#0f172a" />
        <circle cx="150" cy="150" r="108" fill="url(#emblem-bg)" stroke="url(#gold-ring)" strokeWidth="3" />

        {/* Text Arc */}
        <path
          id="emblem-arc-top"
          d="M 32,150 A 118,118 0 0,1 268,150"
          fill="none"
        />
        <path
          id="emblem-arc-bottom"
          d="M 268,150 A 118,118 0 0,1 32,150"
          fill="none"
        />

        <text fill="#ffffff" fontSize="16" fontWeight="900" letterSpacing="2.5" fontFamily="sans-serif">
          <textPath href="#emblem-arc-top" startOffset="50%" textAnchor="middle">
            {displayEnTop.slice(0, 22)}
          </textPath>
        </text>

        <text fill="#fde047" fontSize="15" fontWeight="900" letterSpacing="3.5" fontFamily="sans-serif">
          <textPath href="#emblem-arc-bottom" startOffset="50%" textAnchor="middle">
            {displayEnBottom || 'SCOUT GROUP'}
          </textPath>
        </text>

        {/* Decorative side stars */}
        <circle cx="28" cy="150" r="4" fill="#fde047" />
        <circle cx="272" cy="150" r="4" fill="#fde047" />

        {/* Scout Fleur-de-lis */}
        <g filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.5))">
          {/* Left Wing */}
          <path
            d="M130 148 C115 110 75 100 66 126 C57 152 88 174 122 170 C128 169 130 162 130 148 Z"
            fill="url(#fleur-gold)"
            stroke="#78350f"
            strokeWidth="2"
          />
          {/* Right Wing */}
          <path
            d="M170 148 C185 110 225 100 234 126 C243 152 212 174 178 170 C172 169 170 162 170 148 Z"
            fill="url(#fleur-gold)"
            stroke="#78350f"
            strokeWidth="2"
          />
          {/* Center Leaf */}
          <path
            d="M150 48 C139 90 128 118 128 148 C128 163 138 173 150 173 C162 173 172 163 172 148 C172 118 161 90 150 48 Z"
            fill="url(#fleur-gold)"
            stroke="#78350f"
            strokeWidth="2"
          />
          {/* Bottom Root / Trunk */}
          <path
            d="M134 182 C134 212 145 238 150 252 C155 238 166 212 166 182 Z"
            fill="url(#fleur-gold)"
            stroke="#78350f"
            strokeWidth="1.5"
          />
          {/* Center Golden Tie Band */}
          <rect
            x="122"
            y="167"
            width="56"
            height="14"
            rx="3"
            fill="#dc2626"
            stroke="#fde047"
            strokeWidth="2"
          />
          {/* Central Emblem Cross / Star */}
          <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round">
            <line x1="150" y1="96" x2="150" y2="154" />
            <line x1="136" y1="114" x2="164" y2="114" />
          </g>
        </g>
      </svg>
    </div>
  );
};
