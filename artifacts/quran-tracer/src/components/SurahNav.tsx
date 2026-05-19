import { useState } from "react";
import { Chapter } from "@/services/quranApi";

interface SurahNavProps {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  onSelectChapter: (chapter: Chapter) => void;
  loading: boolean;
  isDark: boolean;
  compact?: boolean;
}

export function SurahNav({
  chapters,
  currentChapter,
  onSelectChapter,
  loading,
  isDark,
  compact,
}: SurahNavProps) {
  const [search, setSearch] = useState("");

  const safeChapters = chapters ?? [];

  const filtered = safeChapters.filter(
    (c) =>
      c.name_simple.toLowerCase().includes(search.toLowerCase()) ||
      c.name_arabic.includes(search) ||
      c.translated_name.name.toLowerCase().includes(search.toLowerCase()) ||
      String(c.id).startsWith(search)
  );

  const mutedText = isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]";
  const goldText = isDark ? "text-[#d4af37]" : "text-[#1a5276]";
  const activeBg = isDark ? "bg-[#d4af37] text-[#1a1a2e]" : "bg-[#1a5276] text-white";
  const rowHover = isDark ? "text-[#c0c0e0] hover:bg-[#2a2a4e]" : "text-[#2c3e50] hover:bg-[#f5f0e8]";

  const inner = (
    <div className="flex flex-col gap-3 w-full">
      {currentChapter && (
        <div className="pb-3 border-b" style={{ borderColor: isDark ? "#2a2a4e" : "#e8e3d5" }}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${mutedText}`}>Current</p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${goldText}`}>
                {currentChapter.id}. {currentChapter.name_simple}
              </p>
              <p className={`text-xs mt-0.5 ${mutedText}`}>
                {currentChapter.translated_name.name} · {currentChapter.verses_count} ayahs ·{" "}
                <span className="capitalize">{currentChapter.revelation_place}</span>
              </p>
            </div>
            <p
              dir="rtl"
              className="flex-shrink-0 leading-none"
              style={{ fontFamily: '"Amiri Quran", "Scheherazade New", "Amiri", serif', fontSize: "1.5rem", color: isDark ? "#d4af37" : "#1a5276" }}
            >
              {currentChapter.name_arabic}
            </p>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Search by name or number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`w-full px-3 py-2 rounded-xl text-xs outline-none border ${
          isDark
            ? "bg-[#2a2a4e] border-[#3a3a5e] text-white placeholder:text-[#5a5a7a]"
            : "bg-[#f8f5ee] border-[#e0dcd0] text-[#1a1a2e] placeholder:text-[#b0aaa0]"
        }`}
      />

      {loading && safeChapters.length === 0 ? (
        <div className={`flex items-center justify-center py-8 gap-2 ${mutedText} text-xs`}>
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading Quran...
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 overflow-y-auto pr-0.5 flex-1">
          {filtered.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelectChapter(ch)}
              className={`text-left px-3 py-2 rounded-lg text-xs transition-all active:scale-[0.98] ${
                currentChapter?.id === ch.id ? activeBg : rowHover
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{ch.id}. {ch.name_simple}</span>
                <span dir="rtl" style={{ fontFamily: '"Amiri Quran", "Scheherazade New", "Amiri", serif', fontSize: "1rem", flexShrink: 0 }}>
                  {ch.name_arabic}
                </span>
              </div>
              <span className={`text-xs ${currentChapter?.id === ch.id ? "opacity-70" : mutedText}`}>
                {ch.translated_name.name} · {ch.verses_count} ayahs
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (compact) return inner;

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-2xl shadow-lg border h-full ${
        isDark ? "bg-[#1a1a2e] border-[#2a2a4e] text-white" : "bg-white border-[#e8e3d5] text-[#1a1a2e]"
      }`}
      style={{ width: "clamp(240px, 24vw, 300px)", minWidth: 240 }}
    >
      {inner}
    </div>
  );
}
