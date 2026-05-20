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

const SAVED_SURAH_KEY = "quran-tracer:lastSurah";

function getSavedSurahId(): number {
  try {
    const raw = localStorage.getItem(SAVED_SURAH_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= 1 && n <= 114) return n;
  } catch { /* ignore */ }
  return 1;
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

  /* Pre-fetch all pages in a range (for continuous scroll) */
  const fetchRange = useCallback((start: number, end: number) => {
    for (let p = start; p <= end; p++) fetchPage(p);
  }, [fetchPage]);

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
    const savedId = getSavedSurahId();
    fetchChapters()
      .then((chs) => {
        setChapters(chs);
        setSelectedChapterId(savedId);
        fetchChapterFirstPage(savedId).then((startPage) => {
          const nextFetch = savedId < 114
            ? fetchChapterFirstPage(savedId + 1).then(ns => Math.max(startPage, ns - 1))
            : Promise.resolve(TOTAL_PAGES);
          nextFetch.then((endPage) => {
            setSurahRange({ start: startPage, end: endPage });
            fetchRange(startPage, endPage);
            setCurrentPage(startPage);
            loadAround(startPage);
          }).catch(() => {
            setSurahRange({ start: startPage, end: startPage });
            fetchRange(startPage, startPage);
            setCurrentPage(startPage);
            loadAround(startPage);
          });
        }).catch(() => {});
      })
      .catch((e) => setError(e.message));

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
    try { localStorage.setItem(SAVED_SURAH_KEY, String(chapter.id)); } catch { /* ignore */ }
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
        /* Pre-fetch every page in the surah for seamless continuous scroll */
        fetchRange(startPage, endPage);
        const p = Math.max(1, Math.min(TOTAL_PAGES, startPage));
        setCurrentPage(p);
        setLoading(!cache.current.has(p));
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [fetchRange]);

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
