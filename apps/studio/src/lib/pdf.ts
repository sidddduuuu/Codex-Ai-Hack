// Minimal zero-dependency PDF writer for text incident reports. Uses the
// standard Courier fonts (built into every PDF viewer, no embedding), so
// monospaced wrapping is deterministic and there is no supply-chain surface.

type BlockType = "title" | "heading" | "body" | "bullet" | "meta" | "spacer";

interface Block {
  type: BlockType;
  text: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const FONT_SIZE = 10;
const CHAR_WIDTH = FONT_SIZE * 0.6; // Courier advance width is 600/1000 em.
const LINE_HEIGHT = 15;
const MAX_CHARS = Math.floor((PAGE_WIDTH - MARGIN * 2) / CHAR_WIDTH);
const TOP = PAGE_HEIGHT - MARGIN;
const BOTTOM = MARGIN;

interface RenderedLine {
  text: string;
  bold: boolean;
  size: number;
  gapBefore: number;
}

export class ReportPdf {
  private readonly blocks: Block[] = [];

  title(text: string): this {
    return this.push("title", text);
  }

  heading(text: string): this {
    return this.push("heading", text);
  }

  body(text: string): this {
    return this.push("body", text);
  }

  bullet(text: string): this {
    return this.push("bullet", text);
  }

  meta(text: string): this {
    return this.push("meta", text);
  }

  spacer(): this {
    return this.push("spacer", "");
  }

  toBlob(): Blob {
    return new Blob([this.build()], { type: "application/pdf" });
  }

  private push(type: BlockType, text: string): this {
    this.blocks.push({ type, text });
    return this;
  }

  private build(): string {
    const lines = this.layout();
    const pages = this.paginate(lines);
    return serializePdf(pages);
  }

  private layout(): RenderedLine[] {
    const lines: RenderedLine[] = [];

    for (const block of this.blocks) {
      if (block.type === "spacer") {
        lines.push({ text: "", bold: false, size: FONT_SIZE, gapBefore: LINE_HEIGHT * 0.5 });
        continue;
      }

      const bold = block.type === "title" || block.type === "heading";
      const size = block.type === "title" ? 18 : block.type === "heading" ? 12 : FONT_SIZE;
      const gapBefore = block.type === "heading" ? LINE_HEIGHT : block.type === "title" ? 0 : 0;
      const prefix = block.type === "bullet" ? "- " : "";
      const wrapWidth = block.type === "title" ? Math.floor(MAX_CHARS * (FONT_SIZE / 18)) : MAX_CHARS - prefix.length;

      const wrapped = wrapText(block.text, Math.max(wrapWidth, 20));
      wrapped.forEach((segment, index) => {
        lines.push({
          text: `${index === 0 ? prefix : block.type === "bullet" ? "  " : ""}${segment}`,
          bold,
          size,
          gapBefore: index === 0 ? gapBefore : 0,
        });
      });
    }

    return lines;
  }

  private paginate(lines: RenderedLine[]): RenderedLine[][] {
    const pages: RenderedLine[][] = [];
    let current: RenderedLine[] = [];
    let y = TOP;

    for (const line of lines) {
      const advance = line.gapBefore + line.size + (LINE_HEIGHT - FONT_SIZE);
      if (y - advance < BOTTOM && current.length > 0) {
        pages.push(current);
        current = [];
        y = TOP;
      }

      current.push(line);
      y -= advance;
    }

    if (current.length > 0) {
      pages.push(current);
    }

    return pages.length > 0 ? pages : [[]];
  }
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= width) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
    }

    if (word.length > width) {
      let remainder = word;
      while (remainder.length > width) {
        lines.push(remainder.slice(0, width));
        remainder = remainder.slice(width);
      }
      line = remainder;
    } else {
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function serializePdf(pages: RenderedLine[][]): string {
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];

  // Object numbering: 1 = catalog, 2 = pages, 3 = font regular, 4 = font bold.
  const FONT_REGULAR = 3;
  const FONT_BOLD = 4;
  let nextObject = 5;

  const streams = pages.map((page) => {
    const contentNumber = nextObject++;
    const pageNumber = nextObject++;
    contentObjectNumbers.push(contentNumber);
    pageObjectNumbers.push(pageNumber);
    return { contentNumber, pageNumber, content: pageContentStream(page) };
  });

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;
  objects[FONT_REGULAR] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`;
  objects[FONT_BOLD] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>`;

  for (const stream of streams) {
    objects[stream.contentNumber] = `<< /Length ${byteLength(stream.content)} >>\nstream\n${stream.content}\nendstream`;
    objects[stream.pageNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${FONT_REGULAR} 0 R /F2 ${FONT_BOLD} 0 R >> >> ` +
      `/Contents ${stream.contentNumber} 0 R >>`;
  }

  return assemble(objects, nextObject - 1);
}

function pageContentStream(page: RenderedLine[]): string {
  let y = TOP;
  const parts: string[] = [];

  for (const line of page) {
    y -= line.gapBefore + line.size + (LINE_HEIGHT - FONT_SIZE);
    if (!line.text) {
      continue;
    }

    const font = line.bold ? "F2" : "F1";
    parts.push(`BT /${font} ${line.size} Tf ${MARGIN} ${y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`);
  }

  return parts.join("\n");
}

function assemble(objects: string[], count: number): string {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let i = 1; i <= count; i += 1) {
    const body = objects[i] ?? "<< >>";
    offsets[i] = byteLength(pdf);
    pdf += `${i} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= count; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Standard Courier is Latin-1; drop anything outside it (e.g. em dashes → "-").
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
