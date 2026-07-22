import React, { useState, useEffect, useRef } from 'react';

function StructuralModule({
    structuralData = {
        accel_x_g: 0.01,
        accel_z_g: 0.99,
        dominant_freq_hz: 12.4,
        displacement_mm: 0.22,
        damage_index: 0.05,
        soil_pressure_kpa: 12.0,
        moisture_pct: 35.0
    },
    mlAnalysis = { is_anomaly: false, anomaly_score: 0.0, confidence_pct: 0 },
    timeToConcern = 48.0,
    sessionId,
    geminiActive
}) {
    const fftCanvasRef = useRef(null);
    const trendCanvasRef = useRef(null);
    
    // History states for charts
    const moistureHistoryRef = useRef([35, 35.2, 34.8, 35.1, 35.4, 35.0, 35.3]);
    const pressureHistoryRef = useRef([12.0, 12.1, 11.9, 12.2, 12.3, 12.1, 12.4]);
    
    // Chat states
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState([
        { role: "assistant", content: "👷 Приветствую! Я ваш AI-консультант по строительной безопасности. Я провожу мониторинг конструкций в соответствии с СП РК 2.03-30-2017 и SP RK EN 1998-5. Задайте мне любой вопрос о состоянии моста или подпорной стены." }
    ]);
    const [chatLoading, setChatLoading] = useState(false);

    // Dynamic database history loader
    const [dbHistory, setDbHistory] = useState([]);

    // Keep history lists updated
    useEffect(() => {
        if (structuralData) {
            moistureHistoryRef.current.push(structuralData.moisture_pct || 35.0);
            if (moistureHistoryRef.current.length > 20) moistureHistoryRef.current.shift();
            
            pressureHistoryRef.current.push(structuralData.soil_pressure_kpa || 12.0);
            if (pressureHistoryRef.current.length > 20) pressureHistoryRef.current.shift();
        }
    }, [structuralData]);

    // Load recent structural database records
    useEffect(() => {
        function fetchDbLogs() {
            fetch("/api/history/structural?limit=8")
                .then(res => res.json())
                .then(data => setDbHistory(data.records || []))
                .catch(err => console.error("Error loading structural history:", err));
        }
        fetchDbLogs();
        const interval = setInterval(fetchDbLogs, 4000);
        return () => clearInterval(interval);
    }, []);

    // Draw simulated FFT Spectrum
    useEffect(() => {
        const c = fftCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        c.width = c.parentElement.clientWidth;
        c.height = 140;

        ctx.clearRect(0, 0, c.width, c.height);
        const w = c.width, h = c.height;

        // Draw background grid
        ctx.strokeStyle = "#141923";
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 25) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Draw frequency spectrum curve
        ctx.strokeStyle = mlAnalysis.is_anomaly ? "var(--neon-magenta)" : "var(--neon-cyan)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h - 10);

        const freq = structuralData.dominant_freq_hz || 12.4;
        const peakX = (freq / 30) * w; // Assume max frequency on scale is 30Hz

        for (let x = 0; x < w; x++) {
            // Base noise floor
            let noise = Math.sin(x * 0.15) * 2 + Math.cos(x * 0.5) * 1.5;
            
            // Peak at dominant frequency
            const distToPeak = Math.abs(x - peakX);
            let peakFactor = 0;
            if (distToPeak < 40) {
                peakFactor = Math.cos((distToPeak / 40) * Math.PI / 2) * (h - 40);
                if (mlAnalysis.is_anomaly) peakFactor += Math.sin(x * 0.8) * 10; // anomalous jitter
            }
            
            const y = h - 10 - noise - peakFactor;
            ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw peak indicator text
        ctx.fillStyle = "var(--text-primary)";
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText(`Dominant: ${freq.toFixed(1)} Hz`, peakX - 45, 25);
        ctx.fillStyle = mlAnalysis.is_anomaly ? "var(--neon-magenta)" : "var(--neon-cyan)";
        ctx.beginPath();
        ctx.arc(peakX, h - 10 - (h - 40), 4, 0, 2*Math.PI);
        ctx.fill();
    }, [structuralData, mlAnalysis]);

    // Draw Pressure & Moisture trends
    useEffect(() => {
        const c = trendCanvasRef.current;
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

        const moisture = moistureHistoryRef.current;
        const pressure = pressureHistoryRef.current;
        const limit = 20;

        // Draw Moisture line (Green)
        if (moisture.length > 1) {
            ctx.strokeStyle = "var(--neon-green)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            moisture.forEach((val, idx) => {
                const x = (idx / (limit - 1)) * w;
                // Moisture scaled 0-100%
                const y = h - 15 - (val / 100) * (h - 30);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        // Draw Soil Pressure line (Yellow)
        if (pressure.length > 1) {
            ctx.strokeStyle = "var(--neon-yellow)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            pressure.forEach((val, idx) => {
                const x = (idx / (limit - 1)) * w;
                // Pressure scaled 0-100 kPa
                const y = h - 15 - (val / 100) * (h - 30);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
    }, [structuralData]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setChatLoading(true);

        const context = {
            accel_x_g: structuralData.accel_x_g,
            accel_z_g: structuralData.accel_z_g,
            dominant_freq_hz: structuralData.dominant_freq_hz,
            displacement_mm: structuralData.displacement_mm,
            damage_index: structuralData.damage_index,
            soil_pressure_kpa: structuralData.soil_pressure_kpa,
            moisture_pct: structuralData.moisture_pct,
            isAnomaly: mlAnalysis.is_anomaly,
            timeToConcern: timeToConcern
        };

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsg,
                    mode: "structural",
                    session_id: sessionId,
                    context: context
                })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        } catch (err) {
            console.error("Chat error:", err);
            setChatMessages(prev => [...prev, { role: "assistant", content: "Error communicating with structural advisor." }]);
        } finally {
            setChatLoading(false);
        }
    };

    const di = structuralData.damage_index || 0.05;
    const isCritical = di > 0.4;
    const isMoistureHigh = (structuralData.moisture_pct || 0) > 75;

    return (
        <div className="module-container">
            <h2 className="module-title">🏗️ STRUCTURAL HEALTH MONITORING (СП РК 2.03-30-2017)</h2>
            
            {/* ── Top stats indicators ── */}
            <div className="metrics-grid">
                <div className="metric-box status-card" style={{ borderLeft: isCritical ? "4px solid var(--neon-magenta)" : "4px solid var(--neon-green)" }}>
                    <div className="metric-label">STATUS INTEGRITY / ЦЕЛОСТНОСТЬ</div>
                    <div className="metric-value" style={{ color: isCritical ? "var(--neon-magenta)" : "var(--neon-green)" }}>
                        {isCritical ? "CRITICAL ALERT / АВАРИЯ" : "STABLE / НОРМА"}
                    </div>
                    <div className="metric-sub">Damage index: {di.toFixed(2)} / Limit: 0.40</div>
                </div>

                <div className="metric-box status-card">
                    <div className="metric-label">SEISMIC DRIFT / СМЕЩЕНИЕ</div>
                    <div className="metric-value" style={{ color: structuralData.displacement_mm > 0.8 ? "var(--neon-orange)" : "var(--text-primary)" }}>
                        {structuralData.displacement_mm?.toFixed(2)} mm
                    </div>
                    <div className="metric-sub">Limit SP RK: &lt;1.0mm (Seismic Zone)</div>
                </div>

                <div className="metric-box status-card" style={{ borderLeft: timeToConcern < 12 ? "4px solid var(--neon-magenta)" : "4px solid var(--neon-cyan)" }}>
                    <div className="metric-label">TIME TO CONCERN / СРОК РЕАКЦИИ</div>
                    <div className="metric-value" style={{ color: timeToConcern < 12 ? "var(--neon-magenta)" : "var(--neon-cyan)" }}>
                        {timeToConcern} hrs
                    </div>
                    <div className="metric-sub">Wall pressure trend analysis</div>
                </div>
            </div>

            {/* ── FFT Plot Panel ── */}
            <div className="panel chart-panel" style={{ marginTop: "12px" }}>
                <h3 className="widget-title">📡 ACCELEROMETER COHERENCE & FFT SPECTRUM</h3>
                <div style={{ position: "relative", height: "140px" }}>
                    <canvas ref={fftCanvasRef}></canvas>
                </div>
                <div className="chart-legend">
                    <span>Ax: <b>{structuralData.accel_x_g?.toFixed(3)}g</b></span>
                    <span>Az: <b>{structuralData.accel_z_g?.toFixed(3)}g</b></span>
                    <span>Peak Frequency: <b>{structuralData.dominant_freq_hz?.toFixed(1)} Hz</b></span>
                </div>
            </div>

            {/* ── Retaining Wall moisture/pressure ── */}
            <div className="panel chart-panel" style={{ marginTop: "12px" }}>
                <h3 className="widget-title">💧 SOIL GEOTECHNICAL MONITORING (SP RK EN 1998-5)</h3>
                <div style={{ position: "relative", height: "140px" }}>
                    <canvas ref={trendCanvasRef}></canvas>
                </div>
                <div className="chart-legend">
                    <span style={{ color: "var(--neon-green)" }}>■ Moisture: <b>{structuralData.moisture_pct?.toFixed(1)}%</b></span>
                    <span style={{ color: "var(--neon-yellow)" }}>■ Pressure: <b>{structuralData.soil_pressure_kpa?.toFixed(1)} kPa</b></span>
                </div>
            </div>

            {/* ── Live SQLite logs monitor ── */}
            <div className="panel stats-panel" style={{ marginTop: "12px" }}>
                <h3 className="widget-title">📁 LIVE SQLITE TRANSACTION LOGGER (structural_logs)</h3>
                <table className="db-table" style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                            <th>ID</th>
                            <th>TIMESTAMP</th>
                            <th>FREQ</th>
                            <th>DISP (mm)</th>
                            <th>DMG IDX</th>
                            <th>MOIST (%)</th>
                            <th>ANOMALY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dbHistory.map(row => (
                            <tr key={row.id} style={{ borderBottom: "1px solid #141923" }}>
                                <td>#{row.id}</td>
                                <td>{row.ts?.split("T")[1]?.slice(0, 8)}</td>
                                <td style={{ color: "var(--text-primary)" }}>{row.dominant_freq_hz?.toFixed(1)} Hz</td>
                                <td>{row.displacement_mm?.toFixed(2)}</td>
                                <td>{row.damage_index?.toFixed(2)}</td>
                                <td>{row.moisture_pct?.toFixed(1)}%</td>
                                <td style={{ color: row.is_anomaly ? "var(--neon-magenta)" : "var(--text-muted)" }}>
                                    {row.is_anomaly ? "YES" : "NO"}
                                </td>
                            </tr>
                        ))}
                        {dbHistory.length === 0 && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: "center", padding: "10px" }}>Wait for simulator telemetry packets...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── AI Structural Advisor Chat ── */}
            <div className="panel ai-advisor-panel" style={{ marginTop: "12px" }}>
                <h3 className="widget-title" style={{ color: "var(--neon-cyan)" }}>🤖 GEMINI 2.5 STRUCTURAL SAFETY ADVISOR</h3>
                
                <div className="chat-window" style={{ height: "180px", overflowY: "auto", border: "1px solid var(--border-color)", backgroundColor: "#090c12", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {chatMessages.map((m, idx) => (
                        <div key={idx} className={`chat-bubble ${m.role}`} style={{
                            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                            backgroundColor: m.role === "user" ? "#1b2436" : "#0d1117",
                            color: m.role === "user" ? "var(--neon-cyan)" : "var(--text-primary)",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            maxWidth: "85%",
                            fontSize: "12px",
                            border: `1px solid ${m.role === 'user' ? '#2c3b57' : 'var(--border-color)'}`
                        }}>
                            {m.content}
                        </div>
                    ))}
                    {chatLoading && (
                        <div className="chat-bubble assistant typing-bubble" style={{ alignSelf: "flex-start", backgroundColor: "#0d1117", color: "var(--text-muted)", padding: "8px 12px", borderRadius: "6px", fontSize: "11px", border: "1px solid var(--border-color)" }}>
                            Consulting seismic databases (СП РК)...
                        </div>
                    )}
                </div>
                
                <form onSubmit={handleSendMessage} className="chat-form" style={{ display: "flex", marginTop: "8px", gap: "6px" }}>
                    <input 
                        type="text" 
                        placeholder="Задать вопрос по устойчивости грунта или сейсмостойкости..." 
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
                            backgroundColor: "var(--neon-cyan)",
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

export default StructuralModule;
