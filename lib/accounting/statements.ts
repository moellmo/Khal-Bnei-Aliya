import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type Charge = {
  id: string;
  amount: number;
  status: string | null;
  paid_amount: number | null;
  due_date: string | null;
  paid_at: string | null;
  charge_type: string | null;
  description: string | null;
};

type Payment = {
  id: string;
  member_id: string;
  charge_id: string | null;
  amount: number;
  payment_method: string | null;
  payment_provider: string | null;
  payer_email: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
  note: string | null;
  receipt_number: string | null;
  members: Member | Member[] | null;
  member_charges:
    | {
        charge_type: string | null;
        description: string | null;
      }
    | {
        charge_type: string | null;
        description: string | null;
      }[]
    | null;
};

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

const pageSize: [number, number] = [612, 792];
const margin = 44;
const navy = rgb(0.11, 0.16, 0.25);
const gray = rgb(0.4, 0.44, 0.5);
const lightGray = rgb(0.94, 0.93, 0.9);

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "";

  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().slice(0, 10);
}

function memberName(member: Member | null | undefined) {
  return (
    [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() ||
    member?.email ||
    "Unknown member"
  );
}

function getPaymentMember(payment: Payment) {
  return Array.isArray(payment.members) ? payment.members[0] : payment.members;
}

function getPaymentCharge(payment: Payment) {
  return Array.isArray(payment.member_charges)
    ? payment.member_charges[0]
    : payment.member_charges;
}

function paymentDescription(payment: Payment) {
  const charge = getPaymentCharge(payment);

  return (
    charge?.description ||
    charge?.charge_type ||
    payment.note ||
    "Payment"
  );
}

function truncateText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let next = text;

  while (
    next.length > 3 &&
    font.widthOfTextAtSize(`${next}...`, size) > maxWidth
  ) {
    next = next.slice(0, -1);
  }

  return `${next}...`;
}

function drawHeader({
  page,
  fonts,
  title,
  subtitle,
}: {
  page: PDFPage;
  fonts: Fonts;
  title: string;
  subtitle: string;
}) {
  page.drawRectangle({
    x: 0,
    y: 700,
    width: pageSize[0],
    height: 92,
    color: navy,
  });

  page.drawText("KHAL BNEI ALIYA", {
    x: margin,
    y: 752,
    size: 18,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });

  page.drawText(title, {
    x: margin,
    y: 724,
    size: 11,
    font: fonts.bold,
    color: rgb(0.86, 0.75, 0.48),
  });

  page.drawText(subtitle, {
    x: 350,
    y: 744,
    size: 10,
    font: fonts.regular,
    color: rgb(1, 1, 1),
    maxWidth: 210,
  });
}

async function createPdf(title: string, subtitle: string) {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const addPage = () => {
    const page = pdf.addPage(pageSize);
    drawHeader({ page, fonts, title, subtitle });
    return page;
  };

  return {
    pdf,
    fonts,
    addPage,
  };
}

function drawInfoBox({
  page,
  fonts,
  y,
  lines,
}: {
  page: PDFPage;
  fonts: Fonts;
  y: number;
  lines: Array<[string, string]>;
}) {
  page.drawRectangle({
    x: margin,
    y: y - 16 - lines.length * 22,
    width: 524,
    height: 24 + lines.length * 22,
    color: lightGray,
  });

  lines.forEach(([label, value], index) => {
    const lineY = y - index * 22;
    page.drawText(label, {
      x: margin + 18,
      y: lineY,
      size: 9,
      font: fonts.bold,
      color: gray,
    });
    page.drawText(truncateText(value, fonts.regular, 10, 330), {
      x: margin + 132,
      y: lineY,
      size: 10,
      font: fonts.regular,
      color: navy,
    });
  });
}

function drawTableHeader({
  page,
  fonts,
  y,
  columns,
}: {
  page: PDFPage;
  fonts: Fonts;
  y: number;
  columns: Array<{ label: string; x: number; width: number; align?: "right" }>;
}) {
  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: 524,
    height: 24,
    color: lightGray,
  });

  columns.forEach((column) => {
    page.drawText(column.label, {
      x: column.x,
      y,
      size: 8,
      font: fonts.bold,
      color: gray,
    });
  });
}

function drawCell({
  page,
  fonts,
  text,
  x,
  y,
  width,
  bold = false,
  align,
}: {
  page: PDFPage;
  fonts: Fonts;
  text: string;
  x: number;
  y: number;
  width: number;
  bold?: boolean;
  align?: "right";
}) {
  const font = bold ? fonts.bold : fonts.regular;
  const size = 9;
  const displayText = truncateText(text, font, size, width);
  const textWidth = font.widthOfTextAtSize(displayText, size);

  page.drawText(displayText, {
    x: align === "right" ? x + width - textWidth : x,
    y,
    size,
    font,
    color: navy,
  });
}

function yearRange(year: number) {
  return {
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year + 1}-01-01T00:00:00.000Z`,
  };
}

export function normalizeStatementYear(value: string | number | null | undefined) {
  const year = Number(value || new Date().getFullYear());

  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return new Date().getFullYear();
  }

  return Math.round(year);
}

async function loadMembers(memberId?: string | null) {
  let query = supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, email")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (memberId && memberId !== "all") {
    query = query.eq("id", memberId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Member[];
}

async function loadPayments({
  year,
  memberId,
}: {
  year: number;
  memberId?: string | null;
}) {
  const range = yearRange(year);
  let query = supabaseAdmin
    .from("payments")
    .select(
      "id, member_id, charge_id, amount, payment_method, payment_provider, payer_email, status, paid_at, created_at, note, receipt_number, members(id, first_name, last_name, email), member_charges(charge_type, description)"
    )
    .eq("status", "paid")
    .gte("paid_at", range.start)
    .lt("paid_at", range.end)
    .order("paid_at", { ascending: true });

  if (memberId && memberId !== "all") {
    query = query.eq("member_id", memberId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Payment[];
}

async function loadCharges({
  year,
  memberId,
}: {
  year: number;
  memberId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, amount, status, paid_amount, due_date, paid_at, charge_type, description"
    )
    .eq("member_id", memberId)
    .gte("due_date", `${year}-01-01`)
    .lt("due_date", `${year + 1}-01-01`)
    .order("due_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Charge[];
}

export async function buildYearlyTaxStatementPdf({
  year,
  memberId,
}: {
  year: number;
  memberId?: string | null;
}) {
  const [members, payments] = await Promise.all([
    loadMembers(memberId),
    loadPayments({ year, memberId }),
  ]);

  const memberMap = new Map(members.map((member) => [member.id, member]));
  const paymentsByMember = new Map<string, Payment[]>();

  payments.forEach((payment) => {
    const list = paymentsByMember.get(payment.member_id) || [];
    list.push(payment);
    paymentsByMember.set(payment.member_id, list);

    const paymentMember = getPaymentMember(payment);
    if (paymentMember && !memberMap.has(payment.member_id)) {
      memberMap.set(payment.member_id, paymentMember);
    }
  });

  const statementMembers =
    memberId && memberId !== "all"
      ? members
      : Array.from(paymentsByMember.keys())
          .map((id) => memberMap.get(id))
          .filter(Boolean)
          .sort((a, b) =>
            memberName(a).localeCompare(memberName(b), "en", {
              sensitivity: "base",
            })
          );

  const { pdf, fonts, addPage } = await createPdf(
    "YEARLY TAX STATEMENT",
    `Calendar Year ${year}`
  );

  if (statementMembers.length === 0) {
    const page = addPage();
    page.drawText("No paid payments were found for this selection.", {
      x: margin,
      y: 640,
      size: 12,
      font: fonts.bold,
      color: navy,
    });
    return pdf.save();
  }

  statementMembers.forEach((member, memberIndex) => {
    if (!member) return;

    let page = addPage();
    let y = 650;
    const memberPayments = paymentsByMember.get(member.id) || [];
    const total = memberPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    drawInfoBox({
      page,
      fonts,
      y,
      lines: [
        ["Donor", memberName(member)],
        ["Email", member.email || ""],
        ["Statement", `${year} paid payments`],
        ["Total Recorded", formatMoney(total)],
      ],
    });

    y -= 132;

    page.drawText(
      "This statement summarizes payments recorded by Khal Bnei Aliya for your records. Please consult your tax advisor about deductibility.",
      {
        x: margin,
        y,
        size: 9,
        font: fonts.regular,
        color: gray,
        maxWidth: 524,
      }
    );

    y -= 38;

    const columns = [
      { label: "Date", x: margin + 10, width: 74 },
      { label: "Description", x: margin + 92, width: 250 },
      { label: "Method", x: margin + 350, width: 72 },
      { label: "Amount", x: margin + 438, width: 74, align: "right" as const },
    ];

    drawTableHeader({ page, fonts, y, columns });
    y -= 28;

    memberPayments.forEach((payment) => {
      if (y < 82) {
        page = addPage();
        y = 650;
        drawTableHeader({ page, fonts, y, columns });
        y -= 28;
      }

      drawCell({
        page,
        fonts,
        text: formatDate(payment.paid_at || payment.created_at),
        x: columns[0].x,
        y,
        width: columns[0].width,
      });
      drawCell({
        page,
        fonts,
        text: paymentDescription(payment),
        x: columns[1].x,
        y,
        width: columns[1].width,
      });
      drawCell({
        page,
        fonts,
        text: payment.payment_method || payment.payment_provider || "Payment",
        x: columns[2].x,
        y,
        width: columns[2].width,
      });
      drawCell({
        page,
        fonts,
        text: formatMoney(payment.amount),
        x: columns[3].x,
        y,
        width: columns[3].width,
        align: "right",
      });

      y -= 20;
    });

    page.drawLine({
      start: { x: margin, y: y + 6 },
      end: { x: margin + 524, y: y + 6 },
      thickness: 1,
      color: lightGray,
    });

    drawCell({
      page,
      fonts,
      text: "Year Total",
      x: margin + 326,
      y: y - 16,
      width: 92,
      bold: true,
    });
    drawCell({
      page,
      fonts,
      text: formatMoney(total),
      x: margin + 438,
      y: y - 16,
      width: 74,
      bold: true,
      align: "right",
    });

    if (memberIndex === statementMembers.length - 1) {
      page.drawText(`Generated ${formatDate(new Date().toISOString())}`, {
        x: margin,
        y: 42,
        size: 8,
        font: fonts.regular,
        color: gray,
      });
    }
  });

  return pdf.save();
}

export async function buildMemberAccountStatementPdf({
  year,
  memberId,
}: {
  year: number;
  memberId: string;
}) {
  const [members, payments, charges] = await Promise.all([
    loadMembers(memberId),
    loadPayments({ year, memberId }),
    loadCharges({ year, memberId }),
  ]);

  const member = members[0];
  if (!member) {
    throw new Error("Member not found.");
  }

  const ledger = [
    ...charges.map((charge) => ({
      date: charge.due_date || charge.paid_at || "",
      description: charge.description || charge.charge_type || "Charge",
      charge: Number(charge.amount || 0),
      payment: 0,
    })),
    ...payments.map((payment) => ({
      date: dateOnly(payment.paid_at || payment.created_at),
      description: paymentDescription(payment),
      charge: 0,
      payment: Number(payment.amount || 0),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const totalCharges = ledger.reduce((sum, row) => sum + row.charge, 0);
  const totalPayments = ledger.reduce((sum, row) => sum + row.payment, 0);
  const balance = totalCharges - totalPayments;

  const { pdf, fonts, addPage } = await createPdf(
    "MEMBER ACCOUNT STATEMENT",
    `Calendar Year ${year}`
  );
  let page = addPage();
  let y = 650;

  drawInfoBox({
    page,
    fonts,
    y,
    lines: [
      ["Member", memberName(member)],
      ["Email", member.email || ""],
      ["Charges", formatMoney(totalCharges)],
      ["Payments", formatMoney(totalPayments)],
      ["Balance", formatMoney(balance)],
    ],
  });

  y -= 154;

  const columns = [
    { label: "Date", x: margin + 10, width: 74 },
    { label: "Description", x: margin + 92, width: 224 },
    { label: "Charge", x: margin + 326, width: 70, align: "right" as const },
    { label: "Payment", x: margin + 408, width: 70, align: "right" as const },
    { label: "Balance", x: margin + 494, width: 60, align: "right" as const },
  ];

  drawTableHeader({ page, fonts, y, columns });
  y -= 28;

  let runningBalance = 0;

  ledger.forEach((row) => {
    if (y < 82) {
      page = addPage();
      y = 650;
      drawTableHeader({ page, fonts, y, columns });
      y -= 28;
    }

    runningBalance += row.charge - row.payment;

    drawCell({
      page,
      fonts,
      text: formatDate(row.date),
      x: columns[0].x,
      y,
      width: columns[0].width,
    });
    drawCell({
      page,
      fonts,
      text: row.description,
      x: columns[1].x,
      y,
      width: columns[1].width,
    });
    drawCell({
      page,
      fonts,
      text: row.charge ? formatMoney(row.charge) : "",
      x: columns[2].x,
      y,
      width: columns[2].width,
      align: "right",
    });
    drawCell({
      page,
      fonts,
      text: row.payment ? formatMoney(row.payment) : "",
      x: columns[3].x,
      y,
      width: columns[3].width,
      align: "right",
    });
    drawCell({
      page,
      fonts,
      text: formatMoney(runningBalance),
      x: columns[4].x,
      y,
      width: columns[4].width,
      align: "right",
    });

    y -= 20;
  });

  if (ledger.length === 0) {
    page.drawText("No charges or payments were found for this year.", {
      x: margin,
      y,
      size: 11,
      font: fonts.bold,
      color: navy,
    });
  }

  page.drawText(`Generated ${formatDate(new Date().toISOString())}`, {
    x: margin,
    y: 42,
    size: 8,
    font: fonts.regular,
    color: gray,
  });

  return pdf.save();
}

export async function getDepositBatchRows({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select(
      "id, member_id, charge_id, amount, payment_method, payment_provider, payer_email, status, paid_at, created_at, note, receipt_number, members(id, first_name, last_name, email), member_charges(charge_type, description)"
    )
    .eq("status", "paid")
    .gte("paid_at", `${startDate}T00:00:00.000Z`)
    .lt("paid_at", `${endDate}T00:00:00.000Z`)
    .order("paid_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const payments = (data || []) as Payment[];
  const batchMap = new Map<
    string,
    {
      depositDate: string;
      method: string;
      amount: number;
      count: number;
      payments: Payment[];
    }
  >();

  payments.forEach((payment) => {
    const depositDate = dateOnly(payment.paid_at || payment.created_at);
    const method = payment.payment_method || payment.payment_provider || "Other";
    const key = `${depositDate}|${method}`;
    const batch =
      batchMap.get(key) ||
      {
        depositDate,
        method,
        amount: 0,
        count: 0,
        payments: [],
      };

    batch.amount += Number(payment.amount || 0);
    batch.count += 1;
    batch.payments.push(payment);
    batchMap.set(key, batch);
  });

  return Array.from(batchMap.values()).sort((a, b) =>
    `${a.depositDate} ${a.method}`.localeCompare(`${b.depositDate} ${b.method}`)
  );
}

export function depositBatchCsv(
  rows: Awaited<ReturnType<typeof getDepositBatchRows>>
) {
  const escapeCsv = (value: unknown) => {
    const text = String(value ?? "");

    if (
      text.includes(",") ||
      text.includes('"') ||
      text.includes("\n") ||
      text.includes("\r")
    ) {
      return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
  };

  const headers = [
    "Deposit Date",
    "Method",
    "Batch Total",
    "Payment Count",
    "Member",
    "Payment Date",
    "Payment Amount",
    "Description",
    "Receipt Number",
  ];

  const lines = rows.flatMap((row) =>
    row.payments.map((payment) => [
      row.depositDate,
      row.method,
      row.amount.toFixed(2),
      row.count,
      memberName(getPaymentMember(payment)),
      dateOnly(payment.paid_at || payment.created_at),
      Number(payment.amount || 0).toFixed(2),
      paymentDescription(payment),
      payment.receipt_number || "",
    ])
  );

  return [
    headers.map(escapeCsv).join(","),
    ...lines.map((line) => line.map(escapeCsv).join(",")),
  ].join("\r\n");
}
