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

const ARABIC_FONT = '"Amiri Quran", "Scheherazade New", "Amiri", serif';

export const SurahDisplay = forwardRef<SurahDisplayHandle, SurahDisplayProps>(
  function SurahDisplay({ chapter, verses, showText, penSettings, isDark }, ref) {
    const textLayerRef = useRef<HTMLDivElement>(null);
    const scrollRef    = useRef<HTMLDivElement>(null);

    const { canvasRef, startDrawing, draw, stopDrawing, undo, clear, clearHistory, downloadAsImage, getCanvasPoint } =
      useCanvas(penSettings, scrollRef);

    /* ── Canvas sizing ─────────────────────────────────────── */
    const syncCanvasSize = useCallback(() => {
      const canvas    = canvasRef.current;
      const textLayer = textLayerRef.current;
      if (!canvas || !textLayer) return;
      const dpr = window.devicePixelRatio || 1;
      const w   = textLayer.offsetWidth;
      const h   = textLayer.offsetHeight;
      if (w === 0 || h === 0) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let saved: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        try { saved = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { saved = null; }
      }
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      if (saved && ctx) { try { ctx.putImageData(saved, 0, 0); } catch { /* ignore */ } }
    }, [canvasRef]);

    useEffect(() => {
      clearHistory();
      const id = setTimeout(() => syncCanvasSize(), 80);
      return () => clearTimeout(id);
    }, [chapter?.id, clearHistory, syncCanvasSize]);

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
      download: () => downloadAsImage(
        textLayerRef, showText,
        chapter ? `${chapter.name_simple}-${chapter.id}` : "quran"
      ),
    }));

    /* ── Pointer events ────────────────────────────────────── */
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && !e.isPrimary) return;
      e.preventDefault();
      startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }, [startDrawing, getCanvasPoint]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && !e.isPrimary) return;
      e.preventDefault();
      draw(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
    }, [draw, getCanvasPoint]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      stopDrawing();
    }, [stopDrawing]);

    /* ── Derived colours ───────────────────────────────────── */
    const textColor      = isDark ? "rgba(238,228,205,0.94)" : "rgba(12,12,22,0.90)";
    const bismillahColor = isDark ? "#d4af37"                : "#1a5276";
    const headerAccent   = isDark ? "#d4af37"                : "#1a5276";
    const headerBg       = isDark ? "rgba(212,175,55,0.08)"  : "rgba(26,82,118,0.05)";
    const headerBorder   = isDark ? "rgba(212,175,55,0.22)"  : "rgba(26,82,118,0.14)";
    const dividerColor   = isDark ? "rgba(212,175,55,0.12)"  : "rgba(26,82,118,0.08)";
    // Verse marker — blue family to match the app theme
    const markerRing     = isDark ? "#4a7fbe"                : "#1a5276";
    const markerFill     = isDark ? "rgba(74,127,190,0.12)"  : "rgba(26,82,118,0.07)";
    const markerText     = isDark ? "#7ab0e8"                : "#1a5276";

    // Page number: use page_number from the first verse
    const pageNumber = verses.length > 0 ? verses[0].page_number : null;

    return (
      <div className="relative w-full h-full" style={{ touchAction: "none" }}>
        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ touchAction: showText ? "pan-y" : "none" }}
        >
          {/* Text layer */}
          <div
            ref={textLayerRef}
            className="relative w-full"
            style={{ minHeight: "100%", pointerEvents: "none", userSelect: "none" }}
          >
            {/* Content column — centred, max width for readability */}
            <div
              style={{
                maxWidth: 860,
                margin: "0 auto",
                paddingTop: 52,
                paddingBottom: 72,
                paddingLeft: 52,
                paddingRight: 52,
                opacity: showText ? 1 : 0,
                transition: "opacity 0.25s ease",
              }}
            >
              {chapter && (
                <>
                  {/* ── Surah header ── */}
                  <div className="text-center mb-8">
                    <div
                      className="inline-block px-10 py-4 rounded-2xl"
                      style={{ background: headerBg, border: `1px solid ${headerBorder}` }}
                    >
                      <p
                        dir="rtl"
                        style={{
                          fontFamily: ARABIC_FONT,
                          fontSize: "clamp(30px, 4vw, 50px)",
                          color: headerAccent,
                          lineHeight: 1.4,
                          margin: 0,
                        }}
                      >
                        {chapter.name_arabic}
                      </p>
                      <p
                        style={{
                          fontSize: "clamp(10px, 1.3vw, 13px)",
                          color: isDark ? "#8888aa" : "#7f8c8d",
                          marginTop: 5,
                          letterSpacing: "0.08em",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {chapter.name_simple} · {chapter.translated_name.name} · {chapter.verses_count} ayahs
                      </p>
                    </div>

                    {/* Bismillah */}
                    {chapter.bismillah_pre && (
                      <p
                        dir="rtl"
                        style={{
                          fontFamily: ARABIC_FONT,
                          fontSize: "clamp(26px, 3vw, 42px)",
                          color: bismillahColor,
                          lineHeight: 2,
                          textAlign: "center",
                          marginTop: 20,
                          marginBottom: 0,
                          opacity: 0.88,
                        }}
                      >
                        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: dividerColor, margin: "0 8% 36px" }} />

                  {/* ── Flowing verse text ─────────────────────────────── */}
                  {/*
                    All ayahs rendered as a single continuous RTL paragraph.
                    Each ayah is followed by its inline numbered marker.
                    Text justifies naturally across lines, exactly like a Mushaf page.
                  */}
                  <p
                    dir="rtl"
                    style={{
                      fontFamily: ARABIC_FONT,
                      fontSize: "clamp(26px, 2.8vw, 40px)",
                      lineHeight: 2.2,
                      color: textColor,
                      textAlign: "justify",
                      textAlignLast: "right",
                      wordSpacing: "0.06em",
                      margin: 0,
                    }}
                  >
                    {verses.map((v) => (
                      <span key={v.id}>
                        {v.text_uthmani}
                        {/* Inline ayah end-marker — styled circle, blue */}
                        <AyahMarker
                          n={v.verse_number}
                          ringColor={markerRing}
                          fillColor={markerFill}
                          textColor={markerText}
                        />
                      </span>
                    ))}
                  </p>

                  {/* ── Page number ────────────────────────────────────── */}
                  {pageNumber && (
                    <div
                      style={{
                        marginTop: 48,
                        textAlign: "center",
                        color: isDark ? "#5a5a8a" : "#aaa9a0",
                        fontSize: "clamp(11px, 1.2vw, 13px)",
                        fontWeight: 500,
                        letterSpacing: "0.06em",
                      }}
                    >
                      — {pageNumber} —
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Drawing canvas — overlays text layer */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{ touchAction: "none", zIndex: 10 }}
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

/* ── Inline ayah-end marker ─────────────────────────────────── */
function AyahMarker({
  n, ringColor, fillColor, textColor,
}: {
  n: number;
  ringColor: string;
  fillColor: string;
  textColor: string;
}) {
  return (
    <span
      aria-label={`Ayah ${n}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        width: "1.45em",
        height: "1.45em",
        verticalAlign: "middle",
        margin: "0 0.28em",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 38 38"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* outer dashed ring */}
        <circle cx="19" cy="19" r="17.5" fill="none" stroke={ringColor} strokeWidth="1" strokeDasharray="2.4 2" opacity="0.6" />
        {/* solid inner ring */}
        <circle cx="19" cy="19" r="14"   fill="none" stroke={ringColor} strokeWidth="1.4" opacity="0.85" />
        {/* filled centre */}
        <circle cx="19" cy="19" r="11"   fill={fillColor} />
      </svg>
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: "0.38em",
          fontFamily: ARABIC_FONT,
          fontWeight: 700,
          color: textColor,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {toArabicNumerals(n)}
      </span>
    </span>
  );
}

function toArabicNumerals(n: number): string {
  const d = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  return String(n).split("").map(c => d[+c] ?? c).join("");
}
