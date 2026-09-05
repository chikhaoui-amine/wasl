"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Plus, ZoomIn, ZoomOut, Maximize2, Sparkles, Compass, Link2, X, Check } from "lucide-react";
import {
  buildGraphData,
  getEffectiveCategories,
  stepSimulation,
  findNodeAt,
  findCategoryLinkPortAt,
  findCategoryLinkEdgeAt,
  filterMatchingNodeIds,
  type GraphNode,
  type GraphEdge,
} from "@/lib/notes-graph";
import type { Note, NoteCategory } from "@/lib/data/domains/notes";
import { Card } from "@/components/ui/primitives";

interface NotesGraphViewProps {
  notes: Note[];
  categories: NoteCategory[];
  search?: string;
  onSelectNote: (note: Note) => void;
  onSelectCategory: (categoryName: string) => void;
  onUpdateCategory?: (
    id: string,
    patch: { name?: string; color?: string; icon?: string; linkedCategoryIds?: string[] },
  ) => Promise<void>;
  onNewNote: () => void;
  graphPositions?: Record<string, { x: number; y: number }>;
  onPersistNodePosition?: (nodeId: string, position: { x: number; y: number }) => Promise<void>;
}

export function NotesGraphView({
  notes,
  categories,
  search = "",
  onSelectNote,
  onSelectCategory,
  onUpdateCategory,
  onNewNote,
  graphPositions = {},
  onPersistNodePosition,
}: NotesGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Camera transform state: center offset & zoom scale
  const cameraRef = useRef<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 0.65,
  });

  const [cameraScale, setCameraScale] = useState(0.65);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredPortHubId, setHoveredPortHubId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Active page linking popover state
  const [linkingCategory, setLinkingCategory] = useState<NoteCategory | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Interaction tracking refs
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const lastWorldPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Drag-to-connect line drawing state
  const isConnectingRef = useRef(false);
  const connectSourceHubRef = useRef<GraphNode | null>(null);
  const connectCurrentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const connectHoverTargetHubRef = useRef<GraphNode | null>(null);

  // Simulation nodes and edges
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const isSimulatingRef = useRef(true);
  const simulationTicksRef = useRef(0);
  const dashOffsetRef = useRef(0);

  const effectiveCategories = useMemo(
    () => getEffectiveCategories(notes, categories),
    [notes, categories],
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Build graph data when notes/categories change
  useEffect(() => {
    if (notes.length === 0 && categories.length === 0) {
      nodesRef.current = [];
      edgesRef.current = [];
      return;
    }

    const { nodes: newNodes, edges: newEdges } = buildGraphData(notes, categories);

    // Retain existing positions and isFixed flags for category hubs
    const oldNodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));
    for (const node of newNodes) {
      const old = oldNodeMap.get(node.id);
      if (old) {
        node.x = old.x;
        node.y = old.y;
        node.vx = old.vx;
        node.vy = old.vy;
        if (node.type === "category") {
          node.isFixed = old.isFixed;
        }
      } else if (graphPositions[node.id]) {
        node.x = graphPositions[node.id].x;
        node.y = graphPositions[node.id].y;
        node.vx = 0;
        node.vy = 0;
        node.isFixed = true;
      }
    }

    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    simulationTicksRef.current = 0;
    isSimulatingRef.current = true;
  }, [notes, categories, graphPositions]);

  const matchingIds = useMemo(() => {
    const { nodes } = buildGraphData(notes, categories);
    return filterMatchingNodeIds(nodes, search);
  }, [notes, categories, search]);

  const hasSearch = search.trim().length > 0;
  const noMatches = hasSearch && matchingIds.size === 0;

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number, width: number, height: number) => {
    const { x: camX, y: camY, scale } = cameraRef.current;
    const centerX = width / 2;
    const centerY = height / 2;

    const worldX = (screenX - centerX - camX) / scale;
    const worldY = (screenY - centerY - camY) / scale;
    return { x: worldX, y: worldY };
  }, []);

  const hasAutoCenteredRef = useRef(false);
  const previousGraphSignatureRef = useRef<string | null>(null);

  // Fit and center camera on all nodes
  const resetCamera = useCallback(() => {
    if (nodesRef.current.length === 0) {
      cameraRef.current = { x: 0, y: 0, scale: 0.75 };
      setCameraScale(0.75);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodesRef.current) {
      if (n.type === "category") {
        const left = n.leftExt || (n.width / 2 + 35);
        const right = n.rightExt || (n.width / 2 + 250);
        const top = n.topExt || 60;
        const bottom = n.bottomExt || 60;
        minX = Math.min(minX, n.x - left);
        maxX = Math.max(maxX, n.x + right);
        minY = Math.min(minY, n.y - top);
        maxY = Math.max(maxY, n.y + bottom);
      } else {
        minX = Math.min(minX, n.x - (n.width || 40));
        maxX = Math.max(maxX, n.x + (n.width || 40));
        minY = Math.min(minY, n.y - (n.height || 20));
        maxY = Math.max(maxY, n.y + (n.height || 20));
      }
    }

    const container = containerRef.current;
    const viewW = container?.clientWidth || 900;
    const viewH = container?.clientHeight || 650;

    const contentW = Math.max(maxX - minX + 120, 400);
    const contentH = Math.max(maxY - minY + 120, 300);

    const fitScale = Math.min(1.0, Math.max(0.40, Math.min(viewW / contentW, viewH / contentH) * 0.92));
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    const targetCamX = -contentCenterX * fitScale;
    const targetCamY = -contentCenterY * fitScale;

    cameraRef.current = { x: targetCamX, y: targetCamY, scale: fitScale };
    setCameraScale(fitScale);
    simulationTicksRef.current = 0;
    isSimulatingRef.current = true;
  }, []);

  // Auto-center camera when notes first load
  useEffect(() => {
    if (notes.length > 0 && !hasAutoCenteredRef.current) {
      hasAutoCenteredRef.current = true;
      const timer = setTimeout(() => {
        resetCamera();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [notes.length, resetCamera]);

  // Re-fit only when nodes are added or removed. Editing content or moving a
  // node must not steal the user's camera position, but newly-created notes
  // can otherwise land outside the current viewport.
  useEffect(() => {
    const signature = notes.map((note) => `note-${note.id}`).sort().join("|") + "::" +
      effectiveCategories.map((category) => `cat-${category.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")}`).sort().join("|");
    const previous = previousGraphSignatureRef.current;
    previousGraphSignatureRef.current = signature;
    if (!previous || previous === signature) return;
    const timer = setTimeout(() => resetCamera(), 60);
    return () => clearTimeout(timer);
  }, [notes, effectiveCategories, resetCamera]);

  const handleZoom = useCallback((delta: number) => {
    const nextScale = Math.min(2.5, Math.max(0.15, cameraRef.current.scale + delta));
    cameraRef.current.scale = nextScale;
    setCameraScale(nextScale);
  }, []);

  // Disconnect a category link edge cleanly
  const handleDisconnectEdge = useCallback(
    async (edge: GraphEdge) => {
      if (!onUpdateCategory) return;
      const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);
      if (!srcNode || !tgtNode) return;

      const srcCat = srcNode.category || { id: srcNode.id, name: srcNode.label, color: srcNode.color, linkedCategoryIds: [] };
      const tgtCat = tgtNode.category || { id: tgtNode.id, name: tgtNode.label, color: tgtNode.color, linkedCategoryIds: [] };

      const cleanSrcLinks = (srcCat.linkedCategoryIds || []).filter(
        (id) =>
          id !== tgtCat.id &&
          id.toLowerCase() !== tgtCat.name.toLowerCase().trim() &&
          id !== `cat-${tgtCat.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")}`,
      );

      const cleanTgtLinks = (tgtCat.linkedCategoryIds || []).filter(
        (id) =>
          id !== srcCat.id &&
          id.toLowerCase() !== srcCat.name.toLowerCase().trim() &&
          id !== `cat-${srcCat.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")}`,
      );

      await onUpdateCategory(srcCat.id, {
        name: srcCat.name,
        color: srcCat.color,
        linkedCategoryIds: cleanSrcLinks,
      });

      if (tgtCat.id !== srcCat.id) {
        await onUpdateCategory(tgtCat.id, {
          name: tgtCat.name,
          color: tgtCat.color,
          linkedCategoryIds: cleanTgtLinks,
        });
      }

      showToast(`Disconnected "${srcNode.label}" ✂️ "${tgtNode.label}"`);
      isSimulatingRef.current = true;
      simulationTicksRef.current = 0;
    },
    [onUpdateCategory, showToast],
  );

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || notes.length === 0) return;

    let destroyed = false;

    const render = () => {
      if (destroyed) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Run force simulation step if active
      if (isSimulatingRef.current) {
        stepSimulation(
          nodesRef.current,
          edgesRef.current,
          width,
          height,
          0.45,
          draggedNodeRef.current?.id,
        );
        simulationTicksRef.current++;
        if (simulationTicksRef.current > 350 && !draggedNodeRef.current && !isConnectingRef.current) {
          isSimulatingRef.current = false;
        }
      }

      dashOffsetRef.current = (dashOffsetRef.current - 0.4) % 16;

      // Draw subtle background grid
      const { x: camX, y: camY, scale } = cameraRef.current;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.save();
      ctx.translate(centerX + camX, centerY + camY);
      ctx.scale(scale, scale);

      // Draw grid dots
      const gridSize = 45;
      const startX = Math.floor((-centerX - camX) / scale / gridSize) * gridSize - gridSize;
      const endX = Math.ceil((width - centerX - camX) / scale / gridSize) * gridSize + gridSize;
      const startY = Math.floor((-centerY - camY) / scale / gridSize) * gridSize - gridSize;
      const endY = Math.ceil((height - centerY - camY) / scale / gridSize) * gridSize + gridSize;

      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      for (let gx = startX; gx <= endX; gx += gridSize) {
        for (let gy = startY; gy <= endY; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const nodeMap = new Map<string, GraphNode>();
      for (const n of nodesRef.current) {
        nodeMap.set(n.id, n);
      }

      // 1. Draw Tree Capsule Halos around each Category Group
      const hubs = nodesRef.current.filter((n) => n.type === "category");
      for (const hub of hubs) {
        const baseColor = hub.color.startsWith("var") ? "#6366f1" : hub.color;

        const leftExt = hub.leftExt || (hub.width / 2 + 35);
        const rightExt = hub.rightExt || (hub.width / 2 + 250);
        const topExt = hub.topExt || 60;
        const bottomExt = hub.bottomExt || 60;

        const rectX = hub.x - leftExt + 10;
        const rectY = hub.y - topExt + 10;
        const rectW = leftExt + rightExt - 20;
        const rectH = topExt + bottomExt - 20;

        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectW, rectH, 22);
        ctx.fillStyle = "rgba(255, 255, 255, 0.014)";
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectW, rectH, 22);
        ctx.strokeStyle = baseColor;
        ctx.globalAlpha = 0.08;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // 2. Draw Connector Lines (Note-Hub links and Inter-Page links)
      for (const edge of edgesRef.current) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;

        const isEdgeHovered = hoveredEdgeId === edge.id;
        const isHighlighted =
          isEdgeHovered ||
          hoveredNodeId === source.id ||
          hoveredNodeId === target.id ||
          (hasSearch && (matchingIds.has(source.id) || matchingIds.has(target.id)));

        const isDimmed = hasSearch && !matchingIds.has(source.id) && !matchingIds.has(target.id);

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (edge.isCategoryLink) {
          // Inter-Page Hub Link
          const edgeColor = isEdgeHovered ? "#f43f5e" : edge.color.startsWith("var") ? "#6366f1" : edge.color;

          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = isEdgeHovered ? 4 : isHighlighted ? 3.5 : 2.4;
          ctx.globalAlpha = isEdgeHovered ? 1 : isHighlighted ? 0.95 : 0.7;
          ctx.setLineDash([7, 6]);
          ctx.lineDashOffset = dashOffsetRef.current;
          ctx.shadowColor = edgeColor;
          ctx.shadowBlur = isEdgeHovered ? 16 : 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.setLineDash([]);

          // Center Link Glyph / Unlink Button Indicator
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          if (isEdgeHovered) {
            // Hover: Show Disconnect Badge
            const badgeW = 90;
            const badgeH = 22;
            ctx.beginPath();
            ctx.roundRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH, 11);
            ctx.fillStyle = "rgba(244, 63, 94, 0.96)";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✕ Unlink", midX, midY);
          } else {
            // Normal Center Link Indicator Dot
            ctx.beginPath();
            ctx.arc(midX, midY, 7, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(24, 27, 36, 0.98)";
            ctx.fill();
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(midX, midY, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = edgeColor;
            ctx.fill();
          }
        } else {
          // Note to Hub Link
          if (isHighlighted) {
            ctx.strokeStyle = edge.color.startsWith("var") ? "#6366f1" : edge.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
          } else if (isDimmed) {
            ctx.strokeStyle = "rgba(150, 150, 150, 0.06)";
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.12;
          } else {
            ctx.strokeStyle = edge.color.startsWith("var") ? "#4f46e5" : edge.color;
            ctx.lineWidth = 1.1;
            ctx.globalAlpha = 0.26;
          }
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;

      // 3. Draw Active Drag-to-Connect Rubber-Band Laser
      if (isConnectingRef.current && connectSourceHubRef.current) {
        const src = connectSourceHubRef.current;
        const cur = connectCurrentPosRef.current;
        const tgt = connectHoverTargetHubRef.current;

        const endX = tgt ? tgt.x : cur.x;
        const endY = tgt ? tgt.y : cur.y;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = dashOffsetRef.current * 1.5;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.restore();

        // Target snap aura
        if (tgt) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(tgt.x, tgt.y, tgt.width / 2 + 14, 0, Math.PI * 2);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 4. Draw Nodes (Category Hubs & Note Nodes)
      const sortedNodes = [...nodesRef.current].sort((a, b) => {
        if (a.id === hoveredNodeId) return 1;
        if (b.id === hoveredNodeId) return -1;
        if (a.type === "category" && b.type !== "category") return -1;
        if (b.type === "category" && a.type !== "category") return 1;
        return 0;
      });

      for (const node of sortedNodes) {
        const isHovered = hoveredNodeId === node.id;
        const isMatch = !hasSearch || matchingIds.has(node.id);
        const isDimmed = hasSearch && !isMatch;

        const baseColor = node.color.startsWith("var") ? "#6366f1" : node.color;

        ctx.save();
        if (isDimmed) {
          ctx.globalAlpha = 0.2;
        }

        if (node.type === "category") {
          // Category Hub: Distinct Pill Badge
          const x = node.x - node.width / 2;
          const y = node.y - node.height / 2;
          const w = node.width;
          const h = node.height;
          const radius = h / 2;

          if (isHovered) {
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 18;
          }

          ctx.beginPath();
          ctx.roundRect(x, y, w, h, radius);
          ctx.fillStyle = isHovered ? "rgba(36, 40, 54, 0.98)" : "rgba(24, 27, 36, 0.96)";
          ctx.fill();

          ctx.beginPath();
          ctx.roundRect(x, y, w, h, radius);
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = isHovered ? 2.2 : 1.8;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Color Dot + Title + Count
          const dotRadius = 4.5;
          const dotX = x + 16;
          const dotY = y + h / 2;

          ctx.beginPath();
          ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = baseColor;
          ctx.fill();

          ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(node.label, dotX + 11, dotY);

          if (node.noteCount !== undefined) {
            const countText = String(node.noteCount);
            ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
            const badgeW = Math.max(18, countText.length * 7 + 8);
            const badgeX = x + w - badgeW - 8;
            const badgeY = y + (h - 18) / 2;

            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, 18, 9);
            ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
            ctx.fill();

            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(countText, badgeX + badgeW / 2, badgeY + 9);
          }

          // Interactive Drag-to-Connect Port Handle (Visible on hover or selection)
          const portX = node.x + w / 2 + 10;
          const portY = node.y;
          const isPortHovered = hoveredPortHubId === node.id;

          ctx.beginPath();
          ctx.arc(portX, portY, isPortHovered ? 9 : 7, 0, Math.PI * 2);
          ctx.fillStyle = isPortHovered ? "#38bdf8" : "rgba(30, 41, 59, 0.95)";
          ctx.fill();
          ctx.strokeStyle = isPortHovered ? "#ffffff" : baseColor;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Port link glyph dot
          ctx.beginPath();
          ctx.arc(portX, portY, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isPortHovered ? "#ffffff" : baseColor;
          ctx.fill();

          if (isPortHovered) {
            ctx.font = "600 10.5px ui-sans-serif, system-ui, sans-serif";
            ctx.fillStyle = "#38bdf8";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("Drag to link", portX + 13, portY);
          }
        } else {
          // Note Node: Directional Glowing Dot + Floating Title Label
          const currentRadius = isHovered ? node.radius * 1.4 : node.radius;

          // Outer Glow
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = isHovered ? 18 : isMatch && hasSearch ? 12 : 7;

          // Dot Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = baseColor;
          ctx.fill();

          // Pinned ring indicator or core dot
          if (node.pinned) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, currentRadius * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = "#fbbf24";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(node.x, node.y, currentRadius + 2.5, 0, Math.PI * 2);
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          ctx.shadowBlur = 0;

          // Floating Title Label
          ctx.font = "500 11.5px ui-sans-serif, system-ui, sans-serif";
          const maxTextW = 160;
          let displayTitle = node.label;
          if (ctx.measureText(displayTitle).width > maxTextW) {
            while (displayTitle.length > 3 && ctx.measureText(displayTitle + "…").width > maxTextW) {
              displayTitle = displayTitle.slice(0, -1);
            }
            displayTitle += "…";
          }

          const measuredW = ctx.measureText(displayTitle).width;
          const isRight = node.labelDirection !== "left";

          const labelOffset = currentRadius + 7;
          const labelX = isRight ? node.x + labelOffset : node.x - labelOffset;
          const labelY = node.y;

          // Hover backdrop badge
          if (isHovered) {
            const badgeLeft = isRight ? labelX - 4 : labelX - measuredW - 4;
            ctx.beginPath();
            ctx.roundRect(badgeLeft, labelY - 10, measuredW + 8, 20, 4);
            ctx.fillStyle = "rgba(18, 20, 28, 0.95)";
            ctx.fill();
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Draw label text
          ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
          ctx.shadowBlur = 4;
          ctx.fillStyle = isHovered ? "#ffffff" : isMatch && hasSearch ? "#ffffff" : "rgba(255, 255, 255, 0.84)";
          ctx.textAlign = isRight ? "left" : "right";
          ctx.textBaseline = "middle";
          ctx.fillText(displayTitle, labelX, labelY);
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      ctx.restore();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [notes, categories, hoveredNodeId, hoveredPortHubId, hoveredEdgeId, hasSearch, matchingIds]);

  // Pointer & Mouse Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    dragStartPointerRef.current = { x: clientX, y: clientY };
    hasDraggedRef.current = false;

    const { x: worldX, y: worldY } = screenToWorld(clientX, clientY, rect.width, rect.height);
    lastWorldPointerRef.current = { x: worldX, y: worldY };

    // 1. Check if clicking on the Link Port of a Category Hub to initiate drag-to-connect
    const portHit = findCategoryLinkPortAt(nodesRef.current, worldX, worldY);
    if (portHit) {
      isConnectingRef.current = true;
      setIsConnecting(true);
      connectSourceHubRef.current = portHit;
      connectCurrentPosRef.current = { x: worldX, y: worldY };
      connectHoverTargetHubRef.current = null;
      isSimulatingRef.current = true;
      return;
    }

    // 2. Check if clicking directly on a category link edge or its disconnect button
    const edgeHit = findCategoryLinkEdgeAt(edgesRef.current, nodesRef.current, worldX, worldY);
    if (edgeHit && !findNodeAt(nodesRef.current, worldX, worldY)) {
      // Direct click on the link cuts/unlinks it!
      handleDisconnectEdge(edgeHit);
      return;
    }

    // 3. Check if clicking on a node
    const clickedNode = findNodeAt(nodesRef.current, worldX, worldY);

    if (clickedNode) {
      isDraggingRef.current = true;
      draggedNodeRef.current = clickedNode;
      isSimulatingRef.current = true;
      simulationTicksRef.current = 0;
    } else {
      isPanningRef.current = true;
      setIsPanning(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const dx = clientX - dragStartPointerRef.current.x;
    const dy = clientY - dragStartPointerRef.current.y;

    if (Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
    }

    const { x: worldX, y: worldY } = screenToWorld(clientX, clientY, rect.width, rect.height);

    if (isConnectingRef.current) {
      // In Drag-to-Connect mode
      connectCurrentPosRef.current = { x: worldX, y: worldY };
      const hovered = findNodeAt(nodesRef.current, worldX, worldY);
      if (
        hovered &&
        hovered.type === "category" &&
        connectSourceHubRef.current &&
        hovered.id !== connectSourceHubRef.current.id
      ) {
        connectHoverTargetHubRef.current = hovered;
      } else {
        connectHoverTargetHubRef.current = null;
      }
      isSimulatingRef.current = true;
    } else if (isDraggingRef.current && draggedNodeRef.current) {
      draggedNodeRef.current.x = worldX;
      draggedNodeRef.current.y = worldY;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;

      lastWorldPointerRef.current = { x: worldX, y: worldY };
      isSimulatingRef.current = true;
      simulationTicksRef.current = 0;
    } else if (isPanningRef.current) {
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      dragStartPointerRef.current = { x: clientX, y: clientY };
    } else {
      // Hover hit-testing
      const portHit = findCategoryLinkPortAt(nodesRef.current, worldX, worldY);
      setHoveredPortHubId(portHit ? portHit.id : null);

      const hit = findNodeAt(nodesRef.current, worldX, worldY);
      setHoveredNodeId(hit ? hit.id : null);

      const edgeHit = findCategoryLinkEdgeAt(edgesRef.current, nodesRef.current, worldX, worldY);
      setHoveredEdgeId(edgeHit ? edgeHit.id : null);
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const { x: worldX, y: worldY } = screenToWorld(clientX, clientY, rect.width, rect.height);

    // 1. Complete Drag-to-Connect
    if (isConnectingRef.current) {
      const srcHub = connectSourceHubRef.current;
      const tgtHub = connectHoverTargetHubRef.current || findNodeAt(nodesRef.current, worldX, worldY);

      if (
        srcHub &&
        tgtHub &&
        tgtHub.type === "category" &&
        srcHub.id !== tgtHub.id &&
        onUpdateCategory
      ) {
        const srcCat = srcHub.category || {
          id: srcHub.id,
          name: srcHub.label,
          color: srcHub.color,
          linkedCategoryIds: [],
        };
        const tgtCat = tgtHub.category || {
          id: tgtHub.id,
          name: tgtHub.label,
          color: tgtHub.color,
          linkedCategoryIds: [],
        };

        const srcLinks = new Set(srcCat.linkedCategoryIds || []);
        if (srcLinks.has(tgtCat.id) || srcLinks.has(tgtCat.name.toLowerCase().trim())) {
          srcLinks.delete(tgtCat.id);
          srcLinks.delete(tgtCat.name.toLowerCase().trim());
          showToast(`Disconnected "${srcHub.label}" ✂️ "${tgtHub.label}"`);
        } else {
          srcLinks.add(tgtCat.id);
          showToast(`Connected "${srcHub.label}" ↔ "${tgtHub.label}"!`);
        }

        await onUpdateCategory(srcCat.id, {
          name: srcCat.name,
          color: srcCat.color,
          linkedCategoryIds: Array.from(srcLinks),
        });
      }

      isConnectingRef.current = false;
      setIsConnecting(false);
      connectSourceHubRef.current = null;
      connectHoverTargetHubRef.current = null;
      isSimulatingRef.current = true;
      simulationTicksRef.current = 0;
      return;
    }

    // 2. Click or Drag Node Interaction
    if (!hasDraggedRef.current) {
      const clicked = findNodeAt(nodesRef.current, worldX, worldY);

      if (clicked) {
        if (clicked.type === "note" && clicked.note) {
          onSelectNote(clicked.note);
        } else if (clicked.type === "category") {
          if (e.shiftKey && clicked.category) {
            setLinkingCategory(clicked.category);
          } else {
            onSelectCategory(clicked.tag);
          }
        }
      }
    } else if (draggedNodeRef.current) {
      const dragged = draggedNodeRef.current;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      dragged.isFixed = true;
      onPersistNodePosition?.(dragged.id, { x: dragged.x, y: dragged.y }).catch(() => undefined);
      isSimulatingRef.current = true;
      simulationTicksRef.current = 0;
    }

    isDraggingRef.current = false;
    isPanningRef.current = false;
    setIsPanning(false);
    draggedNodeRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoom(zoomFactor);
  };

  const handleToggleLink = async (targetCatId: string) => {
    if (!linkingCategory || !onUpdateCategory) return;

    const currentLinks = new Set(linkingCategory.linkedCategoryIds || []);
    if (currentLinks.has(targetCatId)) {
      currentLinks.delete(targetCatId);
    } else {
      currentLinks.add(targetCatId);
    }

    const updatedLinks = Array.from(currentLinks);
    await onUpdateCategory(linkingCategory.id, {
      name: linkingCategory.name,
      color: linkingCategory.color,
      linkedCategoryIds: updatedLinks,
    });
    setLinkingCategory({ ...linkingCategory, linkedCategoryIds: updatedLinks });
  };

  if (notes.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-accent">
          <Compass className="h-7 w-7" />
        </div>
        <h3 className="font-display text-lg font-semibold text-text">
          No items in your Knowledge Base yet
        </h3>
        <p className="mt-1 max-w-sm text-sm text-faint">
          Create your first note to start exploring your personal knowledge graph.
        </p>
        <button
          onClick={onNewNote}
          className="btn-hero mt-5 flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New Item
        </button>
      </Card>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[680px] w-full select-none overflow-hidden rounded-2xl border border-border/80 bg-surface-1/60 backdrop-blur-xs shadow-inner"
    >
      {/* Canvas Viewport */}
      <canvas
        ref={canvasRef}
        data-testid="notes-graph-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setHoveredNodeId(null);
          setHoveredPortHubId(null);
          setHoveredEdgeId(null);
          isDraggingRef.current = false;
          isPanningRef.current = false;
          isConnectingRef.current = false;
          setIsConnecting(false);
          setIsPanning(false);
          draggedNodeRef.current = null;
        }}
        onWheel={handleWheel}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        style={{
          cursor: isConnecting
            ? "crosshair"
            : hoveredPortHubId
              ? "crosshair"
              : hoveredEdgeId
                ? "pointer"
                : hoveredNodeId
                  ? "pointer"
                  : isPanning
                    ? "grabbing"
                    : "grab",
        }}
      />

      {/* Top Floating Helper Pill & Connect Actions */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <div className="pointer-events-none flex items-center gap-2 rounded-full border border-border/60 bg-surface-2/80 px-3.5 py-1.5 text-xs text-muted shadow-sm backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span>
            Drag <strong>•</strong> port to connect • Click any link line to <strong>cut / disconnect</strong>
          </span>
        </div>

        {/* Quick Link Pages Selector Button */}
        {effectiveCategories.length > 1 && onUpdateCategory && (
          <div className="relative">
            <button
              onClick={() => setLinkingCategory(effectiveCategories[0])}
              className="flex items-center gap-1.5 rounded-full border border-border/70 bg-surface-2/90 px-3 py-1.5 text-xs font-semibold text-text shadow-md transition-all hover:bg-surface-hover hover:border-accent/40 backdrop-blur-md"
            >
              <Link2 className="h-3.5 w-3.5 text-accent" />
              <span>Link Pages</span>
            </button>
          </div>
        )}
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute inset-x-0 top-14 flex justify-center z-30 pointer-events-none">
          <div className="rounded-full border border-accent/40 bg-surface-1/95 px-4 py-1.5 text-xs font-semibold text-accent shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
            {toastMessage}
          </div>
        </div>
      )}

      {/* Interactive Page Linking Popover / Modal */}
      {linkingCategory && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/90 bg-surface-1 p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ background: linkingCategory.color || "var(--accent)" }}
                />
                <h4 className="font-display font-semibold text-text">
                  Link &ldquo;{linkingCategory.name}&rdquo; Page
                </h4>
              </div>
              <button
                onClick={() => setLinkingCategory(null)}
                className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2.5 text-xs text-faint">
              Check/uncheck pages to connect or disconnect:
            </p>

            <div className="mt-3.5 max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {effectiveCategories
                .filter(
                  (c) =>
                    c.id !== linkingCategory.id &&
                    c.name.toLowerCase().trim() !== linkingCategory.name.toLowerCase().trim(),
                )
                .map((cat) => {
                  const isLinked =
                    (linkingCategory.linkedCategoryIds || []).includes(cat.id) ||
                    (linkingCategory.linkedCategoryIds || []).includes(
                      cat.name.toLowerCase().trim(),
                    );
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleToggleLink(cat.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-surface-2/60 px-3.5 py-2 text-left text-xs font-medium text-text transition-all hover:bg-surface-2 hover:border-border"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: cat.color || "var(--accent)" }}
                        />
                        <span>{cat.name}</span>
                      </div>

                      <div
                        className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${
                          isLinked
                            ? "border-accent bg-accent text-white"
                            : "border-border bg-surface-1 text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setLinkingCategory(null)}
                className="btn-hero rounded-full px-5 py-1.5 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search No Matches Feedback */}
      {noMatches && (
        <div className="absolute inset-x-0 top-16 flex justify-center">
          <div className="rounded-full border border-warn/30 bg-surface-2/95 px-4 py-1.5 text-xs font-medium text-warn shadow-lg backdrop-blur-md">
            No matching nodes found for &ldquo;{search}&rdquo;
          </div>
        </div>
      )}

      {/* Bottom Right Floating HUD Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-border/70 bg-surface-2/90 p-1 shadow-lg backdrop-blur-md">
        <button
          onClick={() => handleZoom(0.15)}
          title="Zoom In"
          className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => handleZoom(-0.15)}
          title="Zoom Out"
          className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={resetCamera}
          title="Reset Camera"
          className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border/80" />

        <div className="px-2 text-[11px] font-medium text-faint">
          {Math.round(cameraScale * 100)}%
        </div>
      </div>

      {/* Bottom Left Summary Statistics Badge */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-border/50 bg-surface-2/70 px-3 py-1 text-[11px] text-faint backdrop-blur-md">
        <span>{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
        <span>•</span>
        <span>{effectiveCategories.length} {effectiveCategories.length === 1 ? "page" : "pages"}</span>
      </div>
    </div>
  );
}
