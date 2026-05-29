import { Routes, Route, Link } from "react-router-dom";
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

export default function App() {
    return (
        <div className="app">
            <header className="app-header">
                <Link to="/" className="app-logo">📚 Manga CMS</Link>
                <nav>
                    <Link to="/">Dashboard</Link>
                    <Link to="/works/new">+ New Work</Link>
                    <Link to="/ingestion">📥 Ingestion</Link>
                    <Link to="/entitlements">🔐 Entitlements</Link>
                </nav>
            </header>
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
                    <Route path="/entitlements" element={<Entitlements />} />
                </Routes>
            </main>
        </div>
    );
}
