import type { StudyModule, StudyChecklistItem } from "./types";
import { DEFAULT_ABSENCE_LIMITS } from "./constants";

export interface PresetCurriculum {
  level: string;
  semester: string;
  label: string;
  modules: Omit<StudyModule, "id" | "createdAt" | "updatedAt">[];
  defaultChecklist: {
    moduleCode: string;
    items: Omit<StudyChecklistItem, "id" | "moduleId">[];
  }[];
}

const TRESOR_BASE = "https://tresor-esi.pages.dev";

export const ESI_CURRICULUM_PRESETS: PresetCurriculum[] = [
  // ----------------------------------------------------
  // 2CPI Semester 1 (S3)
  // ----------------------------------------------------
  {
    level: "2CPI",
    semester: "S1",
    label: "2CPI - Semestre 1 (S3)",
    modules: [
      {
        code: "SFSD",
        name: "Structures de Fichiers & Données",
        level: "2CPI",
        semester: "S1",
        coefficient: 4,
        color: "#38bdf8",
        icon: "FolderTree",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-sfsd-1", label: "Tresor ESI - SFSD", url: `${TRESOR_BASE}/2cpi/sfsd`, type: "tresor" },
        ],
      },
      {
        code: "ARCHI2",
        name: "Architecture des Ordinateurs II",
        level: "2CPI",
        semester: "S1",
        coefficient: 4,
        color: "#f59e0b",
        icon: "Cpu",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-archi2-1", label: "Tresor ESI - ARCHI 2", url: `${TRESOR_BASE}/2cpi/archi2`, type: "tresor" },
        ],
      },
      {
        code: "AN",
        name: "Analyse Numérique",
        level: "2CPI",
        semester: "S1",
        coefficient: 3,
        color: "#a855f7",
        icon: "Calculator",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-an-1", label: "Tresor ESI - AN", url: `${TRESOR_BASE}/2cpi/an`, type: "tresor" },
        ],
      },
      {
        code: "PRST",
        name: "Probabilités et Statistiques",
        level: "2CPI",
        semester: "S1",
        coefficient: 3,
        color: "#ec4899",
        icon: "Sigma",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-prst-1", label: "Tresor ESI - PRST", url: `${TRESOR_BASE}/2cpi/prst`, type: "tresor" },
        ],
      },
      {
        code: "ELECF2",
        name: "Électronique Fondamentale II",
        level: "2CPI",
        semester: "S1",
        coefficient: 2,
        color: "#10b981",
        icon: "Zap",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-elecf2-1", label: "Tresor ESI - ELECF 2", url: `${TRESOR_BASE}/2cpi/elecf2`, type: "tresor" },
        ],
      },
      {
        code: "SI",
        name: "Systèmes d'Information",
        level: "2CPI",
        semester: "S1",
        coefficient: 2,
        color: "#6366f1",
        icon: "Database",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-si-1", label: "Tresor ESI - SI", url: `${TRESOR_BASE}/2cpi/si`, type: "tresor" },
        ],
      },
      {
        code: "ANGL3",
        name: "Anglais Technique III",
        level: "2CPI",
        semester: "S1",
        coefficient: 1,
        color: "#64748b",
        icon: "Languages",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
    ],
    defaultChecklist: [
      {
        moduleCode: "SFSD",
        items: [
          { category: "cours", title: "Ch 1: Organisation & supports de fichiers", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Fichiers séquentiels non ordonnés & ordonnés", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Indexation & Tables d'index", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Arbres B & B+", completed: false, order: 4 },
          { category: "cours", title: "Ch 5: Adressage dispersé (Hachage)", completed: false, order: 5 },
          { category: "td_series", title: "Série 1: Blocs, buffers & calculs de coût", completed: false, order: 6 },
          { category: "td_series", title: "Série 2: Fichiers séquentiels", completed: false, order: 7 },
          { category: "td_series", title: "Série 3: Index et Arbres B+", completed: false, order: 8 },
          { category: "td_series", title: "Série 4: Hachage & Débordements", completed: false, order: 9 },
          { category: "tp", title: "TP 1: Implémentation du buffer pool en C/Pascal", completed: false, order: 10 },
          { category: "tp", title: "TP 2: Indexation & Manipulation de fichiers", completed: false, order: 11 },
          { category: "annale", title: "EMD 2023 - Sujet & Corrigé", completed: false, order: 12, url: `${TRESOR_BASE}/2cpi/sfsd/emd-2023` },
          { category: "annale", title: "EMD 2022 - Sujet & Corrigé", completed: false, order: 13, url: `${TRESOR_BASE}/2cpi/sfsd/emd-2022` },
        ],
      },
      {
        moduleCode: "ARCHI2",
        items: [
          { category: "cours", title: "Ch 1: Microprocesseurs x86 & Modes d'adressage", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Programmation Assembleur 8086", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Hiérarchie mémoire & Mémoire Cache", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Interruptions & Entrées/Sorties (8259, 8255)", completed: false, order: 4 },
          { category: "td_series", title: "Série 1: Jeu d'instructions 8086", completed: false, order: 5 },
          { category: "td_series", title: "Série 2: Sous-programmes & Pile", completed: false, order: 6 },
          { category: "td_series", title: "Série 3: Mémoire Cache & Performance", completed: false, order: 7 },
          { category: "tp", title: "TP 1: Introduction à EMU8086", completed: false, order: 8 },
          { category: "tp", title: "TP 2: Tableaux et Chaînes en assembleur", completed: false, order: 9 },
          { category: "annale", title: "EMD 2023 - ARCHI 2", completed: false, order: 10, url: `${TRESOR_BASE}/2cpi/archi2/emd-2023` },
          { category: "annale", title: "EMD 2022 - ARCHI 2", completed: false, order: 11, url: `${TRESOR_BASE}/2cpi/archi2/emd-2022` },
        ],
      },
      {
        moduleCode: "AN",
        items: [
          { category: "cours", title: "Ch 1: Résolution des équations non linéaires", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Systèmes linéaires (Gauss, LU, Cholesky, Jacobi)", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Interpolation polynomiale (Lagrange, Newton)", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Intégration numérique (Trapèzes, Simpson)", completed: false, order: 4 },
          { category: "td_series", title: "Série 1: Équations f(x) = 0", completed: false, order: 5 },
          { category: "td_series", title: "Série 2: Systèmes linéaires", completed: false, order: 6 },
          { category: "td_series", title: "Série 3: Interpolation & Intégration", completed: false, order: 7 },
          { category: "annale", title: "EMD 2023 - AN", completed: false, order: 8 },
          { category: "annale", title: "EMD 2022 - AN", completed: false, order: 9 },
        ],
      },
      {
        moduleCode: "PRST",
        items: [
          { category: "cours", title: "Ch 1: Notions de probabilités & Analyse combinatoire", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Variables aléatoires discrètes & continues", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Lois usuelles (Binomiale, Poisson, Normale)", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Statistiques descriptives & Estimation", completed: false, order: 4 },
          { category: "td_series", title: "Série 1: Probabilités conditionnelles & Bayes", completed: false, order: 5 },
          { category: "td_series", title: "Série 2: Lois usuelles", completed: false, order: 6 },
          { category: "annale", title: "EMD 2023 - PRST", completed: false, order: 7 },
        ],
      },
    ],
  },

  // ----------------------------------------------------
  // 2CPI Semester 2 (S4)
  // ----------------------------------------------------
  {
    level: "2CPI",
    semester: "S2",
    label: "2CPI - Semestre 2 (S4)",
    modules: [
      {
        code: "SE1",
        name: "Systèmes d'Exploitation I",
        level: "2CPI",
        semester: "S2",
        coefficient: 4,
        color: "#0284c7",
        icon: "Terminal",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-se1-1", label: "Tresor ESI - SE1", url: `${TRESOR_BASE}/2cpi/se1`, type: "tresor" },
        ],
      },
      {
        code: "POO",
        name: "Programmation Orientée Objet",
        level: "2CPI",
        semester: "S2",
        coefficient: 4,
        color: "#14b8a6",
        icon: "Code2",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-poo-1", label: "Tresor ESI - POO", url: `${TRESOR_BASE}/2cpi/poo`, type: "tresor" },
        ],
      },
      {
        code: "TG",
        name: "Théorie des Graphes & RO",
        level: "2CPI",
        semester: "S2",
        coefficient: 3,
        color: "#8b5cf6",
        icon: "Share2",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-tg-1", label: "Tresor ESI - TG", url: `${TRESOR_BASE}/2cpi/tg`, type: "tresor" },
        ],
      },
      {
        code: "LM",
        name: "Logique Mathématique",
        level: "2CPI",
        semester: "S2",
        coefficient: 3,
        color: "#f43f5e",
        icon: "Binary",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-lm-1", label: "Tresor ESI - LM", url: `${TRESOR_BASE}/2cpi/lm`, type: "tresor" },
        ],
      },
      {
        code: "RES",
        name: "Réseaux Informatiques",
        level: "2CPI",
        semester: "S2",
        coefficient: 3,
        color: "#06b6d4",
        icon: "Network",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [
          { id: "res-res-1", label: "Tresor ESI - Réseaux", url: `${TRESOR_BASE}/2cpi/res`, type: "tresor" },
        ],
      },
      {
        code: "PROJ",
        name: "Projet Pluridisciplinaire",
        level: "2CPI",
        semester: "S2",
        coefficient: 2,
        color: "#f97316",
        icon: "Layers",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
    ],
    defaultChecklist: [
      {
        moduleCode: "SE1",
        items: [
          { category: "cours", title: "Ch 1: Introduction aux systèmes d'exploitation", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Gestion des processus & Ordonnancement", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Synchronisation (Sémaphores, Moniteurs)", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Gestion de la mémoire & Mémoire virtuelle", completed: false, order: 4 },
          { category: "td_series", title: "Série 1: Algorithmes d'ordonnancement (FCFS, SJF, RR)", completed: false, order: 5 },
          { category: "td_series", title: "Série 2: Synchronisation & Exclusion mutuelle", completed: false, order: 6 },
          { category: "tp", title: "TP 1: Commandes Unix & Shell Scripting", completed: false, order: 7 },
          { category: "tp", title: "TP 2: Fork, Exec & Processus en C", completed: false, order: 8 },
          { category: "tp", title: "TP 3: IPC & Sémaphores POSIX", completed: false, order: 9 },
          { category: "annale", title: "EMD 2023 - SE1", completed: false, order: 10, url: `${TRESOR_BASE}/2cpi/se1/emd-2023` },
        ],
      },
      {
        moduleCode: "POO",
        items: [
          { category: "cours", title: "Ch 1: Paradigme Objet: Classes, Objets & Encapsulation", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Héritage & Polymorphisme", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Interfaces, Classes abstraites & Collections", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Gestion des Exceptions & I/O", completed: false, order: 4 },
          { category: "td_series", title: "Série 1: Conception de classes en Java/C++", completed: false, order: 5 },
          { category: "td_series", title: "Série 2: Héritage et liaison dynamique", completed: false, order: 6 },
          { category: "tp", title: "TP 1: Fondamentaux Java", completed: false, order: 7 },
          { category: "tp", title: "TP 2: Projet POO (Application console/GUI)", completed: false, order: 8 },
          { category: "annale", title: "EMD 2023 - POO", completed: false, order: 9 },
        ],
      },
      {
        moduleCode: "TG",
        items: [
          { category: "cours", title: "Ch 1: Définitions & Représentations de graphes", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Parcours (BFS, DFS) & Connexité", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Plus courts chemins (Dijkstra, Bellman-Ford, Floyd)", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Arbres couvrants minimaux (Kruskal, Prim)", completed: false, order: 4 },
          { category: "td_series", title: "Série 1: Graphes & Matrice d'adjacence", completed: false, order: 5 },
          { category: "td_series", title: "Série 2: Dijkstra & Arbres couvrants", completed: false, order: 6 },
          { category: "annale", title: "EMD 2023 - TG", completed: false, order: 7 },
        ],
      },
    ],
  },

  // ----------------------------------------------------
  // 1CPI Semester 1
  // ----------------------------------------------------
  {
    level: "1CPI",
    semester: "S1",
    label: "1CPI - Semestre 1 (S1)",
    modules: [
      {
        code: "ALGO1",
        name: "Algorithmique & Structures de Données I",
        level: "1CPI",
        semester: "S1",
        coefficient: 6,
        color: "#3b82f6",
        icon: "Code",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [{ id: "res-algo1", label: "Tresor ESI - ALGO 1", url: `${TRESOR_BASE}/1cpi/algo1`, type: "tresor" }],
      },
      {
        code: "ARCHI1",
        name: "Architecture des Ordinateurs I",
        level: "1CPI",
        semester: "S1",
        coefficient: 4,
        color: "#eab308",
        icon: "Cpu",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [{ id: "res-archi1", label: "Tresor ESI - ARCHI 1", url: `${TRESOR_BASE}/1cpi/archi1`, type: "tresor" }],
      },
      {
        code: "ANALYSE1",
        name: "Analyse Mathématique I",
        level: "1CPI",
        semester: "S1",
        coefficient: 4,
        color: "#8b5cf6",
        icon: "Calculator",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
      {
        code: "ALGEBRE1",
        name: "Algèbre Linéaire I",
        level: "1CPI",
        semester: "S1",
        coefficient: 3,
        color: "#ec4899",
        icon: "Sigma",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
      {
        code: "ELECF1",
        name: "Électronique Fondamentale I",
        level: "1CPI",
        semester: "S1",
        coefficient: 3,
        color: "#10b981",
        icon: "Zap",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
    ],
    defaultChecklist: [
      {
        moduleCode: "ALGO1",
        items: [
          { category: "cours", title: "Ch 1: Variables, types & actions élémentaires", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Structures conditionnelles & itératives", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Tableaux à 1 et 2 dimensions", completed: false, order: 3 },
          { category: "cours", title: "Ch 4: Fonctions & Procédures (Modularité)", completed: false, order: 4 },
          { category: "td_series", title: "Série 1: Algorithmes séquentiels", completed: false, order: 5 },
          { category: "td_series", title: "Série 2: Boucles & Algorithmes classiques", completed: false, order: 6 },
          { category: "td_series", title: "Série 3: Tableaux & Matrices", completed: false, order: 7 },
          { category: "annale", title: "EMD 2023 - ALGO 1", completed: false, order: 8 },
        ],
      },
    ],
  },

  // ----------------------------------------------------
  // 1CS Semester 1
  // ----------------------------------------------------
  {
    level: "1CS",
    semester: "S1",
    label: "1CS - Semestre 1 (S1)",
    modules: [
      {
        code: "THL",
        name: "Théorie des Langages & Automates",
        level: "1CS",
        semester: "S1",
        coefficient: 4,
        color: "#f43f5e",
        icon: "Binary",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [{ id: "res-thl", label: "Tresor ESI - THL", url: `${TRESOR_BASE}/1cs/thl`, type: "tresor" }],
      },
      {
        code: "BDD",
        name: "Bases de Données (Conception & SQL)",
        level: "1CS",
        semester: "S1",
        coefficient: 4,
        color: "#0284c7",
        icon: "Database",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [{ id: "res-bdd", label: "Tresor ESI - BDD", url: `${TRESOR_BASE}/1cs/bdd`, type: "tresor" }],
      },
      {
        code: "SE2",
        name: "Systèmes d'Exploitation II",
        level: "1CS",
        semester: "S1",
        coefficient: 4,
        color: "#10b981",
        icon: "Terminal",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
      {
        code: "RES2",
        name: "Architecture & Protocoles Réseaux",
        level: "1CS",
        semester: "S1",
        coefficient: 3,
        color: "#6366f1",
        icon: "Network",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
      {
        code: "GL",
        name: "Génie Logiciel",
        level: "1CS",
        semester: "S1",
        coefficient: 3,
        color: "#eab308",
        icon: "Workflow",
        absenceLimits: { ...DEFAULT_ABSENCE_LIMITS, td: 3, tp: 3 },
        resources: [],
      },
    ],
    defaultChecklist: [
      {
        moduleCode: "THL",
        items: [
          { category: "cours", title: "Ch 1: Mots, alphabets & langages formels", completed: false, order: 1 },
          { category: "cours", title: "Ch 2: Automates finis (DFA, NFA) & Équivalences", completed: false, order: 2 },
          { category: "cours", title: "Ch 3: Expressions régulières & Lemme de l'étoile", completed: false, order: 3 },
          { category: "td_series", title: "Série 1: Automates finis", completed: false, order: 4 },
          { category: "annale", title: "EMD 2023 - THL", completed: false, order: 5 },
        ],
      },
    ],
  },
];

export function getPresetCurriculum(level: string, semester: string): PresetCurriculum | undefined {
  return ESI_CURRICULUM_PRESETS.find(
    (p) => p.level.toLowerCase() === level.toLowerCase() && p.semester.toLowerCase() === semester.toLowerCase(),
  );
}

export const AVAILABLE_ACADEMIC_LEVELS = [
  "2CPI",
  "1CPI",
  "1CS",
  "2CS (SIL)",
  "2CS (SIQ)",
  "2CS (SIT)",
  "2CS (SID)",
  "3CS",
  "Custom",
] as const;
