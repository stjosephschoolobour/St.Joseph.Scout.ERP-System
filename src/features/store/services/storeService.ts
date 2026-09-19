import { httpClient } from '../../../core/http/httpClient';
import {
  StoreItem,
  StoreResponse,
  StoreItemFormData,
  StoreOrdersResponse,
  StoreOrder,
  SalesAuditResponse,
} from '../types';

export class StoreService {
  private static instance: StoreService;

  private constructor() {}

  public static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  public async getItems(): Promise<StoreResponse> {
    return httpClient.get<StoreResponse>('/api/store/items');
  }

  public async getItem(id: number): Promise<StoreItem> {
    return httpClient.get<StoreItem>(`/api/store/items/${id}`);
  }

  public async createItem(data: StoreItemFormData): Promise<{ success: boolean; message: string; item: StoreItem }> {
    return httpClient.post<{ success: boolean; message: string; item: StoreItem }>('/api/store/items', data);
  }

  public async updateItem(id: number, data: Partial<StoreItemFormData>): Promise<{ success: boolean; message: string; item: StoreItem }> {
    return httpClient.put<{ success: boolean; message: string; item: StoreItem }>(`/api/store/items/${id}`, data);
  }

  public async deleteItem(id: number): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(`/api/store/items/${id}`);
  }

  public async updateStock(id: number, update: { delta?: number; newStock?: number }): Promise<{ success: boolean; message: string; stock: number }> {
    return httpClient.patch<{ success: boolean; message: string; stock: number }>(`/api/store/items/${id}/stock`, update);
  }

  public async uploadItemImage(file: File): Promise<{ success: boolean; photo_path: string; filename: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    return httpClient.postFormData<{ success: boolean; photo_path: string; filename: string }>('/api/photos/upload', formData);
  }

  // --- Orders & Reservations ---
  public async getOrders(): Promise<StoreOrdersResponse> {
    return httpClient.get<StoreOrdersResponse>('/api/store/orders');
  }

  public async createOrder(data: {
    buyer_name: string;
    buyer_phone?: string;
    buyer_type?: string;
    notes?: string;
    items: Array<{ item_id: number; size?: string; quantity: number }>;
  }): Promise<{ success: boolean; message: string; order: StoreOrder }> {
    return httpClient.post<{ success: boolean; message: string; order: StoreOrder }>('/api/store/orders', data);
  }

  public async confirmOrder(orderId: number): Promise<{ success: boolean; message: string; order: StoreOrder }> {
    return httpClient.patch<{ success: boolean; message: string; order: StoreOrder }>(`/api/store/orders/${orderId}/confirm`, {});
  }

  public async payOrder(orderId: number): Promise<{ success: boolean; message: string; order: StoreOrder }> {
    return httpClient.patch<{ success: boolean; message: string; order: StoreOrder }>(`/api/store/orders/${orderId}/pay`, {});
  }

  public async cancelOrder(orderId: number): Promise<{ success: boolean; message: string }> {
    return httpClient.patch<{ success: boolean; message: string }>(`/api/store/orders/${orderId}/cancel`, {});
  }

  // --- Sales & Inventory Audit ---
  public async getSalesAudit(): Promise<SalesAuditResponse> {
    return httpClient.get<SalesAuditResponse>('/api/store/sales-audit');
  }
}

export const storeService = StoreService.getInstance();
