"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { unauthenticated } from "@/server/errors";
import { getCurrentUser } from "@/server/http/session";
import { setFavorite } from "@/server/services/favorite-service";

const input = z.object({ slug: z.string().min(1).max(64), favorite: z.boolean() });

export async function toggleFavorite(slug: string, favorite: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  const parsed = input.parse({ slug, favorite });
  await setFavorite(user.id, parsed.slug, parsed.favorite);
  revalidatePath("/account/favorites");
}
