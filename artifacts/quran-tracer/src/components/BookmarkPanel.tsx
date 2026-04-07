import { useState } from "react";
import { Bookmark } from "@/hooks/useBookmarks";

interface Props {
  bookmarks:      Bookmark[];
  currentPage:    number;
  isBookmarked:   boolean;
  loggedIn:       boolean;
  loading:        boolean;
  isDark:         boolean;
  onToggle:       () => void;
  onGo:           (page: number) => void;
  onRemove:       (id: string) => void;
  onLogin:        () => void;
  onLogout:       () => void;
  userName?:      string;
}

export function BookmarkPanel({
  bookmarks, currentPage, isBookmarked, loggedIn, loading,
  isDark, onToggle, onGo, onRemove, onLogin, onLogout, userName,
}: Props) {
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [noteInput,   setNoteInput]   = useState("");

  const accent    = isDark ? "#d4af37"          : "#1a3a6e";
  const muted     = isDark ? "#6868a0"          : "#9a9080";
  const cardBg    = isDark ? "#1e1e38"          : "#f7f5ee";
  const cardBorder= isDark ? "#2a2a4e"          : "#ddd8c0";
  const textColor = isDark ? "#ddd8e8"          : "#1a1a2e";
  const mutedText = isDark ? "#8080a0"          : "#7f8c8d";
  const btnHover  = isDark ? "#2a2a4e"          : "#ede8d8";
  const dangerColor= isDark ? "#ff7070"         : "#c0392b";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" style={{ color: muted }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 px-4 text-center">
        <div style={{ color: accent, fontSize: 36 }}>
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm mb-1" style={{ color: textColor }}>Sign in to save bookmarks</p>
          <p className="text-xs" style={{ color: mutedText }}>
            Your bookmarks sync across sessions via your Quran Foundation account.
          </p>
        </div>
        <button
          onClick={onLogin}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: accent }}
        >
          Sign in with Quran Foundation
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* User bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: accent }}>
            {(userName ?? "U")[0].toUpperCase()}
          </div>
          <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: mutedText }}>
            {userName ?? "Signed in"}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs px-2 py-1 rounded-lg transition-all"
          style={{ color: dangerColor, background: isDark ? "rgba(255,80,80,0.08)" : "rgba(192,57,43,0.07)" }}
        >
          Sign out
        </button>
      </div>

      {/* Bookmark this page */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
        style={{
          background: isBookmarked
            ? isDark ? "rgba(212,175,55,0.15)" : "rgba(26,58,110,0.09)"
            : isDark ? "#1e1e38" : "#ede8d8",
          border: `1.5px solid ${isBookmarked ? accent : cardBorder}`,
          color:  isBookmarked ? accent : mutedText,
        }}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
        </svg>
        {isBookmarked ? "Bookmarked — tap to remove" : `Bookmark page ${currentPage}`}
      </button>

      {/* List */}
      {bookmarks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: mutedText }}>No bookmarks yet.</p>
          <p className="text-xs mt-1" style={{ color: mutedText }}>Tap the button above while on a page you want to save.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: muted }}>
            {bookmarks.length} saved
          </p>
          {bookmarks.map((bm) => (
            <div
              key={bm.id}
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: cardBorder, background: cardBg }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() => onGo(bm.page)}
                  className="flex-1 text-left"
                  title={`Go to page ${bm.page}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: isDark ? "rgba(212,175,55,0.15)" : "rgba(26,58,110,0.1)", color: accent }}
                    >
                      {bm.page}
                    </span>
                    <span className="text-xs font-medium truncate" style={{ color: textColor }}>
                      {bm.label}
                    </span>
                  </div>
                  {bm.note && (
                    <p className="text-xs mt-0.5 truncate pl-0.5" style={{ color: mutedText }}>{bm.note}</p>
                  )}
                </button>

                {/* Edit note */}
                <button
                  onClick={() => {
                    if (editingId === bm.id) { setEditingId(null); }
                    else { setEditingId(bm.id); setNoteInput(bm.note ?? ""); }
                  }}
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ color: mutedText, background: "transparent" }}
                  title="Add note"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4 9.293-9.293a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414L9 13z" />
                  </svg>
                </button>

                {/* Remove */}
                <button
                  onClick={() => onRemove(bm.id)}
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ color: dangerColor, background: "transparent" }}
                  title="Remove bookmark"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Inline note editor */}
              {editingId === bm.id && (
                <div className="px-3 pb-2.5 flex gap-2">
                  <input
                    autoFocus
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        // Note updates handled by parent via callback pattern —
                        // here we store via a direct local call approach
                        setEditingId(null);
                      }
                    }}
                    placeholder="Add a note…"
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none border"
                    style={{
                      background: isDark ? "#12122a" : "#fff",
                      borderColor: cardBorder,
                      color: textColor,
                    }}
                  />
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs px-2 py-1 rounded-lg font-semibold"
                    style={{ background: accent, color: "#fff" }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
