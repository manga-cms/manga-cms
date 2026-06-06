const PRODUCTION_ANALYTICS_HOSTS = new Set([
  "manga-cms.com",
  "www.manga-cms.com",
  "read.manga-cms.com",
]);

const truthy = (value: unknown) => String(value ?? "").toLowerCase() === "true";

const runtimeEnv = (key: string) =>
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    key
  ];

const envValue = (key: string, bundledValue: unknown) => {
  const runtimeValue = runtimeEnv(key);
  return String(runtimeValue ?? bundledValue ?? "").trim();
};

const normalizeRequestHost = (host: string | null | undefined) => {
  const firstHost = String(host ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!firstHost) return "";
  if (firstHost.startsWith("[")) {
    const closeIndex = firstHost.indexOf("]");
    return closeIndex > 0 ? firstHost.slice(1, closeIndex) : firstHost;
  }

  return firstHost.replace(/:\d+$/, "");
};

export interface CloudflareWebAnalyticsConfig {
  enabled: boolean;
  scriptSrc: string;
  beaconConfigJson: string;
}

export const cloudflareWebAnalyticsConfigForRequest = (
  requestUrl: URL,
  requestHost: string | null | undefined,
): CloudflareWebAnalyticsConfig => {
  const token = envValue(
    "PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN",
    import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
  );
  const analyticsEnabled = truthy(
    envValue(
      "PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ENABLED",
      import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ENABLED,
    ),
  );
  const analyticsEnv = envValue("PUBLIC_ANALYTICS_ENV", import.meta.env.PUBLIC_ANALYTICS_ENV);
  const host = normalizeRequestHost(requestHost) || requestUrl.hostname;
  const hostAllowed = analyticsEnv === "production" && PRODUCTION_ANALYTICS_HOSTS.has(host);
  const pathAllowed = !requestUrl.pathname.startsWith("/s/") && !requestUrl.pathname.startsWith("/og/");
  const enabled = Boolean(token && analyticsEnabled && hostAllowed && pathAllowed);

  return {
    enabled,
    scriptSrc: "https://static.cloudflareinsights.com/beacon.min.js",
    beaconConfigJson: JSON.stringify({ token }),
  };
};
