import {
  useEffect, useRef, useCallback, forwardRef,
  useImperativeHandle, useMemo,
} from "react";
import { Verse, Chapter, Word } from "@/services/quranApi";
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

/* ── QPC font CDN ─────────────────────────────────────────── */
const QPC_CDN = "https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v2/woff2";

/** Inject @font-face for the page-specific QPC font, keyed by page. */
function injectPageFont(page: number) {
  const id = `qpc-font-p${page}`;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @font-face {
      font-family: "QPC_P${page}";
      src: url("${QPC_CDN}/p${page}.woff2?v=3.1") format("woff2");
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

export const SurahDisplay = forwardRef<SurahDisplayHandle, SurahDisplayProps>(
  function SurahDisplay({ chapters, verses, currentPage, showText, penSettings, isDark }, ref) {
    const textLayerRef = useRef<HTMLDivElement>(null);
    const scrollRef    = useRef<HTMLDivElement>(null);

    const {
      canvasRef, startDrawing, draw, stopDrawing,
      undo, clear, clearHistory, downloadAsImage, getCanvasPoint,
    } = useCanvas(penSettings, scrollRef);

    /* ── Inject QPC font for this page ─────────────────────── */
    useEffect(() => { injectPageFont(currentPage); }, [currentPage]);

    /* ── Canvas sync ────────────────────────────────────────── */
    const syncCanvasSize = useCallback(() => {
      const canvas    = canvasRef.current;
      const textLayer = textLayerRef.current;
      if (!canvas || !textLayer) return;
      const dpr = window.devicePixelRatio || 1;
      const w   = textLayer.offsetWidth;
      const h   = textLayer.offsetHeight;
      if (!w || !h) return;
      const ctx   = canvas.getContext("2d", { willReadFrequently: true });
      let saved: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        try { saved = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { saved = null; }
      }
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      if (saved && ctx) { try { ctx.putImageData(saved, 0, 0); } catch { /**/ } }
    }, [canvasRef]);

    useEffect(() => {
      clearHistory();
      const t = setTimeout(() => syncCanvasSize(), 120);
      return () => clearTimeout(t);
    }, [currentPage, clearHistory, syncCanvasSize]);

    useEffect(() => {
      const el = textLayerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => syncCanvasSize());
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncCanvasSize]);

    /* ── Pointer events ─────────────────────────────────────── */
    const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && !e.isPrimary) return;
      e.preventDefault();
      startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }, [startDrawing, getCanvasPoint]);

    const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch" && !e.isPrimary) return;
      e.preventDefault();
      draw(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
    }, [draw, getCanvasPoint]);

    const onUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault(); stopDrawing();
    }, [stopDrawing]);

    useImperativeHandle(ref, () => ({
      undo,
      clear,
      download: () => downloadAsImage(textLayerRef, showText, `quran-page-${currentPage}`),
    }));

    /* ── Chapter map ────────────────────────────────────────── */
    const chapterMap = useMemo(() => {
      const m = new Map<number, Chapter>();
      chapters.forEach(c => m.set(c.id, c));
      return m;
    }, [chapters]);

    /* ── Build ordered lines with surah-break markers ───────── */
    type PageLine = {
      lineNumber:  number;
      words:       Word[];
      /** If this line is preceded by a new surah starting, fill this */
      newChapter?: Chapter;
    };

    const pageLines = useMemo<PageLine[]>(() => {
      // Collect all words across verses, in order
      const allWords: (Word & { verse_number: number; chapter_id: number })[] = [];
      for (const v of verses) {
        for (const w of v.words) {
          allWords.push({ ...w, verse_number: v.verse_number, chapter_id: v.chapter_id });
        }
      }

      // Group by line number (maintaining insertion order)
      const lineMap = new Map<number, typeof allWords>();
      for (const w of allWords) {
        if (!lineMap.has(w.line_number)) lineMap.set(w.line_number, []);
        lineMap.get(w.line_number)!.push(w);
      }

      // Build PageLine array with chapter-start markers
      const result: PageLine[] = [];
      let prevChapterId: number | null = null;

      for (const [lineNumber, words] of lineMap) {
        const firstWord   = words[0];
        const chapterId   = firstWord.chapter_id;
        let   newChapter: Chapter | undefined;

        // Detect chapter boundary: first word of verse 1 of a new chapter
        if (chapterId !== prevChapterId) {
          // Check if verse 1 of this chapter starts on this line
          const hasVerse1 = words.some(w => (w as typeof firstWord).verse_number === 1);
          if (hasVerse1) {
            newChapter = chapterMap.get(chapterId);
          }
        }

        result.push({ lineNumber, words, newChapter });
        prevChapterId = chapterId;
      }

      return result;
    }, [verses, chapterMap]);

    /* ── Theme colours ──────────────────────────────────────── */
    const bg          = isDark ? "#12122a" : "#fefdf8";
    const textColor   = isDark ? "rgba(220,210,185,0.95)" : "#111827";
    const accentColor = isDark ? "#d4af37"                : "#1a3a6e";
    const bannerBg    = isDark ? "rgba(212,175,55,0.06)"  : "rgba(255,255,255,0.95)";
    const bannerBorder= isDark ? "#4a3a10"                : "#1a3a6e";

    const fontFamily  = `"QPC_P${currentPage}", "Amiri Quran", serif`;

    return (
      <div className="relative w-full h-full" style={{ background: bg, touchAction: "none" }}>
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
                maxWidth: 780, margin: "0 auto",
                paddingTop: 56, paddingBottom: 64,
                paddingLeft: 32, paddingRight: 32,
                opacity:    showText ? 1 : 0,
                transition: "opacity 0.25s ease",
              }}
            >
              {pageLines.map((pl, i) => (
                <div key={pl.lineNumber}>
                  {/* ── Surah header banner ─────────────────── */}
                  {pl.newChapter && (
                    <SurahBanner
                      chapter={pl.newChapter}
                      isDark={isDark}
                      bannerBg={bannerBg}
                      bannerBorder={bannerBorder}
                      accentColor={accentColor}
                      isFirst={i === 0}
                    />
                  )}

                  {/* ── Mushaf line ─────────────────────────── */}
                  <div
                    dir="rtl"
                    style={{
                      fontFamily,
                      fontSize:      "clamp(28px, 3.2vw, 46px)",
                      lineHeight:    1,
                      color:         textColor,
                      textAlign:     "center",
                      paddingTop:    "0.55em",
                      paddingBottom: "0.35em",
                      letterSpacing: 0,
                      direction:     "rtl",
                      unicodeBidi:   "bidi-override",
                    }}
                  >
                    {pl.words.map((w, wi) => (
                      <span
                        key={w.id}
                        style={{
                          color: w.char_type_name === "end" ? accentColor : textColor,
                          marginInlineStart: wi > 0 ? "0.05em" : 0,
                        }}
                      >
                        {w.code_v2}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Page number */}
              <div
                style={{
                  marginTop: 36, textAlign: "center",
                  fontFamily: "'Amiri', serif",
                  color:   isDark ? "#4a4a6a" : "#9a9080",
                  fontSize: 13, letterSpacing: "0.05em",
                }}
              >
                ━ {currentPage} ━
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

/* ── Surah banner component ────────────────────────────────── */
function SurahBanner({
  chapter, isDark, bannerBg, bannerBorder, accentColor, isFirst,
}: {
  chapter:      Chapter;
  isDark:       boolean;
  bannerBg:     string;
  bannerBorder: string;
  accentColor:  string;
  isFirst:      boolean;
}) {
  const textShadowColor = isDark ? "rgba(0,0,0,0.6)" : "rgba(26,58,110,0.12)";
  const subtitleColor   = isDark ? "#8888aa"          : "#6b7280";

  return (
    <div style={{ marginBottom: 20, marginTop: isFirst ? 0 : 40 }}>
      {/* Ornamental banner */}
      <div
        style={{
          position: "relative",
          background: bannerBg,
          border: `2px solid ${bannerBorder}`,
          borderRadius: 6,
          padding: "10px 64px",
          textAlign: "center",
          boxShadow: `0 2px 12px ${textShadowColor}`,
          overflow: "hidden",
        }}
      >
        {/* Left ornament */}
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
          <OrnamentLeft color={bannerBorder} />
        </span>
        {/* Right ornament */}
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%) scaleX(-1)" }}>
          <OrnamentLeft color={bannerBorder} />
        </span>

        {/* Top border line */}
        <div style={{ position: "absolute", top: 6, left: 40, right: 40, height: 1, background: bannerBorder, opacity: 0.35 }} />
        {/* Bottom border line */}
        <div style={{ position: "absolute", bottom: 6, left: 40, right: 40, height: 1, background: bannerBorder, opacity: 0.35 }} />

        {/* Surah name in Arabic */}
        <div
          dir="rtl"
          style={{
            fontFamily: '"Amiri Quran", "Amiri", serif',
            fontSize:   "clamp(22px, 2.6vw, 34px)",
            color:      accentColor,
            lineHeight: 1.6,
            fontWeight: "bold",
            letterSpacing: 0,
          }}
        >
          سُورَةُ {chapter.name_arabic}
        </div>

        {/* Sub-line: transliteration · revelation · verse count */}
        <div style={{ fontSize: 11, color: subtitleColor, marginTop: 2, letterSpacing: "0.07em", fontWeight: 500 }}>
          {chapter.name_simple.toUpperCase()} · {chapter.revelation_place === "makkah" ? "MAKKI" : "MADANI"} · {chapter.verses_count} AYAHS
        </div>
      </div>

      {/* Bismillah line — shown for all chapters except 1 (Al-Fatihah) and 9 (At-Tawbah) */}
      {chapter.bismillah_pre && chapter.id !== 9 && (
        <div
          dir="rtl"
          style={{
            fontFamily:  '"Amiri Quran", "Amiri", serif',
            fontSize:    "clamp(22px, 2.5vw, 34px)",
            color:       accentColor,
            textAlign:   "center",
            lineHeight:  1.8,
            marginTop:   14,
            marginBottom: 4,
            opacity: 0.92,
          }}
        >
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>
      )}
    </div>
  );
}

/* ── Ornament SVG (left side of banner) ────────────────────── */
function OrnamentLeft({ color }: { color: string }) {
  return (
    <svg width="44" height="36" viewBox="0 0 44 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer circle */}
      <circle cx="18" cy="18" r="15" stroke={color} strokeWidth="1.5" fill="none" opacity="0.7" />
      {/* Inner circle */}
      <circle cx="18" cy="18" r="9"  stroke={color} strokeWidth="1"   fill="none" opacity="0.6" />
      {/* Center dot */}
      <circle cx="18" cy="18" r="2.5" fill={color} opacity="0.8" />
      {/* Petal top */}
      <path d="M18 3 Q21 10 18 12 Q15 10 18 3Z" fill={color} opacity="0.5" />
      {/* Petal bottom */}
      <path d="M18 33 Q21 26 18 24 Q15 26 18 33Z" fill={color} opacity="0.5" />
      {/* Leaf right arm */}
      <path d="M36 18 Q31 14 28 18 Q31 22 36 18Z" fill={color} opacity="0.5" />
      {/* Diagonal decoration */}
      <path d="M38 6 Q36 12 34 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M38 30 Q36 24 34 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <circle cx="40" cy="5"  r="2" fill={color} opacity="0.6" />
      <circle cx="40" cy="31" r="2" fill={color} opacity="0.6" />
    </svg>
  );
}
