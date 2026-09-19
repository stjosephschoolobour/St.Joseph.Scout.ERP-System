import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Package,
  AlertTriangle,
  Boxes,
  DollarSign,
  RefreshCw,
  Sparkles,
  X,
  Trash2,
  CheckCircle2,
  ClipboardList,
  BarChart3,
  ShoppingCart,
  Clock,
} from 'lucide-react';
import { StoreItem, StoreStats, StoreCartItem, StoreOrder } from '../types';
import { storeService } from '../services/storeService';
import { StoreItemCard } from './StoreItemCard';
import { StoreItemFormModal } from './StoreItemFormModal';
import { ItemDetailsModal } from './ItemDetailsModal';
import { ReservationCartModal } from './ReservationCartModal';
import { ReservationsManagerModal } from './ReservationsManagerModal';
import { SalesAuditModal } from './SalesAuditModal';
import { MyReservationsModal } from './MyReservationsModal';

interface StoreViewProps {
  userRole?: string;
  currentUser?: {
    username?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    tribe_name?: string;
  };
}

export const StoreView: React.FC<StoreViewProps> = ({
  userRole = 'ADMIN',
  currentUser,
}) => {
  // Roles
  const canManage = userRole === 'ADMIN' || userRole === 'DATA_ENTRY';
  const isLeaderOrMember = userRole === 'LEADER' || userRole === 'MEMBER';

  const [items, setItems] = useState<StoreItem[]>([]);
  const [stats, setStats] = useState<StoreStats>({
    totalItems: 0,
    totalStock: 0,
    outOfStockCount: 0,
    totalInventoryValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Reservation Cart State
  const [cartItems, setCartItems] = useState<StoreCartItem[]>(() => {
    try {
      const saved = localStorage.getItem('scout_store_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('scout_store_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cartItems]);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<StoreItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<StoreItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Modals for Booking & Management
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<StoreItem | null>(null);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isReservationsModalOpen, setIsReservationsModalOpen] = useState(false);
  const [isSalesAuditModalOpen, setIsSalesAuditModalOpen] = useState(false);
  const [isMyReservationsModalOpen, setIsMyReservationsModalOpen] = useState(false);

  // Lightbox preview
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Toast alert
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Cart Calculations
  const cartTotalQuantity = useMemo(() => {
    return cartItems.reduce((acc, itm) => acc + itm.quantity, 0);
  }, [cartItems]);

  const cartTotalPrice = useMemo(() => {
    return cartItems.reduce((acc, itm) => acc + Number(itm.item.price) * itm.quantity, 0);
  }, [cartItems]);

  // Cart Handlers
  const handleAddToCart = (item: StoreItem, size: string | undefined, quantity: number) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.item.id === item.id && (ci.size || '') === (size || '')
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        const newQty = Math.min(item.stock, updated[existingIdx].quantity + quantity);
        updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
        return updated;
      } else {
        return [...prev, { item, size, quantity }];
      }
    });

    showNotification(
      `تمت إضافة ${quantity} قطعة من "${item.name}" إلى سلة الحجز`,
      'success'
    );
  };

  const handleUpdateCartQuantity = (itemId: number, size: string | undefined, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((ci) => {
          if (ci.item.id === itemId && (ci.size || '') === (size || '')) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: Math.min(ci.item.stock, newQty) } : null;
          }
          return ci;
        })
        .filter(Boolean) as StoreCartItem[];
    });
  };

  const handleRemoveFromCart = (itemId: number, size: string | undefined) => {
    setCartItems((prev) =>
      prev.filter(
        (ci) => !(ci.item.id === itemId && (ci.size || '') === (size || ''))
      )
    );
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleOrderSuccess = (order: StoreOrder) => {
    showNotification(
      `تم تأكيد وتسجيل طلب الحجز بنجاح برقم (${order.order_number}) بإجمالي ${Number(order.total_price).toLocaleString('ar-EG')} ج.م`,
      'success'
    );
    fetchItems(true);
  };

  // Fetch store items
  const fetchItems = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await storeService.getItems();
      setItems(data.items || []);
      setStats(data.stats || {
        totalItems: 0,
        totalStock: 0,
        outOfStockCount: 0,
        totalInventoryValue: 0,
      });
    } catch (err: any) {
      console.error('Fetch store items error:', err);
      setError(err.message || 'فشل تحميل بيانات المتجر والأصناف');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.sizes && item.sizes.toLowerCase().includes(query));

      // Category
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;

      // Stock
      let matchStock = true;
      if (stockFilter === 'in_stock') {
        matchStock = item.stock > 0;
      } else if (stockFilter === 'low_stock') {
        matchStock = item.stock > 0 && item.stock <= 5;
      } else if (stockFilter === 'out_of_stock') {
        matchStock = item.stock <= 0;
      }

      return matchQuery && matchCategory && matchStock;
    });
  }, [items, searchQuery, selectedCategory, stockFilter]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [items]);

  // Handlers
  const handleOpenAddModal = () => {
    setItemToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: StoreItem) => {
    setItemToEdit(item);
    setIsFormModalOpen(true);
  };

  const handleItemSaved = (savedItem: StoreItem) => {
    fetchItems(true);
    showNotification(itemToEdit ? `تم تحديث الصنف "${savedItem.name}" بنجاح` : `تمت إضافة الصنف "${savedItem.name}" بنجاح`);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await storeService.deleteItem(itemToDelete.id);
      showNotification(`تم حذف الصنف "${itemToDelete.name}" بنجاح`);
      setItemToDelete(null);
      fetchItems(true);
    } catch (err: any) {
      console.error('Delete error:', err);
      showNotification(err.message || 'فشل حذف الصنف', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStockChange = async (itemId: number, delta: number) => {
    try {
      const res = await storeService.updateStock(itemId, { delta });
      // Update local state smoothly
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, stock: res.stock } : item))
      );
      // Update stats
      setStats((prev) => {
        const item = items.find((i) => i.id === itemId);
        const price = item ? Number(item.price) : 0;
        const oldStock = item ? Number(item.stock) : 0;
        const newStock = res.stock;
        const diff = newStock - oldStock;
        return {
          ...prev,
          totalStock: Math.max(0, prev.totalStock + diff),
          totalInventoryValue: Math.max(0, prev.totalInventoryValue + diff * price),
          outOfStockCount:
            oldStock > 0 && newStock === 0
              ? prev.outOfStockCount + 1
              : oldStock === 0 && newStock > 0
              ? Math.max(0, prev.outOfStockCount - 1)
              : prev.outOfStockCount,
        };
      });
    } catch (err: any) {
      console.error('Stock adjustment error:', err);
      showNotification('فشل تعديل المخزون', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 left-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold text-white ${
              notification.type === 'success'
                ? 'bg-emerald-900 border-emerald-700'
                : 'bg-rose-900 border-rose-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Title & Info */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-lg shadow-emerald-700/20 shrink-0">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  متجر ومهمات الكشافة
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  {stats.totalItems} أصناف
                </span>
                {cartTotalQuantity > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-xs font-bold animate-pulse">
                    {cartTotalQuantity} في السلة
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {canManage
                  ? 'إدارة الأصناف، متابعة طلبات الحجز وتأكيدها، تسجيل المبيعات والسداد، وجرد المخزون'
                  : 'استعراض الزي الكشفي والمهمات، اختيار المقاسات، وحجز الأصناف واستلامها من مقر الكشافة'}
              </p>
            </div>
          </div>

          {/* Role-Based Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Refresh */}
            <button
              onClick={() => fetchItems(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-emerald-700 transition flex items-center justify-center cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* ADMIN / DATA_ENTRY ACTION BUTTONS */}
            {canManage && (
              <>
                {/* 1. Add New Item Button */}
                <button
                  id="btn-add-store-item"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/25 flex items-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>إضافة صنف جديد</span>
                </button>

                {/* 2. Reservations Manager Button (إدارة الحجوزات وتأكيدها وتحويلها لانتظار الاستلام والسداد) */}
                <button
                  id="btn-manage-reservations"
                  onClick={() => setIsReservationsModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-700/20 flex items-center gap-2 transition cursor-pointer"
                  title="متابعة الحجوزات وتأكيدها وتسجيل السداد"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>إدارة الحجوزات وتأكيدها</span>
                </button>

                {/* 3. Sales & Financial Accounts & Inventory Audit Button (سجل المبيعات والحسابات والمخزون المتبقي) */}
                <button
                  id="btn-sales-inventory-audit"
                  onClick={() => setIsSalesAuditModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-slate-900/20 flex items-center gap-2 transition cursor-pointer"
                  title="كشف حسابات المبيعات المنتهية وجرد المخزون"
                >
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>سجل المبيعات والحسابات والمخزون</span>
                </button>
              </>
            )}

            {/* LEADER / MEMBER ACTION BUTTONS */}
            {isLeaderOrMember && (
              <>
                {/* My Reservations Button */}
                <button
                  onClick={() => setIsMyReservationsModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold border border-slate-200 flex items-center gap-2 transition cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>حجوزاتي ومتابعة الطلبات</span>
                </button>

                {/* Placed exactly where 'إضافة صنف جديد' was: Complete Booking Button */}
                <button
                  id="btn-complete-reservation"
                  onClick={() => setIsCartModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-700/25 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    إتمام وتأكيد الحجز
                    {cartTotalQuantity > 0 && ` (${cartTotalQuantity} قطع - ${cartTotalPrice.toLocaleString('ar-EG')} ج.م)`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">إجمالي الأصناف</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">
                {stats.totalItems.toLocaleString('ar-EG')}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">إجمالي قطع المخزون</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">
                {stats.totalStock.toLocaleString('ar-EG')} <span className="text-xs font-normal text-slate-500">قطعة</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">أصناف نفذت</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">
                {stats.outOfStockCount.toLocaleString('ar-EG')}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">قيمة المخزون الإجمالية</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">
                {stats.totalInventoryValue.toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-500">ج.م</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder="بحث باسم الصنف، الوصف، أو المقاس..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="w-full lg:w-auto flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">كل التصنيفات ({items.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Stock Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                stockFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                stockFilter === 'in_stock'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              المتوفر
            </button>
            <button
              onClick={() => setStockFilter('low_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                stockFilter === 'low_stock'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              منخفض (&le; 5)
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                stockFilter === 'out_of_stock'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              نفذ
            </button>
          </div>
        </div>
      </div>

      {/* Content Area: Grid of Cards */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل أصناف المتجر...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-xs">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-rose-700">{error}</p>
          <button
            onClick={() => fetchItems()}
            className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {items.length === 0 ? 'لا توجد أصناف في المتجر حالياً' : 'لا توجد أصناف تطابق نتائج البحث'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md">
            {items.length === 0
              ? 'يمكن البدء بإضافة أصناف جديدة مثل الزي الكشفي، المنديل، الشارات، أو مهمات المعسكرات وتحديد مقاساتها وأسعارها.'
              : 'جرب تغيير عبارة البحث أو إزالة المرشحات لإظهار باقي الأصناف.'}
          </p>
          {items.length === 0 && canManage ? (
            <button
              onClick={handleOpenAddModal}
              className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول صنف الآن</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setStockFilter('all');
              }}
              className="mt-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => {
            // Count pieces of this item in reservation cart
            const inCartPieces = cartItems
              .filter((ci) => ci.item.id === item.id)
              .reduce((acc, ci) => acc + ci.quantity, 0);

            return (
              <StoreItemCard
                key={item.id}
                item={item}
                onOpenDetails={(itm) => setSelectedItemForDetails(itm)}
                onEdit={handleOpenEditModal}
                onDelete={(target) => setItemToDelete(target)}
                onStockChange={handleStockChange}
                onViewImage={(url, title) => setPreviewImage({ url, title })}
                canManage={canManage}
                cartQuantity={inCartPieces}
              />
            );
          })}
        </div>
      )}

      {/* Item Details & Booking Modal (For selecting size & quantity & adding to reservation) */}
      {selectedItemForDetails && (
        <ItemDetailsModal
          isOpen={true}
          item={selectedItemForDetails}
          onClose={() => setSelectedItemForDetails(null)}
          onAddToCart={handleAddToCart}
          canManage={canManage}
          onEdit={handleOpenEditModal}
        />
      )}

      {/* Reservation Cart Modal (Opened by button replacing Add Item for members/leaders, or cart badge) */}
      {isCartModalOpen && (
        <ReservationCartModal
          isOpen={true}
          onClose={() => setIsCartModalOpen(false)}
          cartItems={cartItems}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={handleClearCart}
          onOrderSuccess={handleOrderSuccess}
          currentUser={currentUser}
        />
      )}

      {/* Reservations Manager Modal (For Admin & Data Entry: Confirmations & Payment) */}
      {isReservationsModalOpen && (
        <ReservationsManagerModal
          isOpen={true}
          onClose={() => setIsReservationsModalOpen(false)}
          onRefreshParentItems={() => fetchItems(true)}
        />
      )}

      {/* Sales, Financial Accounts & Remaining Inventory Audit Modal */}
      {isSalesAuditModalOpen && (
        <SalesAuditModal
          isOpen={true}
          onClose={() => setIsSalesAuditModalOpen(false)}
        />
      )}

      {/* My Reservations Modal (For Members and Leaders to track their booking status) */}
      {isMyReservationsModalOpen && (
        <MyReservationsModal
          isOpen={true}
          onClose={() => setIsMyReservationsModalOpen(false)}
          onRefreshParentItems={() => fetchItems(true)}
        />
      )}

      {/* Add / Edit Form Modal (Admin & Data Entry only) */}
      {isFormModalOpen && (
        <StoreItemFormModal
          isOpen={true}
          onClose={() => {
            setIsFormModalOpen(false);
            setItemToEdit(null);
          }}
          onSuccess={handleItemSaved}
          itemToEdit={itemToEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">حذف صنف من المتجر</h3>
            <p className="text-xs text-slate-500 mt-2">
              هل أنت متأكد من رغبتك في حذف الصنف{' '}
              <span className="font-bold text-slate-800">"{itemToDelete.name}"</span>؟
              لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>تأكيد الحذف</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-transparent rounded-2xl overflow-hidden flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10"
            />
            <p className="text-white text-sm font-bold mt-3 text-center bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-xs">
              {previewImage.title}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
