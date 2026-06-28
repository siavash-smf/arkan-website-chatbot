import "server-only";

/**
 * قطعه‌بندی متن برای پایپ‌لاین RAG.
 * تخمین توکن سبک (بدون کتابخانه‌ی سنگین). برای فارسی، هر توکن تقریباً ~۳.۵ نویسه.
 * قطعه‌بندی روی مرز پاراگراف/جمله انجام می‌شود تا معنا حفظ شود.
 */

const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export type Chunk = {
  content: string;
  index: number;
  tokenCount: number;
};

/** متن را به قطعه‌هایی با اندازه‌ی هدفِ توکن و overlap تقسیم می‌کند. */
export function splitText(
  raw: string,
  chunkSizeTokens = 500,
  overlapTokens = 50
): Chunk[] {
  const text = cleanText(raw);
  if (!text) return [];

  const maxChars = Math.max(200, Math.floor(chunkSizeTokens * CHARS_PER_TOKEN));
  const overlapChars = Math.max(0, Math.floor(overlapTokens * CHARS_PER_TOKEN));

  // واحدهای معنایی: ابتدا بر اساس پاراگراف، سپس جمله
  const units = splitIntoUnits(text);

  const chunks: Chunk[] = [];
  let buffer = "";

  const flush = () => {
    const content = buffer.trim();
    if (content) {
      chunks.push({
        content,
        index: chunks.length,
        tokenCount: estimateTokens(content),
      });
    }
  };

  for (const unit of units) {
    if (buffer.length + unit.length + 1 > maxChars && buffer.length > 0) {
      flush();
      // شروع قطعه‌ی بعدی با overlap از انتهای قطعه‌ی قبلی
      buffer = overlapChars > 0 ? buffer.slice(-overlapChars) + " " : "";
    }
    // اگر خود یک واحد از maxChars بزرگ‌تر بود، آن را به‌اجبار تکه‌تکه کن
    if (unit.length > maxChars) {
      if (buffer.trim()) flush();
      buffer = "";
      for (let i = 0; i < unit.length; i += maxChars - overlapChars) {
        const piece = unit.slice(i, i + maxChars);
        chunks.push({
          content: piece.trim(),
          index: chunks.length,
          tokenCount: estimateTokens(piece),
        });
      }
      continue;
    }
    buffer += (buffer ? " " : "") + unit;
  }
  flush();

  return chunks;
}

function splitIntoUnits(text: string): string[] {
  // ابتدا پاراگراف‌ها، بعد جمله‌ها (نقطه/علامت‌های فارسی و لاتین)
  const paragraphs = text.split(/\n{2,}/);
  const units: string[] = [];
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const sentences = trimmed.split(/(?<=[.!?؟،؛\n])\s+/).filter(Boolean);
    for (const s of sentences) units.push(s.trim());
  }
  return units;
}

export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
