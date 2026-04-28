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

export interface Word {
  id:             number;
  position:       number;
  code_v2:        string;  // character code for QPC v2 page font
  text_uthmani:   string;
  char_type_name: "word" | "end" | "pause" | string;
  page_number:    number;
  line_number:    number;
}

export interface Verse {
  id:           number;
  verse_number: number;
  verse_key:    string;    // e.g. "2:5"
  chapter_id:   number;   // extracted from verse_key
  text_uthmani: string;
  page_number:  number;
  words:        Word[];
}

let _chaptersCache: Chapter[] | null = null;
const _pageCache         = new Map<number, Verse[]>();
const _chapterFirstPage  = new Map<number, number>();

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
    words:       "true",
    word_fields: "code_v2,text_uthmani,line_number,page_number,char_type_name",
    fields:      "text_uthmani,page_number,verse_key",
    per_page:    "50",
  });
  const res = await fetch(`${BASE_URL}/verses/by_page/${pageNumber}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch page ${pageNumber}: ${res.status}`);
  const data = await res.json();

  const verses = (data.verses as Array<Record<string, unknown>>).map((v) => {
    const verse_key  = String(v.verse_key ?? "");
    const chapter_id = parseInt(verse_key.split(":")[0], 10) || 0;
    const rawWords   = (v.words as Array<Record<string, unknown>>) ?? [];
    const words: Word[] = rawWords.map((w) => ({
      id:             w.id as number,
      position:       w.position as number,
      code_v2:        String(w.code_v2 ?? ""),
      text_uthmani:   String(w.text_uthmani ?? ""),
      char_type_name: String(w.char_type_name ?? "word"),
      page_number:    (w.page_number as number) ?? pageNumber,
      line_number:    (w.line_number as number) ?? 0,
    }));
    return {
      id:           v.id as number,
      verse_number: v.verse_number as number,
      verse_key,
      chapter_id,
      text_uthmani: v.text_uthmani as string,
      page_number:  v.page_number as number,
      words,
    } satisfies Verse;
  });

  _pageCache.set(pageNumber, verses);

  // Cache first page for each chapter encountered
  verses.forEach((v) => {
    if (v.verse_number === 1 && !_chapterFirstPage.has(v.chapter_id)) {
      _chapterFirstPage.set(v.chapter_id, v.page_number);
    }
  });

  return verses;
}

/* ── Audio API (Quran Foundation Content API) ───────────────── */
export interface ChapterAudio {
  chapterId:  number;
  audioUrl:   string;
  reciterId:  number;
  reciterName: string;
}

const RECITERS: Record<number, string> = {
  2:  "Abdul Basit (Murattal)",
  3:  "Abdur-Rahman as-Sudais",
  4:  "Abu Bakr al-Shatri",
  7:  "Mishari Rashid al-Afasy",
  12: "Mahmoud Khalil Al-Husary",
};

const _audioCache = new Map<string, ChapterAudio>();

export const AVAILABLE_RECITERS = Object.entries(RECITERS).map(
  ([id, name]) => ({ id: Number(id), name })
);

export async function fetchChapterAudio(
  chapterId: number,
  reciterId: number = 7,
): Promise<ChapterAudio> {
  const key = `${reciterId}:${chapterId}`;
  if (_audioCache.has(key)) return _audioCache.get(key)!;

  const res = await fetch(
    `${BASE_URL}/chapter_recitations/${reciterId}/${chapterId}`
  );
  if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
  const data = await res.json();
  const result: ChapterAudio = {
    chapterId,
    audioUrl:    data.audio_file.audio_url as string,
    reciterId,
    reciterName: RECITERS[reciterId] ?? "Unknown",
  };
  _audioCache.set(key, result);
  return result;
}

export async function fetchChapterFirstPage(chapterId: number): Promise<number> {
  if (_chapterFirstPage.has(chapterId)) return _chapterFirstPage.get(chapterId)!;

  const params = new URLSearchParams({
    fields:   "page_number",
    per_page: "1",
    page:     "1",
  });
  const res = await fetch(`${BASE_URL}/verses/by_chapter/${chapterId}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch chapter ${chapterId} first page`);
  const data   = await res.json();
  const pageNum = (data.verses?.[0]?.page_number as number) ?? 1;
  _chapterFirstPage.set(chapterId, pageNum);
  return pageNum;
}
