import { Routes, Route, Link } from "react-router-dom";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import CreateWork from "./pages/CreateWork";
import WorkDetail from "./pages/WorkDetail";
import EpisodeEditor from "./pages/EpisodeEditor";
import Publish from "./pages/Publish";
import JobsList from "./pages/JobsList";
import CreateJob from "./pages/CreateJob";
import JobDetail from "./pages/JobDetail";
import Entitlements from "./pages/Entitlements";
import PageStructureReview from "./pages/PageStructureReview";
import LetteringWorkspace from "./pages/LetteringWorkspace";
import FeedbackList from "./pages/FeedbackList";
import FeedbackDetail from "./pages/FeedbackDetail";
import ProposalList from "./pages/ProposalList";
import ProposalDetail from "./pages/ProposalDetail";
import PackDraftList from "./pages/PackDraftList";
import PackDraftDetail from "./pages/PackDraftDetail";
import TranslationDraftImport from "./pages/TranslationDraftImport";
import GitHubHandoffList from "./pages/GitHubHandoffList";
import GitHubIdentityVerifications from "./pages/GitHubIdentityVerifications";
import RightsManager from "./pages/RightsManager";
import { devLogin, getMe, isPermissionError, listSeries, logout, requestLoginLink } from "./api";
import { LocaleSwitcher } from "./i18n/LocaleSwitcher";
import { useTranslation } from "./i18n/I18nProvider";

const devLoginEnabled = import.meta.env.DEV || import.meta.env.VITE_CMS_ENABLE_DEV_LOGIN === "true";

type CmsUser = { id: string; name: string; role: string };
type AccessState =
    | { status: "anonymous" }
    | { status: "loading" }
    | { status: "global_admin" }
    | { status: "series_scoped"; count: number }
    | { status: "no_permission" }
    | { status: "unknown" };

function AdminOnlyRoute({ user, children }: { user: CmsUser | null; children: ReactNode }) {
    const { t } = useTranslation();
    if (user?.role === "admin") return <>{children}</>;
    return (
        <div className="card empty-state">
            <p>{user ? t("app.permission.adminOnly") : t("app.permission.loginRequired")}</p>
            <Link to="/" className="btn btn-outline" style={{ marginTop: "1rem" }}>
                {t("app.nav.dashboard")}
            </Link>
        </div>
    );
}

export default function App() {
    const { t } = useTranslation();
    const [user, setUser] = useState<CmsUser | null>(null);
    const [accessState, setAccessState] = useState<AccessState>({ status: "loading" });
    const [loginError, setLoginError] = useState("");
    const [loginNotice, setLoginNotice] = useState("");
    const [loginEmail, setLoginEmail] = useState("");
    const [loginSubmitting, setLoginSubmitting] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const loadSession = async () => {
            try {
                const nextUser = await getMe();
                if (cancelled) return;
                setUser(nextUser);
                if (!nextUser) {
                    setAccessState({ status: "anonymous" });
                    return;
                }
                if (nextUser.role === "admin") {
                    setAccessState({ status: "global_admin" });
                    return;
                }
                setAccessState({ status: "loading" });
                try {
                    const items = await listSeries();
                    if (cancelled) return;
                    setAccessState(items.length > 0
                        ? { status: "series_scoped", count: items.length }
                        : { status: "no_permission" });
                } catch (error) {
                    if (cancelled) return;
                    setAccessState(isPermissionError(error) ? { status: "no_permission" } : { status: "unknown" });
                }
            } catch {
                if (!cancelled) setAccessState({ status: "anonymous" });
            }
        };
        loadSession();
        return () => {
            cancelled = true;
        };
    }, []);

    const loginAsDevAdmin = async () => {
        setLoginError("");
        setLoginNotice("");
        try {
            const session = await devLogin("dev-admin", "Dev Admin");
            setUser(session.user);
            setAccessState(session.user.role === "admin" ? { status: "global_admin" } : { status: "loading" });
        } catch (error) {
            setLoginError((error as Error).message);
        }
    };

    const sendLoginLink = async (event: FormEvent) => {
        event.preventDefault();
        const email = loginEmail.trim();
        if (!email) return;
        setLoginError("");
        setLoginNotice("");
        setLoginSubmitting(true);
        try {
            const result = await requestLoginLink(email);
            setLoginNotice(result.message || t("app.session.loginLinkSent"));
        } catch (error) {
            setLoginError((error as Error).message);
        } finally {
            setLoginSubmitting(false);
        }
    };

    const logoutSession = async () => {
        setLoginError("");
        setLoginNotice("");
        try {
            await logout();
            setUser(null);
            setAccessState({ status: "anonymous" });
            setLoginNotice(t("app.session.loggedOut"));
        } catch (error) {
            setLoginError((error as Error).message);
        }
    };

    const accessLabel = (() => {
        switch (accessState.status) {
            case "global_admin":
                return t("app.permission.globalAdmin");
            case "series_scoped":
                return t("app.permission.seriesScoped", { count: accessState.count });
            case "no_permission":
                return t("app.permission.noPermission");
            case "loading":
                return t("app.permission.checking");
            case "unknown":
                return t("app.permission.unknown");
            case "anonymous":
                return t("app.permission.loggedOut");
        }
    })();

    const navGroups = [
        {
            label: t("app.nav.groupEdit"),
            links: [
                { to: "/", label: t("app.nav.dashboard") },
                ...(user?.role === "admin" ? [
                    { to: "/works/new", label: t("app.nav.newWork") },
                    { to: "/ingestion", label: t("app.nav.ingestion") },
                ] : []),
            ],
        },
        {
            label: t("app.nav.groupReview"),
            links: user?.role === "admin" ? [
                { to: "/feedback", label: t("app.nav.feedback") },
                { to: "/proposals", label: t("app.nav.proposals") },
                { to: "/pack-drafts", label: t("app.nav.packDrafts") },
            ] : [],
        },
        {
            label: t("app.nav.groupAdmin"),
            links: user?.role === "admin" ? [
                { to: "/github-handoffs", label: t("app.nav.githubHandoffs") },
                { to: "/github-identities", label: t("app.nav.githubIdentities") },
                { to: "/rights", label: t("app.nav.rights") },
                { to: "/entitlements", label: t("app.nav.entitlements") },
            ] : [],
        },
    ].filter((group) => group.links.length > 0);

    return (
        <div className="app">
            <header className="app-header">
                <Link to="/" className="app-logo">{t("app.logo")}</Link>
                <button
                    type="button"
                    className="app-nav-toggle"
                    aria-controls="cms-primary-nav"
                    aria-expanded={navOpen}
                    onClick={() => setNavOpen((current) => !current)}
                >
                    {t("app.nav.menu")}
                </button>
                <nav id="cms-primary-nav" className={`app-nav ${navOpen ? "is-open" : ""}`}>
                    {navGroups.map((group) => (
                        <div key={group.label} className="app-nav-group">
                            <span className="app-nav-group-title">{group.label}</span>
                            {group.links.map((link) => (
                                <Link key={link.to} to={link.to} onClick={() => setNavOpen(false)}>
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="app-session">
                    <LocaleSwitcher />
                    {user ? (
                        <div className="app-session-user">
                            <span className="badge badge-ok">{user.name} · {accessLabel}</span>
                            <button type="button" className="btn btn-outline btn-compact" onClick={logoutSession}>
                                {t("app.session.logout")}
                            </button>
                        </div>
                    ) : devLoginEnabled ? (
                        <button type="button" className="btn btn-outline btn-compact" onClick={loginAsDevAdmin}>
                            {t("app.session.devLogin")}
                        </button>
                    ) : (
                        <form className="app-login-form" onSubmit={sendLoginLink}>
                            <input
                                type="email"
                                value={loginEmail}
                                onChange={(event) => setLoginEmail(event.target.value)}
                                placeholder={t("app.session.emailPlaceholder")}
                                aria-label={t("app.session.emailPlaceholder")}
                            />
                            <button type="submit" className="btn btn-outline btn-compact" disabled={loginSubmitting || !loginEmail.trim()}>
                                {loginSubmitting ? t("app.session.sending") : t("app.session.sendLoginLink")}
                            </button>
                        </form>
                    )}
                </div>
            </header>
            {loginError && <div className="app-banner error-msg">{loginError}</div>}
            {loginNotice && <div className="app-banner success-msg">{loginNotice}</div>}
            <main className="app-main">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/works/new" element={<AdminOnlyRoute user={user}><CreateWork /></AdminOnlyRoute>} />
                    <Route path="/works/:id" element={<WorkDetail currentUser={user} />} />
                    <Route path="/works/:id/episodes/:epId" element={<EpisodeEditor currentUser={user} />} />
                    <Route path="/works/:id/episodes/:epId/structure" element={<PageStructureReview currentUser={user} />} />
                    <Route path="/works/:id/episodes/:epId/lettering" element={<LetteringWorkspace currentUser={user} />} />
                    <Route path="/works/:id/episodes/:epId/translation-import" element={<AdminOnlyRoute user={user}><TranslationDraftImport /></AdminOnlyRoute>} />
                    <Route path="/works/:id/publish" element={<Publish />} />
                    <Route path="/ingestion" element={<AdminOnlyRoute user={user}><JobsList /></AdminOnlyRoute>} />
                    <Route path="/ingestion/new" element={<AdminOnlyRoute user={user}><CreateJob /></AdminOnlyRoute>} />
                    <Route path="/ingestion/:jobId" element={<AdminOnlyRoute user={user}><JobDetail /></AdminOnlyRoute>} />
                    <Route path="/feedback" element={<AdminOnlyRoute user={user}><FeedbackList /></AdminOnlyRoute>} />
                    <Route path="/feedback/:feedbackId" element={<AdminOnlyRoute user={user}><FeedbackDetail /></AdminOnlyRoute>} />
                    <Route path="/proposals" element={<AdminOnlyRoute user={user}><ProposalList /></AdminOnlyRoute>} />
                    <Route path="/proposals/:proposalId" element={<AdminOnlyRoute user={user}><ProposalDetail /></AdminOnlyRoute>} />
                    <Route path="/pack-drafts" element={<AdminOnlyRoute user={user}><PackDraftList /></AdminOnlyRoute>} />
                    <Route path="/pack-drafts/:packDraftId" element={<AdminOnlyRoute user={user}><PackDraftDetail /></AdminOnlyRoute>} />
                    <Route path="/github-handoffs" element={<AdminOnlyRoute user={user}><GitHubHandoffList /></AdminOnlyRoute>} />
                    <Route path="/github-identities" element={<AdminOnlyRoute user={user}><GitHubIdentityVerifications /></AdminOnlyRoute>} />
                    <Route path="/rights" element={<AdminOnlyRoute user={user}><RightsManager /></AdminOnlyRoute>} />
                    <Route path="/entitlements" element={<AdminOnlyRoute user={user}><Entitlements /></AdminOnlyRoute>} />
                </Routes>
            </main>
        </div>
    );
}
