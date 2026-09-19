import { httpClient } from '../../../core/http/httpClient';
import {
  WalletMember,
  WalletSummary,
  WalletTransaction,
  TopUpRequest,
  PaySubscriptionFromWalletRequest,
  PayActivityFromWalletRequest,
  PayStoreOrderFromWalletRequest,
  AdjustWalletRequest,
  EligibleSubscriptionRolloverMember,
  BulkRolloverSubscriptionsRequest,
  BulkRolloverResponse,
} from '../types';

export const walletService = {
  async getWallets(): Promise<{ summary: WalletSummary; members: WalletMember[] }> {
    return httpClient.get<{ summary: WalletSummary; members: WalletMember[] }>('/api/wallets');
  },

  async getMemberWallet(memberId: number): Promise<{
    member: any;
    balance: number;
    transactions: WalletTransaction[];
  }> {
    return httpClient.get<{
      member: any;
      balance: number;
      transactions: WalletTransaction[];
    }>(`/api/wallets/member/${memberId}`);
  },

  async topUpWallet(data: TopUpRequest): Promise<{
    success: boolean;
    message: string;
    balance: number;
    receiptNumber: string;
    transactionId: number;
    member: any;
  }> {
    return httpClient.post<{
      success: boolean;
      message: string;
      balance: number;
      receiptNumber: string;
      transactionId: number;
      member: any;
    }>('/api/wallets/topup', data);
  },

  async paySubscriptionFromWallet(data: PaySubscriptionFromWalletRequest): Promise<{
    success: boolean;
    message: string;
    balance: number;
    receiptNumber: string;
  }> {
    return httpClient.post<{
      success: boolean;
      message: string;
      balance: number;
      receiptNumber: string;
    }>('/api/wallets/pay-subscription', data);
  },

  async payActivityFromWallet(data: PayActivityFromWalletRequest): Promise<{
    success: boolean;
    message: string;
    balance: number;
    receiptNumber: string;
  }> {
    return httpClient.post<{
      success: boolean;
      message: string;
      balance: number;
      receiptNumber: string;
    }>('/api/wallets/pay-activity', data);
  },

  async payStoreOrderFromWallet(data: PayStoreOrderFromWalletRequest): Promise<{
    success: boolean;
    message: string;
    balance: number;
    receiptNumber: string;
  }> {
    return httpClient.post<{
      success: boolean;
      message: string;
      balance: number;
      receiptNumber: string;
    }>('/api/wallets/pay-store-order', data);
  },

  async adjustWallet(data: AdjustWalletRequest): Promise<{
    success: boolean;
    message: string;
    balance: number;
    receiptNumber: string;
  }> {
    return httpClient.post<{
      success: boolean;
      message: string;
      balance: number;
      receiptNumber: string;
    }>('/api/wallets/adjust', data);
  },

  async getEligibleSubscriptionRollover(
    year: number,
    subscription_type: 'اشتراك سنوي' | 'اشتراك سنوي بالزي' = 'اشتراك سنوي'
  ): Promise<{
    year: number;
    fee: number;
    feeRegular: number;
    feeWithUniform: number;
    subscriptionType: string;
    feeDescription?: string;
    members: EligibleSubscriptionRolloverMember[];
    eligibleCount: number;
    totalEligibleAmount: number;
    unpaidCount: number;
  }> {
    return httpClient.get<{
      year: number;
      fee: number;
      feeRegular: number;
      feeWithUniform: number;
      subscriptionType: string;
      feeDescription?: string;
      members: EligibleSubscriptionRolloverMember[];
      eligibleCount: number;
      totalEligibleAmount: number;
      unpaidCount: number;
    }>('/api/wallets/eligible-subscription-rollover', { year, subscription_type });
  },

  async bulkRolloverSubscriptions(data: BulkRolloverSubscriptionsRequest): Promise<BulkRolloverResponse> {
    return httpClient.post<BulkRolloverResponse>('/api/wallets/bulk-rollover-subscriptions', data);
  },

  async refundSubscriptionToWallet(data: {
    member_id: number;
    year: number;
    amount?: number;
    reason?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    balance: number;
    receiptNumber: string;
  }> {
    return httpClient.post<{
      success: boolean;
      message: string;
      balance: number;
      receiptNumber: string;
    }>('/api/wallets/rollover-subscription-refund', data);
  },

  async getTransactions(limit = 200): Promise<{ transactions: WalletTransaction[] }> {
    return httpClient.get<{ transactions: WalletTransaction[] }>('/api/wallets/transactions', { limit });
  },
};
