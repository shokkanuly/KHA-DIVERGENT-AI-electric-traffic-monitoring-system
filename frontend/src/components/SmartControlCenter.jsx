import React, { useState } from 'react';

function SmartControlCenter({
    avgSpeed,
    congestionRate,
    co2Ppm,
    facadeHeatLoss,
    ambientTemp,
    smartControl,
    setSmartControl,
    addLogLine,
    setDbRefreshTrigger
}) {
    const [isLoading, setIsLoading] = useState(false);

    async function requestDecision(manualAction = null) {
        setIsLoading(true);
        const endpoint = manualAction ? "/api/control/manual" : "/api/control/decision";
        const payload = {
            district_id: "nurzhol_sector_A",
            mode: manualAction ? "MANUAL" : "AUTO",
            manual_action: manualAction,
            metrics: {
                traffic_speed_kmh: avgSpeed,
                congestion_index: congestionRate,
                air_quality_co2_ppm: co2Ppm,
                facade_heat_loss_w_m2: facadeHeatLoss,
                ambient_temp_c: ambientTemp
            }
        };

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setSmartControl(data);
            addLogLine("traffic", `[SMART_CONTROL] ${data.signal_phase} / ${data.power_state} / ${data.risk_level}`);
            setDbRefreshTrigger(prev => prev + 1);
        } catch (e) {
            addLogLine("traffic", `[SMART_CONTROL_OFFLINE] ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }

    const riskClass = smartControl.risk_level === "CRITICAL" || smartControl.risk_level === "HIGH"
        ? "risk-high"
        : smartControl.risk_level === "MEDIUM"
            ? "risk-medium"
            : "risk-low";

    const light = smartControl.traffic_light || {};

    return (
        <div className="sub-card smart-control-card">
            <div className="sub-card-header">
                <div className="sub-card-title text-yellow">AI ENERGY + SIGNAL CONTROL</div>
                <span className={`control-risk-badge ${riskClass}`}>{smartControl.risk_level}</span>
            </div>

            <div className="control-grid">
                <div className="signal-stack" aria-label="Traffic light state">
                    <span className={`signal-lamp red ${light.red ? "active" : ""}`}></span>
                    <span className={`signal-lamp yellow ${light.yellow ? "active" : ""}`}></span>
                    <span className={`signal-lamp green ${light.green ? "active" : ""}`}></span>
                </div>

                <div className="control-readouts">
                    <div className="control-row">
                        <span>SIGNAL PHASE</span>
                        <strong>{smartControl.signal_phase}</strong>
                    </div>
                    <div className="control-row">
                        <span>POWER RELAY</span>
                        <strong className={smartControl.power_state === "OFF" ? "text-magenta" : "text-green"}>
                            {smartControl.power_state}
                        </strong>
                    </div>
                    <div className="control-row">
                        <span>LOAD ESTIMATE</span>
                        <strong>{Number(smartControl.power_usage_kw || 0).toFixed(2)} kW</strong>
                    </div>
                </div>
            </div>

            <div className="control-reason">{smartControl.reason}</div>

            <ul className="control-actions">
                {(smartControl.recommended_actions || []).map((action, index) => (
                    <li key={`${action}-${index}`}>{action}</li>
                ))}
            </ul>

            <div className="manual-control-grid">
                <button className="brutal-btn-small" disabled={isLoading} onClick={() => requestDecision()}>
                    AUTO
                </button>
                <button className="brutal-btn-small yellow-btn" disabled={isLoading} onClick={() => requestDecision("YELLOW_HOLD")}>
                    YELLOW
                </button>
                <button className="brutal-btn-small" disabled={isLoading} onClick={() => requestDecision("POWER_ON")}>
                    PWR ON
                </button>
                <button className="brutal-btn-small danger-btn" disabled={isLoading} onClick={() => requestDecision("POWER_OFF")}>
                    PWR OFF
                </button>
            </div>
        </div>
    );
}

export default SmartControlCenter;
