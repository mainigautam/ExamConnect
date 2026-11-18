import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sendSmtpMail, type SmtpConfig } from "./smtp-client.js";

export type EmailDeliveryResult = {
  delivered: boolean;
  mode: "smtp" | "dev-mailbox" | "unconfigured";
  previewFile?: string;
  error?: string;
};

export function getSmtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !from) {
    return null;
  }

  const port = portRaw ? Number(portRaw) : 587;
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;

  return {
    host,
    port,
    secure,
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfigFromEnv() !== null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPasswordResetEmail(params: {
  resetUrl: string;
  expiresMinutes: number;
  recipientEmail: string;
}): { subject: string; text: string; html: string } {
  const safeUrl = escapeHtml(params.resetUrl);
  const safeEmail = escapeHtml(params.recipientEmail);
  const subject = "Reset your ExamConnect password";

  const text = [
    "ExamConnect — Password Reset Request",
    "",
    `We received a request to reset the password for your ExamConnect account (${params.recipientEmail}).`,
    "",
    `Reset your password using the secure link below (valid for ${params.expiresMinutes} minutes and single-use):`,
    params.resetUrl,
    "",
    "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.",
    "",
    "— ExamConnect Security Team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your ExamConnect password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f1f3d;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dde4ef;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:#0f1f3d;padding:24px 32px;">
              <div style="font-size:14px;font-weight:800;letter-spacing:0.14em;color:#ffffff;">EXAMCONNECT</div>
              <div style="font-size:12px;color:#9db4d8;margin-top:4px;">Government Exam Eligibility &amp; Recruitment Platform</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f1f3d;">Reset your password</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#41516d;">
                We received a password reset request for your ExamConnect account (<strong>${safeEmail}</strong>).
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#41516d;">
                Click the button below to choose a new password. This link expires in <strong>${params.expiresMinutes} minutes</strong> and can only be used once.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#5b6b84;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#1d4ed8;background:#f4f7fc;padding:10px 12px;border-radius:6px;border:1px solid #e1e8f3;">
                ${safeUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e6ecf5;margin:24px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.6;color:#6c7b93;">
                If you did not request a password reset, you can safely ignore this message. All existing sessions will be revoked once a password reset is completed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<EmailDeliveryResult> {
  const rendered = renderPasswordResetEmail({
    resetUrl: params.resetUrl,
    expiresMinutes: params.expiresMinutes,
    recipientEmail: params.to,
  });

  const smtpConfig = getSmtpConfigFromEnv();

  if (smtpConfig) {
    try {
      await sendSmtpMail(smtpConfig, {
        to: params.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      return {
        delivered: true,
        mode: "smtp",
      };
    } catch (error) {
      return {
        delivered: false,
        mode: "smtp",
        error: error instanceof Error ? error.message : "SMTP delivery failed.",
      };
    }
  }

  // Safe local development mail flow ONLY outside production
  if (process.env.NODE_ENV !== "production") {
    try {
      const mailboxDir = path.resolve(process.cwd(), ".dev-mailbox");
      await mkdir(mailboxDir, { recursive: true });
      const previewFile = path.join(mailboxDir, "latest-password-reset.json");
      const htmlFile = path.join(mailboxDir, "latest-password-reset.html");

      await writeFile(
        previewFile,
        JSON.stringify(
          {
            createdAt: new Date().toISOString(),
            to: params.to,
            subject: rendered.subject,
            resetUrl: params.resetUrl,
            expiresMinutes: params.expiresMinutes,
            note: "Local development mail capture (SMTP not configured). Configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM for real email delivery.",
          },
          null,
          2,
        ),
        "utf8",
      );
      await writeFile(htmlFile, rendered.html, "utf8");

      return {
        delivered: true,
        mode: "dev-mailbox",
        previewFile,
      };
    } catch (error) {
      return {
        delivered: false,
        mode: "dev-mailbox",
        error: error instanceof Error ? error.message : "Failed to write dev mailbox.",
      };
    }
  }

  return {
    delivered: false,
    mode: "unconfigured",
    error:
      "Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
  };
}
