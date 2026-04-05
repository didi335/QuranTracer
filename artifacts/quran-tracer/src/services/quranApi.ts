const BASE_URL = "https://api.quran.com/api/v4";

export const TOTAL_PAGES = 604;

export interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  translated_name: { name: string };
  revelation_place: string;
  bismillah_pre: boolean;
}

export interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;          // e.g. "2:5"
  chapter_id: number;         // extracted from verse_key
  text_uthmani: string;
  page_number: number;
  translations?: { text: string }[];
}

let _chaptersCache: Chapter[] | null = null;
const _pageCache    = new Map<number, Verse[]>();
const _chapterFirstPage = new Map<number, number>(); // chapterId → first page

export async function fetchChapters(): Promise<Chapter[]> {
  if (_chaptersCache) return _chaptersCache;
  const res = await fetch(`${BASE_URL}/chapters?language=en`);
  if (!res.ok) throw new Error(`Failed to fetch chapters: ${res.status}`);
  const data = await res.json();
  _chaptersCache = data.chapters as Chapter[];
  return _chaptersCache;
}

export async function fetchVersesByPage(pageNumber: number): Promise<Verse[]> {
  if (_pageCache.has(pageNumber)) return _pageCache.get(pageNumber)!;

  const params = new URLSearchParams({
    fields:   "text_uthmani,page_number,verse_key",
    per_page: "50",
  });
  const res = await fetch(`${BASE_URL}/verses/by_page/${pageNumber}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch page ${pageNumber}: ${res.status}`);
  const data  = await res.json();
  const verses = (data.verses as Array<Record<string, unknown>>).map((v) => {
    const verse_key = String(v.verse_key ?? "");
    const chapter_id = parseInt(verse_key.split(":")[0], 10) || 0;
    return {
      id:           v.id as number,
      verse_number: v.verse_number as number,
      verse_key,
      chapter_id,
      text_uthmani: v.text_uthmani as string,
      page_number:  v.page_number as number,
    } satisfies Verse;
  });

  _pageCache.set(pageNumber, verses);

  // Cache the first-page for each chapter seen on this page
  const firstChapterId = verses[0]?.chapter_id;
  if (firstChapterId && !_chapterFirstPage.has(firstChapterId)) {
    // Walk back: if first verse of this chapter is also on this page, record it
    const firstChapterVerseOnPage = verses.find(v => v.chapter_id === firstChapterId);
    if (firstChapterVerseOnPage?.verse_number === 1) {
      _chapterFirstPage.set(firstChapterId, pageNumber);
    }
  }

  return verses;
}

/** Get the Mushaf page a chapter starts on. Fetches chapter verse 1 if not cached. */
export async function fetchChapterFirstPage(chapterId: number): Promise<number> {
  if (_chapterFirstPage.has(chapterId)) return _chapterFirstPage.get(chapterId)!;

  const params = new URLSearchParams({
    fields:   "page_number",
    per_page: "1",
    page:     "1",
  });
  const res = await fetch(`${BASE_URL}/verses/by_chapter/${chapterId}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch chapter ${chapterId} first page`);
  const data = await res.json();
  const pageNum = data.verses?.[0]?.page_number as number ?? 1;
  _chapterFirstPage.set(chapterId, pageNum);
  return pageNum;
}

export function getVerseKey(chapterId: number, verseNumber: number) {
  return `${chapterId}:${verseNumber}`;
}
