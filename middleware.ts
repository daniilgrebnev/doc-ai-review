import { NextResponse, type NextRequest } from "next/server";
import { getRequestCountry, isSiteGeoBlocked } from "@/lib/llm/geo";

/**
 * Гео-блок всего сайта: для стран из SITE_BLOCKED_COUNTRIES (по умолчанию UA)
 * любой маршрут, включая API, отвечает 404.
 */

const NOT_FOUND_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 — страница не найдена</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;background:#0b0d12;color:#e6e8ee;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .card{text-align:center;padding:40px 32px;border:1px solid #23262f;border-radius:16px;background:#12151c;max-width:360px;margin:16px}
  .code{font-size:64px;font-weight:700;letter-spacing:-2px;margin:0 0 8px}
  .text{margin:0;color:#9aa0ad;font-size:15px;line-height:1.5}
</style>
</head>
<body>
  <div class="card">
    <p class="code">404</p>
    <p class="text">Страница не найдена</p>
  </div>
</body>
</html>`;

export function middleware(request: NextRequest) {
  const country = getRequestCountry(request.headers);
  if (!isSiteGeoBlocked(country)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
