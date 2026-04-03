import { useState, useRef } from "react";
import { SurahDisplay, SurahDisplayHandle } from "@/components/SurahDisplay";
import { Toolbar } from "@/components/Toolbar";
import { SurahNav } from "@/components/SurahNav";
import { PenSettings } from "@/hooks/useCanvas";
import { useQuran } from "@/hooks/useQuran";

export default function TracerPage() {
  const [isDark, setIsDark] = useState(false);
  const [showText, setShowText] = useState(true);
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#1a1a2e",
    thickness: 5,
    opacity: 0.90,
  });

  const displayRef = useRef<SurahDisplayHandle>(null);
  const quran = useQuran();

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden select-none ${
        isDark ? "bg-[#0d0d1a]" : "bg-[#f8f4ec]"
      }`}
    >
      {/* Left panel — pen settings */}
      <aside className="flex-shrink-0 p-3 overflow-y-auto">
        <Toolbar
          penSettings={penSettings}
          onPenChange={(s) => setPenSettings((p) => ({ ...p, ...s }))}
          showText={showText}
          onToggleText={() => setShowText((v) => !v)}
          onUndo={() => displayRef.current?.undo()}
          onClear={() => displayRef.current?.clear()}
          onDownload={() => displayRef.current?.download()}
          isDark={isDark}
          onToggleDark={() => setIsDark((v) => !v)}
        />
      </aside>

      {/* Main canvas area */}
      <main className="flex-1 min-w-0 p-3">
        <div
          className={`w-full h-full rounded-2xl overflow-hidden border shadow-inner ${
            isDark
              ? "bg-[#12122a] border-[#2a2a4e]"
              : "bg-[#fdfcf7] border-[#ddd8c0]"
          }`}
        >
          {quran.loading && (quran.chapters.length === 0 || quran.verses.length === 0) ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className={`text-center ${isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]"}`}>
                <svg className="animate-spin w-8 h-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-medium">Loading Quran...</p>
              </div>
            </div>
          ) : quran.error ? (
            <div className="w-full h-full flex items-center justify-center">
              <div
                className={`text-center p-6 rounded-xl mx-6 ${
                  isDark ? "bg-[#2a1a1a] text-[#ff9999]" : "bg-[#fdecea] text-[#c0392b]"
                }`}
              >
                <p className="font-semibold mb-1">Failed to load Quran data</p>
                <p className="text-xs opacity-80">{quran.error}</p>
              </div>
            </div>
          ) : (
            <SurahDisplay
              ref={displayRef}
              chapter={quran.currentChapter}
              verses={quran.verses}
              showText={showText}
              penSettings={penSettings}
              isDark={isDark}
            />
          )}
        </div>
      </main>

      {/* Right panel — surah browser */}
      <aside className="flex-shrink-0 p-3 overflow-y-auto">
        <SurahNav
          chapters={quran.chapters}
          currentChapter={quran.currentChapter}
          onSelectChapter={quran.selectChapter}
          loading={quran.loading}
          isDark={isDark}
        />
      </aside>
    </div>
  );
}
