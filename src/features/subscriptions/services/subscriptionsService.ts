import { httpClient } from '../../../core/http/httpClient';
import { SubscriptionYearOption, AnnualSubscriptionData, AnnualPaymentMember } from '../types';

export class SubscriptionsService {
  private static instance: SubscriptionsService;

  private constructor() {}

  public static getInstance(): SubscriptionsService {
    if (!SubscriptionsService.instance) {
      SubscriptionsService.instance = new SubscriptionsService();
    }
    return SubscriptionsService.instance;
  }

  public async getYears(): Promise<{ years: SubscriptionYearOption[]; currentYear: number }> {
    return httpClient.get<{ years: SubscriptionYearOption[]; currentYear: number }>('/api/annual-subscriptions/years');
  }

  public async getSubscriptionData(year: number): Promise<AnnualSubscriptionData> {
    return httpClient.get<AnnualSubscriptionData>(`/api/annual-subscriptions/year/${year}`);
  }

  public async setUnifiedFee(
    year: number,
    amount: number,
    amountWithUniform: number,
    description?: string
  ): Promise<{
    success: boolean;
    message: string;
    year: number;
    amount: number;
    amountWithUniform: number;
    description: string;
  }> {
    return httpClient.post<{
      success: boolean;
      message: string;
      year: number;
      amount: number;
      amountWithUniform: number;
      description: string;
    }>('/api/annual-subscriptions/fee', {
      year,
      amount,
      amount_with_uniform: amountWithUniform,
      description,
    });
  }

  public async recordPayment(data: {
    year: number;
    member_id: number;
    status?: 'مسدد' | 'غير مسدد';
    subscription_type?: 'اشتراك سنوي' | 'اشتراك سنوي بالزي';
    paid_amount?: number;
    payment_date?: string;
    receipt_number?: string;
    notes?: string;
    payment_method?: string;
  }): Promise<{ success: boolean; message: string; payment: any }> {
    return httpClient.post<{ success: boolean; message: string; payment: any }>(
      '/api/annual-subscriptions/payment',
      data
    );
  }

  public async recordBulkPayment(data: {
    year: number;
    member_ids: number[];
    subscription_type?: 'اشتراك سنوي' | 'اشتراك سنوي بالزي';
    payment_date?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; count: number }> {
    return httpClient.post<{ success: boolean; message: string; count: number }>(
      '/api/annual-subscriptions/bulk-payment',
      data
    );
  }

  public async cancelPayment(year: number, memberId: number): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(
      `/api/annual-subscriptions/payment/${year}/${memberId}`
    );
  }

  public async exportExcel(year: number): Promise<void> {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/annual-subscriptions/year/${year}/export`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error('فشل تحميل كشف الاشتراكات Excel');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scout_Annual_Subscriptions_${year}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export const subscriptionsService = SubscriptionsService.getInstance();
