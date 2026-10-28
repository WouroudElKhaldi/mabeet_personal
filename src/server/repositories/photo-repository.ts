import type { PhotoArea, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// Photos of a place (offeringId and roomId empty), of one room, or of an experience or service, and their bytes.

export interface PhotoOwner {
  businessId: string;
  /** Both null for the place's own photos; at most one is set. */
  offeringId: string | null;
  roomId: string | null;
}

const ownerWhere = (owner: PhotoOwner): Prisma.PhotoWhereInput => ({
  businessId: owner.businessId,
  offeringId: owner.offeringId,
  roomId: owner.roomId,
});

export function listPhotos(db: Db, owner: PhotoOwner) {
  return db.photo.findMany({
    where: ownerWhere(owner),
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, url: true, alt: true, area: true, position: true },
  });
}

export function countPhotos(db: Db, owner: PhotoOwner) {
  return db.photo.count({ where: ownerWhere(owner) });
}

/** Stores the bytes and adds the photo at the end of the gallery, in one transaction. */
export async function addUploadedPhoto(
  tx: Tx,
  owner: PhotoOwner,
  image: { mimeType: string; bytes: Uint8Array<ArrayBuffer>; alt: string | null; area: PhotoArea | null },
) {
  const stored = await tx.storedImage.create({
    data: {
      businessId: owner.businessId,
      mimeType: image.mimeType,
      bytes: image.bytes,
      size: image.bytes.byteLength,
    },
    select: { id: true },
  });
  const last = await tx.photo.aggregate({ where: ownerWhere(owner), _max: { position: true } });
  return tx.photo.create({
    data: {
      businessId: owner.businessId,
      offeringId: owner.offeringId,
      roomId: owner.roomId,
      url: `/api/images/${stored.id}`,
      alt: image.alt,
      area: image.area,
      position: (last._max.position ?? -1) + 1,
    },
    select: { id: true, url: true },
  });
}

/** Tags a photo with the part of the place it shows, and its caption. */
export async function describePhoto(
  db: Db,
  businessId: string,
  photoId: string,
  data: { area?: PhotoArea | null; alt?: string | null },
) {
  const { count } = await db.photo.updateMany({ where: { id: photoId, businessId }, data });
  return count > 0;
}

export function findPhoto(db: Db, businessId: string, photoId: string) {
  return db.photo.findFirst({ where: { id: photoId, businessId } });
}

/** Deletes a photo, and its stored bytes when the photo was uploaded here. */
export async function deletePhoto(tx: Tx, businessId: string, photoId: string) {
  const photo = await tx.photo.findFirst({ where: { id: photoId, businessId } });
  if (!photo) return false;
  await tx.photo.delete({ where: { id: photo.id } });
  const storedId = photo.url.match(/^\/api\/images\/([a-z0-9]+)$/)?.[1];
  if (storedId) await tx.storedImage.deleteMany({ where: { id: storedId, businessId } });
  return true;
}

/** Puts a photo first in its gallery: the cover shown on cards. */
export async function makeCover(tx: Tx, owner: PhotoOwner, photoId: string) {
  const first = await tx.photo.aggregate({ where: ownerWhere(owner), _min: { position: true } });
  const { count } = await tx.photo.updateMany({
    where: { ...ownerWhere(owner), id: photoId },
    data: { position: (first._min.position ?? 0) - 1 },
  });
  return count > 0;
}

export function findStoredImage(db: Db, imageId: string) {
  return db.storedImage.findUnique({ where: { id: imageId }, select: { mimeType: true, bytes: true } });
}
