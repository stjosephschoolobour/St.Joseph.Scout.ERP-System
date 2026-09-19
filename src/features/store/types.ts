export interface StoreItem {
  id: number;
  name: string;
  description?: string | null;
  stock: number;
  sizes?: string | null;
  price: number;
  image_url?: string | null;
  category?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreStats {
  totalItems: number;
  totalStock: number;
  outOfStockCount: number;
  totalInventoryValue: number;
}

export interface StoreResponse {
  items: StoreItem[];
  stats: StoreStats;
}

export interface StoreItemFormData {
  name: string;
  description: string;
  stock: number;
  sizes: string;
  price: number;
  image_url?: string | null;
  category?: string;
}

export type StoreOrderStatus = 'PENDING' | 'WAITING_PICKUP' | 'SOLD' | 'CANCELLED';

export interface StoreOrderItem {
  id: number;
  order_id: number;
  item_id: number;
  item_name: string;
  size?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
}

export interface StoreOrder {
  id: number;
  order_number: string;
  user_id?: number | null;
  user_name?: string | null;
  user_role?: string | null;
  buyer_name: string;
  buyer_phone?: string | null;
  buyer_type?: string | null;
  member_id?: number | null;
  tribe_id?: number | null;
  tribe_name?: string | null;
  total_items: number;
  total_price: number;
  status: StoreOrderStatus;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: StoreOrderItem[];
  father_phone?: string | null;
  mother_phone?: string | null;
  leader_phone?: string | null;
  target_phone?: string | null;
  phone_type?: string | null;
  guardian_name?: string | null;
}

export interface StoreOrderStats {
  pendingCount: number;
  waitingPickupCount: number;
  soldCount: number;
  cancelledCount: number;
  totalSoldRevenue: number;
  pendingRevenue: number;
  totalPiecesSold: number;
  totalOrders: number;
}

export interface StoreOrdersResponse {
  orders: StoreOrder[];
  stats: StoreOrderStats;
}

export interface StoreCartItem {
  item: StoreItem;
  size?: string;
  quantity: number;
}

export interface FinancialSummary {
  totalSoldRevenue: number;
  pendingRevenue: number;
  totalSoldUnits: number;
  totalSoldOrders: number;
  activeReservationsCount: number;
  totalRemainingStock: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface InventoryAuditItem extends StoreItem {
  sold_units: number;
  sold_revenue: number;
  inventory_value: number;
}

export interface SalesAuditResponse {
  financialSummary: FinancialSummary;
  completedSales: StoreOrder[];
  activeReservations: StoreOrder[];
  inventory: InventoryAuditItem[];
}
