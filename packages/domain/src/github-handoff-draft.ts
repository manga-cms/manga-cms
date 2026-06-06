import type { ContributorIdentity } from "./contributor-identity.js";
import type { GitHubHandoffRecord, GitHubHandoffTargetType } from "./github-handoff-types.js";

export interface GitHubTriageDraftTargetSummary {
    target_type: GitHubHandoffTargetType;
    target_id: string;
    status?: string;
    series_id?: string;
    episode_id?: string;
    page_id?: string | null;
    panel_id?: string | null;
    bubble_id?: string | null;
    issue_type?: string;
    kind?: string;
    mode?: string;
    lang?: string;
    current_text?: string;
    current_translation?: string;
    suggested_text?: string;
    comment?: string;
    source_url?: string;
    [key: string]: unknown;
}

export interface GitHubTriageDraftItem {
    handoff: GitHubHandoffRecord;
    target?: GitHubTriageDraftTargetSummary;
}

export interface BuildGitHubTriageDraftInput {
    items: GitHubTriageDraftItem[];
    generatedAt?: string;
    issueTitle?: string;
    triageGroupKey?: string;
}

export interface GitHubTriageDraft {
    issue_title: string;
    issue_body: string;
    handoff_ids: string[];
    items_count: number;
    generated_at: string;
    triage_group_key?: string;
}

function identityLabel(identity?: ContributorIdentity): string {
    if (!identity || identity.identity_level === "anonymous") return "anonymous";
    if (identity.identity_level === "display_name") return `${identity.display_name} (unverified)`;
    return `@${identity.github_login} (verified)`;
}

function safeCommentJson(value: unknown): string {
    return JSON.stringify(value, null, 2).replace(/--/g, "-\\u002d");
}

function targetPath(target: GitHubTriageDraftTargetSummary | undefined, handoff: GitHubHandoffRecord): string {
    if (!target) return `${handoff.target_type}:${handoff.target_id}`;
    return [
        target.series_id,
        target.episode_id,
        target.page_id,
        target.panel_id,
        target.bubble_id,
    ].filter(Boolean).join(" / ") || `${handoff.target_type}:${handoff.target_id}`;
}

function valueLine(label: string, value: unknown): string | undefined {
    if (typeof value !== "string" || value.trim().length === 0) return undefined;
    return `**${label}:** ${value.trim()}`;
}

function sourceSummary(target: GitHubTriageDraftTargetSummary | undefined): string | undefined {
    if (!target) return undefined;
    const primary = target.issue_type ?? target.kind;
    const pieces = [primary, target.mode, target.lang, target.status].filter(Boolean);
    return pieces.length ? pieces.join(" / ") : undefined;
}

export function buildGitHubTriageDraft(input: BuildGitHubTriageDraftInput): GitHubTriageDraft {
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const date = generatedAt.slice(0, 10);
    const groupLabel = input.triageGroupKey ?? "unfiled";
    const issueTitle = input.issueTitle?.trim() || `[Triage] ${groupLabel} Feedback (${date})`;
    const sortedItems = [...input.items].sort((a, b) => a.handoff.created_at.localeCompare(b.handoff.created_at));

    const sections = sortedItems.map((item, index) => {
        const { handoff, target } = item;
        const title = handoff.title?.trim() || sourceSummary(target) || `${handoff.target_type} ${handoff.target_id}`;
        const lines = [
            `## ${index + 1}. ${title}`,
            "",
            `- Handoff: \`${handoff.handoff_id}\``,
            `- Target: \`${handoff.target_type}:${handoff.target_id}\``,
            `- Target path: \`${targetPath(target, handoff)}\``,
            `- Contributor: ${identityLabel(handoff.contributor_identity)}`,
            `- Created: ${handoff.created_at}`,
            handoff.triage_group_key ? `- Group: \`${handoff.triage_group_key}\`` : undefined,
            "",
            valueLine("Current", target?.current_text ?? target?.current_translation),
            valueLine("Suggested", target?.suggested_text),
            valueLine("Comment", target?.comment ?? handoff.body),
            valueLine("Source", target?.source_url),
            "",
            "<!-- manga-cms-github-handoff",
            safeCommentJson({
                handoffId: handoff.handoff_id,
                targetType: handoff.target_type,
                targetId: handoff.target_id,
                triageGroupKey: handoff.triage_group_key,
                contributorIdentity: handoff.contributor_identity,
                target,
            }),
            "-->",
        ].filter((line): line is string => line !== undefined);
        return lines.join("\n");
    });

    const issueBody = [
        "# Manga CMS triage draft",
        "",
        `Generated at: ${generatedAt}`,
        `Items: ${sortedItems.length}`,
        input.triageGroupKey ? `Group: \`${input.triageGroupKey}\`` : undefined,
        "",
        "> Bot-authored draft. Review before posting to GitHub.",
        "",
        ...sections,
    ].filter((line): line is string => line !== undefined).join("\n");

    return {
        issue_title: issueTitle,
        issue_body: issueBody,
        handoff_ids: sortedItems.map((item) => item.handoff.handoff_id),
        items_count: sortedItems.length,
        generated_at: generatedAt,
        ...(input.triageGroupKey && { triage_group_key: input.triageGroupKey }),
    };
}
