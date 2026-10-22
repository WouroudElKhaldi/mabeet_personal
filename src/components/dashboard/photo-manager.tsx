"use client";

import { ImagePlus, LoaderCircle, Pin, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ConfirmOptions, useConfirm } from "@/components/ui/confirm-dialog";
import { useRef, useState } from "react";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

export interface GalleryPhoto {
  id: string;
  url: string;
  alt: string | null;
}

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Shrinks a photo in the browser before upload, so hosts on mobile data send ~300 KB instead of 8 MB. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  return blob ?? file;
}

/** Upload, delete and pick the cover of the photos of a place, one of its rooms, or an experience. */
export function PhotoManager({
  businessId,
  offeringId = null,
  roomId = null,
  photos,
}: {
  businessId: string;
  offeringId?: string | null;
  roomId?: string | null;
  photos: GalleryPhoto[];
}) {
  const t = useTranslations("dashboard.photos");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { run, pending, error } = useAction();
  const tConfirm = useTranslations("confirm");
  const [ask, confirmDialog] = useConfirm();
  /** Runs `action` only after the person confirms. */
  const confirmThen = async (options: ConfirmOptions, action: () => Promise<unknown>) => {
    if ((await ask(options)).confirmed) run(action);
  };
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setFailed(false);
    setProgress({ done: 0, total: list.length });
    let anyFailed = false;
    for (const [index, file] of list.entries()) {
      try {
        const form = new FormData();
        form.set("file", await shrink(file), file.name);
        if (offeringId) form.set("offeringId", offeringId);
        if (roomId) form.set("roomId", roomId);
        const response = await fetch(`/api/workspaces/${businessId}/photos`, { method: "POST", body: form });
        if (!response.ok) anyFailed = true;
      } catch {
        anyFailed = true;
      }
      setProgress({ done: index + 1, total: list.length });
    }
    setProgress(null);
    setFailed(anyFailed);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const busy = pending || progress !== null;

  return (
    <section className="grid gap-3">
      {confirmDialog}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t(roomId ? "roomTitle" : "title")}</h2>
          <p className="max-w-xl text-sm text-muted">{t(roomId ? "roomHint" : "hint")}</p>
        </div>
        <label
          className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90 ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {progress ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {progress ? t("uploading", progress) : t("upload")}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(event) => void upload(event.target.files)}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2"
            >
              <Image src={photo.url} alt={photo.alt ?? ""} fill sizes="200px" className="object-cover" />
              {index === 0 && (
                <span className="absolute start-2 top-2 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold shadow-soft">
                  {t("cover")}
                </span>
              )}
              <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {index > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t("makeCover")}
                    title={t("makeCover")}
                    onClick={() =>
                      run(() =>
                        api.patch(`/api/workspaces/${businessId}/photos/${photo.id}`, { cover: true }),
                      )
                    }
                    className="grid size-8 place-items-center rounded-full bg-surface shadow-soft hover:scale-105"
                  >
                    <Pin className="size-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  aria-label={t("remove")}
                  title={t("remove")}
                  onClick={() =>
                    void confirmThen(
                      {
                        title: tConfirm("deletePhoto.title"),
                        body: tConfirm("deletePhoto.body"),
                        confirmLabel: tConfirm("deletePhoto.confirm"),
                        danger: true,
                      },
                      () => api.delete(`/api/workspaces/${businessId}/photos/${photo.id}`),
                    )
                  }
                  className="grid size-8 place-items-center rounded-full bg-surface text-danger shadow-soft hover:scale-105"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(error || failed) && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error ?? t("failed")}
        </p>
      )}
    </section>
  );
}
