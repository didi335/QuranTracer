import { useRef, useCallback, useEffect } from "react";

export interface PenSettings {
  color: string;
  thickness: number;
  opacity: number;
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export function useCanvas(penSettings: PenSettings) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const history = useRef<ImageData[]>([]);
  const MAX_HISTORY = 30;

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number, pressure = 1): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
        pressure,
      };
    },
    []
  );

  const saveToHistory = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    history.current.push(imageData);
    if (history.current.length > MAX_HISTORY) {
      history.current.shift();
    }
  }, [getContext]);

  const startDrawing = useCallback(
    (point: Point) => {
      saveToHistory();
      isDrawing.current = true;
      lastPoint.current = point;

      const ctx = getContext();
      if (!ctx) return;

      ctx.save();
      ctx.globalAlpha = penSettings.opacity;
      ctx.strokeStyle = penSettings.color;
      ctx.lineWidth = penSettings.thickness * (point.pressure ?? 1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.arc(point.x, point.y, (penSettings.thickness * (point.pressure ?? 1)) / 2, 0, Math.PI * 2);
      ctx.fillStyle = penSettings.color;
      ctx.fill();
      ctx.restore();
    },
    [getContext, penSettings, saveToHistory]
  );

  const draw = useCallback(
    (point: Point) => {
      if (!isDrawing.current || !lastPoint.current) return;

      const ctx = getContext();
      if (!ctx) return;

      ctx.save();
      ctx.globalAlpha = penSettings.opacity;
      ctx.strokeStyle = penSettings.color;
      ctx.lineWidth = penSettings.thickness * (point.pressure ?? 1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);

      const midX = (lastPoint.current.x + point.x) / 2;
      const midY = (lastPoint.current.y + point.y) / 2;
      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
      ctx.stroke();
      ctx.restore();

      lastPoint.current = point;
    },
    [getContext, penSettings]
  );

  const stopDrawing = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  const undo = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    if (history.current.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const lastState = history.current.pop()!;
    ctx.putImageData(lastState, 0, 0);
  }, [getContext]);

  const clear = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    saveToHistory();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [getContext, saveToHistory]);

  const downloadAsImage = useCallback(
    (textCanvasRef: React.RefObject<HTMLCanvasElement | null>, showText: boolean, verseName: string) => {
      const drawingCanvas = canvasRef.current;
      if (!drawingCanvas) return;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = drawingCanvas.width;
      exportCanvas.height = drawingCanvas.height;
      const exportCtx = exportCanvas.getContext("2d")!;

      exportCtx.fillStyle = "#FDFCF7";
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      if (showText && textCanvasRef.current) {
        exportCtx.drawImage(textCanvasRef.current, 0, 0);
      }

      exportCtx.drawImage(drawingCanvas, 0, 0);

      const link = document.createElement("a");
      link.download = `quran-trace-${verseName.replace(/\s+/g, "-")}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventScroll = (e: TouchEvent) => {
      if (isDrawing.current) {
        e.preventDefault();
      }
    };

    canvas.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      canvas.removeEventListener("touchmove", preventScroll);
    };
  }, []);

  return {
    canvasRef,
    startDrawing,
    draw,
    stopDrawing,
    undo,
    clear,
    downloadAsImage,
    getCanvasPoint,
  };
}
