/**
 * Writes docs/erd.md: a Mermaid entity-relationship diagram generated from the Prisma schema itself,
 * so it can never drift from the real database. Run: pnpm docs:erd
 */
import { writeFileSync } from "node:fs";
import { Prisma } from "@prisma/client";

const models = Prisma.dmmf.datamodel.models;
const lines: string[] = ["erDiagram"];

for (const model of models) {
  lines.push(`  ${model.name} {`);
  for (const field of model.fields.filter((candidate) => candidate.kind !== "object")) {
    const type = `${field.type}${field.isList ? "[]" : ""}`.replace(/[^A-Za-z0-9[\]_]/g, "");
    const key = field.isId ? " PK" : field.relationName ? "" : field.isUnique ? " UK" : "";
    const foreign = model.fields.some(
      (relation) => relation.kind === "object" && relation.relationFromFields?.includes(field.name),
    );
    lines.push(`    ${type.replace("[]", "_list")} ${field.name}${key}${foreign ? " FK" : ""}`);
  }
  lines.push("  }");
}

// One line per relation, drawn from the side that holds the foreign key.
for (const model of models) {
  for (const field of model.fields) {
    if (field.kind !== "object" || !field.relationFromFields?.length) continue;
    const many = !model.fields.some(
      (other) => other.isUnique && field.relationFromFields?.includes(other.name),
    );
    const optional = !field.isRequired;
    const cardinality = `${optional ? "|o" : "||"}--${many ? "o{" : "o|"}`;
    lines.push(`  ${field.type} ${cardinality} ${model.name} : "${field.name}"`);
  }
}

const doc = `# Database diagram

Generated from \`prisma/schema.prisma\` by \`pnpm docs:erd\`. Do not edit by hand.

Guarantees that Prisma cannot express live in hand-written SQL migrations:

- \`occupancy_no_overlap\`: an EXCLUDE constraint, so no two active stays share a room night.
- \`session_seats_guard\`: a trigger, so a session never sells more seats than it has.
- CHECK constraints on date ranges, guest counts, ratings, seats and payments.

\`\`\`mermaid
${lines.join("\n")}
\`\`\`
`;

writeFileSync("docs/erd.md", doc);
console.log(`docs/erd.md: ${models.length} tables`);
