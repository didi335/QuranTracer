import {
  useEffect, useRef, useCallback, forwardRef,
  useImperativeHandle, useMemo, useState,
} from "react";
import { Verse, Chapter, Word, TOTAL_PAGES } from "@/services/quranApi";
import { useCanvas, PenSettings } from "@/hooks/useCanvas";

interface SurahDisplayProps {
  chapters:    Chapter[];
  /** Verse getter: returns cached verses for any page */
  getVerses:   (page: number) => Verse[];
  currentPage: number;
  showText:    boolean;
  penSettings: PenSettings;
  isDark:      boolean;
  onPageChange: (page: number) => void;
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

export const SurahDisplay = forwardRef<SurahDisplayHandle, SurahDisplayProps>(
  function SurahDisplay(
    { chapters, getVerses, currentPage, showText, penSettings, isDark, onPageChange },
    ref,
  ) {
    const outerRef  = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const canvasRef2 = useRef<HTMLDivElement>(null); // dummy for useCanvas compat

    const {
      canvasRef, startDrawing, draw, stopDrawing,
      undo, clear, clearHistory, downloadAsImage, getCanvasPoint,
    } = useCanvas(penSettings, canvasRef2);

    /* ── Font injection ──────────────────────────────────────── */
    useEffect(() => {
      for (let d = -2; d <= 2; d++) {
        const p = currentPage + d;
        if (p >= 1 && p <= TOTAL_PAGES) injectPageFont(p);
      }
    }, [currentPage]);

    /* ── Chapter lookup ──────────────────────────────────────── */
    const chapterMap = useMemo(() => {
      const m = new Map<number, Chapter>();
      chapters.forEach(c => m.set(c.id, c));
      return m;
    }, [chapters]);

    /* ── Canvas sizing ───────────────────────────────────────── */
    const syncCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const outer  = outerRef.current;
      if (!canvas || !outer) return;
      const dpr = window.devicePixelRatio || 1;
      const w   = outer.clientWidth;
      const h   = outer.clientHeight;
      if (!w || !h) return;
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
    }, [canvasRef]);

    useEffect(() => {
      clearHistory();
      const t = setTimeout(syncCanvas, 60);
      return () => clearTimeout(t);
    }, [currentPage, clearHistory, syncCanvas]);

    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncCanvas);
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncCanvas]);

    useImperativeHandle(ref, () => ({
      undo,
      clear,
      download: () => downloadAsImage({ current: outerRef.current }, showText, `quran-page-${currentPage}`),
    }));

    /* ── Scroll position init & after page-change reset ─────── */
    const ignoreScroll = useRef(false);

    const resetToCenter = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      ignoreScroll.current = true;
      el.scrollTop = el.clientHeight;
      // Re-enable scroll tracking after a frame
      requestAnimationFrame(() => {
        ignoreScroll.current = false;
      });
    }, []);

    // On mount: scroll to center slot (slot 1 = index 1 = currentPage)
    useEffect(() => {
      resetToCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount only

    // When currentPage changes (e.g. surah jump), reset to center
    useEffect(() => {
      resetToCenter();
    }, [currentPage, resetToCenter]);

    /* ── Canvas visibility control ───────────────────────────── */
    const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hideCanvas = useCallback(() => {
      const c = canvasRef.current;
      if (c) c.style.opacity = "0";
    }, [canvasRef]);

    const showCanvas = useCallback(() => {
      const c = canvasRef.current;
      if (c) c.style.opacity = "1";
    }, [canvasRef]);

    /* ── Scroll handler ──────────────────────────────────────── */
    const onScroll = useCallback(() => {
      if (ignoreScroll.current) return;
      hideCanvas();

      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = setTimeout(() => {
        const el = scrollRef.current;
        if (!el) return;

        const slotH = el.clientHeight;
        const slot  = Math.round(el.scrollTop / slotH); // 0, 1, or 2

        if (slot === 0) {
          // Scrolled to previous page
          const newPage = Math.max(1, currentPage - 1);
          el.scrollTop = slotH; // reset instantly
          ignoreScroll.current = true;
          requestAnimationFrame(() => { ignoreScroll.current = false; });
          if (newPage !== currentPage) onPageChange(newPage);
          else showCanvas();
        } else if (slot === 2) {
          // Scrolled to next page
          const newPage = Math.min(TOTAL_PAGES, currentPage + 1);
          el.scrollTop = slotH; // reset instantly
          ignoreScroll.current = true;
          requestAnimationFrame(() => { ignoreScroll.current = false; });
          if (newPage !== currentPage) onPageChange(newPage);
          else showCanvas();
        } else {
          // Stayed on current page
          showCanvas();
        }
      }, 120);
    }, [currentPage, onPageChange, hideCanvas, showCanvas]);

    /* ── Drawing pointer events ──────────────────────────────── */
    const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const isPen   = e.pointerType === "pen";
      const isTouch = e.pointerType === "touch";

      if (isPen || (!showText && isTouch)) {
        e.preventDefault();
        startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      }
    }, [startDrawing, getCanvasPoint, showText]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const isPen   = e.pointerType === "pen";
      const isTouch = e.pointerType === "touch";
      if (isPen || (!showText && isTouch)) {
        e.preventDefault();
        draw(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
      }
    }, [draw, getCanvasPoint, showText]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      stopDrawing();
    }, [stopDrawing]);

    /* ── Theme ───────────────────────────────────────────────── */
    const bg          = isDark ? "#12122a"                 : "#fefdf8";
    const borderColor = isDark ? "#2a2a4e"                 : "#d8d3c0";

    return (
      <div
        ref={outerRef}
        style={{ position: "relative", width: "100%", height: "100%", background: bg, overflow: "hidden" }}
      >
        {/* ── 3-slot scroll-snap container ─────────────────── */}
        <div
          ref={scrollRef}
          style={{
            position: "absolute", inset: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
            // Hide scrollbar
            scrollbarWidth: "none",
            msOverflowStyle: "none" as React.CSSProperties["msOverflowStyle"],
          } as React.CSSProperties}
          onScroll={onScroll}
        >
          {/* Slots: prev, current, next */}
          {[-1, 0, 1].map((offset) => {
            const page = currentPage + offset;
            const verses = (page >= 1 && page <= TOTAL_PAGES) ? getVerses(page) : [];
            return (
              <PageSlot
                key={offset}
                page={page}
                verses={verses}
                chapters={chapters}
                chapterMap={chapterMap}
                isDark={isDark}
                showText={showText}
                borderColor={borderColor}
              />
            );
          })}
        </div>

        {/* ── Drawing canvas — fixed to outer container ─────── */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0, left: 0,
            zIndex: 10,
            // Allow finger to scroll through canvas; pen always draws
            touchAction: "pan-y",
            cursor: showText ? "default" : "crosshair",
            willChange: "opacity",
            transition: "opacity 0.15s ease",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    );
  }
);

/* ── One page slot ───────────────────────────────────────────── */
interface SlotProps {
  page:       number;
  verses:     Verse[];
  chapters:   Chapter[];
  chapterMap: Map<number, Chapter>;
  isDark:     boolean;
  showText:   boolean;
  borderColor: string;
}

function PageSlot({ page, verses, chapterMap, isDark, showText }: SlotProps) {
  const [fontSize, setFontSize] = useState(36);
  const slotRef  = useRef<HTMLDivElement>(null);

  const textColor   = isDark ? "rgba(220,210,185,0.95)" : "#111827";
  const accentColor = isDark ? "#d4af37"                : "#1a3a6e";
  const bannerBg    = isDark ? "rgba(212,175,55,0.06)"  : "rgba(255,255,255,0.95)";
  const bannerBorder= isDark ? "#4a3a10"                : "#1a3a6e";
  const pageNumColor= isDark ? "#4a4a6a"                : "#b0a898";
  const fontFamily  = `"QPC_P${page}", "Amiri Quran", serif`;

  /* ── Build ordered lines ─────────────────────────────────── */
  type PageLine = { lineNumber: number; words: Word[]; newChapter?: Chapter };

  const pageLines = useMemo<PageLine[]>(() => {
    if (!verses.length) return [];
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

  /* ── Dynamic font size ───────────────────────────────────── */
  const computeFontSize = useCallback(() => {
    const el = slotRef.current;
    if (!el || !pageLines.length) return;
    const h = el.clientHeight;
    const w = el.clientWidth;
    const banners     = pageLines.filter(pl => pl.newChapter);
    const hasBismillah = banners.some(pl => pl.newChapter!.bismillah_pre && pl.newChapter!.id !== 9);
    const bannerRows  = banners.length * 3.8 + (hasBismillah ? 1.4 : 0);
    const totalRows   = pageLines.length + bannerRows + 1.5;
    const padV        = h * 0.07;
    const avail       = h - padV * 2;
    let fs = avail / (totalRows * 1.88);
    const maxByWidth  = (w * 0.88) / 18;
    fs = Math.min(fs, maxByWidth, 54);
    fs = Math.max(fs, 16);
    setFontSize(Math.round(fs));
  }, [pageLines]);

  useEffect(() => { computeFontSize(); }, [computeFontSize]);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeFontSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeFontSize]);

  return (
    <div
      ref={slotRef}
      style={{
        height: "100%",
        width: "100%",
        flexShrink: 0,
        scrollSnapAlign: "start",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingTop: "6%",
        paddingBottom: "6%",
        paddingLeft: "5%",
        paddingRight: "5%",
        opacity: showText ? 1 : 0,
        transition: "opacity 0.2s ease",
        userSelect: "none",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    >
      {!verses.length ? (
        /* Loading placeholder */
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <svg style={{ width: 28, height: 28, opacity: 0.3, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={accentColor} strokeWidth="4" strokeDasharray="30 70" />
          </svg>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1 }}>
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
                  paddingTop: "0.52em",
                  paddingBottom: "0.32em",
                  direction: "rtl",
                  unicodeBidi: "bidi-override",
                }}
              >
                {pl.words.map((w, wi) => (
                  <span
                    key={w.id}
                    style={{
                      color: w.char_type_name === "end" ? accentColor : textColor,
                      marginInlineStart: wi > 0 ? "0.03em" : 0,
                    }}
                  >
                    {w.code_v2}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Page number */}
      <div style={{
        textAlign: "center",
        fontFamily: "'Amiri', serif",
        fontSize: Math.max(10, fontSize * 0.30),
        color: pageNumColor,
        letterSpacing: "0.05em",
        marginTop: "0.6em",
        flexShrink: 0,
      }}>
        ━ {page} ━
      </div>
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
    <div style={{ marginBottom: fontSize * 0.28, marginTop: isFirst ? 0 : fontSize * 0.7 }}>
      <div style={{
        position: "relative",
        background: bannerBg,
        border: `2px solid ${bannerBorder}`,
        borderRadius: 6,
        padding: `${fontSize * 0.16}px ${fontSize * 1.3}px`,
        textAlign: "center",
        boxShadow: `0 2px 12px ${shadowColor}`,
        overflow: "hidden",
      }}>
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
          fontSize: fontSize * 0.76,
          color: accentColor, lineHeight: 1.7, fontWeight: "bold",
        }}>
          سُورَةُ {chapter.name_arabic}
        </div>
        <div style={{ fontSize: fontSize * 0.26, color: subtitleColor, marginTop: 2, letterSpacing: "0.07em", fontWeight: 500 }}>
          {chapter.name_simple.toUpperCase()} · {chapter.revelation_place === "makkah" ? "MAKKI" : "MADANI"} · {chapter.verses_count} AYAHS
        </div>
      </div>

      {chapter.bismillah_pre && chapter.id !== 9 && (
        <div dir="rtl" style={{
          fontFamily: '"Amiri Quran", "Amiri", serif',
          fontSize: fontSize * 0.70,
          color: accentColor, textAlign: "center",
          lineHeight: 1.9, marginTop: fontSize * 0.28, opacity: 0.92,
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
