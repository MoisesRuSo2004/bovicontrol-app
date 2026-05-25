export type SaleType = 'ANIMAL' | 'MILK' | 'MEAT' | 'SUBPRODUCT';

export type CostCategory =
  | 'FEED'
  | 'VETERINARY'
  | 'LABOR'
  | 'INFRASTRUCTURE'
  | 'EQUIPMENT'
  | 'TRANSPORT'
  | 'MEDICINE'
  | 'SEED_FERTILIZER'
  | 'OTHER';

export type IncomeCategory =
  | 'ANIMAL_SALE'
  | 'MILK_SALE'
  | 'MEAT_SALE'
  | 'SUBPRODUCT_SALE'
  | 'SUBSIDY'
  | 'OTHER';

export interface Sale {
  id: string;
  farmId: string;
  type: SaleType;
  saleDate: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalAmount: number;
  animalId?: string;
  buyerName?: string;
  buyerContact?: string;
  invoiceNumber?: string;
  notes?: string;
  animal?: { id: string; tagNumber: string; name?: string };
  createdAt: string;
}

export interface OperationalCost {
  id: string;
  farmId: string;
  category: CostCategory;
  description: string;
  costDate: string;
  amount: number;
  supplier?: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface IncomeRecord {
  id: string;
  farmId: string;
  category: IncomeCategory;
  description: string;
  incomeDate: string;
  amount: number;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface FinanceSummary {
  period: { from: string; to: string };
  totalSalesRevenue: number;
  totalOtherIncome: number;
  totalIncome: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: string;
  salesCount: number;
  costsCount: number;
  costsByCategory: { category: CostCategory; total: number; count: number }[];
  incomeByCategory: { category: IncomeCategory; total: number; count: number }[];
}
