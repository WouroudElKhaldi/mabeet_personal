import { uniqueSlug } from "@/lib/slug";
import { DEFAULT_ROLE_TEMPLATES } from "@/server/auth/permissions";
import { prisma, runInTransaction } from "@/server/db/client";
import { createBusinessWithOwner, slugExists } from "@/server/repositories/business-repository";

export interface NewWorkspace {
  name: string;
  area?: string;
  phone?: string;
}

/** Creates a business with an owner role, starter roles the owner can edit, and the creator as owner. */
export async function createWorkspace(ownerUserId: string, input: NewWorkspace) {
  const slug = await uniqueSlug(input.name, "place", (candidate) => slugExists(prisma, candidate));
  return runInTransaction((tx) =>
    createBusinessWithOwner(tx, {
      business: { ...input, slug },
      ownerUserId,
      starterRoles: DEFAULT_ROLE_TEMPLATES,
    }),
  );
}
