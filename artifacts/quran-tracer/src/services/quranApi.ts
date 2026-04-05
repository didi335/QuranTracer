const BASE_URL = "https://api.quran.com/api/v4";

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
  verse_key: string;
  text_uthmani: string;
  page_number: number;
  translations?: { text: string }[];
}

export interface Translation {
  resource_name: string;
  text: string;
}

let _chaptersCache: Chapter[] | null = null;
const _versesCache = new Map<string, Verse[]>();

export async function fetchChapters(): Promise<Chapter[]> {
  if (_chaptersCache) return _chaptersCache;
  const res = await fetch(`${BASE_URL}/chapters?language=en`);
  if (!res.ok) throw new Error(`Failed to fetch chapters: ${res.status}`);
  const data = await res.json();
  _chaptersCache = data.chapters as Chapter[];
  return _chaptersCache;
}

export async function fetchVerses(chapterId: number): Promise<Verse[]> {
  const key = String(chapterId);
  if (_versesCache.has(key)) return _versesCache.get(key)!;

  const params = new URLSearchParams({
    language: "en",
    fields: "text_uthmani,page_number",
    translations: "131",
    per_page: "300",
    page: "1",
  });

  const res = await fetch(`${BASE_URL}/verses/by_chapter/${chapterId}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch verses: ${res.status}`);
  const data = await res.json();
  const verses = data.verses as Verse[];
  _versesCache.set(key, verses);
  return verses;
}

export function getVerseKey(chapterId: number, verseNumber: number) {
  return `${chapterId}:${verseNumber}`;
}
