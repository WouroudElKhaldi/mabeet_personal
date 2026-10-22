import { ExternalLink } from "lucide-react";

/**
 * A Google map for a place or a meeting point. The embed needs no API key; it uses exact coordinates
 * when the host set them, and otherwise searches the written address.
 */
export function PlaceMap({
  title,
  latitude,
  longitude,
  address,
  label,
  openLabel,
}: {
  title: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  /** Shown under the map, e.g. the area or the meeting point. */
  label: string | null;
  openLabel: string;
}) {
  const query =
    latitude !== null && longitude !== null
      ? `${latitude},${longitude}`
      : address
        ? `${address}, Lebanon`
        : null;
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return (
    <section className="mt-12 border-t border-line pt-12">
      <h2 className="text-[1.375rem] font-semibold">{title}</h2>
      {label && <p className="mt-1 text-muted">{label}</p>}
      <div className="mt-5 aspect-[16/9] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line sm:aspect-[21/9]">
        <iframe
          title={title}
          src={`https://maps.google.com/maps?q=${encoded}&z=13&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="size-full border-0"
        />
      </div>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
      >
        {openLabel}
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </section>
  );
}
