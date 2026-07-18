"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptContract } from "@/app/contract/actions";
import type { ContractStatus } from "@/lib/crm/types";

/**
 * نوار اقدامات صفحه‌ی عمومی قرارداد (سمت کلاینت):
 * چاپ/ذخیره PDF + فرم «تأیید قرارداد» آنلاین. در چاپ مخفی می‌شود.
 */
export default function ContractClientActions({
  token,
  status,
  acceptedByName,
  acceptedAt,
}: {
  token: string;
  status: ContractStatus;
  acceptedByName: string | null;
  acceptedAt: string | null;
}) {
  const router = useRouter();
  const [showAccept, setShowAccept] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await acceptContract(token, name);
      if (res.ok) {
        setShowAccept(false);
        router.refresh();
      } else {
        setError(res.error ?? "خطایی رخ داد.");
      }
    });
  }

  return (
    <div className="mb-5 print:hidden">
      {status === "canceled" ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          این قرارداد لغو شده است. برای اطلاعات بیشتر با آرکان تماس بگیرید.
        </div>
      ) : status === "accepted" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-body text-green-700">
            ✓ این قرارداد {acceptedByName ? `توسط «${acceptedByName}» ` : ""}تأیید شده است
            {acceptedAt ? ` — ${acceptedAt}` : ""}.
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-btn border border-green-300 px-4 py-2 text-caption text-green-700 transition-colors hover:bg-green-100"
          >
            چاپ / ذخیره PDF
          </button>
        </div>
      ) : (
        <div className="rounded-card border border-sand bg-white px-5 py-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-ink">
              لطفاً متن قرارداد را مطالعه کنید؛ در صورت موافقت، آن را به‌صورت آنلاین تأیید کنید.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-btn border border-pine/25 px-4 py-2 text-caption text-pine transition-colors hover:bg-pine/5"
              >
                چاپ / ذخیره PDF
              </button>
              <button
                type="button"
                onClick={() => setShowAccept((v) => !v)}
                className="rounded-btn bg-pine px-5 py-2 text-caption font-medium text-bone transition-colors hover:bg-pine-dark"
              >
                ✓ تأیید قرارداد
              </button>
            </div>
          </div>

          {showAccept && (
            <div className="mt-4 border-t border-sand pt-4">
              <label htmlFor="accept-name" className="mb-1.5 block text-caption font-medium text-ink">
                نام و نام خانوادگی تأییدکننده (به‌منزله‌ی امضای آنلاین)
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="accept-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلاً نسترن قاسمی"
                  className="w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-slate/50 focus:border-brass focus:outline-none sm:max-w-xs"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || name.trim().length < 3}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
                >
                  {pending && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-bone/40 border-t-bone" />
                  )}
                  ثبت تأیید نهایی
                </button>
              </div>
              <p className="mt-2 text-[0.75rem] leading-5 text-slate">
                با ثبت تأیید، پذیرش کلیه‌ی مفاد این قرارداد از سوی شما ثبت و به آرکان اطلاع داده می‌شود.
              </p>
              {error && (
                <p role="alert" className="mt-2 text-caption text-red-600">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
