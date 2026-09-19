import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  BarChart3,
  DollarSign,
  Package,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  PackageCheck,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet,
  Boxes,
  User,
  Phone,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SalesAuditResponse, StoreOrder } from '../types';
import { storeService } from '../services/storeService';
import { OrderReceiptModal } from './OrderReceiptModal';

interface SalesAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SalesAuditModal: React.FC<SalesAuditModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'financials' | 'reservations' | 'inventory'>('financials');
  const [data, setData] = useState<SalesAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptOrder, setReceiptOrder] = useState<StoreOrder | null>(null);

  const fetchAuditData = async (isSilent = false) => {
    if (isSilent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await storeService.getSalesAudit();
      setData(res);
    } catch (err: any) {
      console.error('Fetch sales audit error:', err);
      setError(err.message || 'فشل استخراج تقرير المبيعات والمخزون');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditData();
    }
  }, [isOpen]);

  // Filtered Completed Sales
  const filteredSales = useMemo(() => {
    if (!data?.completedSales) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return data.completedSales;

    return data.completedSales.filter(
      (s) =>
        s.order_number.toLowerCase().includes(q) ||
        s.buyer_name.toLowerCase().includes(q) ||
        (s.buyer_phone || '').includes(q) ||
        (s.items || []).some((i) => i.item_name.toLowerCase().includes(q))
    );
  }, [data?.completedSales, searchQuery]);

  // Filtered Active Reservations
  const filteredReservations = useMemo(() => {
    if (!data?.activeReservations) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return data.activeReservations;

    return data.activeReservations.filter(
      (r) =>
        r.order_number.toLowerCase().includes(q) ||
        r.buyer_name.toLowerCase().includes(q) ||
        (r.buyer_phone || '').includes(q) ||
        (r.items || []).some((i) => i.item_name.toLowerCase().includes(q))
    );
  }, [data?.activeReservations, searchQuery]);

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    if (!data?.inventory) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return data.inventory;

    return data.inventory.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.sizes && item.sizes.toLowerCase().includes(q))
    );
  }, [data?.inventory, searchQuery]);

  // Excel Export: Sales
  const handleExportSalesExcel = () => {
    if (!data?.completedSales || data.completedSales.length === 0) {
      alert('لا توجد مبيعات منتهية لتصديرها');
      return;
    }

    const rows = data.completedSales.map((sale, idx) => {
      const itemsDetail = (sale.items || [])
        .map((i) => `${i.item_name}${i.size ? ` (${i.size})` : ''} × ${i.quantity}`)
        .join(' | ');

      return {
        'م': idx + 1,
        'رقم الإيصال/الطلب': sale.order_number,
        'اسم المشتري': sale.buyer_name,
        'الهاتف': sale.buyer_phone || '-',
        'الأصناف المباعة': itemsDetail,
        'إجمالي عدد القطع': sale.total_items,
        'المبلغ الإجمالي (ج.م)': sale.total_price,
        'تاريخ السداد': sale.paid_at ? new Date(sale.paid_at).toLocaleString('ar-EG') : '-',
        'القائم بالتحصيل': sale.paid_by || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل المبيعات');
    XLSX.writeFile(workbook, `كشف_مبيعات_المتجر_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Excel Export: Inventory
  const handleExportInventoryExcel = () => {
    if (!data?.inventory || data.inventory.length === 0) {
      alert('لا توجد بيانات مخزون لتصديرها');
      return;
    }

    const rows = data.inventory.map((item, idx) => ({
      'م': idx + 1,
      'اسم الصنف': item.name,
      'التصنيف': item.category || 'مهمات الكشافة',
      'المقاسات': item.sizes || 'مقاس موحد',
      'المخزون المتبقي': item.stock,
      'سعر القطعة (ج.م)': item.price,
      'قيمة المخزون المتبقي (ج.م)': item.inventory_value,
      'إجمالي القطع المباعة': item.sold_units,
      'عائد المبيعات (ج.م)': item.sold_revenue,
      'الحالة': item.stock === 0 ? 'نفذت الكمية' : item.stock <= 5 ? 'مخزون منخفض' : 'متوفر',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'جرد المخزون');
    XLSX.writeFile(workbook, `جرد_مخزون_المتجر_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = data?.financialSummary || {
    totalSoldRevenue: 0,
    pendingRevenue: 0,
    totalSoldUnits: 0,
    totalSoldOrders: 0,
    activeReservationsCount: 0,
    totalRemainingStock: 0,
    totalInventoryValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                سجل المبيعات والحسابات والمخزون المتبقي
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                متابعة عمليات البيع المنتهية، الحجوزات النشطة، وجرد المخزون الفعلي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAuditData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Financial KPI Cards */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">إجمالي المبيعات المحصلة</p>
              <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                {summary.totalSoldRevenue.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-emerald-700">ج.م</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">قيد التحصيل (حجوزات)</p>
              <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                {summary.pendingRevenue.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-blue-700">ج.م</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">إجمالي القطع المباعة</p>
              <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                {summary.totalSoldUnits.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">قطعة</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">قيمة المخزون المتبقي</p>
              <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                {summary.totalInventoryValue.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-purple-700">ج.م</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selector & Actions */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('financials')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'financials'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>عمليات البيع المنتهية ({data?.completedSales.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('reservations')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'reservations'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>الحجوزات النشطة ({data?.activeReservations.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>جرد المخزون المتبقي ({data?.inventory.length || 0})</span>
            </button>
          </div>

          {/* Action buttons (Export / Print) */}
          <div className="flex items-center gap-2">
            {activeTab === 'financials' && (
              <button
                type="button"
                onClick={handleExportSalesExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>تصدير كشف المبيعات (Excel)</span>
              </button>
            )}

            {activeTab === 'inventory' && (
              <button
                type="button"
                onClick={handleExportInventoryExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>تصدير جرد المخزون (Excel)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              title="طباعة التقرير"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder={
                activeTab === 'inventory'
                  ? 'بحث باسم الصنف، التصنيف، أو المقاس...'
                  : 'بحث برقم الإيصال، اسم المشتري، الهاتف، أو الصنف...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-9 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">جاري استخراج السجلات والحسابات...</p>
            </div>
          ) : activeTab === 'financials' ? (
            /* TAB 1: Completed Sales */
            filteredSales.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">لا توجد عمليات بيع منتهية حتى الآن</p>
                <p className="text-[11px] text-slate-400">عند الضغط على "السداد" لأي حجز سيتم إدراجه هنا كعملية بيع منتهية.</p>
              </div>
            ) : (
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-right divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-600 font-black">
                    <tr>
                      <th className="p-3">رقم الإيصال</th>
                      <th className="p-3">المشتري</th>
                      <th className="p-3">الأصناف المباعة</th>
                      <th className="p-3 text-center">عدد القطع</th>
                      <th className="p-3 text-left">المبلغ المحصل</th>
                      <th className="p-3">تاريخ السداد</th>
                      <th className="p-3">مسؤول التحصيل</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3 font-black text-slate-900 whitespace-nowrap">
                          {sale.order_number}
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{sale.buyer_name}</p>
                          {sale.buyer_phone && (
                            <span className="text-[10px] text-slate-400" dir="ltr">
                              {sale.buyer_phone}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {(sale.items || []).map((itm) => (
                              <div key={itm.id} className="text-slate-700">
                                <span>{itm.item_name}</span>
                                {itm.size && (
                                  <span className="text-emerald-700 font-bold mx-1">
                                    ({itm.size})
                                  </span>
                                )}
                                <span className="text-slate-400 text-[10px] font-bold">
                                  × {itm.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {sale.total_items}
                        </td>
                        <td className="p-3 text-left font-black text-emerald-700 text-sm whitespace-nowrap">
                          {Number(sale.total_price).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {sale.paid_at
                            ? new Date(sale.paid_at).toLocaleDateString('ar-EG', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="p-3 text-slate-600 font-bold whitespace-nowrap">
                          {sale.paid_by || '-'}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setReceiptOrder(sale)}
                            className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            title="عرض الإيصال وإرساله كصورة عبر الواتساب"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>إيصال</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'reservations' ? (
            /* TAB 2: Active Reservations */
            filteredReservations.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Clock className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">لا توجد حجوزات نشطة حالياً</p>
              </div>
            ) : (
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-right divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-600 font-black">
                    <tr>
                      <th className="p-3">رقم الحجز</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">اسم الحاجز</th>
                      <th className="p-3">الأصناف المحجوزة</th>
                      <th className="p-3 text-center">القطع</th>
                      <th className="p-3 text-left">المبلغ المطلوب</th>
                      <th className="p-3">تاريخ الحجز</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredReservations.map((resv) => (
                      <tr key={resv.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3 font-black text-slate-900 whitespace-nowrap">
                          {resv.order_number}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {resv.status === 'PENDING' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
                              قيد الانتظار
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200">
                              في انتظار الاستلام
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{resv.buyer_name}</p>
                          {resv.buyer_phone && (
                            <span className="text-[10px] text-slate-400" dir="ltr">
                              {resv.buyer_phone}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {(resv.items || []).map((itm) => (
                              <div key={itm.id} className="text-slate-700">
                                <span>{itm.item_name}</span>
                                {itm.size && (
                                  <span className="text-emerald-700 font-bold mx-1">
                                    ({itm.size})
                                  </span>
                                )}
                                <span className="text-slate-400 text-[10px] font-bold">
                                  × {itm.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {resv.total_items}
                        </td>
                        <td className="p-3 text-left font-black text-slate-900 text-sm whitespace-nowrap">
                          {Number(resv.total_price).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {new Date(resv.created_at).toLocaleDateString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setReceiptOrder(resv)}
                            className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            title="عرض الإيصال وإرساله كصورة عبر الواتساب"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>إيصال</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* TAB 3: Remaining Inventory Audit */
            <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-right divide-y divide-slate-100">
                <thead className="bg-slate-50 text-slate-600 font-black">
                  <tr>
                    <th className="p-3">اسم الصنف</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">المقاسات</th>
                    <th className="p-3 text-center">المخزون المتبقي</th>
                    <th className="p-3 text-center">القطع المباعة</th>
                    <th className="p-3 text-left">سعر القطعة</th>
                    <th className="p-3 text-left">قيمة المخزون</th>
                    <th className="p-3 text-center">حالة التوفر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredInventory.map((item) => {
                    const isOutOfStock = item.stock <= 0;
                    const isLowStock = item.stock > 0 && item.stock <= 5;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3 font-bold text-slate-900">{item.name}</td>
                        <td className="p-3 text-slate-500">{item.category || 'مهمات الكشافة'}</td>
                        <td className="p-3 text-slate-600 font-medium">
                          {item.sizes || 'مقاس موحد'}
                        </td>
                        <td className="p-3 text-center font-black text-sm text-slate-900">
                          {item.stock}
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-800">
                          {item.sold_units || 0}
                        </td>
                        <td className="p-3 text-left font-bold text-slate-700">
                          {Number(item.price).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 text-left font-black text-slate-900">
                          {Number(item.inventory_value).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 text-center">
                          {isOutOfStock ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200">
                              نفذت الكمية
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200">
                              مخزون منخفض
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                              متوفر
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>نظام الكشافة - مدرسة القديس يوسف بالعبور</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Official Receipt & WhatsApp Share Modal */}
      <OrderReceiptModal
        isOpen={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(null)}
        order={receiptOrder}
      />
    </div>
  );
};
