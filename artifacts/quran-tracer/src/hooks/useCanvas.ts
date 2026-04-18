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
  const committedImage      = useRef<ImageData | null>(null);
  const currentStrokePoints = useRef<Point[]>([]);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d", { willReadFrequently: true });
  }, []);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number, pressure = 1): Point => {
      const canvas = canvasRef.current!;
      const rect   = canvas.getBoundingClientRect();
      const dpr    = window.devicePixelRatio || 1;
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

      const ctx    = getContext();
      const canvas = canvasRef.current;

      if (penSettings.mode === "eraser") return; // eraser: no committed snapshot needed

      /* Snapshot canvas before this stroke so we can redraw the whole
         stroke each frame without per-segment opacity stacking */
      if (ctx && canvas) {
        committedImage.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    },
    [getContext, penSettings.mode, saveToHistory],
  );

  const draw = useCallback(
    (point: Point) => {
      if (!isDrawing.current || !lastPoint.current) return;
      const ctx    = getContext();
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      /* ── Eraser: destination-out, direct per-segment (no overlap issue) ── */
      if (penSettings.mode === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out" as GlobalCompositeOperation;
        ctx.lineWidth = penSettings.thickness * 3 * (window.devicePixelRatio || 1);
        ctx.lineCap   = "round";
        ctx.lineJoin  = "round";
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        ctx.restore();
        lastPoint.current = point;
        return;
      }

      /* ── Pen: accumulate points, restore committed state, redraw full stroke ── */
      currentStrokePoints.current.push(point);

      if (committedImage.current) {
        ctx.putImageData(committedImage.current, 0, 0);
      }

      const pts = currentStrokePoints.current;
      ctx.save();
      ctx.globalAlpha  = penSettings.opacity;
      ctx.strokeStyle  = penSettings.color;
      ctx.lineWidth    = penSettings.thickness * (point.pressure ?? 0.5) * (window.devicePixelRatio || 1);
      ctx.lineCap      = "round";
      ctx.lineJoin     = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();

      lastPoint.current = point;
    },
    [getContext, penSettings],
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
    committedImage.current      = null;
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preventScroll = (e: TouchEvent) => {
      if (isDrawing.current) e.preventDefault();
    };
    canvas.addEventListener("touchmove", preventScroll, { passive: false });
    return () => canvas.removeEventListener("touchmove", preventScroll);
  }, []);

  return {
    canvasRef, startDrawing, draw, stopDrawing,
    undo, clear, clearHistory, downloadAsImage,
    getCanvasPoint, isDrawing,
  };
}
