/**
 * @manga/api — Hono API server for the Manga Infrastructure.
 *
 * Endpoints align with openapi.yaml.
 * Data source: `contents/` directory via FileContentRepository.
 * When DB is connected, swap to a DB-backed repository.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { extname, isAbsolute, join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { getEmailProvider, isEmailConfigured } from "./email.js";
import { RateLimiter } from "./rate-limit.js";
import {
    FeedbackPayloadSchema,
    PackDraftAdoptProposalInputSchema,
    PackDraftCreateInputSchema,
    PackDraftExportInputSchema,
    PackDraftStatusUpdateInputSchema,
    ProposalCreateInputSchema,
    ProposalStatusUpdateInputSchema,
} from "@manga/schemas";
import { buildPreparedDirectoryDraft } from "@manga/ingestion";
import {
    FileContentRepository,
    createFileWriter,
    createFileIngestionRepository,
    createFileEntitlementRepository,
    createFileFeedbackRepository,
    createFilePackDraftRepository,
    createFilePackWriter,
    createFileProposalRepository,
    isPublicNow,
    isSeriesAndEpisodePublicNow,
    DefaultAccessPolicy,
    generateDeliveryToken,
    verifyDeliveryToken,
    applyWatermark,
    generateAuthToken,
    verifyAuthToken,
    type DevUser,
    type EntitlementRepository,
    type FeedbackPayload,
    type FeedbackStatus,
    packTypesForProposalKind,
    proposalToPackDraftEntry,
    type PackDraftStatus,
    type PackType,
    proposalInputFromFeedback,
    type ProposalKind,
    type ProposalStatus,
    type DraftPayload,
    type IngestionRepository,
} from "@manga/domain";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const NODE_ENV = process.env.NODE_ENV ?? "development";
const IS_PRODUCTION = NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Production fail-fast — validate required config before serving
// ---------------------------------------------------------------------------

function validateProductionConfig(): string[] {
    if (!IS_PRODUCTION) return [];
    const missing: string[] = [];
    if (!process.env.DEV_AUTH_SECRET) missing.push("DEV_AUTH_SECRET");
    if (!process.env.DELIVERY_SECRET) missing.push("DELIVERY_SECRET");
    if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
    if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
    if (!process.env.EMAIL_FROM) missing.push("EMAIL_FROM");
    if (!process.env.APP_URL) missing.push("APP_URL");
    return missing;
}

// ---------------------------------------------------------------------------
// Client IP helper — only trusts X-Forwarded-For when TRUST_PROXY is set.
// Without TRUST_PROXY, X-Forwarded-For is client-controlled and spoofable.
// Set TRUST_PROXY=1 when running behind a trusted reverse proxy (Cloudflare, nginx, etc.).
// ---------------------------------------------------------------------------

const TRUST_PROXY = process.env.TRUST_PROXY === "1";
if (TRUST_PROXY) {
    console.log("🔒 TRUST_PROXY=1 — X-Forwarded-For will be used for client IP");
}

function getClientIp(c: any): string {
    if (TRUST_PROXY) {
        const xff = c.req.header("x-forwarded-for");
        if (xff) return xff.split(",")[0].trim();
    }
    // Without trusted proxy, we cannot reliably determine IP from headers.
    // Hono's node adapter doesn't expose socket.remoteAddress on the context,
    // so fall back to a fixed string. Rate limiting still works per-email.
    return "direct";
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __dirname = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));

const CONTENTS_DIR =
    process.env.CONTENTS_DIR ?? join(__dirname, "../../../contents");
const IMPORTS_DIR =
    process.env.IMPORTS_DIR ?? join(__dirname, "../../../imports");
const DRAFT_ASSETS_DIR =
    process.env.DRAFT_ASSETS_DIR ?? join(__dirname, "../../../draft-assets");

const readRepo = new FileContentRepository(CONTENTS_DIR);
const writer = createFileWriter(CONTENTS_DIR, () => {
    (readRepo as any).loaded = false;
    (readRepo as any).seriesCache = new Map();
});
const FEEDBACK_DIR = process.env.FEEDBACK_DIR ?? join(__dirname, "../../../feedback");
const feedbackRepo = createFileFeedbackRepository(FEEDBACK_DIR);
const feedbackLimiter = new RateLimiter({ maxRequests: IS_PRODUCTION ? 10 : 60, windowSeconds: 60 });
const PROPOSALS_DIR = process.env.PROPOSALS_DIR ?? join(__dirname, "../../../proposals");
const proposalRepo = createFileProposalRepository(PROPOSALS_DIR);
const PACK_DRAFTS_DIR = process.env.PACK_DRAFTS_DIR ?? join(__dirname, "../../../pack-drafts");
const packDraftRepo = createFilePackDraftRepository(PACK_DRAFTS_DIR);
const PACKS_DIR = process.env.PACKS_DIR ?? join(__dirname, "../../../packs");
const packWriter = createFilePackWriter(PACKS_DIR);

const accessPolicy = new DefaultAccessPolicy();

// ---------------------------------------------------------------------------
// Entitlement repository: DB-backed when DATABASE_URL set, else file-backed
// ---------------------------------------------------------------------------

let entitlements: EntitlementRepository;
let dbHealthy = false;

if (process.env.DATABASE_URL) {
    try {
        const { getPrisma, DbEntitlementRepository, checkDbHealth } = await import("@manga/db");
        const prisma = getPrisma();
        entitlements = new DbEntitlementRepository(prisma);
        dbHealthy = await checkDbHealth();
        console.log(`✅ DB-backed entitlements (healthy: ${dbHealthy})`);
    } catch (e) {
        console.warn("⚠ DATABASE_URL set but @manga/db import failed, falling back to file-backed:", (e as Error).message);
        const ENTITLEMENTS_DIR = process.env.ENTITLEMENTS_DIR ?? join(__dirname, "../../../entitlements");
        entitlements = createFileEntitlementRepository(ENTITLEMENTS_DIR);
    }
} else {
    const ENTITLEMENTS_DIR = process.env.ENTITLEMENTS_DIR ?? join(__dirname, "../../../entitlements");
    entitlements = createFileEntitlementRepository(ENTITLEMENTS_DIR);
    console.log("📁 File-backed entitlements (no DATABASE_URL)");
}

const app = new Hono().basePath("/api/v1");

function makeDeliveryUrl(c: any, pageId: string, token: string, locale: string): string {
    const origin = process.env.DELIVERY_PUBLIC_ORIGIN ?? new URL(c.req.url).origin;
    const path = `/api/v1/deliver/${encodeURIComponent(pageId)}`;
    const params = new URLSearchParams({ token, lang: locale });
    return `${origin}${path}?${params.toString()}`;
}

function publicSeriesMeta(series: any) {
    return {
        id: series.id,
        title: series.title,
        coverUrl: series.coverUrl,
        ...(series.shareImageUrl ? { shareImageUrl: series.shareImageUrl } : {}),
        ...(series.publishStartAt ? { publishStartAt: series.publishStartAt } : {}),
        ...(series.publishEndAt ? { publishEndAt: series.publishEndAt } : {}),
        ...(series.visibility ? { visibility: series.visibility } : {}),
    };
}

function publicEpisodeSummary(ep: any) {
    return {
        id: ep.id,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        publishedAt: ep.publishedAt,
        ...(ep.publishStartAt ? { publishStartAt: ep.publishStartAt } : {}),
        ...(ep.publishEndAt ? { publishEndAt: ep.publishEndAt } : {}),
        ...(ep.visibility ? { visibility: ep.visibility } : {}),
    };
}

function visibleEpisodes(series: any, now = new Date()) {
    if (!isPublicNow(series, now)) return [];
    return series.episodes.filter((ep: any) => isPublicNow(ep, now));
}

function adminSeriesSummary(series: any) {
    return {
        ...publicSeriesMeta(series),
        description: series.description,
        status: series.status,
        episodeCount: series.episodes.length,
    };
}

function adminSeriesDetail(series: any) {
    return {
        ...publicSeriesMeta(series),
        description: series.description,
        status: series.status,
        episodes: series.episodes.map((ep: any) => ({
            ...publicEpisodeSummary(ep),
            pageCount: ep.pages.length,
        })),
    };
}

// ---------------------------------------------------------------------------
// CORS — env-based allowed origins for launch safety
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : null; // null = allow all (dev default)

app.use(
    "*",
    cors({
        origin: (origin) => {
            if (!ALLOWED_ORIGINS) return origin || "*"; // dev: allow all
            if (!origin) return ALLOWED_ORIGINS[0]; // non-browser requests
            return ALLOWED_ORIGINS.includes(origin) ? origin : "";
        },
        credentials: true,
    }),
);

// ---------------------------------------------------------------------------
// Global error handler — surface errors as JSON instead of raw 500
// ---------------------------------------------------------------------------

app.onError((err, c) => {
    console.error("Unhandled error:", err);
    const message = IS_PRODUCTION ? "Internal server error" : err.message ?? String(err);
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
});

// ---------------------------------------------------------------------------
// JSON 404 — catch-all for undefined routes
// ---------------------------------------------------------------------------

app.notFound((c) => {
    return c.json({ error: { code: "NOT_FOUND", message: `Route not found: ${c.req.method} ${c.req.path}` } }, 404);
});

// ---------------------------------------------------------------------------
// Numeric parameter helper — returns 400 on NaN
// ---------------------------------------------------------------------------

function requireInt(c: any, raw: string, name: string): number | Response {
    const n = Number(raw);
    if (!Number.isFinite(n) || n !== Math.floor(n)) {
        return c.json({ error: { code: "BAD_REQUEST", message: `Invalid ${name}: expected integer` } }, 400);
    }
    return n;
}

function isPathInside(baseDir: string, targetPath: string): boolean {
    const rel = relative(baseDir, targetPath);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

const IMAGE_MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 10 * 1024 * 1024);

function isSafeRelativePath(value: string): boolean {
    if (!value || value.includes("\0") || value.includes("\\") || isAbsolute(value)) return false;
    return value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function copyDraftAssetsToContents(draft: DraftPayload): void {
    for (const page of draft.pages ?? []) {
        if (!page.sourceImagePath) continue;
        if (!isSafeRelativePath(page.sourceImagePath) || !isSafeRelativePath(page.imagePath)) {
            throw new Error(`Unsafe draft asset path for page ${page.pageNumber}`);
        }
        const source = resolve(DRAFT_ASSETS_DIR, page.sourceImagePath);
        if (!isPathInside(DRAFT_ASSETS_DIR, source) || !existsSync(source)) {
            throw new Error(`Draft asset not found for page ${page.pageNumber}`);
        }
        const episodeDir = resolve(CONTENTS_DIR, draft.seriesId, draft.episodeId);
        const destination = resolve(episodeDir, page.imagePath);
        if (!isPathInside(episodeDir, destination)) {
            throw new Error(`Unsafe canonical image path for page ${page.pageNumber}`);
        }
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(source, destination);
    }
}

async function readImageUpload(c: any): Promise<
    | { success: true; bytes: Buffer; mime: string; ext: string; originalName?: string; sha256: string }
    | { success: false; response: Response }
> {
    const contentType = c.req.header("content-type") ?? "";
    let bytes: Buffer;
    let mime = contentType.split(";")[0].toLowerCase();
    let originalName: string | undefined;

    if (contentType.startsWith("multipart/form-data")) {
        const body = await c.req.parseBody();
        const file = body.file as any;
        if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
            return { success: false, response: c.json({ error: { code: "VALIDATION_ERROR", message: "Multipart field \"file\" is required" } }, 400) };
        }
        mime = String(file.type || "").toLowerCase();
        originalName = typeof file.name === "string" ? file.name : undefined;
        bytes = Buffer.from(await file.arrayBuffer());
    } else if (mime in IMAGE_MIME_TO_EXT) {
        bytes = Buffer.from(await c.req.arrayBuffer());
    } else {
        return { success: false, response: c.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Upload must be multipart/form-data or image/* binary" } }, 415) };
    }

    const ext = IMAGE_MIME_TO_EXT[mime];
    if (!ext) {
        return { success: false, response: c.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Supported image types: jpeg, png, webp, gif" } }, 415) };
    }
    if (bytes.length === 0) {
        return { success: false, response: c.json({ error: { code: "VALIDATION_ERROR", message: "Uploaded image is empty" } }, 400) };
    }
    if (bytes.length > MAX_IMAGE_UPLOAD_BYTES) {
        return { success: false, response: c.json({ error: { code: "PAYLOAD_TOO_LARGE", message: `Image must be ${MAX_IMAGE_UPLOAD_BYTES} bytes or smaller` } }, 413) };
    }

    return {
        success: true,
        bytes,
        mime,
        ext,
        originalName,
        sha256: createHash("sha256").update(bytes).digest("hex"),
    };
}

function validateFeedbackPayload(body: any): { ok: true; payload: FeedbackPayload } | { ok: false; message: string } {
    const result = FeedbackPayloadSchema.safeParse(body);
    if (!result.success) {
        const message = result.error.issues
            .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
            .join("; ");
        return { ok: false, message };
    }

    return { ok: true, payload: result.data };
}

function formatZodError(error: { issues: Array<{ path: Array<string | number>; message: string }> }): string {
    return error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");
}

// ---------------------------------------------------------------------------
// Session cookie helper
// ---------------------------------------------------------------------------

function setSessionCookie(c: any, token: string): void {
    const parts = [
        `manga_auth=${token}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=86400",
    ];
    if (IS_PRODUCTION) {
        parts.push("Secure");
    }
    c.header("Set-Cookie", parts.join("; "));
}

// ---------------------------------------------------------------------------
// Auth helper — extract DevUser from Authorization header or cookie
// ---------------------------------------------------------------------------

function getUser(c: any): DevUser | null {
    // 1. Check X-API-Key header (production auth)
    const apiKey = c.req.header("x-api-key") ?? "";
    if (apiKey && apiKeyRepo) {
        // API key verification is async, but we handle it at middleware level
        // For sync getUser, we check a pre-populated context value
        const keyUser = c.get("apiKeyUser") as DevUser | undefined;
        if (keyUser) return keyUser;
    }

    // 2. Check Authorization: Bearer <token>
    const auth = c.req.header("authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
        return verifyAuthToken(auth.slice(7));
    }
    // 3. Check cookie
    const cookies = c.req.header("cookie") ?? "";
    const match = cookies.match(/manga_auth=([^;]+)/);
    if (match) {
        return verifyAuthToken(match[1]);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/health", async (c) => {
    // --- DB ---
    let dbStatus = "not_configured";
    if (process.env.DATABASE_URL) {
        try {
            const { checkDbHealth } = await import("@manga/db");
            dbStatus = (await checkDbHealth()) ? "healthy" : "unhealthy";
        } catch {
            dbStatus = "import_failed";
        }
    }

    // --- Granular checks ---
    const checks = {
        db: dbStatus,
        email: isEmailConfigured() ? "configured" : "not_configured",
        secrets: {
            auth: !!process.env.DEV_AUTH_SECRET ? "set" : "missing",
            delivery: !!process.env.DELIVERY_SECRET ? "set" : "missing",
        },
        contents: readRepo.listSeries().length > 0 ? "loaded" : "empty",
    };

    const dbOk = dbStatus !== "unhealthy" && dbStatus !== "import_failed";
    const secretsOk = !IS_PRODUCTION || (
        checks.secrets.auth === "set" && checks.secrets.delivery === "set"
    );
    const emailOk = !IS_PRODUCTION || checks.email === "configured";
    const ready = dbOk && secretsOk && emailOk;

    return c.json({
        status: "ok",
        env: NODE_ENV,
        seriesCount: readRepo.listSeries().length,
        checks,
        ready,
    });
});

// ---------------------------------------------------------------------------
// Feedback — lightweight Reader reports/proposals.
// Stored privately; does not write canonical content or packs.
// ---------------------------------------------------------------------------

app.post("/feedback", async (c) => {
    const clientIp = getClientIp(c);
    const limited = feedbackLimiter.check(`feedback:${clientIp}`);
    if (!limited.allowed) {
        return c.json({
            ok: false,
            error: {
                code: "RATE_LIMITED",
                message: `Too many feedback submissions. Retry after ${limited.retryAfterSeconds}s`,
            },
        }, 429);
    }

    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const result = validateFeedbackPayload(body);
    if (!result.ok) {
        return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: result.message } }, 400);
    }

    const { website, ...payload } = result.payload;
    if (website && website.trim().length > 0) {
        // Honeypot: pretend success but do not persist spammy submissions.
        return c.json({ ok: true, feedback_id: "fb_ignored" }, 201);
    }

    const record = feedbackRepo.save({
        payload: {
            ...payload,
            user_id: payload.user_id ?? getUser(c)?.id ?? null,
        },
        clientIp,
        userAgent: c.req.header("user-agent") ?? null,
    });

    return c.json({ ok: true, feedback_id: record.feedback_id }, 201);
});

// ===========================================================================
// ADMIN — Feedback triage
// ===========================================================================

app.get("/admin/feedback", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const status = c.req.query("status");
    const seriesId = c.req.query("seriesId");
    let items = feedbackRepo.list();
    if (status && ["new", "triaged", "closed"].includes(status)) {
        items = items.filter((record) => record.status === status);
    }
    if (seriesId) {
        items = items.filter((record) => record.series_id === seriesId);
    }
    return c.json({ items });
});

app.get("/admin/feedback/:feedbackId", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const record = feedbackRepo.get(c.req.param("feedbackId"));
    if (!record) return c.json({ error: { code: "NOT_FOUND", message: "Feedback not found" } }, 404);
    return c.json(record);
});

app.put("/admin/feedback/:feedbackId/status", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const user = getUser(c);
    const body = await c.req.json();
    const status = body?.status as FeedbackStatus;
    if (!["new", "triaged", "closed"].includes(status)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "status must be new, triaged, or closed" } }, 400);
    }
    const result = feedbackRepo.updateStatus(c.req.param("feedbackId"), {
        status,
        ...(typeof body.triage_note === "string" && { triageNote: body.triage_note }),
        ...(user?.id && { triagedBy: user.id }),
    });
    if (!result.success) {
        return c.json({ error: { code: "NOT_FOUND", message: result.error } }, 404);
    }
    return c.json(result.record);
});

// ===========================================================================
// ADMIN — Proposal queue
// ===========================================================================

app.get("/admin/proposals", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const status = c.req.query("status") as ProposalStatus | undefined;
    const kind = c.req.query("kind") as ProposalKind | undefined;
    const seriesId = c.req.query("seriesId");

    if (status && !["new", "triaged", "accepted", "rejected", "closed"].includes(status)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid proposal status" } }, 400);
    }
    if (kind && !["translation", "typo", "footnote", "commentary", "tag", "structure"].includes(kind)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid proposal kind" } }, 400);
    }

    return c.json({ items: proposalRepo.list({ status, kind, seriesId }) });
});

app.post("/admin/proposals", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = ProposalCreateInputSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: formatZodError(parsed.error) } }, 400);
    }

    const user = getUser(c);
    const record = proposalRepo.create({
        ...parsed.data,
        proposer_id: parsed.data.proposer_id ?? user?.id ?? null,
    });
    return c.json(record, 201);
});

app.get("/admin/proposals/:proposalId", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const record = proposalRepo.get(c.req.param("proposalId"));
    if (!record) return c.json({ error: { code: "NOT_FOUND", message: "Proposal not found" } }, 404);
    return c.json(record);
});

app.put("/admin/proposals/:proposalId/status", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = ProposalStatusUpdateInputSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: formatZodError(parsed.error) } }, 400);
    }

    const user = getUser(c);
    const result = proposalRepo.updateStatus(c.req.param("proposalId"), {
        status: parsed.data.status,
        ...(parsed.data.review_note !== undefined && { reviewNote: parsed.data.review_note }),
        ...(user?.id && { reviewedBy: user.id }),
    });
    if (!result.success) {
        return c.json({ error: { code: "NOT_FOUND", message: result.error } }, 404);
    }
    return c.json(result.record);
});

app.post("/admin/feedback/:feedbackId/proposal", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const feedbackId = c.req.param("feedbackId");
    const feedback = feedbackRepo.get(feedbackId);
    if (!feedback) return c.json({ error: { code: "NOT_FOUND", message: "Feedback not found" } }, 404);
    const existingProposal = proposalRepo.getBySourceFeedbackId(feedbackId);
    if (existingProposal) {
        return c.json({
            error: {
                code: "VALIDATION_ERROR",
                message: `Feedback already converted to proposal ${existingProposal.proposal_id}`,
            },
            proposal_id: existingProposal.proposal_id,
        }, 400);
    }
    if (feedback.status !== "new") {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Only new feedback can be converted to a proposal" } }, 400);
    }

    const user = getUser(c);
    const proposal = proposalRepo.create({
        ...proposalInputFromFeedback(feedback),
        proposer_id: feedback.user_id ?? user?.id ?? null,
    });
    feedbackRepo.updateStatus(feedbackId, {
        status: "triaged",
        triageNote: `Converted to proposal ${proposal.proposal_id}`,
        ...(user?.id && { triagedBy: user.id }),
    });
    return c.json(proposal, 201);
});

// ===========================================================================
// ADMIN — Pack draft manager
// Runtime draft state only. Does not write canonical `packs/` or `contents/`.
// ===========================================================================

app.get("/admin/pack-drafts", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const status = c.req.query("status") as PackDraftStatus | undefined;
    const type = c.req.query("type") as PackType | undefined;
    const seriesId = c.req.query("seriesId");

    if (status && !["draft", "in_review", "approved", "published", "archived"].includes(status)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid pack draft status" } }, 400);
    }
    if (type && !["TRANSLATION", "FOOTNOTE", "COMMENTARY", "LEARNING", "ACCESSIBILITY"].includes(type)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid pack type" } }, 400);
    }

    return c.json({ items: packDraftRepo.list({ status, type, seriesId }) });
});

app.post("/admin/pack-drafts", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = PackDraftCreateInputSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: formatZodError(parsed.error) } }, 400);
    }

    const user = getUser(c);
    const record = packDraftRepo.create({
        ...parsed.data,
        created_by: parsed.data.created_by ?? user?.id ?? null,
    });
    return c.json(record, 201);
});

app.get("/admin/pack-drafts/:packDraftId", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const record = packDraftRepo.get(c.req.param("packDraftId"));
    if (!record) return c.json({ error: { code: "NOT_FOUND", message: "Pack draft not found" } }, 404);
    return c.json(record);
});

app.put("/admin/pack-drafts/:packDraftId/status", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = PackDraftStatusUpdateInputSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: formatZodError(parsed.error) } }, 400);
    }

    const user = getUser(c);
    const result = packDraftRepo.updateStatus(c.req.param("packDraftId"), {
        status: parsed.data.status,
        reviewedBy: user?.id ?? null,
    });
    if (!result.success) {
        return c.json({ error: { code: "NOT_FOUND", message: result.error } }, 404);
    }
    return c.json(result.record);
});

app.post("/admin/pack-drafts/:packDraftId/adopt-proposal", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = PackDraftAdoptProposalInputSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: formatZodError(parsed.error) } }, 400);
    }

    const draft = packDraftRepo.get(c.req.param("packDraftId"));
    if (!draft) return c.json({ error: { code: "NOT_FOUND", message: "Pack draft not found" } }, 404);
    if (!["draft", "in_review"].includes(draft.status)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Only draft or in_review pack drafts can accept proposal entries" } }, 400);
    }

    const proposal = proposalRepo.get(parsed.data.proposal_id);
    if (!proposal) return c.json({ error: { code: "NOT_FOUND", message: "Proposal not found" } }, 404);
    if (proposal.status !== "accepted") {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Only accepted proposals can be adopted into pack drafts" } }, 400);
    }
    if (!packTypesForProposalKind(proposal.kind).includes(draft.type)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Proposal kind is not compatible with this pack draft type" } }, 400);
    }

    const user = getUser(c);
    const result = packDraftRepo.addEntry(c.req.param("packDraftId"), proposalToPackDraftEntry(proposal, user?.id ?? null));
    if (!result.success) {
        const statusCode = result.error.includes("not found") ? 404 : 400;
        return c.json({ error: { code: statusCode === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message: result.error } }, statusCode);
    }
    return c.json(result.record);
});

app.post("/admin/pack-drafts/:packDraftId/export", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = PackDraftExportInputSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: formatZodError(parsed.error) } }, 400);
    }

    const draft = packDraftRepo.get(c.req.param("packDraftId"));
    if (!draft) return c.json({ error: { code: "NOT_FOUND", message: "Pack draft not found" } }, 404);

    const result = packWriter.exportDraft({
        draft,
        exportInput: {
            packId: parsed.data.pack_id,
            ...(parsed.data.pack_class && { packClass: parsed.data.pack_class }),
            ...(parsed.data.title && { title: parsed.data.title }),
            ...(parsed.data.author_label && { authorLabel: parsed.data.author_label }),
            ...(parsed.data.is_published !== undefined && { isPublished: parsed.data.is_published }),
            ...(parsed.data.overwrite !== undefined && { overwrite: parsed.data.overwrite }),
        },
    });
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }

    if (result.pack.isPublished && draft.status !== "published") {
        packDraftRepo.updateStatus(draft.pack_draft_id, {
            status: "published",
            reviewedBy: getUser(c)?.id ?? null,
        });
    }

    return c.json({
        exported: true,
        pack: result.pack,
        path: result.path,
    });
});

// ---------------------------------------------------------------------------
// Reader — GET /series/:seriesId/episodes/:episodeId/pages/:pageNumber
// ---------------------------------------------------------------------------

app.get("/series/:seriesId/episodes/:episodeId/pages/:pageNumber", async (c) => {
    const { seriesId, episodeId } = c.req.param();
    const pageNumber = requireInt(c, c.req.param("pageNumber"), "pageNumber");
    if (pageNumber instanceof Response) return pageNumber;
    const user = getUser(c);

    const series = readRepo.getSeries(seriesId);
    if (!series) return c.json({ error: { code: "NOT_FOUND", message: "Series not found" } }, 404);

    const ep = readRepo.getEpisode(seriesId, episodeId);
    if (!ep) return c.json({ error: { code: "NOT_FOUND", message: "Episode not found" } }, 404);
    if (!isSeriesAndEpisodePublicNow(series, ep)) {
        return c.json({ error: { code: "NOT_FOUND", message: "Episode not found" } }, 404);
    }

    const page = ep.pages.find((p: any) => p.pageNumber === pageNumber);
    if (!page) return c.json({ error: { code: "NOT_FOUND", message: "Page not found" } }, 404);

    // --- Entitlement check ---
    const isFree = accessPolicy.isEpisodeFree(seriesId, episodeId, ep.episodeNumber);
    const isEntitled = isFree || (user ? await entitlements.check(user.id, "EPISODE", `${seriesId}/${episodeId}`) : false);

    if (!isEntitled) {
        // Return gated response — metadata only, no images or detailed panels
        return c.json({
            seriesId,
            episodeId,
            pageId: page.id,
            pageNumber: page.pageNumber,
            width: page.width,
            height: page.height,
            gated: true,
            message: "このページを読むには購入が必要です",
        });
    }

    // --- Generate delivery URLs instead of raw paths ---
    const userId = user?.id ?? "anonymous";
    const deliveryImages: Record<string, string> = {};
    for (const [locale, _path] of Object.entries(page.images)) {
        if (_path) {
            const token = generateDeliveryToken(page.id, userId);
            deliveryImages[locale] = makeDeliveryUrl(c, page.id, token, locale);
        }
    }

    return c.json({
        seriesId,
        episodeId,
        pageId: page.id,
        pageNumber: page.pageNumber,
        images: deliveryImages,
        width: page.width,
        height: page.height,
        gated: false,
        panels: page.panels.map((panel: any) => ({
            id: panel.id,
            panelNumber: panel.panelNumber,
            bbox: panel.bbox,
            reactionTags: panel.reactionTags,
            bubbles: panel.bubbles.map((b: any) => ({
                id: b.id,
                shortId: b.shortId,
                bubbleNumber: b.bubbleNumber,
                bubbleType: b.bubbleType,
                bbox: b.bbox,
                textOriginal: b.textOriginal,
                speaker: b.speaker ?? null,
            })),
        })),
        availablePacks: [],
    });
});

// ---------------------------------------------------------------------------
// Episode metadata
// ---------------------------------------------------------------------------

app.get("/series/:seriesId/episodes/:episodeId", async (c) => {
    const { seriesId, episodeId } = c.req.param();
    const user = getUser(c);

    const series = readRepo.getSeries(seriesId);
    if (!series) return c.json({ error: { code: "NOT_FOUND", message: "Series not found" } }, 404);

    const ep = readRepo.getEpisode(seriesId, episodeId);
    if (!ep) return c.json({ error: { code: "NOT_FOUND", message: "Episode not found" } }, 404);
    if (!isSeriesAndEpisodePublicNow(series, ep)) {
        return c.json({ error: { code: "NOT_FOUND", message: "Episode not found" } }, 404);
    }

    const publicEpisodes = visibleEpisodes(series);
    const sortedPublicEpisodes = [...publicEpisodes].sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
    const currentIndex = sortedPublicEpisodes.findIndex((candidate: any) => candidate.id === episodeId);
    const prev = currentIndex > 0 ? sortedPublicEpisodes[currentIndex - 1] : null;
    const next = currentIndex >= 0 && currentIndex < sortedPublicEpisodes.length - 1
        ? sortedPublicEpisodes[currentIndex + 1]
        : null;

    // --- Entitlement check ---
    const isFree = accessPolicy.isEpisodeFree(seriesId, episodeId, ep.episodeNumber);
    const isEntitled = isFree || (user ? await entitlements.check(user.id, "EPISODE", `${seriesId}/${episodeId}`) : false);

    if (!isEntitled) {
        // Gated: return metadata only, no page content
        return c.json({
            series: publicSeriesMeta(series),
            episode: {
                ...publicEpisodeSummary(ep),
                pages: [], // stripped
            },
            gated: true,
            message: "このエピソードを読むには購入が必要です",
            prev: prev ? { id: prev.id, title: prev.title, episodeNumber: prev.episodeNumber } : null,
            next: next ? { id: next.id, title: next.title, episodeNumber: next.episodeNumber } : null,
        });
    }

    // Entitled: replace raw image paths with delivery URLs
    const userId = user?.id ?? "anonymous";
    const safeEpisode = {
        ...ep,
        pages: ep.pages.map((page: any) => {
            const deliveryImages: Record<string, string> = {};
            for (const [locale, _path] of Object.entries(page.images ?? {})) {
                if (_path) {
                    const token = generateDeliveryToken(page.id, userId);
                    deliveryImages[locale] = makeDeliveryUrl(c, page.id, token, locale);
                }
            }
            return { ...page, images: deliveryImages };
        }),
    };

    return c.json({
        series: publicSeriesMeta(series),
        episode: safeEpisode,
        gated: false,
        prev: prev ? { id: prev.id, title: prev.title, episodeNumber: prev.episodeNumber } : null,
        next: next ? { id: next.id, title: next.title, episodeNumber: next.episodeNumber } : null,
    });
});

// ---------------------------------------------------------------------------
// Series list
// ---------------------------------------------------------------------------

app.get("/series", (c) => {
    const allSeries = readRepo.listSeries()
        .filter((s: any) => isPublicNow(s))
        .map((s: any) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            status: s.status,
            coverUrl: s.coverUrl,
            ...(s.shareImageUrl ? { shareImageUrl: s.shareImageUrl } : {}),
            ...(s.publishStartAt ? { publishStartAt: s.publishStartAt } : {}),
            ...(s.publishEndAt ? { publishEndAt: s.publishEndAt } : {}),
            ...(s.visibility ? { visibility: s.visibility } : {}),
            episodeCount: visibleEpisodes(s).length,
        }));
    return c.json({ items: allSeries });
});

app.get("/series/:seriesId", (c) => {
    const series = readRepo.getSeries(c.req.param("seriesId"));
    if (!series || !isPublicNow(series)) return c.json({ error: { code: "NOT_FOUND", message: "Series not found" } }, 404);
    const publicEpisodes = visibleEpisodes(series);
    return c.json({
        id: series.id,
        title: series.title,
        description: series.description,
        status: series.status,
        coverUrl: series.coverUrl,
        ...(series.shareImageUrl ? { shareImageUrl: series.shareImageUrl } : {}),
        ...(series.publishStartAt ? { publishStartAt: series.publishStartAt } : {}),
        ...(series.publishEndAt ? { publishEndAt: series.publishEndAt } : {}),
        ...(series.visibility ? { visibility: series.visibility } : {}),
        episodes: publicEpisodes.map((ep: any) => ({
            id: ep.id,
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            publishedAt: ep.publishedAt,
            ...(ep.publishStartAt ? { publishStartAt: ep.publishStartAt } : {}),
            ...(ep.publishEndAt ? { publishEndAt: ep.publishEndAt } : {}),
            ...(ep.visibility ? { visibility: ep.visibility } : {}),
            pageCount: ep.pages.length,
        })),
    });
});

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

app.get(
    "/quotes/:seriesId/:episodeId/:pageNumber/:panelNumber/:bubbleNumber",
    (c) => {
        const { seriesId, episodeId } = c.req.param();
        const pageNumber = requireInt(c, c.req.param("pageNumber"), "pageNumber");
        if (pageNumber instanceof Response) return pageNumber;
        const panelNumber = requireInt(c, c.req.param("panelNumber"), "panelNumber");
        if (panelNumber instanceof Response) return panelNumber;
        const bubbleNumber = requireInt(c, c.req.param("bubbleNumber"), "bubbleNumber");
        if (bubbleNumber instanceof Response) return bubbleNumber;

        const result = readRepo.findBubble(seriesId, episodeId, pageNumber, panelNumber, bubbleNumber);
        if (!result) return c.json({ error: { code: "NOT_FOUND", message: "Quote not found" } }, 404);
        if (!isSeriesAndEpisodePublicNow(result.series, result.episode)) {
            return c.json({ error: { code: "NOT_FOUND", message: "Quote not found" } }, 404);
        }

        return c.json({
            seriesId: result.series.id,
            episodeId: result.episode.id,
            pageId: result.page.id,
            panelId: result.panel.id,
            pageNumber: result.page.pageNumber,
            panelNumber: result.panel.panelNumber,
            bubble: {
                id: result.bubble.id,
                shortId: result.bubble.shortId,
                bubbleNumber: result.bubble.bubbleNumber,
                bubbleType: result.bubble.bubbleType,
                textOriginal: result.bubble.textOriginal,
                speaker: result.bubble.speaker ?? null,
                bbox: result.bubble.bbox,
            },
            panelPreview: {
                id: result.panel.id,
                panelNumber: result.panel.panelNumber,
                bbox: result.panel.bbox,
            },
        });
    },
);

// ---------------------------------------------------------------------------
// Clip
// ---------------------------------------------------------------------------

app.get(
    "/clips/:seriesId/:episodeId/:pageNumber/:panelStart/:panelEnd",
    (c) => {
        const { seriesId, episodeId } = c.req.param();
        const pageNumber = requireInt(c, c.req.param("pageNumber"), "pageNumber");
        if (pageNumber instanceof Response) return pageNumber;
        const panelStart = requireInt(c, c.req.param("panelStart"), "panelStart");
        if (panelStart instanceof Response) return panelStart;
        const panelEnd = requireInt(c, c.req.param("panelEnd"), "panelEnd");
        if (panelEnd instanceof Response) return panelEnd;

        const result = readRepo.findPanels(seriesId, episodeId, pageNumber, panelStart, panelEnd);
        if (!result) return c.json({ error: { code: "NOT_FOUND", message: "Clip not found" } }, 404);
        if (!isSeriesAndEpisodePublicNow(result.series, result.episode)) {
            return c.json({ error: { code: "NOT_FOUND", message: "Clip not found" } }, 404);
        }

        return c.json({
            seriesId: result.series.id,
            episodeId: result.episode.id,
            pageId: result.page.id,
            pageNumber: result.page.pageNumber,
            panelStart,
            panelEnd,
            panels: result.panels.map((p: any) => ({
                id: p.id,
                panelNumber: p.panelNumber,
                bbox: p.bbox,
                reactionTags: p.reactionTags,
                bubbles: p.bubbles.map((b: any) => ({
                    id: b.id,
                    bubbleNumber: b.bubbleNumber,
                    textOriginal: b.textOriginal,
                    speaker: b.speaker ?? null,
                    bubbleType: b.bubbleType,
                })),
            })),
        });
    },
);

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

app.get("/reactions", (c) => {
    const tag = c.req.query("tag") ?? "";
    if (!tag) return c.json({ error: { code: "BAD_REQUEST", message: "tag query parameter required" } }, 400);

    const results = readRepo.findReactionPanels(tag)
        .filter((r: any) => isSeriesAndEpisodePublicNow(r.series, r.episode));

    return c.json({
        items: results.map((r: any) => ({
            seriesId: r.series.id,
            seriesTitle: r.series.title,
            episodeId: r.episode.id,
            episodeNumber: r.episode.episodeNumber,
            pageNumber: r.page.pageNumber,
            panel: {
                id: r.panel.id,
                panelNumber: r.panel.panelNumber,
                bbox: r.panel.bbox,
                reactionTags: r.panel.reactionTags,
            },
        })),
    });
});

// ===========================================================================
// ADMIN — Write Endpoints (CMS)
// Guarded: require authenticated admin user.
// ===========================================================================

function requireAdmin(c: any): Response | null {
    const user = getUser(c);
    if (!user) return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
    if (user.role !== "admin") return c.json({ error: { code: "FORBIDDEN", message: "Admin role required" } }, 403);
    return null;
}

// POST /admin/series — Create a new series
app.get("/admin/series", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    return c.json({ items: readRepo.listSeries().map(adminSeriesSummary) });
});

app.get("/admin/series/:id", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const series = readRepo.getSeries(c.req.param("id"));
    if (!series) return c.json({ error: { code: "NOT_FOUND", message: "Series not found" } }, 404);
    return c.json(adminSeriesDetail(series));
});

app.post("/admin/series", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const body = await c.req.json();
    const result = writer.createSeries(body);
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json(result.series, 201);
});

// PUT /admin/series/:id — Update series metadata
app.put("/admin/series/:id", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const seriesId = c.req.param("id");
    const body = await c.req.json();
    const result = writer.updateSeries(seriesId, body);
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json(result.series);
});

// POST /admin/series/:id/episodes — Create or update an episode
app.post("/admin/series/:id/episodes", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const seriesId = c.req.param("id");
    const body = await c.req.json();
    const result = writer.saveEpisode(seriesId, body);
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json({ ok: true }, 201);
});

// PUT /admin/series/:id/episodes/:epId — Update episode
app.put("/admin/series/:id/episodes/:epId", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const seriesId = c.req.param("id");
    const epId = c.req.param("epId");
    const body = await c.req.json();
    const result = writer.saveEpisode(seriesId, { ...body, id: epId });
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json({ ok: true });
});

// GET /admin/series/:id/episodes/:epId — Read full episode (bypasses gating for CMS)
app.get("/admin/series/:id/episodes/:epId", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const seriesId = c.req.param("id");
    const epId = c.req.param("epId");
    const ep = readRepo.getEpisode(seriesId, epId);
    if (!ep) return c.json({ error: { code: "NOT_FOUND", message: "Episode not found" } }, 404);
    return c.json(ep);
});

// GET /admin/series/:id/episodes/:epId/pages/:pageNumber/image — CMS preview image
app.get("/admin/series/:id/episodes/:epId/pages/:pageNumber/image", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const seriesId = c.req.param("id");
    const epId = c.req.param("epId");
    const pageNumber = requireInt(c, c.req.param("pageNumber"), "pageNumber");
    if (pageNumber instanceof Response) return pageNumber;
    const locale = c.req.query("locale") ?? "ja";

    const ep = readRepo.getEpisode(seriesId, epId);
    if (!ep) return c.json({ error: { code: "NOT_FOUND", message: "Episode not found" } }, 404);

    const page = ep.pages.find((p: any) => p.pageNumber === pageNumber);
    if (!page) return c.json({ error: { code: "NOT_FOUND", message: "Page not found" } }, 404);

    const imagePath = (page.images as any)[locale] ?? (page.images as any).ja;
    if (!imagePath) return c.json({ error: { code: "NOT_FOUND", message: "Page image not found" } }, 404);

    const episodeAssetDir = resolve(CONTENTS_DIR, seriesId, epId);
    const absPath = resolve(episodeAssetDir, imagePath);
    if (!isPathInside(episodeAssetDir, absPath)) {
        return c.json({ error: { code: "INVALID_IMAGE_PATH", message: "Image path escapes episode directory" } }, 400);
    }

    const ext = extname(absPath).toLowerCase();
    const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    };
    const contentType = mimeMap[ext];
    if (!contentType) {
        return c.json({ error: { code: "INVALID_IMAGE_PATH", message: "Unsupported image extension" } }, 400);
    }
    if (!existsSync(absPath)) {
        return c.json({ error: { code: "NOT_FOUND", message: "Image file not found" } }, 404);
    }

    const fileData = readFileSync(absPath);
    return new Response(fileData, {
        status: 200,
        headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
    });
});

// POST /admin/series/:id/episodes/:epId/pages/:pageNumber/image — Upload Page image
app.post("/admin/series/:id/episodes/:epId/pages/:pageNumber/image", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const seriesId = c.req.param("id");
    const epId = c.req.param("epId");
    const pageNumber = requireInt(c, c.req.param("pageNumber"), "pageNumber");
    if (pageNumber instanceof Response) return pageNumber;
    const locale = c.req.query("locale") ?? "ja";
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(locale)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "locale must be a safe short identifier" } }, 400);
    }

    const ep = readRepo.getEpisode(seriesId, epId);
    if (!ep) return c.json({ error: { code: "NOT_FOUND", message: "Episode not found" } }, 404);
    const page = ep.pages.find((p: any) => p.pageNumber === pageNumber);
    if (!page) return c.json({ error: { code: "NOT_FOUND", message: "Page not found" } }, 404);

    const upload = await readImageUpload(c);
    if (!upload.success) return upload.response;

    const episodeAssetDir = resolve(CONTENTS_DIR, seriesId, epId);
    const pagesDir = resolve(episodeAssetDir, "pages");
    const relativePath = `pages/p${String(pageNumber).padStart(2, "0")}.${locale}.${upload.ext}`;
    const absPath = resolve(episodeAssetDir, relativePath);
    if (!isPathInside(episodeAssetDir, absPath) || !isPathInside(episodeAssetDir, pagesDir)) {
        return c.json({ error: { code: "INVALID_IMAGE_PATH", message: "Upload path escapes episode directory" } }, 400);
    }

    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(absPath, upload.bytes);

    const pages = ep.pages.map((p: any) => p.pageNumber === pageNumber
        ? { ...p, images: { ...(p.images ?? {}), [locale]: relativePath } }
        : p);
    const result = writer.saveEpisode(seriesId, {
        id: ep.id,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        publishedAt: ep.publishedAt,
        publishStartAt: ep.publishStartAt,
        publishEndAt: ep.publishEndAt,
        visibility: ep.visibility,
        pages,
    });
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }

    return c.json({
        uploaded: true,
        seriesId,
        episodeId: epId,
        pageNumber,
        locale,
        imagePath: relativePath,
        contentType: upload.mime,
        size: upload.bytes.length,
        sha256: upload.sha256,
        originalName: upload.originalName,
    }, 201);
});

// POST /admin/series/:id/publish — Reload read cache
app.post("/admin/series/:id/publish", (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    writer.reload();
    const series = readRepo.getSeries(c.req.param("id"));
    if (!series) {
        return c.json({ error: { code: "NOT_FOUND", message: "Series not found after publish" } }, 404);
    }
    return c.json({
        published: true,
        seriesId: series.id,
        episodeCount: series.episodes.length,
        viewerUrl: `/works/${series.id}`,
        apiUrl: `/api/v1/series/${series.id}`,
    });
});

// ===========================================================================
// INGESTION — Job management endpoints
// ===========================================================================

const DRAFTS_DIR = process.env.DRAFTS_DIR ?? join(__dirname, "../../../drafts");

let ingestion: IngestionRepository;
let apiKeyRepo: any = null;
let purchaseRepo: any = null;
let magicLinkRepo: any = null;

if (process.env.DATABASE_URL) {
    try {
        const { getPrisma, DbIngestionRepository, ApiKeyRepository, PurchaseRepository, MagicLinkRepository } = await import("@manga/db");
        const prisma = getPrisma();
        ingestion = new DbIngestionRepository(prisma, writer, copyDraftAssetsToContents);
        apiKeyRepo = new ApiKeyRepository(prisma);
        purchaseRepo = new PurchaseRepository(prisma);
        magicLinkRepo = new MagicLinkRepository(prisma);
        console.log("✅ DB-backed ingestion, API keys, purchases, magic link");
    } catch (e) {
        console.warn("⚠ DB ingestion import failed, falling back to file-backed:", (e as Error).message);
        ingestion = createFileIngestionRepository(DRAFTS_DIR, writer, copyDraftAssetsToContents);
    }
} else {
    ingestion = createFileIngestionRepository(DRAFTS_DIR, writer, copyDraftAssetsToContents);
    console.log("📁 File-backed ingestion (no DATABASE_URL)");
}

// Middleware: resolve API key to user (async)
app.use("*", async (c, next) => {
    const apiKey = c.req.header("x-api-key");
    if (apiKey && apiKeyRepo) {
        const keyUser = await apiKeyRepo.verify(apiKey);
        if (keyUser) {
            (c as any).set("apiKeyUser", { id: keyUser.id, name: keyUser.name, role: keyUser.role } as DevUser);
        }
    }
    await next();
});

function listPreparedImageFiles(sourceDir: string): string[] {
    return readdirSync(sourceDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function preparedImportError(c: any, message: string, status = 400): Response {
    return c.json({ error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message } }, status);
}

// POST /admin/ingestion/import/prepared-directory — Create draft job from local prepared assets.
app.post("/admin/ingestion/import/prepared-directory", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const body = await c.req.json();
    const sourceDirInput = String(body.sourceDir ?? "");
    if (!isSafeRelativePath(sourceDirInput)) {
        return preparedImportError(c, "sourceDir must be a safe path relative to IMPORTS_DIR");
    }

    const sourceDir = resolve(IMPORTS_DIR, sourceDirInput);
    if (!isPathInside(IMPORTS_DIR, sourceDir) || !existsSync(sourceDir)) {
        return preparedImportError(c, "Prepared source directory not found", 404);
    }

    const seriesId = String(body.seriesId ?? "");
    const seriesTitle = String(body.seriesTitle ?? "");
    const episodeId = String(body.episodeId ?? "");
    const episodeTitle = String(body.episodeTitle ?? "");
    const episodeNumber = Number(body.episodeNumber ?? 1);
    if (!seriesId || !seriesTitle || !episodeId || !episodeTitle || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
        return preparedImportError(c, "seriesId, seriesTitle, episodeId, episodeNumber, and episodeTitle are required");
    }

    try {
        const job = await ingestion.createJob(body.label ?? `${seriesTitle} - ${episodeTitle}`);
        const sourceFiles = Array.isArray(body.pages) && body.pages.length > 0
            ? body.pages.map((page: any) => String(page.sourcePath ?? page.fileName ?? ""))
            : listPreparedImageFiles(sourceDir);

        if (sourceFiles.length === 0) {
            return preparedImportError(c, "No supported image files found in prepared source directory");
        }

        const draftPages = sourceFiles.map((fileName: string, index: number) => {
            if (!fileName || !isSafeRelativePath(fileName)) {
                throw new Error(`Unsafe page source path at index ${index}`);
            }
            const ext = extname(fileName).toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext)) {
                throw new Error(`Unsupported image extension: ${fileName}`);
            }
            const source = resolve(sourceDir, fileName);
            if (!isPathInside(sourceDir, source) || !existsSync(source)) {
                throw new Error(`Prepared image not found: ${fileName}`);
            }
            const bodyPage = Array.isArray(body.pages) ? body.pages[index] ?? {} : {};
            const pageNumber = Number(bodyPage.pageNumber ?? index + 1);
            if (!Number.isInteger(pageNumber) || pageNumber < 1) {
                throw new Error(`Invalid pageNumber for ${fileName}`);
            }
            const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
            const canonicalFileName = `p${String(pageNumber).padStart(3, "0")}${normalizedExt}`;
            const sourceImagePath = `${job.id}/pages/${canonicalFileName}`;
            const draftAssetPath = resolve(DRAFT_ASSETS_DIR, sourceImagePath);
            if (!isPathInside(DRAFT_ASSETS_DIR, draftAssetPath)) {
                throw new Error(`Unsafe draft asset path for ${fileName}`);
            }
            mkdirSync(dirname(draftAssetPath), { recursive: true });
            copyFileSync(source, draftAssetPath);
            return {
                pageNumber,
                imagePath: `pages/${canonicalFileName}`,
                sourceImagePath,
                width: Number(bodyPage.width ?? body.defaultWidth ?? 500),
                height: Number(bodyPage.height ?? body.defaultHeight ?? 760),
                displayRef: typeof bodyPage.displayRef === "string" && bodyPage.displayRef ? bodyPage.displayRef : undefined,
            };
        });

        const draft = buildPreparedDirectoryDraft({
            seriesId,
            seriesTitle,
            seriesDescription: typeof body.seriesDescription === "string" ? body.seriesDescription : undefined,
            seriesStatus: body.seriesStatus,
            episodeId,
            episodeNumber,
            episodeTitle,
            pages: draftPages,
            defaultWidth: Number(body.defaultWidth ?? 500),
            defaultHeight: Number(body.defaultHeight ?? 760),
        });
        const update = await ingestion.updateDraft(job.id, draft);
        if (!update.success) {
            return preparedImportError(c, update.error);
        }
        const created = await ingestion.getJob(job.id);
        return c.json(created ?? job, 201);
    } catch (error) {
        return preparedImportError(c, error instanceof Error ? error.message : String(error));
    }
});

// POST /admin/ingestion/jobs — Create a new ingestion job
app.post("/admin/ingestion/jobs", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const body = await c.req.json();
    const job = await ingestion.createJob(body.label ?? "Untitled", body.draft ?? undefined);
    return c.json(job, 201);
});

// GET /admin/ingestion/jobs — List all jobs
app.get("/admin/ingestion/jobs", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    return c.json({ items: await ingestion.listJobs() });
});

// GET /admin/ingestion/jobs/:jobId — Get job detail
app.get("/admin/ingestion/jobs/:jobId", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const job = await ingestion.getJob(c.req.param("jobId"));
    if (!job) return c.json({ error: { code: "NOT_FOUND", message: "Job not found" } }, 404);
    return c.json(job);
});

// GET /admin/ingestion/jobs/:jobId/review-candidates — List Page/Panel/Bubble candidates
app.get("/admin/ingestion/jobs/:jobId/review-candidates", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const result = await ingestion.getReviewCandidates(c.req.param("jobId"));
    if (!result.success) {
        const status = result.error === "Job not found" ? 404 : 400;
        return c.json({ error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message: result.error } }, status);
    }
    return c.json({ items: result.candidates });
});

// PUT /admin/ingestion/jobs/:jobId/review-decisions — Persist one candidate decision
app.put("/admin/ingestion/jobs/:jobId/review-decisions", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const user = getUser(c);
    const body = await c.req.json();
    const target = body?.target;
    const decision = body?.decision;
    if (
        !target ||
        (target.kind !== "panel" && target.kind !== "bubble") ||
        typeof target.pageNumber !== "number" ||
        typeof target.panelNumber !== "number" ||
        (target.kind === "bubble" && typeof target.bubbleNumber !== "number") ||
        !["pending", "accepted", "rejected"].includes(decision)
    ) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid review decision payload" } }, 400);
    }
    const result = await ingestion.setReviewDecision(c.req.param("jobId"), {
        target,
        decision,
        ...(typeof body.note === "string" && { note: body.note }),
        ...(user?.id && { reviewerId: user.id }),
    });
    if (!result.success) {
        const status = result.error === "Job not found" ? 404 : 400;
        return c.json({ error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message: result.error } }, status);
    }
    return c.json({ ok: true, items: result.candidates });
});

// POST /admin/ingestion/jobs/:jobId/write-reviewed-draft — Keep only accepted candidates in draft
app.post("/admin/ingestion/jobs/:jobId/write-reviewed-draft", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const result = await ingestion.writeReviewedDraft(c.req.param("jobId"));
    if (!result.success) {
        const status = result.error === "Job not found" ? 404 : 400;
        return c.json({ error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message: result.error } }, status);
    }
    return c.json({ ok: true, draft: result.draft });
});

// PUT /admin/ingestion/jobs/:jobId/draft — Update draft payload
app.put("/admin/ingestion/jobs/:jobId/draft", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const jobId = c.req.param("jobId");
    const draft = await c.req.json();
    const result = await ingestion.updateDraft(jobId, draft);
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json({ ok: true });
});

// POST /admin/ingestion/jobs/:jobId/submit — Submit for review
app.post("/admin/ingestion/jobs/:jobId/submit", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const result = await ingestion.submitForReview(c.req.param("jobId"));
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json({ ok: true });
});

// POST /admin/ingestion/jobs/:jobId/confirm — Confirm and write to contents/
app.post("/admin/ingestion/jobs/:jobId/confirm", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const result = await ingestion.confirmJob(c.req.param("jobId"));
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json({ confirmed: true, seriesId: result.seriesId });
});

// POST /admin/ingestion/jobs/:jobId/cancel — Cancel job
app.post("/admin/ingestion/jobs/:jobId/cancel", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const result = await ingestion.cancelJob(c.req.param("jobId"));
    if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: result.error } }, 400);
    }
    return c.json({ ok: true });
});

// ===========================================================================
// AUTH — Dev login/me
// ===========================================================================

app.post("/auth/dev-login", async (c) => {
    // Block dev-login in production
    if (IS_PRODUCTION) {
        return c.json({ error: { code: "NOT_FOUND", message: "Not available" } }, 404);
    }
    const body = await c.req.json();
    const devAdminIds = (process.env.DEV_ADMIN_IDS ?? "dev-admin").split(",");
    const userId = body.userId ?? "dev-user-1";
    const user: DevUser = {
        id: userId,
        name: body.name ?? "Dev User",
        role: devAdminIds.includes(userId) ? "admin" : "user",
    };
    const token = generateAuthToken(user);
    setSessionCookie(c, token);
    return c.json({ token, user });
});

// ---------------------------------------------------------------------------
// AUTH — Magic link login (DB-backed, one-time, time-limited tokens)
// ---------------------------------------------------------------------------

// POST /auth/login — Create a magic link token and send via email.
const loginRateLimiter = new RateLimiter();

app.post("/auth/login", async (c) => {
    const body = await c.req.json();
    const email = body.email;
    if (!email || typeof email !== "string" || !email.includes("@")) {
        return c.json({ error: { code: "BAD_REQUEST", message: "Valid email required" } }, 400);
    }

    // Rate limit by email and IP
    const clientIp = getClientIp(c);
    const emailLimit = loginRateLimiter.check(`email:${email}`);
    if (!emailLimit.allowed) {
        return c.json({ error: { code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." } }, 429);
    }
    const ipLimit = loginRateLimiter.check(`ip:${clientIp}`);
    if (!ipLimit.allowed) {
        return c.json({ error: { code: "RATE_LIMITED", message: "Too many login attempts from this address. Please try again later." } }, 429);
    }

    // Require DB for magic link tokens
    if (!magicLinkRepo) {
        return c.json({ error: { code: "NOT_AVAILABLE", message: "Magic link login requires DATABASE_URL" } }, 503);
    }

    // Require email provider in production
    const emailProvider = getEmailProvider();
    if (!emailProvider) {
        return c.json({ error: { code: "EMAIL_NOT_CONFIGURED", message: "Email delivery is not configured" } }, 503);
    }

    // Create DB-backed token (raw token returned once, only hash stored)
    let rawToken: string, userId: string, expiresAt: Date;
    try {
        ({ rawToken, userId, expiresAt } = await magicLinkRepo.create(email, getClientIp(c)));
    } catch (err) {
        console.error("Magic link create failed:", err);
        return c.json({ error: { code: "TOKEN_CREATE_FAILED", message: IS_PRODUCTION ? "Login temporarily unavailable" : String(err) } }, 500);
    }

    // Build verify URL
    const baseUrl = process.env.APP_URL ?? c.req.url.replace(/\/auth\/login.*/, "");
    const verifyUrl = `${baseUrl}/auth/verify?token=${encodeURIComponent(rawToken)}`;

    // Send magic link
    const result = await emailProvider.sendMagicLink(email, rawToken, verifyUrl);

    if (!result.success) {
        console.error(`Email delivery failed for ${email}: ${result.error}`);
        return c.json({ error: { code: "EMAIL_FAILED", message: "Failed to send login email. Please try again." } }, 500);
    }

    // In dev mode (console provider), return token directly for testing
    if (!IS_PRODUCTION && !isEmailConfigured()) {
        return c.json({
            ok: true,
            message: "Magic link created (console — set RESEND_API_KEY for real email)",
            verifyUrl,
            token: rawToken,
            userId,
            expiresAt: expiresAt.toISOString(),
        });
    }

    // In production, never expose the token
    return c.json({ ok: true, message: "If this email is registered, a login link has been sent." });
});

// GET /auth/verify — Verify and consume a magic link token, issue session cookie.
app.get("/auth/verify", async (c) => {
    const token = c.req.query("token");
    if (!token) {
        return c.json({ error: { code: "BAD_REQUEST", message: "token required" } }, 400);
    }

    if (!magicLinkRepo) {
        return c.json({ error: { code: "NOT_AVAILABLE", message: "Token verification requires DATABASE_URL" } }, 503);
    }

    // Verify and consume the token (one-time use)
    const result = await magicLinkRepo.verify(token);
    if (!result.success) {
        return c.json({ error: { code: "UNAUTHORIZED", message: result.error } }, 401);
    }

    // Issue a session cookie using the existing session token mechanism
    const user: DevUser = { id: result.userId, name: result.email, role: "user" };
    const sessionToken = generateAuthToken(user);
    setSessionCookie(c, sessionToken);
    return c.json({ authenticated: true, user });
});

app.get("/auth/me", (c) => {
    const user = getUser(c);
    if (!user) return c.json({ authenticated: false }, 401);
    return c.json({ authenticated: true, user });
});

// ===========================================================================
// ENTITLEMENT — Grant / Check / List / Revoke
// ===========================================================================

app.post("/admin/entitlements/grant", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const body = await c.req.json();
    const ent = await entitlements.grant({
        userId: body.userId,
        targetType: body.targetType ?? "EPISODE",
        targetId: body.targetId,
        source: body.source ?? "ADMIN_GRANT",
    });
    return c.json(ent, 201);
});

app.get("/entitlements/check", async (c) => {
    const user = getUser(c);
    if (!user) return c.json({ entitled: false, reason: "Not authenticated" });
    const seriesId = c.req.query("seriesId") ?? "";
    const episodeId = c.req.query("episodeId") ?? "";
    if (!seriesId || !episodeId) {
        return c.json({ error: { code: "BAD_REQUEST", message: "seriesId and episodeId required" } }, 400);
    }
    const ep = readRepo.getEpisode(seriesId, episodeId);
    const series = readRepo.getSeries(seriesId);
    if (!series || !ep || !isSeriesAndEpisodePublicNow(series, ep)) {
        return c.json({ entitled: false, reason: "Content unavailable" });
    }
    const isFree = ep ? accessPolicy.isEpisodeFree(seriesId, episodeId, ep.episodeNumber) : false;
    const isEntitled = isFree || await entitlements.check(user.id, "EPISODE", `${seriesId}/${episodeId}`);
    return c.json({ entitled: isEntitled, free: isFree, userId: user.id });
});

app.get("/admin/entitlements/list", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const userId = c.req.query("userId") ?? "";
    if (!userId) return c.json({ error: { code: "BAD_REQUEST", message: "userId required" } }, 400);
    return c.json({ items: await entitlements.listForUser(userId) });
});

app.post("/admin/entitlements/revoke", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    const body = await c.req.json();
    const ok = await entitlements.revoke(body.entitlementId);
    if (!ok) return c.json({ error: { code: "NOT_FOUND", message: "Entitlement not found" } }, 404);
    return c.json({ ok: true });
});

// ===========================================================================
// DELIVERY — /deliver/:pageId
// ===========================================================================

app.get("/deliver/:pageId", (c) => {
    const pageId = c.req.param("pageId");
    const token = c.req.query("token") ?? "";
    const locale = c.req.query("lang") ?? c.req.query("locale") ?? "ja";

    // Verify delivery token
    const payload = verifyDeliveryToken(token);
    if (!payload) {
        return c.json({ error: { code: "FORBIDDEN", message: "Invalid or expired delivery token" } }, 403);
    }
    if (payload.pageId !== pageId) {
        return c.json({ error: { code: "FORBIDDEN", message: "Token does not match page" } }, 403);
    }

    // Find the page's origin image path in contents
    let originRelPath: string | null = null;
    let seriesId: string | null = null;
    let episodeId: string | null = null;
    for (const series of readRepo.listSeries()) {
        if (!isPublicNow(series)) continue;
        for (const ep of series.episodes) {
            if (!isPublicNow(ep)) continue;
            const page = ep.pages.find((p: any) => p.id === pageId);
            if (page) {
                originRelPath = (page.images as any)[locale] ?? (page.images as any).ja ?? null;
                seriesId = series.id;
                episodeId = ep.id;
                break;
            }
        }
        if (originRelPath) break;
    }

    if (!originRelPath || !seriesId || !episodeId) {
        return c.json({ error: { code: "NOT_FOUND", message: "Page image not found" } }, 404);
    }

    // Apply watermark stub (returns path unchanged for now)
    const finalRelPath = applyWatermark(originRelPath, payload.userId);

    // Resolve inside the episode asset directory; content metadata must not
    // be able to escape via "../" or absolute paths.
    const episodeAssetDir = resolve(CONTENTS_DIR, seriesId, episodeId);
    const absPath = resolve(episodeAssetDir, finalRelPath);
    if (!isPathInside(episodeAssetDir, absPath)) {
        return c.json({ error: { code: "INVALID_IMAGE_PATH", message: "Image path escapes episode directory" } }, 400);
    }

    const ext = extname(absPath).toLowerCase();
    const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    };
    const contentType = mimeMap[ext];
    if (!contentType) {
        return c.json({ error: { code: "INVALID_IMAGE_PATH", message: "Unsupported image extension" } }, 400);
    }

    // Serve actual image bytes if file exists
    if (existsSync(absPath)) {
        const fileData = readFileSync(absPath);
        return new Response(fileData, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=300",
                "X-Watermark-Applied": "false",
            },
        });
    }

    // File not on disk yet — return a placeholder response.
    // In production this would be a CDN redirect.
    return c.json({
        pageId,
        locale,
        resolvedPath: finalRelPath,
        fileExists: false,
        note: "Image file not found on disk. Place the file at the resolved path to enable delivery.",
    }, 200);
});

// ===========================================================================
// API KEYS — Production auth management
// ===========================================================================

// POST /admin/api-keys — Create a new API key
app.post("/admin/api-keys", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    if (!apiKeyRepo) return c.json({ error: { code: "NOT_AVAILABLE", message: "API keys require DATABASE_URL" } }, 501);
    const body = await c.req.json();
    const user = getUser(c)!;
    const result = await apiKeyRepo.create(user.id, body.name ?? "Unnamed", body.role ?? "admin");
    return c.json(result, 201);
});

// GET /admin/api-keys — List API keys
app.get("/admin/api-keys", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    if (!apiKeyRepo) return c.json({ error: { code: "NOT_AVAILABLE", message: "API keys require DATABASE_URL" } }, 501);
    const items = await apiKeyRepo.list();
    return c.json({ items });
});

// POST /admin/api-keys/:id/revoke — Revoke an API key
app.post("/admin/api-keys/:id/revoke", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    if (!apiKeyRepo) return c.json({ error: { code: "NOT_AVAILABLE", message: "API keys require DATABASE_URL" } }, 501);
    const ok = await apiKeyRepo.revoke(c.req.param("id"));
    if (!ok) return c.json({ error: { code: "NOT_FOUND", message: "API key not found" } }, 404);
    return c.json({ ok: true });
});

// ===========================================================================
// PURCHASE / REDEEM
// ===========================================================================

// POST /admin/purchases — Create a purchase record with redeem codes
app.post("/admin/purchases", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    if (!purchaseRepo) return c.json({ error: { code: "NOT_AVAILABLE", message: "Purchases require DATABASE_URL" } }, 501);
    const body = await c.req.json();
    if (!body.productId || !body.codes || !Array.isArray(body.codes)) {
        return c.json({ error: { code: "BAD_REQUEST", message: "productId and codes[] required" } }, 400);
    }
    const adminUser = getUser(c);
    const purchase = await purchaseRepo.createPurchase({
        provider: body.provider ?? "MANUAL",
        providerPurchaseId: body.providerPurchaseId,
        productId: body.productId,
        buyerEmail: body.buyerEmail,
        currency: body.currency,
        amount: body.amount,
        codes: body.codes,
        createdBy: adminUser?.id,
        metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
    });
    return c.json(purchase, 201);
});

// POST /admin/auth/cleanup — Clean up expired/consumed magic link tokens
app.post("/admin/auth/cleanup", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    if (!magicLinkRepo) return c.json({ error: { code: "NOT_AVAILABLE", message: "Requires DATABASE_URL" } }, 501);
    const result = await magicLinkRepo.cleanupExpired();
    return c.json({ ok: true, ...result });
});

// GET /admin/purchases — List purchases
app.get("/admin/purchases", async (c) => {
    const denied = requireAdmin(c); if (denied) return denied;
    if (!purchaseRepo) return c.json({ error: { code: "NOT_AVAILABLE", message: "Purchases require DATABASE_URL" } }, 501);
    const items = await purchaseRepo.listPurchases();
    return c.json({ items });
});

// POST /redeem — Redeem a code (authenticated user)
app.post("/redeem", async (c) => {
    const user = getUser(c);
    if (!user) return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
    if (!purchaseRepo) return c.json({ error: { code: "NOT_AVAILABLE", message: "Redeem requires DATABASE_URL" } }, 501);
    const body = await c.req.json();
    if (!body.code) return c.json({ error: { code: "BAD_REQUEST", message: "code required" } }, 400);

    // Atomically: validate code, update redemption count, and grant entitlement
    const result = await purchaseRepo.redeem(body.code, user.id, getClientIp(c));
    if (!result.success) {
        return c.json({ error: { code: "REDEEM_FAILED", message: result.error } }, 400);
    }

    return c.json({
        redeemed: true,
        targetType: result.targetType,
        targetId: result.targetId,
        entitlementId: result.entitlementId,
    });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3000);

// Fail-fast: in production, refuse to start with missing required config
const missingConfig = validateProductionConfig();
if (missingConfig.length > 0) {
    console.error(`\n❌ FATAL: Missing required production config:\n${missingConfig.map(k => `   - ${k}`).join("\n")}\n`);
    console.error("Set these environment variables and restart.\n");
    process.exit(1);
}

serve({ fetch: app.fetch, port }, (info: any) => {
    console.log(`@manga/api listening on http://localhost:${info.port}`);
});

export default app;
