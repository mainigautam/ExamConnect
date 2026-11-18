import net from "node:net";
import tls from "node:tls";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  timeoutMs?: number;
};

export type SmtpMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SocketLike = net.Socket | tls.TLSSocket;

class SmtpConnection {
  private socket: SocketLike;
  private buffer = "";
  private pendingResolve: ((response: { code: number; lines: string[] }) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private lines: string[] = [];

  constructor(socket: SocketLike) {
    this.socket = socket;
    this.attachListeners(socket);
  }

  private attachListeners(socket: SocketLike): void {
    socket.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      this.processBuffer();
    });
    socket.on("error", (err: Error) => {
      this.failPending(err);
    });
    socket.on("close", () => {
      this.failPending(new Error("SMTP connection closed unexpectedly."));
    });
    socket.on("timeout", () => {
      socket.destroy();
      this.failPending(new Error("SMTP connection timed out."));
    });
  }

  private failPending(error: Error): void {
    if (this.pendingReject) {
      const reject = this.pendingReject;
      this.pendingResolve = null;
      this.pendingReject = null;
      reject(error);
    }
  }

  private processBuffer(): void {
    let idx = this.buffer.indexOf("\r\n");
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      this.lines.push(line);

      // RFC 5321: final line of multi-line reply has a space after 3-digit code
      if (/^\d{3} /.test(line)) {
        const code = Number(line.slice(0, 3));
        const collected = [...this.lines];
        this.lines = [];
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          this.pendingReject = null;
          resolve({ code, lines: collected });
        }
      }
      idx = this.buffer.indexOf("\r\n");
    }
  }

  readResponse(): Promise<{ code: number; lines: string[] }> {
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.processBuffer();
    });
  }

  async command(cmd: string, expectedCodes: number[]): Promise<{ code: number; lines: string[] }> {
    const responsePromise = this.readResponse();
    this.socket.write(`${cmd}\r\n`);
    const response = await responsePromise;
    if (!expectedCodes.includes(response.code)) {
      throw new Error(
        `SMTP command failed (status ${response.code}): ${response.lines.join(" | ")}`,
      );
    }
    return response;
  }

  async upgradeToTls(host: string): Promise<void> {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    this.socket.removeAllListeners("close");
    this.socket.removeAllListeners("timeout");

    const tlsSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const upgraded = tls.connect(
        {
          socket: this.socket as net.Socket,
          servername: host,
          minVersion: "TLSv1.2",
        },
        () => resolve(upgraded),
      );
      upgraded.once("error", reject);
    });

    this.socket = tlsSocket;
    this.buffer = "";
    this.lines = [];
    this.attachListeners(tlsSocket);
  }

  close(): void {
    try {
      this.socket.end();
    } catch {
      this.socket.destroy();
    }
  }
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildMimeBody(from: string, message: SmtpMessage): string {
  const boundary = `----ExamConnectBoundary_${Date.now().toString(16)}`;
  const headers = [
    `From: ${sanitizeHeaderValue(from)}`,
    `To: ${sanitizeHeaderValue(message.to)}`,
    `Subject: ${sanitizeHeaderValue(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const parts = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="utf-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    message.text,
    `--${boundary}`,
    `Content-Type: text/html; charset="utf-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    message.html,
    `--${boundary}--`,
  ];

  // Dot-stuff lines starting with '.' per RFC 5321 section 4.5.2
  const raw = [...headers, "", ...parts].join("\r\n");
  return raw.replace(/(^|\r\n)\./g, "$1..");
}

function extractAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim();
}

export async function sendSmtpMail(config: SmtpConfig, message: SmtpMessage): Promise<void> {
  const timeoutMs = config.timeoutMs ?? 15000;

  const socket = await new Promise<SocketLike>((resolve, reject) => {
    if (config.secure) {
      const s = tls.connect(
        {
          host: config.host,
          port: config.port,
          servername: config.host,
          minVersion: "TLSv1.2",
        },
        () => resolve(s),
      );
      s.setTimeout(timeoutMs);
      s.once("error", reject);
    } else {
      const s = net.connect({ host: config.host, port: config.port }, () => resolve(s));
      s.setTimeout(timeoutMs);
      s.once("error", reject);
    }
  });

  const conn = new SmtpConnection(socket);

  try {
    const greeting = await conn.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`SMTP server rejected connection: ${greeting.lines.join(" | ")}`);
    }

    let ehlo = await conn.command("EHLO examconnect.local", [250]);

    // Upgrade via STARTTLS if server advertises it and connection isn't already TLS
    if (!config.secure && ehlo.lines.some((line) => /STARTTLS/i.test(line))) {
      await conn.command("STARTTLS", [220]);
      await conn.upgradeToTls(config.host);
      ehlo = await conn.command("EHLO examconnect.local", [250]);
    }

    if (config.user && config.pass) {
      const supportsPlain = ehlo.lines.some((line) => /AUTH.*\bPLAIN\b/i.test(line));
      if (supportsPlain) {
        const authToken = Buffer.from(`\u0000${config.user}\u0000${config.pass}`, "utf8").toString(
          "base64",
        );
        await conn.command(`AUTH PLAIN ${authToken}`, [235]);
      } else {
        await conn.command("AUTH LOGIN", [334]);
        await conn.command(Buffer.from(config.user, "utf8").toString("base64"), [334]);
        await conn.command(Buffer.from(config.pass, "utf8").toString("base64"), [235]);
      }
    }

    const fromAddress = extractAddress(config.from);
    await conn.command(`MAIL FROM:<${fromAddress}>`, [250]);
    await conn.command(`RCPT TO:<${sanitizeHeaderValue(message.to)}>`, [250, 251]);
    await conn.command("DATA", [354]);

    const body = buildMimeBody(config.from, message);
    await conn.command(`${body}\r\n.`, [250]);

    try {
      await conn.command("QUIT", [221]);
    } catch {
      // Some servers close immediately after DATA 250
    }
  } finally {
    conn.close();
  }
}
