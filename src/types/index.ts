export type Gender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
export type PartnershipType = "MARRIED" | "PARTNERED" | "DIVORCED" | "SEPARATED";
export type ChildRelationType = "BIOLOGICAL" | "ADOPTED" | "STEP";

export interface PersonDTO {
  id: string;
  firstName: string;
  lastName: string;
  birthName?: string | null;
  gender: Gender;
  birthDate?: string | null;
  birthPlace?: string | null;
  deathDate?: string | null;
  deathPlace?: string | null;
  occupation?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
}

export interface CoupleDTO {
  id: string;
  type: PartnershipType;
  startDate?: string | null;
  startPlace?: string | null;
  endDate?: string | null;
  notes?: string | null;
  parent1Id: string;
  parent2Id: string;
}

export interface ParentChildDTO {
  id: string;
  childId: string;
  parentId: string;
  coupleId?: string | null;
  relation: ChildRelationType;
}

export interface FamilyGraph {
  people: PersonDTO[];
  couples: CoupleDTO[];
  links: ParentChildDTO[];
}

// Ein Knoten im berechneten Baum-Layout
export interface TreeNode {
  person: PersonDTO;
  generation: number;
  column: number;
  partnerIds: string[];
  childIds: string[];
  parentIds: string[];
  parentCoupleId?: string | null;
}
