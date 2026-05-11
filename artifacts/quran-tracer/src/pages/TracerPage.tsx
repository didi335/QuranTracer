import { useState, useRef, useCallback, useEffect } from "react";
import { SurahDisplay, SurahDisplayHandle } from "@/components/SurahDisplay";
import { Toolbar } from "@/components/Toolbar";
import { SurahNav } from "@/components/SurahNav";
import { BookmarkPanel } from "@/components/BookmarkPanel";
import { PenSettings } from "@/hooks/useCanvas";
import { useQuran } from "@/hooks/useQuran";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useAudio, formatTime } from "@/hooks/useAudio";
import { useAuth } from "@/hooks/useAuth";
import { TOTAL_PAGES, AVAILABLE_RECITERS } from "@/services/quranApi";

const PANEL_WIDTH = 288;

type LeftTab = "surahs" | "bookmarks";

export default function TracerPage() {
  const [isDark,           setIsDark]           = useState(false);
  const [showText,         setShowText]         = useState(true);
  const [showAudioPanel,   setShowAudioPanel]   = useState(false);
  const [leftOpen,         setLeftOpen]         = useState(false);
  const [leftTab,     setLeftTab]     = useState<LeftTab>("surahs");
  const [rightOpen,   setRightOpen]   = useState(false);
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#1a1a2e", thickness: 5, opacity: 0.90, mode: "pen",
  });

  const displayRef = useRef<SurahDisplayHandle>(null);
  const quran      = useQuran();
  const auth       = useAuth();

  const {
    bookmarks, isBookmarked, toggleBookmark, removeBookmark, updateNote, syncState,
  } = useBookmarks(quran.currentPage, auth.tokenSet?.access_token ?? null);

  const audio = useAudio();

  const currentChapterForNav = (() => {
    const verses = quran.getVerses(quran.currentPage);
    const cid = verses[0]?.chapter_id ?? null;
    return cid ? (quran.chapters.find(c => c.id === cid) ?? null) : null;
  })();

  /* The chapter to play audio for */
  const audioChapterId = quran.selectedChapterId ?? currentChapterForNav?.id ?? null;

  /* Auto-show player panel when audio becomes active */
  useEffect(() => {
    const { state } = audio.status;
    if (state === "playing" || state === "loading") setShowAudioPanel(true);
  }, [audio.status.state]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Auto-switch audio when the surah changes and audio is active */
  const prevAudioChapterRef = useRef<number | null>(null);
  useEffect(() => {
    if (audioChapterId === null) return;
    if (audioChapterId === prevAudioChapterRef.current) return;
    prevAudioChapterRef.current = audioChapterId;
    const { state } = audio.status;
    if (state === "playing" || state === "loading" || state === "paused") {
      audio.playChapter(audioChapterId);
    }
  }, [audioChapterId, audio]);

  const handleAudioToggle = useCallback(() => {
    const { state } = audio.status;
    if (state === "playing") {
      audio.pause();
    } else if (state === "paused" && audio.status.chapterId === audioChapterId) {
      audio.resume();
    } else if (audioChapterId) {
      audio.playChapter(audioChapterId);
    }
  }, [audio, audioChapterId]);

  const closeAll = useCallback(() => { setLeftOpen(false); setRightOpen(false); }, []);

  const openLeft = useCallback((tab: LeftTab) => {
    setLeftTab(tab);
    setLeftOpen(true);
    setRightOpen(false);
  }, []);

  const bg        = isDark ? "bg-[#0d0d1a]"                  : "bg-[#f0ebe0]";
  const panelBg   = isDark ? "bg-[#14142a] border-[#2a2a4e]" : "bg-[#fdfcf7] border-[#ddd8c0]";
  const stripBg   = isDark ? "bg-[#1a1a2e] border-[#2a2a4e]" : "bg-white border-[#e0dbd0]";
  const iconColor = isDark ? "#a0a0c0"                        : "#7f8c8d";
  const accent    = isDark ? "#d4af37"                        : "#1a3a6e";

  return (
    <div className={`flex h-screen w-screen overflow-hidden select-none ${bg}`}>

      {/* ── LEFT PANEL ── */}
      <div className="relative flex-shrink-0 flex" style={{ zIndex: 20 }}>
        <div
          className={`flex flex-col items-center gap-4 py-4 border-r transition-all duration-200 ${stripBg} ${leftOpen ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100 w-12"}`}
        >
          <StripBtn
            title="Surah Browser"
            active={leftOpen && leftTab === "surahs"}
            accent={accent}
            iconColor={iconColor}
            onClick={() => leftOpen && leftTab === "surahs" ? setLeftOpen(false) : openLeft("surahs")}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            }
          />
          <StripBtn
            title="Bookmarks"
            active={leftOpen && leftTab === "bookmarks"}
            accent={accent}
            iconColor={iconColor}
            onClick={() => leftOpen && leftTab === "bookmarks" ? setLeftOpen(false) : openLeft("bookmarks")}
            badge={bookmarks.length > 0 ? bookmarks.length : undefined}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
            }
          />
        </div>

        <div
          className={`absolute top-0 left-0 h-full flex flex-col border-r shadow-xl overflow-hidden transition-all duration-300 ease-out ${panelBg}`}
          style={{ width: leftOpen ? PANEL_WIDTH : 0, opacity: leftOpen ? 1 : 0, pointerEvents: leftOpen ? "auto" : "none" }}
        >
          <div className="flex-shrink-0 border-b" style={{ borderColor: isDark ? "#2a2a4e" : "#e0dbd0" }}>
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex gap-0.5">
                {(["surahs", "bookmarks"] as LeftTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLeftTab(tab)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={{
                      background: leftTab === tab ? accent : "transparent",
                      color:      leftTab === tab ? "#fff" : iconColor,
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setLeftOpen(false)}
                className="rounded-lg p-1.5"
                style={{ background: isDark ? "#2a2a4e" : "#f0ece0" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3" style={{ width: PANEL_WIDTH }}>
            {leftTab === "surahs" ? (
              <SurahNav
                chapters={quran.chapters}
                currentChapter={currentChapterForNav}
                onSelectChapter={(ch) => { quran.selectChapter(ch); setLeftOpen(false); }}
                loading={quran.loading}
                isDark={isDark}
                compact
              />
            ) : (
              <BookmarkPanel
                bookmarks={bookmarks}
                currentPage={quran.currentPage}
                isBookmarked={isBookmarked}
                isDark={isDark}
                syncState={syncState}
                loggedIn={auth.loggedIn}
                authLoading={auth.loading}
                userName={auth.tokenSet?.user?.name ?? auth.tokenSet?.user?.email ?? null}
                onToggle={toggleBookmark}
                onGo={(page) => { quran.goToPage(page); setLeftOpen(false); }}
                onRemove={removeBookmark}
                onUpdateNote={updateNote}
                onLogin={auth.login}
                onLogout={auth.logout}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <main className="flex-1 min-w-0 p-3 relative" onClick={() => { if (leftOpen || rightOpen) closeAll(); }}>
        <div
          className={`w-full h-full rounded-2xl overflow-hidden border shadow-inner ${isDark ? "bg-[#12122a] border-[#2a2a4e]" : "bg-[#fefdf8] border-[#d8d3c0]"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <SurahDisplay
            ref={displayRef}
            chapters={quran.chapters}
            getVerses={quran.getVerses}
            currentPage={quran.currentPage}
            showText={showText}
            penSettings={penSettings}
            isDark={isDark}
            onPageChange={quran.goToPage}
            onSelectSurah={quran.selectChapter}
            surahRange={quran.surahRange}
            selectedChapterId={quran.selectedChapterId}
          />
        </div>

        {/* Floating action bar */}
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-full shadow-md border pointer-events-auto"
          style={{
            background:   isDark ? "rgba(20,20,42,0.92)" : "rgba(255,253,248,0.92)",
            borderColor:  isDark ? "#2a2a4e" : "#d8d3c0",
            backdropFilter: "blur(8px)", zIndex: 15,
          }}
        >
          {/* Show/hide text */}
          <button
            onClick={() => setShowText(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: showText ? accent : "transparent", color: showText ? "#fff" : iconColor }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {showText
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              }
            </svg>
            {showText ? "Hide" : "Show"} text
          </button>

          <Sep isDark={isDark} />

          {/* Undo */}
          <ActionBtn onClick={() => displayRef.current?.undo()} title="Undo" color={iconColor}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </ActionBtn>
          {/* Clear */}
          <ActionBtn onClick={() => displayRef.current?.clear()} title="Clear canvas" color={isDark ? "#ff9999" : "#c0392b"}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </ActionBtn>
          {/* Save */}
          <ActionBtn onClick={() => displayRef.current?.download()} title="Save as image" color={isDark ? "#90ee90" : "#1b7a3e"}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </ActionBtn>

          <Sep isDark={isDark} />

          {/* Bookmark */}
          <ActionBtn
            onClick={toggleBookmark}
            title={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
            color={isBookmarked ? accent : iconColor}
          >
            <path
              strokeLinecap="round" strokeLinejoin="round"
              fill={isBookmarked ? "currentColor" : "none"}
              d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z"
            />
          </ActionBtn>

          <Sep isDark={isDark} />

          {/* Audio — toggles panel; play lives inside the panel */}
          <ActionBtn
            onClick={() => setShowAudioPanel(v => !v)}
            title={showAudioPanel ? "Hide audio player" : "Open audio player"}
            color={showAudioPanel || audio.status.state === "playing" ? accent : iconColor}
          >
            {audio.status.state === "loading" ? (
              <circle cx="12" cy="12" r="9" strokeDasharray="4 2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite", transformOrigin: "center" }} />
            ) : audio.status.state === "playing" ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            )}
          </ActionBtn>

          <Sep isDark={isDark} />

          {/* Dark mode */}
          <ActionBtn onClick={() => setIsDark(v => !v)} title={isDark ? "Light mode" : "Dark mode"} color={iconColor}>
            {isDark
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            }
          </ActionBtn>
        </div>

        {/* ── Floating Audio Player ── */}
        {showAudioPanel && (
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-auto"
            style={{ top: "4.2rem", zIndex: 15, minWidth: 340, maxWidth: 520 }}
          >
            <div
              className="flex flex-col gap-2 px-4 py-3 rounded-2xl shadow-lg border"
              style={{
                background:     isDark ? "rgba(20,20,42,0.96)" : "rgba(255,253,248,0.96)",
                borderColor:    isDark ? "#2a2a4e" : "#d8d3c0",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Top row: reciter + stop */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Animated waveform */}
                  <div className="flex items-end gap-[2px]" style={{ height: 14 }}>
                    {[0.4, 0.9, 0.6, 1.0, 0.5].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          width: 3, borderRadius: 2,
                          background: accent,
                          height: `${h * 100}%`,
                          animation: audio.status.state === "playing"
                            ? `audioBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`
                            : "none",
                          opacity: audio.status.state === "playing" ? 1 : 0.35,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium truncate" style={{ color: accent }}>
                    {audio.status.reciterName}
                  </span>
                </div>
                {/* Reciter selector */}
                <select
                  value={audio.status.reciterId}
                  onChange={e => audio.setReciter(Number(e.target.value))}
                  className="text-xs rounded-lg px-2 py-1 border outline-none"
                  style={{
                    background:  isDark ? "#1a1a2e" : "#f4f0e6",
                    color:       iconColor,
                    borderColor: isDark ? "#2a2a4e" : "#d8d3c0",
                    fontSize:    11,
                  }}
                >
                  {AVAILABLE_RECITERS.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {/* Play / Pause inside panel */}
                <button
                  onClick={handleAudioToggle}
                  title={audio.status.state === "playing" ? "Pause" : "Play"}
                  disabled={!audioChapterId || audio.status.state === "loading"}
                  className="p-1 rounded-full opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
                  style={{ color: accent }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    {audio.status.state === "loading" ? (
                      <circle cx="12" cy="12" r="9" strokeDasharray="4 2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite", transformOrigin: "center" }} />
                    ) : audio.status.state === "playing" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                    )}
                  </svg>
                </button>
              </div>

              {/* Progress row */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono tabular-nums" style={{ color: iconColor, minWidth: 32 }}>
                  {formatTime(audio.status.currentTime)}
                </span>
                <div
                  className="flex-1 h-1.5 rounded-full cursor-pointer relative"
                  style={{ background: isDark ? "#2a2a4e" : "#ddd8c8" }}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct  = (e.clientX - rect.left) / rect.width;
                    audio.seek(pct * audio.status.duration);
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: audio.status.duration
                        ? `${(audio.status.currentTime / audio.status.duration) * 100}%`
                        : "0%",
                      background: accent,
                    }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums" style={{ color: iconColor, minWidth: 32, textAlign: "right" }}>
                  {formatTime(audio.status.duration)}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT PANEL: Pen settings ── */}
      <div className="relative flex-shrink-0 flex" style={{ zIndex: 20 }}>
        <div
          className={`absolute top-0 right-0 h-full flex flex-col border-l shadow-xl overflow-hidden transition-all duration-300 ease-out ${panelBg}`}
          style={{ width: rightOpen ? PANEL_WIDTH : 0, opacity: rightOpen ? 1 : 0, pointerEvents: rightOpen ? "auto" : "none" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: isDark ? "#2a2a4e" : "#e0dbd0" }}>
            <span className="text-sm font-bold" style={{ color: accent }}>Pen Settings</span>
            <button onClick={() => setRightOpen(false)} className="rounded-lg p-1.5" style={{ background: isDark ? "#2a2a4e" : "#f0ece0" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3" style={{ width: PANEL_WIDTH }}>
            <Toolbar
              penSettings={penSettings}
              onPenChange={(s) => setPenSettings(p => ({ ...p, ...s }))}
              showText={showText}
              onToggleText={() => setShowText(v => !v)}
              onUndo={() => displayRef.current?.undo()}
              onClear={() => displayRef.current?.clear()}
              onDownload={() => displayRef.current?.download()}
              isDark={isDark}
              onToggleDark={() => setIsDark(v => !v)}
              compact
            />
          </div>
        </div>
        {/* Slim strip */}
        <div
          className={`flex flex-col items-center gap-4 py-4 border-l cursor-pointer transition-all duration-200 ${stripBg} ${rightOpen ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100 w-12"}`}
          onClick={() => { setRightOpen(true); setLeftOpen(false); }}
          title="Pen Settings"
        >
          <div style={{ color: accent }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </div>
          <div className="w-4 h-4 rounded-full border-2" style={{ backgroundColor: penSettings.color, borderColor: isDark ? "#3a3a5e" : "#d0ccc0" }} />
          <span style={{ color: iconColor, writingMode: "vertical-rl", fontSize: 9, letterSpacing: "0.15em", fontWeight: 600, textTransform: "uppercase" }}>
            Pen
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Tiny shared components ─────────────────────────────────── */
function Sep({ isDark }: { isDark: boolean }) {
  return <div style={{ width: 1, height: 20, background: isDark ? "#2a2a4e" : "#d8d3c0", flexShrink: 0 }} />;
}

function StripBtn({
  title, active, accent, iconColor, onClick, icon, badge,
}: {
  title: string; active: boolean; accent: string; iconColor: string;
  onClick: () => void; icon: React.ReactNode; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-all"
      style={{ background: active ? accent : "transparent", color: active ? "#fff" : accent }}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{icon}</svg>
      {badge !== undefined && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center"
          style={{ fontSize: 8, fontWeight: 700, background: accent }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

function ActionBtn({
  onClick, title, color, children, disabled,
}: {
  onClick: () => void; title: string; color: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="p-1.5 rounded-full transition-all hover:opacity-70 disabled:opacity-25"
      style={{ color }}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {children}
      </svg>
    </button>
  );
}
