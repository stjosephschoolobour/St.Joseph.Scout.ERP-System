export interface WalletMember {
  id: number;
  member_code: string;
  student_name: string;
  student_name_en?: string;
  member_type: 'عضوة' | 'قائد';
  school_stage: string;
  tribe_id?: number;
  tribe_name?: string;
  photo_path?: string;
  father_phone?: string;
  mother_phone?: string;
  leader_phone?: string;
  balance: number;
  last_updated: string;
  total_deposits: number;
  total_spent: number;
  transactions_count: number;
  last_transaction_at?: string;
}

export interface WalletTransaction {
  id: number;
  member_id: number;
  type: 'DEPOSIT' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'WITHDRAW';
  amount: number;
  balance_before: number;
  balance_after: number;
  category: 'TOPUP' | 'SUBSCRIPTION' | 'ACTIVITY' | 'STORE' | 'REFUND' | 'ADJUSTMENT';
  reference_id?: string;
  reference_title?: string;
  description?: string;
  receipt_number: string;
  recorded_by: string;
  created_at: string;
  student_name?: string;
  member_code?: string;
  member_type?: 'عضوة' | 'قائد';
  photo_path?: string;
  tribe_name?: string;
}

export interface WalletSummary {
  total_system_balance: number;
  total_deposits: number;
  total_payments: number;
  members_with_balance_count: number;
  total_members_count: number;
}

export interface TopUpRequest {
  member_id: number;
  amount: number;
  notes?: string;
  payment_method?: string;
}

export interface PaySubscriptionFromWalletRequest {
  member_id: number;
  year: number;
  subscription_type?: 'اشتراك سنوي' | 'اشتراك سنوي بالزي';
  notes?: string;
}

export interface PayActivityFromWalletRequest {
  member_id: number;
  activity_id: number;
  amount?: number;
  notes?: string;
}

export interface PayStoreOrderFromWalletRequest {
  order_id: number;
  member_id: number;
}

export interface AdjustWalletRequest {
  member_id: number;
  type: 'WITHDRAW' | 'ADJUSTMENT' | 'REFUND';
  amount: number;
  reason: string;
  direction?: 'ADD' | 'DEDUCT';
}

export interface EligibleSubscriptionRolloverMember {
  member_id: number;
  member_code: string;
  student_name: string;
  student_name_en?: string;
  member_type: 'عضوة' | 'قائد';
  school_stage: string;
  tribe_name?: string;
  balance: number;
  is_eligible: boolean;
  remaining_balance: number;
}

export interface BulkRolloverSubscriptionsRequest {
  year: number;
  subscription_type?: 'اشتراك سنوي' | 'اشتراك سنوي بالزي';
  member_ids?: number[];
  notes?: string;
}

export interface BulkRolloverResponse {
  success: boolean;
  processedCount: number;
  totalAmount: number;
  message: string;
  results: Array<{
    memberId: number;
    studentName: string;
    memberCode: string;
    amount: number;
    balanceAfter: number;
    receiptNumber: string;
    success: boolean;
    error?: string;
  }>;
}
