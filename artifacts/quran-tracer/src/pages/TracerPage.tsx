import { useState, useCallback, useRef } from "react";
import { TracingCanvas } from "@/components/TracingCanvas";
import { Toolbar } from "@/components/Toolbar";
import { VerseNav } from "@/components/VerseNav";
import { PenSettings } from "@/hooks/useCanvas";
import { useQuran } from "@/hooks/useQuran";

export default function TracerPage() {
  const [isDark, setIsDark] = useState(false);
  const [showText, setShowText] = useState(true);
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#1a1a2e",
    thickness: 6,
    opacity: 0.85,
  });

  const canvasHandlers = useRef<{
    undo: () => void;
    clear: () => void;
    download: () => void;
  } | null>(null);

  const quran = useQuran();

  const handleCanvasReady = useCallback(
    (handlers: { undo: () => void; clear: () => void; download: () => void }) => {
      canvasHandlers.current = handlers;
    },
    []
  );

  const handlePenChange = useCallback((settings: Partial<PenSettings>) => {
    setPenSettings((prev) => ({ ...prev, ...settings }));
  }, []);

  const verseName = quran.currentChapter && quran.currentVerse
    ? `${quran.currentChapter.name_simple}-${quran.currentVerse.verse_key}`
    : "quran";

  const arabicText = quran.currentVerse?.text_uthmani ?? "";

  const translationText = quran.currentVerse?.translations?.[0]?.text ?? "";

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden select-none ${
        isDark ? "bg-[#0d0d1a]" : "bg-[#f8f4ec]"
      }`}
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <aside className="flex-shrink-0 p-3 flex flex-col gap-3 overflow-y-auto">
        <Toolbar
          penSettings={penSettings}
          onPenChange={handlePenChange}
          showText={showText}
          onToggleText={() => setShowText((v) => !v)}
          onUndo={() => canvasHandlers.current?.undo()}
          onClear={() => canvasHandlers.current?.clear()}
          onDownload={() => canvasHandlers.current?.download()}
          isDark={isDark}
          onToggleDark={() => setIsDark((v) => !v)}
        />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 p-3">
        <div
          className={`flex-1 rounded-2xl shadow-inner overflow-hidden border relative ${
            isDark ? "bg-[#12122a] border-[#2a2a4e]" : "bg-[#fdfcf7] border-[#ddd8c0]"
          }`}
        >
          {quran.loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className={`text-sm ${isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]"}`}>
                <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading Quran...
              </div>
            </div>
          )}

          {quran.error && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className={`text-center text-sm p-6 rounded-xl ${isDark ? "text-[#ff9999] bg-[#2a1a1a]" : "text-[#c0392b] bg-[#fdecea]"}`}>
                <p className="font-semibold mb-1">Failed to load Quran</p>
                <p className="text-xs opacity-80">{quran.error}</p>
              </div>
            </div>
          )}

          {!showText && arabicText && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              style={{ opacity: 0.05 }}
            >
              <span
                dir="rtl"
                style={{
                  fontFamily: '"Scheherazade New", "Amiri", serif',
                  fontSize: "min(5vw, 72px)",
                  color: isDark ? "#ffffff" : "#000000",
                  textAlign: "center",
                  padding: "0 5%",
                }}
              >
                {arabicText}
              </span>
            </div>
          )}

          <TracingCanvas
            penSettings={penSettings}
            showText={showText}
            arabicText={arabicText}
            onCanvasReady={handleCanvasReady}
            verseName={verseName}
          />
        </div>

        <div
          className={`mt-2 px-4 py-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 text-sm ${
            isDark ? "text-[#6a6a8a]" : "text-[#b0aaa0]"
          }`}
        >
          {arabicText && (
            <span
              dir="rtl"
              style={{ fontFamily: '"Scheherazade New", "Amiri", serif', fontSize: "1.15rem", color: isDark ? "#8a8ab0" : "#8a8478" }}
            >
              {arabicText.length > 80 ? arabicText.substring(0, 80) + "…" : arabicText}
            </span>
          )}
          {translationText && (
            <>
              <span className="hidden sm:block opacity-40">|</span>
              <span className="hidden sm:block italic text-xs opacity-80 max-w-xs text-center truncate">
                {translationText.replace(/<[^>]*>/g, "").substring(0, 100)}
              </span>
            </>
          )}
        </div>
      </main>

      <aside className="flex-shrink-0 p-3 flex flex-col gap-3 overflow-y-auto">
        <VerseNav
          chapters={quran.chapters}
          currentChapter={quran.currentChapter}
          verses={quran.verses}
          currentVerseIndex={quran.currentVerseIndex}
          loading={quran.loading}
          onSelectChapter={quran.selectChapter}
          onSelectVerse={quran.selectVerse}
          onPrev={quran.prevVerse}
          onNext={quran.nextVerse}
          isDark={isDark}
        />
      </aside>
    </div>
  );
}
