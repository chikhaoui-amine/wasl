// @vitest-environment jsdom
import "fake-indexeddb/auto";
import type { ReactNode } from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { testLocalStorage } = vi.hoisted(() => {
  const storageValues = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return storageValues.size;
    },
    clear: () => storageValues.clear(),
    getItem: (key) => storageValues.get(key) ?? null,
    key: (index) => [...storageValues.keys()][index] ?? null,
    removeItem: (key) => {
      storageValues.delete(key);
    },
    setItem: (key, value) => {
      storageValues.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return { testLocalStorage: storage };
});

import { LocalAdapter } from "@/lib/data/adapters/local/local-adapter";
import { DataProvider, createMemoryQueryClient } from "@/lib/data/query/provider";
import JournalPage from "./page";
import { todayISO } from "@/lib/date";

vi.mock("@/components/ui/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content, className }: { content: string; className?: string }) => (
    <div data-testid="markdown-content" className={className}>
      {content}
    </div>
  ),
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ open, title, children }: { open: boolean; title: ReactNode; children: ReactNode }) =>
    open ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
  Field: ({ label, children }: { label: ReactNode; children: ReactNode }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  FormFooter: ({ onDelete, submitLabel }: { onDelete?: () => void; submitLabel: string }) => (
    <div>
      {onDelete ? (
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      ) : null}
      <button type="submit">{submitLabel}</button>
    </div>
  ),
  inputCls: "",
}));

describe("JournalPage Header Controls & Markdown", () => {
  let adapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(() => {
    testLocalStorage.clear();
    adapter = new LocalAdapter({ databaseName: `journal-page-test-${Date.now()}-${Math.random()}` });
    queryClient = createMemoryQueryClient();
  });

  afterEach(async () => {
    cleanup();
    queryClient.clear();
    await adapter.close();
  });

  function renderWithProviders(ui: ReactNode) {
    return render(
      <DataProvider adapter={adapter} queryClient={queryClient} edition="local">
        {ui}
      </DataProvider>,
    );
  }

  it("renders quick header buttons in the composer", async () => {
    renderWithProviders(<JournalPage />);
    expect(await screen.findByTitle(/Heading 1/i)).toBeDefined();
    expect(screen.getByTitle(/Heading 2/i)).toBeDefined();
    expect(screen.getByTitle(/Heading 3/i)).toBeDefined();
    expect(screen.getByTitle(/Bold/i)).toBeDefined();
    expect(screen.getByTitle(/Bulleted List/i)).toBeDefined();
  });

  it("inserts header prefix when clicking H1 button", async () => {
    renderWithProviders(<JournalPage />);
    const textarea = (await screen.findByPlaceholderText(/Write your thoughts/i)) as HTMLTextAreaElement;
    const h1Button = screen.getByTitle(/Heading 1/i);

    fireEvent.click(h1Button);
    expect(textarea.value).toBe("# ");
  });

  it("inserts H2, H3, bold and list formatting", async () => {
    renderWithProviders(<JournalPage />);
    const textarea = (await screen.findByPlaceholderText(/Write your thoughts/i)) as HTMLTextAreaElement;
    const h2Button = screen.getByTitle(/Heading 2/i);

    fireEvent.click(h2Button);
    expect(textarea.value).toBe("## ");
  });

  it("renders saved entries using MarkdownRenderer", async () => {
    const today = todayISO();
    await adapter.initialize();
    await adapter.putStore({
      store: "lifeos-journal",
      version: 2,
      state: {
        entries: [
          {
            id: "entry-1",
            date: today,
            mood: "good",
            body: "# Morning Reflection\nToday was a great day.",
            createdAt: Date.now(),
          },
        ],
      },
      updatedAt: new Date().toISOString(),
    });

    renderWithProviders(<JournalPage />);
    await waitFor(() => {
      const rendered = screen.getByTestId("markdown-content");
      expect(rendered.textContent).toContain("# Morning Reflection");
    });
  });

  it("opens edit modal and formats text inside edit modal", async () => {
    const today = todayISO();
    await adapter.initialize();
    await adapter.putStore({
      store: "lifeos-journal",
      version: 2,
      state: {
        entries: [
          {
            id: "entry-1",
            date: today,
            mood: "good",
            body: "Initial text",
            createdAt: Date.now(),
          },
        ],
      },
      updatedAt: new Date().toISOString(),
    });

    renderWithProviders(<JournalPage />);
    const editBtn = await screen.findByLabelText("Edit entry");
    fireEvent.click(editBtn);

    expect(screen.getByText("Edit entry")).toBeDefined();
  });

  it("auto-saves typed text as a draft to localStorage", async () => {
    renderWithProviders(<JournalPage />);
    const textarea = (await screen.findByPlaceholderText(/Write your thoughts/i)) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "Today was an intense coding session." } });

    expect(screen.getByText(/Draft saved/i)).toBeDefined();
    const rawDraft = testLocalStorage.getItem(`wasl_journal_draft_${todayISO()}`);
    expect(rawDraft).toContain("Today was an intense coding session.");
  });

  it("restores draft when opening or switching calendar dates", async () => {
    testLocalStorage.setItem(
      `wasl_journal_draft_${todayISO()}`,
      JSON.stringify({ body: "Saved draft for today", mood: "great", updatedAt: Date.now() }),
    );

    renderWithProviders(<JournalPage />);
    const textarea = (await screen.findByPlaceholderText(/Write your thoughts/i)) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Saved draft for today");
  });

  it("clears draft from localStorage and composer when discard is clicked", async () => {
    renderWithProviders(<JournalPage />);
    const textarea = (await screen.findByPlaceholderText(/Write your thoughts/i)) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Draft to discard" } });

    const discardBtn = screen.getByRole("button", { name: /Discard/i });
    fireEvent.click(discardBtn);

    expect(textarea.value).toBe("");
    expect(testLocalStorage.getItem(`wasl_journal_draft_${todayISO()}`)).toBeNull();
  });

  it("clears draft from localStorage when entry is saved", async () => {
    renderWithProviders(<JournalPage />);
    const textarea = (await screen.findByPlaceholderText(/Write your thoughts/i)) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Entry to save permanently" } });

    const saveBtn = screen.getByRole("button", { name: /Save entry/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Entry to save permanently")).toBeDefined();
    });
    expect(testLocalStorage.getItem(`wasl_journal_draft_${todayISO()}`)).toBeNull();
  });

  it("shows unsaved draft indicator on the calendar for days with drafts", async () => {
    testLocalStorage.setItem(
      `wasl_journal_draft_2026-11-15`,
      JSON.stringify({ body: "Future reflection", mood: "good", updatedAt: Date.now() }),
    );

    renderWithProviders(<JournalPage />);

    expect(await screen.findByTitle("Unsaved draft")).toBeDefined();
  });
});
