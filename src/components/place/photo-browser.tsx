"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import { SheetDialog } from "@/components/ui/sheet-dialog";

interface BrowserGroup {
  key: string;
  label: string;
  photos: Array<{ url: string; alt: string | null }>;
}

const OPEN_EVENT = "mabeet:photos";

/**
 * Every photo of a listing in a popup (a full-screen sheet on a phone), grouped like the photo tour. Rendered
 * once per page; any `PhotosLink` opens it. The links still point at the photos page, for new tabs and sharing.
 */
export function PhotoBrowser({ groups, title }: { groups: BrowserGroup[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      setTarget((event as CustomEvent<string | null>).detail);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open && target) document.getElementById(`photos-${target}`)?.scrollIntoView({ block: "start" });
  }, [open, target]);

  return (
    <SheetDialog open={open} onClose={() => setOpen(false)} title={title} wide>
      {groups.length > 1 && (
        <nav className="sticky top-0 z-10 overflow-x-auto border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <ul className="flex gap-2">
            {groups.map((group) => (
              <li key={group.key}>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(`photos-${group.key}`)?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 ring-line hover:bg-surface-2"
                >
                  {group.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="px-4 pb-8 sm:px-8">
        {groups.map((group) => (
          <section
            key={group.key}
            id={`photos-${group.key}`}
            className="scroll-mt-16 border-b border-line py-8 last:border-0 md:grid md:grid-cols-[180px_1fr] md:gap-8"
          >
            {groups.length > 1 && <h3 className="text-lg font-semibold">{group.label}</h3>}
            <ul
              className={`grid gap-3 sm:grid-cols-2 ${groups.length > 1 ? "mt-4 md:mt-0" : "md:col-span-2"}`}
            >
              {group.photos.map((photo, index) => (
                <li
                  key={photo.url}
                  className={index === 0 && group.photos.length % 2 === 1 ? "sm:col-span-2" : undefined}
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                    <Image
                      src={photo.url}
                      alt={photo.alt ?? group.label}
                      fill
                      sizes="(min-width: 768px) 30vw, 100vw"
                      className="object-cover"
                    />
                  </span>
                  {photo.alt && <p className="mt-1 text-sm text-muted">{photo.alt}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SheetDialog>
  );
}

/** A link to the photos page that opens the popup instead, at one group if given. Ctrl/⌘-click still opens a tab. */
export function PhotosLink({
  href,
  group,
  className,
  children,
}: {
  href: string;
  group?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={group ? `${href}#${group}` : href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: group ?? null }));
      }}
    >
      {children}
    </a>
  );
}
