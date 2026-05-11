import { useState } from "react";
import { Bookmark, SyncState } from "@/hooks/useBookmarks";

interface Props {
  bookmarks:    Bookmark[];
  currentPage:  number;
  isBookmarked: boolean;
  isDark:       boolean;
  syncState:    SyncState;
  loggedIn:     boolean;
  authLoading:  boolean;
  userName:     string | null;
  onToggle:     () => void;
  onGo:         (page: number) => void;
  onRemove:     (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onLogin:      () => void;
  onLogout:     () => void;
}

export function BookmarkPanel({
  bookmarks, currentPage, isBookmarked, isDark, syncState,
  loggedIn, authLoading, userName,
  onToggle, onGo, onRemove, onUpdateNote, onLogin, onLogout,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const accent      = isDark ? "#d4af37" : "#1a3a6e";
  const muted       = isDark ? "#6868a0" : "#9a9080";
  const cardBg      = isDark ? "#1e1e38" : "#f7f5ee";
  const cardBorder  = isDark ? "#2a2a4e" : "#ddd8c0";
  const textColor   = isDark ? "#ddd8e8" : "#1a1a2e";
  const mutedText   = isDark ? "#8080a0" : "#7f8c8d";
  const dangerColor = isDark ? "#ff7070" : "#c0392b";
  const syncColor   = syncState === "error" ? dangerColor : muted;

  const hasOAuth = !!(import.meta.env.VITE_QURAN_OAUTH_CLIENT_ID);

  return (
    <div className="flex flex-col gap-3">



      {/* List */}
      {bookmarks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: mutedText }}>No bookmarks yet.</p>
          <p className="text-xs mt-1" style={{ color: mutedText }}>
            Tap the button above to save any page.
          </p>
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
                      className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: isDark ? "rgba(212,175,55,0.15)" : "rgba(26,58,110,0.1)", color: accent }}
                    >
                      p.{bm.page}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold truncate block" style={{ color: textColor }}>
                        {bm.label}
                      </span>
                    </div>
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
                  style={{ color: mutedText }}
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
                  style={{ color: dangerColor }}
                  title="Remove"
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
                      if (e.key === "Enter") { onUpdateNote(bm.id, noteInput); setEditingId(null); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    placeholder="Add a note…"
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none border"
                    style={{ background: isDark ? "#12122a" : "#fff", borderColor: cardBorder, color: textColor }}
                  />
                  <button
                    onClick={() => { onUpdateNote(bm.id, noteInput); setEditingId(null); }}
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
