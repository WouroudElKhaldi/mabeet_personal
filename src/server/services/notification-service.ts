import { randomUUID } from "node:crypto";
import type { BookingStatus } from "@prisma/client";
import { parseIsoDate } from "@/lib/dates";
import { formatMoney, formatStayDates } from "@/lib/format";
import { formatSessionTime } from "@/lib/zoned-time";
import { prisma } from "@/server/db/client";
import { inBackground } from "@/server/email/background";
import { sendEmail } from "@/server/email/send";
import { isArabic } from "@/config/appearance";
import { type Detail, type Message, render } from "@/server/email/templates";
import { env } from "@/server/env";
import type { PushMessage } from "@/server/push/send";
import {
  findBookingForNotice,
  findSessionBookingForNotice,
  listBookingDeciders,
} from "@/server/repositories/notification-repository";
import { pushToGuest, pushToPeople } from "./push-service";

// Who hears about what. Every notify* function queues its emails and push notifications in the background and
// never throws: a mail or push outage must not undo or slow down a booking. Guests get emails in the language they booked in;
// each host gets them in their account's language. Lebanese readers get the Arabic emails.

type Lang = "en" | "ar";
const lang = (locale: string | null | undefined): Lang => (locale && isArabic(locale) ? "ar" : "en");
const url = (path: string) => new URL(path, env.BETTER_AUTH_URL).toString();

/** What every booking email needs, whether it books nights in a room or seats in a session. */
interface Notice {
  id: string;
  kind: "stay" | "session";
  status: BookingStatus;
  reference: string;
  publicToken: string;
  businessId: string;
  businessName: string;
  /** The guest's language. */
  locale: Lang;
  seats: number;
  guestName: string;
  guestEmail: string | null;
  /** The guest's account, when they booked signed in; their devices get the push notifications too. */
  guestUserId: string | null;
  guestNote: string | null;
  depositCents: number;
  currency: string;
  depositInstructions: string | null;
  holdExpiresAt: Date | null;
  cancelReason: string | null;
  /** The dates of a stay or the session time, in a given language. */
  when: (lang: Lang) => string;
  /** The facts table, in a given language. */
  details: (lang: Lang) => Detail[];
}

const LABELS = {
  en: {
    place: "Place",
    room: "Room",
    dates: "Dates",
    guests: "Guests",
    total: "Total",
    reference: "Reference",
    experience: "Experience",
    host: "Host",
    when: "When",
    meetingPoint: "Meeting point",
  },
  ar: {
    place: "المكان",
    room: "الغرفة",
    dates: "التواريخ",
    guests: "الضيوف",
    total: "المجموع",
    reference: "رقم الحجز",
    experience: "التجربة",
    host: "المضيف",
    when: "الموعد",
    meetingPoint: "نقطة اللقاء",
  },
} as const;

async function stayNotice(bookingId: string): Promise<Notice | null> {
  const booking = await findBookingForNotice(prisma, bookingId);
  if (!booking) return null;
  const when = (l: Lang) => formatStayDates(booking.checkIn, booking.checkOut, l);
  return {
    id: booking.id,
    kind: "stay",
    status: booking.status,
    reference: booking.reference,
    publicToken: booking.publicToken,
    businessId: booking.business.id,
    businessName: booking.business.name,
    locale: lang(booking.locale),
    seats: booking.guestCount,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail ?? booking.guestUser?.email ?? null,
    guestUserId: booking.guestUserId,
    guestNote: booking.guestNote,
    depositCents: booking.depositCents,
    currency: booking.currency,
    depositInstructions: booking.business.depositInstructions,
    holdExpiresAt: booking.holdExpiresAt,
    cancelReason: booking.cancelReason,
    when,
    details: (l) => [
      { label: LABELS[l].place, value: booking.business.name },
      { label: LABELS[l].room, value: booking.room.name },
      { label: LABELS[l].dates, value: when(l) },
      { label: LABELS[l].guests, value: String(booking.guestCount) },
      { label: LABELS[l].total, value: formatMoney(booking.totalCents, booking.currency, l) },
      { label: LABELS[l].reference, value: booking.reference },
    ],
  };
}

async function sessionNotice(bookingId: string): Promise<Notice | null> {
  const booking = await findSessionBookingForNotice(prisma, bookingId);
  if (!booking) return null;
  const when = (l: Lang) => formatSessionTime(booking.session.startsAt, l, booking.business.timezone);
  return {
    id: booking.id,
    kind: "session",
    status: booking.status,
    reference: booking.reference,
    publicToken: booking.publicToken,
    businessId: booking.business.id,
    businessName: booking.business.name,
    locale: lang(booking.locale),
    seats: booking.seats,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail ?? booking.guestUser?.email ?? null,
    guestUserId: booking.guestUserId,
    guestNote: booking.guestNote,
    depositCents: booking.depositCents,
    currency: booking.currency,
    depositInstructions: booking.business.depositInstructions,
    holdExpiresAt: booking.holdExpiresAt,
    cancelReason: booking.cancelReason,
    when,
    details: (l) => [
      { label: LABELS[l].experience, value: booking.offering.title },
      { label: LABELS[l].host, value: booking.business.name },
      { label: LABELS[l].when, value: when(l) },
      ...(booking.offering.meetingPoint
        ? [{ label: LABELS[l].meetingPoint, value: booking.offering.meetingPoint }]
        : []),
      { label: LABELS[l].guests, value: String(booking.seats) },
      { label: LABELS[l].total, value: formatMoney(booking.totalCents, booking.currency, l) },
      { label: LABELS[l].reference, value: booking.reference },
    ],
  };
}

const load = (kind: Notice["kind"], id: string) => (kind === "stay" ? stayNotice(id) : sessionNotice(id));

/** "your room" / "your seats", as a sentence subject. */
function thing(notice: Notice, l: Lang): string {
  if (l === "ar") return notice.kind === "stay" ? "غرفتك" : notice.seats === 1 ? "مقعدك" : "مقاعدك";
  return notice.kind === "stay" ? "your room" : notice.seats === 1 ? "your seat" : "your seats";
}

const formatHold = (date: Date, l: Lang) =>
  new Intl.DateTimeFormat(l, { dateStyle: "medium", timeStyle: "short" }).format(date);

type Letter = { subject: string; idempotencyKey: string; message: Message; replyTo?: string };

/** The push version of an email: its title, first paragraph and button link. */
const pushOf = (message: Message): PushMessage => ({
  title: message.title,
  body: message.body[0] ?? "",
  url: message.action?.url ?? url("/"),
});

/** Tells the people who can confirm bookings: one email per language, and a push to each of their devices. */
async function tellHosts(businessId: string, build: (l: Lang) => Letter) {
  const hosts = await listBookingDeciders(prisma, businessId);
  const languages = [...new Set(hosts.map((host) => lang(host.locale)))];
  await Promise.all([
    ...languages.map((l) => {
      const { subject, idempotencyKey, message, replyTo } = build(l);
      return sendEmail({
        to: hosts.filter((host) => lang(host.locale) === l).map((host) => host.email),
        idempotencyKey: `${idempotencyKey}-${l}`,
        replyTo,
        ...render(subject, message, l),
      });
    }),
    pushToPeople(
      hosts.map((host) => host.id),
      (locale) => pushOf(build(lang(locale)).message),
    ),
  ]);
}

/** Tells the guest by email, when they left one, and on every device following the booking. */
async function tellGuest(notice: Notice, { subject, idempotencyKey, message }: Letter) {
  await Promise.all([
    notice.guestEmail
      ? sendEmail({ to: notice.guestEmail, idempotencyKey, ...render(subject, message, notice.locale) })
      : undefined,
    pushToGuest(notice.publicToken, notice.guestUserId, pushOf(message)),
  ]);
}

/** A guest asked for a booking: the guest gets a receipt, the people who can confirm get a nudge. */
export function notifyBookingRequested(bookingId: string, kind: Notice["kind"] = "stay"): void {
  inBackground("booking requested notices", async () => {
    const notice = await load(kind, bookingId);
    if (!notice) return;
    const l = notice.locale;
    const held = notice.holdExpiresAt ? formatHold(notice.holdExpiresAt, l) : null;
    const deposit = formatMoney(notice.depositCents, notice.currency, l);
    const what = thing(notice, l);
    const copy =
      l === "ar"
        ? {
            subject: `طلبك لدى ${notice.businessName} (${notice.reference})`,
            kicker: "طلب حجز",
            title: `${what} لدى ${notice.businessName} محجوزة لك مؤقتًا`,
            body: [
              `مرحبًا ${notice.guestName}، وصل طلبك إلى المضيف. لا يمكن لأحد آخر أخذ ${what} ريثما يقرّر${held ? ` (حتى ${held})` : ""}.`,
              `لتثبيت الحجز، أرسل العربون ${deposit}. ${notice.depositInstructions ?? "سيخبرك المضيف بطريقة الدفع."}`,
            ],
            action: "اعرض حجزك",
            footnote: "احتفظ بهذا البريد: الرابط يعرض دائمًا آخر حالة لحجزك.",
          }
        : {
            subject: `Your request to ${notice.businessName} (${notice.reference})`,
            kicker: "Booking request",
            title: `${what[0]!.toUpperCase()}${what.slice(1)} at ${notice.businessName} ${what.endsWith("s") ? "are" : "is"} held`,
            body: [
              `Hi ${notice.guestName}, the host has your request. Nobody else can take ${what} while they decide${held ? ` (until ${held})` : ""}.`,
              `To secure it, send the ${deposit} deposit. ${notice.depositInstructions ?? "The host will tell you how to pay."}`,
            ],
            action: "See your booking",
            footnote: "Keep this email: the link always shows your booking's latest status.",
          };
    const guestLetter: Letter = {
      subject: copy.subject,
      idempotencyKey: `requested-guest-${notice.id}`,
      message: {
        kicker: copy.kicker,
        title: copy.title,
        body: copy.body,
        details: notice.details(l),
        action: { label: copy.action, url: url(`/b/${notice.publicToken}`) },
        footnote: copy.footnote,
      },
    };
    await Promise.all([
      tellGuest(notice, guestLetter),
      tellHosts(notice.businessId, (l) => ({
        subject:
          l === "ar"
            ? `طلب جديد: ${notice.guestName}، ${notice.when(l)}`
            : `New request: ${notice.guestName}, ${notice.when(l)}`,
        idempotencyKey: `requested-host-${notice.id}`,
        message: {
          kicker: l === "ar" ? "طلب جديد" : "New request",
          title: l === "ar" ? `${notice.guestName} يريد الحجز` : `${notice.guestName} wants to book`,
          body: [
            l === "ar"
              ? "الحجز محفوظ للضيف إلى أن تؤكّد أو ترفض. أجب سريعًا: الضيوف ينتظرونك."
              : "This is held for the guest until you confirm or decline. Answer soon: guests wait for you.",
            ...(notice.guestNote
              ? [l === "ar" ? `ملاحظتهم: «${notice.guestNote}»` : `Their note: "${notice.guestNote}"`]
              : []),
          ],
          details: notice.details(l),
          action: {
            label: l === "ar" ? "أجب على الطلب" : "Answer the request",
            url: url(`/dashboard/${notice.businessId}/bookings`),
          },
        },
      })),
    ]);
  });
}

type StatusCopy = { subject: string; title: string; body: string };

const STATUS_COPY: Record<Lang, Partial<Record<BookingStatus, StatusCopy>>> = {
  en: {
    AWAITING_PAYMENT: {
      subject: "Pay to secure it",
      title: "It's yours once you pay",
      body: "The dates are held for you. Pay online from your booking page, with Whish or a card, to confirm it before the time runs out.",
    },
    CONFIRMED: {
      subject: "Confirmed",
      title: "You're going! Your booking is confirmed",
      body: "The host confirmed your booking. Message them if you have any questions before the day.",
    },
    DECLINED: {
      subject: "Not available",
      title: "The host couldn't take this booking",
      body: "Nothing is held for you any more and you have not been charged. Other dates or places may still be free.",
    },
    CANCELLED: {
      subject: "Cancelled",
      title: "Your booking was cancelled",
      body: "Your booking has been cancelled. If you paid a deposit, the host's cancellation policy applies.",
    },
    EXPIRED: {
      subject: "Request expired",
      title: "Your request expired",
      body: "The host didn't answer in time, so the hold ended. You can request again, or try something else.",
    },
  },
  ar: {
    AWAITING_PAYMENT: {
      subject: "ادفع لتثبيت الحجز",
      title: "الحجز لك بمجرّد الدفع",
      body: "التواريخ محجوزة لك. ادفع عبر الإنترنت من صفحة حجزك، بـ Whish أو بالبطاقة، لتأكيده قبل انتهاء المهلة.",
    },
    CONFIRMED: {
      subject: "تم التأكيد",
      title: "أنت ذاهب! تم تأكيد حجزك",
      body: "أكّد المضيف حجزك. راسله إن كان لديك أي سؤال قبل الموعد.",
    },
    DECLINED: {
      subject: "غير متاح",
      title: "لم يتمكّن المضيف من قبول هذا الحجز",
      body: "لم يعد هناك شيء محجوز لك ولم يُخصم منك أي مبلغ. قد تكون تواريخ أو أماكن أخرى متاحة.",
    },
    CANCELLED: {
      subject: "أُلغي",
      title: "تم إلغاء حجزك",
      body: "أُلغي حجزك. إن كنت قد دفعت عربونًا، تنطبق سياسة الإلغاء لدى المضيف.",
    },
    EXPIRED: {
      subject: "انتهت مهلة الطلب",
      title: "انتهت مهلة طلبك",
      body: "لم يجب المضيف في الوقت المحدد، فانتهى الحجز المؤقت. يمكنك الطلب مجددًا أو تجربة شيء آخر.",
    },
  },
};

/** Tells the guest their booking moved: confirmed, declined, cancelled or expired. */
export function notifyBookingStatus(bookingId: string, kind: Notice["kind"] = "stay"): void {
  inBackground("booking status notice", async () => {
    const notice = await load(kind, bookingId);
    if (!notice) return;
    const l = notice.locale;
    const copy = STATUS_COPY[l][notice.status];
    if (!copy) return;
    const reason =
      notice.status === "CANCELLED" && notice.cancelReason
        ? [`${l === "ar" ? "السبب" : "Reason"}: ${notice.cancelReason}`]
        : [];
    await tellGuest(notice, {
      subject: `${copy.subject}: ${notice.businessName} (${notice.reference})`,
      idempotencyKey: `status-${notice.status}-${notice.id}`,
      message: {
        kicker: copy.subject,
        title: copy.title,
        body: [copy.body, ...reason],
        details: notice.details(l),
        action:
          notice.status === "CONFIRMED" || notice.status === "AWAITING_PAYMENT"
            ? { label: l === "ar" ? "اعرض حجزك" : "See your booking", url: url(`/b/${notice.publicToken}`) }
            : { label: l === "ar" ? "ابحث عن غيره" : "Find something else", url: url("/search") },
      },
    });
  });
}

/** The guest cancelled from their booking page: the people who can confirm bookings are told. */
export function notifyGuestCancelled(bookingId: string, kind: Notice["kind"] = "stay"): void {
  inBackground("guest cancelled notice", async () => {
    const notice = await load(kind, bookingId);
    if (!notice) return;
    await tellHosts(notice.businessId, (l) => ({
      subject:
        l === "ar"
          ? `ألغاه الضيف: ${notice.guestName}، ${notice.when(l)}`
          : `Cancelled by the guest: ${notice.guestName}, ${notice.when(l)}`,
      idempotencyKey: `guest-cancelled-${notice.id}`,
      message: {
        kicker: l === "ar" ? "إلغاء من الضيف" : "Guest cancelled",
        title: l === "ar" ? `ألغى ${notice.guestName} الحجز` : `${notice.guestName} cancelled`,
        body: [
          l === "ar"
            ? "ألغى الضيف من صفحة حجزه. التواريخ أو الأماكن متاحة من جديد."
            : "The guest cancelled from their booking page. The dates or spots are free again.",
          ...(notice.cancelReason
            ? [l === "ar" ? `سببه: «${notice.cancelReason}»` : `Their reason: "${notice.cancelReason}"`]
            : []),
        ],
        details: notice.details(l),
        action: {
          label: l === "ar" ? "افتح الحجوزات" : "Open bookings",
          url: url(`/dashboard/${notice.businessId}/bookings?tab=all`),
        },
      },
    }));
  });
}

/** A receipt when the host records a deposit or payment. */
export function notifyPaymentRecorded(
  bookingId: string,
  amountCents: number,
  paymentId: string,
  kind: Notice["kind"] = "stay",
): void {
  inBackground("payment receipt", async () => {
    const notice = await load(kind, bookingId);
    if (!notice) return;
    const l = notice.locale;
    const amount = formatMoney(amountCents, notice.currency, l);
    await tellGuest(notice, {
      idempotencyKey: `payment-${paymentId}`,
      subject:
        l === "ar"
          ? `تم استلام الدفعة: ${amount} عن ${notice.reference}`
          : `Payment received: ${amount} for ${notice.reference}`,
      message: {
        kicker: l === "ar" ? "تم استلام الدفعة" : "Payment received",
        title:
          l === "ar"
            ? `استلم ${notice.businessName} مبلغ ${amount}`
            : `${notice.businessName} received ${amount}`,
        body: [
          l === "ar"
            ? "شكرًا لك. سجّل المضيف دفعتك على هذا الحجز."
            : "Thank you. The host recorded your payment against this booking.",
        ],
        details: notice.details(l),
        action: {
          label: l === "ar" ? "اعرض حجزك" : "See your booking",
          url: url(`/b/${notice.publicToken}`),
        },
      },
    });
  });
}

/** An instant booking: nobody has to answer it, but the people who handle bookings should know at once. */
export function notifyHostsNewBooking(bookingId: string, kind: Notice["kind"] = "stay"): void {
  inBackground("instant booking notice", async () => {
    const notice = await load(kind, bookingId);
    if (!notice) return;
    await tellHosts(notice.businessId, (l) => ({
      subject:
        l === "ar"
          ? `حجز جديد: ${notice.guestName}، ${notice.when(l)}`
          : `New booking: ${notice.guestName}, ${notice.when(l)}`,
      idempotencyKey: `instant-host-${notice.id}`,
      message: {
        kicker: l === "ar" ? "حجز فوري" : "Instant booking",
        title: l === "ar" ? `${notice.guestName} حجز` : `${notice.guestName} booked`,
        body: [
          notice.status === "AWAITING_PAYMENT"
            ? l === "ar"
              ? "الحجز بانتظار دفع الضيف عبر الإنترنت. يتأكد تلقائيًا عند الدفع، أو يُلغى إن لم يدفع في الوقت."
              : "It waits for the guest's online payment, confirms itself when they pay, and ends if they don't in time."
            : l === "ar"
              ? "تم تأكيد الحجز فورًا. الدفع يتم لديك مباشرة."
              : "It was confirmed straight away. The guest pays you directly.",
        ],
        details: notice.details(l),
        action: {
          label: l === "ar" ? "افتح الحجوزات" : "Open bookings",
          url: url(`/dashboard/${notice.businessId}/bookings?tab=all`),
        },
      },
    }));
  });
}

/** The guest paid online: a receipt for them, and a note for the hosts (the money waits in their payouts). */
export function notifyOnlinePayment(
  bookingId: string,
  amountCents: number,
  paymentId: string,
  kind: Notice["kind"] = "stay",
): void {
  notifyPaymentRecorded(bookingId, amountCents, paymentId, kind);
  inBackground("online payment host notice", async () => {
    const notice = await load(kind, bookingId);
    if (!notice) return;
    await tellHosts(notice.businessId, (l) => {
      const amount = formatMoney(amountCents, notice.currency, l);
      return {
        subject:
          l === "ar"
            ? `دفع ${notice.guestName} ${amount} عبر الإنترنت`
            : `${notice.guestName} paid ${amount} online`,
        idempotencyKey: `online-host-${paymentId}`,
        message: {
          kicker: l === "ar" ? "دفعة عبر الإنترنت" : "Online payment",
          title: l === "ar" ? `وصل ${amount}` : `${amount} received`,
          body: [
            l === "ar"
              ? "يحفظ مبيت المبلغ لك بلا أي عمولة. يمكنك طلب تحويله من صفحة المدفوعات بعد بدء الإقامة."
              : "Mabeet holds it for you, with no commission. Ask for it from the Payouts page once the stay has started.",
          ],
          details: notice.details(l),
          action: {
            label: l === "ar" ? "افتح المدفوعات" : "Open payouts",
            url: url(`/dashboard/${notice.businessId}/payouts`),
          },
        },
      };
    });
  });
}

/** Money going back to the guest after a cancellation, a decline or a late payment. */
export function notifyRefund(bookingId: string, amountCents: number, kind: Notice["kind"] = "stay"): void {
  inBackground("refund notice", async () => {
    const notice = await load(kind, bookingId);
    if (!notice) return;
    const l = notice.locale;
    const amount = formatMoney(amountCents, notice.currency, l);
    await tellGuest(notice, {
      subject:
        l === "ar"
          ? `استرداد ${amount} عن ${notice.reference}`
          : `Refund of ${amount} for ${notice.reference}`,
      idempotencyKey: `refund-${notice.id}-${amountCents}`,
      message: {
        kicker: l === "ar" ? "استرداد" : "Refund",
        title: l === "ar" ? `نعيد إليك ${amount}` : `${amount} is on its way back to you`,
        body: [
          l === "ar"
            ? "يعود المبلغ إلى البطاقة أو حساب Whish الذي دفعت منه. قد يستغرق ذلك بضعة أيام."
            : "It goes back to the card or Whish account you paid with. It can take a few days to show.",
        ],
        details: notice.details(l),
        action: {
          label: l === "ar" ? "اعرض حجزك" : "See your booking",
          url: url(`/b/${notice.publicToken}`),
        },
      },
    });
  });
}

/** A guest's question from the Contact host page, as the host will read it. */
export interface HostMessage {
  businessId: string;
  placeName: string;
  name: string;
  email: string;
  message: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

/** A guest wrote from the Contact host page: the people who handle bookings get it, and replying reaches the guest. */
export function notifyHostMessage(question: HostMessage): void {
  const id = randomUUID();
  inBackground("host message", async () => {
    const when = (l: Lang) =>
      question.checkIn && question.checkOut
        ? formatStayDates(parseIsoDate(question.checkIn), parseIsoDate(question.checkOut), l)
        : null;
    await tellHosts(question.businessId, (l) => {
      const dates = when(l);
      return {
        subject:
          l === "ar"
            ? `سؤال من ${question.name} عن ${question.placeName}`
            : `Question from ${question.name} about ${question.placeName}`,
        idempotencyKey: `host-message-${id}`,
        replyTo: question.email,
        message: {
          kicker: l === "ar" ? "رسالة جديدة" : "New message",
          title: l === "ar" ? `${question.name} لديه سؤال` : `${question.name} has a question`,
          body: [
            question.message,
            l === "ar"
              ? "ردّ على هذا البريد ليصل جوابك إلى الضيف مباشرة."
              : "Reply to this email and your answer goes straight to the guest.",
          ],
          details: [
            { label: LABELS[l].place, value: question.placeName },
            ...(dates ? [{ label: LABELS[l].dates, value: dates }] : []),
            ...(question.guests ? [{ label: LABELS[l].guests, value: String(question.guests) }] : []),
            { label: l === "ar" ? "البريد" : "Email", value: question.email },
          ],
          action: {
            label: l === "ar" ? `ردّ على ${question.name}` : `Reply to ${question.name}`,
            url: `mailto:${question.email}`,
          },
        },
      };
    });
  });
}

const firstName = (name: string) => name.split(" ")[0] ?? name;

/** Account emails, sent by Better Auth. These are awaited: the sign-up or reset depends on them. */
export function sendVerificationEmail(to: string, name: string, link: string, locale?: string | null) {
  const l = lang(locale);
  return sendEmail({
    to,
    ...render(
      l === "ar" ? "أكّد بريدك الإلكتروني" : "Confirm your email",
      l === "ar"
        ? {
            kicker: "أهلًا بك",
            title: `أهلًا ${firstName(name)}`,
            body: ["أكّد بريدك الإلكتروني ليتمكّن المضيفون من التواصل معك بشأن حجوزاتك."],
            action: { label: "أكّد بريدي", url: link },
            footnote: "يعمل هذا الرابط لمدة ساعة. إن لم تكن قد سجّلت، تجاهل هذه الرسالة.",
          }
        : {
            kicker: "Welcome",
            title: `Welcome, ${firstName(name)}`,
            body: ["Confirm your email so hosts can reach you about your bookings."],
            action: { label: "Confirm my email", url: link },
            footnote: "This link works for one hour. If you didn't sign up, ignore this email.",
          },
      l,
    ),
  });
}

export function sendPasswordResetEmail(to: string, name: string, link: string, locale?: string | null) {
  const l = lang(locale);
  return sendEmail({
    to,
    ...render(
      l === "ar" ? "أعد تعيين كلمة المرور" : "Reset your password",
      l === "ar"
        ? {
            kicker: "كلمة المرور",
            title: `أعد تعيين كلمة مرورك يا ${firstName(name)}`,
            body: ["طلب أحدهم إعادة تعيين كلمة المرور لهذا الحساب. إن كنت أنت، اختر كلمة جديدة أدناه."],
            action: { label: "اختر كلمة مرور جديدة", url: link },
            footnote: "يعمل هذا الرابط لمدة ساعة. إن لم تطلب ذلك، تجاهل الرسالة: تبقى كلمة مرورك كما هي.",
          }
        : {
            kicker: "Password",
            title: `Reset your password, ${firstName(name)}`,
            body: [
              "Someone asked to reset the password for this account. If it was you, choose a new one below.",
            ],
            action: { label: "Choose a new password", url: link },
            footnote:
              "This link works for one hour. If you didn't ask, ignore this email: your password stays the same.",
          },
      l,
    ),
  });
}
