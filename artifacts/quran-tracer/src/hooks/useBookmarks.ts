import { useState, useEffect, useCallback } from "react";
import { Chapter } from "@/services/quranApi";

export interface Bookmark {
  id:         string;    // uuid
  page:       number;
  label:      string;    // e.g. "Al-Fatihah · Page 1"
  note?:      string;
  savedAt:    number;    // epoch ms
}

const KEY_PREFIX = "qf_bookmarks_";

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function load(userId: string): Bookmark[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(userId: string, bookmarks: Bookmark[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(bookmarks));
}

function makeId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useBookmarks(userId: string | null, chapters: Chapter[], currentPage: number) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Load from localStorage when user changes
  useEffect(() => {
    if (!userId) { setBookmarks([]); return; }
    setBookmarks(load(userId));
  }, [userId]);

  const persist = useCallback((next: Bookmark[]) => {
    if (!userId) return;
    setBookmarks(next);
    save(userId, next);
  }, [userId]);

  // Derive label: "Surah · Page N"
  function makeLabel(page: number): string {
    return `Page ${page}`;
  }

  const isBookmarked = bookmarks.some(b => b.page === currentPage);

  const toggleBookmark = useCallback(() => {
    if (!userId) return;
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) {
      persist(bookmarks.filter(b => b.page !== currentPage));
    } else {
      const bm: Bookmark = {
        id:      makeId(),
        page:    currentPage,
        label:   makeLabel(currentPage),
        savedAt: Date.now(),
      };
      persist([bm, ...bookmarks]);
    }
  }, [userId, bookmarks, currentPage, persist]);

  const removeBookmark = useCallback((id: string) => {
    persist(bookmarks.filter(b => b.id !== id));
  }, [bookmarks, persist]);

  const updateNote = useCallback((id: string, note: string) => {
    persist(bookmarks.map(b => b.id === id ? { ...b, note } : b));
  }, [bookmarks, persist]);

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    updateNote,
  };
}
