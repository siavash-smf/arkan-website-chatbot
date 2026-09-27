/**
 * تبدیل قرارداد به بلوک‌های صفحه‌ی A4.
 * متن قرارداد در آرکان Markdown است (قابل ویرایش و بازنویسی با AI)؛ اینجا یک
 * خواننده‌ی کوچک Markdown فقط همان چیزهایی را که قالب قرارداد لازم دارد می‌فهمد:
 * تیتر (##)، پاراگراف، فهرست گلوله‌ای/شماره‌دار و نقل‌قول (>).
 */

export type ContractDocData = {
  contractNo: string;
  title: string;
  issuedAt: string;
  clientName: string;
  companyName: string | null;
  clientEmail: string | null;
  amountToman: number;
  durationLabel: string | null;
  startDate: string | null;
  bodyMd: string;
  /** وقتی کلاینت قرارداد را آنلاین تأیید کرده باشد */
  acceptance?: { name: string; at: string; ip: string | null; code: string } | null;
};

export type CBlock =
  | { id: string; kind: "letterhead"; keepWithNext?: boolean }
  | { id: string; kind: "title"; keepWithNext?: boolean }
  | { id: string; kind: "facts"; keepWithNext?: boolean }
  | { id: string; kind: "heading"; no: number; text: string; label?: string; keepWithNext?: boolean }
  | { id: string; kind: "para"; text: string; keepWithNext?: boolean }
  | { id: string; kind: "list"; items: string[]; ordered?: boolean; start?: number; keepWithNext?: boolean }
  | { id: string; kind: "callout"; text: string; keepWithNext?: boolean }
  | { id: string; kind: "signatures"; keepWithNext?: boolean };

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));

const ARTICLE_RE = /^ماده\s+([0-9۰-۹]+)\s*[—–-]\s*(.+)$/;
const BULLET_RE = /^[-*•]\s+(.*)$/;
const ORDERED_RE = /^[0-9۰-۹]+[.)]\s+(.*)$/;

export function buildContractBlocks(data: ContractDocData): CBlock[] {
  const blocks: CBlock[] = [];
  let seq = 0;
  const id = (k: string) => `${k}-${seq++}`;

  blocks.push({ id: id("letterhead"), kind: "letterhead", keepWithNext: true });
  blocks.push({ id: id("title"), kind: "title", keepWithNext: true });
  blocks.push({ id: id("facts"), kind: "facts" });

  let headingCount = 0;
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ id: id("para"), kind: "para", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list?.items.length) {
      // جمله‌ی معرفی فهرست («… به شرح زیر:») از فهرستش جدا نشود
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "para") prev.keepWithNext = true;
      blocks.push({ id: id("list"), kind: "list", items: list.items, ordered: list.ordered });
    }
    list = null;
  };

  for (const raw of data.bodyMd.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      headingCount += 1;
      const article = heading[1].match(ARTICLE_RE);
      blocks.push(
        article
          ? { id: id("heading"), kind: "heading", no: Number(toLatin(article[1])), text: article[2].trim(), label: "ماده", keepWithNext: true }
          : { id: id("heading"), kind: "heading", no: headingCount, text: heading[1].trim(), keepWithNext: true }
      );
      continue;
    }

    const bullet = line.match(BULLET_RE);
    const ordered = line.match(ORDERED_RE);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = !!ordered;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ?? ordered)![1].trim());
      continue;
    }

    if (line.startsWith(">")) {
      flushPara();
      flushList();
      blocks.push({ id: id("callout"), kind: "callout", text: line.replace(/^>\s*/, "") });
      continue;
    }

    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  blocks.push({ id: id("signatures"), kind: "signatures" });
  return blocks;
}
