import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Browse } from "@/components/browse/browse";
import { searchParams as searchSchema } from "@/server/validation/schemas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("searchPage");
  return { title: t("title") };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return <Browse state={searchSchema.parse(await searchParams)} basePath="/search" />;
}
