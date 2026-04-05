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
    const textLayerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { canvasRef, startDrawing, draw, stopDrawing, undo, clear, clearHistory, downloadAsImage, getCanvasPoint } =
      useCanvas(penSettings, scrollRef);

    const syncCanvasSize = useCallback(() => {
      const canvas = canvasRef.current;
      const textLayer = textLayerRef.current;
      if (!canvas || !textLayer) return;

      const dpr = window.devicePixelRatio || 1;
      const w = textLayer.offsetWidth;
      const h = textLayer.offsetHeight;
      if (w === 0 || h === 0) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let saved: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        try { saved = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { saved = null; }
      }

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      if (saved && ctx) {
        try { ctx.putImageData(saved, 0, 0); } catch { /* ignore */ }
      }
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
        textLayerRef,
        showText,
        chapter ? `${chapter.name_simple}-${chapter.id}` : "quran"
      ),
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

    const textColor = isDark ? "rgba(238, 228, 205, 0.94)" : "rgba(15, 15, 25, 0.88)";
    const markerColor = isDark ? "rgba(212, 175, 55, 0.75)" : "rgba(26, 82, 118, 0.60)";
    const bismillahColor = isDark ? "rgba(212, 175, 55, 0.90)" : "rgba(26, 82, 118, 0.82)";
    const headerAccent = isDark ? "#d4af37" : "#1a5276";
    const headerBg = isDark ? "rgba(212,175,55,0.10)" : "rgba(26,82,118,0.06)";
    const headerBorder = isDark ? "rgba(212,175,55,0.25)" : "rgba(26,82,118,0.15)";
    const dividerColor = isDark ? "rgba(212,175,55,0.15)" : "rgba(26,82,118,0.10)";

    return (
      <div className="relative w-full h-full" style={{ touchAction: "none" }}>
        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ touchAction: showText ? "pan-y" : "none" }}
        >
          {/* Text layer — centered column with breathing room */}
          <div
            ref={textLayerRef}
            className="relative w-full"
            style={{
              minHeight: "100%",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <div
              className="mx-auto"
              style={{
                maxWidth: 820,
                paddingTop: 56,
                paddingBottom: 80,
                paddingLeft: 48,
                paddingRight: 48,
                opacity: showText ? 1 : 0,
                transition: "opacity 0.25s ease",
              }}
            >
              {chapter && (
                <>
                  {/* Surah header */}
                  <div className="text-center mb-10">
                    <div
                      className="inline-block px-10 py-4 rounded-2xl"
                      style={{ background: headerBg, border: `1px solid ${headerBorder}` }}
                    >
                      <p
                        dir="rtl"
                        style={{
                          fontFamily: '"Amiri Quran", "Scheherazade New", "Amiri", serif',
                          fontSize: "clamp(32px, 4.5vw, 54px)",
                          color: headerAccent,
                          lineHeight: 1.4,
                          margin: 0,
                        }}
                      >
                        {chapter.name_arabic}
                      </p>
                      <p
                        style={{
                          fontSize: "clamp(10px, 1.4vw, 13px)",
                          color: isDark ? "#a0a0c0" : "#7f8c8d",
                          marginTop: 6,
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
                          fontFamily: '"Amiri Quran", "Scheherazade New", "Amiri", serif',
                          fontSize: "clamp(28px, 3.5vw, 46px)",
                          color: bismillahColor,
                          lineHeight: 2.2,
                          textAlign: "center",
                          marginTop: 24,
                          marginBottom: 0,
                        }}
                      >
                        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div
                    style={{
                      height: 1,
                      background: dividerColor,
                      marginBottom: 40,
                      marginLeft: "5%",
                      marginRight: "5%",
                    }}
                  />

                  {/* Verses */}
                  {isMushafCenteredLayout(chapter.id, verses.length) ? (
                    /* ── Mushaf centered layout (Fatihah + Baqarah opening) ── */
                    <div
                      style={{
                        fontFamily: '"Amiri Quran", "Scheherazade New", "Amiri", serif',
                        fontSize: "clamp(26px, 2.8vw, 40px)",
                        color: textColor,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "clamp(10px, 1.8vw, 28px)",
                      }}
                    >
                      {verses.map((v) => {
                        const isCentered = chapter.id === 1 || v.verse_number <= 5;
                        if (!isCentered) {
                          // Remaining Baqarah verses flow normally
                          return null;
                        }
                        return (
                          <div
                            key={v.id}
                            dir="rtl"
                            style={{
                              textAlign: "center",
                              lineHeight: 2.0,
                              width: "100%",
                            }}
                          >
                            <VerseMarker n={v.verse_number} isDark={isDark} />
                            {" "}
                            {v.text_uthmani}
                          </div>
                        );
                      })}

                      {/* Remaining Baqarah verses (6+) in flowing mode */}
                      {chapter.id === 2 && verses.length > 5 && (
                        <div
                          dir="rtl"
                          style={{
                            fontFamily: '"Amiri Quran", "Scheherazade New", "Amiri", serif',
                            fontSize: "clamp(26px, 2.8vw, 40px)",
                            lineHeight: 2.15,
                            color: textColor,
                            textAlign: "justify",
                            textJustify: "inter-word",
                            wordSpacing: "0.05em",
                            width: "100%",
                            marginTop: 16,
                          }}
                        >
                          {verses.filter(v => v.verse_number > 5).map((v) => (
                            <span key={v.id}>
                              {v.text_uthmani}
                              <span
                                style={{
                                  fontFamily: '"Scheherazade New", "Amiri", serif',
                                  fontSize: "0.65em",
                                  color: markerColor,
                                  margin: "0 0.35em",
                                  verticalAlign: "middle",
                                  display: "inline-block",
                                }}
                              >
                                ۝{toArabicNumerals(v.verse_number)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Standard flowing text layout ── */
                    <div
                      dir="rtl"
                      style={{
                        fontFamily: '"Amiri Quran", "Scheherazade New", "Amiri", serif',
                        fontSize: "clamp(26px, 2.8vw, 40px)",
                        lineHeight: 2.15,
                        color: textColor,
                        textAlign: "justify",
                        textJustify: "inter-word",
                        wordSpacing: "0.05em",
                        letterSpacing: "0",
                      }}
                    >
                      {verses.map((v) => (
                        <span key={v.id}>
                          {v.text_uthmani}
                          <span
                            style={{
                              fontFamily: '"Scheherazade New", "Amiri", serif',
                              fontSize: "0.65em",
                              color: markerColor,
                              margin: "0 0.35em",
                              verticalAlign: "middle",
                              display: "inline-block",
                            }}
                          >
                            ۝{toArabicNumerals(v.verse_number)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Drawing canvas — absolutely overlays text layer */}
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

function toArabicNumerals(n: number): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(n).split("").map((d) => arabicDigits[parseInt(d)] ?? d).join("");
}

/** Chapter IDs that get the centered per-verse Mushaf layout */
function isMushafCenteredLayout(chapterId: number, _verseCount: number): boolean {
  return chapterId === 1 || chapterId === 2;
}

/** Ornate verse end marker — styled circle with Arabic numeral */
function VerseMarker({ n, isDark }: { n: number; isDark: boolean }) {
  const outerRing = isDark ? "#d4af37" : "#b5451b";
  const innerFill = isDark ? "rgba(212,175,55,0.12)" : "rgba(181,69,27,0.08)";
  const textColor = isDark ? "#d4af37" : "#8b2500";
  const size = "1.1em";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${outerRing}`,
        background: innerFill,
        color: textColor,
        fontSize: "0.5em",
        fontFamily: '"Amiri Quran", "Scheherazade New", serif',
        fontWeight: 700,
        verticalAlign: "middle",
        margin: "0 0.2em",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {toArabicNumerals(n)}
    </span>
  );
}
