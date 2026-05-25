export type AlertType = 'VACCINATION' | 'TREATMENT' | 'CHECKUP' | 'OTHER';
export type TreatmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type DiseaseStatus = 'ACTIVE' | 'RESOLVED' | 'CHRONIC';

export interface Vaccine {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  doseIntervalDays?: number;
}

export interface Medication {
  id: string;
  name: string;
  description?: string;
  activeIngredient?: string;
}

export interface Vaccination {
  id: string;
  animalId: string;
  vaccineId: string;
  appliedDate: string;
  nextDueDate?: string;
  doseMl?: number;
  batchNumber?: string;
  notes?: string;
  animal?: { id: string; tagNumber: string; name?: string };
  vaccine?: { id: string; name: string };
  createdAt: string;
}

export interface Treatment {
  id: string;
  animalId: string;
  diagnosis: string;
  medicationId?: string;
  startDate: string;
  endDate?: string;
  dosage?: number;
  dosageUnit?: string;
  frequency?: string;
  status: TreatmentStatus;
  notes?: string;
  animal?: { id: string; tagNumber: string; name?: string };
  medication?: { id: string; name: string };
  createdAt: string;
}

export interface Disease {
  id: string;
  animalId: string;
  name: string;
  description?: string;
  diagnosisDate: string;
  status: DiseaseStatus;
  resolvedDate?: string;
  symptoms?: string;
  notes?: string;
  animal?: { id: string; tagNumber: string; name?: string };
  createdAt: string;
}

export interface HealthAlert {
  id: string;
  farmId: string;
  animalId?: string;
  type: AlertType;
  title: string;
  description?: string;
  scheduledDate: string;
  isCompleted: boolean;
  completedAt?: string;
  animal?: { id: string; tagNumber: string; name?: string };
}
