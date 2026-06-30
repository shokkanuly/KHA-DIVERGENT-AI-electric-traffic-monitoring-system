import React, { useState, useEffect } from 'react';

function DbMonitor({ sessionId, dbRefreshTrigger }) {
    const [activeTab, setActiveTab] = useState("traffic");
    const [chatMode, setChatMode] = useState("traffic");
    
    // Loaded data states
    const [trafficRecords, setTrafficRecords] = useState([]);
    const [thermoRecords, setThermoRecords] = useState([]);
    const [chatRecords, setChatRecords] = useState([]);
    const [stats, setStats] = useState(null);
    const [dbStats, setDbStats] = useState({ traffic: 0, thermo: 0, chat: 0 });
    const [lastRefresh, setLastRefresh] = useState("--");

    // Fetch counts and stats periodically
    useEffect(() => {
        fetchStats();
    }, [dbRefreshTrigger]);

    // Fetch tab-specific data when tab changes or refresh triggers
    useEffect(() => {
        if (activeTab === "traffic") fetchTraffic();
        if (activeTab === "thermo") fetchThermo();
        if (activeTab === "chat") fetchChat();
        if (activeTab === "analytics") fetchStats();
    }, [activeTab, chatMode, dbRefreshTrigger]);

    async function fetchStats() {
        try {
            const res = await fetch("/api/db/stats");
            if (!res.ok) return;
            const data = await res.json();
            setStats(data);
            setDbStats({
                traffic: data.traffic_logs || 0,
                thermo: data.thermo_logs || 0,
                chat: data.chat_history || 0
            });
            setLastRefresh(new Date().toLocaleTimeString("en-GB", { hour12: false }));
        } catch (e) {
            console.warn("Error fetching db stats:", e);
        }
    }

    async function fetchTraffic() {
        try {
            const res = await fetch("/api/history/traffic?limit=30");
            if (!res.ok) return;
            const data = await res.json();
            setTrafficRecords(data.records || []);
            setLastRefresh(new Date().toLocaleTimeString("en-GB", { hour12: false }));
        } catch (e) {
            console.warn("Error fetching traffic db logs:", e);
        }
    }

    async function fetchThermo() {
        try {
            const res = await fetch("/api/history/thermo?limit=20");
            if (!res.ok) return;
            const data = await res.json();
            setThermoRecords(data.records || []);
            setLastRefresh(new Date().toLocaleTimeString("en-GB", { hour12: false }));
        } catch (e) {
            console.warn("Error fetching thermo db logs:", e);
        }
    }

    async function fetchChat() {
        try {
            const res = await fetch(`/api/history/chat?session_id=${sessionId}&mode=${chatMode}&limit=40`);
            if (!res.ok) return;
            const data = await res.json();
            setChatRecords(data.records || []);
            setLastRefresh(new Date().toLocaleTimeString("en-GB", { hour12: false }));
        } catch (e) {
            console.warn("Error fetching chat db logs:", e);
        }
    }

    return (
        <div className="panel db-panel">
            <div className="panel-header db-header">
                <h2>🗄️ TIMESCALEDB DATABASE MONITOR</h2>
                <div className="db-stats-row" id="dbStatsRow">
                    <span className="db-stat-chip">TRAFFIC: {dbStats.traffic}</span>
                    <span className="db-stat-chip db-chip-magenta">THERMO: {dbStats.thermo}</span>
                    <span className="db-stat-chip db-chip-cyan">CHAT: {dbStats.chat}</span>
                </div>
            </div>

            {/* DB Tabs Bar */}
            <div className="db-tab-bar">
                <button 
                    className={`db-tab ${activeTab === 'traffic' ? 'active' : ''}`}
                    onClick={() => setActiveTab("traffic")}
                >
                    📊 TRAFFIC LOG
                </button>
                <button 
                    className={`db-tab ${activeTab === 'thermo' ? 'active' : ''}`}
                    onClick={() => setActiveTab("thermo")}
                >
                    🔥 THERMO LOG
                </button>
                <button 
                    className={`db-tab ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab("chat")}
                >
                    💬 CHAT HISTORY
                </button>
                <button 
                    className={`db-tab db-tab-analytics ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab("analytics")}
                >
                    📈 ANALYTICS
                </button>
            </div>

            {/* Tab content panes */}
            
            {/* Traffic Logs */}
            {activeTab === "traffic" && (
                <div className="db-tab-content active">
                    <div className="db-table-wrap">
                        <table className="db-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>TIME</th>
                                    <th>SPEED</th>
                                    <th>CONG%</th>
                                    <th>CO₂ PPM</th>
                                    <th>HEAT W/m²</th>
                                    <th>ANOMALY</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trafficRecords.length > 0 ? (
                                    trafficRecords.map((row, i) => (
                                        <tr key={i}>
                                            <td>{row.id}</td>
                                            <td>{row.ts ? row.ts.slice(11, 19) : "--"}</td>
                                            <td>{(row.traffic_speed || 0).toFixed(1)}</td>
                                            <td>{(row.congestion_index || 0).toFixed(0)}%</td>
                                            <td>{(row.co2_ppm || 0).toFixed(0)}</td>
                                            <td>{(row.heat_loss_wm2 || 0).toFixed(0)}</td>
                                            <td className={row.is_anomaly ? "anomaly-yes" : "anomaly-no"}>
                                                {row.is_anomaly ? "⚠️ YES" : "✅ NO"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="7" className="db-empty">No traffic records yet. Twin simulator will populate shortly…</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Thermo Logs */}
            {activeTab === "thermo" && (
                <div className="db-tab-content active">
                    <div className="db-table-wrap">
                        <table className="db-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>TIME</th>
                                    <th>BUILDING</th>
                                    <th>LOSS W/m²</th>
                                    <th>THICK mm</th>
                                    <th>RED%</th>
                                    <th>CO₂ SAVED</th>
                                    <th>SAVINGS KZT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {thermoRecords.length > 0 ? (
                                    thermoRecords.map((row, i) => (
                                        <tr key={i}>
                                            <td>{row.id}</td>
                                            <td>{row.ts ? row.ts.slice(11, 19) : "--"}</td>
                                            <td title={row.building_name}>{row.building_name ? row.building_name.slice(0, 16) : "?"}</td>
                                            <td>{(row.base_heat_loss_wm2 || 0).toFixed(0)}</td>
                                            <td>{row.insulation_thickness_mm || 0}</td>
                                            <td>{row.reduction_percent || 0}%</td>
                                            <td>{(row.annual_co2_tons || 0).toFixed(1)} t</td>
                                            <td>{(row.annual_savings_kzt || 0).toLocaleString()}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="8" className="db-empty">No audits yet — click a building &amp; run AI audit.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Chat History tab */}
            {activeTab === "chat" && (
                <div className="db-tab-content active">
                    <div className="db-chat-filter">
                        <button 
                            className={`db-filter-btn ${chatMode === 'traffic' ? 'active' : ''}`}
                            onClick={() => setChatMode("traffic")}
                        >
                            🚦 TRAFFIC CHAT
                        </button>
                        <button 
                            className={`db-filter-btn ${chatMode === 'thermo' ? 'active' : ''}`}
                            onClick={() => setChatMode("thermo")}
                        >
                            🔥 THERMO CHAT
                        </button>
                    </div>
                    <div className="db-chat-history-log">
                        {chatRecords.length > 0 ? (
                            chatRecords.map((row, i) => {
                                const ts = row.ts ? row.ts.slice(11, 19) : "";
                                const isUser = row.role === "user";
                                const isThermo = chatMode === "thermo";
                                const cls = isUser ? "db-user" : (isThermo ? "db-ai-thermo" : "db-ai");
                                const icon = isUser ? "👤" : (isThermo ? "🔥" : "🚦");
                                return (
                                    <div key={i} className={`db-hist-msg ${cls}`}>
                                        <span className="db-hist-ts">[{ts}] {icon}</span>
                                        {row.content}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="db-empty">No chat history yet for this session. Start chatting with the AI!</div>
                        )}
                    </div>
                </div>
            )}

            {/* Pandas computed Analytics tab */}
            {activeTab === "analytics" && (
                <div className="db-tab-content active">
                    <div className="db-analytics-grid">
                        <div className="analytics-card">
                            <div className="analytics-label">AVG SPEED (last 100)</div>
                            <div className="analytics-val">
                                {stats?.traffic_analytics?.avg_speed_100 != null ? `${stats.traffic_analytics.avg_speed_100} km/h` : "--"}
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="analytics-label">AVG CONGESTION</div>
                            <div className="analytics-val">
                                {stats?.traffic_analytics?.avg_congestion != null ? `${stats.traffic_analytics.avg_congestion}%` : "--"}
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="analytics-label">AVG CO₂ PPM</div>
                            <div className="analytics-val">
                                {stats?.traffic_analytics?.avg_co2 != null ? `${stats.traffic_analytics.avg_co2} ppm` : "--"}
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="analytics-label">MAX CO₂ PEAK</div>
                            <div className="analytics-val analytics-danger">
                                {stats?.traffic_analytics?.max_co2 != null ? `${stats.traffic_analytics.max_co2} ppm` : "--"}
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="analytics-label">MIN SPEED RECORDED</div>
                            <div className="analytics-val analytics-danger">
                                {stats?.traffic_analytics?.min_speed != null ? `${stats.traffic_analytics.min_speed} km/h` : "--"}
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="analytics-label">TOTAL TRAFFIC LOGS</div>
                            <div className="analytics-val">
                                {stats?.traffic_logs != null ? stats.traffic_logs.toLocaleString() : "--"}
                            </div>
                        </div>
                    </div>
                    <div className="db-pandas-badge">
                        Computed with <b>Pandas DataFrame</b> · Stack: Python · TimescaleDB · NumPy
                    </div>
                </div>
            )}

            <div className="panel-footer">
                <span>DB: astana_twin · PostgreSQL WAL</span>
                <span>Last refresh: {lastRefresh}</span>
            </div>
        </div>
    );
}

export default DbMonitor;
