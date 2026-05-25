export type ReproductiveEventType =
  | 'HEAT_DETECTED'
  | 'NATURAL_MATING'
  | 'ARTIFICIAL_INSEMINATION'
  | 'PREGNANCY_CONFIRMED'
  | 'PREGNANCY_LOST'
  | 'CALVING'
  | 'DRY_OFF';

export type PregnancyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED' | 'LOST';

export interface ReproductiveEvent {
  id: string;
  femaleId: string;
  maleId?: string;
  type: ReproductiveEventType;
  eventDate: string;
  notes?: string;
  bullSemen?: string;
  technicianName?: string;
  female?: { id: string; tagNumber: string; name?: string };
  createdAt: string;
}

export interface Pregnancy {
  id: string;
  femaleId: string;
  maleId?: string;
  conceptionDate: string;
  expectedBirthDate: string;
  actualBirthDate?: string;
  status: PregnancyStatus;
  gestationDays?: number;
  offspringCount?: number;
  notes?: string;
  female?: { id: string; tagNumber: string; name?: string };
  createdAt: string;
}
