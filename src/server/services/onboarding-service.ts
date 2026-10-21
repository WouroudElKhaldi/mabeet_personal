import { slugify } from "@/lib/slug";
import { secureToken } from "@/lib/tokens";
import { DEFAULT_ROLE_TEMPLATES } from "@/server/auth/permissions";
import { prisma, runInTransaction } from "@/server/db/client";
import { createBusinessWithOwner, slugExists } from "@/server/repositories/business-repository";

export interface NewWorkspace {
  name: string;
  area?: string;
  phone?: string;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "place";
  if (!(await slugExists(prisma, base))) return base;
  return `${base}-${secureToken(4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;
}

/** Creates a business with an owner role, starter roles the owner can edit, and the creator as owner. */
export async function createWorkspace(ownerUserId: string, input: NewWorkspace) {
  const slug = await uniqueSlug(input.name);
  return runInTransaction((tx) =>
    createBusinessWithOwner(tx, {
      business: { ...input, slug },
      ownerUserId,
      starterRoles: DEFAULT_ROLE_TEMPLATES,
    }),
  );
}
