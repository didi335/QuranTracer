import {
  useEffect, useRef, useCallback, forwardRef,
  useImperativeHandle, useMemo, useState,
} from "react";
import { Verse, Chapter, Word, TOTAL_PAGES } from "@/services/quranApi";
import { useCanvas, PenSettings } from "@/hooks/useCanvas";

interface SurahDisplayProps {
  chapters:     Chapter[];
  getVerses:    (page: number) => Verse[];
  currentPage:  number;
  showText:     boolean;
  penSettings:  PenSettings;
  isDark:       boolean;
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
    const dummyRef  = useRef<HTMLDivElement>(null); // for useCanvas compat

    const {
      canvasRef, startDrawing, draw, stopDrawing,
      undo, clear, clearHistory, downloadAsImage, getCanvasPoint,
    } = useCanvas(penSettings, dummyRef);

    /* ── Slot height in px (ensures pixel-perfect page separation) ── */
    const [slotH, setSlotH] = useState(0);
    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;
      const update = () => setSlotH(el.clientHeight);
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    /* ── Font injection ──────────────────────────────────────── */
    useEffect(() => {
      for (let d = -2; d <= 2; d++) {
        const p = currentPage + d;
        if (p >= 1 && p <= TOTAL_PAGES) injectPageFont(p);
      }
    }, [currentPage]);

    /* ── Chapter map ─────────────────────────────────────────── */
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
      download: () => downloadAsImage(
        { current: outerRef.current } as React.RefObject<HTMLElement>,
        showText,
        `quran-page-${currentPage}`,
      ),
    }));

    /* ── Scroll management ───────────────────────────────────── */
    const ignoreNext = useRef(false);
    const snapTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** Jump scroll to the center slot without triggering page-change logic */
    const snapToCenter = useCallback(() => {
      const el = scrollRef.current;
      if (!el || !slotH) return;
      ignoreNext.current = true;
      el.scrollTop = slotH;
      requestAnimationFrame(() => { ignoreNext.current = false; });
    }, [slotH]);

    // On mount or external page change: reset to center slot
    const didMount = useRef(false);
    useEffect(() => {
      if (!slotH) return;
      snapToCenter();
      if (!didMount.current) didMount.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, slotH]);

    /* ── Canvas visibility ───────────────────────────────────── */
    const hideCanvas = () => { if (canvasRef.current) canvasRef.current.style.opacity = "0"; };
    const showCanvas = () => { if (canvasRef.current) canvasRef.current.style.opacity = "1"; };

    /* ── Scroll event → page change ──────────────────────────── */
    const onScroll = useCallback(() => {
      if (ignoreNext.current) return;
      hideCanvas();
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        const el = scrollRef.current;
        if (!el || !slotH) return;
        const slot = Math.round(el.scrollTop / slotH); // 0 | 1 | 2
        if (slot === 0 || slot === 2) {
          const delta = slot === 0 ? -1 : 1;
          const next  = Math.max(1, Math.min(TOTAL_PAGES, currentPage + delta));
          // reset scroll first so snap doesn't fight us
          ignoreNext.current = true;
          el.scrollTop = slotH;
          requestAnimationFrame(() => { ignoreNext.current = false; });
          if (next !== currentPage) onPageChange(next);
          else showCanvas();
        } else {
          showCanvas();
        }
      }, 100);
    }, [currentPage, onPageChange, slotH]);

    /* ── Keyboard navigation ─────────────────────────────────── */
    const onPageChangeRef = useRef(onPageChange);
    const currentPageRef  = useRef(currentPage);
    useEffect(() => { onPageChangeRef.current = onPageChange; currentPageRef.current = currentPage; });

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        // Don't fire if typing in an input
        if ((e.target as HTMLElement).tagName === "INPUT" ||
            (e.target as HTMLElement).tagName === "TEXTAREA") return;
        if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          onPageChangeRef.current(Math.min(TOTAL_PAGES, currentPageRef.current + 1));
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          onPageChangeRef.current(Math.max(1, currentPageRef.current - 1));
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, []);

    /* ── Drawing via the SCROLL CONTAINER ────────────────────── */
    // Canvas is pointer-events:none (purely visual).
    // We listen on the scroll container so wheel/touch scroll still works natively.

    const onPtrDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const isPen   = e.pointerType === "pen";
      const isTouch = e.pointerType === "touch";
      if (isPen || (isTouch && !showText)) {
        if (isTouch && !e.isPrimary) return;
        e.preventDefault();
        startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }, [startDrawing, getCanvasPoint, showText]);

    const onPtrMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const isPen   = e.pointerType === "pen";
      const isTouch = e.pointerType === "touch";
      if (isPen || (isTouch && !showText)) {
        if (isTouch && !e.isPrimary) return;
        e.preventDefault();
        draw(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
      }
    }, [draw, getCanvasPoint, showText]);

    const onPtrUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const isPen   = e.pointerType === "pen";
      const isTouch = e.pointerType === "touch";
      if (isPen || (isTouch && !showText)) stopDrawing();
    }, [stopDrawing, showText]);

    /* ── Theme ───────────────────────────────────────────────── */
    const bg      = isDark ? "#12122a" : "#fefdf8";
    const divider = isDark ? "#1e1e38" : "#e8e3d5";

    return (
      <div
        ref={outerRef}
        style={{ position: "relative", width: "100%", height: "100%", background: bg, overflow: "hidden" }}
      >
        {/* ── 3-slot native-scroll container ───────────────── */}
        <div
          ref={scrollRef}
          style={{
            position: "absolute", inset: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            // Receives ALL pointer events (canvas is pointer-events:none above)
            touchAction: showText ? "pan-y" : "none",
          } as React.CSSProperties}
          onScroll={onScroll}
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrUp}
          onPointerLeave={onPtrUp}
          onPointerCancel={onPtrUp}
        >
          {slotH > 0 && [-1, 0, 1].map((offset) => {
            const page = currentPage + offset;
            return (
              <div
                key={offset}
                style={{
                  height:          slotH,
                  flexShrink:      0,
                  scrollSnapAlign: "start",
                  overflow:        "hidden",
                  // Subtle divider between pages
                  borderBottom: offset < 1 ? `3px solid ${divider}` : undefined,
                }}
              >
                {page >= 1 && page <= TOTAL_PAGES ? (
                  <PageContent
                    page={page}
                    verses={getVerses(page)}
                    chapterMap={chapterMap}
                    isDark={isDark}
                    showText={showText}
                    containerH={slotH}
                  />
                ) : (
                  /* Out-of-bounds page (before 1 or after 604) */
                  <div style={{ height: "100%", background: bg }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Canvas — pointer-events:none so scroll passes through ─ */}
        <canvas
          ref={canvasRef}
          style={{
            position:      "absolute",
            top:           0,
            left:          0,
            zIndex:        10,
            pointerEvents: "none",
            willChange:    "opacity",
            transition:    "opacity 0.12s ease",
          }}
        />

        {/* Hidden ref for useCanvas compat */}
        <div ref={dummyRef} style={{ display: "none" }} />
      </div>
    );
  }
);

/* ════════════════════════════════════════════════════════════
   Page content (one Mushaf page, dynamically sized to fit)
   ════════════════════════════════════════════════════════════ */
interface PageContentProps {
  page:       number;
  verses:     Verse[];
  chapterMap: Map<number, Chapter>;
  isDark:     boolean;
  showText:   boolean;
  containerH: number;
}

function PageContent({ page, verses, chapterMap, isDark, showText, containerH }: PageContentProps) {
  const pageRef  = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(34);

  const textColor    = isDark ? "rgba(220,210,185,0.95)" : "#111827";
  const accentColor  = isDark ? "#d4af37"                : "#1a3a6e";
  const bannerBg     = isDark ? "rgba(212,175,55,0.05)"  : "rgba(255,255,255,0.97)";
  const bannerBorder = isDark ? "#4a3a10"                : "#1a3a6e";
  const pageNumColor = isDark ? "#4a4a6a"                : "#c0b8a8";
  const fontFamily   = `"QPC_P${page}", "Amiri Quran", serif`;

  /* ── Lines with surah-break markers ───────────────────── */
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

  /* ── Font size: fit all lines into available height ───── */
  const computeFontSize = useCallback(() => {
    const el = pageRef.current;
    if (!el || !pageLines.length) return;
    const h = containerH; // use the exact pixel height
    const w = el.clientWidth;

    const banners      = pageLines.filter(pl => pl.newChapter);
    const hasBismillah = banners.some(pl => pl.newChapter!.bismillah_pre && pl.newChapter!.id !== 9);
    // Compact banner ≈ 2.4 line-slots; bismillah ≈ 1.3 extra
    const bannerRows   = banners.length * 2.4 + (hasBismillah ? 1.3 : 0);
    const totalRows    = pageLines.length + bannerRows + 1.2;

    const padV  = h * 0.045;
    const avail = h - padV * 2;
    let   fs    = avail / (totalRows * 1.70);

    const maxByWidth = (w * 0.94) / 15;
    fs = Math.min(fs, maxByWidth, 64);
    fs = Math.max(fs, 14);
    setFontSize(Math.round(fs) + 3);
  }, [pageLines, containerH]);

  useEffect(() => { computeFontSize(); }, [computeFontSize]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeFontSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeFontSize]);

  return (
    <div
      ref={pageRef}
      style={{
        width:         "100%",
        height:        "100%",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        paddingTop:    "3.5%",
        paddingBottom: "3%",
        paddingLeft:   "3%",
        paddingRight:  "3%",
        opacity:       showText ? 1 : 0,
        transition:    "opacity 0.2s ease",
        userSelect:    "none",
        pointerEvents: "none",
        boxSizing:     "border-box",
        overflow:      "hidden",
      }}
    >
      {!verses.length ? (
        /* Loading state */
        <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: `2px solid ${accentColor}`,
            borderTopColor: "transparent",
            animation: "spin 0.9s linear infinite",
            opacity: 0.35,
          }} />
        </div>
      ) : (
        /* Lines */
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          width: "100%", maxWidth: 960, margin: "0 auto",
          justifyContent: "center",
        }}>
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
                style={{
                  fontFamily,
                  fontSize,
                  lineHeight:   1.70,
                  color:        textColor,
                  textAlign:    "center",
                  direction:    "rtl",
                  unicodeBidi:  "bidi-override",
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
        flexShrink:  0,
        textAlign:   "center",
        fontFamily:  "'Amiri', serif",
        fontSize:    Math.max(10, fontSize * 0.29),
        color:       pageNumColor,
        letterSpacing: "0.05em",
        paddingTop:  "0.8em",
        opacity:     showText ? 1 : 0,
      }}>
        ━ {page} ━
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Surah banner — compact, no ornaments, max-width centered
   ════════════════════════════════════════════════════════════ */
function SurahBanner({
  chapter, isDark, bannerBg, bannerBorder, accentColor, isFirst, fontSize,
}: {
  chapter: Chapter; isDark: boolean; bannerBg: string;
  bannerBorder: string; accentColor: string; isFirst: boolean; fontSize: number;
}) {
  const subtitleColor = isDark ? "#9090b0" : "#6b7280";
  const shadowColor   = isDark ? "rgba(0,0,0,0.35)" : "rgba(26,58,110,0.07)";

  return (
    <div style={{
      width:   "100%",
      maxWidth: 800,
      margin:  `${isFirst ? 0 : fontSize * 0.50}px auto ${fontSize * 0.28}px`,
    }}>
      {/* ── Top rule ─── */}
      <div style={{
        height:       1,
        background:   `linear-gradient(to right, transparent, ${bannerBorder}70, transparent)`,
        marginBottom: fontSize * 0.13,
      }} />

      {/* ── Banner box ── */}
      <div style={{
        background:    bannerBg,
        border:        `1px solid ${bannerBorder}40`,
        borderRadius:  6,
        paddingTop:    fontSize * 0.16,
        paddingBottom: fontSize * 0.12,
        paddingLeft:   fontSize * 0.5,
        paddingRight:  fontSize * 0.5,
        boxShadow:     `0 1px 6px ${shadowColor}`,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        textAlign:      "center",
      }}>
        {/* Arabic surah name — lineHeight 2.2 puts ample half-leading above harakat */}
        <div style={{
          fontFamily:    '"Amiri Quran", "Amiri", serif',
          fontSize:      fontSize * 1.05,
          color:         accentColor,
          fontWeight:    "bold",
          lineHeight:    1.35,
          direction:     "rtl",
          textAlign:     "center",
        }}>
          سُورَةُ {chapter.name_arabic}
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize:      Math.max(10, fontSize * 0.22),
          color:         subtitleColor,
          marginTop:     fontSize * 0.05,
          letterSpacing: "0.07em",
          fontWeight:    600,
          textTransform: "uppercase",
        }}>
          {chapter.name_simple} · {chapter.revelation_place === "makkah" ? "Makki" : "Madani"} · {chapter.verses_count} Ayahs
        </div>
      </div>

      {/* ── Bottom rule ── */}
      <div style={{
        height:    1,
        background: `linear-gradient(to right, transparent, ${bannerBorder}70, transparent)`,
        marginTop: fontSize * 0.13,
      }} />

      {/* ── Bismillah ── */}
      {chapter.bismillah_pre && chapter.id !== 9 && (
        <div style={{
          fontFamily:   '"Amiri Quran", "Amiri", serif',
          fontSize:     fontSize * 0.88,
          color:        accentColor,
          textAlign:    "center",
          direction:    "rtl",
          lineHeight:   1.65,
          marginTop:    fontSize * 0.10,
          marginBottom: fontSize * 0.04,
          opacity:      0.88,
        }}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>
      )}
    </div>
  );
}
