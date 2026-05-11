import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchUserBookmarks,
  createUserBookmark,
  deleteUserBookmark,
  QFBookmark,
} from "@/services/quranApi";

export interface Bookmark {
  id:       string;
  remoteId: number | null; // Quran Foundation API id
  page:     number;
  label:    string;
  note?:    string;
  savedAt:  number;
}

const STORAGE_KEY = "qf_bookmarks";

function load(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

function qfToLocal(bm: QFBookmark): Bookmark {
  return {
    id:       `qf-${bm.id}`,
    remoteId: bm.id,
    page:     bm.key,
    label:    `Page ${bm.key}`,
    savedAt:  new Date(bm.created_at).getTime(),
  };
}

export type SyncState = "idle" | "syncing" | "error";

export function useBookmarks(currentPage: number, accessToken: string | null) {
  const [bookmarks,  setBookmarks]  = useState<Bookmark[]>([]);
  const [syncState,  setSyncState]  = useState<SyncState>("idle");

  const tokenRef = useRef(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  /* ── Load: local first, then merge from API ── */
  useEffect(() => {
    const local = load();
    setBookmarks(local);

    if (!accessToken) return;

    setSyncState("syncing");
    fetchUserBookmarks(accessToken)
      .then((remote) => {
        const remoteAsBm = remote.map(qfToLocal);
        // Merge: remote is source of truth; keep local-only entries too
        const localOnly = local.filter(
          l => l.remoteId === null && !remoteAsBm.some(r => r.page === l.page)
        );
        const merged = [...remoteAsBm, ...localOnly];
        setBookmarks(merged);
        persist(merged);
        setSyncState("idle");
      })
      .catch(() => setSyncState("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const save = useCallback((next: Bookmark[]) => {
    setBookmarks(next);
    persist(next);
  }, []);

  const isBookmarked = bookmarks.some(b => b.page === currentPage);

  const toggleBookmark = useCallback(async (surahName?: string) => {
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) {
      // Optimistic remove
      save(bookmarks.filter(b => b.page !== currentPage));
      if (tokenRef.current && existing.remoteId !== null) {
        try { await deleteUserBookmark(tokenRef.current, existing.remoteId); }
        catch { /* silently keep local removal */ }
      }
    } else {
      const localBm: Bookmark = {
        id:       crypto.randomUUID?.() ?? `${Date.now()}`,
        remoteId: null,
        page:     currentPage,
        label:    surahName ?? `Page ${currentPage}`,
        savedAt:  Date.now(),
      };
      save([localBm, ...bookmarks]);

      if (tokenRef.current) {
        try {
          const created = await createUserBookmark(tokenRef.current, currentPage);
          setBookmarks(prev => {
            const next = prev.map(b =>
              b.page === currentPage && b.remoteId === null
                ? { ...b, id: `qf-${created.id}`, remoteId: created.id }
                : b
            );
            persist(next);
            return next;
          });
        } catch { /* keep local-only */ }
      }
    }
  }, [bookmarks, currentPage, save]);

  const removeBookmark = useCallback(async (id: string) => {
    const bm = bookmarks.find(b => b.id === id);
    save(bookmarks.filter(b => b.id !== id));
    if (tokenRef.current && bm?.remoteId !== null && bm?.remoteId !== undefined) {
      try { await deleteUserBookmark(tokenRef.current, bm.remoteId); }
      catch { /* local removal still applied */ }
    }
  }, [bookmarks, save]);

  const updateNote = useCallback((id: string, note: string) => {
    save(bookmarks.map(b => b.id === id ? { ...b, note } : b));
  }, [bookmarks, save]);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, updateNote, syncState };
}
