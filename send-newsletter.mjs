#!/usr/bin/env node
// eräSauna Market & Location Intelligence — mailer.
// Wraps a rendered HTML body in the eräSauna email layout and sends it via
// Resend. No secrets are hardcoded: everything comes from environment vars.
//
// Usage:
//   RESEND_API_KEY=...  NEWSLETTER_FROM="eräSauna Intelligence <intel@erasauna.nl>" \
//   NEWSLETTER_TO="info@erasauna.nl" \
//   node send-newsletter.mjs <body.html> "<subject>"
//
// The from-address domain (erasauna.nl) must be verified in the Resend account.
// Nothing from the steengoed / REPP codebase is reused here.

import { readFile } from "node:fs/promises";

const [, , bodyPath, subjectArg] = process.argv;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.NEWSLETTER_FROM || "eräSauna Intelligence <intel@erasauna.nl>";
const TO = (process.env.NEWSLETTER_TO || "info@erasauna.nl")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DRY_RUN = process.env.DRY_RUN === "1";

function fail(msg) {
  console.error(`[mailer] ${msg}`);
  process.exit(1);
}

if (!bodyPath) fail("geef het pad naar de HTML-body mee als eerste argument");
if (!subjectArg) fail("geef de onderwerpregel mee als tweede argument");
if (!RESEND_API_KEY && !DRY_RUN && !process.env.PREVIEW_OUT)
  fail("RESEND_API_KEY ontbreekt (of zet DRY_RUN=1, of PREVIEW_OUT=<pad>)");

function layout(inner) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>eräSauna Market & Location Intelligence</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a17;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;">
          <tr>
            <td style="padding:32px 32px 8px;">
              <span style="font-size:18px;font-weight:700;letter-spacing:-0.3px;color:#1a1a17;">eräSauna</span>
              <span style="font-size:12px;font-weight:600;color:#8a8a80;text-transform:uppercase;letter-spacing:1.5px;">&nbsp;&nbsp;Market &amp; Location Intelligence</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;font-size:15px;line-height:1.65;color:#2b2b26;">
              ${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <div style="border-top:1px solid #ececE8;padding-top:16px;font-size:11px;color:#a5a59b;line-height:1.6;">
                Interne market-intelligence voor eräSauna. Tweewekelijks, op maandag.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const bodyHtml = await readFile(bodyPath, "utf8");
const html = layout(bodyHtml);
const subject = subjectArg;

if (process.env.PREVIEW_OUT) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(process.env.PREVIEW_OUT, html, "utf8");
  console.log(`[mailer] preview geschreven naar ${process.env.PREVIEW_OUT} (${html.length} bytes) — niets verzonden`);
  process.exit(0);
}

if (DRY_RUN) {
  console.log(`[mailer] DRY RUN — zou versturen:`);
  console.log(`  from:    ${FROM}`);
  console.log(`  to:      ${TO.join(", ")}`);
  console.log(`  subject: ${subject}`);
  console.log(`  bytes:   ${html.length}`);
  process.exit(0);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ from: FROM, to: TO, subject, html }),
});

if (!res.ok) {
  const text = await res.text().catch(() => "");
  fail(`Resend gaf ${res.status}: ${text}`);
}

const data = await res.json();
console.log(`[mailer] verzonden naar ${TO.join(", ")} — id=${data.id}`);
