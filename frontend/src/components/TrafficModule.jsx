import React, { useState, useEffect, useRef } from 'react';
import SmartControlCenter from './SmartControlCenter';

function TrafficModule({
    avgSpeed,
    congestionRate,
    co2Ppm,
    facadeHeatLoss,
    ambientTemp,
    mlAnalysis,
    speedHistoryRef,
    appliedAdjustments,
    setAppliedAdjustments,
    roadsRef,
    addLogLine,
    runAiTrigger,
    setDbRefreshTrigger,
    geminiActive,
    sessionId,
    smartControl,
    setSmartControl
}) {
    const chartCanvasRef = useRef(null);
    const [aiTerminalText, setAiTerminalText] = useState(
        "[System ready] Press \"RUN AI OPTIMIZATION AUDIT\" to optimize the Astana City roadway network."
    );
    const [aiTerminalStatus, setAiTerminalStatus] = useState("READY");
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    // KPI metrics
    const [kpiTravelReduction, setKpiTravelReduction] = useState("0%");
    const [kpiCo2Reduction, setKpiCo2Reduction] = useState("0%");

    // Chat states
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState([
        { role: "assistant", content: "👋 I'm your AI Traffic Coordinator. Ask me about congestion, signal optimization, or route planning for Astana's road network." }
    ]);
    const [chatLoading, setChatLoading] = useState(false);

    // Disturbance factor slider
    const [bottleneckSeverity, setBottleneckSeverity] = useState(50);
    const [collisionActive, setCollisionActive] = useState(false);
    const [collisionBtnText, setCollisionBtnText] = useState("TRIGGER SIMULATED ROAD COLLISION");

    // Forecast data
    const [forecastData, setForecastData] = useState([]);

    // Check if configuration run AI changes
    useEffect(() => {
        if (runAiTrigger !== undefined) {
            handleAiAudit();
        }
    }, [runAiTrigger]);

    // Fetch Prophet forecast data periodically
    useEffect(() => {
        function fetchForecast() {
            fetch("/api/forecast")
                .then(res => res.json())
                .then(data => {
                    if (data.status === "success" || data.status === "fallback") {
                        setForecastData(data.speed_forecast || []);
                    }
                })
                .catch(err => console.error("Error fetching forecast:", err));
        }

        // Fetch after 3 seconds on start and then every 7 seconds
        const t1 = setTimeout(fetchForecast, 3000);
        const interval = setInterval(fetchForecast, 7000);
        return () => {
            clearTimeout(t1);
            clearInterval(interval);
        };
    }, []);

    // Draw chart with history and forecast
    useEffect(() => {
        const c = chartCanvasRef.current;
        if (!c) return;
        const chartCtx = c.getContext("2d");
        
        c.width = c.parentElement.clientWidth;
        c.height = c.parentElement.clientHeight;

        chartCtx.clearRect(0, 0, c.width, c.height);
        const pad = 14, w = c.width - pad * 2, h = c.height - pad * 2;

        // Draw grid lines
        chartCtx.strokeStyle = "#1a1a24";
        chartCtx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad + (h / 4) * i;
            chartCtx.beginPath(); chartCtx.moveTo(pad, y); chartCtx.lineTo(pad + w, y); chartCtx.stroke();
        }

        const maxLimit = 80;
        const history = speedHistoryRef.current || [];

        if (history.length < 2) return;

        // We split the width: 60% for history, 40% for future forecast
        const historyWidth = forecastData.length > 0 ? w * 0.6 : w;
        const forecastWidth = w * 0.4;
        const historyEndX = pad + historyWidth;

        // 1. Draw historical speed line
        chartCtx.beginPath();
        history.forEach((s, i) => {
            const cx = pad + (i / (history.length - 1)) * historyWidth;
            const cy = pad + h - (s / maxLimit) * h;
            i === 0 ? chartCtx.moveTo(cx, cy) : chartCtx.lineTo(cx, cy);
        });
        chartCtx.strokeStyle = "var(--neon-yellow)";
        chartCtx.lineWidth = 2;
        chartCtx.stroke();

        // Historical area fill
        chartCtx.beginPath();
        history.forEach((s, i) => {
            const cx = pad + (i / (history.length - 1)) * historyWidth;
            const cy = pad + h - (s / maxLimit) * h;
            i === 0 ? chartCtx.moveTo(cx, cy) : chartCtx.lineTo(cx, cy);
        });
        chartCtx.lineTo(historyEndX, pad + h);
        chartCtx.lineTo(pad, pad + h);
        chartCtx.closePath();
        chartCtx.fillStyle = "rgba(248, 231, 28, 0.05)";
        chartCtx.fill();

        // 2. Draw Prophet forecast dotted line
        if (forecastData.length > 0) {
            chartCtx.beginPath();
            
            // Connect to last history point
            const lastHistoryVal = history[history.length - 1];
            const startY = pad + h - (lastHistoryVal / maxLimit) * h;
            chartCtx.moveTo(historyEndX, startY);

            forecastData.forEach((f, i) => {
                const cx = historyEndX + (i / (forecastData.length - 1)) * forecastWidth;
                const cy = pad + h - (f.yhat / maxLimit) * h;
                chartCtx.lineTo(cx, cy);
            });
            chartCtx.strokeStyle = "var(--neon-cyan)";
            chartCtx.lineWidth = 2;
            chartCtx.setLineDash([3, 3]);
            chartCtx.stroke();
            chartCtx.setLineDash([]);

            // Draw forecasting marker label
            chartCtx.fillStyle = "var(--neon-cyan)";
            chartCtx.font = "bold 7px 'JetBrains Mono'";
            chartCtx.fillText("PROPHET FORECAST", historyEndX + 10, pad + 10);
        }

        // Draw last value dot
        const lastS = history[history.length - 1];
        const lastY = pad + h - (lastS / maxLimit) * h;
        chartCtx.beginPath();
        chartCtx.arc(historyEndX, lastY, 3.5, 0, Math.PI * 2);
        chartCtx.fillStyle = "#ffffff";
        chartCtx.fill();
        chartCtx.strokeStyle = "#000";
        chartCtx.lineWidth = 1;
        chartCtx.stroke();

        // Axis labels
        chartCtx.fillStyle = "#555";
        chartCtx.font = "7px 'JetBrains Mono'";
        chartCtx.fillText(`${maxLimit} KM/H`, 2, pad + 6);
        chartCtx.fillText("0 KM/H", 2, pad + h + 2);
    }, [avgSpeed, forecastData]);

    // Handle traffic disturbance bottlenecks slider
    function handleDisturbanceChange(e) {
        const val = parseInt(e.target.value);
        setBottleneckSeverity(val);
        
        roadsRef.current.forEach(r => {
            if (collisionActive && r.id === "R2") return;
            const drop = (val / 100) * 0.6;
            r.currentSpeed = Math.round(r.baseSpeed * (1 - drop));
        });
    }

    // Trigger Simulated road collision
    function triggerCollision() {
        setCollisionActive(true);
        setCollisionBtnText("⚠️ ROAD COLLISION DETECTED (CLEARING IN 12S)");
        
        const r2 = roadsRef.current.find(r => r.id === "R2");
        if (r2) r2.currentSpeed = 5;

        // Change alert marquee in root
        const marquee = document.querySelector(".alert-marquee");
        if (marquee) {
            marquee.style.background = "var(--neon-magenta)";
            marquee.style.color = "#ffffff";
            const text = marquee.querySelector(".marquee-content");
            if (text) text.textContent = "⚠️ EMERGENCY STATE: COLLISION DETECTED ON KABANBAY BATYR AVENUE ── FASTAPI SPLITTER REDIRECTING TRAFFIC ── ROUTING MAP OVERLAYS ACTIVE ──";
        }

        addLogLine("thermo", `{"router":"FastAPI_Emergency","alert":"COLLISION_ON_R2","severity":"CRITICAL"}`);
        handleAiAudit();

        setTimeout(() => {
            setCollisionActive(false);
            setCollisionBtnText("TRIGGER SIMULATED ROAD COLLISION");
            
            // Reapply disturbance slider values
            const drop = (bottleneckSeverity / 100) * 0.6;
            roadsRef.current.forEach(r => {
                r.currentSpeed = Math.round(r.baseSpeed * (1 - drop));
            });

            // Reset marquee
            const marquee = document.querySelector(".alert-marquee");
            if (marquee) {
                marquee.style.background = "linear-gradient(90deg, var(--neon-cyan), #00bcd4, var(--neon-cyan))";
                marquee.style.color = "#000";
                const text = marquee.querySelector(".marquee-content");
                if (text) text.textContent = "⚡ KHA-DIVERGENT SYSTEM BROADCAST: UNIFIED TELEMETRY DISPATCHING IN PROGRESS ── TIMESCALEDB TIME-SERIES PARTITIONS NORMAL ── REGULAR TRAFFIC FLOW ACTIVE ── MONITORED THERMAL CHANNELS: 147 OUTLETS ──";
            }
        }, 12000);
    }

    // Run AI traffic audit
    async function handleAiAudit() {
        setIsAiLoading(true);
        setAiTerminalText("[CONNECTING TO FASTAPI CORE AI AGENT MODULE...]");
        setAiTerminalStatus("COMPUTING");

        const payload = {
            city: "Astana",
            district_id: "nurzhol_sector_A",
            metrics: {
                traffic_speed_kmh: avgSpeed,
                congestion_index: congestionRate,
                air_quality_co2_ppm: co2Ppm,
                facade_heat_loss_w_m2: facadeHeatLoss,
                ambient_temp_c: ambientTemp
            }
        };

        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            
            setIsAiLoading(false);
            setAiTerminalStatus("ACTIVE");
            setAiTerminalText(data.analysis + "\n\n📋 RECOMMENDATIONS:\n" + data.recommendations);
            
            setAppliedAdjustments(data.adjustments || []);
            setKpiTravelReduction(`-${data.efficiencyMetrics.travelTimeReduction}%`);
            setKpiCo2Reduction(`-${data.efficiencyMetrics.co2Reduction}%`);

            // Apply signal additions speeds onto roads
            if (data.adjustments) {
                data.adjustments.forEach(adj => {
                    const r = roadsRef.current.find(rd => rd.id === adj.roadId);
                    if (r && (adj.action === "GREEN_WAVE" || adj.action === "EMERGENCY_CORRIDOR")) {
                        r.currentSpeed = Math.min(r.baseSpeed, r.currentSpeed + 15);
                    }
                });
            }

            setDbRefreshTrigger(prev => prev + 1);
        } catch (e) {
            console.error("AI Audit API failed:", e);
            setAiTerminalText(`[AI MODULE OFFLINE: ${e.message}. RUNNING LOCAL MODEL...]`);
            
            // Run Local AI fallback
            setTimeout(() => {
                const local = runLocalAI();
                setIsAiLoading(false);
                setAiTerminalStatus("ACTIVE");
                setAiTerminalText(local.analysis + "\n\n📋 RECOMMENDATIONS:\n" + local.recommendations);
                
                setAppliedAdjustments(local.adjustments || []);
                setKpiTravelReduction(`-${local.efficiencyMetrics.travelTimeReduction}%`);
                setKpiCo2Reduction(`-${local.efficiencyMetrics.co2Reduction}%`);
                
                if (local.adjustments) {
                    local.adjustments.forEach(adj => {
                        const r = roadsRef.current.find(rd => rd.id === adj.roadId);
                        if (r && (adj.action === "GREEN_WAVE" || adj.action === "EMERGENCY_CORRIDOR")) {
                            r.currentSpeed = Math.min(r.baseSpeed, r.currentSpeed + 15);
                        }
                    });
                }
                setDbRefreshTrigger(prev => prev + 1);
            }, 500);
        }
    }

    function runLocalAI() {
        let analysis = `[Local AI] Телеметрия дорожной сети зафиксирована. Плотность: номинальная. `;
        let recommendations = "Светофорная регулировка в штатном режиме.";
        let adjustments = [];
        let travelTimeReduction = 5, co2Reduction = 3, avgSpeedIncrease = 4;

        if (collisionActive) {
            analysis += "Критическое ДТП на Kabanbay Batyr Ave (R2). Скорость снижена до 5 км/ч.";
            recommendations = "Развернуть аварийный зеленый коридор на Turan Avenue и активировать зеленый сигнал на Kabanbay.";
            adjustments = [
                { roadId: "R2", action: "EMERGENCY_CORRIDOR", direction: "East-West", duration: 30, reason: "Аварийный коридор ДТП" },
                { roadId: "R1", action: "GREEN_WAVE", direction: "East-West", duration: 20, reason: "Зеленая волна обхода" }
            ];
            travelTimeReduction = 28; co2Reduction = 16; avgSpeedIncrease = 18;
        } else if (co2Ppm > 700) {
            analysis += `Критическое накопление CO₂ (${co2Ppm.toFixed(0)} PPM). Скорость снижена до ${avgSpeed.toFixed(0)} км/ч.`;
            recommendations = "Активировать режим 'Зеленая волна' для разгрузки перекрестка Node-A. Рекомендован обходной маршрут.";
            adjustments = [
                { roadId: "R2", action: "GREEN_WAVE", direction: "East-West", duration: 25, reason: "Разгрузка CO₂ Node-A" },
                { roadId: "R5", action: "BUS_PRIORITY", direction: "North-South", duration: 15, reason: "BRT приоритет обхода" }
            ];
            travelTimeReduction = 24; co2Reduction = 18; avgSpeedIncrease = 20;
        } else {
            analysis += "Потоки распределены равномерно. Пробки отсутствуют.";
            recommendations = "Координация зеленой волны по Turan Avenue в авто-режиме.";
            adjustments = [
                { roadId: "R1", action: "GREEN_WAVE", direction: "East-West", duration: 10, reason: "Авто-координация" }
            ];
            travelTimeReduction = 8; co2Reduction = 5; avgSpeedIncrease = 7;
        }

        return { analysis, recommendations, adjustments, efficiencyMetrics: { travelTimeReduction, co2Reduction, avgSpeedIncrease } };
    }

    // Chat message send handler
    async function sendChatMessage() {
        const msg = chatInput.trim();
        if (!msg) return;
        setChatInput("");

        // Add user message
        const nextMsgs = [...chatMessages, { role: "user", content: msg }];
        setChatMessages(nextMsgs);
        setChatLoading(true);

        const context = {
            avgSpeed: avgSpeed,
            congestionRate: congestionRate,
            co2Ppm: co2Ppm,
            facadeHeatLoss: facadeHeatLoss,
            ambientTemp: ambientTemp,
            appliedAdjustments: appliedAdjustments.map(a => a.action).join(", ") || "none"
        };

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: msg,
                    mode: "traffic",
                    session_id: sessionId,
                    context: context
                })
            });
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            
            setChatMessages([...nextMsgs, { role: "assistant", content: data.reply }]);
            setDbRefreshTrigger(prev => prev + 1);
        } catch (e) {
            console.error("AI Chat API failed:", e);
            // Fallback replies
            const replyText = getLocalTrafficReply(msg);
            setChatMessages([...nextMsgs, { role: "assistant", content: `[Local Fallback] ${replyText}` }]);
        }
        setChatLoading(false);
    }

    function getLocalTrafficReply(msg) {
        const m = msg.toLowerCase();
        if (m.includes("congestion") || m.includes("пробка") || m.includes("traffic")) {
            return `Current congestion: ${congestionRate}%. ${congestionRate > 50 ? "High congestion — consider activating GREEN_WAVE on R1 (Turan Avenue)." : "Traffic is flowing normally."}`;
        }
        if (m.includes("co2") || m.includes("air") || m.includes("emission")) {
            return `CO₂ level: ${co2Ppm.toFixed(0)} PPM. ${co2Ppm > 600 ? "Elevated — recommend signal coordination on R2." : "Within acceptable range (<450 PPM nominal)."}`;
        }
        if (m.includes("speed") || m.includes("скорость")) {
            return `Average speed: ${avgSpeed.toFixed(1)} km/h across 6 monitored corridors (R1-R6 in Nurzhol Sector A).`;
        }
        return `Current system status: Speed ${avgSpeed.toFixed(1)} km/h, Congestion ${congestionRate}%, CO₂ ${co2Ppm.toFixed(0)} PPM. Ask me to run optimization audits to adjust signal timers.`;
    }

    return (
        <div id="trafficWidgets" className="mode-widget-group">
            <div className="panel-header accent-yellow">
                <h2>TRAFFIC FLOW PARAMETERS</h2>
                <span className="mode-layer-tag">LAYER: TRAFFIC</span>
            </div>
            
            <div className="widget-content">
                {/* Dials grid */}
                <div className="brutal-stats-grid">
                    <div className="stat-box">
                        <div className="stat-num">{Math.round(congestionRate)}%</div>
                        <div className="stat-lbl">CONGESTION INDEX</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-num">{avgSpeed.toFixed(1)}</div>
                        <div className="stat-lbl">AVG SPEED (KM/H)</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-num">{Math.round(co2Ppm)}</div>
                        <div className="stat-lbl">AIR QUALITY (CO₂ PPM)</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-num" style={{ color: (facadeHeatLoss - 100) >= 0 ? "var(--neon-magenta)" : "var(--neon-green)" }}>
                            {facadeHeatLoss - 100 >= 0 ? "+" : ""}{((facadeHeatLoss - 100) * 0.05).toFixed(1)}°C
                        </div>
                        <div className="stat-lbl">HEAT DEVIATION</div>
                    </div>
                </div>

                {/* Speed history line chart */}
                <div className="sub-card">
                    <div className="sub-card-title">REAL-TIME VELOCITY FLOW & FORECAST (TimescaleDB + Prophet)</div>
                    <div className="chart-container">
                        <canvas ref={chartCanvasRef} id="speedChartCanvas" />
                    </div>
                </div>

                {/* Anomaly banner */}
                <div className="ml-anomaly-banner" style={{
                    borderColor: mlAnalysis.is_anomaly ? "var(--neon-magenta)" : "#1a1a24",
                    backgroundColor: mlAnalysis.is_anomaly ? "rgba(245, 0, 87, 0.08)" : "rgba(0,0,0,0.5)"
                }}>
                    <div className="banner-title font-mono text-muted">🧠 SCIKIT-LEARN ISOLATION FOREST DETECTOR:</div>
                    <div className="banner-status-row font-mono mt-5">
                        <span className={`anomaly-status ${mlAnalysis.is_anomaly ? 'text-red' : 'text-green'}`}>
                            {mlAnalysis.is_anomaly ? `⚠️ ANOMALY DETECTED (${mlAnalysis.confidence_pct}% CONFIDENCE)` : "NOMINAL (NO ANOMALY)"}
                        </span>
                        <span className="badge" style={{ backgroundColor: "var(--neon-cyan)", color: "#000" }}>
                            SCORE: {mlAnalysis.anomaly_score.toFixed(3)}
                        </span>
                    </div>
                </div>

                <SmartControlCenter
                    avgSpeed={avgSpeed}
                    congestionRate={congestionRate}
                    co2Ppm={co2Ppm}
                    facadeHeatLoss={facadeHeatLoss}
                    ambientTemp={ambientTemp}
                    smartControl={smartControl}
                    setSmartControl={setSmartControl}
                    addLogLine={addLogLine}
                    setDbRefreshTrigger={setDbRefreshTrigger}
                />

                {/* AI logistic control center */}
                <div className="sub-card accent-card">
                    <div className="sub-card-header">
                        <div className="sub-card-title text-yellow">🤖 AI LOGISTIC CONTROL CENTER</div>
                        <span className="badge" style={{
                            backgroundColor: geminiActive ? "var(--neon-cyan)" : "var(--neon-orange)",
                            color: "#000"
                        }}>
                            {geminiActive ? "GEMINI LLM" : "LOCAL AI"}
                        </span>
                    </div>

                    <div className="key-status-msg" style={{
                        marginTop: '6px',
                        color: geminiActive ? "var(--neon-green)" : "var(--text-muted)"
                    }}>
                        {geminiActive ? "✅ Gemini API Key active — LLM engine enabled." : "Running in Local fallback mode (.env key not configured)"}
                    </div>

                    <div className="button-row mt-10">
                        <button 
                            className="brutal-action-btn w-full"
                            onClick={handleAiAudit}
                            disabled={isAiLoading}
                        >
                            {isAiLoading ? "AI LOGISTIC CORE PROCESSING..." : "⚡ RUN AI OPTIMIZATION AUDIT"}
                        </button>
                    </div>

                    {/* AI Terminal console output */}
                    <div className="ai-terminal mt-10">
                        <div className="terminal-header">
                            <span>AI ANALYSIS TERMINAL</span>
                            <span>{aiTerminalStatus}</span>
                        </div>
                        <div className="terminal-body">
                            {aiTerminalText}
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="roi-results-grid mt-10">
                        <div className="roi-item">
                            <div className="roi-lbl">TRAVEL TIME REDUCTION</div>
                            <div className="roi-val text-green">{kpiTravelReduction}</div>
                        </div>
                        <div className="roi-item">
                            <div className="roi-lbl">CO₂ EMISSION REDUCTION</div>
                            <div className="roi-val text-green">{kpiCo2Reduction}</div>
                        </div>
                    </div>

                    {/* Applied Adjustments */}
                    <div className="applied-adjustments mt-10">
                        <div className="adj-title">ACTIVE SIGNAL TIMING ADJUSTMENTS:</div>
                        <ul className="adj-list">
                            {appliedAdjustments.length > 0 ? (
                                appliedAdjustments.map((adj, i) => (
                                    <li 
                                        key={i} 
                                        className={adj.action === "EMERGENCY_CORRIDOR" ? "emergency-adj" : adj.action === "BUS_PRIORITY" ? "bus-adj" : ""}
                                    >
                                        <span>{adj.reason} (<b>{adj.roadId}</b>)</span>
                                        <span className="adj-badge">+{adj.duration}s</span>
                                    </li>
                                ))
                            ) : (
                                <li className="empty-list-msg">No active AI adjustments. Traffic signals on standard cycle.</li>
                            )}
                        </ul>
                    </div>

                    {/* Chat Coordinator */}
                    <div className="ai-chat-section mt-10">
                        <div className="ai-chat-header">
                            <span className="sub-card-title text-yellow" style={{ border: "none", padding: 0 }}>💬 CHAT WITH AI TRAFFIC ADVISOR</span>
                        </div>
                        <div className="ai-chat-log" id="trafficChatLog">
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user-msg' : 'ai-msg'}`}>
                                    {msg.content}
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="chat-msg loading">⏳ Analyzing traffic data...</div>
                            )}
                        </div>
                        <div className="ai-chat-input-row">
                            <input 
                                type="text"
                                className="brutal-input" 
                                placeholder="Ask the AI..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                                disabled={chatLoading}
                            />
                            <button 
                                className="brutal-btn-small chat-send-btn"
                                onClick={sendChatMessage}
                                disabled={chatLoading}
                            >
                                SEND
                            </button>
                        </div>
                    </div>
                </div>

                {/* Disturbances Slider */}
                <div className="sub-card">
                    <div className="sub-card-title">SIMULATOR DISTURBANCE FACTORS</div>
                    <div className="slider-group">
                        <label htmlFor="flowDisturbance">Road Bottleneck Severity: <span>{bottleneckSeverity}%</span></label>
                        <input 
                            type="range"
                            id="flowDisturbance" 
                            className="brutal-range" 
                            min="0" 
                            max="100"
                            value={bottleneckSeverity}
                            onChange={handleDisturbanceChange}
                            disabled={collisionActive}
                        />
                    </div>
                    <div className="button-row mt-10">
                        <button 
                            className="brutal-action-btn w-full"
                            style={{
                                backgroundColor: collisionActive ? "var(--neon-magenta)" : "var(--neon-orange)",
                                color: collisionActive ? "#fff" : "#000"
                            }}
                            onClick={triggerCollision}
                            disabled={collisionActive}
                        >
                            {collisionBtnText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TrafficModule;
