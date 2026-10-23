import { beforeEach, describe, expect, it } from "vitest";
import { POST as sendMessage } from "@/app/api/public/places/[slug]/messages/route";
import { createKey } from "@/server/services/api-key-service";
import { getHostSection, listHosts, saveMyHostProfile } from "@/server/services/host-service";
import { resolveContext } from "@/server/services/team-service";
import { createPlace, createUser, prisma, resetDatabase } from "./helpers";

const profile = {
  displayName: "Rima",
  bio: "Three generations in Deir el Qamar.",
  phone: "+96171123456",
  whatsapp: "+96171123456",
  city: "Deir el Qamar",
  languages: ["ar", "en"] as Array<"ar" | "en" | "fr">,
  hostingSince: 2015,
  showOnListings: false,
  contactBy: "BOTH" as const,
};

describe("hosts and their profile", () => {
  beforeEach(resetDatabase);

  it("keeps a host's profile private until they choose to show it", async () => {
    const { business, ctx } = await createPlace();
    await saveMyHostProfile(ctx, profile);
    expect(await getHostSection(business)).toMatchObject({ personal: false, name: business.name, bio: null });

    await saveMyHostProfile(ctx, { ...profile, showOnListings: true });
    expect(await getHostSection(business)).toMatchObject({
      personal: true,
      name: "Rima",
      languages: ["ar", "en"],
    });
  });

  it("lets the host choose WhatsApp, the Contact host page, or both, for every place", async () => {
    const { business, ctx } = await createPlace();
    const place = await prisma.business.update({
      where: { id: business.id },
      data: { whatsapp: "+96170000000" },
    });
    const ask = (body: unknown) =>
      sendMessage(
        new Request(`http://localhost/api/public/places/${business.slug}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ slug: business.slug }) },
      );
    const question = { name: "Nour", email: "nour@example.com", message: "Is there parking near the house?" };

    expect(await getHostSection(place)).toMatchObject({ whatsapp: "+96170000000", acceptsMessages: true });
    expect((await ask(question)).status).toBe(201);
    expect((await ask({ ...question, message: "short" })).status).toBe(400);

    await saveMyHostProfile(ctx, { ...profile, contactBy: "MESSAGE" });
    expect(await getHostSection(place)).toMatchObject({ whatsapp: null, acceptsMessages: true });

    await saveMyHostProfile(ctx, { ...profile, contactBy: "WHATSAPP" });
    expect(await getHostSection(place)).toMatchObject({ acceptsMessages: false });
    expect((await ask(question)).status).toBe(403);
  });

  it("lists a host with five businesses once, with all five", async () => {
    const admin = await createUser("Admin");
    await prisma.user.update({ where: { id: admin.id }, data: { platformRole: "SUPER_ADMIN" } });
    const first = await createPlace("Beit One");
    for (const name of ["Beit Two", "Beit Three", "Beit Four", "Beit Five"]) {
      const other = await createPlace(name);
      await prisma.membership.update({
        where: { id: other.ctx.membershipId },
        data: { userId: first.owner.id },
      });
      await prisma.user.delete({ where: { id: other.owner.id } });
    }
    const hosts = await listHosts({ id: admin.id, platformRole: "SUPER_ADMIN" });
    expect(hosts).toHaveLength(1);
    expect(hosts[0]?.memberships).toHaveLength(5);
  });
});

describe("platform admins in any business", () => {
  beforeEach(resetDatabase);

  it("get every permission on the website, but nobody else does", async () => {
    const { business } = await createPlace();
    const admin = await createUser("Admin");
    await prisma.user.update({ where: { id: admin.id }, data: { platformRole: "SUPER_ADMIN" } });
    const outsider = await createUser("Outsider");

    const ctx = await resolveContext(admin.id, business.id);
    expect(ctx).toMatchObject({ platformAdmin: true, isOwner: true });
    expect(ctx?.permissions.has("settings.manage")).toBe(true);
    expect(await resolveContext(outsider.id, business.id)).toBeNull();
    // Never through AI keys or tokens.
    expect(await resolveContext(admin.id, business.id, "mcp")).toBeNull();
  });

  it("can't create AI keys in a business they don't belong to", async () => {
    const { business } = await createPlace();
    const admin = await createUser("Admin");
    await prisma.user.update({ where: { id: admin.id }, data: { platformRole: "SUPER_ADMIN" } });
    const ctx = (await resolveContext(admin.id, business.id))!;
    await expect(
      createKey(ctx, { name: "admin key", canWrite: false, expiresInDays: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
