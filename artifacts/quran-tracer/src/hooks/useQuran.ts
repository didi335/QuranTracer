import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchChapters,
  fetchVersesByPage,
  fetchChapterFirstPage,
  Chapter,
  Verse,
  TOTAL_PAGES,
} from "@/services/quranApi";

export interface QuranState {
  chapters:      Chapter[];
  currentPage:   number;
  loading:       boolean;
  error:         string | null;
  /** Verses for a given page (returns [] if not yet cached) */
  getVerses:     (page: number) => Verse[];
  goToPage:      (page: number) => void;
  nextPage:      () => void;
  prevPage:      () => void;
  selectChapter: (chapter: Chapter) => void;
}

export function useQuran(): QuranState {
  const [chapters,    setChapters]    = useState<Chapter[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  /** Cache: page → Verse[] */
  const cache = useRef<Map<number, Verse[]>>(new Map());
  /** Track in-flight requests to avoid duplicates */
  const inflight = useRef<Set<number>>(new Set());
  /** Force re-render when cache updates */
  const [cacheVersion, setCacheVersion] = useState(0);

  const fetchPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(TOTAL_PAGES, page));
    if (cache.current.has(p) || inflight.current.has(p)) return;
    inflight.current.add(p);
    fetchVersesByPage(p)
      .then((vs) => {
        cache.current.set(p, vs);
        inflight.current.delete(p);
        setCacheVersion(v => v + 1);
      })
      .catch(() => inflight.current.delete(p));
  }, []);

  /** Fetch current page + neighbours eagerly */
  const loadAround = useCallback((page: number) => {
    const p = Math.max(1, Math.min(TOTAL_PAGES, page));
    fetchPage(p);
    if (p > 1)           fetchPage(p - 1);
    if (p < TOTAL_PAGES) fetchPage(p + 1);
    if (p > 2)           fetchPage(p - 2);
    if (p < TOTAL_PAGES - 1) fetchPage(p + 2);
  }, [fetchPage]);

  /** Bootstrap */
  useEffect(() => {
    fetchChapters()
      .then((chs) => setChapters(chs))
      .catch((e)  => setError(e.message));

    loadAround(1);
    setLoading(false);
  }, [loadAround]);

  useEffect(() => {
    loadAround(currentPage);
  }, [currentPage, loadAround]);

  // Mark loading false once current page is in cache
  useEffect(() => {
    if (cache.current.has(currentPage)) setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheVersion, currentPage]);

  const clamp = (p: number) => Math.max(1, Math.min(TOTAL_PAGES, p));

  const goToPage = useCallback((page: number) => {
    setCurrentPage(clamp(page));
    setLoading(!cache.current.has(clamp(page)));
  }, []);

  const nextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);

  const selectChapter = useCallback((chapter: Chapter) => {
    setLoading(true);
    fetchChapterFirstPage(chapter.id)
      .then((page) => goToPage(page))
      .catch((e)   => { setError(e.message); setLoading(false); });
  }, [goToPage]);

  const getVerses = useCallback((page: number): Verse[] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    cacheVersion; // subscribe to cache updates
    return cache.current.get(Math.max(1, Math.min(TOTAL_PAGES, page))) ?? [];
  }, [cacheVersion]);

  return {
    chapters,
    currentPage,
    loading,
    error,
    getVerses,
    goToPage,
    nextPage,
    prevPage,
    selectChapter,
  };
}
