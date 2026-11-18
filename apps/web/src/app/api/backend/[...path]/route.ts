import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getBackendBaseUrl(): string | null {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (!raw || raw.startsWith("/")) {
    return null;
  }

  return raw.replace(/\/+$/, "");
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const backendBase = getBackendBaseUrl();
  if (!backendBase) {
    return NextResponse.json(
      {
        error: "BACKEND_UNCONFIGURED",
        message: "API_INTERNAL_URL is not configured on the web server.",
      },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const targetPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const search = request.nextUrl.search || "";
  const targetUrl = `${backendBase}/${targetPath}${search}`;

  const forwardHeaders = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) forwardHeaders.set("content-type", contentType);

  const cookie = request.headers.get("cookie");
  if (cookie) forwardHeaders.set("cookie", cookie);

  const auth = request.headers.get("authorization");
  if (auth) forwardHeaders.set("authorization", auth);

  const xff = request.headers.get("x-forwarded-for");
  if (xff) forwardHeaders.set("x-forwarded-for", xff);

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: hasBody && body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }

    // Forward all Set-Cookie headers cleanly (adjusting SameSite for first-party origin)
    const setCookies =
      typeof upstream.headers.getSetCookie === "function"
        ? upstream.headers.getSetCookie()
        : upstream.headers.get("set-cookie")
          ? [upstream.headers.get("set-cookie")!]
          : [];

    for (const rawCookie of setCookies) {
      // Rewrite SameSite=None to SameSite=Lax since proxy makes it first-party
      const adjusted = rawCookie.replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
      responseHeaders.append("set-cookie", adjusted);
    }

    const responseBody = await upstream.arrayBuffer();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Backend proxy error:", error);
    return NextResponse.json(
      {
        error: "BACKEND_UNREACHABLE",
        message: "Unable to reach the ExamConnect API service right now.",
      },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
