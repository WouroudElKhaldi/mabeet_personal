import type { ReactNode } from "react";

type Block =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const SEPARATOR_CELL = /^:?-{2,}:?$/;

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

/** Splits a reply into paragraphs, lists and tables: the only markdown shapes AI replies use. */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.some((line) => line.trim()))
      blocks.push({ kind: "text", text: paragraph.join("\n").trim() });
    paragraph = [];
  };
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (TABLE_ROW.test(line)) {
      endParagraph();
      const rows: string[][] = [];
      while (index < lines.length && TABLE_ROW.test(lines[index]!)) rows.push(cellsOf(lines[index++]!));
      index--;
      const [header = [], ...body] = rows.filter(
        (cells) => !cells.every((cell) => SEPARATOR_CELL.test(cell)),
      );
      blocks.push({ kind: "table", header, rows: body });
    } else if (LIST_ITEM.test(line)) {
      endParagraph();
      const last = blocks.at(-1);
      const item = line.replace(LIST_ITEM, "");
      if (last?.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
    } else if (!line.trim()) {
      endParagraph();
    } else {
      paragraph.push(line);
    }
  }
  endParagraph();
  return blocks;
}

/** **bold** inside a line; everything else stays plain text. */
function Inline({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

/**
 * Renders the little markdown AI replies use: paragraphs, **bold**, bullet lists and tables. It never renders
 * HTML, so a reply can never inject markup.
 */
export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {toBlocks(text).map((block, index) => {
        if (block.kind === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 ps-5 marker:text-muted">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "table") {
          return (
            <div key={index} className="overflow-x-auto rounded-xl ring-1 ring-line">
              <table className="w-full text-start text-sm tabular-nums">
                <thead className="bg-paper text-xs font-bold tracking-wide text-muted uppercase">
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th key={cellIndex} scope="col" className="px-3 py-2 text-start whitespace-nowrap">
                        <Inline text={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 align-top">
                          <Inline text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line">
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
