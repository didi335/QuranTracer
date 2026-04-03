import { useState, useRef, useEffect } from "react";
import { Chapter, Verse } from "@/services/quranApi";

interface VerseNavProps {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  verses: Verse[];
  currentVerseIndex: number;
  loading: boolean;
  onSelectChapter: (chapter: Chapter) => void;
  onSelectVerse: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isDark: boolean;
}

export function VerseNav({
  chapters,
  currentChapter,
  verses,
  currentVerseIndex,
  loading,
  onSelectChapter,
  onSelectVerse,
  onPrev,
  onNext,
  isDark,
}: VerseNavProps) {
  const [view, setView] = useState<"chapter" | "verse">("verse");
  const [chapterSearch, setChapterSearch] = useState("");
  const verseListRef = useRef<HTMLDivElement>(null);
  const currentVerse = verses[currentVerseIndex];

  const filteredChapters = chapters.filter(
    (c) =>
      c.name_simple.toLowerCase().includes(chapterSearch.toLowerCase()) ||
      c.name_arabic.includes(chapterSearch) ||
      String(c.id).includes(chapterSearch) ||
      c.translated_name.name.toLowerCase().includes(chapterSearch.toLowerCase())
  );

  useEffect(() => {
    if (view === "verse" && verseListRef.current) {
      const el = verseListRef.current.querySelector(`[data-index="${currentVerseIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [currentVerseIndex, view]);

  const panelBg = isDark ? "bg-[#1a1a2e] border-[#2a2a4e] text-white" : "bg-white border-[#e8e3d5] text-[#1a1a2e]";
  const mutedText = isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]";
  const btnBase = isDark ? "bg-[#2a2a4e] text-[#c0c0e0] hover:bg-[#3a3a5e]" : "bg-[#f0ece0] text-[#1a1a2e] hover:bg-[#e0dcc0]";
  const activeBg = isDark ? "bg-[#d4af37] text-[#1a1a2e] font-semibold" : "bg-[#1a5276] text-white font-semibold";
  const goldText = isDark ? "text-[#d4af37]" : "text-[#1a5276]";

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-2xl shadow-lg border ${panelBg}`}
      style={{ width: "clamp(240px, 24vw, 300px)", minWidth: 240 }}
    >
      {currentChapter && (
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${mutedText}`}>
            Current
          </p>
          <p className={`text-sm font-bold ${goldText}`}>
            {currentChapter.name_simple} ({currentChapter.id})
          </p>
          <p className={`text-xs font-arabic mt-0.5`} dir="rtl"
            style={{ fontFamily: '"Scheherazade New", "Amiri", serif', fontSize: "1.1rem" }}>
            {currentChapter.name_arabic}
          </p>
          {currentVerse && (
            <p className={`text-xs mt-1 ${mutedText}`}>
              Verse {currentVerse.verse_number} of {currentChapter.verses_count}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDark ? "#12122a" : "#f0ece0" }}>
        <button
          onClick={() => setView("chapter")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            view === "chapter" ? activeBg : `${mutedText} hover:opacity-80`
          }`}
        >
          Surahs
        </button>
        <button
          onClick={() => setView("verse")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            view === "verse" ? activeBg : `${mutedText} hover:opacity-80`
          }`}
        >
          Verses
        </button>
      </div>

      {view === "chapter" && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Search surah..."
            value={chapterSearch}
            onChange={(e) => setChapterSearch(e.target.value)}
            className={`w-full px-3 py-2 rounded-xl text-xs outline-none border ${
              isDark
                ? "bg-[#2a2a4e] border-[#3a3a5e] text-white placeholder:text-[#5a5a7a]"
                : "bg-[#f8f5ee] border-[#e0dcd0] text-[#1a1a2e] placeholder:text-[#b0aaa0]"
            }`}
          />
          <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto pr-0.5">
            {filteredChapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => {
                  onSelectChapter(ch);
                  setView("verse");
                  setChapterSearch("");
                }}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                  currentChapter?.id === ch.id ? activeBg : `${isDark ? "text-[#c0c0e0] hover:bg-[#2a2a4e]" : "text-[#2c3e50] hover:bg-[#f5f0e8]"}`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {ch.id}. {ch.name_simple}
                  </span>
                  <span
                    dir="rtl"
                    style={{ fontFamily: '"Scheherazade New", "Amiri", serif', fontSize: "0.95rem" }}
                  >
                    {ch.name_arabic}
                  </span>
                </div>
                <span className={`text-xs opacity-60`}>{ch.translated_name.name} · {ch.verses_count} verses</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "verse" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onPrev}
              disabled={currentVerseIndex === 0 || loading}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${btnBase}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <button
              onClick={onNext}
              disabled={currentVerseIndex === verses.length - 1 || loading}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${btnBase}`}
            >
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className={`flex items-center justify-center py-8 ${mutedText}`}>
              <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : (
            <div ref={verseListRef} className="flex flex-col gap-0.5 max-h-72 overflow-y-auto pr-0.5">
              {verses.map((v, i) => (
                <button
                  key={v.id}
                  data-index={i}
                  onClick={() => onSelectVerse(i)}
                  className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                    i === currentVerseIndex ? activeBg : `${isDark ? "text-[#c0c0e0] hover:bg-[#2a2a4e]" : "text-[#2c3e50] hover:bg-[#f5f0e8]"}`
                  }`}
                >
                  <span className="block font-medium mb-0.5">Verse {v.verse_number}</span>
                  <span
                    className="block opacity-80 leading-relaxed"
                    dir="rtl"
                    style={{ fontFamily: '"Scheherazade New", "Amiri", serif', fontSize: "0.95rem" }}
                  >
                    {v.text_uthmani.length > 60 ? v.text_uthmani.substring(0, 60) + "…" : v.text_uthmani}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && verses.length > 0 && (
            <p className={`text-xs text-center ${mutedText}`}>
              {currentVerseIndex + 1} / {verses.length}
            </p>
          )}
        </>
      )}
    </div>
  );
}
