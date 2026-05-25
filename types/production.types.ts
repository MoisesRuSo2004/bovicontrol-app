export interface MilkRecord {
  id: string;
  animalId: string;
  recordDate: string;
  morningLiters?: number;
  afternoonLiters?: number;
  eveningLiters?: number;
  totalLiters: number;
  qualityScore?: number;
  notes?: string;
  animal?: { id: string; tagNumber: string; name?: string };
  createdAt: string;
}

export interface WeightRecord {
  id: string;
  animalId: string;
  recordDate: string;
  weightKg: number;
  method?: string;
  notes?: string;
  animal?: { id: string; tagNumber: string; name?: string };
  createdAt: string;
}

export interface MilkSummary {
  period: { from: string; to: string };
  totalLiters: number;
  recordCount: number;
  avgLitersPerRecord: number;
  animalsWithRecords: number;
  avgLitersPerAnimal: number;
  dailyTotals: { date: string; liters: number }[];
}
