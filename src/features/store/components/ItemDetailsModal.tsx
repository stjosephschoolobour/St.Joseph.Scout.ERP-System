import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShoppingBag,
  Package,
  Tag,
  Check,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { StoreItem } from '../types';

interface ItemDetailsModalProps {
  isOpen: boolean;
  item: StoreItem | null;
  onClose: () => void;
  onAddToCart: (item: StoreItem, size: string | undefined, quantity: number) => void;
  canManage?: boolean;
  onEdit?: (item: StoreItem) => void;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  isOpen,
  item,
  onClose,
  onAddToCart,
  canManage = false,
  onEdit,
}) => {
  // Available sizes
  const sizesList = useMemo(() => {
    if (!item?.sizes) return [];
    return item.sizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [item?.sizes]);

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [addedAnimation, setAddedAnimation] = useState<boolean>(false);

  useEffect(() => {
    if (sizesList.length > 0) {
      setSelectedSize(sizesList[0]);
    } else {
      setSelectedSize('');
    }
    setQuantity(1);
    setAddedAnimation(false);
  }, [item?.id, sizesList]);

  if (!isOpen || !item) return null;

  const isOutOfStock = item.stock <= 0;
  const isLowStock = item.stock > 0 && item.stock <= 5;
  const maxAvailable = Math.max(1, item.stock);

  const handleDecreaseQty = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncreaseQty = () => {
    setQuantity((prev) => Math.min(item.stock, prev + 1));
  };

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(item, selectedSize || undefined, quantity);
    setAddedAnimation(true);
    setTimeout(() => {
      setAddedAnimation(false);
      onClose();
    }, 600);
  };

  const totalPrice = Number(item.price) * quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">تفاصيل الصنف</h2>
              <span className="text-xs text-slate-500">{item.category || 'مهمات الكشافة'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Image Container */}
          <div className="relative w-full aspect-16/10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center border border-slate-200/80">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                <Package className="w-12 h-12 text-slate-300" />
                <span className="text-xs font-medium text-slate-400">لا توجد صورة لهذا الصنف</span>
              </div>
            )}

            {/* Price Badge */}
            <div className="absolute bottom-3 right-3 bg-slate-950/85 text-white px-3.5 py-1.5 rounded-xl backdrop-blur-md shadow-md text-sm font-black flex items-center gap-1 border border-white/10">
              <span>{Number(item.price).toLocaleString('ar-EG')}</span>
              <span className="text-xs text-emerald-400 font-bold">ج.م</span>
            </div>

            {/* Stock Badge */}
            <div className="absolute top-3 right-3">
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 text-white shadow-md">
                  <XCircle className="w-4 h-4" />
                  <span>نفذت الكمية من المتجر</span>
                </span>
              ) : isLowStock ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500 text-white shadow-md">
                  <AlertTriangle className="w-4 h-4" />
                  <span>متبقي {item.stock} قطع فقط</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-md">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>متوفر بالمخزون: {item.stock} قطعة</span>
                </span>
              )}
            </div>
          </div>

          {/* Name and Description */}
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-snug">{item.name}</h3>
            {item.description ? (
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {item.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-2 italic">لا يتوفر وصف تفصيلي لهذا الصنف حالياً.</p>
            )}
          </div>

          {/* Sizes Selection */}
          {sizesList.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <label className="text-xs font-bold text-slate-700">اختر المقاس المطلوب:</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizesList.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-emerald-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      <span>{size}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">الكمية المراد حجزها:</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    يمكنك حجز أكثر من قطعة في نفس الصنف (الحد الأقصى: {item.stock})
                  </p>
                </div>

                {/* Counter Stepper */}
                <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-slate-300 shadow-xs">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={handleDecreaseQty}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <span className="min-w-10 text-center text-sm font-black text-slate-900">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    disabled={quantity >= item.stock}
                    onClick={handleIncreaseQty}
                    className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Total Calculation */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">إجمالي قيمة الحجز للصنف:</span>
                <span className="text-emerald-700 text-sm font-black">
                  {totalPrice.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          {canManage && onEdit ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(item);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-white text-xs font-bold transition"
            >
              تعديل بيانات الصنف
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
          )}

          <button
            type="button"
            disabled={isOutOfStock || addedAnimation}
            onClick={handleAdd}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer ${
              isOutOfStock
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : addedAnimation
                ? 'bg-emerald-800 text-white'
                : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-700/25'
            }`}
          >
            {addedAnimation ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300 animate-bounce" />
                <span>تمت الإضافة لسلة الحجز!</span>
              </>
            ) : isOutOfStock ? (
              <span>نفذت الكمية - غير متاح للحجز</span>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>إضافة إلى الحجز ({totalPrice.toLocaleString('ar-EG')} ج.م)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
