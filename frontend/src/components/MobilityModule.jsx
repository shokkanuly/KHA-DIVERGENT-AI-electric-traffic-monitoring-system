import React, { useState, useEffect, useRef } from 'react';

function MobilityModule({
    sessionId,
    geminiActive
}) {
    const forecastCanvasRef = useRef(null);

    const [comparisonData, setComparisonData] = useState({
        scenario_a: { avg_speed: 22.0, avg_congestion: 65.0, avg_co2: 120.0, avg_riders: 1500 },
        scenario_b: { avg_speed: 45.0, avg_congestion: 15.0, avg_co2: 15.0, avg_riders: 2800 },
        routing: {
            bus: { total_time_min: 24.0, stages: {} },
            lrt: { total_time_min: 12.0, stages: {} },
            delta_percent: 50.0
        },
        forecast_a: [],
        forecast_b: [],
        status: "loading"
    });

    // Chat states
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState([
        { role: "assistant", content: "🚌/🚊 Рад приветствовать! Я ваш AI-транспортный экономист. Я анализирую эффективность коридора Караганда-Темиртау и целесообразность ввода LRT. Задайте вопрос о времени в пути, окупаемости проекта или сокращении выбросов CO₂." }
    ]);
    const [chatLoading, setChatLoading] = useState(false);

    // Fetch comparison stats and Prophet forecasts periodically
    useEffect(() => {
        function fetchData() {
            fetch("/api/scenario/compare")
                .then(res => res.json())
                .then(data => {
                    setComparisonData(data);
                })
                .catch(err => console.error("Error fetching scenario comparisons:", err));
        }
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    // Draw dual Prophet forecasts
    useEffect(() => {
        const c = forecastCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        c.width = c.parentElement.clientWidth;
        c.height = 140;

        ctx.clearRect(0, 0, c.width, c.height);
        const w = c.width, h = c.height;

        // Draw grid
        ctx.strokeStyle = "#141923";
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 25) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        const f_a = comparisonData.forecast_a || [];
        const f_b = comparisonData.forecast_b || [];

        // Draw Scenario A (Bus) forecast line (Magenta/Orange)
        if (f_a.length > 1) {
            ctx.strokeStyle = "var(--neon-magenta)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            f_a.forEach((pt, idx) => {
                const x = (idx / (f_a.length - 1)) * w;
                // Speed scale 0-80 km/h
                const y = h - 15 - (pt.yhat / 80) * (h - 30);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        // Draw Scenario B (LRT) forecast line (Green/Cyan)
        if (f_b.length > 1) {
            ctx.strokeStyle = "var(--neon-green)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            f_b.forEach((pt, idx) => {
                const x = (idx / (f_b.length - 1)) * w;
                // Speed scale 0-80 km/h
                const y = h - 15 - (pt.yhat / 80) * (h - 30);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
    }, [comparisonData]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setChatLoading(true);

        const context = {
            bus_speed: comparisonData.scenario_a.avg_speed,
            bus_congestion: comparisonData.scenario_a.avg_congestion,
            bus_co2: comparisonData.scenario_a.avg_co2,
            bus_riders: comparisonData.scenario_a.avg_riders,
            bus_travel_time: comparisonData.routing.bus.total_time_min,
            lrt_speed: comparisonData.scenario_b.avg_speed,
            lrt_congestion: comparisonData.scenario_b.avg_congestion,
            lrt_co2: comparisonData.scenario_b.avg_co2,
            lrt_riders: comparisonData.scenario_b.avg_riders,
            lrt_travel_time: comparisonData.routing.lrt.total_time_min
        };

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsg,
                    mode: "mobility",
                    session_id: sessionId,
                    context: context
                })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        } catch (err) {
            console.error("Chat error:", err);
            setChatMessages(prev => [...prev, { role: "assistant", content: "Error communicating with transit economist." }]);
        } finally {
            setChatLoading(false);
        }
    };

    const sa = comparisonData.scenario_a;
    const sb = comparisonData.scenario_b;
    const rt = comparisonData.routing;

    const co2SavingPct = ((sa.avg_co2 - sb.avg_co2) / sa.avg_co2 * 100).toFixed(1);
    const speedIncreasePct = ((sb.avg_speed - sa.avg_speed) / sa.avg_speed * 100).toFixed(1);

    return (
        <div className="module-container">
            <h2 className="module-title">🚊 TRANSIT MOBILITY SIMULATION (BUS CORRIDOR vs LRT DETAILED COMPARISON)</h2>
            
            {/* Split Screen Scenario Dashboard */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                
                {/* Scenario A: Bus Corridor */}
                <div className="panel" style={{ borderLeft: "4px solid var(--neon-magenta)" }}>
                    <h3 className="widget-title" style={{ color: "var(--neon-magenta)" }}>🚌 SCENARIO A: STATUS QUO BUS CORRIDOR</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", marginTop: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Average Speed:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-magenta)" }}>{sa.avg_speed} km/h</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Peak Congestion:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)" }}>{sa.avg_congestion}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>CO₂ Emissions:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)" }}>{sa.avg_co2} g/passenger-km</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Daily Passengers:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)" }}>{sa.avg_riders.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Scenario B: Proposed LRT */}
                <div className="panel" style={{ borderLeft: "4px solid var(--neon-green)" }}>
                    <h3 className="widget-title" style={{ color: "var(--neon-green)" }}>🚊 SCENARIO B: TARLAN ASTANA LRT PROPOSAL</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", marginTop: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Average Speed:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-green)" }}>{sb.avg_speed} km/h</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Peak Congestion:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)" }}>{sb.avg_congestion}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>CO₂ Emissions:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)" }}>{sb.avg_co2} g/passenger-km</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Daily Passengers:</span>
                            <span className="value-label" style={{ fontFamily: "var(--font-mono)" }}>{sb.avg_riders.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* NetworkX Route travel times */}
            <div className="panel" style={{ marginTop: "12px" }}>
                <h3 className="widget-title">📍 Sequential Station Travel Times (NetworkX Routing Analysis)</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
                    <div style={{ border: "1px solid var(--border-color)", padding: "10px", backgroundColor: "#090c12" }}>
                        <div className="metric-label" style={{ color: "var(--neon-magenta)", fontSize: "11px" }}>BUS TOTAL TRAVEL TIME</div>
                        <div style={{ fontSize: "20px", fontWeight: "bold", fontFamily: "var(--font-mono)", margin: "4px 0" }}>
                            {rt.bus.total_time_min} minutes
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                            Vokzal ➔ City Mall: {rt.bus.stages["Vokzal->City Mall"] || "?"}m<br/>
                            City Mall ➔ Meduniversitet: {rt.bus.stages["City Mall->Meduniversitet"] || "?"}m<br/>
                            Meduniversitet ➔ KarGTU: {rt.bus.stages["Meduniversitet->KarGTU"] || "?"}m
                        </div>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", padding: "10px", backgroundColor: "#090c12" }}>
                        <div className="metric-label" style={{ color: "var(--neon-green)", fontSize: "11px" }}>LRT TOTAL TRAVEL TIME</div>
                        <div style={{ fontSize: "20px", fontWeight: "bold", fontFamily: "var(--font-mono)", margin: "4px 0" }}>
                            {rt.lrt.total_time_min} minutes
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                            Vokzal ➔ City Mall: {rt.lrt.stages["Vokzal->City Mall"] || "?"}m<br/>
                            City Mall ➔ Meduniversitet: {rt.lrt.stages["City Mall->Meduniversitet"] || "?"}m<br/>
                            Meduniversitet ➔ KarGTU: {rt.lrt.stages["Meduniversitet->KarGTU"] || "?"}m
                        </div>
                    </div>
                </div>

                {/* Efficiency Deltas */}
                <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                    <div className="metric-box status-card" style={{ borderLeft: "4px solid var(--neon-cyan)" }}>
                        <div className="metric-label">COMMUTE TIME REDUCTION / ЭКОНОМИЯ ВРЕМЕНИ</div>
                        <div className="metric-value" style={{ color: "var(--neon-cyan)" }}>
                            -{rt.delta_percent}%
                        </div>
                        <div className="metric-sub">NetworkX Shortest Path weight delta</div>
                    </div>

                    <div className="metric-box status-card" style={{ borderLeft: "4px solid var(--neon-green)" }}>
                        <div className="metric-label">CARBON FOOTPRINT CUT / СОКРАЩЕНИЕ ВЫБРОСОВ</div>
                        <div className="metric-value" style={{ color: "var(--neon-green)" }}>
                            -{co2SavingPct}%
                        </div>
                        <div className="metric-sub">LRT zero local emission offset</div>
                    </div>
                </div>
            </div>

            {/* Prophet forecasts for speeds */}
            <div className="panel chart-panel" style={{ marginTop: "12px" }}>
                <h3 className="widget-title">📈 30-SECOND TRAFFIC SPEED FORECAST (PROPHET ML MODELS)</h3>
                <div style={{ position: "relative", height: "140px" }}>
                    <canvas ref={forecastCanvasRef}></canvas>
                </div>
                <div className="chart-legend">
                    <span style={{ color: "var(--neon-magenta)" }}>■ Scenario A (Bus) Trend</span>
                    <span style={{ color: "var(--neon-green)" }}>■ Scenario B (LRT) Trend</span>
                </div>
            </div>

            {/* AI Advisor Chat */}
            <div className="panel ai-advisor-panel" style={{ marginTop: "12px" }}>
                <h3 className="widget-title" style={{ color: "var(--neon-yellow)" }}>🤖 GEMINI 2.5 TRANSIT ECONOMIST</h3>
                
                <div className="chat-window" style={{ height: "180px", overflowY: "auto", border: "1px solid var(--border-color)", backgroundColor: "#090c12", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {chatMessages.map((m, idx) => (
                        <div key={idx} className={`chat-bubble ${m.role}`} style={{
                            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                            backgroundColor: m.role === "user" ? "#1d2012" : "#0d1117",
                            color: m.role === "user" ? "var(--neon-yellow)" : "var(--text-primary)",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            maxWidth: "85%",
                            fontSize: "12px",
                            border: `1px solid ${m.role === 'user' ? '#3d4024' : 'var(--border-color)'}`
                        }}>
                            {m.content}
                        </div>
                    ))}
                    {chatLoading && (
                        <div className="chat-bubble assistant typing-bubble" style={{ alignSelf: "flex-start", backgroundColor: "#0d1117", color: "var(--text-muted)", padding: "8px 12px", borderRadius: "6px", fontSize: "11px", border: "1px solid var(--border-color)" }}>
                            Running cost-benefit calculations (Tarlan LRT)...
                        </div>
                    )}
                </div>
                
                <form onSubmit={handleSendMessage} className="chat-form" style={{ display: "flex", marginTop: "8px", gap: "6px" }}>
                    <input 
                        type="text" 
                        placeholder="Спросить про окупаемость LRT, пассажиропоток или сокращение углекислого газа..." 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        disabled={chatLoading}
                        style={{
                            flexGrow: 1,
                            backgroundColor: "#0d1117",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                            padding: "8px 12px",
                            fontFamily: "var(--font-heading)",
                            fontSize: "12px",
                            outline: "none"
                        }}
                    />
                    <button 
                        type="submit"
                        disabled={chatLoading}
                        style={{
                            backgroundColor: "var(--neon-yellow)",
                            color: "#000",
                            border: "none",
                            fontWeight: "bold",
                            padding: "0 18px",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)"
                        }}
                    >
                        SEND
                    </button>
                </form>
            </div>

        </div>
    );
}

export default MobilityModule;
