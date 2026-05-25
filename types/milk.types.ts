export type PaymentFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface DairyConfig {
  id?: string;
  farmId?: string;
  buyerName?: string | null;
  pricePerLiter: number;
  paymentFrequency: PaymentFrequency;
  notes?: string | null;
}

export interface MilkSale {
  id: string;
  farmId: string;
  saleDate: string;
  liters: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MilkPeriodSummary {
  from: string;
  to: string;
  liters: number;
  earnings: number;
  recordCount: number;
}

export interface MilkSalesSummary {
  config: DairyConfig;
  current: MilkPeriodSummary;
  previous: MilkPeriodSummary;
  litersChange: number | null;
  chartData: { date: string; liters: number }[];
}

export interface MilkSaleDetail {
  saleDate: string;
  liters: number;
  earnings: number;
  notes: string | null;
}

export interface MilkPastPeriod {
  from: string;
  to: string;
  liters: number;
  earnings: number;
  recordCount: number;
  pricePerLiter: number;
  sales: MilkSaleDetail[];
}

export interface MilkPeriodsHistory {
  config: DairyConfig;
  periods: MilkPastPeriod[];
}
