import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Verse, Chapter } from "@/services/quranApi";
import { useCanvas, PenSettings } from "@/hooks/useCanvas";

interface SurahDisplayProps {
  chapter: Chapter | null;
  verses: Verse[];
  showText: boolean;
  penSettings: PenSettings;
  isDark: boolean;
}

export interface SurahDisplayHandle {
  undo: () => void;
  clear: () => void;
  download: () => void;
}

export const SurahDisplay = forwardRef<SurahDisplayHandle, SurahDisplayProps>(
  function SurahDisplay({ chapter, verses, showText, penSettings, isDark }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { canvasRef, startDrawing, draw, stopDrawing, undo, clear, clearHistory, downloadAsImage, getCanvasPoint } =
      useCanvas(penSettings, scrollRef);

    // Sync canvas size to text layer size whenever verses/chapter changes
    const syncCanvasSize = useCallback(() => {
      const canvas = canvasRef.current;
      const textLayer = textLayerRef.current;
      if (!canvas || !textLayer) return;

      const dpr = window.devicePixelRatio || 1;
      const w = textLayer.offsetWidth;
      const h = textLayer.offsetHeight;

      if (w === 0 || h === 0) return;

      // Save current drawing
      const ctx = canvas.getContext("2d");
      let saved: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        try { saved = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { saved = null; }
      }

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      // Restore drawing (best-effort)
      if (saved && ctx) {
        try { ctx.putImageData(saved, 0, 0); } catch { /* ignore */ }
      }
    }, [canvasRef]);

    // Clear and resize when chapter changes
    useEffect(() => {
      clearHistory();
      // Wait for DOM to render
      const id = setTimeout(() => syncCanvasSize(), 50);
      return () => clearTimeout(id);
    }, [chapter?.id, clearHistory, syncCanvasSize]);

    // Resize observer on text layer
    useEffect(() => {
      const el = textLayerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => syncCanvasSize());
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncCanvasSize]);

    useImperativeHandle(ref, () => ({
      undo,
      clear,
      download: () => downloadAsImage(textLayerRef, showText, chapter ? `${chapter.name_simple}-${chapter.id}` : "quran"),
    }));

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.pointerType === "touch" && !e.isPrimary) return;
        e.preventDefault();
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        startDrawing(getCanvasPoint(e.clientX, e.clientY, pressure));
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      },
      [startDrawing, getCanvasPoint]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.pointerType === "touch" && !e.isPrimary) return;
        e.preventDefault();
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        draw(getCanvasPoint(e.clientX, e.clientY, pressure));
      },
      [draw, getCanvasPoint]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        stopDrawing();
      },
      [stopDrawing]
    );

    const textColor = isDark ? "rgba(240, 230, 210, 0.92)" : "rgba(20, 20, 30, 0.90)";
    const verseMarkerColor = isDark ? "rgba(212, 175, 55, 0.80)" : "rgba(26, 82, 118, 0.70)";
    const bismillahColor = isDark ? "rgba(212, 175, 55, 0.88)" : "rgba(26, 82, 118, 0.85)";

    return (
      <div ref={containerRef} className="relative w-full h-full" style={{ touchAction: "none" }}>
        {/* Scrollable wrapper */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ touchAction: showText ? "pan-y" : "none" }}
        >
          {/* Text layer */}
          <div
            ref={textLayerRef}
            className="relative w-full px-8 py-10"
            style={{
              minHeight: "100%",
              pointerEvents: "none",
              display: showText ? "block" : "block",
              opacity: showText ? 1 : 0,
              userSelect: "none",
            }}
          >
            {chapter && (
              <>
                {/* Surah header */}
                <div className="text-center mb-8">
                  <div
                    className="inline-block px-8 py-3 rounded-2xl mb-3"
                    style={{
                      background: isDark ? "rgba(212,175,55,0.12)" : "rgba(26,82,118,0.08)",
                      border: `1px solid ${isDark ? "rgba(212,175,55,0.3)" : "rgba(26,82,118,0.2)"}`,
                    }}
                  >
                    <p
                      dir="rtl"
                      style={{
                        fontFamily: '"Scheherazade New", "Amiri", serif',
                        fontSize: "clamp(28px, 4vw, 48px)",
                        color: isDark ? "#d4af37" : "#1a5276",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {chapter.name_arabic}
                    </p>
                    <p
                      style={{
                        fontSize: "clamp(11px, 1.5vw, 14px)",
                        color: isDark ? "#a0a0c0" : "#7f8c8d",
                        marginTop: 4,
                        letterSpacing: "0.05em",
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {chapter.name_simple} · {chapter.translated_name.name} · {chapter.verses_count} verses
                    </p>
                  </div>

                  {/* Bismillah (all surahs except Al-Fatihah (1) and At-Tawbah (9)) */}
                  {chapter.bismillah_pre && (
                    <p
                      dir="rtl"
                      className="mt-4"
                      style={{
                        fontFamily: '"Scheherazade New", "Amiri", serif',
                        fontSize: "clamp(28px, 3.5vw, 44px)",
                        color: bismillahColor,
                        lineHeight: 2,
                        textAlign: "center",
                      }}
                    >
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div
                  className="mb-8 mx-auto"
                  style={{
                    height: 1,
                    background: isDark ? "rgba(212,175,55,0.2)" : "rgba(26,82,118,0.12)",
                    maxWidth: "80%",
                  }}
                />

                {/* Verses - all together, flowing text */}
                <div
                  dir="rtl"
                  style={{
                    fontFamily: '"Scheherazade New", "Amiri", serif',
                    fontSize: "clamp(24px, 3vw, 40px)",
                    lineHeight: 2.4,
                    color: textColor,
                    textAlign: "justify",
                    wordSpacing: "0.1em",
                    padding: "0 2%",
                  }}
                >
                  {verses.map((v) => (
                    <span key={v.id}>
                      {v.text_uthmani}
                      <span
                        style={{
                          fontFamily: '"Scheherazade New", "Amiri", serif',
                          fontSize: "0.7em",
                          color: verseMarkerColor,
                          marginRight: "0.3em",
                          marginLeft: "0.3em",
                          verticalAlign: "middle",
                        }}
                      >
                        ۝{toArabicNumerals(v.verse_number)}
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-16" />
              </>
            )}
          </div>

          {/* Drawing canvas — absolutely overlays text layer, same height */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{
              touchAction: "none",
              zIndex: 10,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
      </div>
    );
  }
);

function toArabicNumerals(n: number): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(n)
    .split("")
    .map((d) => arabicDigits[parseInt(d)] ?? d)
    .join("");
}
