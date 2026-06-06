import { Routes, Route, Link } from "react-router-dom";
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
import { devLogin, getMe } from "./api";
import { LocaleSwitcher } from "./i18n/LocaleSwitcher";
import { useTranslation } from "./i18n/I18nProvider";

export default function App() {
    const { t } = useTranslation();
    const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
    const [loginError, setLoginError] = useState("");

    useEffect(() => {
        getMe().then(setUser).catch(() => undefined);
    }, []);

    const loginAsDevAdmin = async () => {
        setLoginError("");
        try {
            const session = await devLogin("dev-admin", "Dev Admin");
            setUser(session.user);
        } catch (error) {
            setLoginError((error as Error).message);
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <Link to="/" className="app-logo">{t("app.logo")}</Link>
                <nav>
                    <Link to="/">{t("app.nav.dashboard")}</Link>
                    <Link to="/works/new">{t("app.nav.newWork")}</Link>
                    <Link to="/ingestion">{t("app.nav.ingestion")}</Link>
                    <Link to="/feedback">{t("app.nav.feedback")}</Link>
                    <Link to="/proposals">{t("app.nav.proposals")}</Link>
                    <Link to="/pack-drafts">{t("app.nav.packDrafts")}</Link>
                    <Link to="/github-handoffs">{t("app.nav.githubHandoffs")}</Link>
                    <Link to="/github-identities">{t("app.nav.githubIdentities")}</Link>
                    <Link to="/rights">{t("app.nav.rights")}</Link>
                    <Link to="/entitlements">{t("app.nav.entitlements")}</Link>
                </nav>
                <div className="app-session">
                    <LocaleSwitcher />
                    {user ? (
                        <span className="badge badge-ok">{user.name} · {user.role}</span>
                    ) : (
                        <button type="button" className="btn btn-outline btn-compact" onClick={loginAsDevAdmin}>
                            {t("app.session.devLogin")}
                        </button>
                    )}
                </div>
            </header>
            {loginError && <div className="app-banner error-msg">{loginError}</div>}
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
