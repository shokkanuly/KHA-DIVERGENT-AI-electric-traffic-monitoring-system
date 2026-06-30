import React from 'react';

function IotMonitor({ iotNode, smartControl }) {
    const isConnected = iotNode.ipAddr !== "NOT CONNECTED";
    return (
        <div className="panel iot-panel">
            <div className="panel-header">
                <h2>PHYSICAL ESP32 IoT NODE MONITOR</h2>
                <span className="badge" style={{
                    backgroundColor: isConnected ? "var(--neon-green)" : "var(--neon-orange)",
                    color: "#000"
                }}>
                    {iotNode.status}
                </span>
            </div>
            <div className="iot-body font-mono">
                <div className="iot-stat-row">
                    <span>NODE IP ADDRESS:</span>
                    <span id="iotNodeAddr" className="text-yellow">{iotNode.ipAddr}</span>
                </div>
                <div className="iot-registers-grid">
                    <div className="reg-box">
                        <div className="reg-title">GPIO14 (ULTRASONIC ECHO)</div>
                        <div className="reg-val" id="regGpio14">
                            {iotNode.distanceCm != null ? `${iotNode.distanceCm.toFixed(1)} cm` : "-- cm"}
                        </div>
                    </div>
                    <div className="reg-box">
                        <div className="reg-title">ADC1 (THERMAL THERMISTOR)</div>
                        <div className="reg-val" id="regAdc1">
                            {iotNode.tempC != null ? `${iotNode.tempC.toFixed(1)} °C` : "-- °C"}
                        </div>
                    </div>
                    <div className="reg-box">
                        <div className="reg-title">VIRTUAL CT SENSOR (POWER)</div>
                        <div className="reg-val">
                            {iotNode.powerKw != null ? `${iotNode.powerKw.toFixed(2)} kW` : `${Number(smartControl?.power_usage_kw || 0).toFixed(2)} kW`}
                        </div>
                    </div>
                    <div className="reg-box">
                        <div className="reg-title">RELAY COMMAND</div>
                        <div className="reg-val" style={{
                            color: smartControl?.power_state === "OFF" ? "var(--neon-magenta)" : "var(--neon-green)"
                        }}>
                            {smartControl?.relay_command || "RELAY_ON"}
                        </div>
                    </div>
                </div>
            </div>
            <div className="panel-footer">
                <span>NODE ID: <span id="iotNodeId">{iotNode.nodeId}</span></span>
                <span>WS: /ws</span>
            </div>
        </div>
    );
}

export default IotMonitor;
