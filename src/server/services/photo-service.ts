import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import { findOffering } from "@/server/repositories/offering-repository";
import { findRoom } from "@/server/repositories/room-repository";
import * as photos from "@/server/repositories/photo-repository";
import { recordAction } from "./audit";

const MAX_BYTES = 2_500_000;
const MAX_PHOTOS = 20;

/** Real file signatures, so a renamed file cannot pass as an image. */
const SIGNATURES: Array<{ mimeType: string; matches: (bytes: Uint8Array) => boolean }> = [
  { mimeType: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mimeType: "image/png",
    matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mimeType: "image/webp",
    matches: (b) =>
      String.fromCharCode(...b.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
  },
];

export function detectImageType(bytes: Uint8Array): string | null {
  return SIGNATURES.find((signature) => signature.matches(bytes))?.mimeType ?? null;
}

/** Which gallery: an experience's, a room's, or (neither set) the place's own. */
export interface PhotoTarget {
  offeringId?: string | null;
  roomId?: string | null;
}

/**
 * Whose gallery a photo belongs to. The place's and rooms' photos need rooms.manage (the same permission as
 * rooms and rates); an experience's photos need offerings.manage. The room or offering must be this business's.
 */
async function resolveOwner(ctx: TenantContext, target: PhotoTarget): Promise<photos.PhotoOwner> {
  const { offeringId = null, roomId = null } = target;
  if (offeringId && roomId) throw invalid("A photo belongs to a room or an experience, not both");
  if (offeringId) {
    requirePermission(ctx, "offerings.manage");
    if (!(await findOffering(prisma, ctx.businessId, offeringId))) throw notFound("Experience");
  } else {
    requirePermission(ctx, "rooms.manage");
    if (roomId && !(await findRoom(prisma, ctx.businessId, roomId))) throw notFound("Room");
  }
  return { businessId: ctx.businessId, offeringId, roomId };
}

export async function listGallery(ctx: TenantContext, target: PhotoTarget) {
  return photos.listPhotos(prisma, await resolveOwner(ctx, target));
}

export async function uploadPhoto(
  ctx: TenantContext,
  input: PhotoTarget & { bytes: Uint8Array<ArrayBuffer>; alt: string | null },
) {
  const owner = await resolveOwner(ctx, input);
  if (input.bytes.byteLength === 0) throw invalid("The file is empty");
  if (input.bytes.byteLength > MAX_BYTES) throw invalid("Photos must be smaller than 2.5 MB");
  const mimeType = detectImageType(input.bytes);
  if (!mimeType) throw invalid("Upload a JPEG, PNG or WebP photo");
  if ((await photos.countPhotos(prisma, owner)) >= MAX_PHOTOS) {
    throw invalid(`A gallery holds up to ${MAX_PHOTOS} photos. Delete one first.`);
  }
  const photo = await runInTransaction((tx) =>
    photos.addUploadedPhoto(tx, owner, { mimeType, bytes: input.bytes, alt: input.alt }),
  );
  await recordAction(ctx, "photo.added", "photo", photo.id);
  return photo;
}

export async function removePhoto(ctx: TenantContext, photoId: string) {
  const photo = await photos.findPhoto(prisma, ctx.businessId, photoId);
  if (!photo) throw notFound("Photo");
  await resolveOwner(ctx, photo);
  await runInTransaction((tx) => photos.deletePhoto(tx, ctx.businessId, photoId));
  await recordAction(ctx, "photo.removed", "photo", photoId);
}

export async function setCoverPhoto(ctx: TenantContext, photoId: string) {
  const photo = await photos.findPhoto(prisma, ctx.businessId, photoId);
  if (!photo) throw notFound("Photo");
  const owner = await resolveOwner(ctx, photo);
  await runInTransaction((tx) => photos.makeCover(tx, owner, photoId));
  await recordAction(ctx, "photo.cover", "photo", photoId);
}

/** Public: the bytes behind /api/images/{id}. Photos are public once on a listing. */
export function getImage(imageId: string) {
  return photos.findStoredImage(prisma, imageId);
}
