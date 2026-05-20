import { useRef, useCallback, RefObject } from "react";

export interface PenSettings {
  color:     string;
  thickness: number;
  opacity:   number;
  mode:      "pen" | "eraser";
}

export interface Point {
  x:         number;
  y:         number;
  pressure?: number;
}

interface Stroke {
  mode:      "pen" | "eraser";
  color:     string;
  opacity:   number;
  width:     number;          /* pre-multiplied by dpr; constant per stroke */
  points:    Point[];
}

/**
 * Drawing engine — vector strokes, GPU canvas.
 *
 * Why a vector model:
 * Snapshotting the full canvas before every stroke (the previous approach)
 * allocated ~150MB of GPU memory per stroke on a tall iPad canvas and
 * piled up dozens of those in the undo history. That swamped the GPU
 * scheduler and made every new stroke appear seconds after it was drawn.
 *
 * Storing strokes as tiny JS objects costs effectively nothing. Undo
 * pops the last stroke and replays the rest — fast for any realistic
 * number of strokes (a typical tracing session is <200).
 */
export function useCanvas(penSettings: PenSettings, _containerRef: RefObject<HTMLElement | null>) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const isDrawing    = useRef(false);

  /* All committed strokes (used to redraw on resize and on undo) */
  const strokes      = useRef<Stroke[]>([]);
  /* Undo stack — each entry is a snapshot of `strokes` (shallow copy)
     so that "Clear" is undoable too. Memory is tiny: just arrays of
     stroke references. */
  const undoStack    = useRef<Stroke[][]>([]);
  const MAX_UNDO     = 50;

  /* The stroke currently being drawn */
  const currentStroke = useRef<Stroke | null>(null);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  /* Cap DPR at 2 so the canvas buffer doesn't balloon on 3x iPads. */
  const getDpr = () => Math.min(window.devicePixelRatio || 1, 2);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number, pressure = 1): Point => {
      const canvas = canvasRef.current!;
      const rect   = canvas.getBoundingClientRect();
      const dpr    = getDpr();
      return {
        x: (clientX - rect.left) * dpr,
        y: (clientY - rect.top)  * dpr,
        pressure,
      };
    },
    [],
  );

  /* Apply a stroke's style to the context. Called once per stroke,
     never per segment. */
  const applyStrokeStyle = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.mode === "eraser") {
      ctx.globalCompositeOperation = "destination-out" as GlobalCompositeOperation;
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = s.opacity;
      ctx.strokeStyle = s.color;
      ctx.fillStyle   = s.color;
    }
    ctx.lineWidth = s.width;
    ctx.lineCap   = "round";
    ctx.lineJoin  = "round";
  };

  /* Draw an entire stroke from scratch (used on resize / undo) */
  const renderStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    const pts = s.points;
    if (pts.length === 0) return;
    applyStrokeStyle(ctx, s);

    if (pts.length === 1) {
      const p = pts[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(s.width / 2, 0.5), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      /* Quadratic midpoint smoothing through all points */
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  };

  /* Replay every stroke onto a freshly cleared canvas */
  const renderAll = useCallback(() => {
    const ctx    = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    for (const s of strokes.current) renderStroke(ctx, s);
  }, [getContext]);

  const pushUndo = () => {
    /* Shallow copy of the strokes array — entries are reused references */
    undoStack.current.push(strokes.current.slice());
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
  };

  const startDrawing = useCallback(
    (point: Point) => {
      const ctx = getContext();
      if (!ctx) return;
      const dpr = getDpr();

      const width = penSettings.mode === "eraser"
        ? penSettings.thickness * 3 * dpr
        : penSettings.thickness * (point.pressure ?? 0.5) * dpr;

      const stroke: Stroke = {
        mode:    penSettings.mode,
        color:   penSettings.color,
        opacity: penSettings.opacity,
        width,
        points:  [point],
      };

      pushUndo();
      strokes.current.push(stroke);
      currentStroke.current = stroke;
      isDrawing.current     = true;

      /* Set state once for the whole stroke */
      applyStrokeStyle(ctx, stroke);
    },
    [getContext, penSettings],
  );

  const draw = useCallback(
    (rawPoint: Point) => {
      if (!isDrawing.current) return;
      const ctx    = getContext();
      const stroke = currentStroke.current;
      if (!ctx || !stroke) return;

      /* Light low-pass filter on the incoming sample — removes the
         small high-frequency jitter Apple Pencil produces without
         adding perceptible lag. The combination of this EMA plus the
         quadratic midpoint curve below gives a noticeably smoother
         feel than raw samples alone. */
      const prev = stroke.points[stroke.points.length - 1];
      const alpha = 0.55; // weight of the new sample
      const point: Point = prev
        ? {
            x: prev.x * (1 - alpha) + rawPoint.x * alpha,
            y: prev.y * (1 - alpha) + rawPoint.y * alpha,
            pressure: rawPoint.pressure,
          }
        : rawPoint;

      stroke.points.push(point);
      const pts = stroke.points;
      const n   = pts.length;

      /* Incremental segment — draw only the newest piece */
      ctx.beginPath();
      if (n === 2) {
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
      } else if (n >= 3) {
        const p0 = pts[n - 3];
        const p1 = pts[n - 2];
        const p2 = pts[n - 1];
        const midA = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const midB = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        ctx.moveTo(midA.x, midA.y);
        ctx.quadraticCurveTo(p1.x, p1.y, midB.x, midB.y);
      }
      ctx.stroke();
    },
    [getContext],
  );

  const stopDrawing = useCallback(() => {
    const ctx    = getContext();
    const stroke = currentStroke.current;

    /* Single-point tap → draw a dot so the user sees feedback */
    if (ctx && stroke && stroke.points.length === 1 && stroke.mode !== "eraser") {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(stroke.width / 2, 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    isDrawing.current     = false;
    currentStroke.current = null;
  }, [getContext]);

  /* Cancel any in-flight stroke so undo/clear can mutate the stroke
     list without orphaning the active currentStroke reference. */
  const cancelActiveStroke = () => {
    isDrawing.current     = false;
    currentStroke.current = null;
  };

  const undo = useCallback(() => {
    cancelActiveStroke();
    const prev = undoStack.current.pop();
    if (!prev) return;
    strokes.current = prev;
    renderAll();
  }, [renderAll]);

  const clear = useCallback(() => {
    cancelActiveStroke();
    pushUndo();
    strokes.current = [];
    const ctx    = getContext();
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [getContext]);

  const clearHistory = useCallback(() => {
    cancelActiveStroke();
    strokes.current  = [];
    undoStack.current = [];
    const ctx    = getContext();
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [getContext]);

  const downloadAsImage = useCallback(
    (_textLayerRef: RefObject<HTMLElement | null>, _showText: boolean, fileName: string) => {
      const drawingCanvas = canvasRef.current;
      if (!drawingCanvas) return;
      const exportCanvas  = document.createElement("canvas");
      exportCanvas.width  = drawingCanvas.width;
      exportCanvas.height = drawingCanvas.height;
      const exportCtx     = exportCanvas.getContext("2d")!;
      exportCtx.fillStyle = "#FDFCF7";
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx.drawImage(drawingCanvas, 0, 0);
      const link    = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href     = exportCanvas.toDataURL("image/png");
      link.click();
    },
    [],
  );

  return {
    canvasRef, startDrawing, draw, stopDrawing,
    undo, clear, clearHistory, downloadAsImage,
    getCanvasPoint, isDrawing,
    /* Exposed so SurahDisplay can replay strokes after a canvas resize
       instead of doing an expensive snapshot/restore. */
    renderAll,
  };
}
