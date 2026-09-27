import { ARKAN, DOC_THEME } from "./company";

/**
 * ساخت PDF در خود مرورگر: از هر صفحه‌ی A4 (`[data-doc-page]`) تصویر گرفته می‌شود
 * و تصویرها کنار هم یک PDF می‌سازند.
 *
 * چرا تصویر؟ مرورگر متن فارسی را با فونت واقعی (وزیرمتن/استعداد) و ترتیب درست
 * راست‌به‌چپ می‌چیند؛ پس PDF دقیقاً همان چیزی است که روی صفحه می‌بینید و هیچ
 * کتابخانه‌ی شکل‌دهی حروف عربی در سمت PDF لازم نیست. هزینه‌اش این است که متن PDF
 * قابل انتخاب/جست‌وجو نیست.
 *
 * این ماژول فقط در کامپوننت‌های کلاینت import می‌شود (به document نیاز دارد).
 */
export async function renderSheetsToPdf(
  root: HTMLElement,
  meta: { title: string; subject: string }
): Promise<Blob> {
  const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-doc-page]")).sort(
    (a, b) => Number(a.dataset.docPage ?? 0) - Number(b.dataset.docPage ?? 0)
  );
  if (!sheets.length) throw new Error("هیچ صفحه‌ای برای ساخت PDF پیدا نشد.");

  // کتابخانه‌ها سنگین‌اند؛ فقط لحظه‌ی ساخت PDF بارگذاری می‌شوند
  const [{ default: JsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  try {
    await document.fonts?.ready;
  } catch {
    /* API فونت در دسترس نیست — با همان چیزی که رسم شده ادامه می‌دهیم */
  }

  const canvases: HTMLCanvasElement[] = [];
  for (const sheet of sheets) {
    canvases.push(
      await html2canvas(sheet, {
        scale: 2,
        backgroundColor: DOC_THEME.paper,
        useCORS: true,
        logging: false,
      })
    );
  }

  // اول باکیفیت‌ترین حالت؛ فقط اگر حجم از سقف گذشت کیفیت را پایین می‌آوریم
  let blob: Blob | null = null;
  for (const pass of ENCODING_PASSES) {
    blob = assemble(JsPDF, canvases, pass, meta);
    if (blob.size <= MAX_PDF_BYTES) break;
  }
  return blob!;
}

/** Vercel بدنه‌ی درخواست بالای ۴٫۵ مگابایت را رد می‌کند و PDF به‌صورت base64
 *  (یک‌سوم بزرگ‌تر) به سرور می‌رود؛ پس خود فایل زیر این سقف می‌ماند. */
const MAX_PDF_BYTES = 2_900_000;

type EncodingPass = { quality: number; shrink: number };

const ENCODING_PASSES: EncodingPass[] = [
  { quality: 0.92, shrink: 1 },
  { quality: 0.82, shrink: 1 },
  { quality: 0.72, shrink: 0.85 },
  { quality: 0.62, shrink: 0.7 },
];

function shrinkCanvas(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  if (factor >= 1) return source;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(source.width * factor));
  out.height = Math.max(1, Math.round(source.height * factor));
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function assemble(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  JsPDF: any,
  canvases: HTMLCanvasElement[],
  pass: EncodingPass,
  meta: { title: string; subject: string }
): Blob {
  const pdf = new JsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  canvases.forEach((canvas, i) => {
    const img = shrinkCanvas(canvas, pass.shrink).toDataURL("image/jpeg", pass.quality);
    if (i > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
  });

  pdf.setProperties({
    title: meta.title,
    subject: meta.subject,
    author: ARKAN.nameEn,
    creator: ARKAN.nameEn,
  });
  return pdf.output("blob") as Blob;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خواندن فایل PDF ناموفق بود."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
