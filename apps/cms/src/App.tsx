import { Routes, Route, Link } from "react-router-dom";
import type { FormEvent } from "react";
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
import { devLogin, getMe, logout, requestLoginLink } from "./api";
import { LocaleSwitcher } from "./i18n/LocaleSwitcher";
import { useTranslation } from "./i18n/I18nProvider";

const devLoginEnabled = import.meta.env.DEV || import.meta.env.VITE_CMS_ENABLE_DEV_LOGIN === "true";

export default function App() {
    const { t } = useTranslation();
    const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
    const [loginError, setLoginError] = useState("");
    const [loginNotice, setLoginNotice] = useState("");
    const [loginEmail, setLoginEmail] = useState("");
    const [loginSubmitting, setLoginSubmitting] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    useEffect(() => {
        getMe().then(setUser).catch(() => undefined);
    }, []);

    const loginAsDevAdmin = async () => {
        setLoginError("");
        setLoginNotice("");
        try {
            const session = await devLogin("dev-admin", "Dev Admin");
            setUser(session.user);
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
            setLoginNotice(t("app.session.loggedOut"));
        } catch (error) {
            setLoginError((error as Error).message);
        }
    };

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
                            <span className="badge badge-ok">{user.name} · {user.role}</span>
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
                    <Route path="/works/new" element={<CreateWork />} />
                    <Route path="/works/:id" element={<WorkDetail />} />
                    <Route path="/works/:id/episodes/:epId" element={<EpisodeEditor />} />
                    <Route path="/works/:id/episodes/:epId/structure" element={<PageStructureReview />} />
                    <Route path="/works/:id/episodes/:epId/translation-import" element={<TranslationDraftImport />} />
                    <Route path="/works/:id/publish" element={<Publish />} />
                    <Route path="/ingestion" element={<JobsList />} />
                    <Route path="/ingestion/new" element={<CreateJob />} />
                    <Route path="/ingestion/:jobId" element={<JobDetail />} />
                    <Route path="/feedback" element={<FeedbackList />} />
                    <Route path="/feedback/:feedbackId" element={<FeedbackDetail />} />
                    <Route path="/proposals" element={<ProposalList />} />
                    <Route path="/proposals/:proposalId" element={<ProposalDetail />} />
                    <Route path="/pack-drafts" element={<PackDraftList />} />
                    <Route path="/pack-drafts/:packDraftId" element={<PackDraftDetail />} />
                    <Route path="/github-handoffs" element={<GitHubHandoffList />} />
                    <Route path="/github-identities" element={<GitHubIdentityVerifications />} />
                    <Route path="/rights" element={<RightsManager />} />
                    <Route path="/entitlements" element={<Entitlements />} />
                </Routes>
            </main>
        </div>
    );
}
