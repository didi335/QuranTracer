import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { Verse, Chapter } from "@/services/quranApi";
import { useCanvas, PenSettings } from "@/hooks/useCanvas";

interface SurahDisplayProps {
  chapters:    Chapter[];
  verses:      Verse[];
  currentPage: number;
  showText:    boolean;
  penSettings: PenSettings;
  isDark:      boolean;
}

export interface SurahDisplayHandle {
  undo:     () => void;
  clear:    () => void;
  download: () => void;
}

const ARABIC_FONT = '"Amiri Quran", "Scheherazade New", "Amiri", serif';

export const SurahDisplay = forwardRef<SurahDisplayHandle, SurahDisplayProps>(
  function SurahDisplay({ chapters, verses, currentPage, showText, penSettings, isDark }, ref) {
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
      const ctx   = canvas.getContext("2d", { willReadFrequently: true });
      let saved: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        try { saved = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { saved = null; }
      }
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      if (saved && ctx) { try { ctx.putImageData(saved, 0, 0); } catch { /* ok */ } }
    }, [canvasRef]);

    useEffect(() => {
      clearHistory();
      const id = setTimeout(() => syncCanvasSize(), 80);
      return () => clearTimeout(id);
    }, [currentPage, clearHistory, syncCanvasSize]);

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
      download: () => downloadAsImage(textLayerRef, showText, `quran-page-${currentPage}`),
    }));

    /* ── Pointer events ────────────────────────────────────── */
    const onDown   = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && !e.isPrimary) return;
      e.preventDefault();
      startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }, [startDrawing, getCanvasPoint]);

    const onMove   = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && !e.isPrimary) return;
      e.preventDefault();
      draw(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
    }, [draw, getCanvasPoint]);

    const onUp     = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault(); stopDrawing();
    }, [stopDrawing]);

    /* ── Derived colours ───────────────────────────────────── */
    const textColor    = isDark ? "rgba(238,228,205,0.94)" : "rgba(12,12,22,0.90)";
    const accentColor  = isDark ? "#d4af37"                : "#1a5276";
    const headerBg     = isDark ? "rgba(212,175,55,0.08)"  : "rgba(26,82,118,0.05)";
    const headerBorder = isDark ? "rgba(212,175,55,0.22)"  : "rgba(26,82,118,0.14)";
    const divColor     = isDark ? "rgba(212,175,55,0.12)"  : "rgba(26,82,118,0.08)";
    const markerRing   = isDark ? "#4a7fbe"                : "#1a5276";
    const markerFill   = isDark ? "rgba(74,127,190,0.12)"  : "rgba(26,82,118,0.07)";
    const markerNum    = isDark ? "#7ab0e8"                : "#1a5276";

    /* ── Chapter lookup ────────────────────────────────────── */
    const chapterMap = useMemo(() => {
      const m = new Map<number, Chapter>();
      chapters.forEach(c => m.set(c.id, c));
      return m;
    }, [chapters]);

    /* ── Group verses by chapter segments ──────────────────── */
    type Segment = { chapter: Chapter | null; verses: Verse[] };
    const segments = useMemo<Segment[]>(() => {
      const segs: Segment[] = [];
      for (const v of verses) {
        const last = segs[segs.length - 1];
        if (!last || last.chapter?.id !== v.chapter_id) {
          segs.push({ chapter: chapterMap.get(v.chapter_id) ?? null, verses: [v] });
        } else {
          last.verses.push(v);
        }
      }
      return segs;
    }, [verses, chapterMap]);

    return (
      <div className="relative w-full h-full" style={{ touchAction: "none" }}>
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ touchAction: showText ? "pan-y" : "none" }}
        >
          <div
            ref={textLayerRef}
            className="relative w-full"
            style={{ minHeight: "100%", pointerEvents: "none", userSelect: "none" }}
          >
            <div
              style={{
                maxWidth: 860, margin: "0 auto",
                paddingTop: 52, paddingBottom: 64,
                paddingLeft: 52, paddingRight: 52,
                opacity:    showText ? 1 : 0,
                transition: "opacity 0.25s ease",
              }}
            >
              {segments.map((seg, si) => {
                const ch          = seg.chapter;
                const isFirstSeg  = si === 0;
                const firstVerse  = seg.verses[0];

                // Show chapter header if this segment starts with verse 1
                const showHeader = firstVerse?.verse_number === 1;

                // Show bismillah: verse 1 of chapters that have bismillah_pre
                // (not ch 1 Al-Fatihah and not ch 9 At-Tawbah)
                const showBismillah = showHeader && ch?.bismillah_pre;

                return (
                  <div key={`${ch?.id ?? si}-${si}`}>
                    {/* Chapter header — shown when surah starts on this page */}
                    {showHeader && ch && (
                      <div className="text-center" style={{ marginBottom: isFirstSeg ? 28 : 0, marginTop: isFirstSeg ? 0 : 40 }}>
                        <div
                          className="inline-block px-8 py-3 rounded-2xl"
                          style={{ background: headerBg, border: `1px solid ${headerBorder}` }}
                        >
                          <p dir="rtl" style={{ fontFamily: ARABIC_FONT, fontSize: "clamp(26px, 3.5vw, 44px)", color: accentColor, lineHeight: 1.4, margin: 0 }}>
                            {ch.name_arabic}
                          </p>
                          <p style={{ fontSize: "clamp(10px, 1.2vw, 12px)", color: isDark ? "#8888aa" : "#7f8c8d", marginTop: 4, letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase" }}>
                            {ch.name_simple} · {ch.translated_name.name} · {ch.verses_count} ayahs
                          </p>
                        </div>

                        {showBismillah && (
                          <p dir="rtl" style={{ fontFamily: ARABIC_FONT, fontSize: "clamp(22px, 2.8vw, 38px)", color: accentColor, lineHeight: 2, textAlign: "center", marginTop: 16, marginBottom: 0, opacity: 0.85 }}>
                            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                          </p>
                        )}

                        {/* Divider */}
                        <div style={{ height: 1, background: divColor, margin: "20px 8% 28px" }} />
                      </div>
                    )}

                    {/* Chapter divider mid-page (when surah continues from previous page, no header) */}
                    {!showHeader && !isFirstSeg && (
                      <div style={{ height: 1, background: divColor, margin: "32px 8% 28px" }} />
                    )}

                    {/* ── Flowing verse text ── */}
                    <p
                      dir="rtl"
                      style={{
                        fontFamily:    ARABIC_FONT,
                        fontSize:      "clamp(26px, 2.8vw, 40px)",
                        lineHeight:    2.2,
                        color:         textColor,
                        textAlign:     "justify",
                        textAlignLast: "right",
                        wordSpacing:   "0.06em",
                        margin:        0,
                        marginBottom:  si < segments.length - 1 ? 0 : 0,
                      }}
                    >
                      {seg.verses.map((v) => (
                        <span key={v.id}>
                          {v.text_uthmani}
                          <AyahMarker n={v.verse_number} ring={markerRing} fill={markerFill} num={markerNum} />
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })}

              {/* Page number */}
              <div style={{ marginTop: 40, textAlign: "center", color: isDark ? "#5a5a8a" : "#b0aaa0", fontSize: "clamp(11px, 1.1vw, 13px)", fontWeight: 500, letterSpacing: "0.06em" }}>
                — {currentPage} —
              </div>
            </div>
          </div>

          {/* Drawing canvas */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{ touchAction: "none", zIndex: 10 }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            onPointerCancel={onUp}
          />
        </div>
      </div>
    );
  }
);

/* ── Inline ayah end-marker ─────────────────────────────────── */
function AyahMarker({ n, ring, fill, num }: { n: number; ring: string; fill: string; num: string }) {
  return (
    <span
      aria-label={`Ayah ${n}`}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", width: "1.4em", height: "1.4em", verticalAlign: "middle", margin: "0 0.25em", flexShrink: 0 }}
    >
      <svg viewBox="0 0 38 38" width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <circle cx="19" cy="19" r="17.5" fill="none" stroke={ring} strokeWidth="0.9" strokeDasharray="2.3 2" opacity="0.55" />
        <circle cx="19" cy="19" r="14"   fill="none" stroke={ring} strokeWidth="1.4" opacity="0.80" />
        <circle cx="19" cy="19" r="10.5" fill={fill} />
      </svg>
      <span style={{ position: "relative", zIndex: 1, fontSize: "0.36em", fontFamily: ARABIC_FONT, fontWeight: 700, color: num, lineHeight: 1 }}>
        {toArabicNumerals(n)}
      </span>
    </span>
  );
}

function toArabicNumerals(n: number): string {
  const d = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  return String(n).split("").map(c => d[+c] ?? c).join("");
}
