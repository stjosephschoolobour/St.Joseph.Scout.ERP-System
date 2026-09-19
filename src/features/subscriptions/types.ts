export type SubscriptionType = 'اشتراك سنوي' | 'اشتراك سنوي بالزي';

export interface SubscriptionYearOption {
  year: number;
  amount: number;
  amountWithUniform?: number;
  description: string;
  isConfigured: boolean;
}

export interface AnnualPaymentMember {
  member_id: number;
  member_code: string;
  student_name: string;
  student_name_en?: string | null;
  national_id: string;
  member_type: 'عضوة' | 'قائد';
  school_stage: string;
  tribe_id?: number | null;
  tribe_name?: string | null;
  phone: string;
  payment_id?: number | null;
  status: 'مسدد' | 'غير مسدد';
  subscription_type?: SubscriptionType;
  paid_amount: number;
  payment_date?: string | null;
  receipt_number?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
  isPaid: boolean;
}

export interface AnnualSubscriptionStats {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  unifiedFee: number; // سعر الاشتراك السنوي العادي
  feeWithUniform: number; // سعر الاشتراك السنوي بالزي
  totalTarget: number;
  totalCollected: number;
  collectionRate: number;
  leadersCount: number;
  leadersPaid: number;
  girlsCount: number;
  girlsPaid: number;
  regularCount: number;
  regularCollected: number;
  uniformCount: number;
  uniformCollected: number;
}

export interface AnnualSubscriptionData {
  year: number;
  unifiedFee: number;
  feeWithUniform: number;
  feeDescription: string;
  members: AnnualPaymentMember[];
  stats: AnnualSubscriptionStats;
}
