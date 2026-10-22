import type { Db } from "@/server/db/client";

// Website-wide settings: a single row with id "site".

const SITE_ID = "site";

export function findSiteSettings(db: Db) {
  return db.siteSetting.findUnique({ where: { id: SITE_ID } });
}

export function saveSitePalette(db: Db, palette: string, updatedById: string) {
  return db.siteSetting.upsert({
    where: { id: SITE_ID },
    create: { id: SITE_ID, palette, updatedById },
    update: { palette, updatedById },
  });
}
