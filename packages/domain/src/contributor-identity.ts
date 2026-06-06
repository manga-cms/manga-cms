export type ContributorIdentityLevel = "anonymous" | "display_name" | "github_login";

export interface AnonymousContributorIdentity {
    identity_level: "anonymous";
}

export interface DisplayNameContributorIdentity {
    identity_level: "display_name";
    display_name: string;
}

export interface GitHubLoginContributorIdentity {
    identity_level: "github_login";
    github_login: string;
    github_user_id?: string;
    verified: true;
}

export type ContributorIdentity =
    | AnonymousContributorIdentity
    | DisplayNameContributorIdentity
    | GitHubLoginContributorIdentity;

export function normalizeContributorIdentity(identity?: ContributorIdentity | null): ContributorIdentity {
    return identity ?? { identity_level: "anonymous" };
}

export function isVerifiedGitHubContributor(identity?: ContributorIdentity | null): identity is GitHubLoginContributorIdentity {
    return identity?.identity_level === "github_login" && identity.verified === true && identity.github_login.length > 0;
}
