export type AnimalSex = 'MALE' | 'FEMALE';
export type AnimalStatus = 'ACTIVE' | 'SOLD' | 'DECEASED' | 'TRANSFERRED';

export interface AnimalBasic {
  id: string;
  tagNumber: string;
  name?: string;
  sex: AnimalSex;
  status: AnimalStatus;
}

export interface Animal {
  id: string;
  tagNumber: string;
  name?: string;
  sex: AnimalSex;
  birthDate?: string;
  birthWeight?: number;
  currentWeight?: number;
  photoUrl?: string;
  status: AnimalStatus;
  notes?: string;
  farmId: string;
  breedId?: string;
  fatherId?: string;
  motherId?: string;
  breed?: { id: string; name: string };
  father?: AnimalBasic;
  mother?: AnimalBasic;
  /** Hijos cuyo padre es este animal */
  fatherOf?: AnimalBasic[];
  /** Hijos cuya madre es este animal */
  motherOf?: AnimalBasic[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnimalDto {
  tagNumber: string;
  name?: string;
  sex: AnimalSex;
  birthDate?: string;
  birthWeight?: number;
  currentWeight?: number;
  status?: AnimalStatus;
  notes?: string;
  breedId?: string;
  fatherId?: string;
  motherId?: string;
}
