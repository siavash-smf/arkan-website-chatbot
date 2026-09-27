"use client";

import { useMemo } from "react";
import { ARKAN } from "@/lib/documents/company";
import { faDate, faDateTime, formatToman, tomanInWords } from "@/lib/documents/format";
import { buildContractBlocks, type CBlock, type ContractDocData } from "@/lib/crm/contract-blocks";
import {
  Callout,
  Chip,
  FactsTable,
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

function TitleBlock({ data }: { data: ContractDocData }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 10 }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1 }}>قرارداد خدمات مشاوره</div>
      <div style={{ fontFamily: HEAD_FONT, fontSize: 22, fontWeight: 700, color: T.pine, marginTop: 6, lineHeight: 1.6 }}>
        {data.title}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Chip label="شماره‌ی قرارداد" value={data.contractNo} ltr />
        <Chip label="تاریخ تنظیم" value={faDate(data.issuedAt)} />
      </div>
    </div>
  );
}

function Facts({ data }: { data: ContractDocData }) {
  const client = data.companyName ? `${data.companyName} — ${data.clientName}` : data.clientName;
  return (
    <FactsTable
      rows={[
        { k: "مشاور", v: `${ARKAN.legalName} — ${ARKAN.repName}` },
        {
          k: "کارفرما",
          v: (
            <>
              {client}
              {data.clientEmail ? (
                <span style={{ fontWeight: 400, color: T.muted }}>
                  {" · "}
                  <Ltr>{data.clientEmail}</Ltr>
                </span>
              ) : null}
            </>
          ),
        },
        {
          k: "مبلغ قرارداد",
          v:
            data.amountToman > 0 ? (
              <>
                {formatToman(data.amountToman)}
                <span style={{ fontWeight: 400, color: T.muted }}> ({tomanInWords(data.amountToman)})</span>
              </>
            ) : (
              "—"
            ),
        },
        { k: "مدت", v: data.durationLabel || "—" },
        { k: "تاریخ شروع", v: data.startDate ? faDate(data.startDate) : "—" },
      ]}
    />
  );
}

function Signatures({ data }: { data: ContractDocData }) {
  const client = data.companyName ? `${data.companyName} — ${data.clientName}` : data.clientName;
  const box = {
    flex: 1,
    border: `1px solid ${T.line}`,
    borderRadius: 12,
    padding: "13px 15px",
    background: T.paper,
  } as const;
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontFamily: HEAD_FONT, fontSize: 14, fontWeight: 700, color: T.pine, marginBottom: 10 }}>امضای طرفین</div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={box}>
          <div style={{ fontSize: 10.5, color: T.muted }}>مشاور</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5 }}>{ARKAN.legalName}</div>
          <div style={{ fontSize: 11, color: T.muted }}>
            {ARKAN.repName} — {ARKAN.repTitle}
          </div>
          <div style={{ height: 44, borderBottom: `1px dashed ${T.faint}`, marginTop: 8 }} />
          <div style={{ fontSize: 9.5, color: T.faint, marginTop: 4 }}>مهر و امضا</div>
        </div>
        <div style={{ ...box, ...(data.acceptance ? { borderColor: T.ok, background: T.okSoft } : {}) }}>
          <div style={{ fontSize: 10.5, color: T.muted }}>کارفرما</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5 }}>{client}</div>
          {data.acceptance ? (
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.9, color: T.ink }}>
              <div style={{ color: T.ok, fontWeight: 700 }}>✓ تأیید آنلاین توسط {data.acceptance.name}</div>
              <div style={{ color: T.muted }}>{faDateTime(data.acceptance.at)}</div>
              <div style={{ color: T.muted }}>
                کد پیگیری: <Ltr>{data.acceptance.code}</Ltr>
              </div>
              {data.acceptance.ip ? (
                <div style={{ color: T.muted }}>
                  نشانی IP: <Ltr>{data.acceptance.ip}</Ltr>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div style={{ height: 44, borderBottom: `1px dashed ${T.faint}`, marginTop: 8 }} />
              <div style={{ fontSize: 9.5, color: T.faint, marginTop: 4 }}>امضا یا تأیید آنلاین</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CBlockView({ block, data }: { block: CBlock; data: ContractDocData }) {
  switch (block.kind) {
    case "letterhead":
      return <Letterhead />;
    case "title":
      return <TitleBlock data={data} />;
    case "facts":
      return <Facts data={data} />;
    case "heading":
      return <SectionHeading no={block.no} text={block.text} label={block.label} />;
    case "para":
      return (
        <p style={paraStyle}>
          <Rich text={block.text} />
        </p>
      );
    case "list":
      return <ListBlock items={block.items} ordered={block.ordered} start={block.start} />;
    case "callout":
      return <Callout text={block.text} />;
    case "signatures":
      return <Signatures data={data} />;
    default:
      return null;
  }
}

export default function ContractSheets({
  data,
  onReady,
}: {
  data: ContractDocData;
  onReady?: (pageCount: number) => void;
}) {
  const blocks = useMemo(() => buildContractBlocks(data), [data]);
  return (
    <PaginatedSheets
      blocks={blocks}
      docNo={data.contractNo}
      onReady={onReady}
      render={(b) => <CBlockView block={b} data={data} />}
    />
  );
}

