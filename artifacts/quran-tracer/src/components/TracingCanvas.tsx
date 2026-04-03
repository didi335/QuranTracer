import { useRef, useEffect, useCallback } from "react";
import { useCanvas, PenSettings } from "@/hooks/useCanvas";

interface TracingCanvasProps {
  penSettings: PenSettings;
  showText: boolean;
  arabicText: string;
  onCanvasReady?: (handlers: {
    undo: () => void;
    clear: () => void;
    download: () => void;
  }) => void;
  verseName: string;
}

export function TracingCanvas({
  penSettings,
  showText,
  arabicText,
  onCanvasReady,
  verseName,
}: TracingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    canvasRef,
    startDrawing,
    draw,
    stopDrawing,
    undo,
    clear,
    downloadAsImage,
    getCanvasPoint,
  } = useCanvas(penSettings);

  const download = useCallback(() => {
    downloadAsImage(textCanvasRef, showText, verseName);
  }, [downloadAsImage, showText, verseName]);

  useEffect(() => {
    onCanvasReady?.({ undo, clear, download });
  }, [onCanvasReady, undo, clear, download]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const textCanvas = textCanvasRef.current;
    if (textCanvas) {
      textCanvas.width = rect.width * dpr;
      textCanvas.height = rect.height * dpr;
      textCanvas.style.width = `${rect.width}px`;
      textCanvas.style.height = `${rect.height}px`;
    }
  }, [canvasRef]);

  useEffect(() => {
    const textCanvas = textCanvasRef.current;
    const container = containerRef.current;
    if (!textCanvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = textCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);

    if (!showText) return;

    const w = textCanvas.width;
    const h = textCanvas.height;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";

    const maxWidth = w * 0.85;
    let fontSize = Math.min(w * 0.09, 96 * dpr);

    ctx.font = `${fontSize}px "Scheherazade New", "Amiri", serif`;

    let metrics = ctx.measureText(arabicText);
    while (metrics.width > maxWidth && fontSize > 20 * dpr) {
      fontSize -= 2 * dpr;
      ctx.font = `${fontSize}px "Scheherazade New", "Amiri", serif`;
      metrics = ctx.measureText(arabicText);
    }

    ctx.fillStyle = "rgba(30, 30, 30, 0.18)";
    ctx.fillText(arabicText, w / 2, h / 2);
    ctx.restore();
  }, [arabicText, showText]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      e.preventDefault();
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      const point = getCanvasPoint(e.clientX, e.clientY, pressure);
      startDrawing(point);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    },
    [getCanvasPoint, startDrawing]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      e.preventDefault();
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      const point = getCanvasPoint(e.clientX, e.clientY, pressure);
      draw(point);
    },
    [getCanvasPoint, draw]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      stopDrawing();
    },
    [stopDrawing]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={textCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ touchAction: "none" }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
