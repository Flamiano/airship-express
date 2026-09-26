import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export interface SubdomainPortal {
  name: string;
  subdomains: string[];
  primarySubdomain: string;
  loginPath: string;
  authPaths?: string[];
  routes: string[];
}

export const SUBDOMAIN_PORTALS: SubdomainPortal[] = [
  {
    name: "Supply Chain",
    subdomains: ["sc", "supplychain"],
    primarySubdomain: "sc",
    loginPath: "/scAuth",
    authPaths: ["/scAuth"],
    routes: [
      "/inventory",
      "/warehousing",
      "/procurement",
      "/executive",
      "/forecast",
      "/documents",
      "/purchase-orders",
      "/suppliers",
      "/gallery",
      "/trash",
      "/user-activity",
      "/settings",
    ],
  },
  {
    name: "HR Dashboard",
    subdomains: ["hr"],
    primarySubdomain: "hr",
    loginPath: "/hrAuth",
    authPaths: ["/hrAuth"],
    routes: [
      "/hr-dashboard",
      "/payroll-benefits-dashboard",
      "/performance-development-dashboard",
      "/workforce-management-hr2",
    ],
  },
  {
    name: "CRBC",
    subdomains: ["crbc"],
    primarySubdomain: "crbc",
    loginPath: "/crbcAuth/login",
    authPaths: [
      "/crbcAuth/login",
      "/crbcAuth",
      "/customerportalAuth/login",
      "/customerportalAuth/register",
      "/customerportalAuth",
    ],
    routes: ["/crbc", "/customer"],
  },
  {
    name: "FTM",
    subdomains: ["ftm"],
    primarySubdomain: "ftm",
    loginPath: "/ftmAuth",
    authPaths: ["/ftmAuth"],
    routes: ["/ftm"],
  },
  {
    name: "FMS",
    subdomains: ["fms"],
    primarySubdomain: "fms",
    loginPath: "/fmsAuth",
    authPaths: ["/fmsAuth"],
    routes: ["/fms"],
  },
  {
    name: "SPNC",
    subdomains: ["spnc"],
    primarySubdomain: "spnc",
    loginPath: "/app/login",
    authPaths: ["/app/login", "/app"],
    routes: ["/app"],
  },
  {
    name: "Admin",
    subdomains: ["admin"],
    primarySubdomain: "admin",
    loginPath: "/admin",
    authPaths: ["/admin"],
    routes: [],
  },
];

const ALL_PORTAL_SUBDOMAINS = new Set(
  SUBDOMAIN_PORTALS.flatMap((portal) =>
    portal.subdomains.map((s) => s.toLowerCase())
  )
);

const HOST_FORMAT_REGEX = /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i;
const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/;
const IPV6_REGEX = /^\[?[a-f0-9:]+\]?(?::\d+)?$/i;

function getConfiguredBaseHost(): {
  baseHost: string;
  baseWithoutPort: string;
} {
  const rawEnv = process.env.APP_BASE_DOMAIN || "localhost:3000";

  try {
    if (rawEnv.startsWith("http://") || rawEnv.startsWith("https://")) {
      const parsed = new URL(rawEnv);
      const baseHost = parsed.host.toLowerCase();
      const baseWithoutPort = parsed.hostname
        .toLowerCase()
        .replace(/^www\./, "");
      return { baseHost, baseWithoutPort };
    }
  } catch {
    void 0;
  }

  const cleaned = rawEnv
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const [hostOnly] = cleaned.split(":");
  return {
    baseHost: cleaned,
    baseWithoutPort: hostOnly.replace(/^www\./, ""),
  };
}

function isAllowedHost(
  hostWithoutPort: string,
  configuredBaseWithoutPort: string
): boolean {
  if (
    hostWithoutPort === "localhost" ||
    hostWithoutPort.endsWith(".localhost") ||
    hostWithoutPort.endsWith(".local") ||
    hostWithoutPort.endsWith(".nip.io") ||
    hostWithoutPort.endsWith(".sslip.io") ||
    hostWithoutPort.endsWith(".lvh.me") ||
    IPV4_REGEX.test(hostWithoutPort) ||
    IPV6_REGEX.test(hostWithoutPort)
  ) {
    return true;
  }

  if (
    hostWithoutPort === configuredBaseWithoutPort ||
    hostWithoutPort.endsWith("." + configuredBaseWithoutPort)
  ) {
    return true;
  }

  if (hostWithoutPort.endsWith(".vercel.app")) {
    return true;
  }

  if (process.env.ALLOWED_DOMAINS) {
    const customDomains = process.env.ALLOWED_DOMAINS.split(",").map((d) =>
      d.trim().toLowerCase()
    );
    for (const domain of customDomains) {
      if (
        domain &&
        (hostWithoutPort === domain || hostWithoutPort.endsWith("." + domain))
      ) {
        return true;
      }
    }
  }

  return false;
}

function resolveHostInfo(request: NextRequest): {
  subdomain: string | null;
  baseHost: string;
  protocol: string;
} {
  const { baseHost: defaultBaseHost, baseWithoutPort: defaultBaseWithoutPort } =
    getConfiguredBaseHost();

  const rawHeader =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host ||
    defaultBaseHost;

  const sanitizedHost = rawHeader.split(",")[0].trim().toLowerCase();
  const isValidFormat = HOST_FORMAT_REGEX.test(sanitizedHost);
  const [hostWithoutPort, port] = sanitizedHost.split(":");
  const portSuffix = port ? `:${port}` : "";

  if (
    !isValidFormat ||
    !isAllowedHost(hostWithoutPort, defaultBaseWithoutPort)
  ) {
    return {
      subdomain: null,
      baseHost: defaultBaseHost,
      protocol: resolveProtocol(request, false),
    };
  }

  const isLocalOrIp =
    hostWithoutPort === "localhost" ||
    hostWithoutPort.endsWith(".localhost") ||
    IPV4_REGEX.test(hostWithoutPort) ||
    IPV6_REGEX.test(hostWithoutPort);

  const protocol = resolveProtocol(request, isLocalOrIp);

  if (IPV4_REGEX.test(hostWithoutPort) || IPV6_REGEX.test(hostWithoutPort)) {
    return {
      subdomain: null,
      baseHost: sanitizedHost,
      protocol,
    };
  }

  if (
    hostWithoutPort.endsWith(".nip.io") ||
    hostWithoutPort.endsWith(".sslip.io") ||
    hostWithoutPort.endsWith(".lvh.me")
  ) {
    const parts = hostWithoutPort.split(".");
    const candidate = parts[0];
    if (candidate && !/^\d+$/.test(candidate) && candidate !== "www") {
      return {
        subdomain: candidate,
        baseHost: parts.slice(1).join(".") + portSuffix,
        protocol,
      };
    }
    return { subdomain: null, baseHost: sanitizedHost, protocol };
  }

  const parts = hostWithoutPort.split(".");

  if (parts.length === 1 && parts[0] === "localhost") {
    return { subdomain: null, baseHost: sanitizedHost, protocol };
  }

  if (parts.length === 2 && parts[1] === "localhost") {
    return {
      subdomain: parts[0] === "www" ? null : parts[0],
      baseHost: `localhost${portSuffix}`,
      protocol,
    };
  }

  if (parts[0] === "www") {
    return {
      subdomain: null,
      baseHost: parts.slice(1).join(".") + portSuffix,
      protocol,
    };
  }

  if (parts.length >= 3 && ALL_PORTAL_SUBDOMAINS.has(parts[0])) {
    return {
      subdomain: parts[0],
      baseHost: parts.slice(1).join(".") + portSuffix,
      protocol,
    };
  }

  if (
    defaultBaseWithoutPort &&
    hostWithoutPort.endsWith("." + defaultBaseWithoutPort)
  ) {
    const sub = hostWithoutPort.slice(0, -(defaultBaseWithoutPort.length + 1));
    if (sub && sub !== "www") {
      return {
        subdomain: sub,
        baseHost: defaultBaseWithoutPort + portSuffix,
        protocol,
      };
    }
  }

  return {
    subdomain: null,
    baseHost: sanitizedHost,
    protocol,
  };
}

function resolveProtocol(request: NextRequest, isLocalOrIp: boolean): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    const proto = forwardedProto.split(",")[0].trim().toLowerCase();
    if (proto === "https" || proto === "http") {
      return proto;
    }
  }

  const nextProto = request.nextUrl.protocol.replace(":", "").toLowerCase();

  if (!isLocalOrIp && process.env.NODE_ENV === "production") {
    return "https";
  }

  return nextProto || "http";
}

function buildRedirectUrl(
  targetSubdomain: string,
  baseHost: string,
  pathname: string,
  search: string,
  protocol: string
): URL {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const cleanSearch = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : "";
  return new URL(
    `${protocol}://${targetSubdomain}.${baseHost}${cleanPath}${cleanSearch}`
  );
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function applySecurityHeaders(
  response: NextResponse,
  protocol: string
): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  if (protocol === "https") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

export function middleware(request: NextRequest) {
  try {
    const { pathname, search } = request.nextUrl;
    const normalizedPath = normalizePath(pathname);
    const { subdomain, baseHost, protocol } = resolveHostInfo(request);

    console.log("[Middleware]", {
      host: request.headers.get("host"),
      pathname,
      subdomain,
      baseHost,
    });

    if (!subdomain) {
      const portalWithLoginPath = SUBDOMAIN_PORTALS.find(
        (p) =>
          normalizedPath === p.loginPath ||
          normalizedPath.startsWith(p.loginPath + "/")
      );
      if (portalWithLoginPath) {
        const cleanUrl = buildRedirectUrl(
          portalWithLoginPath.primarySubdomain,
          baseHost,
          "/",
          search,
          protocol
        );
        return applySecurityHeaders(NextResponse.redirect(cleanUrl), protocol);
      }

      const matchingPortal = SUBDOMAIN_PORTALS.find((portal) =>
        portal.routes.some(
          (route) =>
            normalizedPath === route || normalizedPath.startsWith(route + "/")
        )
      );
      if (matchingPortal) {
        const targetUrl = buildRedirectUrl(
          matchingPortal.primarySubdomain,
          baseHost,
          pathname,
          search,
          protocol
        );
        return applySecurityHeaders(NextResponse.redirect(targetUrl), protocol);
      }

      return applySecurityHeaders(NextResponse.next(), protocol);
    }

    const currentPortal = SUBDOMAIN_PORTALS.find((p) =>
      p.subdomains.some((s) => s.toLowerCase() === subdomain.toLowerCase())
    );

    if (currentPortal) {
      if (
        subdomain.toLowerCase() !== currentPortal.primarySubdomain.toLowerCase()
      ) {
        const canonicalUrl = buildRedirectUrl(
          currentPortal.primarySubdomain,
          baseHost,
          pathname,
          search,
          protocol
        );
        return applySecurityHeaders(
          NextResponse.redirect(canonicalUrl),
          protocol
        );
      }

      if (normalizedPath === "/") {
        const rewriteUrl = new URL(currentPortal.loginPath, request.url);
        return applySecurityHeaders(NextResponse.rewrite(rewriteUrl), protocol);
      }

      if (normalizedPath === currentPortal.loginPath) {
        const cleanUrl = buildRedirectUrl(
          currentPortal.primarySubdomain,
          baseHost,
          "/",
          search,
          protocol
        );
        return applySecurityHeaders(NextResponse.redirect(cleanUrl), protocol);
      }

      const isAllowedAuthPath = currentPortal.authPaths?.some(
        (p) => normalizedPath === p || normalizedPath.startsWith(p + "/")
      );
      if (isAllowedAuthPath) {
        return applySecurityHeaders(NextResponse.next(), protocol);
      }

      const isValidPortalRoute = currentPortal.routes.some(
        (route) =>
          normalizedPath === route || normalizedPath.startsWith(route + "/")
      );

      const isForeignRoute = SUBDOMAIN_PORTALS.some((otherPortal) => {
        if (otherPortal === currentPortal) return false;

        const isForeignLogin =
          normalizedPath === otherPortal.loginPath ||
          normalizedPath.startsWith(otherPortal.loginPath + "/");

        const isForeignAuth = otherPortal.authPaths?.some(
          (p) => normalizedPath === p || normalizedPath.startsWith(p + "/")
        );

        const isForeignPageRoute = otherPortal.routes.some(
          (route) =>
            normalizedPath === route || normalizedPath.startsWith(route + "/")
        );

        return isForeignLogin || isForeignAuth || isForeignPageRoute;
      });

      if (
        isForeignRoute ||
        (!isValidPortalRoute && currentPortal.primarySubdomain !== "sc")
      ) {
        const homeUrl = buildRedirectUrl(
          currentPortal.primarySubdomain,
          baseHost,
          "/",
          "",
          protocol
        );
        return applySecurityHeaders(NextResponse.redirect(homeUrl), protocol);
      }
    }

    return applySecurityHeaders(NextResponse.next(), protocol);
  } catch (error) {
    console.error("[Middleware Error]", error);
    return applySecurityHeaders(NextResponse.next(), "http");
  }
}

export default middleware;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|mp4|webm|ogg|mp3|wav|json|glb|gltf)$).*)",
  ],
};
