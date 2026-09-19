import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Package,
  DollarSign,
  Tag,
  Layers,
  FileText,
} from 'lucide-react';
import { StoreItem, StoreItemFormData } from '../types';
import { storeService } from '../services/storeService';

interface StoreItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedItem: StoreItem) => void;
  itemToEdit?: StoreItem | null;
}

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'مقاس موحد'];

export const StoreItemFormModal: React.FC<StoreItemFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  itemToEdit,
}) => {
  const isEditing = !!itemToEdit;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState(itemToEdit?.name || '');
  const [description, setDescription] = useState(itemToEdit?.description || '');
  const [stock, setStock] = useState<number | string>(itemToEdit?.stock ?? 10);
  const [price, setPrice] = useState<number | string>(itemToEdit?.price ?? 100);
  const [category, setCategory] = useState(itemToEdit?.category || 'مهمات الكشافة');
  const [imageUrl, setImageUrl] = useState<string | null>(itemToEdit?.image_url || null);

  // Sizes management: parse existing comma-separated sizes into list
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    if (!itemToEdit?.sizes) return [];
    return itemToEdit.sizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  });
  const [customSizeInput, setCustomSizeInput] = useState('');

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(itemToEdit?.image_url || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Toggle size from standard options
  const toggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size));
    } else {
      setSelectedSizes([...selectedSizes, size]);
    }
  };

  // Add custom size
  const handleAddCustomSize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customSizeInput.trim();
    if (trimmed && !selectedSizes.includes(trimmed)) {
      setSelectedSizes([...selectedSizes, trimmed]);
      setCustomSizeInput('');
    }
  };

  const removeSize = (sizeToRemove: string) => {
    setSelectedSizes(selectedSizes.filter((s) => s !== sizeToRemove));
  };

  // Handle image selection
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('حجم الصورة كبير جداً، الحد الأقصى 10 ميجابايت');
      return;
    }
    setImageFile(file);
    setErrorMessage(null);

    // Create local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('يرجى إدخال اسم الصنف');
      return;
    }

    const parsedStock = Math.max(0, parseInt(String(stock), 10) || 0);
    const parsedPrice = Math.max(0, parseFloat(String(price)) || 0);

    setSubmitting(true);
    try {
      let finalImageUrl = imageUrl;

      // If a new local image file was picked, upload it first
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const uploadRes = await storeService.uploadItemImage(imageFile);
          if (uploadRes && uploadRes.photo_path) {
            finalImageUrl = uploadRes.photo_path;
          }
        } catch (uploadErr: any) {
          console.error('Image upload failed:', uploadErr);
          setErrorMessage('فشل رفع صورة الصنف. يمكنك المتابعة بدون صورة أو تجربة صورة أخرى.');
          setSubmitting(false);
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      const sizesString = selectedSizes.join(', ');

      const payload: StoreItemFormData = {
        name: name.trim(),
        description: description.trim(),
        stock: parsedStock,
        sizes: sizesString,
        price: parsedPrice,
        image_url: finalImageUrl,
        category: category.trim() || 'مهمات الكشافة',
      };

      if (isEditing && itemToEdit) {
        const res = await storeService.updateItem(itemToEdit.id, payload);
        onSuccess(res.item);
      } else {
        const res = await storeService.createItem(payload);
        onSuccess(res.item);
      }
      onClose();
    } catch (err: any) {
      console.error('Save store item error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الصنف. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isEditing ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد للمتجر'}
              </h3>
              <p className="text-xs text-emerald-100/80">
                أدخل تفاصيل ومواصفات ومخزون الصنف الكشفي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. رفع صورة للصنف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>صورة الصنف</span>
              <span className="text-[11px] font-normal text-slate-400">(اختياري - يفضل صورة واضحة)</span>
            </label>

            {imagePreview ? (
              <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-2 flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 relative flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="صورة الصنف"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {imageFile ? imageFile.name : 'الصورة المحفوظة للصنف'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {imageFile
                      ? `${(imageFile.size / 1024).toFixed(1)} كيلوبايت`
                      : 'تم تحميل الصورة بنجاح'}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition"
                    >
                      تغيير الصورة
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/60'
                    : 'border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-emerald-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    انقر لاختيار صورة أو اسحب الصورة وأفلتها هنا
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    يدعم ملفات JPG, PNG, WebP حتى 10 ميجابايت
                  </p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* 2. اسم الصنف والتصنيف */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <span>اسم الصنف</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: القميص الكشفي الرسمي، منديل الكشافة، كاب كشفي..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>التصنيف</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="الزي الرسمي">الزي الرسمي</option>
                <option value="إكسسوارات">إكسسوارات وشارات</option>
                <option value="مهمات المعسكرات">مهمات المعسكرات</option>
                <option value="أدوات كشفية">أدوات كشفية</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
          </div>

          {/* 3. الوصف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>الوصف</span>
            </label>
            <textarea
              rows={2}
              placeholder="اكتب وصفاً مختصراً لخامة الصنف ومواصفاته أو ملاحظات خاصة بالاستخدام..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
            />
          </div>

          {/* 4. السعر والمخزون */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* السعر */}
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>سعر البيع</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-emerald-700 font-bold">بالجنيه المصري (ج.م)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white pl-12"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ج.م
                </span>
              </div>
            </div>

            {/* عدد المخزون */}
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-teal-600" />
                  <span>عدد المخزون</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-slate-500">الكمية المتوفرة حالياً</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStock(Math.max(0, (parseInt(String(stock), 10) || 0) - 1))}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold flex items-center justify-center transition"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setStock((parseInt(String(stock), 10) || 0) + 1)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold flex items-center justify-center transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 5. المقاسات المتوفرة */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>المقاسات المتوفرة</span>
              </span>
              <span className="text-[11px] text-slate-400">اختر المقاسات أو أضف مقاساً مخصصاً</span>
            </label>

            {/* Standard sizes quick selection */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {COMMON_SIZES.map((size) => {
                const isSelected = selectedSizes.includes(size);
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{size}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom size input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="إضافة مقاس مخصص (مثل: 35 لتر، مقاس 12، وسط...)"
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomSize();
                  }
                }}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddCustomSize}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>

            {/* Selected sizes preview list */}
            {selectedSizes.length > 0 ? (
              <div className="mt-2.5 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] font-bold text-emerald-800 ml-1">المقاسات المختارة:</span>
                {selectedSizes.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSize(s)}
                      className="w-3.5 h-3.5 rounded-full hover:bg-white/20 flex items-center justify-center transition text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1.5">
                لم يتم اختيار مقاسات بعد (يمكن تركها فارغة للأصناف التي لا تحتوي مقاسات).
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isUploadingImage ? 'جاري رفع الصورة...' : 'جاري الحفظ...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'حفظ التعديلات' : 'إضافة الصنف للمتجر'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
