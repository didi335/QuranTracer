import { useState, useEffect, useCallback } from "react";

export interface Bookmark {
  id:      string;
  page:    number;
  label:   string;
  note?:   string;
  savedAt: number;
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

export function useBookmarks(currentPage: number) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => { setBookmarks(load()); }, []);

  const save = useCallback((next: Bookmark[]) => {
    setBookmarks(next);
    persist(next);
  }, []);

  const isBookmarked = bookmarks.some(b => b.page === currentPage);

  const toggleBookmark = useCallback(() => {
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) {
      save(bookmarks.filter(b => b.page !== currentPage));
    } else {
      const bm: Bookmark = {
        id:      crypto.randomUUID?.() ?? `${Date.now()}`,
        page:    currentPage,
        label:   `Page ${currentPage}`,
        savedAt: Date.now(),
      };
      save([bm, ...bookmarks]);
    }
  }, [bookmarks, currentPage, save]);

  const removeBookmark = useCallback((id: string) => {
    save(bookmarks.filter(b => b.id !== id));
  }, [bookmarks, save]);

  const updateNote = useCallback((id: string, note: string) => {
    save(bookmarks.map(b => b.id === id ? { ...b, note } : b));
  }, [bookmarks, save]);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, updateNote };
}
