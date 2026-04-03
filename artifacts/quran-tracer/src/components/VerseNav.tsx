import { Verse } from "@/data/verses";

interface VerseNavProps {
  verses: Verse[];
  currentIndex: number;
  onSelect: (index: number) => void;
  isDark: boolean;
}

export function VerseNav({ verses, currentIndex, onSelect, isDark }: VerseNavProps) {
  const current = verses[currentIndex];

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-2xl shadow-lg border ${
        isDark
          ? "bg-[#1a1a2e] border-[#2a2a4e] text-white"
          : "bg-white border-[#e8e3d5] text-[#1a1a2e]"
      }`}
      style={{ width: "clamp(220px, 22vw, 280px)", minWidth: 220 }}
    >
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]"}`}>
          Current Verse
        </p>
        <p className={`text-sm font-bold ${isDark ? "text-[#d4af37]" : "text-[#1a5276]"}`}>
          {current.surahName} {current.surahNumber}:{current.verseNumber}
        </p>
        <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]"}`}>
          {current.translation}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => onSelect(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
            isDark
              ? "bg-[#2a2a4e] text-[#c0c0e0] hover:bg-[#3a3a5e]"
              : "bg-[#f0ece0] text-[#1a1a2e] hover:bg-[#e0dcc0]"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>

        <button
          onClick={() => onSelect(Math.min(verses.length - 1, currentIndex + 1))}
          disabled={currentIndex === verses.length - 1}
          className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
            isDark
              ? "bg-[#2a2a4e] text-[#c0c0e0] hover:bg-[#3a3a5e]"
              : "bg-[#f0ece0] text-[#1a1a2e] hover:bg-[#e0dcc0]"
          }`}
        >
          Next
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]"}`}>
          Select Verse
        </p>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
          {verses.map((v, i) => (
            <button
              key={v.id}
              onClick={() => onSelect(i)}
              className={`text-left px-3 py-2 rounded-lg text-xs transition-all active:scale-98 ${
                i === currentIndex
                  ? isDark
                    ? "bg-[#d4af37] text-[#1a1a2e] font-semibold"
                    : "bg-[#1a5276] text-white font-semibold"
                  : isDark
                  ? "text-[#c0c0e0] hover:bg-[#2a2a4e]"
                  : "text-[#2c3e50] hover:bg-[#f5f0e8]"
              }`}
            >
              <span className="block font-medium">
                {v.surahName} {v.surahNumber}:{v.verseNumber}
              </span>
              <span
                className="block mt-0.5 truncate opacity-70 font-arabic"
                dir="rtl"
                style={{ fontFamily: '"Scheherazade New", "Amiri", serif', fontSize: "1rem" }}
              >
                {v.arabicText.substring(0, 30)}
                {v.arabicText.length > 30 ? "…" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className={`text-xs text-center ${isDark ? "text-[#5a5a7a]" : "text-[#bdc3c7]"}`}>
        {currentIndex + 1} / {verses.length}
      </p>
    </div>
  );
}
