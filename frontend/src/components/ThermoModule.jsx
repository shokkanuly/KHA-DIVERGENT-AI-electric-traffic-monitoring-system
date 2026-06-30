import React, { useState, useEffect } from 'react';

function ThermoModule({
    selectedBuilding,
    selectedInsulationThickness,
    setSelectedInsulationThickness,
    geminiActive,
    sessionId,
    buildingsRef,
    addLogLine,
    setDbRefreshTrigger
}) {
    const [aiTerminalText, setAiTerminalText] = useState(
        "[Auditor ready] Click \"RUN AI BUILDING AUDIT\" to generate a comprehensive structural insulation assessment."
    );
    const [aiTerminalStatus, setAiTerminalStatus] = useState("READY");
    const [isAiLoading, setIsAiLoading] = useState(false);

    // KPIs
    const [kpiCo2Saved, setKpiCo2Saved] = useState("0.0 Tons");
    const [kpiFinancialSavings, setKpiFinancialSavings] = useState("0 KZT");

    // Chat
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState([
        { role: "assistant", content: "🔥 I'm your AI Thermal Building Consultant. Ask me about insulation materials, heat loss calculations, or energy efficiency for Astana's climate." }
    ]);
    const [chatLoading, setChatLoading] = useState(false);

    // Calculations based on thickness and building
    const b = selectedBuilding;
    const h0 = b ? b.h0 : 0;
    const hNew = b ? Math.round(h0 * (50 / (50 + selectedInsulationThickness))) : 0;
    const reduction = b ? Math.round(((h0 - hNew) / h0) * 100) : 0;

    const cost = 2800 + (140 * selectedInsulationThickness);
    const annualSavings = (h0 - hNew) * 160;
    const years = annualSavings > 0 ? (cost / annualSavings).toFixed(1) : 0;

    // Energy rating calculation
    const getRating = (loss) => {
        if (loss < 55)  return "A";
        if (loss < 90)  return "B";
        if (loss < 130) return "C";
        if (loss < 185) return "D";
        return "E";
    };

    const rate0 = b ? getRating(h0) : "--";
    const rateNew = b ? getRating(hNew) : "--";

    // Keep building currentLoss state in sync with slider
    useEffect(() => {
        if (b) {
            const bldg = buildingsRef.current.find(item => item.id === b.id);
            if (bldg) {
                bldg.currentLoss = hNew;
            }
        }
    }, [selectedBuilding, selectedInsulationThickness, hNew]);

    // Send selection context to Chat Log when building is selected
    useEffect(() => {
        if (b) {
            setChatMessages(prev => [
                ...prev,
                { role: "assistant", content: `📌 Building selected: ${b.name} (${b.id}) — Heat loss: ${b.h0} W/m², Built: ${b.age}, Insulation: ${b.insulation}` }
            ]);
        }
    }, [b]);

    // Run AI building audit
    async function handleThermoAudit() {
        if (!b) return;
        setIsAiLoading(true);
        setAiTerminalText("[CONNECTING TO FASTAPI THERMO AI AGENT MODULE...]");
        setAiTerminalStatus("COMPUTING");

        const payload = {
            building_id: b.id,
            name: b.name,
            age: b.age,
            current_loss_wm2: b.h0,
            insulation_type: b.insulation,
            target_thickness_mm: selectedInsulationThickness,
            calculated_reduction_percent: reduction
        };

        try {
            const res = await fetch("/api/analyze-thermo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            
            setIsAiLoading(false);
            setAiTerminalStatus("ACTIVE");
            setAiTerminalText(data.analysis + "\n\n📋 THERMAL RECOMMENDATIONS:\n" + data.recommendations);
            
            setKpiCo2Saved(`${data.kpi.annualCo2ReductionTons.toFixed(1)} Tons`);
            setKpiFinancialSavings(`${data.kpi.annualCostSavingKzt.toLocaleString()} KZT`);

            setDbRefreshTrigger(prev => prev + 1);
        } catch (e) {
            console.error("Thermo AI Audit API failed:", e);
            setAiTerminalText(`[AI MODULE OFFLINE: ${e.message}. RUNNING LOCAL MODEL...]`);
            
            // Run Local Fallback
            setTimeout(() => {
                const local = runLocalThermoAI(payload);
                setIsAiLoading(false);
                setAiTerminalStatus("ACTIVE");
                setAiTerminalText(local.analysis + "\n\n📋 THERMAL RECOMMENDATIONS:\n" + local.recommendations);
                
                setKpiCo2Saved(`${local.kpi.annualCo2ReductionTons.toFixed(1)} Tons`);
                setKpiFinancialSavings(`${local.kpi.annualCostSavingKzt.toLocaleString()} KZT`);
                
                setDbRefreshTrigger(prev => prev + 1);
            }, 500);
        }
    }

    function runLocalThermoAI(payload) {
        const saved_wm2 = payload.current_loss_wm2 * (payload.calculated_reduction_percent / 100.0);
        const co2_saved = Math.round(saved_wm2 * 0.045 * 10) / 10;
        const savings_kzt = Math.round(saved_wm2 * 2300);

        const analysis = `[Local AI] Теплотехнический аудит здания ${payload.name} (${payload.age} г.). Теплопотери ${payload.current_loss_wm2} Вт/м² указывают на устаревший тепловой контур (${payload.insulation_type}).`;
        const recommendations = `Монтаж фасадного утеплителя толщиной ${payload.target_thickness_mm} мм. Рекомендуются плиты базальтовой ваты высокой плотности (от 110 кг/м³) или негорючие вентилируемые фасады для климата Астаны.`;

        return { analysis, recommendations, kpi: { annualCo2ReductionTons: co2_saved, annualCostSavingKzt: savings_kzt } };
    }

    // Chat
    async function sendChatMessage() {
        const msg = chatInput.trim();
        if (!msg) return;
        setChatInput("");

        const nextMsgs = [...chatMessages, { role: "user", content: msg }];
        setChatMessages(nextMsgs);
        setChatLoading(true);

        const context = {
            selectedBuilding: b,
            ambientTemp: 30.0,
            co2Ppm: 410.0
        };

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: msg,
                    mode: "thermo",
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
            const replyText = getLocalThermoReply(msg);
            setChatMessages([...nextMsgs, { role: "assistant", content: `[Local Fallback] ${replyText}` }]);
        }
        setChatLoading(false);
    }

    function getLocalThermoReply(msg) {
        const m = msg.toLowerCase();
        if (!b) return "Please select a building on the map to get thermal analysis.";
        if (m.includes("insulation") || m.includes("изоляция") || m.includes("утеплитель")) {
            return `For ${b.name} (${b.h0} W/m²): recommend basalt wool 120-150mm boards for Astana's -30°C climate. Current: ${b.insulation}.`;
        }
        if (m.includes("cost") || m.includes("savings") || m.includes("экономия")) {
            const savings = Math.round(b.h0 * 0.4 * 2300);
            return `Estimated savings for ${b.name}: ~${savings.toLocaleString()} KZT/year with 150mm insulation upgrade.`;
        }
        return `${b.name} (${b.id}): Heat loss ${b.h0} W/m², built ${b.age}, current insulation: ${b.insulation}. Add a Gemini API key in .env for detailed analysis.`;
    }

    return (
        <div id="thermoWidgets" className="mode-widget-group">
            <div className="panel-header accent-magenta">
                <h2>THERMAL DEVIATION INSPECTOR</h2>
                <span className="mode-layer-tag" style={{ background: "rgba(0,0,0,0.3)", color: "#fff" }}>LAYER: THERMO</span>
            </div>
            
            <div className="widget-content">
                {!b ? (
                    <div id="bldgNoSelection" className="info-notice">
                        <p>⚡ CLICK A BUILDING POLYGON ON THE MAP TO INSPECT HEAT LOSS CHARACTERISTICS</p>
                    </div>
                ) : (
                    <div id="bldgDetails">
                        <div className="bldg-id-badge" id="bldgId">{b.name.toUpperCase()} (#{b.id})</div>
                        
                        <div className="brutal-stats-grid">
                            <div className="stat-box">
                                <div className="stat-num">{hNew}</div>
                                <div className="stat-lbl">HEAT LOSS (W/m²)</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-num">{rate0}</div>
                                <div className="stat-lbl">ENERGY RATING</div>
                            </div>
                        </div>

                        {/* Insulation simulation slider */}
                        <div className="sub-card mt-10">
                            <div className="sub-card-title">INSULATION SIMULATOR &amp; ROI ESTIMATOR</div>
                            <div className="slider-group">
                                <label htmlFor="insulationThickness">Insulation Thickness: <span>{selectedInsulationThickness} mm</span></label>
                                <input 
                                    type="range" 
                                    id="insulationThickness" 
                                    className="brutal-range" 
                                    min="0" 
                                    max="250" 
                                    step="10" 
                                    value={selectedInsulationThickness}
                                    onChange={(e) => setSelectedInsulationThickness(parseInt(e.target.value))}
                                />
                            </div>
                            <div className="roi-results-grid mt-10">
                                <div className="roi-item">
                                    <div className="roi-lbl">Calculated Heat Loss Reduction</div>
                                    <div className="roi-val text-green">-{reduction}%</div>
                                </div>
                                <div className="roi-item">
                                    <div className="roi-lbl">Estimated Payback Period</div>
                                    <div className="roi-val">{years} Years</div>
                                </div>
                            </div>
                            
                            {rateNew !== rate0 && selectedInsulationThickness > 0 && (
                                <div className="roi-upgrade-alert mt-10 font-mono text-center" id="classUpgradeNotice">
                                    🚀 RATING UPGRADE TO: <span className="badge" style={{ backgroundColor: "var(--neon-green)", color: "#000" }}>{rateNew}</span>
                                </div>
                            )}
                        </div>

                        {/* AI audit panel */}
                        <div className="sub-card mt-10 accent-card-magenta" id="bldgAiAuditCard">
                            <div className="sub-card-header">
                                <div className="sub-card-title text-magenta">🤖 AI THERMAL AUDIT CO-PILOT</div>
                                <span className="badge" style={{ backgroundColor: geminiActive ? "var(--neon-cyan)" : "var(--neon-orange)", color: "#000" }}>
                                    {geminiActive ? "GEMINI LLM" : "LOCAL AI"}
                                </span>
                            </div>
                            <div className="button-row mt-10">
                                <button 
                                    className="brutal-action-btn w-full"
                                    style={{ backgroundColor: "var(--neon-magenta)", color: "#fff" }}
                                    onClick={handleThermoAudit}
                                    disabled={isAiLoading}
                                >
                                    {isAiLoading ? "AUDITING ENVELOPE CONTROLS..." : "⚡ RUN AI BUILDING AUDIT"}
                                </button>
                            </div>
                            <div className="ai-terminal mt-10">
                                <div className="terminal-header">
                                    <span>THERMAL ANALYSIS TERMINAL</span>
                                    <span>{aiTerminalStatus}</span>
                                </div>
                                <div className="terminal-body">
                                    {aiTerminalText}
                                </div>
                            </div>
                            <div className="roi-results-grid mt-10">
                                <div className="roi-item">
                                    <div className="roi-lbl">ANNUAL CO₂ REDUCTION</div>
                                    <div className="roi-val text-green">{kpiCo2Saved}</div>
                                </div>
                                <div className="roi-item">
                                    <div className="roi-lbl">EST. ANNUAL FIN. SAVING</div>
                                    <div className="roi-val" style={{ color: "var(--neon-magenta)" }}>{kpiFinancialSavings}</div>
                                </div>
                            </div>

                            {/* Chat Coordinator */}
                            <div className="ai-chat-section mt-10">
                                <div className="ai-chat-header">
                                    <span className="sub-card-title text-magenta" style={{ border: "none", padding: 0 }}>💬 CHAT WITH AI THERMAL ADVISOR</span>
                                </div>
                                <div className="ai-chat-log" id="thermoChatLog">
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user-msg' : 'ai-msg ai-msg-magenta'}`}>
                                            {msg.content}
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div className="chat-msg loading">⏳ Analyzing building data...</div>
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
                                        style={{ backgroundColor: "var(--neon-magenta)", color: "#fff" }}
                                        onClick={sendChatMessage}
                                        disabled={chatLoading}
                                    >
                                        SEND
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ThermoModule;
