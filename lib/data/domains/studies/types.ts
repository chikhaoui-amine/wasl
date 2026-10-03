export type SemesterKey = "S1" | "S2" | string;
export type SessionType = "td" | "tp" | "cours";
export type ChecklistCategory = "cours" | "td_series" | "tp" | "annale";
export type ResourceType = "tresor" | "drive" | "github" | "classroom" | "other";

export interface AcademicProfile {
  level: string;               // e.g. "2CPI", "1CPI", "1CS", "2CS-SIL", or custom
  currentSemester: SemesterKey;// "S1" | "S2"
  academicYear: string;        // e.g. "2026-2027"
}

export interface StudyResourceLink {
  id: string;
  label: string;
  url: string;
  type: ResourceType;
}

export interface StudyModule {
  id: string;
  code: string;                // e.g. "SFSD", "ARCHI2", "AN", "SE1"
  name: string;                // e.g. "Structures de Fichiers & Données"
  level: string;               // e.g. "2CPI"
  semester: SemesterKey;       // "S1" | "S2"
  coefficient: number;         // e.g. 4
  color: string;               // Accent color hex or token
  icon: string;                // Lucide icon name (e.g. "Cpu", "FolderTree", "Terminal")
  absenceLimits: {
    td: number;                // default: 3
    tp: number;                // default: 3
    cours: number;             // default: 5
  };
  resources: StudyResourceLink[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyChecklistItem {
  id: string;
  moduleId: string;
  category: ChecklistCategory; // "cours" | "td_series" | "tp" | "annale"
  title: string;               // e.g. "Série 3: Indexation & Arbres B+", "EMD 2023"
  completed: boolean;
  completedAt?: string;
  order: number;
  url?: string;                // Optional direct link to Tresor ESI or Drive
}

export interface StudyAbsenceRecord {
  id: string;
  moduleId: string;
  type: SessionType;           // "td" | "tp" | "cours"
  date: string;                // ISO Date YYYY-MM-DD
  justified: boolean;          // Justified absences do not count towards the exclusion threshold
  note?: string;
}

export interface StudiesState {
  version: 1;
  profile: AcademicProfile;
  modules: StudyModule[];
  checklist: StudyChecklistItem[];
  absences: StudyAbsenceRecord[];
}

export interface AddStudyModuleInput {
  id?: string;
  code: string;
  name: string;
  level?: string;
  semester?: SemesterKey;
  coefficient?: number;
  color?: string;
  icon?: string;
  absenceLimits?: {
    td?: number;
    tp?: number;
    cours?: number;
  };
  resources?: StudyResourceLink[];
}

export interface AddStudyChecklistItemInput {
  id?: string;
  moduleId: string;
  category: ChecklistCategory;
  title: string;
  order?: number;
  completed?: boolean;
  completedAt?: string;
  url?: string;
}

