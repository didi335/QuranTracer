import {
  useEffect, useRef, useCallback, forwardRef,
  useImperativeHandle, useMemo, useState,
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
  onNextPage:  () => void;
  onPrevPage:  () => void;
}

export interface SurahDisplayHandle {
  undo:     () => void;
  clear:    () => void;
  download: () => void;
}

/* ── QPC font CDN ─────────────────────────────────────────── */
const QPC_CDN = "https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v2/woff2";

function injectPageFont(page: number) {
  const id = `qpc-font-p${page}`;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `@font-face{font-family:"QPC_P${page}";src:url("${QPC_CDN}/p${page}.woff2?v=3.1") format("woff2");font-display:swap;}`;
  document.head.appendChild(style);
}

/* ── Swipe thresholds ────────────────────────────────────── */
const SWIPE_Y_MIN = 55;   // min vertical px to count as swipe
const SWIPE_X_MAX = 70;   // max horizontal px allowed

export const SurahDisplay = forwardRef<SurahDisplayHandle, SurahDisplayProps>(
  function SurahDisplay(
    { chapters, verses, currentPage, showText, penSettings, isDark, onNextPage, onPrevPage },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const noScrollRef  = useRef<HTMLDivElement>(null); // canvas coordinate base

    const {
      canvasRef, startDrawing, draw, stopDrawing,
      undo, clear, clearHistory, downloadAsImage, getCanvasPoint, isDrawing,
    } = useCanvas(penSettings, noScrollRef);

    /* ── Inject QPC font (+ preload neighbours) ─────────────── */
    useEffect(() => {
      injectPageFont(currentPage);
      if (currentPage > 1)   injectPageFont(currentPage - 1);
      if (currentPage < 604) injectPageFont(currentPage + 1);
    }, [currentPage]);

    /* ── Chapter lookup ──────────────────────────────────────── */
    const chapterMap = useMemo(() => {
      const m = new Map<number, Chapter>();
      chapters.forEach(c => m.set(c.id, c));
      return m;
    }, [chapters]);

    /* ── Ordered lines ───────────────────────────────────────── */
    type PageLine = { lineNumber: number; words: Word[]; newChapter?: Chapter };

    const pageLines = useMemo<PageLine[]>(() => {
      const allWords: (Word & { verse_number: number; chapter_id: number })[] = [];
      for (const v of verses)
        for (const w of v.words)
          allWords.push({ ...w, verse_number: v.verse_number, chapter_id: v.chapter_id });

      const lineMap = new Map<number, typeof allWords>();
      for (const w of allWords) {
        if (!lineMap.has(w.line_number)) lineMap.set(w.line_number, []);
        lineMap.get(w.line_number)!.push(w);
      }

      const result: PageLine[] = [];
      let prevChId: number | null = null;
      for (const [lineNumber, words] of lineMap) {
        const chapterId  = words[0].chapter_id;
        let   newChapter: Chapter | undefined;
        if (chapterId !== prevChId && words.some(w => w.verse_number === 1))
          newChapter = chapterMap.get(chapterId);
        result.push({ lineNumber, words, newChapter });
        prevChId = chapterId;
      }
      return result;
    }, [verses, chapterMap]);

    /* ── Dynamic font size to fill viewport ──────────────────── */
    const [fontSize, setFontSize] = useState(36);

    const computeFontSize = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      const h = el.clientHeight;
      const w = el.clientWidth;

      // Count "effective rows": each text line + banner overhead
      const banners     = pageLines.filter(pl => pl.newChapter);
      const hasBismillah = banners.some(pl => pl.newChapter!.bismillah_pre && pl.newChapter!.id !== 9);
      // banner ≈ 3.8 line-slots, bismillah ≈ 1.4 extra
      const bannerRows  = banners.length * 3.8 + (hasBismillah ? 1.4 : 0);
      const textRows    = pageLines.length;
      // footer row (page number)
      const totalRows   = textRows + bannerRows + 1;

      // vertical padding uses 6% top + bottom
      const padV = h * 0.06;
      const avail = h - padV * 2;

      // Each row = fontSize × lineHeightFactor
      // lineHeightFactor from paddingTop(0.55em) + paddingBottom(0.35em) + text(1em) = 1.9
      const lineHF = 1.9;
      let fs = avail / (totalRows * lineHF);

      // Also constrain by width (line shouldn't exceed container)
      const maxByWidth = (w * 0.88) / 18; // rough estimate: ~18 "chars" per line
      fs = Math.min(fs, maxByWidth, 56);
      fs = Math.max(fs, 18);

      setFontSize(Math.round(fs));
    }, [pageLines]);

    useEffect(() => {
      computeFontSize();
    }, [computeFontSize, currentPage]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => computeFontSize());
      ro.observe(el);
      return () => ro.disconnect();
    }, [computeFontSize]);

    /* ── Canvas sizing ───────────────────────────────────────── */
    const syncCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const cont   = containerRef.current;
      if (!canvas || !cont) return;
      const dpr = window.devicePixelRatio || 1;
      const w   = cont.clientWidth;
      const h   = cont.clientHeight;
      if (!w || !h) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let saved: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0)
        try { saved = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { saved = null; }
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      if (saved && ctx) try { ctx.putImageData(saved, 0, 0); } catch { /**/ }
    }, [canvasRef]);

    useEffect(() => {
      clearHistory();
      const t = setTimeout(syncCanvas, 80);
      return () => clearTimeout(t);
    }, [currentPage, clearHistory, syncCanvas]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => syncCanvas());
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncCanvas]);

    useImperativeHandle(ref, () => ({
      undo,
      clear,
      download: () => downloadAsImage(textLayerRef, showText, `quran-page-${currentPage}`),
    }));

    /* ── Wheel / trackpad scroll → page navigation ──────────── */
    const wheelAccum   = useRef(0);
    const wheelTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onNextRef    = useRef(onNextPage);
    const onPrevRef    = useRef(onPrevPage);
    useEffect(() => { onNextRef.current = onNextPage; onPrevRef.current = onPrevPage; });

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const handler = (e: WheelEvent) => {
        e.preventDefault();
        wheelAccum.current += e.deltaY;
        if (wheelTimer.current) clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          if (wheelAccum.current > 40)       onNextRef.current();
          else if (wheelAccum.current < -40) onPrevRef.current();
          wheelAccum.current = 0;
        }, 80);
      };
      el.addEventListener("wheel", handler, { passive: false });
      return () => el.removeEventListener("wheel", handler);
    }, []); // runs once; always calls latest callbacks via refs

    /* ── Swipe / drag gesture detection ─────────────────────── */
    const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const isStylus = e.pointerType === "pen" || e.pointerType === "stylus";
      swipeStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };

      // Stylus always draws; touch/mouse draws only when text hidden
      if (isStylus || !showText) {
        if (e.pointerType === "touch" && !e.isPrimary) return;
        e.preventDefault();
        startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      } else {
        // In text-visible mode, capture pointer so we can detect swipe on up
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      }
    }, [startDrawing, getCanvasPoint, showText]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const isStylus = e.pointerType === "pen" || e.pointerType === "stylus";
      if (isStylus || !showText) {
        if (e.pointerType === "touch" && !e.isPrimary) return;
        e.preventDefault();
        draw(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
      }
    }, [draw, getCanvasPoint, showText]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const start = swipeStart.current;
      swipeStart.current = null;

      const isStylus = e.pointerType === "pen" || e.pointerType === "stylus";

      if (isStylus || !showText) {
        stopDrawing();
        return;
      }

      // Text-visible mode: detect swipe/drag for page navigation
      if (!start) return;
      const dy  = e.clientY - start.y;
      const dx  = e.clientX - start.x;
      const dt  = Date.now() - start.t;

      if (dy < -SWIPE_Y_MIN && Math.abs(dx) < SWIPE_X_MAX && dt < 700) {
        onNextPage(); // swipe / drag up → next page
      } else if (dy > SWIPE_Y_MIN && Math.abs(dx) < SWIPE_X_MAX && dt < 700) {
        onPrevPage(); // swipe / drag down → prev page
      }
      stopDrawing();
    }, [stopDrawing, showText, onNextPage, onPrevPage]);

    /* ── Theme ───────────────────────────────────────────────── */
    const bg          = isDark ? "#12122a"                 : "#fefdf8";
    const textColor   = isDark ? "rgba(220,210,185,0.95)"  : "#111827";
    const accentColor = isDark ? "#d4af37"                 : "#1a3a6e";
    const bannerBg    = isDark ? "rgba(212,175,55,0.06)"   : "rgba(255,255,255,0.95)";
    const bannerBorder= isDark ? "#4a3a10"                 : "#1a3a6e";
    const pageNumColor= isDark ? "#4a4a6a"                 : "#b0a898";
    const fontFamily  = `"QPC_P${currentPage}", "Amiri Quran", serif`;

    const padV = "5%";

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        style={{ background: bg }}
      >
        {/* Fixed non-scrolling reference for canvas coords */}
        <div ref={noScrollRef} className="absolute inset-0 pointer-events-none" />

        {/* Text layer — fills container, no scroll */}
        <div
          ref={textLayerRef}
          className="absolute inset-0 flex flex-col"
          style={{
            pointerEvents: "none",
            userSelect: "none",
            paddingTop:    padV,
            paddingBottom: padV,
            paddingLeft:  "4%",
            paddingRight: "4%",
            opacity:    showText ? 1 : 0,
            transition: "opacity 0.25s ease",
          }}
        >
          <div className="flex-1 flex flex-col justify-center gap-0">
            {pageLines.map((pl, i) => (
              <div key={pl.lineNumber}>
                {pl.newChapter && (
                  <SurahBanner
                    chapter={pl.newChapter}
                    isDark={isDark}
                    bannerBg={bannerBg}
                    bannerBorder={bannerBorder}
                    accentColor={accentColor}
                    isFirst={i === 0}
                    fontSize={fontSize}
                  />
                )}
                <div
                  dir="rtl"
                  style={{
                    fontFamily,
                    fontSize,
                    lineHeight: 1,
                    color: textColor,
                    textAlign: "center",
                    paddingTop:    "0.55em",
                    paddingBottom: "0.35em",
                    direction: "rtl",
                    unicodeBidi: "bidi-override",
                  }}
                >
                  {pl.words.map((w, wi) => (
                    <span
                      key={w.id}
                      style={{
                        color: w.char_type_name === "end" ? accentColor : textColor,
                        marginInlineStart: wi > 0 ? "0.04em" : 0,
                      }}
                    >
                      {w.code_v2}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Page number footer */}
          <div
            style={{
              textAlign: "center",
              fontFamily: "'Amiri', serif",
              fontSize: Math.max(11, fontSize * 0.32),
              color: pageNumColor,
              letterSpacing: "0.05em",
              paddingTop: "0.5em",
              flexShrink: 0,
            }}
          >
            ━ {currentPage} ━
          </div>
        </div>

        {/* Drawing canvas — covers full container */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          style={{
            touchAction: "none",
            zIndex: 10,
            cursor: showText ? "default" : "crosshair",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* Swipe hint (fades after load) */}
        {showText && verses.length > 0 && (
          <SwipeHint isDark={isDark} />
        )}
      </div>
    );
  }
);

/* ── Swipe hint overlay ──────────────────────────────────────── */
function SwipeHint({ isDark }: { isDark: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none"
      style={{
        opacity: visible ? 0.55 : 0,
        transition: "opacity 0.6s ease",
        zIndex: 5,
      }}
    >
      <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke={isDark ? "#d4af37" : "#1a3a6e"} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: isDark ? "#d4af37" : "#1a3a6e" }}>
        SWIPE TO TURN PAGE
      </span>
    </div>
  );
}

/* ── Surah banner ────────────────────────────────────────────── */
function SurahBanner({
  chapter, isDark, bannerBg, bannerBorder, accentColor, isFirst, fontSize,
}: {
  chapter: Chapter; isDark: boolean; bannerBg: string;
  bannerBorder: string; accentColor: string; isFirst: boolean; fontSize: number;
}) {
  const subtitleColor = isDark ? "#8888aa" : "#6b7280";
  const shadowColor   = isDark ? "rgba(0,0,0,0.5)" : "rgba(26,58,110,0.10)";

  return (
    <div style={{ marginBottom: fontSize * 0.3, marginTop: isFirst ? 0 : fontSize * 0.8 }}>
      <div
        style={{
          position: "relative",
          background: bannerBg,
          border: `2px solid ${bannerBorder}`,
          borderRadius: 6,
          padding: `${fontSize * 0.18}px ${fontSize * 1.4}px`,
          textAlign: "center",
          boxShadow: `0 2px 12px ${shadowColor}`,
          overflow: "hidden",
        }}
      >
        <span style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)" }}>
          <OrnamentLeft color={bannerBorder} size={fontSize * 1.1} />
        </span>
        <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%) scaleX(-1)" }}>
          <OrnamentLeft color={bannerBorder} size={fontSize * 1.1} />
        </span>
        <div style={{ position: "absolute", top: 5, left: "18%", right: "18%", height: 1, background: bannerBorder, opacity: 0.3 }} />
        <div style={{ position: "absolute", bottom: 5, left: "18%", right: "18%", height: 1, background: bannerBorder, opacity: 0.3 }} />

        <div dir="rtl" style={{
          fontFamily: '"Amiri Quran", "Amiri", serif',
          fontSize: fontSize * 0.78,
          color: accentColor, lineHeight: 1.7, fontWeight: "bold",
        }}>
          سُورَةُ {chapter.name_arabic}
        </div>
        <div style={{ fontSize: fontSize * 0.27, color: subtitleColor, marginTop: 2, letterSpacing: "0.07em", fontWeight: 500 }}>
          {chapter.name_simple.toUpperCase()} · {chapter.revelation_place === "makkah" ? "MAKKI" : "MADANI"} · {chapter.verses_count} AYAHS
        </div>
      </div>

      {chapter.bismillah_pre && chapter.id !== 9 && (
        <div dir="rtl" style={{
          fontFamily: '"Amiri Quran", "Amiri", serif',
          fontSize: fontSize * 0.72,
          color: accentColor, textAlign: "center",
          lineHeight: 1.9, marginTop: fontSize * 0.3, marginBottom: 0, opacity: 0.92,
        }}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>
      )}
    </div>
  );
}

function OrnamentLeft({ color, size = 44 }: { color: string; size?: number }) {
  const s = size;
  return (
    <svg width={s} height={s * 0.82} viewBox="0 0 44 36" fill="none">
      <circle cx="18" cy="18" r="15" stroke={color} strokeWidth="1.5" fill="none" opacity="0.7" />
      <circle cx="18" cy="18" r="9"  stroke={color} strokeWidth="1"   fill="none" opacity="0.6" />
      <circle cx="18" cy="18" r="2.5" fill={color} opacity="0.8" />
      <path d="M18 3 Q21 10 18 12 Q15 10 18 3Z"   fill={color} opacity="0.5" />
      <path d="M18 33 Q21 26 18 24 Q15 26 18 33Z" fill={color} opacity="0.5" />
      <path d="M36 18 Q31 14 28 18 Q31 22 36 18Z" fill={color} opacity="0.5" />
      <path d="M38 6 Q36 12 34 14"  stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M38 30 Q36 24 34 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <circle cx="40" cy="5"  r="2" fill={color} opacity="0.6" />
      <circle cx="40" cy="31" r="2" fill={color} opacity="0.6" />
    </svg>
  );
}
