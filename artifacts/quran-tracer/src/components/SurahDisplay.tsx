import {
  useEffect, useLayoutEffect, useRef, useCallback, forwardRef,
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
      renderAll,
    } = useCanvas(penSettings, dummyRef);

    /* ── Pages to render: a window around currentPage ─────────
       Rendering an entire surah (e.g. Al-Baqarah = 48 pages) makes the
       scroll content taller than browsers can size a canvas (~32767 px
       max), which causes the drawing canvas overlay to become invalid
       and hide the text beneath it. A page window keeps things sane
       while still allowing continuous scroll within a surah. */
    const PAGE_WINDOW = 3;
    const rangePages = useMemo(() => {
      if (!surahRange) return [currentPage];
      const lo = Math.max(surahRange.start, currentPage - PAGE_WINDOW);
      const hi = Math.min(surahRange.end,   currentPage + PAGE_WINDOW);
      const pages: number[] = [];
      for (let p = lo; p <= hi; p++) pages.push(p);
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
      /* Cap DPR at 2 — matches useCanvas. Keeps the canvas buffer
         small enough that strokes render without lag on 3x iPads. */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w   = scroll.clientWidth;
      const h   = content.scrollHeight || content.offsetHeight;
      if (!w || !h) return;
      const newW = Math.round(w * dpr);
      const newH = Math.round(h * dpr);
      if (canvas.width === newW && canvas.height === newH) return; // no change
      /* Don't snapshot/restore — assigning width/height clears the
         bitmap, and the vector stroke log can redraw everything in
         one pass. This avoids a multi-hundred-MB GPU buffer copy on
         every resize event. */
      canvas.width        = newW;
      canvas.height       = newH;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      renderAll();
    }, [canvasRef, renderAll]);

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

    /* When the page window shifts mid-scroll (a page is unmounted at
       the top to keep the canvas a sane size), the content above the
       reader collapses and the viewport would jump. Snapshot the new
       current-page section's offsetTop BEFORE setState, then in a
       layout effect adjust scrollTop by the delta so the reader's view
       stays anchored to the same Arabic line they were looking at. */
    const scrollAnchor = useRef<{ page: number; offsetTop: number } | null>(null);

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
          const newSection = sectionRefs.current.get(closestPage);
          if (newSection) {
            scrollAnchor.current = { page: closestPage, offsetTop: newSection.offsetTop };
          }
          scrollTriggeredRef.current = true;
          onPageChange(closestPage);
        }
      }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, onPageChange]);

    /* ── Preserve scroll across page-window shifts ──────────────
       Runs synchronously after DOM commit (before paint), so the
       browser never paints the shifted-but-uncorrected frame. */
    useLayoutEffect(() => {
      const anchor = scrollAnchor.current;
      if (!anchor || anchor.page !== currentPage) return;
      const el = scrollRef.current;
      const section = sectionRefs.current.get(currentPage);
      if (!el || !section) return;
      const delta = section.offsetTop - anchor.offsetTop;
      if (delta !== 0) el.scrollTop += delta;
      scrollAnchor.current = null;
    });

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

    /* ── Drawing: native pointer listeners (passive: false) ──────
       Attaching natively (instead of via React's synthetic handlers)
       guarantees preventDefault() actually fires on iPad Safari and
       avoids any React event-delegation quirks that can cause
       broken/dropped pointer events on iOS. */
    const drawModeRef = useRef(drawMode);
    useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;

      const isInteractive = (target: EventTarget | null) =>
        !!(target as HTMLElement | null)?.closest?.("button, a, input, select");

      const onDown = (e: PointerEvent) => {
        if (isInteractive(e.target)) return;

        /* Second touch while drawing → end stroke (so 2-finger gestures
           can never wedge the stroke open) */
        if (isDrawing.current && e.pointerType === "touch" && !e.isPrimary) {
          stopDrawing();
          return;
        }

        /* Mouse: only draws when Draw Mode is ON AND a real button is
           pressed. With Draw Mode OFF, mouse clicks do nothing (matches
           finger behavior) so the user can scroll/select freely. */
        if (e.pointerType === "mouse") {
          if (!drawModeRef.current) return;
          if (e.buttons === 0 || e.button < 0) return;
          e.preventDefault();
          startDrawing(getCanvasPoint(e.clientX, e.clientY, 0.5));
          try { el.setPointerCapture(e.pointerId); } catch {}
          return;
        }

        /* Pen (Apple Pencil / stylus): always draw */
        if (e.pointerType === "pen") {
          e.preventDefault();
          startDrawing(getCanvasPoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
          try { el.setPointerCapture(e.pointerId); } catch {}
          return;
        }

        /* Touch (finger): only draws when Draw Mode is ON */
        if (e.pointerType === "touch" && e.isPrimary && drawModeRef.current) {
          e.preventDefault();
          startDrawing(getCanvasPoint(e.clientX, e.clientY, 0.5));
          try { el.setPointerCapture(e.pointerId); } catch {}
        }
      };

      const onMove = (e: PointerEvent) => {
        /* HARD GATE: a mouse pointer with no buttons held can NEVER draw.
           Force-stop any in-progress stroke and bail. This catches every
           ghost-drawing edge case (missed pointerup, lost capture, etc.) */
        if (e.pointerType === "mouse" && e.buttons === 0) {
          if (isDrawing.current) stopDrawing();
          return;
        }
        if (!isDrawing.current) return;
        e.preventDefault();
        /* getCoalescedEvents() recovers every digitizer sample the OS
           batched between frames — essential for smooth iPad strokes */
        const coalesced = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] })
          .getCoalescedEvents?.() ?? [e];
        for (const ce of coalesced) {
          draw(getCanvasPoint(ce.clientX, ce.clientY, ce.pressure > 0 ? ce.pressure : 0.5));
        }
      };

      const onUp     = () => { if (isDrawing.current) stopDrawing(); };
      const onCancel = () => { if (isDrawing.current) stopDrawing(); };
      const onBlur   = () => { if (isDrawing.current) stopDrawing(); };

      const opts: AddEventListenerOptions = { passive: false };
      el.addEventListener("pointerdown",   onDown,   opts);
      el.addEventListener("pointermove",   onMove,   opts);
      el.addEventListener("pointerup",     onUp,     opts);
      el.addEventListener("pointerleave",  onUp,     opts);
      el.addEventListener("pointercancel", onCancel, opts);
      /* Window-level safety net: if the user releases the mouse outside
         the scroll container (e.g. over the floating toolbar) the
         pointerup on `el` may never fire — catch it here. Also stop
         drawing when the window loses focus. */
      window.addEventListener("pointerup",     onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("blur",          onBlur);

      return () => {
        el.removeEventListener("pointerdown",   onDown);
        el.removeEventListener("pointermove",   onMove);
        el.removeEventListener("pointerup",     onUp);
        el.removeEventListener("pointerleave",  onUp);
        el.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("pointerup",     onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("blur",          onBlur);
      };
    }, [startDrawing, draw, stopDrawing, getCanvasPoint, isDrawing]);

    /* Block iPad Safari's native gesture machinery when Draw Mode is ON.
       Without aggressive preventDefault on touchstart/touchmove, iOS can
       commit to a scroll/zoom gesture and fire pointercancel mid-stroke —
       producing the "tiny disconnected lines" symptom on iPad.
       Also blocks scroll while pen/mouse is actively drawing. */
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const prevent = (e: Event) => {
        if (drawMode || isDrawing.current) e.preventDefault();
      };
      el.addEventListener("touchstart",  prevent, { passive: false });
      el.addEventListener("touchmove",   prevent, { passive: false });
      el.addEventListener("touchend",    prevent, { passive: false });
      el.addEventListener("touchcancel", prevent, { passive: false });
      /* Safari-only gesture events fire for any 2-finger pinch/zoom and
         can fire pointercancel on the active stroke. Block them. */
      el.addEventListener("gesturestart",  prevent as EventListener, { passive: false });
      el.addEventListener("gesturechange", prevent as EventListener, { passive: false });
      el.addEventListener("gestureend",    prevent as EventListener, { passive: false });
      /* Long-press context menu can also cancel strokes */
      el.addEventListener("contextmenu", prevent, { passive: false });
      return () => {
        el.removeEventListener("touchstart",  prevent);
        el.removeEventListener("touchmove",   prevent);
        el.removeEventListener("touchend",    prevent);
        el.removeEventListener("touchcancel", prevent);
        el.removeEventListener("gesturestart",  prevent as EventListener);
        el.removeEventListener("gesturechange", prevent as EventListener);
        el.removeEventListener("gestureend",    prevent as EventListener);
        el.removeEventListener("contextmenu", prevent);
      };
    }, [isDrawing, drawMode]);

    /* While Draw Mode is on, lock the document so iOS rubber-band bounce
       can't fire and interrupt strokes. */
    useEffect(() => {
      if (!drawMode) return;
      const prevBody = document.body.style.overscrollBehavior;
      const prevHtml = document.documentElement.style.overscrollBehavior;
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overscrollBehavior = "none";
      return () => {
        document.body.style.overscrollBehavior = prevBody;
        document.documentElement.style.overscrollBehavior = prevHtml;
      };
    }, [drawMode]);

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
            /* iOS momentum scrolling interferes with pointer events while
               drawing; disable it in Draw Mode */
            WebkitOverflowScrolling: drawMode ? "auto" : "touch",
            overscrollBehavior: "contain",
            scrollbarWidth: "thin",
            scrollbarColor: isDark ? "#2a2a4e transparent" : "#d8d3c0 transparent",
            touchAction: drawMode ? "none" : "pan-y",
            /* Critical for iPad: prevent text-selection long-press from
               firing pointercancel mid-stroke */
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          } as React.CSSProperties}
          onScroll={onScroll}
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
              {/* Large calligraphic header — flanked by prev/next surah buttons */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
                padding: "clamp(4rem, 6vw, 5rem) 5% clamp(2rem, 3.5vw, 3rem)",
                borderBottom: `1px solid ${dividerColor}`,
                marginBottom: "0.5rem",
              }}>
                {prevChapter ? (
                  <SurahArrowBtn
                    direction="prev"
                    name={prevChapter.name_simple}
                    accentColor={accentColor}
                    mutedColor={mutedColor}
                    dividerColor={dividerColor}
                    bgCard={bgCard}
                    onClick={() => onSelectSurah(prevChapter)}
                  />
                ) : <div style={{ width: 44 }} />}

                <div style={{
                  display: "flex", alignItems: "stretch", justifyContent: "center", gap: "1.5rem",
                  flex: 1,
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

                {nextChapter ? (
                  <SurahArrowBtn
                    direction="next"
                    name={nextChapter.name_simple}
                    accentColor={accentColor}
                    mutedColor={mutedColor}
                    dividerColor={dividerColor}
                    bgCard={bgCard}
                    onClick={() => onSelectSurah(nextChapter)}
                  />
                ) : <div style={{ width: 44 }} />}
              </div>

              {/* Bismillah — large calligraphic style like quran.com */}
              {chapter.bismillah_pre && chapter.id !== 9 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "1.25rem",
                  padding: "clamp(2.5rem, 5vw, 4rem) 5% clamp(2.5rem, 5vw, 4rem)",
                }}>
                  <div style={{ flex: 1, maxWidth: "12%", height: 1, background: dividerColor, opacity: 0.6, transform: "translateY(0.08em)" }} />
                  <div style={{
                    fontFamily: '"Amiri Quran", "Amiri", serif',
                    fontSize: "clamp(27px, 4vw, 45px)",
                    fontWeight: 400,
                    color: accentColor,
                    textAlign: "center",
                    direction: "rtl",
                    lineHeight: 1.1,
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
    /* Reserve a stable height that matches a typical Mushaf page so
       that when the verses arrive the layout doesn't grow underneath
       the user mid-scroll. ~15 lines × ~84px line-height ≈ 1260px. */
    return (
      <div style={{
        minHeight: "min(80vh, 1300px)",
        display: "flex", justifyContent: "center", alignItems: "center",
        padding: "3rem 5%", opacity: 0.4,
      }}>
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
              fontSize:    page <= 2 ? "clamp(31.5px, 5.25vw, 54.6px)" : "clamp(27.3px, 4.2vw, 48.3px)",
              lineHeight:  2.2,
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

/* ── Compact arrow button for prev/next surah next to the title ─ */
function SurahArrowBtn({ direction, name, accentColor, mutedColor, dividerColor, bgCard, onClick }: {
  direction: "prev" | "next"; name: string;
  accentColor: string; mutedColor: string; dividerColor: string; bgCard: string;
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      onClick={onClick}
      title={`${isPrev ? "Previous" : "Next"} surah: ${name}`}
      aria-label={`${isPrev ? "Previous" : "Next"} surah: ${name}`}
      style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.55rem 0.85rem",
        border: `1px solid ${dividerColor}`,
        borderRadius: 999,
        background: bgCard,
        color: accentColor,
        cursor: "pointer",
        pointerEvents: "auto",
        flexShrink: 0,
        transition: "opacity 0.15s",
        flexDirection: isPrev ? "row" : "row-reverse",
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
    >
      <span style={{ fontSize: 18, lineHeight: 1, color: accentColor }}>
        {isPrev ? "←" : "→"}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 600, color: mutedColor,
        maxWidth: "10ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {name}
      </span>
    </button>
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
