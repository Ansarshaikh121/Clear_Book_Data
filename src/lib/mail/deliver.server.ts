import { writeFile } from "node:fs/promises";
import net from "node:net";
import tls from "node:tls";
import { isWorkspacePreview } from "@/lib/env.server";

export const DEV_RESET_TRACE = "/tmp/clearbook-dev-reset.json";

export type MailConfig =
  | { kind: "resend"; apiKey: string; from: string }
  | { kind: "smtp"; host: string; port: number; user: string; pass: string; from: string };

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

export function readMailConfig(): MailConfig | null {
  const from = env("EMAIL_FROM");
  const resend = env("RESEND_API_KEY");
  if (resend && from) return { kind: "resend", apiKey: resend, from };
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  if (host && user && pass && from) {
    const port = Number(env("SMTP_PORT") || "587");
    if (!Number.isFinite(port) || port <= 0) return null;
    return { kind: "smtp", host, port, user, pass, from };
  }
  return null;
}

export function developerNotice(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!isWorkspacePreview()) return null;
  if (readMailConfig()) return null;
  return "Email delivery is not configured in this environment. Set RESEND_API_KEY and EMAIL_FROM, or SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM. This notice is only for the people building Clearbook — it is not shown on the published site.";
}

type ResetUser = { id: string; email: string; name?: string | null };

function resetMessage(url: string) {
  return [
    "Reset your Clearbook password",
    "",
    "A password reset was requested for this email address.",
    "If it was you, open the link below within one hour:",
    "",
    url,
    "",
    "If you did not ask for this, ignore this email. Your password will stay the same.",
  ].join("\n");
}

async function sendResend(config: Extract<MailConfig, { kind: "resend" }>, to: string, url: string, subject = "Reset your Clearbook password", message = resetMessage(url)) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject,
      text: message,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend rejected the message (${response.status})`);
  }
}

class SmtpBuffer {
  private buffer = "";
  private error: Error | null = null;
  private waiter: { resolve: (value: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(socket: net.Socket) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      this.flush();
    });
    socket.on("error", (error: Error) => {
      this.error = error;
      this.flush();
    });
  }

  stop(socket: net.Socket) {
    socket.removeAllListeners("data");
    socket.removeAllListeners("error");
  }

  read(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error("SMTP timed out"));
      }, 20000);
      this.waiter = { resolve, reject, timer };
      this.flush();
    });
  }

  private flush() {
    if (!this.waiter) return;
    if (this.error) {
      clearTimeout(this.waiter.timer);
      const { reject } = this.waiter;
      this.waiter = null;
      reject(this.error);
      return;
    }
    const lines = this.buffer.split(/\r?\n/).filter((line) => line.length > 0);
    const last = lines[lines.length - 1];
    if (!last || !/^\d{3} /.test(last)) return;
    clearTimeout(this.waiter.timer);
    const payload = this.buffer;
    this.buffer = "";
    const { resolve } = this.waiter;
    this.waiter = null;
    resolve(payload);
  }
}

async function command(socket: net.Socket, reader: SmtpBuffer, line: string | null, codes: number[]) {
  if (line != null) socket.write(line.endsWith("\r\n") ? line : `${line}\r\n`);
  const reply = await reader.read();
  const code = Number(reply.trim().slice(0, 3));
  if (!codes.includes(code)) throw new Error("SMTP refused a command");
}

async function authenticate(socket: net.Socket, reader: SmtpBuffer, config: Extract<MailConfig, { kind: "smtp" }>, to: string, url: string, subject: string, message: string) {
  await command(socket, reader, "AUTH LOGIN", [334]);
  await command(socket, reader, Buffer.from(config.user).toString("base64"), [334]);
  await command(socket, reader, Buffer.from(config.pass).toString("base64"), [235]);
  await command(socket, reader, `MAIL FROM:<${addressOnly(config.from)}>`, [250]);
  await command(socket, reader, `RCPT TO:<${addressOnly(to)}>`, [250, 251]);
  await command(socket, reader, "DATA", [354]);
  const payload = [
    `From: ${config.from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    message.replace(/^\./gm, ".."),
    ".",
  ].join("\r\n");
  await command(socket, reader, payload, [250]);
  await command(socket, reader, "QUIT", [221]);
}

async function sendSmtp(config: Extract<MailConfig, { kind: "smtp" }>, to: string, url: string, subject = "Reset your Clearbook password", message = resetMessage(url)) {
  const implicit = config.port === 465;
  const socket: net.Socket = implicit
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });
  const reader = new SmtpBuffer(socket);
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      socket.off(implicit ? "secureConnect" : "connect", onReady);
      reject(error);
    };
    const onReady = () => {
      socket.off("error", onError);
      resolve();
    };
    socket.once("error", onError);
    socket.once(implicit ? "secureConnect" : "connect", onReady);
  });
  try {
    await command(socket, reader, null, [220]);
    await command(socket, reader, "EHLO clearbook", [250]);
    if (!implicit) {
      await command(socket, reader, "STARTTLS", [220]);
      reader.stop(socket);
      const secure = tls.connect({ socket, servername: config.host });
      const secureReader = new SmtpBuffer(secure);
      await new Promise<void>((resolve, reject) => {
        secure.once("secureConnect", () => resolve());
        secure.once("error", reject);
      });
      await command(secure, secureReader, "EHLO clearbook", [250]);
      await authenticate(secure, secureReader, config, to, url, subject, message);
      secure.end();
      return;
    }
    await authenticate(socket, reader, config, to, url, subject, message);
  } finally {
    socket.end();
  }
}

function addressOnly(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

export async function deliverResetEmail(user: ResetUser, url: string, token: string) {
  const configured = readMailConfig();
  const devTrace = process.env.NODE_ENV !== "production" && isWorkspacePreview() && !configured;
  if (devTrace) {
    await writeFile(
      DEV_RESET_TRACE,
      JSON.stringify({ token, url, userId: user.id, at: new Date().toISOString() }),
      { mode: 0o600 },
    );
  }
  if (!configured) {
    console.error(
      "[clearbook] Password reset email was not delivered because email delivery is not configured.",
    );
    return;
  }
  try {
    if (configured.kind === "resend") await sendResend(configured, user.email, url);
    else await sendSmtp(configured, user.email, url);
    console.info(
      JSON.stringify({
        event: "password_reset_email",
        userId: user.id,
        at: new Date().toISOString(),
        delivered: true,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "password_reset_email",
        userId: user.id,
        at: new Date().toISOString(),
        delivered: false,
        reason: error instanceof Error ? error.name : "Error",
      }),
    );
    throw error;
  }
}

type AuthLike = {
  options: {
    emailAndPassword?: {
      enabled?: boolean;
      sendResetPassword?: (data: { user: ResetUser; url: string; token: string }, request?: Request) => Promise<void>;
      revokeSessionsOnPasswordReset?: boolean;
    };
  };
  $context: Promise<{
    options: AuthLike["options"];
    internalAdapter: {
      findVerificationValue: (identifier: string) => Promise<{ expiresAt: Date | string } | null>;
    };
  }>;
};

let attached = false;

export async function ensurePasswordResetDelivery(auth: AuthLike) {
  const hook = async (data: { user: ResetUser; url: string; token: string }) => {
    await deliverResetEmail(data.user, data.url, data.token);
  };
  const apply = (options: AuthLike["options"]) => {
    if (!options.emailAndPassword) return;
    options.emailAndPassword.sendResetPassword = hook;
    options.emailAndPassword.revokeSessionsOnPasswordReset = true;
    attached = true;
  };
  apply(auth.options);
  const ctx = await auth.$context;
  apply(ctx.options);
}

export function passwordResetHookAttached() {
  return attached;
}

export async function inspectResetToken(auth: AuthLike, token: string): Promise<"valid" | "invalid"> {
  if (!token || token.length < 8 || token.length > 128) return "invalid";
  const ctx = await auth.$context;
  const row = await ctx.internalAdapter.findVerificationValue(`reset-password:${token}`);
  if (!row) return "invalid";
  const expires = new Date(row.expiresAt);
  if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) return "invalid";
  return "valid";
}

/** Never silently accept an OTP request when delivery is unavailable. */
export async function deliverSignupOtp(email: string, otp: string): Promise<void> {
  const config = readMailConfig();
  if (!config) throw new Error("Email delivery is not configured");
  const subject = "Verify your Clearbook email";
  const message = `Your Clearbook verification code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this code, ignore this email.`;
  if (config.kind === "resend") await sendResend(config, email, "", subject, message);
  else await sendSmtp(config, email, "", subject, message);
}
