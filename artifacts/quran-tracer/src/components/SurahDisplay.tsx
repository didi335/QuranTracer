import {
  useEffect, useRef, useCallback, forwardRef,
  useImperativeHandle, useMemo, useState,
} from "react";
import { Verse, Chapter, Word, TOTAL_PAGES } from "@/services/quranApi";
import { useCanvas, PenSettings } from "@/hooks/useCanvas";
import { SurahRange } from "@/hooks/useQuran";

interface SurahDisplayProps {
  chapters:          Chapter[];
  getVerses:         (page: number) => Verse[];
  currentPage:       number;
  showText:          boolean;
  penSettings:       PenSettings;
  isDark:            boolean;
  onPageChange:      (page: number) => void;
  onSelectSurah:     (chapter: Chapter) => void;
  surahRange:        SurahRange | null;
  selectedChapterId: number | null;
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
    { chapters, getVerses, currentPage, showText, penSettings, isDark, onPageChange, onSelectSurah, surahRange, selectedChapterId },
    ref,
  ) {
    const outerRef   = useRef<HTMLDivElement>(null);
    const scrollRef  = useRef<HTMLDivElement>(null);
    const dummyRef   = useRef<HTMLDivElement>(null);

    const {
      canvasRef, startDrawing, draw, stopDrawing,
      undo, clear, clearHistory, downloadAsImage, getCanvasPoint,
    } = useCanvas(penSettings, dummyRef);

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

    /* ── Reset scroll to top on page change ─────────────────── */
    useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [currentPage]);

    useImperativeHandle(ref, () => ({
      undo,
      clear,
      download: () => downloadAsImage(
        { current: outerRef.current } as React.RefObject<HTMLElement>,
        showText,
        `quran-page-${currentPage}`,
      ),
    }));

    /* ── Canvas visibility ───────────────────────────────────── */
    const hideCanvas = () => { if (canvasRef.current) canvasRef.current.style.opacity = "0"; };
    const showCanvas = () => { if (canvasRef.current) canvasRef.current.style.opacity = "1"; };

    /* ── Scroll: hide canvas while scrolling, show when done ── */
    const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onScroll = useCallback(() => {
      hideCanvas();
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(showCanvas, 200);
    }, []);

    /* ── Keyboard navigation ─────────────────────────────────── */
    const onPageChangeRef = useRef(onPageChange);
    const currentPageRef  = useRef(currentPage);
    useEffect(() => { onPageChangeRef.current = onPageChange; currentPageRef.current = currentPage; });

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
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

    /* ── Drawing ─────────────────────────────────────────────── */
    const onPtrDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      /* Let buttons and interactive elements handle their own clicks */
      if ((e.target as HTMLElement).closest("button, a, input, select")) return;
      const isPen   = e.pointerType === "pen";
      const isMouse = e.pointerType === "mouse";
      const isTouch = e.pointerType === "touch";
      if (isPen || isMouse || (isTouch && !showText)) {
        if (isTouch && !e.isPrimary) return;
        e.preventDefault();
        startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }, [startDrawing, getCanvasPoint, showText]);

    const onPtrMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const isPen   = e.pointerType === "pen";
      const isMouse = e.pointerType === "mouse";
      const isTouch = e.pointerType === "touch";
      if (isPen || isMouse || (isTouch && !showText)) {
        if (isTouch && !e.isPrimary) return;
        if ((isPen || isMouse) && e.buttons === 0) return;
        e.preventDefault();
        draw(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
      }
    }, [draw, getCanvasPoint, showText]);

    const onPtrUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const isPen   = e.pointerType === "pen";
      const isMouse = e.pointerType === "mouse";
      const isTouch = e.pointerType === "touch";
      if (isPen || isMouse || (isTouch && !showText)) stopDrawing();
    }, [stopDrawing, showText]);

    /* ── Theme ───────────────────────────────────────────────── */
    const bg = isDark ? "#12122a" : "#fefdf8";

    const isLastPage = surahRange ? currentPage >= surahRange.end : false;
    const isFirstPage = surahRange ? currentPage <= surahRange.start : false;

    return (
      <div
        ref={outerRef}
        style={{ position: "relative", width: "100%", height: "100%", background: bg, overflow: "hidden" }}
      >
        {/* ── Scrollable content ────────────────────────────── */}
        <div
          ref={scrollRef}
          style={{
            position: "absolute", inset: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "thin",
            scrollbarColor: isDark ? "#2a2a4e transparent" : "#d8d3c0 transparent",
            touchAction: showText ? "pan-y" : "none",
          } as React.CSSProperties}
          onScroll={onScroll}
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrUp}
          onPointerLeave={onPtrUp}
          onPointerCancel={onPtrUp}
        >
          <PageContent
            page={currentPage}
            verses={getVerses(currentPage)}
            chapterMap={chapterMap}
            chapters={chapters}
            isDark={isDark}
            showText={showText}
            selectedChapterId={selectedChapterId}
            isLastPage={isLastPage}
            isFirstPage={isFirstPage}
            surahRange={surahRange}
            onNextPage={() => onPageChange(currentPage + 1)}
            onPrevPage={() => onPageChange(currentPage - 1)}
            onSelectSurah={onSelectSurah}
          />
        </div>

        {/* ── Canvas overlay (pointer-events:none) ──────────── */}
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

        <div ref={dummyRef} style={{ display: "none" }} />
      </div>
    );
  }
);

/* ════════════════════════════════════════════════════════════
   Page content — natural scrollable height, quran.com style
   ════════════════════════════════════════════════════════════ */
interface PageContentProps {
  page:              number;
  verses:            Verse[];
  chapterMap:        Map<number, Chapter>;
  chapters:          Chapter[];
  isDark:            boolean;
  showText:          boolean;
  selectedChapterId: number | null;
  isLastPage:        boolean;
  isFirstPage:       boolean;
  surahRange:        SurahRange | null;
  onNextPage:        () => void;
  onPrevPage:        () => void;
  onSelectSurah:     (chapter: Chapter) => void;
}

function PageContent({
  page, verses, chapterMap, chapters, isDark, showText,
  selectedChapterId, isLastPage, isFirstPage,
  surahRange, onNextPage, onPrevPage, onSelectSurah,
}: PageContentProps) {

  /* Filter to selected surah only */
  const filteredVerses = useMemo(
    () => selectedChapterId != null
      ? verses.filter(v => v.chapter_id === selectedChapterId)
      : verses,
    [verses, selectedChapterId],
  );

  /* ── Lines with surah-break markers ───────────────────── */
  type PageLine = { lineNumber: number; words: Word[]; newChapter?: Chapter };

  const pageLines = useMemo<PageLine[]>(() => {
    if (!filteredVerses.length) return [];
    const allWords: (Word & { verse_number: number; chapter_id: number })[] = [];
    for (const v of filteredVerses)
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
  }, [filteredVerses, chapterMap]);

  /* ── Selected chapter metadata + adjacent surahs ─────── */
  const chapter     = selectedChapterId ? chapterMap.get(selectedChapterId) : undefined;
  const prevChapter = selectedChapterId && selectedChapterId > 1
    ? chapters.find(c => c.id === selectedChapterId - 1) : undefined;
  const nextChapter = selectedChapterId && selectedChapterId < 114
    ? chapters.find(c => c.id === selectedChapterId + 1) : undefined;

  /* ── Theme ─────────────────────────────────────────────── */
  const textColor    = isDark ? "rgba(220,210,185,0.40)" : "rgba(26,26,46,0.40)";
  const accentColor  = isDark ? "#d4af37"                : "#1a3a6e";
  const mutedColor   = isDark ? "#6a6a9a"                : "#6b7280";
  const dividerColor = isDark ? "#2a2a4a"                : "#e5e1d5";
  const bgCard       = isDark ? "rgba(255,255,255,0.03)" : "rgba(26,58,110,0.04)";
  const fontFamily   = `"QPC_P${page}", "Amiri Quran", serif`;

  const opacity = showText ? 1 : 0;
  const transition = "opacity 0.2s ease";

  return (
    <div
      style={{
        minHeight:     "100%",
        display:       "flex",
        flexDirection: "column",
        boxSizing:     "border-box",
        padding:       "0 0 48px",
        userSelect:    "none",
        pointerEvents: "none",
      }}
    >
      {/* ── Surah Header (quran.com inspired) ───────────── */}
      {chapter && isFirstPage && (
        <div
          style={{
            display:       "flex",
            alignItems:    "center",
            gap:           "1.5rem",
            padding:       "2.5rem 5% 2rem",
            borderBottom:  `1px solid ${dividerColor}`,
            marginBottom:  "0.5rem",
            opacity,
            transition,
          }}
        >
          {/* Large Arabic calligraphic name */}
          <div style={{
            fontFamily:  '"Amiri Quran", "Amiri", serif',
            fontSize:    "clamp(52px, 8vw, 96px)",
            color:       accentColor,
            lineHeight:  1,
            direction:   "rtl",
            flexShrink:  0,
          }}>
            {chapter.name_arabic}
          </div>

          {/* Divider */}
          <div style={{ width: 1, alignSelf: "stretch", background: dividerColor, flexShrink: 0 }} />

          {/* Info column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <div style={{
              fontSize:   "clamp(18px, 2.2vw, 26px)",
              fontWeight: 700,
              color:      textColor,
              letterSpacing: "-0.01em",
            }}>
              {chapter.id}. {chapter.name_simple}
            </div>
            <div style={{
              fontSize:  "clamp(13px, 1.6vw, 18px)",
              color:     mutedColor,
              fontWeight: 400,
            }}>
              {chapter.translated_name.name}
            </div>
            <div style={{
              marginTop:    "0.3rem",
              fontSize:     "clamp(11px, 1.2vw, 14px)",
              color:        mutedColor,
              opacity:      0.7,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight:   500,
            }}>
              {chapter.revelation_place === "makkah" ? "Makki" : "Madani"} · {chapter.verses_count} Ayahs
            </div>
          </div>
        </div>
      )}

      {/* ── Bismillah (when surah has bismillah and first page) */}
      {chapter && isFirstPage && chapter.bismillah_pre && chapter.id !== 9 && (
        <div style={{
          fontFamily:  '"Amiri Quran", "Amiri", serif',
          fontSize:    "clamp(22px, 3.2vw, 36px)",
          color:       accentColor,
          textAlign:   "center",
          direction:   "rtl",
          lineHeight:  2,
          padding:     "1rem 5% 0.5rem",
          opacity:     opacity * 0.9,
          transition,
        }}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>
      )}

      {/* ── Verse lines ─────────────────────────────────── */}
      <div style={{
        flex:    1,
        padding: "2rem 5%",
        opacity,
        transition,
      }}>
        {!filteredVerses.length ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              border: `2px solid ${accentColor}`,
              borderTopColor: "transparent",
              animation: "spin 0.9s linear infinite",
              opacity: 0.4,
            }} />
          </div>
        ) : (
          <div style={{
            display:       "flex",
            flexDirection: "column",
            maxWidth:      960,
            margin:        "0 auto",
          }}>
            {pageLines.map((pl) => (
              <div key={pl.lineNumber}>
                {/* Inline surah banner (for mid-page surah boundaries, not first page) */}
                {pl.newChapter && !isFirstPage && (
                  <MidPageBanner
                    chapter={pl.newChapter}
                    isDark={isDark}
                    accentColor={accentColor}
                    mutedColor={mutedColor}
                    dividerColor={dividerColor}
                  />
                )}
                <div style={{
                  fontFamily,
                  fontSize:   "clamp(24px, 3.6vw, 38px)",
                  lineHeight: 2,
                  color:      textColor,
                  textAlign:  "center",
                  direction:  "rtl",
                  unicodeBidi: "bidi-override",
                }}>
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
      </div>

      {/* ── Page number ─────────────────────────────────── */}
      <div style={{
        textAlign:     "center",
        fontFamily:    "'Amiri', serif",
        fontSize:      14,
        color:         mutedColor,
        letterSpacing: "0.05em",
        paddingBottom: "1.5rem",
        opacity:       showText ? 0.6 : 0,
        transition,
      }}>
        {page}
      </div>

      {/* ── Page divider ────────────────────────────────── */}
      <div style={{ height: 1, background: dividerColor, margin: "0 5%" }} />

      {/* ── Footer: surah navigation (always visible at bottom) */}
      {isLastPage ? (
        /* Last (or only) page of surah → show prev / next surah buttons */
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "stretch",
          gap:            "0.75rem",
          padding:        "1.25rem 5%",
          opacity,
          transition,
        }}>
          {/* ← Previous surah */}
          {prevChapter ? (
            <SurahNavBtn
              label="← Previous"
              name={prevChapter.name_simple}
              arabic={prevChapter.name_arabic}
              align="left"
              accentColor={accentColor}
              mutedColor={mutedColor}
              dividerColor={dividerColor}
              bgCard={bgCard}
              onClick={() => onSelectSurah(prevChapter)}
            />
          ) : <div style={{ flex: 1 }} />}

          {/* → Next surah */}
          {nextChapter ? (
            <SurahNavBtn
              label="Next →"
              name={nextChapter.name_simple}
              arabic={nextChapter.name_arabic}
              align="right"
              accentColor={accentColor}
              mutedColor={mutedColor}
              dividerColor={dividerColor}
              bgCard={bgCard}
              onClick={() => onSelectSurah(nextChapter)}
            />
          ) : <div style={{ flex: 1 }} />}
        </div>
      ) : (
        /* Multi-page surah — still on intermediate page → "Continue" only */
        <div style={{
          display:        "flex",
          justifyContent: "flex-end",
          padding:        "1.25rem 5%",
          opacity,
          transition,
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onNextPage(); }}
            style={{
              pointerEvents: "all",
              background:    bgCard,
              border:        `1px solid ${dividerColor}`,
              borderRadius:  8,
              padding:       "0.5rem 1.2rem",
              cursor:        "pointer",
              color:         accentColor,
              fontSize:      14,
              fontWeight:    600,
            }}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Surah navigation button (prev / next surah) ────────────── */
function SurahNavBtn({ label, name, arabic, align, accentColor, mutedColor, dividerColor, bgCard, onClick }: {
  label: string; name: string; arabic: string; align: "left" | "right";
  accentColor: string; mutedColor: string; dividerColor: string; bgCard: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        pointerEvents:  "all",
        flex:           1,
        background:     bgCard,
        border:         `1px solid ${dividerColor}`,
        borderRadius:   10,
        padding:        "0.75rem 1rem",
        cursor:         "pointer",
        textAlign:      align,
        display:        "flex",
        flexDirection:  "column",
        gap:            "0.15rem",
      }}
    >
      <span style={{ fontSize: 11, color: mutedColor, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: 15, color: accentColor, fontWeight: 700 }}>
        {name}
      </span>
      <span style={{
        fontFamily: '"Amiri Quran", "Amiri", serif',
        fontSize: 18,
        color: accentColor,
        direction: "rtl",
        opacity: 0.75,
      }}>
        {arabic}
      </span>
    </button>
  );
}

/* ── Mid-page surah banner (compact, no large Arabic name) ── */
function MidPageBanner({ chapter, isDark, accentColor, mutedColor, dividerColor }: {
  chapter: Chapter; isDark: boolean; accentColor: string; mutedColor: string; dividerColor: string;
}) {
  return (
    <div style={{
      margin:     "1.5rem 0 0.75rem",
      padding:    "0.75rem 1.25rem",
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(26,58,110,0.04)",
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: "0 6px 6px 0",
    }}>
      <div style={{
        fontFamily:  '"Amiri Quran", "Amiri", serif',
        fontSize:    28,
        color:       accentColor,
        direction:   "rtl",
        lineHeight:  1.3,
      }}>
        سُورَةُ {chapter.name_arabic}
      </div>
      <div style={{
        fontSize:  12,
        color:     mutedColor,
        marginTop: "0.2rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}>
        {chapter.id}. {chapter.name_simple} · {chapter.revelation_place === "makkah" ? "Makki" : "Madani"}
      </div>
      {chapter.bismillah_pre && chapter.id !== 9 && (
        <div style={{
          fontFamily:  '"Amiri Quran", "Amiri", serif',
          fontSize:    22,
          color:       accentColor,
          direction:   "rtl",
          textAlign:   "right",
          marginTop:   "0.5rem",
          opacity:     0.85,
        }}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>
      )}
      {/* divider */}
      <div style={{ height: 1, background: dividerColor, marginTop: "0.75rem" }} />
    </div>
  );
}
