import { useState, useCallback, useRef } from "react";
import { TracingCanvas } from "@/components/TracingCanvas";
import { Toolbar } from "@/components/Toolbar";
import { VerseNav } from "@/components/VerseNav";
import { PenSettings } from "@/hooks/useCanvas";
import { VERSES } from "@/data/verses";

export default function TracerPage() {
  const [isDark, setIsDark] = useState(false);
  const [showText, setShowText] = useState(true);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
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

  const handleCanvasReady = useCallback(
    (handlers: { undo: () => void; clear: () => void; download: () => void }) => {
      canvasHandlers.current = handlers;
    },
    []
  );

  const handlePenChange = useCallback((settings: Partial<PenSettings>) => {
    setPenSettings((prev) => ({ ...prev, ...settings }));
  }, []);

  const currentVerse = VERSES[currentVerseIndex];

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
          {!showText && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              style={{ opacity: 0.07 }}
            >
              <span
                dir="rtl"
                style={{
                  fontFamily: '"Scheherazade New", "Amiri", serif',
                  fontSize: "min(6vw, 80px)",
                  color: isDark ? "#ffffff" : "#000000",
                }}
              >
                {currentVerse.arabicText}
              </span>
            </div>
          )}

          <TracingCanvas
            penSettings={penSettings}
            showText={showText}
            arabicText={currentVerse.arabicText}
            onCanvasReady={handleCanvasReady}
            verseName={`${currentVerse.surahName}-${currentVerse.surahNumber}-${currentVerse.verseNumber}`}
          />
        </div>

        <div
          className={`mt-2 px-4 py-2 rounded-xl flex items-center justify-center gap-4 text-sm ${
            isDark ? "text-[#6a6a8a]" : "text-[#b0aaa0]"
          }`}
        >
          <span className="font-arabic" dir="rtl" style={{ fontFamily: '"Scheherazade New", "Amiri", serif', fontSize: "1.1rem" }}>
            {currentVerse.arabicText}
          </span>
          <span className="hidden sm:block">|</span>
          <span className="hidden sm:block italic">{currentVerse.transliteration}</span>
        </div>
      </main>

      <aside className="flex-shrink-0 p-3 flex flex-col gap-3 overflow-y-auto">
        <VerseNav
          verses={VERSES}
          currentIndex={currentVerseIndex}
          onSelect={setCurrentVerseIndex}
          isDark={isDark}
        />
      </aside>
    </div>
  );
}
