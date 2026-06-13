import { useState, useEffect } from "react";
import {
    devLogin, getMe,
    grantEntitlement, listEntitlements, revokeEntitlement,
    listSeries,
    type EntitlementItem, type SeriesItem,
} from "../api";

const devLoginEnabled = import.meta.env.DEV || import.meta.env.VITE_CMS_ENABLE_DEV_LOGIN === "true";

export default function Entitlements() {
    const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
    const [works, setWorks] = useState<SeriesItem[]>([]);
    const [ents, setEnts] = useState<EntitlementItem[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    // Grant form
    const [userId, setUserId] = useState("dev-user-1");
    const [targetId, setTargetId] = useState("");
    const [targetType, setTargetType] = useState("EPISODE");
    const [source, setSource] = useState("ADMIN_GRANT");

    useEffect(() => {
        getMe().then(setUser);
        listSeries().then(setWorks);
    }, []);

    const doLogin = async () => {
        setBusy(true);
        try {
            const res = await devLogin("dev-admin", "Admin", "admin");
            setUser(res.user);
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    const loadEnts = async () => {
        if (!userId) return;
        const items = await listEntitlements(userId);
        setEnts(items);
    };

    const doGrant = async () => {
        if (!userId || !targetId) { setError("userId and targetId required"); return; }
        setBusy(true);
        setError("");
        try {
            await grantEntitlement({ userId, targetType, targetId, source });
            await loadEnts();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    const doRevoke = async (entId: string) => {
        try {
            await revokeEntitlement(entId);
            await loadEnts();
        } catch (e) { setError((e as Error).message); }
    };

    return (
        <div>
            <h1>🔐 Entitlements</h1>

            {/* Auth status */}
            <div className="card">
                <h2>Auth</h2>
                {user ? (
                    <p>Logged in as <strong>{user.name}</strong> ({user.id}) — {user.role}</p>
                ) : (
                    <div>
                        <p style={{ color: "var(--muted)", marginBottom: "0.5rem" }}>Not logged in</p>
                        {devLoginEnabled ? (
                            <button onClick={doLogin} className="btn btn-primary" disabled={busy}>Dev Login (Admin)</button>
                        ) : (
                            <p className="card-meta">Use the header login form to request a magic link.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Grant form */}
            <div className="card">
                <h2>Grant Entitlement</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>User ID</label>
                        <input value={userId} onChange={(e) => setUserId(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>Target ID</label>
                        <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="rain-world/ep02" />
                        <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                            Format: seriesId/episodeId or seriesId (for SERIES)
                        </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>Target Type</label>
                        <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                            <option value="EPISODE">EPISODE</option>
                            <option value="SERIES">SERIES</option>
                            <option value="VOLUME">VOLUME</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>Source</label>
                        <select value={source} onChange={(e) => setSource(e.target.value)}>
                            <option value="ADMIN_GRANT">ADMIN_GRANT</option>
                            <option value="PROMO">PROMO</option>
                            <option value="PURCHASE">PURCHASE</option>
                        </select>
                    </div>
                </div>
                {error && <div className="error-msg">{error}</div>}
                <div className="section-actions">
                    <button onClick={doGrant} className="btn btn-primary" disabled={busy}>Grant</button>
                    <button onClick={loadEnts} className="btn btn-outline">Refresh List</button>
                </div>
            </div>

            {/* Quick grant helpers */}
            {works.length > 0 && (
                <div className="card">
                    <h2>Quick Grant</h2>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {works.map((w) => (
                            <button key={w.id} className="btn btn-outline" style={{ fontSize: "0.75rem" }}
                                onClick={() => { setTargetId(w.id); setTargetType("SERIES"); }}>
                                📚 {w.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Entitlements list */}
            <div className="card">
                <h2>Entitlements for {userId}</h2>
                {ents.length === 0 ? (
                    <p style={{ color: "var(--muted)" }}>No entitlements (click Refresh)</p>
                ) : (
                    <div className="episode-list">
                        {ents.map((e) => (
                            <div key={e.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <span className={`badge ${e.status === "ACTIVE" ? "badge-ok" : "badge-muted"}`}>{e.status}</span>
                                    {" "}<strong>{e.targetId}</strong>
                                    <span className="card-meta"> — {e.targetType} via {e.source}</span>
                                </div>
                                {e.status === "ACTIVE" && (
                                    <button onClick={() => doRevoke(e.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}>
                                        Revoke
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
