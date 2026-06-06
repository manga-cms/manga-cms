import { z } from "zod";

export const ContributorIdentityLevelSchema = z.enum(["anonymous", "display_name", "github_login"]);

export const AnonymousContributorIdentitySchema = z.object({
    identity_level: z.literal("anonymous"),
}).strict();

export const DisplayNameContributorIdentitySchema = z.object({
    identity_level: z.literal("display_name"),
    display_name: z.string().trim().min(1).max(80),
}).strict();

export const GitHubLoginContributorIdentitySchema = z.object({
    identity_level: z.literal("github_login"),
    github_login: z.string().trim().min(1).max(39).regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/),
    github_user_id: z.string().max(120).optional(),
    verified: z.literal(true),
}).strict();

export const ContributorIdentitySchema = z.discriminatedUnion("identity_level", [
    AnonymousContributorIdentitySchema,
    DisplayNameContributorIdentitySchema,
    GitHubLoginContributorIdentitySchema,
]);

export const PublicFeedbackContributorIdentitySchema = z.discriminatedUnion("identity_level", [
    AnonymousContributorIdentitySchema,
    DisplayNameContributorIdentitySchema,
]);

export type ContributorIdentityData = z.infer<typeof ContributorIdentitySchema>;
export type PublicFeedbackContributorIdentityData = z.infer<typeof PublicFeedbackContributorIdentitySchema>;
