/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    {
      // Не применять security-заголовки к статике Next.js — иначе nosniff
      // блокирует JS-чанки, если dev-сервер вернул HTML-ошибку вместо файла
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
