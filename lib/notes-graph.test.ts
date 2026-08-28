import { describe, it, expect } from "vitest";
import {
  buildGraphData,
  getEffectiveCategories,
  findNodeAt,
  findCategoryLinkPortAt,
  findCategoryLinkEdgeAt,
  getLinkedCategoryGroup,
  filterMatchingNodeIds,
  stepSimulation,
} from "./notes-graph";
import type { Note, NoteCategory } from "./data/domains/notes";

const mockCategories: NoteCategory[] = [
  { id: "cat-personal", name: "Personal", color: "#10b981", linkedCategoryIds: ["cat-ideas"] },
  { id: "cat-ideas", name: "Ideas", color: "#f59e0b" },
];

const mockNotes: Note[] = [
  { id: "n1", title: "Grocery List", body: "Milk, eggs", tag: "Personal", pinned: false, updatedAt: 1000 },
  { id: "n2", title: "App Concept", body: "Graph view for notes", tag: "Ideas", pinned: true, updatedAt: 2000 },
  { id: "n3", title: "Gym Routine", body: "Leg day", tag: "Personal", pinned: false, updatedAt: 3000 },
  { id: "n4", title: "Meeting with Amine", body: "Discuss roadmap", tag: "People & Network", pinned: false, updatedAt: 4000 },
];

describe("notes-graph", () => {
  it("extracts all effective categories including unlisted note tags", () => {
    const effective = getEffectiveCategories(mockNotes, mockCategories);
    expect(effective.map((c) => c.name)).toContain("Personal");
    expect(effective.map((c) => c.name)).toContain("Ideas");
    expect(effective.map((c) => c.name)).toContain("People & Network");
  });

  it("builds nodes and edges correctly for notes and categories", () => {
    const { nodes, edges } = buildGraphData(mockNotes, mockCategories);
    const categoryNodes = nodes.filter((n) => n.type === "category");
    const noteNodes = nodes.filter((n) => n.type === "note");

    expect(categoryNodes).toHaveLength(3);
    expect(noteNodes).toHaveLength(4);
    // 4 note edges + 1 category-to-category link edge
    expect(edges).toHaveLength(5);

    const catLinkEdge = edges.find((e) => e.isCategoryLink);
    expect(catLinkEdge).toBeDefined();
    expect(catLinkEdge?.source).toBe("cat-personal");
    expect(catLinkEdge?.target).toBe("cat-ideas");
  });

  it("finds linked category group correctly", () => {
    const { edges } = buildGraphData(mockNotes, mockCategories);
    const group = getLinkedCategoryGroup("cat-personal", edges);
    expect(group.has("cat-personal")).toBe(true);
    expect(group.has("cat-ideas")).toBe(true);
  });

  it("detects link port hit test on category hub", () => {
    const { nodes } = buildGraphData(mockNotes, mockCategories);
    const hub = nodes.find((n) => n.type === "category")!;
    hub.x = 200;
    hub.y = 200;
    hub.width = 140;

    const portX = hub.x + hub.width / 2 + 10;
    const portY = hub.y;

    const hit = findCategoryLinkPortAt(nodes, portX, portY);
    expect(hit?.id).toBe(hub.id);
  });

  it("detects category link edge hit test on line and midpoint", () => {
    const { nodes, edges } = buildGraphData(mockNotes, mockCategories);
    const catEdge = edges.find((e) => e.isCategoryLink)!;
    const srcNode = nodes.find((n) => n.id === catEdge.source)!;
    const tgtNode = nodes.find((n) => n.id === catEdge.target)!;

    srcNode.x = 100;
    srcNode.y = 100;
    tgtNode.x = 300;
    tgtNode.y = 100;

    // Hit test at midpoint (200, 100)
    const midHit = findCategoryLinkEdgeAt(edges, nodes, 200, 100);
    expect(midHit?.id).toBe(catEdge.id);

    // Hit test slightly above line (200, 105)
    const lineHit = findCategoryLinkEdgeAt(edges, nodes, 200, 105);
    expect(lineHit?.id).toBe(catEdge.id);

    // Miss far away
    const miss = findCategoryLinkEdgeAt(edges, nodes, 200, 500);
    expect(miss).toBeNull();
  });

  it("assigns tree list offsets to notes", () => {
    const { nodes } = buildGraphData(mockNotes, mockCategories);
    const note1 = nodes.find((n) => n.id === "note-n1");
    expect(note1?.targetOffsetX).toBeDefined();
    expect(note1?.targetOffsetY).toBeDefined();
    expect(note1?.labelDirection).toBeDefined();
  });

  it("finds node by coordinate hit test", () => {
    const { nodes } = buildGraphData(mockNotes, mockCategories);
    nodes[0].x = 100;
    nodes[0].y = 100;
    nodes[0].width = 80;
    nodes[0].height = 40;

    const hit = findNodeAt(nodes, 100, 100);
    expect(hit?.id).toBe(nodes[0].id);

    const miss = findNodeAt(nodes, 5000, 5000);
    expect(miss).toBeNull();
  });

  it("filters matching node IDs based on search query", () => {
    const { nodes } = buildGraphData(mockNotes, mockCategories);
    const matches = filterMatchingNodeIds(nodes, "grocery");
    expect(matches.has("note-n1")).toBe(true);
    expect(matches.has("note-n2")).toBe(false);
  });

  it("steps simulation without producing NaN coordinates", () => {
    const { nodes, edges } = buildGraphData(mockNotes, mockCategories);
    stepSimulation(nodes, edges, 800, 600, 0.5);
    for (const node of nodes) {
      expect(Number.isNaN(node.x)).toBe(false);
      expect(Number.isNaN(node.y)).toBe(false);
    }
  });

  it("separates overlapping page galaxies during simulation", () => {
    const { nodes, edges } = buildGraphData(mockNotes, mockCategories);
    const hubs = nodes.filter((n) => n.type === "category");
    hubs[0].x = 0;
    hubs[0].y = 0;
    hubs[1].x = 10;
    hubs[1].y = 20;

    for (let i = 0; i < 30; i++) {
      stepSimulation(nodes, edges, 800, 600, 0.5);
    }

    const dist = Math.hypot(hubs[1].x - hubs[0].x, hubs[1].y - hubs[0].y);
    expect(dist).toBeGreaterThan(100);
  });
});
