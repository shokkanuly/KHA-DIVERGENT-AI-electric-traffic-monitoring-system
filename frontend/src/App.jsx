import React, { useState, useEffect, useRef } from 'react';
import CityMap from './components/CityMap';
import TrafficModule from './components/TrafficModule';
import ThermoModule from './components/ThermoModule';
import ConsoleLog from './components/ConsoleLog';
import IotMonitor from './components/IotMonitor';
import DbMonitor from './components/DbMonitor';

const BASE_ROADS = [
    { id: "R1", name: "Turan Avenue",         x1: 50, y1: 100, x2: 600, y2: 100, baseSpeed: 65, currentSpeed: 65, flowType: "h" },
    { id: "R2", name: "Kabanbay Batyr Ave",    x1: 50, y1: 250, x2: 600, y2: 250, baseSpeed: 55, currentSpeed: 55, flowType: "h" },
    { id: "R3", name: "Mangilik El Ave",       x1: 50, y1: 400, x2: 600, y2: 400, baseSpeed: 60, currentSpeed: 60, flowType: "h" },
    { id: "R4", name: "Kunayev Street",        x1: 150, y1: 30, x2: 150, y2: 450, baseSpeed: 45, currentSpeed: 45, flowType: "v" },
    { id: "R5", name: "Dostyk Street",         x1: 350, y1: 30, x2: 350, y2: 450, baseSpeed: 50, currentSpeed: 50, flowType: "v" },
    { id: "R6", name: "Syganak Street",        x1: 520, y1: 30, x2: 520, y2: 450, baseSpeed: 40, currentSpeed: 40, flowType: "v" }
];

const BASE_BUILDINGS = [
    { id: "B1",  name: "Keruen City Mall",              x: 60,  y: 40,  w: 75,  h: 45,  age: 2007, insulation: "None",                  h0: 215, currentLoss: 215 },
    { id: "B2",  name: "Residential Complex Olympus",   x: 170, y: 40,  w: 160, h: 45,  age: 2012, insulation: "Mineral Wool 50mm",      h0: 125, currentLoss: 125 },
    { id: "B3",  name: "Astana Opera",                  x: 370, y: 40,  w: 130, h: 45,  age: 2013, insulation: "Mineral Wool 100mm",     h0: 85,  currentLoss: 85  },
    { id: "B4",  name: "Abu Dhabi Plaza",               x: 540, y: 40,  w: 50,  h: 180, age: 2021, insulation: "Multi-layered Foam",     h0: 45,  currentLoss: 45  },
    { id: "B5",  name: "Akmola State Hospital",         x: 60,  y: 120, w: 75,  h: 110, age: 1989, insulation: "None",                  h0: 235, currentLoss: 235 },
    { id: "B6",  name: "Kazakh National University",    x: 170, y: 120, w: 160, h: 110, age: 1995, insulation: "Glasswool 30mm",         h0: 180, currentLoss: 180 },
    { id: "B7",  name: "Baiterek Tower",                x: 370, y: 120, w: 130, h: 110, age: 2002, insulation: "Foam 50mm",              h0: 140, currentLoss: 140 },
    { id: "B8",  name: "Municipal Administration",      x: 60,  y: 270, w: 75,  h: 110, age: 1981, insulation: "None",                  h0: 270, currentLoss: 270 },
    { id: "B9",  name: "Khan Shatyr Entertainment",     x: 170, y: 270, w: 160, h: 110, age: 2010, insulation: "Pneumatic cushions",     h0: 155, currentLoss: 155 },
    { id: "B10", name: "Talan Towers",                  x: 370, y: 270, w: 130, h: 110, age: 2017, insulation: "Fiberglass 150mm",       h0: 60,  currentLoss: 60  },
    { id: "B11", name: "National Library",              x: 540, y: 270, w: 50,  h: 110, age: 2011, insulation: "Polystyrene 80mm",       h0: 98,  currentLoss: 98  }
];

function App() {
    const [currentMode, setCurrentMode] = useState("traffic");
    const [selectedBuilding, setSelectedBuilding] = useState(null);
    const [selectedInsulationThickness, setSelectedInsulationThickness] = useState(50);
    const [geminiActive, setGeminiActive] = useState(false);
    
    // Live Telemetry states
    const [avgSpeed, setAvgSpeed] = useState(48.2);
    const [congestionRate, setCongestionRate] = useState(35);
    const [co2Ppm, setCo2Ppm] = useState(410.0);
    const [facadeHeatLoss, setFacadeHeatLoss] = useState(95.0);
    const [ambientTemp, setAmbientTemp] = useState(30.0);
    const [appliedAdjustments, setAppliedAdjustments] = useState([]);
    const [mlAnalysis, setMlAnalysis] = useState({ is_anomaly: false, anomaly_score: 0.0, confidence_pct: 0 });
    const [smartControl, setSmartControl] = useState({
        district_id: "nurzhol_sector_A",
        mode: "AUTO",
        risk_level: "LOW",
        signal_phase: "GREEN_EW",
        power_state: "ON",
        relay_command: "RELAY_ON",
        traffic_light: { red: false, yellow: false, green: true },
        power_usage_kw: 0,
        reason: "System initialized. Waiting for telemetry.",
        recommended_actions: ["Keep normal monitoring cycle"],
        last_updated: null
    });
    
    // Lists references for animation and rendering
    const roadsRef = useRef(BASE_ROADS.map(r => ({ ...r })));
    const buildingsRef = useRef(BASE_BUILDINGS.map(b => ({ ...b })));
    const carsRef = useRef([]);
    const speedHistoryRef = useRef([52, 54, 50, 48, 52, 55, 53, 51, 49, 48]);
    
    // Ticker console logs
    const [streamLogs, setStreamLogs] = useState([]);
    
    // Physical node info
    const [iotNode, setIotNode] = useState({
        nodeId: "ESP32-STANDBY",
        ipAddr: "NOT CONNECTED",
        distanceCm: null,
        tempC: null,
        powerKw: null,
        status: "SIMULATION IN PROGRESS"
    });
    
    // WS router connection label
    const [wsStatus, setWsStatus] = useState("DISCONNECTED");
    const [packetsPerSec, setPacketsPerSec] = useState("0 PKT/S");
    const packetCountRef = useRef(0);
    
    const [sessionId] = useState(() => {
        let sid = localStorage.getItem("kha_session_id");
        if (!sid) {
            sid = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            localStorage.setItem("kha_session_id", sid);
        }
        return sid;
    });

    const [dbRefreshTrigger, setDbRefreshTrigger] = useState(0);
    const [runAiTrigger, setRunAiTrigger] = useState(false);

    // Initialise cars
    useEffect(() => {
        const cars = [];
        for (let i = 0; i < 50; i++) {
            const road = roadsRef.current[Math.floor(Math.random() * roadsRef.current.length)];
            cars.push({
                roadId: road.id,
                pos: Math.random(),
                dir: Math.random() > 0.5 ? 1 : -1,
                speed: 0.8 + Math.random() * 0.4,
                color: `hsl(${Math.random() * 30 + 180}, 80%, 70%)`
            });
        }
        carsRef.current = cars;
    }, []);

    // Fetch config check on load
    useEffect(() => {
        fetch("/api/config")
            .then(res => res.json())
            .then(data => setGeminiActive(data.gemini_active))
            .catch(() => setGeminiActive(false));

        fetch("/api/control/status")
            .then(res => res.json())
            .then(data => setSmartControl(data))
            .catch(() => {});
    }, []);

    // WebSocket connection hook
    useEffect(() => {
        let socket;
        let reconnectTimeout;
        
        function connect() {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                setWsStatus("FASTAPI: WS CONNECTED");
            };

            socket.onclose = () => {
                setWsStatus("FASTAPI: RECONNECTING");
                reconnectTimeout = setTimeout(connect, 4000);
            };

            socket.onerror = (err) => {
                console.error("WS error:", err);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    packetCountRef.current += 1;

                    if (data.source === "twin_simulator" && data.type === "twin_telemetry") {
                        setAvgSpeed(data.metrics.traffic_speed_kmh);
                        setCongestionRate(data.metrics.congestion_index);
                        setCo2Ppm(data.metrics.air_quality_co2_ppm);
                        setFacadeHeatLoss(data.metrics.facade_heat_loss_w_m2);
                        setAmbientTemp(data.metrics.ambient_temp_c);
                        
                        if (data.ml_analysis) {
                            setMlAnalysis(data.ml_analysis);
                        }

                        // Update roads speeds from twin data
                        roadsRef.current.forEach(r => {
                            const factor = (r.id === "R2" || r.id === "R4") ? 0.75 : 1.15;
                            r.currentSpeed = Math.min(r.baseSpeed, Math.round(data.metrics.traffic_speed_kmh * factor));
                        });

                        // Update Keruen mall facade heat loss
                        const keruen = buildingsRef.current.find(b => b.id === "B1");
                        if (keruen) {
                            keruen.currentLoss = data.metrics.facade_heat_loss_w_m2;
                        }

                        if (data.ai_trigger) {
                            setRunAiTrigger(prev => !prev);
                        }

                        // Trigger DB tables reload
                        setDbRefreshTrigger(prev => prev + 1);

                        // Add stream line
                        addLogLine("astana", `speed=${data.metrics.traffic_speed_kmh.toFixed(1)} co2=${data.metrics.air_quality_co2_ppm.toFixed(0)} anomaly=${data.ml_analysis?.is_anomaly ? '⚠️' : '✅'}`);
                    }

                    if (data.source === "physical_hardware" && data.type === "esp32_telemetry") {
                        const sensors = data.payload;
                        setIotNode({
                            nodeId: data.node_id,
                            ipAddr: "CONNECTED (WS)",
                            distanceCm: sensors.distance_sensor,
                            tempC: sensors.temperature,
                            powerKw: sensors.power_usage_kw,
                            status: "PHYSICAL NODE ACTIVE"
                        });

                        if (sensors.control) {
                            setSmartControl(sensors.control);
                        }

                        // Map physical data onto Turan/Kabanbay + Keruen Mall
                        const r2 = roadsRef.current.find(r => r.id === "R2");
                        if (r2) r2.currentSpeed = Math.round(sensors.calculated_speed);

                        const keruen = buildingsRef.current.find(b => b.id === "B1");
                        if (keruen && sensors.temperature > 0) {
                            keruen.h0 = Math.round(sensors.temperature * 8.5);
                        }

                        addLogLine("traffic", `[ESP32] node=${data.node_id} dist=${sensors.distance_sensor.toFixed(0)}cm temp=${sensors.temperature.toFixed(1)}°C`);
                    }

                    if (data.source === "smart_control" && data.type === "control_decision") {
                        setSmartControl(data.payload);
                        addLogLine("traffic", `[CONTROL] signal=${data.payload.signal_phase} power=${data.payload.power_state} risk=${data.payload.risk_level}`);
                    }
                } catch (e) {
                    console.error("Error parsing WS packet:", e);
                }
            };
        }

        connect();

        return () => {
            if (socket) socket.close();
            clearTimeout(reconnectTimeout);
        };
    }, []);

    // Packet counter helper
    useEffect(() => {
        const interval = setInterval(() => {
            setPacketsPerSec(`${packetCountRef.current} PKT/S`);
            packetCountRef.current = 0;
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Stream logs ticker
    useEffect(() => {
        const interval = setInterval(() => {
            const isTraffic = Math.random() > 0.38;
            const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
            if (isTraffic) {
                const r = roadsRef.current[Math.floor(Math.random() * roadsRef.current.length)];
                const pkt = {
                    router: "FastAPI_Core",
                    packet_id: Math.floor(Math.random() * 10000),
                    type: "traffic_data",
                    data: { road_id: r.id, street: r.name, speed: r.currentSpeed, congestion: Math.round(100 - (r.currentSpeed / r.baseSpeed) * 100) }
                };
                setStreamLogs(prev => {
                    const next = [...prev, { cls: "traffic", text: `[${time}] ${JSON.stringify(pkt)}` }];
                    return next.slice(-12);
                });
            } else {
                const b = buildingsRef.current[Math.floor(Math.random() * buildingsRef.current.length)];
                const pkt = {
                    router: "FastAPI_Core",
                    packet_id: Math.floor(Math.random() * 10000),
                    type: "thermo_data",
                    data: { bldg_id: b.id, name: b.name, loss_wm2: Math.round(b.currentLoss), efficient: b.currentLoss < 100 }
                };
                setStreamLogs(prev => {
                    const next = [...prev, { cls: "thermo", text: `[${time}] ${JSON.stringify(pkt)}` }];
                    return next.slice(-12);
                });
            }
        }, 800);

        return () => clearInterval(interval);
    }, []);

    function addLogLine(cls, msg) {
        const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
        const prefix = cls === "astana" ? `<b style="color:var(--neon-cyan)">[ASTANA TWIN]</b>` : `<b style="color:var(--neon-green)">[ESP32]</b>`;
        setStreamLogs(prev => {
            const next = [...prev, {
                cls: cls,
                text: `[${time}] ${prefix} ${msg}`,
                isHtml: true
            }];
            return next.slice(-12);
        });
    }

    // Local road congestion simulation loop
    useEffect(() => {
        const interval = setInterval(() => {
            // Speed telemetry stats update
            const activeSpeeds = roadsRef.current.map(r => r.currentSpeed);
            const sum = activeSpeeds.reduce((a, b) => a + b, 0);
            const calculatedAvg = sum / activeSpeeds.length;
            
            const baseAvg = roadsRef.current.reduce((a, b) => a + b.baseSpeed, 0) / roadsRef.current.length;
            const calculatedCongestion = Math.max(0, Math.round((1 - (calculatedAvg / baseAvg)) * 100));

            setAvgSpeed(calculatedAvg);
            setCongestionRate(calculatedCongestion);

            if (Math.random() > 0.82) {
                speedHistoryRef.current.push(parseFloat(calculatedAvg.toFixed(1)));
                if (speedHistoryRef.current.length > 20) speedHistoryRef.current.shift();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard-wrapper">
            <div className="crt-overlay"></div>
            
            {/* ╔══════════ HEADER ══════════╗ */}
            <header className="brutal-header">
                <div className="header-logo">
                    <span className="glitch-text" data-text="ASTANA TWIN">ASTANA TWIN</span>
                    <span className="version-tag">KHA-DIVERGENT · DISTRICT SIMULATOR v3.0.0</span>
                </div>
                
                <div className="mode-toggle-container">
                    <span className="toggle-label">ACTIVE LAYER:</span>
                    <div className="toggle-switch-group" id="modeToggleGroup">
                        <button 
                            className={`toggle-btn ${currentMode === 'traffic' ? 'active' : ''}`}
                            id="toggleTraffic"
                            onClick={() => setCurrentMode("traffic")}
                        >
                            <span className="icon">🚦</span> TRAFFIC FLOW
                        </button>
                        <button 
                            className={`toggle-btn ${currentMode === 'thermo' ? 'active' : ''}`}
                            id="toggleThermo"
                            onClick={() => setCurrentMode("thermo")}
                        >
                            <span className="icon">🔥</span> THERMOGRAPHIC
                        </button>
                    </div>
                </div>

                <div className="header-stats">
                    <div className="stat-indicator">
                        <span className="blink-dot"></span>
                        <span id="routerStatus" style={{ color: wsStatus.includes("CONNECTED") ? "var(--neon-green)" : "var(--neon-orange)" }}>
                            {wsStatus}
                        </span>
                    </div>
                    <div className="stat-value">{packetsPerSec}</div>
                </div>
            </header>

            {/* ╔══════════ MAIN GRID ══════════╗ */}
            <main className="dashboard-grid">
                
                {/* ═══════ LEFT: CANVA BLOCK ═══════ */}
                <CityMap 
                    currentMode={currentMode}
                    roadsRef={roadsRef}
                    buildingsRef={buildingsRef}
                    carsRef={carsRef}
                    appliedAdjustments={appliedAdjustments}
                    selectedBuilding={selectedBuilding}
                    setSelectedBuilding={setSelectedBuilding}
                />

                {/* ═══════ RIGHT: DETAILS & CONTROLS ═══════ */}
                <section className="sidebar-panel">
                    
                    <div className="panel widget-panel">
                        {currentMode === "traffic" ? (
                            <TrafficModule 
                                avgSpeed={avgSpeed}
                                congestionRate={congestionRate}
                                co2Ppm={co2Ppm}
                                facadeHeatLoss={facadeHeatLoss}
                                ambientTemp={ambientTemp}
                                mlAnalysis={mlAnalysis}
                                speedHistoryRef={speedHistoryRef}
                                appliedAdjustments={appliedAdjustments}
                                setAppliedAdjustments={setAppliedAdjustments}
                                roadsRef={roadsRef}
                                addLogLine={addLogLine}
                                runAiTrigger={runAiTrigger}
                                setDbRefreshTrigger={setDbRefreshTrigger}
                                geminiActive={geminiActive}
                                sessionId={sessionId}
                                smartControl={smartControl}
                                setSmartControl={setSmartControl}
                            />
                        ) : (
                            <ThermoModule 
                                selectedBuilding={selectedBuilding}
                                selectedInsulationThickness={selectedInsulationThickness}
                                setSelectedInsulationThickness={setSelectedInsulationThickness}
                                geminiActive={geminiActive}
                                sessionId={sessionId}
                                buildingsRef={buildingsRef}
                                addLogLine={addLogLine}
                                setDbRefreshTrigger={setDbRefreshTrigger}
                            />
                        )}
                    </div>

                    <ConsoleLog streamLogs={streamLogs} />
                    
                    <IotMonitor iotNode={iotNode} smartControl={smartControl} />

                    <DbMonitor 
                        sessionId={sessionId}
                        dbRefreshTrigger={dbRefreshTrigger}
                    />

                </section>
            </main>

            {/* ╔══════════ FOOTER MARQUEE ══════════╗ */}
            <footer className="alert-marquee">
                <div className="marquee-content">
                    ⚡ KHA-DIVERGENT SYSTEM BROADCAST: UNIFIED TELEMETRY DISPATCHING IN PROGRESS ── TIMESCALEDB TIME-SERIES PARTITIONS NORMAL ── REGULAR TRAFFIC FLOW ACTIVE ── MONITORED THERMAL CHANNELS: 147 OUTLETS ── ASTANA TWIN DIGITAL DISTRICT SIMULATION ACTIVE ──
                </div>
            </footer>
        </div>
    );
}

export default App;
