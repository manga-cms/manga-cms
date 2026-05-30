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
import { devLogin, getMe } from "./api";

export default function App() {
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
                <Link to="/" className="app-logo">📚 Manga CMS</Link>
                <nav>
                    <Link to="/">Dashboard</Link>
                    <Link to="/works/new">+ New Work</Link>
                    <Link to="/ingestion">📥 Ingestion</Link>
                    <Link to="/feedback">Feedback</Link>
                    <Link to="/entitlements">🔐 Entitlements</Link>
                </nav>
                <div className="app-session">
                    {user ? (
                        <span className="badge badge-ok">{user.name} · {user.role}</span>
                    ) : (
                        <button type="button" className="btn btn-outline btn-compact" onClick={loginAsDevAdmin}>
                            Dev Admin Login
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
                    <Route path="/works/:id/publish" element={<Publish />} />
                    <Route path="/ingestion" element={<JobsList />} />
                    <Route path="/ingestion/new" element={<CreateJob />} />
                    <Route path="/ingestion/:jobId" element={<JobDetail />} />
                    <Route path="/feedback" element={<FeedbackList />} />
                    <Route path="/feedback/:feedbackId" element={<FeedbackDetail />} />
                    <Route path="/entitlements" element={<Entitlements />} />
                </Routes>
            </main>
        </div>
    );
}
