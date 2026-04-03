import { useState, useEffect, useCallback } from "react";
import { fetchChapters, fetchVerses, Chapter, Verse } from "@/services/quranApi";

export interface QuranState {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  verses: Verse[];
  currentVerse: Verse | null;
  currentVerseIndex: number;
  loading: boolean;
  error: string | null;
  selectChapter: (chapter: Chapter) => void;
  selectVerse: (index: number) => void;
  nextVerse: () => void;
  prevVerse: () => void;
}

export function useQuran(): QuranState {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchChapters()
      .then((chs) => {
        setChapters(chs);
        const fatiha = chs[0];
        setCurrentChapter(fatiha);
        return fetchVerses(fatiha.id);
      })
      .then((vs) => {
        setVerses(vs);
        setCurrentVerseIndex(0);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const selectChapter = useCallback((chapter: Chapter) => {
    setCurrentChapter(chapter);
    setCurrentVerseIndex(0);
    setLoading(true);
    setVerses([]);
    fetchVerses(chapter.id)
      .then((vs) => {
        setVerses(vs);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const selectVerse = useCallback((index: number) => {
    setCurrentVerseIndex(index);
  }, []);

  const nextVerse = useCallback(() => {
    setCurrentVerseIndex((i) => Math.min(i + 1, verses.length - 1));
  }, [verses.length]);

  const prevVerse = useCallback(() => {
    setCurrentVerseIndex((i) => Math.max(i - 1, 0));
  }, []);

  return {
    chapters,
    currentChapter,
    verses,
    currentVerse: verses[currentVerseIndex] ?? null,
    currentVerseIndex,
    loading,
    error,
    selectChapter,
    selectVerse,
    nextVerse,
    prevVerse,
  };
}
