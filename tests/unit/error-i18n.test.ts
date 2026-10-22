import { describe, expect, it } from "vitest";
import { localizeError, requestLocale } from "@/server/http/error-i18n";

describe("server error messages in the visitor's language", () => {
  it("keeps English as it is", () => {
    expect(localizeError("Room not found", "en")).toBe("Room not found");
  });

  it("translates fixed messages to Arabic", () => {
    expect(localizeError("Those dates were just taken. Please pick other dates.", "ar")).toBe(
      "حُجزت هذه التواريخ للتوّ. اختر تواريخ أخرى من فضلك.",
    );
  });

  it("carries numbers through and translates entity and status words", () => {
    expect(localizeError("This room sleeps up to 4", "ar")).toBe("تتّسع هذه الغرفة لـ 4 كحدّ أقصى");
    expect(localizeError("Calendar link not found", "ar")).toBe("رابط التقويم غير موجود");
    expect(localizeError("A confirmed booking cannot become held", "ar")).toBe(
      "لا يمكن تحويل حجز مؤكَّد إلى مؤقت",
    );
  });

  it("passes unknown messages through rather than guessing", () => {
    expect(localizeError("Something brand new happened", "ar")).toBe("Something brand new happened");
  });

  it("reads the locale cookie first, then the browser language", () => {
    const request = (headers: Record<string, string>) => new Request("http://x", { headers });
    expect(requestLocale(request({ cookie: "a=1; locale=ar" }))).toBe("ar");
    expect(requestLocale(request({ "accept-language": "ar-LB,ar;q=0.9" }))).toBe("ar");
    expect(requestLocale(request({ cookie: "locale=en", "accept-language": "ar" }))).toBe("en");
    expect(requestLocale(request({}))).toBe("en");
  });
});
