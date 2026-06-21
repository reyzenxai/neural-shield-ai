import { z } from "zod";

/** Trim and strip HTML tags from user-supplied strings. */
const clean = (s: string) => s.trim().replace(/<[^>]*>/g, "");

const text = (min: number, max: number) =>
  z.string().transform(clean).pipe(z.string().min(min).max(max));

export const MessageScanSchema = z.object({
  text: text(10, 5000),
});

export const UrlScanSchema = z.object({
  url: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().url("Enter a valid URL").max(2048)),
});

export const EmailScanSchema = z.object({
  subject: text(0, 500).optional().default(""),
  body: text(5, 20000),
  sender: z.string().transform(clean).pipe(z.string().max(320)).optional().default(""),
});

export const PhoneScanSchema = z.object({
  phone: z
    .string()
    .transform((s) => s.replace(/[\s\-()]/g, ""))
    .pipe(
      z
        .string()
        .regex(
          /^(\+?91)?[0-9]{6,12}$/,
          "Enter a valid Indian phone number (mobile or landline)",
        ),
    ),
});

export const UpiScanSchema = z.object({
  upiId: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(
      z
        .string()
        .regex(
          /^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i,
          "Enter a valid UPI ID (e.g. name@okaxis)",
        ),
    ),
});

export type MessageScanInput = z.infer<typeof MessageScanSchema>;
export type UrlScanInput = z.infer<typeof UrlScanSchema>;
export type EmailScanInput = z.infer<typeof EmailScanSchema>;
export type PhoneScanInput = z.infer<typeof PhoneScanSchema>;
export type UpiScanInput = z.infer<typeof UpiScanSchema>;
