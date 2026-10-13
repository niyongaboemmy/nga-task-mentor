import type { CodeFile } from "../../services/codeApi";

/**
 * Whether a project is a web server that should run in a Preview rather
 * than as a program printing to the terminal: Express/Fastify/Koa/Nest,
 * Flask/FastAPI/Django, Spring Boot, ASP.NET, Laravel/PHP built-in server…
 */
const SERVER_PACKAGES = /"(express|fastify|koa|@nestjs\/core|hapi|@hapi\/hapi|next|nuxt)"\s*:/;
const SERVER_CODE = [
  /\bfrom\s+flask\s+import\b|\bimport\s+flask\b/,
  /\bfrom\s+fastapi\s+import\b|\bimport\s+fastapi\b/,
  /\brequire\(\s*["'](express|fastify|koa|http)["']\s*\)[\s\S]*\.listen\(/,
  /\bcreateServer\([\s\S]*\.listen\(/,
  /@SpringBootApplication\b/,
  /\bWebApplication\.CreateBuilder\b/,
];

export function looksLikeServer(files: CodeFile[]): boolean {
  for (const f of files) {
    const name = f.path.split("/").pop() ?? "";
    if (name === "package.json" && SERVER_PACKAGES.test(f.content)) return true;
    if (name === "manage.py" && /django/i.test(f.content)) return true;
    if (/(^|\/)requirements\.txt$/.test(f.path) && /^(flask|fastapi|django|uvicorn)\b/im.test(f.content)) return true;
    if (name === "pom.xml" && /spring-boot-starter-web/.test(f.content)) return true;
    if (/\.csproj$/.test(name) && /Microsoft\.NET\.Sdk\.Web/.test(f.content)) return true;
    if (/\.(js|cjs|mjs|ts|py|java|cs)$/.test(name) && SERVER_CODE.some((re) => re.test(f.content))) return true;
  }
  return false;
}
