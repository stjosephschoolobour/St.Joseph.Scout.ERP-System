import React, { useState } from 'react';
import {
  Package,
  Tag,
  Edit2,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  ShoppingBag,
} from 'lucide-react';
import { StoreItem } from '../types';

interface StoreItemCardProps {
  item: StoreItem;
  onEdit: (item: StoreItem) => void;
  onDelete: (item: StoreItem) => void;
  onStockChange: (itemId: number, delta: number) => Promise<void>;
  onViewImage?: (imageUrl: string, title: string) => void;
  onOpenDetails: (item: StoreItem) => void;
  canManage?: boolean;
  cartQuantity?: number;
}

export const StoreItemCard: React.FC<StoreItemCardProps> = ({
  item,
  onEdit,
  onDelete,
  onStockChange,
  onViewImage,
  onOpenDetails,
  canManage = true,
  cartQuantity = 0,
}) => {
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Parse sizes string into array
  const sizesList = item.sizes
    ? item.sizes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Stock status determination
  const isOutOfStock = item.stock <= 0;
  const isLowStock = item.stock > 0 && item.stock <= 5;

  const handleAdjustStock = async (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdatingStock) return;
    if (delta < 0 && item.stock <= 0) return;

    setIsUpdatingStock(true);
    try {
      await onStockChange(item.id, delta);
    } finally {
      setIsUpdatingStock(false);
    }
  };

  return (
    <div
      id={`store-item-card-${item.id}`}
      onClick={() => onOpenDetails(item)}
      className="group bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-400 transition-all duration-300 flex flex-col overflow-hidden relative cursor-pointer"
      dir="rtl"
    >
      {/* In-Cart Floating Indicator */}
      {cartQuantity > 0 && (
        <div className="absolute top-3 left-3 z-10 bg-emerald-700 text-white px-2.5 py-1 rounded-xl text-[11px] font-black shadow-md border border-white/20 flex items-center gap-1 animate-in fade-in zoom-in duration-200">
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>في السلة: {cartQuantity}</span>
        </div>
      )}

      {/* Top Image Container */}
      <div className="relative w-full aspect-4/3 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center border-b border-slate-100">
        {item.image_url && !imageError ? (
          <>
            <img
              src={item.image_url}
              alt={item.name}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
            )}
            {/* View Full Image Overlay button */}
            {onViewImage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewImage(item.image_url!, item.name);
                }}
                className="absolute top-3 left-3 w-8 h-8 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-white backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md"
                title="عرض الصورة كاملة"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center text-emerald-600/70">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <span className="text-[11px] font-medium text-slate-400">لا توجد صورة مرفوعة</span>
          </div>
        )}

        {/* Price Pill Floating on top right */}
        <div className="absolute bottom-3 right-3 bg-slate-900/85 hover:bg-slate-900 text-white px-3 py-1 rounded-xl backdrop-blur-md shadow-md text-xs font-black tracking-wide flex items-center gap-1 border border-white/10">
          <span>{Number(item.price).toLocaleString('ar-EG')}</span>
          <span className="text-[10px] text-emerald-400 font-bold">ج.م</span>
        </div>

        {/* Stock Badge on Top Right */}
        <div className="absolute top-3 right-3">
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-600 text-white shadow-xs">
              <XCircle className="w-3.5 h-3.5" />
              <span>نفذت الكمية</span>
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500 text-white shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>متبقي {item.stock} فقط</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>متوفر: {item.stock}</span>
            </span>
          )}
        </div>

        {/* Category Pill on bottom left if exists */}
        {item.category && (
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-200 shadow-xs">
            {item.category}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Item Name */}
          <h3 className="text-sm sm:text-base font-black text-slate-800 leading-snug line-clamp-2 group-hover:text-emerald-700 transition">
            {item.name}
          </h3>

          {/* Description */}
          {item.description ? (
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2" title={item.description}>
              {item.description}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1.5 italic">بدون وصف تفصيلي</p>
          )}
        </div>

        {/* Available Sizes Section */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Tag className="w-3 h-3 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-600">المقاسات المتوفرة:</span>
          </div>
          {sizesList.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sizesList.map((size) => (
                <span
                  key={size}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200/60 transition"
                >
                  {size}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">مقاس موحد / غير محدد</span>
          )}
        </div>

        {/* Card Footer: Stock controls & Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {canManage ? (
            <>
              {/* Quick stock stepper for manager */}
              <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200/80">
                <button
                  type="button"
                  disabled={isUpdatingStock || item.stock <= 0}
                  onClick={(e) => handleAdjustStock(-1, e)}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs font-bold transition disabled:opacity-40"
                  title="إنقاص المخزون بنسبة 1"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="min-w-8 text-center text-xs font-bold text-slate-800">
                  {item.stock}
                </span>
                <button
                  type="button"
                  disabled={isUpdatingStock}
                  onClick={(e) => handleAdjustStock(1, e)}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs font-bold transition disabled:opacity-40"
                  title="زيادة المخزون بنسبة 1"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Edit / Delete actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 flex items-center justify-center transition border border-slate-200/60"
                  title="تعديل بيانات الصنف"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition border border-slate-200/60"
                  title="حذف الصنف من المتجر"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            /* Member & Leader View: Action button to open reservation / select quantity */
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(item);
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                isOutOfStock
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{isOutOfStock ? 'نفذت الكمية' : 'حجز الصنف وتحديد المقاس'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
