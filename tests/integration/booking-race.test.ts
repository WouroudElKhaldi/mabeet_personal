import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { requestBooking } from "@/server/services/booking-service";
import { createPlace, guestRequest, prisma, resetDatabase } from "./helpers";

const PARALLEL_GUESTS = 20;

describe("the last free room", () => {
  beforeEach(resetDatabase);

  it(`goes to exactly one of ${PARALLEL_GUESTS} guests asking at the same moment`, async () => {
    const { business, room } = await createPlace();

    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL_GUESTS }, () =>
        requestBooking(guestRequest(business.slug, room.id, 20, 2)),
      ),
    );

    const winners = results.filter((result) => result.status === "fulfilled");
    const losers = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(PARALLEL_GUESTS - 1);
    for (const { reason } of losers) {
      expect(reason).toBeInstanceOf(AppError);
      expect((reason as AppError).code).toBe("CONFLICT");
    }
    expect(await prisma.booking.count({ where: { roomId: room.id, status: "HELD" } })).toBe(1);
    expect(await prisma.occupancy.count({ where: { roomId: room.id, active: true } })).toBe(1);
  });

  it("lets parallel guests book different nights of the same room", async () => {
    const { business, room } = await createPlace();
    const results = await Promise.allSettled(
      [30, 32, 34].map((offset) => requestBooking(guestRequest(business.slug, room.id, offset, 2))),
    );
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  });
});
