export type ThemeId =
  | "graphite"
  | "editorial"
  | "porcelain-dark"
  | "espresso-dark"
  | "espresso-light";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /** [background, accent, text] — approximate hexes for the switcher preview. */
  swatch: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: "graphite",
    name: "Graphite",
    tagline: "Ink & chalk",
    swatch: ["#121212", "#e8e8e8", "#f5f5f5"],
  },
  {
    id: "editorial",
    name: "Porcelain",
    tagline: "Gallery light",
    swatch: ["#eef0f4", "#15855c", "#2b2f38"],
  },
  {
    id: "porcelain-dark",
    name: "Porcelain Dark",
    tagline: "Deep forest & mint",
    swatch: ["#0F1517", "#1C8259", "#F1F3F0"],
  },
  {
    id: "espresso-dark",
    name: "Espresso",
    tagline: "Charcoal & warm ember",
    swatch: ["#211C18", "#ED8748", "#F2EEE9"],
  },
  {
    id: "espresso-light",
    name: "Espresso Light",
    tagline: "Warm off-white & ember",
    swatch: ["#F5F1EB", "#ED8748", "#2A231E"],
  },
];

export const DEFAULT_THEME: ThemeId = "graphite";
export const THEME_STORAGE_KEY = "wasl-theme";
export const LEGACY_THEME_STORAGE_KEY = "lifeos-theme";
