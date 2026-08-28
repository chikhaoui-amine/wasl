import type { Note, NoteCategory } from "./data/domains/notes";

export interface GraphNode {
  id: string;
  type: "category" | "note";
  label: string;
  color: string;
  tag: string;
  pinned?: boolean;
  isFixed?: boolean;
  hubId?: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  targetOffsetX?: number;
  targetOffsetY?: number;
  labelDirection?: "left" | "right";
  leftExt?: number;
  rightExt?: number;
  topExt?: number;
  bottomExt?: number;
  galaxyWidth?: number;
  galaxyHeight?: number;
  noteCount?: number;
  category?: NoteCategory;
  note?: Note;
}

export interface GraphEdge {
  id: string;
  source: string; // Hub node ID or Category node ID
  target: string; // Note node ID or Category node ID
  color: string;
  isCategoryLink?: boolean;
  sourceCatId?: string;
  targetCatId?: string;
}

const DEFAULT_TAG_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warn)",
  "var(--accent-2)",
  "#a855f7",
  "#ec4899",
  "#3b82f6",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
];

export function getEffectiveCategories(
  notes: Note[],
  categories: NoteCategory[],
): NoteCategory[] {
  const map = new Map<string, NoteCategory>();

  // 1. Add all defined categories
  for (const cat of categories) {
    map.set(cat.name.toLowerCase().trim(), {
      ...cat,
      linkedCategoryIds: cat.linkedCategoryIds ? [...cat.linkedCategoryIds] : [],
    });
  }

  // 2. Discover tags from notes that are not explicitly defined as categories
  for (const note of notes) {
    const rawTag = (note.tag || "General").trim();
    const tagKey = rawTag.toLowerCase();
    if (!map.has(tagKey)) {
      const color = DEFAULT_TAG_COLORS[map.size % DEFAULT_TAG_COLORS.length];
      map.set(tagKey, {
        id: `cat-${tagKey.replace(/[^a-z0-9]+/g, "-")}`,
        name: rawTag,
        color,
        linkedCategoryIds: [],
      });
    }
  }

  return Array.from(map.values());
}

export function buildGraphData(
  notes: Note[],
  categories: NoteCategory[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const allCategories = getEffectiveCategories(notes, categories);

  // Group notes by tag
  const notesByTag = new Map<string, Note[]>();
  for (const note of notes) {
    const rawTag = (note.tag || "General").trim();
    const tagKey = rawTag.toLowerCase();
    const list = notesByTag.get(tagKey) || [];
    list.push(note);
    notesByTag.set(tagKey, list);
  }

  // Map categories by name, ID, and slug
  const categoryMap = new Map<string, NoteCategory>();
  const categoryById = new Map<string, NoteCategory>();
  for (const cat of allCategories) {
    categoryMap.set(cat.name.toLowerCase().trim(), cat);
    categoryById.set(cat.id, cat);
    categoryById.set(cat.name.toLowerCase().trim(), cat);
  }

  const hubCount = Math.max(allCategories.length, 1);

  allCategories.forEach((cat, idx) => {
    const tagKey = cat.name.toLowerCase().trim();
    const catName = cat.name;
    const catColor = cat.color || "var(--accent)";
    const catNotes = notesByTag.get(tagKey) || [];
    const N = catNotes.length;

    // Compact golden-spiral distribution centered around (0, 0)
    let hubX = 0;
    let hubY = 0;
    if (hubCount === 1) {
      hubX = 0;
      hubY = 0;
    } else if (hubCount <= 3) {
      const angle = (idx / hubCount) * Math.PI * 2 - Math.PI / 2;
      const radius = 220;
      hubX = Math.cos(angle) * radius;
      hubY = Math.sin(angle) * radius;
    } else {
      const goldenAngle = 137.508 * (Math.PI / 180);
      const radius = Math.sqrt(idx + 0.5) * 190;
      const theta = idx * goldenAngle;
      hubX = Math.cos(theta) * radius;
      hubY = Math.sin(theta) * radius;
    }
    const hubId = `cat-${tagKey.replace(/[^a-z0-9]+/g, "-")}`;
    const hubWidth = Math.max(130, catName.length * 9 + 54);

    // Calculate exact galaxy dimensions and asymmetric extents for tree list
    const isBilateral = N > 10;
    const rows = isBilateral ? Math.ceil(N / 2) : Math.max(N, 1);
    const topExt = rows * 15 + 40;
    const bottomExt = rows * 15 + 40;
    const galaxyHeight = topExt + bottomExt;

    // Width extents from hub center (including dot offset + full 180px text label length + margin)
    const leftExt = isBilateral
      ? hubWidth / 2 + 65 + 195 + 30
      : hubWidth / 2 + 35;
    const rightExt = hubWidth / 2 + 65 + 195 + 30;
    const galaxyWidth = leftExt + rightExt;

    nodes.push({
      id: hubId,
      type: "category",
      label: catName,
      color: catColor,
      tag: catName,
      hubId,
      radius: 20,
      x: hubX,
      y: hubY,
      vx: 0,
      vy: 0,
      width: hubWidth,
      height: 38,
      leftExt,
      rightExt,
      topExt,
      bottomExt,
      galaxyWidth,
      galaxyHeight,
      noteCount: N,
      category: cat,
    });

    // All categories use the structured Tree / List Fan layout
    const leftCount = isBilateral ? Math.ceil(N / 2) : 0;
    const rightCount = isBilateral ? Math.floor(N / 2) : N;

    catNotes.forEach((note, noteIdx) => {
      let targetOffsetX = 0;
      let targetOffsetY = 0;
      let labelDirection: "left" | "right" = "right";

      if (isBilateral && noteIdx < leftCount) {
        // Left Branch
        const k = noteIdx;
        targetOffsetX = -(hubWidth / 2 + 45 + (k % 2) * 18);
        targetOffsetY = (k - (leftCount - 1) / 2) * 28;
        labelDirection = "left";
      } else {
        // Right Branch
        const k = isBilateral ? noteIdx - leftCount : noteIdx;
        targetOffsetX = hubWidth / 2 + 45 + (k % 2) * 18;
        targetOffsetY = (k - (rightCount - 1) / 2) * 28;
        labelDirection = "right";
      }

      const noteNodeId = `note-${note.id}`;
      const titleLen = (note.title || "Untitled").length;
      const estimatedLabelWidth = Math.min(180, Math.max(70, titleLen * 6.5 + 20));
      const dotRadius = note.pinned ? 7 : 5.5;

      nodes.push({
        id: noteNodeId,
        type: "note",
        label: note.title || "Untitled",
        color: catColor,
        tag: catName,
        hubId,
        pinned: note.pinned,
        isFixed: false,
        radius: dotRadius,
        targetOffsetX,
        targetOffsetY,
        labelDirection,
        x: hubX + targetOffsetX,
        y: hubY + targetOffsetY,
        vx: 0,
        vy: 0,
        width: estimatedLabelWidth,
        height: 20,
        note,
      });

      edges.push({
        id: `edge-${hubId}-${noteNodeId}`,
        source: hubId,
        target: noteNodeId,
        color: catColor,
      });
    });
  });

  // Create Category-to-Category Inter-Page Link Edges
  const processedCatLinks = new Set<string>();
  for (const cat of allCategories) {
    if (!cat.linkedCategoryIds || cat.linkedCategoryIds.length === 0) continue;
    const srcTagKey = cat.name.toLowerCase().trim();
    const srcHubId = `cat-${srcTagKey.replace(/[^a-z0-9]+/g, "-")}`;

    for (const targetIdOrName of cat.linkedCategoryIds) {
      const targetCat = categoryById.get(targetIdOrName) || categoryById.get(targetIdOrName.toLowerCase().trim());
      if (!targetCat) continue;
      const tgtTagKey = targetCat.name.toLowerCase().trim();
      const tgtHubId = `cat-${tgtTagKey.replace(/[^a-z0-9]+/g, "-")}`;

      if (srcHubId === tgtHubId) continue;

      const linkKey = [srcHubId, tgtHubId].sort().join("<->");
      if (processedCatLinks.has(linkKey)) continue;
      processedCatLinks.add(linkKey);

      edges.push({
        id: `page-link-${linkKey}`,
        source: srcHubId,
        target: tgtHubId,
        color: cat.color || targetCat.color || "var(--accent)",
        isCategoryLink: true,
        sourceCatId: cat.id,
        targetCatId: targetCat.id,
      });
    }
  }

  return { nodes, edges };
}

/**
 * Returns the set of category hub IDs connected together as a linked group.
 */
export function getLinkedCategoryGroup(
  startHubId: string,
  edges: GraphEdge[],
): Set<string> {
  const group = new Set<string>([startHubId]);
  const queue = [startHubId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (!edge.isCategoryLink) continue;
      if (edge.source === current && !group.has(edge.target)) {
        group.add(edge.target);
        queue.push(edge.target);
      } else if (edge.target === current && !group.has(edge.source)) {
        group.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return group;
}

export function stepSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  _width: number,
  _height: number,
  alpha: number = 0.3,
  activeDraggedHubId?: string | null,
): void {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  // 1. Gentle center gravity anchor so whole graph stays compactly centered around (0, 0)
  for (const node of nodes) {
    if (node.id === activeDraggedHubId) continue;
    if (node.type === "category") {
      node.vx -= node.x * 0.0035 * alpha;
      node.vy -= node.y * 0.0035 * alpha;
    }
  }

  // 2. Strong spring restoring each note directly into its slot relative to its parent hub
  for (const node of nodes) {
    if (node.type !== "note" || !node.hubId) continue;
    const hub = nodeMap.get(node.hubId);
    if (!hub) continue;

    const offsetX = node.targetOffsetX ?? 100;
    const offsetY = node.targetOffsetY ?? 0;

    const targetX = hub.x + offsetX;
    const targetY = hub.y + offsetY;

    const dx = targetX - node.x;
    const dy = targetY - node.y;

    // Direct spring force returning note to its slot in the tree list
    node.vx += dx * 0.25 * alpha;
    node.vy += dy * 0.25 * alpha;
  }

  // 3. Category Link Spring Force (attracts linked page hubs to follow each other with fluid floating physics)
  for (const edge of edges) {
    if (!edge.isCategoryLink) continue;
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.hypot(dx, dy) || 1;

    const sLeft = source.leftExt || (source.width / 2 + 35);
    const sRight = source.rightExt || (source.width / 2 + 250);
    const tLeft = target.leftExt || (target.width / 2 + 35);
    const tRight = target.rightExt || (target.width / 2 + 250);

    const sH = source.topExt || 100;
    const tH = target.topExt || 100;

    const neededX = (dx > 0 ? sRight + tLeft : sLeft + tRight) + 80;
    const neededY = sH + tH + 60;
    const idealDist = Math.max(neededX, neededY);

    // Fluid spring force pulling linked pages to follow and float together
    const force = (dist - idealDist) * 0.12 * alpha;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (source.id !== activeDraggedHubId) {
      source.vx += fx;
      source.vy += fy;
    }
    if (target.id !== activeDraggedHubId) {
      target.vx -= fx;
      target.vy -= fy;
    }
  }

  // 4. Hub-to-Hub Solid Asymmetric Bounding Box Collision (guarantees zero overlap between galaxy trees & note labels)
  const hubs = nodes.filter((n) => n.type === "category");
  const padX = 75; // Clearance padding in X between galaxies
  const padY = 45; // Clearance padding in Y between galaxies

  for (let i = 0; i < hubs.length; i++) {
    const h1 = hubs[i];
    const minX1 = h1.x - (h1.leftExt || (h1.width / 2 + 35));
    const maxX1 = h1.x + (h1.rightExt || (h1.width / 2 + 250));
    const minY1 = h1.y - (h1.topExt || 60);
    const maxY1 = h1.y + (h1.bottomExt || 60);

    for (let j = i + 1; j < hubs.length; j++) {
      const h2 = hubs[j];
      const minX2 = h2.x - (h2.leftExt || (h2.width / 2 + 35));
      const maxX2 = h2.x + (h2.rightExt || (h2.width / 2 + 250));
      const minY2 = h2.y - (h2.topExt || 60);
      const maxY2 = h2.y + (h2.bottomExt || 60);

      // Check AABB collision with clearance padding
      const overlapsX = (maxX1 + padX) > minX2 && (minX1 - padX) < maxX2;
      const overlapsY = (maxY1 + padY) > minY2 && (minY1 - padY) < maxY2;

      if (overlapsX && overlapsY) {
        let overlapX = 0;
        let pushDirX = 1;

        if (h1.x < h2.x) {
          overlapX = (maxX1 + padX) - minX2;
          pushDirX = -1;
        } else {
          overlapX = (maxX2 + padX) - minX1;
          pushDirX = 1;
        }

        let overlapY = 0;
        let pushDirY = 1;

        if (h1.y < h2.y) {
          overlapY = (maxY1 + padY) - minY2;
          pushDirY = -1;
        } else {
          overlapY = (maxY2 + padY) - minY1;
          pushDirY = 1;
        }

        const isH1Active = h1.id === activeDraggedHubId;
        const isH2Active = h2.id === activeDraggedHubId;

        if (isH1Active && !isH2Active) {
          // H1 is held by user cursor -> H2 must actively yield and be pushed away
          if (overlapX < overlapY * 1.5) {
            h2.x -= pushDirX * overlapX;
            h2.vx -= pushDirX * overlapX * 0.4;
          } else {
            h2.y -= pushDirY * overlapY;
            h2.vy -= pushDirY * overlapY * 0.4;
          }
        } else if (isH2Active && !isH1Active) {
          // H2 is held by user cursor -> H1 must actively yield and be pushed away
          if (overlapX < overlapY * 1.5) {
            h1.x += pushDirX * overlapX;
            h1.vx += pushDirX * overlapX * 0.4;
          } else {
            h1.y += pushDirY * overlapY;
            h1.vy += pushDirY * overlapY * 0.4;
          }
        } else {
          // Neither is held by cursor (or both) -> push both apart smoothly
          if (overlapX < overlapY * 1.5) {
            const pushX = pushDirX * overlapX * 0.5;
            h1.x += pushX * 0.5;
            h2.x -= pushX * 0.5;
            h1.vx += pushX * 0.4 * alpha;
            h2.vx -= pushX * 0.4 * alpha;
          } else {
            const pushY = pushDirY * overlapY * 0.5;
            h1.y += pushY * 0.5;
            h2.y -= pushY * 0.5;
            h1.vy += pushY * 0.4 * alpha;
            h2.vy -= pushY * 0.4 * alpha;
          }
        }
      }
    }
  }

  // 5. Apply velocities with damping
  const damping = 0.74;
  for (const node of nodes) {
    if (node.id === activeDraggedHubId) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx *= damping;
    node.vy *= damping;
    node.x += node.vx;
    node.y += node.vy;
  }
}

export function findNodeAt(
  nodes: GraphNode[],
  worldX: number,
  worldY: number,
): GraphNode | null {
  // Check from top-rendered (last items) to bottom
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.type === "category") {
      const halfW = n.width / 2;
      const halfH = n.height / 2;
      if (
        worldX >= n.x - halfW &&
        worldX <= n.x + halfW &&
        worldY >= n.y - halfH &&
        worldY <= n.y + halfH
      ) {
        return n;
      }
    } else {
      // Circular dot hit-test
      const dotDist = Math.hypot(worldX - n.x, worldY - n.y);
      if (dotDist <= n.radius + 8) {
        return n;
      }

      // Directional label box hit-test
      const dir = n.labelDirection || "right";
      let labelLeft = n.x;
      let labelRight = n.x;
      const labelTop = n.y - n.height / 2;
      const labelBottom = n.y + n.height / 2;

      if (dir === "right") {
        labelLeft = n.x + n.radius + 2;
        labelRight = n.x + n.radius + n.width + 6;
      } else {
        labelLeft = n.x - n.radius - n.width - 6;
        labelRight = n.x - n.radius - 2;
      }

      if (
        worldX >= labelLeft &&
        worldX <= labelRight &&
        worldY >= labelTop &&
        worldY <= labelBottom
      ) {
        return n;
      }
    }
  }
  return null;
}

/**
 * Checks if the coordinates hit the Link Port handle on a category hub.
 */
export function findCategoryLinkPortAt(
  nodes: GraphNode[],
  worldX: number,
  worldY: number,
): GraphNode | null {
  for (const n of nodes) {
    if (n.type !== "category") continue;
    // Link port is on the right side of the hub pill
    const portX = n.x + n.width / 2 + 10;
    const portY = n.y;
    if (Math.hypot(worldX - portX, worldY - portY) <= 16) {
      return n;
    }
  }
  return null;
}

/**
 * Checks if the coordinates are near an inter-page category link line or its midpoint badge.
 */
export function findCategoryLinkEdgeAt(
  edges: GraphEdge[],
  nodes: GraphNode[],
  worldX: number,
  worldY: number,
): GraphEdge | null {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  for (const edge of edges) {
    if (!edge.isCategoryLink) continue;
    const s = nodeMap.get(edge.source);
    const t = nodeMap.get(edge.target);
    if (!s || !t) continue;

    // Midpoint hit test (generous 18px radius)
    const midX = (s.x + t.x) / 2;
    const midY = (s.y + t.y) / 2;
    if (Math.hypot(worldX - midX, worldY - midY) <= 18) {
      return edge;
    }

    // Distance to line segment
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) continue;

    const u = Math.max(0, Math.min(1, ((worldX - s.x) * dx + (worldY - s.y) * dy) / lengthSq));
    const projX = s.x + u * dx;
    const projY = s.y + u * dy;
    const distToLine = Math.hypot(worldX - projX, worldY - projY);

    if (distToLine <= 14) {
      return edge;
    }
  }

  return null;
}

export function filterMatchingNodeIds(
  nodes: GraphNode[],
  query: string,
): Set<string> {
  const matches = new Set<string>();
  const q = query.toLowerCase().trim();
  if (!q) {
    for (const n of nodes) matches.add(n.id);
    return matches;
  }

  for (const n of nodes) {
    if (n.label.toLowerCase().includes(q)) {
      matches.add(n.id);
      continue;
    }
    if (n.note) {
      if (
        n.note.body.toLowerCase().includes(q) ||
        n.note.tag.toLowerCase().includes(q) ||
        (n.note.author && n.note.author.toLowerCase().includes(q))
      ) {
        matches.add(n.id);
      }
    }
  }

  return matches;
}
