"use client";

import { useMemo } from "react";
import { ARKAN } from "@/lib/documents/company";
import { faDate, formatToman, toFa } from "@/lib/documents/format";
import { buildProposalBlocks, type PBlock } from "@/lib/crm/proposals/blocks";
import type { ProposalData, ProposalOption, ProposalPhase } from "@/lib/crm/proposals/types";
import {
  Callout,
  Chip,
  HEAD_FONT,
  Letterhead,
  ListBlock,
  Ltr,
  PaginatedSheets,
  Rich,
  SectionHeading,
  T,
  paraStyle,
} from "./sheet-kit";

// ── بلوک‌های مخصوص پروپوزال ───────────────────────────────────

function Cover({ data }: { data: ProposalData }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 12 }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1 }}>پیشنهاد همکاری</div>
      <div style={{ fontFamily: HEAD_FONT, fontSize: 25, fontWeight: 700, color: T.pine, marginTop: 6, lineHeight: 1.6 }}>
        {data.title}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Chip label="شماره" value={data.proposalNo} ltr />
        <Chip label="تاریخ" value={faDate(data.issuedAt)} />
        {data.revision > 1 ? <Chip label="نسخه" value={toFa(data.revision)} /> : null}
        {data.validUntil ? <Chip label="معتبر تا" value={faDate(data.validUntil)} /> : null}
      </div>

      <div
        style={{
          marginTop: 18,
          background: T.bone,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: "14px 16px",
          textAlign: "right",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 10.5, color: T.muted }}>تهیه‌شده برای</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginTop: 4 }}>{data.clientName}</div>
          {data.clientCompany ? <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{data.clientCompany}</div> : null}
          <div style={{ fontSize: 10.5, color: T.muted }}>
            <Ltr>{data.clientEmail}</Ltr>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: T.muted }}>تهیه‌شده توسط</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginTop: 4 }}>{ARKAN.repName}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            {ARKAN.repTitle} — {ARKAN.brand}
          </div>
        </div>
      </div>
    </div>
  );
}

function Phases({ items, start = 0 }: { items: ProposalPhase[]; start?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {items.map((p, i) => (
        <div
          key={i}
          // هر مرحله یک ردیف: برنامه‌ی بلند روی چند صفحه ریخته می‌شود، نه اینکه از پای صفحه بیرون بزند
          data-doc-row
          style={{
            display: "flex",
            gap: 11,
            border: `1px solid ${T.line}`,
            borderRadius: 11,
            padding: "11px 13px",
            background: T.paper,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: T.brassSoft,
              border: `1px solid ${T.brass}`,
              color: T.pine,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {toFa(start + i + 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{p.title}</div>
              {p.duration ? <div style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>{p.duration}</div> : null}
            </div>
            {p.detail ? (
              <div style={{ ...paraStyle, fontSize: 11.5, lineHeight: 1.95, marginTop: 4 }}>
                <Rich text={p.detail} />
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function OptionCard({ option, selected, single }: { option: ProposalOption; selected?: boolean; single?: boolean }) {
  const highlight = selected || option.recommended;
  return (
    <div
      style={{
        flex: 1,
        border: `1px solid ${selected ? T.ok : highlight ? T.pine : T.line}`,
        borderRadius: 13,
        padding: "14px 15px",
        background: selected ? T.okSoft : highlight ? T.pineSoft : T.paper,
        display: "flex",
        flexDirection: "column",
        gap: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{option.name}</div>
        {selected ? (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.ok }}>✓ انتخاب شما</div>
        ) : option.recommended ? (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.bone, background: T.pine, borderRadius: 999, padding: "1px 8px" }}>
            پیشنهاد ما
          </div>
        ) : null}
      </div>
      {option.tagline ? <div style={{ fontSize: 10.5, color: T.muted, marginTop: -3 }}>{option.tagline}</div> : null}

      <div style={{ fontFamily: HEAD_FONT, fontSize: single ? 22 : 17, fontWeight: 700, color: T.pine }}>
        {formatToman(option.price)}
      </div>

      {option.durationNote || option.paymentNote ? (
        <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.85 }}>
          {option.durationNote ? <div>مدت: {option.durationNote}</div> : null}
          {option.paymentNote ? <div>پرداخت: {option.paymentNote}</div> : null}
        </div>
      ) : null}

      {option.features.length ? (
        <>
          <div style={{ height: 1, background: T.lineSoft }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {option.features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <span style={{ color: T.pine, fontSize: 11, fontWeight: 700, lineHeight: 1.9 }}>✓</span>
                <span style={{ fontSize: 11, lineHeight: 1.9, color: T.body, flex: 1 }}>{f}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Options({ items, selectedOption }: { items: ProposalOption[]; selectedOption?: string | null }) {
  // سه کارت کنار هم روی A4 هنوز خواناست؛ بیشتر از آن در ردیف بعد می‌رود
  const rows: ProposalOption[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {row.map((o) => (
            <OptionCard key={o.id} option={o} single={items.length === 1} selected={!!selectedOption && selectedOption === o.id} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Closing({ data }: { data: ProposalData }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 13, padding: "15px 17px", background: T.bone }}>
      <div style={{ fontFamily: HEAD_FONT, fontSize: 14, fontWeight: 700, color: T.pine, marginBottom: 6 }}>
        منتظر نظر شما هستیم
      </div>
      <div style={{ ...paraStyle, fontSize: 11.5 }}>
        {data.clientName} گرامی، اگر بخشی از این پیشنهاد نیاز به تغییر دارد یا پرسشی برایتان مانده، همان را برای ما
        بنویسید تا نسخه‌ی بازنگری‌شده را بفرستیم. پس از تأیید شما، قرارداد رسمی برای تأیید آنلاین ارسال می‌شود.
      </div>
      <div style={{ height: 1, background: T.line, margin: "12px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{ARKAN.repName}</div>
          <div style={{ fontSize: 10.5, color: T.muted }}>
            {ARKAN.repTitle} — {ARKAN.legalName}
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.9, textAlign: "left" }}>
          <div>
            <Ltr>{ARKAN.phone}</Ltr>
          </div>
          <div>
            <Ltr>{ARKAN.email}</Ltr>
          </div>
        </div>
      </div>
    </div>
  );
}

function PBlockView({ block, data, selectedOption }: { block: PBlock; data: ProposalData; selectedOption?: string | null }) {
  switch (block.kind) {
    case "letterhead":
      return <Letterhead />;
    case "cover":
      return <Cover data={data} />;
    case "heading":
      return <SectionHeading no={block.no} text={block.text} />;
    case "para":
      return (
        <p style={paraStyle}>
          <Rich text={block.text} />
        </p>
      );
    case "list":
      return <ListBlock items={block.items} ordered={block.ordered} check={block.check} start={block.start} />;
    case "phases":
      return <Phases items={block.items} start={block.start} />;
    case "options":
      return <Options items={block.items} selectedOption={selectedOption} />;
    case "callout":
      return <Callout title={block.title} text={block.text} />;
    case "closing":
      return <Closing data={data} />;
    default:
      return null;
  }
}

export default function ProposalSheets({
  data,
  selectedOption,
  onReady,
}: {
  data: ProposalData;
  /** روی نسخه‌ی تأییدشده، بسته‌ی انتخابی کلاینت را علامت می‌زند */
  selectedOption?: string | null;
  onReady?: (pageCount: number) => void;
}) {
  const blocks = useMemo(() => buildProposalBlocks(data), [data]);
  return (
    <PaginatedSheets
      blocks={blocks}
      docNo={data.proposalNo}
      onReady={onReady}
      render={(b) => <PBlockView block={b} data={data} selectedOption={selectedOption} />}
    />
  );
}
