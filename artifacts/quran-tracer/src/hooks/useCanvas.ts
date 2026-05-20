import { useRef, useCallback, useEffect, RefObject } from "react";

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

export function useCanvas(penSettings: PenSettings, containerRef: RefObject<HTMLElement | null>) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const isDrawing    = useRef(false);
  const lastPoint    = useRef<Point | null>(null);
  const history      = useRef<ImageData[]>([]);
  const MAX_HISTORY  = 50;

  /* Committed-state approach — eliminates per-segment opacity overlap */
  const currentStrokePoints = useRef<Point[]>([]);

  /* GPU-accelerated context. We only read pixels in saveToHistory()
     (undo), which is infrequent — willReadFrequently:true would force
     a CPU-backed bitmap and make every stroke segment slower. */
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  /* Cap DPR at 2 so the canvas buffer doesn't balloon on 3x iPads.
     The visual difference between 2x and 3x for ink strokes is
     imperceptible, but the per-frame fill cost roughly doubles. */
  const getDpr = () => Math.min(window.devicePixelRatio || 1, 2);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number, pressure = 1): Point => {
      const canvas = canvasRef.current!;
      const rect   = canvas.getBoundingClientRect();
      const dpr    = getDpr();
      return {
        x: (clientX - rect.left)  * dpr,
        y: (clientY - rect.top)   * dpr,
        pressure,
      };
    },
    [],
  );

  const saveToHistory = useCallback(() => {
    const ctx    = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    history.current.push(imageData);
    if (history.current.length > MAX_HISTORY) history.current.shift();
  }, [getContext]);

  const startDrawing = useCallback(
    (point: Point) => {
      saveToHistory();
      isDrawing.current           = true;
      lastPoint.current           = point;
      currentStrokePoints.current = [point];

      /* Set stroke state ONCE per stroke — re-applying ctx.save/restore
         and re-setting strokeStyle/lineCap/etc. on every coalesced
         pointer sample was the main source of trace lag. */
      const ctx = getContext();
      if (!ctx) return;
      const dpr = getDpr();
      if (penSettings.mode === "eraser") {
        ctx.globalCompositeOperation = "destination-out" as GlobalCompositeOperation;
        ctx.globalAlpha = 1;
        ctx.lineWidth   = penSettings.thickness * 3 * dpr;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = penSettings.opacity;
        ctx.strokeStyle = penSettings.color;
        ctx.fillStyle   = penSettings.color;
        /* Use a constant width per stroke based on the start pressure.
           Re-deriving width per segment caused both extra work and
           visually wobbly strokes on the iPad. */
        ctx.lineWidth   = penSettings.thickness * (point.pressure ?? 0.5) * dpr;
      }
      ctx.lineCap  = "round";
      ctx.lineJoin = "round";
    },
    [saveToHistory, getContext, penSettings],
  );

  const draw = useCallback(
    (point: Point) => {
      if (!isDrawing.current || !lastPoint.current) return;
      const ctx = getContext();
      if (!ctx) return;

      /* ── Eraser ── */
      if (penSettings.mode === "eraser") {
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPoint.current = point;
        currentStrokePoints.current.push(point);
        return;
      }

      /* ── Pen: incremental segment drawing with midpoint smoothing. */
      currentStrokePoints.current.push(point);
      const pts = currentStrokePoints.current;
      const n   = pts.length;

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

      lastPoint.current = point;
    },
    [getContext, penSettings.mode],
  );

  const stopDrawing = useCallback(() => {
    /* If the user tapped without moving, draw a dot */
    if (isDrawing.current && currentStrokePoints.current.length === 1 &&
        penSettings.mode !== "eraser") {
      const ctx = getContext();
      const pt  = currentStrokePoints.current[0];
      if (ctx) {
        ctx.save();
        ctx.globalAlpha = penSettings.opacity;
        ctx.fillStyle   = penSettings.color;
        const r = (penSettings.thickness * (pt.pressure ?? 0.5)) / 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(r, 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    isDrawing.current           = false;
    lastPoint.current           = null;
    currentStrokePoints.current = [];
  }, [getContext, penSettings]);

  const undo = useCallback(() => {
    const ctx    = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    if (history.current.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.putImageData(history.current.pop()!, 0, 0);
  }, [getContext]);

  const clear = useCallback(() => {
    const ctx    = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    saveToHistory();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [getContext, saveToHistory]);

  const clearHistory = useCallback(() => {
    history.current = [];
    const ctx    = getContext();
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [getContext]);

  const downloadAsImage = useCallback(
    (textLayerRef: RefObject<HTMLElement | null>, showText: boolean, fileName: string) => {
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

  /* touchmove prevention is handled in SurahDisplay on the scroll container */

  return {
    canvasRef, startDrawing, draw, stopDrawing,
    undo, clear, clearHistory, downloadAsImage,
    getCanvasPoint, isDrawing,
  };
}
