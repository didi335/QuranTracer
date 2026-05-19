import {
  useEffect, useRef, useCallback, forwardRef,
  useImperativeHandle, useMemo,
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
  drawMode:          boolean;
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
    { chapters, getVerses, currentPage, showText, penSettings, isDark, drawMode, onPageChange, onSelectSurah, surahRange, selectedChapterId },
    ref,
  ) {
    const outerRef      = useRef<HTMLDivElement>(null);
    const scrollRef     = useRef<HTMLDivElement>(null);
    const contentRef    = useRef<HTMLDivElement>(null);
    const dummyRef      = useRef<HTMLDivElement>(null);

    const {
      canvasRef, startDrawing, draw, stopDrawing,
      undo, clear, clearHistory, downloadAsImage, getCanvasPoint, isDrawing,
    } = useCanvas(penSettings, dummyRef);

    /* ── All pages in current surah ──────────────────────────── */
    const rangePages = useMemo(() => {
      if (!surahRange) return [currentPage];
      const pages: number[] = [];
      for (let p = surahRange.start; p <= surahRange.end; p++) pages.push(p);
      return pages;
    }, [surahRange, currentPage]);

    /* ── Inject fonts for all pages in surah ─────────────────── */
    useEffect(() => {
      rangePages.forEach(p => injectPageFont(p));
    }, [rangePages]);

    /* ── Per-page section refs (for scroll tracking) ─────────── */
    const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    /* ── Chapter map ─────────────────────────────────────────── */
    const chapterMap = useMemo(() => {
      const m = new Map<number, Chapter>();
      chapters.forEach(c => m.set(c.id, c));
      return m;
    }, [chapters]);

    /* ── Canvas sizing ───────────────────────────────────────── */
    /* Canvas lives inside the scroll container and covers the FULL
       scrollable height so strokes stay anchored to the text. */
    const syncCanvas = useCallback(() => {
      const canvas   = canvasRef.current;
      const scroll   = scrollRef.current;
      const content  = contentRef.current;
      if (!canvas || !scroll || !content) return;
      const dpr = window.devicePixelRatio || 1;
      const w   = scroll.clientWidth;
      const h   = content.scrollHeight || content.offsetHeight;
      if (!w || !h) return;
      const newW = Math.round(w * dpr);
      const newH = Math.round(h * dpr);
      if (canvas.width === newW && canvas.height === newH) return; // no change — preserve drawing
      canvas.width        = newW;
      canvas.height       = newH;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
    }, [canvasRef]);

    /* Re-sync whenever the content div resizes (pages/fonts loading in) */
    useEffect(() => {
      const el = contentRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncCanvas);
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncCanvas]);

    /* Also re-sync on outer container width change */
    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncCanvas);
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncCanvas]);

    useEffect(() => {
      syncCanvas();
    }, [syncCanvas]);

    /* ── Clear canvas + reset scroll when surah changes ─────── */
    const prevSurahStart = useRef<number | null>(null);
    useEffect(() => {
      const newStart = surahRange?.start ?? null;
      if (newStart !== prevSurahStart.current) {
        prevSurahStart.current = newStart;
        clearHistory();
        /* Jump instantly to top */
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      }
    }, [surahRange, clearHistory]);

    /* ── Scroll tracking: update currentPage as user scrolls ── */
    /* Use a ref to know whether the next currentPage change was
       triggered by the user scrolling (so we don't re-scroll) */
    const scrollTriggeredRef = useRef(false);
    const scrollTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onScroll = useCallback(() => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        const el = scrollRef.current;
        if (!el) return;

        /* Find the page section whose midpoint is closest to the
           vertical centre of the viewport */
        const viewMid = el.scrollTop + el.clientHeight * 0.4;
        let closestPage = -1;
        let closestDist = Infinity;

        sectionRefs.current.forEach((sectionEl, page) => {
          const sectionMid = sectionEl.offsetTop + sectionEl.clientHeight / 2;
          const dist = Math.abs(viewMid - sectionMid);
          if (dist < closestDist) { closestDist = dist; closestPage = page; }
        });

        if (closestPage !== -1 && closestPage !== currentPage) {
          scrollTriggeredRef.current = true;
          onPageChange(closestPage);
        }
      }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, onPageChange]);

    /* ── When currentPage changes externally, scroll to section ─ */
    useEffect(() => {
      if (scrollTriggeredRef.current) {
        scrollTriggeredRef.current = false;
        return;
      }
      /* External change (surah selected, bookmark clicked) — scroll to section */
      const sectionEl = sectionRefs.current.get(currentPage);
      if (sectionEl && scrollRef.current) {
        scrollRef.current.scrollTo({ top: sectionEl.offsetTop, behavior: "smooth" });
      }
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

    /* ── Drawing ─────────────────────────────────────────────── */
    /* Rules:
       - pen (Apple Pencil / stylus): ALWAYS draws immediately
       - mouse (click+drag):          ALWAYS draws immediately
       - touch (finger):              draws only when Draw Mode is ON,
                                      otherwise the browser scrolls */
    const isInteractiveTarget = (e: React.PointerEvent) =>
      !!(e.target as HTMLElement).closest("button, a, input, select");

    const onPtrDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (isInteractiveTarget(e)) return;

      /* Second touch while drawing → cancel stroke so pinch-zoom / 2-finger scroll works */
      if (isDrawing.current && e.pointerType === "touch" && !e.isPrimary) {
        stopDrawing();
        return;
      }

      if (e.pointerType === "pen" || e.pointerType === "mouse") {
        e.preventDefault();
        startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      if (e.pointerType === "touch" && e.isPrimary) {
        if (drawMode) {
          /* Draw Mode ON → finger draws immediately */
          e.preventDefault();
          startDrawing(getCanvasPoint(e.clientX, e.clientY, 0.5));
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
        /* Draw Mode OFF → finger scrolls; do nothing here */
      }
    }, [startDrawing, stopDrawing, getCanvasPoint, isDrawing, drawMode]);

    const onPtrMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      /* Active stroke → just keep drawing */
      if (isDrawing.current) {
        if (e.pointerType === "mouse" && e.buttons === 0) { stopDrawing(); return; }
        e.preventDefault();
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        for (const ev of events) {
          draw(getCanvasPoint(ev.clientX, ev.clientY, ev.pressure > 0 ? ev.pressure : 0.5));
        }
        return;
      }

      /* (No pending-touch buffer needed — Draw Mode is explicit) */
    }, [isDrawing, draw, stopDrawing, getCanvasPoint]);

    const onPtrUp = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
      stopDrawing();
    }, [stopDrawing]);

    const onPtrCancel = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
      stopDrawing();
    }, [stopDrawing]);

    /* Block iPad Safari's native gesture machinery when Draw Mode is ON.
       Without aggressive preventDefault on touchstart/touchmove, iOS can
       commit to a scroll/zoom gesture and fire pointercancel mid-stroke —
       producing the "tiny disconnected lines" symptom on iPad.
       Also blocks scroll while pen/mouse is actively drawing. */
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const prevent = (e: TouchEvent) => {
        if (drawMode || isDrawing.current) e.preventDefault();
      };
      el.addEventListener("touchstart",  prevent, { passive: false });
      el.addEventListener("touchmove",   prevent, { passive: false });
      el.addEventListener("touchend",    prevent, { passive: false });
      el.addEventListener("touchcancel", prevent, { passive: false });
      return () => {
        el.removeEventListener("touchstart",  prevent);
        el.removeEventListener("touchmove",   prevent);
        el.removeEventListener("touchend",    prevent);
        el.removeEventListener("touchcancel", prevent);
      };
    }, [isDrawing, drawMode]);

    /* ── Keyboard navigation ─────────────────────────────────── */
    const onPageChangeRef = useRef(onPageChange);
    const currentPageRef  = useRef(currentPage);
    useEffect(() => { onPageChangeRef.current = onPageChange; currentPageRef.current = currentPage; });

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).tagName === "INPUT" ||
            (e.target as HTMLElement).tagName === "TEXTAREA") return;
        const el = scrollRef.current;
        if (!el) return;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          el.scrollBy({ top: el.clientHeight * 0.8, behavior: "smooth" });
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          el.scrollBy({ top: -el.clientHeight * 0.8, behavior: "smooth" });
        } else if (e.key === " ") {
          e.preventDefault();
          el.scrollBy({ top: el.clientHeight * 0.9, behavior: "smooth" });
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, []);

    /* ── Theme ───────────────────────────────────────────────── */
    const bg        = isDark ? "#12122a" : "#fefdf8";
    const chapter   = selectedChapterId ? chapterMap.get(selectedChapterId) : undefined;
    const accentColor  = isDark ? "#d4af37" : "#1a3a6e";
    const mutedColor   = isDark ? "#6a6a9a" : "#6b7280";
    const dividerColor = isDark ? "#2a2a4a" : "#e5e1d5";
    const bgCard       = isDark ? "rgba(255,255,255,0.03)" : "rgba(26,58,110,0.04)";

    const prevChapter = selectedChapterId && selectedChapterId > 1
      ? chapters.find(c => c.id === selectedChapterId - 1) : undefined;
    const nextChapter = selectedChapterId && selectedChapterId < 114
      ? chapters.find(c => c.id === selectedChapterId + 1) : undefined;

    const opacity    = showText ? 1 : 0;
    const transition = "opacity 0.2s ease";

    return (
      <div
        ref={outerRef}
        style={{ position: "relative", width: "100%", height: "100%", background: bg, overflow: "hidden" }}
      >
        {/* ── Continuous scrollable content ─────────────────── */}
        <div
          ref={scrollRef}
          style={{
            position: "absolute", inset: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            scrollbarWidth: "thin",
            scrollbarColor: isDark ? "#2a2a4e transparent" : "#d8d3c0 transparent",
            touchAction: drawMode ? "none" : "pan-y",
          } as React.CSSProperties}
          onScroll={onScroll}
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrUp}
          onPointerLeave={onPtrUp}
          onPointerCancel={onPtrCancel}
        >
          {/* ── Drawing canvas — anchored to content, scrolls with text ── */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute", top: 0, left: 0,
              zIndex: 10, pointerEvents: "none",
            }}
          />

          {/* ── All scrollable content wrapped so we can measure its height ── */}
          <div ref={contentRef} style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>

          {/* ── Surah header (once at the very top) ─────────── */}
          {chapter && (
            <div style={{ opacity, transition }}>
              {/* Large calligraphic header */}
              <div style={{
                display: "flex", alignItems: "stretch", justifyContent: "center", gap: "1.5rem",
                padding: "clamp(4rem, 6vw, 5rem) 5% clamp(2rem, 3.5vw, 3rem)",
                borderBottom: `1px solid ${dividerColor}`,
                marginBottom: "0.5rem",
              }}>
                <div style={{
                  fontFamily: '"Amiri Quran", "Amiri", serif',
                  fontSize: "clamp(40px, 5.5vw, 64px)",
                  color: accentColor,
                  lineHeight: 1,
                  direction: "rtl",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  paddingBottom: "0.18em",
                }}>
                  {chapter.name_arabic}
                </div>
                <div style={{ width: 1, background: dividerColor, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.2rem" }}>
                  <div style={{ fontSize: "clamp(18px, 2.2vw, 26px)", fontWeight: 700, color: isDark ? "rgba(220,210,185,0.85)" : "rgba(26,26,46,0.85)", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                    {chapter.id}. {chapter.name_simple}
                  </div>
                  <div style={{ fontSize: "clamp(13px, 1.6vw, 18px)", color: mutedColor, fontWeight: 400, lineHeight: 1.2 }}>
                    {chapter.translated_name.name}
                  </div>
                  <div style={{ marginTop: "0.25rem", fontSize: "clamp(10px, 1.1vw, 13px)", color: mutedColor, opacity: 0.7, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>
                    {chapter.revelation_place === "makkah" ? "Makki" : "Madani"} · {chapter.verses_count} Ayahs
                  </div>
                </div>
              </div>

              {/* Bismillah — large calligraphic style like quran.com */}
              {chapter.bismillah_pre && chapter.id !== 9 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
                  padding: "clamp(1.5rem, 3vw, 2.5rem) 5% clamp(1.25rem, 2.5vw, 2rem)",
                }}>
                  <div style={{ flex: 1, maxWidth: "12%", height: 1, background: dividerColor, opacity: 0.6, transform: "translateY(0.08em)" }} />
                  <div style={{
                    fontFamily: '"Amiri Quran", "Amiri", serif',
                    fontSize: "clamp(20px, 3vw, 35px)",
                    fontWeight: 400,
                    color: accentColor,
                    textAlign: "center",
                    direction: "rtl",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}>
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </div>
                  <div style={{ flex: 1, maxWidth: "12%", height: 1, background: dividerColor, opacity: 0.6, transform: "translateY(0.08em)" }} />
                </div>
              )}
            </div>
          )}

          {/* ── Page sections ────────────────────────────────── */}
          {rangePages.map((page, idx) => (
            <div
              key={page}
              ref={(el) => {
                if (el) sectionRefs.current.set(page, el);
                else sectionRefs.current.delete(page);
              }}
              data-page={page}
            >
              <PageSection
                page={page}
                verses={getVerses(page)}
                chapterMap={chapterMap}
                isDark={isDark}
                showText={showText}
                selectedChapterId={selectedChapterId}
                isFirstOfSurah={idx === 0}
                accentColor={accentColor}
                mutedColor={mutedColor}
                dividerColor={dividerColor}
              />

              {/* Page divider between pages */}
              {surahRange && page < surahRange.end && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 5%", opacity: showText ? 1 : 0, transition }}>
                  <div style={{ flex: 1, height: 1, background: dividerColor }} />
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    padding: "0.2rem 0.65rem",
                    borderRadius: 999,
                    border: `1px solid ${dividerColor}`,
                    background: isDark ? "rgba(212,175,55,0.08)" : "rgba(26,58,110,0.06)",
                  }}>
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                      <circle cx="5" cy="5" r="4" stroke={accentColor} strokeWidth="1.5" />
                    </svg>
                    <span style={{
                      fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 600,
                      color: accentColor, letterSpacing: "0.05em",
                    }}>
                      {page}
                    </span>
                  </div>
                  <div style={{ flex: 1, height: 1, background: dividerColor }} />
                </div>
              )}
            </div>
          ))}

          {/* ── Footer: prev / next surah ────────────────────── */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "stretch",
            gap: "0.75rem", padding: "1rem 5% 1.25rem",
            marginTop: "auto",
            opacity, transition,
          }}>
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

          </div>{/* end contentRef wrapper */}
        </div>

        <div ref={dummyRef} style={{ display: "none" }} />
      </div>
    );
  }
);

/* ════════════════════════════════════════════════════════════
   One mushaf page worth of lines
   ════════════════════════════════════════════════════════════ */
interface PageSectionProps {
  page:              number;
  verses:            Verse[];
  chapterMap:        Map<number, Chapter>;
  isDark:            boolean;
  showText:          boolean;
  selectedChapterId: number | null;
  isFirstOfSurah:    boolean;
  accentColor:       string;
  mutedColor:        string;
  dividerColor:      string;
}

function PageSection({
  page, verses, chapterMap, isDark, showText,
  selectedChapterId, isFirstOfSurah,
  accentColor, mutedColor, dividerColor,
}: PageSectionProps) {

  const filteredVerses = useMemo(
    () => selectedChapterId != null
      ? verses.filter(v => v.chapter_id === selectedChapterId)
      : verses,
    [verses, selectedChapterId],
  );

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
      const chapterId = words[0].chapter_id;
      let newChapter: Chapter | undefined;
      if (chapterId !== prevChId && words.some(w => w.verse_number === 1))
        newChapter = chapterMap.get(chapterId);
      result.push({ lineNumber, words, newChapter });
      prevChId = chapterId;
    }
    return result;
  }, [filteredVerses, chapterMap]);

  const textColor  = isDark ? "rgba(220,210,185,0.40)" : "rgba(26,26,46,0.40)";
  const fontFamily = `"QPC_P${page}", "Amiri Quran", serif`;
  const opacity    = showText ? 1 : 0;
  const transition = "opacity 0.2s ease";

  if (!filteredVerses.length) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem 5%", opacity: 0.4 }}>
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          border: `2px solid ${accentColor}`, borderTopColor: "transparent",
          animation: "spin 0.9s linear infinite",
        }} />
      </div>
    );
  }

  return (
    <div style={{ padding: isFirstOfSurah ? "0.5rem clamp(0.5rem, 3%, 3rem) 0" : "1.5rem clamp(0.5rem, 3%, 3rem) 0", userSelect: "none", pointerEvents: "none" }}>
      <div style={{
        display: "flex", flexDirection: "column",
        maxWidth: 960, margin: "0 auto",
        opacity, transition,
      }}>
        {pageLines.map((pl) => (
          <div key={pl.lineNumber}>
            {/* Mid-page surah banner */}
            {pl.newChapter && !isFirstOfSurah && (
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
              fontSize:    page <= 2 ? "clamp(28px, 6vw, 52px)" : "clamp(22px, 4.5vw, 44px)",
              lineHeight:  2.1,
              color:       textColor,
              textAlign:   "center",
              direction:   "rtl",
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
    </div>
  );
}

/* ── Mid-page surah banner ──────────────────────────────────── */
function MidPageBanner({ chapter, isDark, accentColor, mutedColor, dividerColor }: {
  chapter: Chapter; isDark: boolean; accentColor: string; mutedColor: string; dividerColor: string;
}) {
  return (
    <div style={{
      margin: "1.5rem 0 0.5rem",
      padding: "0.75rem 1.25rem",
      borderTop: `1px solid ${dividerColor}`,
      borderBottom: `1px solid ${dividerColor}`,
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(26,58,110,0.03)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      direction: "ltr",
    }}>
      <div style={{ fontSize: 13, color: mutedColor, fontWeight: 500 }}>
        {chapter.id}. {chapter.name_simple}
      </div>
      <div style={{
        fontFamily: '"Amiri Quran", "Amiri", serif',
        fontSize: 22, color: accentColor, direction: "rtl", lineHeight: 1.5,
      }}>
        {chapter.name_arabic}
      </div>
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
      onClick={onClick}
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : "flex-end",
        gap: "0.2rem",
        padding: "0.75rem 1rem",
        border: `1px solid ${dividerColor}`,
        borderRadius: 12,
        background: bgCard,
        cursor: "pointer",
        pointerEvents: "auto",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
    >
      <span style={{ fontSize: 11, color: mutedColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, color: accentColor }}>{name}</span>
      <span style={{ fontFamily: '"Amiri", serif', fontSize: 18, color: accentColor, direction: "rtl" }}>
        {arabic}
      </span>
    </button>
  );
}
