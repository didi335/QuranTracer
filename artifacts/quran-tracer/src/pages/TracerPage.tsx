import { useState, useRef, useCallback } from "react";
import { SurahDisplay, SurahDisplayHandle } from "@/components/SurahDisplay";
import { Toolbar } from "@/components/Toolbar";
import { SurahNav } from "@/components/SurahNav";
import { PenSettings } from "@/hooks/useCanvas";
import { useQuran } from "@/hooks/useQuran";

const PANEL_WIDTH = 280;

export default function TracerPage() {
  const [isDark, setIsDark] = useState(false);
  const [showText, setShowText] = useState(true);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#1a1a2e",
    thickness: 5,
    opacity: 0.90,
  });

  const displayRef = useRef<SurahDisplayHandle>(null);
  const quran = useQuran();

  const closeAll = useCallback(() => {
    setLeftOpen(false);
    setRightOpen(false);
  }, []);

  const bg = isDark ? "bg-[#0d0d1a]" : "bg-[#f0ebe0]";
  const panelBg = isDark ? "bg-[#14142a] border-[#2a2a4e]" : "bg-[#fdfcf7] border-[#ddd8c0]";
  const stripBg = isDark ? "bg-[#1a1a2e] border-[#2a2a4e]" : "bg-white border-[#e0dbd0]";
  const iconColor = isDark ? "#a0a0c0" : "#7f8c8d";
  const accentColor = isDark ? "#d4af37" : "#1a5276";

  return (
    <div className={`flex h-screen w-screen overflow-hidden select-none ${bg}`}>

      {/* ── LEFT PANEL: Surah browser ────────────────────────── */}
      <div className="relative flex-shrink-0 flex" style={{ zIndex: 20 }}>
        {/* Collapsed strip */}
        <div
          className={`flex flex-col items-center gap-4 py-4 border-r cursor-pointer transition-opacity duration-200 ${stripBg} ${leftOpen ? "opacity-0 pointer-events-none w-0" : "opacity-100 w-12"}`}
          onClick={() => { setLeftOpen(true); setRightOpen(false); }}
          title="Open Surah Browser"
        >
          <div style={{ color: accentColor }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          {/* Rotated label */}
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{
              color: iconColor,
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: 9,
              letterSpacing: "0.15em",
            }}
          >
            Surahs
          </span>
          {quran.currentChapter && (
            <span
              className="text-xs font-bold text-center"
              style={{ color: accentColor, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 9 }}
            >
              {quran.currentChapter.id}
            </span>
          )}
        </div>

        {/* Expanded panel */}
        <div
          className={`absolute top-0 left-0 h-full flex flex-col border-r shadow-xl overflow-hidden transition-all duration-300 ease-out ${panelBg}`}
          style={{
            width: leftOpen ? PANEL_WIDTH : 0,
            opacity: leftOpen ? 1 : 0,
            pointerEvents: leftOpen ? "auto" : "none",
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: isDark ? "#2a2a4e" : "#e0dbd0" }}
          >
            <span className="text-sm font-bold" style={{ color: accentColor }}>Surah Browser</span>
            <button
              onClick={() => setLeftOpen(false)}
              className="rounded-lg p-1.5 transition-colors"
              style={{ background: isDark ? "#2a2a4e" : "#f0ece0" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3" style={{ width: PANEL_WIDTH }}>
            <SurahNav
              chapters={quran.chapters}
              currentChapter={quran.currentChapter}
              onSelectChapter={(ch) => { quran.selectChapter(ch); setLeftOpen(false); }}
              loading={quran.loading}
              isDark={isDark}
              compact
            />
          </div>
        </div>
      </div>

      {/* ── MAIN TRACING AREA ───────────────────────────────── */}
      <main className="flex-1 min-w-0 p-3 relative" onClick={() => { if (leftOpen || rightOpen) closeAll(); }}>
        <div
          className={`w-full h-full rounded-2xl overflow-hidden border shadow-inner ${
            isDark ? "bg-[#12122a] border-[#2a2a4e]" : "bg-[#fefdf8] border-[#d8d3c0]"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {quran.loading && quran.chapters.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className={`text-center ${isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]"}`}>
                <svg className="animate-spin w-8 h-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-medium">Loading Quran…</p>
              </div>
            </div>
          ) : quran.error ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className={`text-center p-6 rounded-xl mx-6 ${isDark ? "bg-[#2a1a1a] text-[#ff9999]" : "bg-[#fdecea] text-[#c0392b]"}`}>
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

        {/* Floating action strip — center top */}
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-full shadow-md border pointer-events-auto"
          style={{
            background: isDark ? "rgba(20,20,42,0.92)" : "rgba(255,253,248,0.92)",
            borderColor: isDark ? "#2a2a4e" : "#d8d3c0",
            backdropFilter: "blur(8px)",
            zIndex: 15,
          }}
        >
          <button
            onClick={() => setShowText((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: showText ? accentColor : "transparent",
              color: showText ? "#fff" : iconColor,
            }}
            title={showText ? "Hide text" : "Show text"}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {showText
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              }
            </svg>
            {showText ? "Hide" : "Show"} text
          </button>

          <div style={{ width: 1, height: 20, background: isDark ? "#2a2a4e" : "#d8d3c0" }} />

          <button
            onClick={() => displayRef.current?.undo()}
            className="p-1.5 rounded-full transition-all hover:opacity-70"
            style={{ color: iconColor }}
            title="Undo"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>

          <button
            onClick={() => displayRef.current?.clear()}
            className="p-1.5 rounded-full transition-all hover:opacity-70"
            style={{ color: isDark ? "#ff9999" : "#c0392b" }}
            title="Clear"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <button
            onClick={() => displayRef.current?.download()}
            className="p-1.5 rounded-full transition-all hover:opacity-70"
            style={{ color: isDark ? "#90ee90" : "#1b7a3e" }}
            title="Save image"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <div style={{ width: 1, height: 20, background: isDark ? "#2a2a4e" : "#d8d3c0" }} />

          <button
            onClick={() => setIsDark((v) => !v)}
            className="p-1.5 rounded-full transition-all hover:opacity-70"
            style={{ color: iconColor }}
            title={isDark ? "Light mode" : "Dark mode"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isDark
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              }
            </svg>
          </button>
        </div>
      </main>

      {/* ── RIGHT PANEL: Pen settings ────────────────────────── */}
      <div className="relative flex-shrink-0 flex" style={{ zIndex: 20 }}>
        {/* Expanded panel */}
        <div
          className={`absolute top-0 right-0 h-full flex flex-col border-l shadow-xl overflow-hidden transition-all duration-300 ease-out ${panelBg}`}
          style={{
            width: rightOpen ? PANEL_WIDTH : 0,
            opacity: rightOpen ? 1 : 0,
            pointerEvents: rightOpen ? "auto" : "none",
            right: 0,
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: isDark ? "#2a2a4e" : "#e0dbd0" }}
          >
            <span className="text-sm font-bold" style={{ color: accentColor }}>Pen Settings</span>
            <button
              onClick={() => setRightOpen(false)}
              className="rounded-lg p-1.5 transition-colors"
              style={{ background: isDark ? "#2a2a4e" : "#f0ece0" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3" style={{ width: PANEL_WIDTH }}>
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
              compact
            />
          </div>
        </div>

        {/* Collapsed strip */}
        <div
          className={`flex flex-col items-center gap-4 py-4 border-l cursor-pointer transition-opacity duration-200 ${stripBg} ${rightOpen ? "opacity-0 pointer-events-none w-0" : "opacity-100 w-12"}`}
          onClick={() => { setRightOpen(true); setLeftOpen(false); }}
          title="Open Pen Settings"
        >
          <div style={{ color: accentColor }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </div>
          {/* Pen color preview dot */}
          <div
            className="w-4 h-4 rounded-full border-2"
            style={{
              backgroundColor: penSettings.color,
              borderColor: isDark ? "#3a3a5e" : "#d0ccc0",
            }}
          />
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{
              color: iconColor,
              writingMode: "vertical-rl",
              fontSize: 9,
              letterSpacing: "0.15em",
            }}
          >
            Pen
          </span>
        </div>
      </div>

    </div>
  );
}
