import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { findPageOr404 } from "@/server/http/page";
import { getOffering } from "@/server/services/directory-service";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const offering = await findPageOr404(getOffering((await params).slug));
  const t = await getTranslations("photoTour");
  return { title: `${t("title")} · ${offering.title}` };
}

/** Every photo of an experience or service. */
export default async function OfferingPhotosPage({ params }: PageProps) {
  const { slug } = await params;
  const [t, offering] = await Promise.all([getTranslations("photoTour"), findPageOr404(getOffering(slug))]);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
      <h1 className="mt-4 text-3xl font-semibold">{t("title")}</h1>
      {offering.photos.length === 0 ? (
        <p className="mt-6 text-muted">{t("none")}</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {offering.photos.map((photo, index) => (
            <li key={photo.url} className={index === 0 ? "sm:col-span-2" : undefined}>
              <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                <Image
                  src={photo.url}
                  alt={photo.alt ?? offering.title}
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
