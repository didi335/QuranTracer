/**
 * QPC v2 page-font loader.
 *
 * The quran.com API returns each word as a `code_v2` glyph code from the
 * Private Use Area. Those codes only render as proper Arabic when the
 * matching Madani-Mushaf page font is loaded — there is one woff2 file
 * per page (604 total). Without the correct font, browsers fall back to
 * a generic Arabic font and the page looks like random isolated letters.
 *
 * This helper lazily injects an `@font-face` rule for any page that gets
 * rendered. Fonts are served from the public quran.com CDN and cached
 * forever after first use. We name each face `p<NNN>` so callers can
 * just set `fontFamily: 'p<page_number>'` on the relevant span.
 */
const loaded = new Set<number>();
const FONT_BASE = "https://static.qurancdn.com/fonts/quran/hafs/v2";

export function ensurePageFont(pageNumber: number): void {
  if (!pageNumber || loaded.has(pageNumber)) return;
  loaded.add(pageNumber);
  const style = document.createElement("style");
  style.setAttribute("data-qpc-page", String(pageNumber));
  style.textContent = `
    @font-face {
      font-family: 'p${pageNumber}';
      src: url('${FONT_BASE}/p${pageNumber}.woff2') format('woff2');
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

export function pageFontFamily(pageNumber: number): string {
  return `'p${pageNumber}', "Amiri Quran", "Scheherazade New", "Amiri", serif`;
}
