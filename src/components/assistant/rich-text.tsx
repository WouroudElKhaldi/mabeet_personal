/**
 * Renders the little markdown AI replies use: **bold** and line breaks. Everything else stays plain text,
 * so a reply can never inject markup.
 */
export function RichText({ text }: { text: string }) {
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
