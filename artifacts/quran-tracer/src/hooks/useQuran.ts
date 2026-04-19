import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchChapters,
  fetchVersesByPage,
  fetchChapterFirstPage,
  Chapter,
  Verse,
  TOTAL_PAGES,
} from "@/services/quranApi";

export interface SurahRange { start: number; end: number; }

export interface QuranState {
  chapters:          Chapter[];
  currentPage:       number;
  loading:           boolean;
  error:             string | null;
  surahRange:        SurahRange | null;
  selectedChapterId: number | null;
  /** Verses for a given page (returns [] if not yet cached) */
  getVerses:         (page: number) => Verse[];
  goToPage:          (page: number) => void;
  nextPage:          () => void;
  prevPage:          () => void;
  selectChapter:     (chapter: Chapter) => void;
}

export function useQuran(): QuranState {
  const [chapters,          setChapters]          = useState<Chapter[]>([]);
  const [currentPage,       setCurrentPage]       = useState(1);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [surahRange,        setSurahRange]        = useState<SurahRange | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);

  /** Cache: page → Verse[] */
  const cache    = useRef<Map<number, Verse[]>>(new Map());
  const inflight = useRef<Set<number>>(new Set());
  const [cacheVersion, setCacheVersion] = useState(0);

  /* Keep a ref so goToPage can read range without stale closure */
  const surahRangeRef = useRef<SurahRange | null>(null);
  useEffect(() => { surahRangeRef.current = surahRange; }, [surahRange]);

  const clampPage = useCallback((p: number) => {
    p = Math.max(1, Math.min(TOTAL_PAGES, p));
    const r = surahRangeRef.current;
    if (r) p = Math.max(r.start, Math.min(r.end, p));
    return p;
  }, []);

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

  const loadAround = useCallback((page: number) => {
    const p = Math.max(1, Math.min(TOTAL_PAGES, page));
    fetchPage(p);
    if (p > 1)               fetchPage(p - 1);
    if (p < TOTAL_PAGES)     fetchPage(p + 1);
    if (p > 2)               fetchPage(p - 2);
    if (p < TOTAL_PAGES - 1) fetchPage(p + 2);
  }, [fetchPage]);

  /** Bootstrap */
  useEffect(() => {
    fetchChapters()
      .then((chs) => {
        setChapters(chs);
        /* Auto-select surah 1 on first load */
        setSelectedChapterId(1);
        fetchChapterFirstPage(1).then((startPage) => {
          fetchChapterFirstPage(2).then((nextStart) => {
            const endPage = Math.max(startPage, nextStart - 1);
            setSurahRange({ start: startPage, end: endPage });
          }).catch(() => setSurahRange({ start: startPage, end: startPage }));
        }).catch(() => {});
      })
      .catch((e) => setError(e.message));

    loadAround(1);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadAround(currentPage); }, [currentPage, loadAround]);

  useEffect(() => {
    if (cache.current.has(currentPage)) setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheVersion, currentPage]);

  const goToPage = useCallback((page: number) => {
    const p = clampPage(page);
    setCurrentPage(p);
    setLoading(!cache.current.has(p));
  }, [clampPage]);

  const nextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);

  const selectChapter = useCallback((chapter: Chapter) => {
    setLoading(true);
    setSelectedChapterId(chapter.id);
    fetchChapterFirstPage(chapter.id)
      .then(async (startPage) => {
        let endPage = TOTAL_PAGES;
        if (chapter.id < 114) {
          try {
            const nextStart = await fetchChapterFirstPage(chapter.id + 1);
            endPage = Math.max(startPage, nextStart - 1);
          } catch { endPage = startPage; }
        }
        const range = { start: startPage, end: endPage };
        surahRangeRef.current = range;
        setSurahRange(range);
        const p = Math.max(1, Math.min(TOTAL_PAGES, startPage));
        setCurrentPage(p);
        setLoading(!cache.current.has(p));
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const getVerses = useCallback((page: number): Verse[] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    cacheVersion;
    return cache.current.get(Math.max(1, Math.min(TOTAL_PAGES, page))) ?? [];
  }, [cacheVersion]);

  return {
    chapters, currentPage, loading, error, surahRange, selectedChapterId,
    getVerses, goToPage, nextPage, prevPage, selectChapter,
  };
}
