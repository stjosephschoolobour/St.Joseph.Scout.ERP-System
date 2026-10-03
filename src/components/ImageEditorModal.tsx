import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Crop,
  Check,
  X,
  Undo2,
  FlipHorizontal,
  Move,
  Image as ImageIcon,
} from 'lucide-react';

export interface ImageEditorModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  title?: string;
  onClose: () => void;
  onSave: (editedFile: File, previewUrl: string) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  imageSrc,
  title = 'تعديل وقص وتدوير الصورة',
  onClose,
  onSave,
}) => {
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [cropAspect, setCropAspect] = useState<'free' | '1:1' | '3:4'>('1:1');
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Reset state when opening a new image
  useEffect(() => {
    if (isOpen) {
      setRotation(0);
      setFlipH(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCropAspect('1:1');
    }
  }, [isOpen, imageSrc]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile/tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStartRef.current.x,
      y: touch.clientY - dragStartRef.current.y,
    });
  };

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleFlipHorizontal = () => {
    setFlipH((prev) => !prev);
  };

  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Generate cropped and transformed image via HTML5 Canvas
  const handleApplyAndSave = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (err) => reject(err);
        img.src = imageSrc;
      });

      // Target canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Determine dimensions based on rotation
      const isSwapped = rotation === 90 || rotation === 270;
      const sourceWidth = img.naturalWidth;
      const sourceHeight = img.naturalHeight;

      // Base canvas size to accommodate rotation
      const baseW = isSwapped ? sourceHeight : sourceWidth;
      const baseH = isSwapped ? sourceWidth : sourceHeight;

      // Calculate crop box in natural image coordinates
      let cropW = baseW;
      let cropH = baseH;

      if (cropAspect === '1:1') {
        const side = Math.min(baseW, baseH);
        cropW = side;
        cropH = side;
      } else if (cropAspect === '3:4') {
        // Portrait 3:4 ratio typical for member/ID photos
        if (baseW / baseH > 3 / 4) {
          cropH = baseH;
          cropW = Math.round((baseH * 3) / 4);
        } else {
          cropW = baseW;
          cropH = Math.round((baseW * 4) / 3);
        }
      }

      // Max resolution 1200px for crisp photo with small file size
      const maxDim = 1200;
      let outW = cropW;
      let outH = cropH;
      if (outW > maxDim || outH > maxDim) {
        if (outW > outH) {
          outH = Math.round((outH * maxDim) / outW);
          outW = maxDim;
        } else {
          outW = Math.round((outW * maxDim) / outH);
          outH = maxDim;
        }
      }

      canvas.width = outW;
      canvas.height = outH;

      // High quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fill background in case of png transparency or aspect fit
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);

      // Move origin to center of destination canvas
      ctx.save();
      ctx.translate(outW / 2, outH / 2);

      // User pan scaled to output canvas
      const previewEl = containerRef.current;
      const factor = previewEl ? outW / previewEl.clientWidth : 1;
      ctx.translate(pan.x * factor, pan.y * factor);

      // User zoom and flip
      ctx.scale(flipH ? -zoom : zoom, zoom);

      // Rotate around center
      ctx.rotate((rotation * Math.PI) / 180);

      // Scale to cover crop area initially so it matches preview
      const coverScale = Math.max(outW / baseW, outH / baseH);
      ctx.scale(coverScale, coverScale);

      // Draw original image centered
      ctx.drawImage(
        img,
        -sourceWidth / 2,
        -sourceHeight / 2,
        sourceWidth,
        sourceHeight
      );

      ctx.restore();

      // Convert to blob / File
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsProcessing(false);
            return;
          }
          const filename = `member_photo_${Date.now()}.jpg`;
          const editedFile = new File([blob], filename, { type: 'image/jpeg' });
          const previewUrl = URL.createObjectURL(blob);
          onSave(editedFile, previewUrl);
          setIsProcessing(false);
          onClose();
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Failed to process image:', err);
      setIsProcessing(false);
      alert('حدث خطأ أثناء معالجة الصورة، يرجى المحاولة مرة أخرى.');
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col my-auto animate-scale-in">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{title}</h3>
              <p className="text-[11px] text-slate-400">قص الصورة، تدويرها، وضبط الحجم المناسب للبطاقة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport & Interactive Canvas Area */}
        <div className="p-4 flex flex-col items-center bg-slate-950/50">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            className={`relative w-72 h-72 sm:w-80 sm:h-80 rounded-2xl bg-slate-900 border-2 border-dashed border-emerald-500/60 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none shadow-inner ${
              cropAspect === '3:4' ? 'w-60 h-80 sm:w-64 sm:h-84' : ''
            }`}
          >
            {/* Grid overlay for framing */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10 opacity-30 border border-white/20">
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-white/30" />
              <div className="border-r border-white/30" />
              <div />
            </div>

            {/* Target Face Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
              <div className="w-48 h-48 sm:w-52 sm:h-52 rounded-full border border-emerald-400/40 border-dashed" />
            </div>

            {/* The Image being transformed */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="صورة العضو"
              draggable={false}
              className="max-w-none transition-transform duration-75 origin-center pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${
                  flipH ? -1 : 1
                })`,
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
            />

            {/* Drag helper hint */}
            <div className="absolute bottom-2 left-2 right-2 bg-slate-950/70 backdrop-blur-xs text-[10px] text-slate-300 py-1 px-2 rounded-lg text-center pointer-events-none z-20 flex items-center justify-center gap-1">
              <Move className="w-3 h-3 text-emerald-400" />
              <span>اسحب للتحريك في أي اتجاه</span>
            </div>
          </div>

          {/* Quick Ratio Selector */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px] font-bold">نسبة القص:</span>
            <button
              type="button"
              onClick={() => setCropAspect('1:1')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                cropAspect === '1:1'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              مربع (1:1) للبطاقة
            </button>
            <button
              type="button"
              onClick={() => setCropAspect('3:4')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                cropAspect === '3:4'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              طولي (3:4) شخصية
            </button>
            <button
              type="button"
              onClick={() => setCropAspect('free')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                cropAspect === 'free'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              كامل الصورة
            </button>
          </div>
        </div>

        {/* Editing Controls Toolbar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-mono text-slate-300 w-12 text-left shrink-0">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action Buttons: Rotate L, Rotate R, Flip, Reset */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleRotateRight}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="تدوير 90 درجة لليمين"
            >
              <RotateCw className="w-4 h-4 text-emerald-400" />
              <span>تدوير يمين 90°</span>
            </button>

            <button
              type="button"
              onClick={handleRotateLeft}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="تدوير 90 درجة لليسار"
            >
              <RotateCcw className="w-4 h-4 text-emerald-400" />
              <span>تدوير يسار 90°</span>
            </button>

            <button
              type="button"
              onClick={handleFlipHorizontal}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="عكس أفقي"
            >
              <FlipHorizontal className="w-4 h-4 text-blue-400" />
              <span>عكس أفقي</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              title="إعادة ضبط للمظهر الأصلي"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>إعادة ضبط</span>
            </button>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleApplyAndSave}
            disabled={isProcessing}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isProcessing ? 'جاري المعالجة والحفظ...' : 'تطبيق وحفظ الصورة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
