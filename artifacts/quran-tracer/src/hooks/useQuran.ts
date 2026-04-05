import { useState, useEffect, useCallback } from "react";
import {
  fetchChapters,
  fetchVersesByPage,
  fetchChapterFirstPage,
  Chapter,
  Verse,
  TOTAL_PAGES,
} from "@/services/quranApi";

export interface QuranState {
  chapters:       Chapter[];
  verses:         Verse[];
  currentPage:    number;
  loading:        boolean;
  error:          string | null;
  goToPage:       (page: number) => void;
  nextPage:       () => void;
  prevPage:       () => void;
  selectChapter:  (chapter: Chapter) => void;
}

export function useQuran(): QuranState {
  const [chapters,    setChapters]    = useState<Chapter[]>([]);
  const [verses,      setVerses]      = useState<Verse[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  /** Load a specific Mushaf page */
  const loadPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(TOTAL_PAGES, page));
    setCurrentPage(p);
    setLoading(true);
    fetchVersesByPage(p)
      .then((vs) => { setVerses(vs); setLoading(false); })
      .catch((e)  => { setError(e.message); setLoading(false); });
  }, []);

  /** Bootstrap: load chapter list + page 1 */
  useEffect(() => {
    fetchChapters()
      .then((chs) => { setChapters(chs); })
      .catch((e)  => setError(e.message));

    fetchVersesByPage(1)
      .then((vs) => { setVerses(vs); setLoading(false); })
      .catch((e)  => { setError(e.message); setLoading(false); });
  }, []);

  const goToPage = useCallback((page: number) => loadPage(page), [loadPage]);
  const nextPage = useCallback(() => loadPage(currentPage + 1), [loadPage, currentPage]);
  const prevPage = useCallback(() => loadPage(currentPage - 1), [loadPage, currentPage]);

  /** Jump to the first Mushaf page of a chapter */
  const selectChapter = useCallback((chapter: Chapter) => {
    setLoading(true);
    fetchChapterFirstPage(chapter.id)
      .then((page) => loadPage(page))
      .catch((e)   => { setError(e.message); setLoading(false); });
  }, [loadPage]);

  return {
    chapters,
    verses,
    currentPage,
    loading,
    error,
    goToPage,
    nextPage,
    prevPage,
    selectChapter,
  };
}
