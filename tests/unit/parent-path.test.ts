import { describe, expect, it } from "vitest";
import { parentPath } from "@/lib/parent-path";

describe("Back goes to the page this one belongs to", () => {
  it("has no Back on the home page or an area's home", () => {
    for (const home of ["/", "/dashboard", "/dashboard/biz_1", "/admin", "/admin/"]) {
      expect(parentPath(home)).toBeNull();
    }
  });

  it("sends listings to search and bookings to your trips", () => {
    expect(parentPath("/p/dar-al-sindiyan")).toBe("/search");
    expect(parentPath("/o/olive-harvest")).toBe("/search");
    expect(parentPath("/b/abc123")).toBe("/account");
  });

  it("otherwise goes one level up", () => {
    expect(parentPath("/p/dar-al-sindiyan/contact")).toBe("/p/dar-al-sindiyan");
    expect(parentPath("/p/dar-al-sindiyan/book")).toBe("/p/dar-al-sindiyan");
    expect(parentPath("/account/favorites")).toBe("/account");
    expect(parentPath("/dashboard/biz_1/rooms")).toBe("/dashboard/biz_1");
    expect(parentPath("/admin/hosts/user_1")).toBe("/admin/hosts");
    expect(parentPath("/search")).toBe("/");
    expect(parentPath("/sign-in")).toBe("/");
  });
});
