import React, { useState, useEffect, useRef } from 'react';

function NexoraLanding({ onLaunchConsole }) {
    const [activeVertical, setActiveVertical] = useState("structural");
    const [codeSnippetType, setCodeSnippetType] = useState("traffic");
    const [dataVolume, setDataVolume] = useState(5); // Millions of telemetry packets
    const [demoForm, setDemoForm] = useState({ name: "", email: "", agency: "", module: "structural" });
    const [demoSubmitted, setDemoSubmitted] = useState(false);

    const particlesCanvasRef = useRef(null);

    // Floating background particles effect
    useEffect(() => {
        const canvas = particlesCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let animationFrameId;

        const resizeCanvas = () => {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight || 600;
        };
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        const particles = [];
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 2 + 1,
                dx: (Math.random() - 0.5) * 0.5,
                dy: (Math.random() - 0.5) * 0.5,
                color: Math.random() > 0.5 ? "rgba(0, 229, 255, 0.15)" : "rgba(244, 63, 94, 0.15)"
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                p.x += p.dx;
                p.y += p.dy;

                if (p.x < 0 || p.x > canvas.width) p.dx = -p.dx;
                if (p.y < 0 || p.y > canvas.height) p.dy = -p.dy;
            });
            animationFrameId = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener("resize", resizeCanvas);
        };
    }, []);

    const verticals = {
        traffic: {
            title: "Traffic Flow Optimization",
            desc: "Predictive congestion indexes, MQ-135 vehicle carbon emission audits, and smart signal routing algorithms (Green Waves).",
            metric: "48.2 km/h Target Flow",
            badge: "Operational",
            accent: "var(--neon-cyan)"
        },
        thermo: {
            title: "Thermographic Energy Audits",
            desc: "Building envelope heat loss analysis, facade insulation thickness recommendations, and KZT-based upgrade payback calculators.",
            metric: "Norm: <80 W/m² Heat Loss",
            badge: "Operational",
            accent: "var(--neon-yellow)"
        },
        structural: {
            title: "Structural & Geotechnical Health",
            desc: "Bridge and building safety evaluations complying with СП РК 2.03-30-2017 seismic regulations. Integrates accelerometer FFT spectra and soil regressions.",
            metric: "0.22mm Seismic Drift",
            badge: "SP RK Compliant",
            accent: "var(--neon-green)"
        },
        mobility: {
            title: "Transit Mobility Economics",
            desc: "Corridor routing simulation (Vokzal ➔ KarGTU) comparing bus vs. LRT travel times and analyzing daily passenger capacities.",
            metric: "50% Commute Saving",
            badge: "Prophet Active",
            accent: "var(--neon-magenta)"
        },
        fleet: {
            title: "Geospatial Environmental Survey",
            desc: "Ingesting live coordinate streams from mobile survey robots to build Inverse Distance Weighting (IDW) contamination heatmaps.",
            metric: "348x MPC Chromium Tracker",
            badge: "IDW Matrix",
            accent: "var(--neon-orange)"
        }
    };

    const codeSnippets = {
        traffic: `import { khaDivergent } from "@kha/core";

// Optimize signal timings
khaDivergent.stream("astana.traffic")
  .filter(t => t.congestion_index > 65)
  .enrich(traffic_grid)
  .route({
    signal: "GREEN_WAVE",
    ledger: "control_events",
    adjust_phase: "EW_EXTENDED"
  });`,
        structural: `import { structuralCore } from "@kha/core";

// Comply with SP RK 2.03-30-2017
structuralCore.monitor("bridge_model_01")
  .onAnomaly(alert => {
    sysLog.warn("Bridge Soft Spot: Peak frequency shifted to " + alert.freq + "Hz");
    callGemini("structural", alert);
  })
  .calculateTimeToConcern();`,
        fleet: `import { fleetController } from "@kha/core";

// Compute IDW Contamination Map
fleetController.streamRobots()
  .map(r => ({ x: r.pos_x, y: r.pos_y, val: r.chromium }))
  .interpolate({ grid_resolution: 15 })
  .onUpdate(grid => {
    broadcastWebSocket({ channel: "fleet_telemetry", heatmap: grid });
  });`
    };

    const calculateCost = () => {
        const ratePerMillion = 8.5;
        return (dataVolume * ratePerMillion).toFixed(2);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setDemoSubmitted(true);
    };

    return (
        <div style={{ backgroundColor: "#06090e", color: "var(--text-primary)", fontFamily: "var(--font-heading)", minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
            
            {/* Background particles */}
            <canvas ref={particlesCanvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}></canvas>

            {/* ── Header ── */}
            <header style={{ borderBottom: "1px solid #141a29", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-magenta))" }}></div>
                    <span style={{ fontWeight: "900", fontSize: "20px", letterSpacing: "1.5px", fontFamily: "var(--font-mono)", color: "#fff" }}>KHA-DIVERGENT</span>
                </div>
                
                <nav style={{ display: "flex", gap: "24px", fontSize: "13px", color: "var(--text-muted)", fontWeight: "bold" }}>
                    <a href="#platform" style={{ color: "inherit", textDecoration: "none" }}>Platform</a>
                    <a href="#modules" style={{ color: "inherit", textDecoration: "none" }}>Core Modules</a>
                    <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>Data Pricing</a>
                </nav>

                <button 
                    onClick={onLaunchConsole}
                    style={{
                        backgroundColor: "#fff",
                        color: "#000",
                        border: "none",
                        fontWeight: "bold",
                        fontSize: "12px",
                        padding: "10px 18px",
                        cursor: "pointer",
                        boxShadow: "0 0 15px rgba(255,255,255,0.25)",
                        transition: "all 0.3s ease"
                    }}
                    onMouseEnter={e => e.target.style.boxShadow = "0 0 25px rgba(0, 229, 255, 0.6)"}
                    onMouseLeave={e => e.target.style.boxShadow = "0 0 15px rgba(255,255,255,0.25)"}
                >
                    LAUNCH CONSOLE ➔
                </button>
            </header>

            {/* ── Hero Section ── */}
            <section id="platform" style={{ padding: "80px 40px", maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 5, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "60px", alignItems: "center" }}>
                <div>
                    <span style={{ color: "var(--neon-cyan)", textTransform: "uppercase", fontSize: "11px", fontWeight: "900", letterSpacing: "2.5px", display: "block", marginBottom: "16px" }}>
                        MULTI-DOMAIN INDUSTRIAL INTEGRATION
                    </span>
                    <h1 style={{ fontSize: "52px", fontWeight: "900", lineHeight: "1.1", color: "#fff", marginBottom: "24px" }}>
                        One operating layer for <span style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>KHA Digital Twins</span>.
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "16px", lineHeight: "1.6", marginBottom: "32px", maxWidth: "540px" }}>
                        KHA-DIVERGENT unifies road traffic routing, facade insulation audits, structural seismic vibration monitoring, and spatial soil pollution heatmaps under a single asynchronous API.
                    </p>
                    
                    <div style={{ display: "flex", gap: "16px" }}>
                        <button 
                            onClick={onLaunchConsole}
                            style={{
                                backgroundColor: "var(--neon-cyan)",
                                color: "#000",
                                border: "none",
                                fontWeight: "bold",
                                padding: "14px 28px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontFamily: "var(--font-mono)"
                            }}
                        >
                            LAUNCH CONSOLE
                        </button>
                        <a 
                            href="#cta"
                            style={{
                                border: "1px solid var(--border-color)",
                                color: "#fff",
                                textDecoration: "none",
                                fontWeight: "bold",
                                padding: "14px 28px",
                                fontSize: "13px",
                                textAlign: "center",
                                display: "inline-block"
                            }}
                        >
                            TALK TO SALES
                        </a>
                    </div>
                </div>

                {/* Right: Interactive API Terminal */}
                <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", backgroundColor: "#090c12", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                    <div style={{ borderBottom: "1px solid #141a29", padding: "12px", display: "flex", gap: "6px" }}>
                        <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444" }}></span>
                        <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#eab308" }}></span>
                        <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#22c55e" }}></span>
                        <span style={{ color: "var(--text-muted)", fontSize: "10px", fontFamily: "var(--font-mono)", marginLeft: "12px" }}>kha-divergent-sdk.js</span>
                    </div>

                    <div style={{ padding: "8px", display: "flex", gap: "8px", borderBottom: "1px solid #141a29" }}>
                        <button onClick={() => setCodeSnippetType("traffic")} style={{ backgroundColor: codeSnippetType === "traffic" ? "#1b2436" : "transparent", color: codeSnippetType === "traffic" ? "var(--neon-cyan)" : "var(--text-muted)", border: "none", fontSize: "10px", padding: "4px 8px", cursor: "pointer", fontFamily: "var(--font-mono)" }}>TRAFFIC_FLOW</button>
                        <button onClick={() => setCodeSnippetType("structural")} style={{ backgroundColor: codeSnippetType === "structural" ? "#1b2436" : "transparent", color: codeSnippetType === "structural" ? "var(--neon-green)" : "var(--text-muted)", border: "none", fontSize: "10px", padding: "4px 8px", cursor: "pointer", fontFamily: "var(--font-mono)" }}>STRUCTURAL_HEALTH</button>
                        <button onClick={() => setCodeSnippetType("fleet")} style={{ backgroundColor: codeSnippetType === "fleet" ? "#1b2436" : "transparent", color: codeSnippetType === "fleet" ? "var(--neon-magenta)" : "var(--text-muted)", border: "none", fontSize: "10px", padding: "4px 8px", cursor: "pointer", fontFamily: "var(--font-mono)" }}>FLEET_INTERPOLATION</button>
                    </div>

                    <pre style={{ margin: 0, padding: "20px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#9cdcfe", overflowX: "auto", lineHeight: "1.5" }}>
                        <code>{codeSnippets[codeSnippetType]}</code>
                    </pre>
                </div>
            </section>

            {/* ── Verticals Section ── */}
            <section id="modules" style={{ padding: "80px 40px", borderTop: "1px solid #141a29", borderBottom: "1px solid #141a29", backgroundColor: "#080b11", position: "relative", zIndex: 5 }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: "60px" }}>
                        <span style={{ color: "var(--neon-magenta)", textTransform: "uppercase", fontSize: "11px", fontWeight: "900", letterSpacing: "2.5px" }}>KHA SIMULATOR ARTIFACTS</span>
                        <h2 style={{ fontSize: "36px", fontWeight: "900", color: "#fff", marginTop: "12px" }}>Autonomous Monitoring System Modules</h2>
                    </div>

                    {/* Verticals grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "40px" }}>
                        {/* Vertical Left Selector */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {Object.entries(verticals).map(([key, v]) => (
                                <div 
                                    key={key} 
                                    onClick={() => setActiveVertical(key)}
                                    style={{
                                        border: "1px solid var(--border-color)",
                                        backgroundColor: activeVertical === key ? "#0d111a" : "transparent",
                                        padding: "16px 20px",
                                        cursor: "pointer",
                                        borderLeft: activeVertical === key ? `4px solid ${v.accent}` : "1px solid var(--border-color)",
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <b style={{ textTransform: "uppercase", fontSize: "12px", letterSpacing: "1px", color: activeVertical === key ? "#fff" : "var(--text-muted)" }}>{key}</b>
                                        <span style={{ fontSize: "9px", backgroundColor: "#141b29", padding: "2px 6px", color: v.accent }}>{v.badge}</span>
                                    </div>
                                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginTop: "8px" }}>{v.title}</div>
                                </div>
                            ))}
                        </div>

                        {/* Vertical Right Panel details */}
                        <div style={{ border: "1px solid var(--border-color)", backgroundColor: "#0d111a", padding: "40px", display: "flex", flexDirection: "column", justify: "center", position: "relative" }}>
                            <div style={{ position: "absolute", top: "20px", right: "20px", fontSize: "11px", color: "var(--text-muted)" }}>MODULE STATUS: <b style={{ color: "var(--neon-green)" }}>OPERATIONAL</b></div>
                            
                            <h3 style={{ fontSize: "30px", fontWeight: "900", color: "#fff", marginBottom: "16px" }}>{verticals[activeVertical].title}</h3>
                            <p style={{ color: "var(--text-muted)", fontSize: "16px", lineHeight: "1.6", marginBottom: "32px", maxWidth: "600px" }}>{verticals[activeVertical].desc}</p>
                            
                            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                                <div>
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Primary telemetry target</div>
                                    <div style={{ fontSize: "22px", fontWeight: "bold", color: verticals[activeVertical].accent, fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                                        {verticals[activeVertical].metric}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Operator controls</div>
                                    <button 
                                        onClick={onLaunchConsole}
                                        style={{
                                            backgroundColor: "transparent",
                                            color: "var(--neon-green)",
                                            border: "1px solid var(--neon-green)",
                                            padding: "6px 12px",
                                            fontSize: "11px",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                            marginTop: "6px"
                                        }}
                                    >
                                        OPEN TWIN DECK ➔
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Data Pricing Section ── */}
            <section id="pricing" style={{ padding: "80px 40px", maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 5 }}>
                <div style={{ textAlign: "center", marginBottom: "40px" }}>
                    <span style={{ color: "var(--neon-cyan)", textTransform: "uppercase", fontSize: "11px", fontWeight: "900", letterSpacing: "2.5px" }}>RESOURCE CALCULATOR</span>
                    <h2 style={{ fontSize: "36px", fontWeight: "900", color: "#fff", marginTop: "12px" }}>Time-Series Telemetry Pricing</h2>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "60px", alignItems: "center" }}>
                    {/* Left: Pricing Calculator */}
                    <div style={{ border: "1px solid var(--border-color)", backgroundColor: "#080b11", padding: "30px", borderRadius: "6px" }}>
                        <h4 style={{ fontSize: "18px", fontWeight: "bold", color: "#fff", marginBottom: "20px" }}>Monthly Data Volume Ingestion</h4>
                        
                        <div style={{ marginBottom: "24px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span style={{ color: "var(--text-muted)" }}>Streamed Data Points:</span>
                                <b style={{ color: "var(--neon-cyan)", fontFamily: "var(--font-mono)" }}>{dataVolume} Million packets</b>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="100" 
                                value={dataVolume} 
                                onChange={e => setDataVolume(parseInt(e.target.value))}
                                style={{ width: "100%", accentColor: "var(--neon-cyan)" }}
                            />
                        </div>

                        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>ESTIMATED DATA BANDWIDTH</span>
                                <div style={{ fontSize: "36px", fontWeight: "900", color: "#fff", fontFamily: "var(--font-mono)" }}>
                                    ${calculateCost()}<span style={{ fontSize: "14px", color: "var(--text-muted)" }}>/mo</span>
                                </div>
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
                                Rate: $8.50 / million packets<br/>
                                Local deployment: **Open Source**
                            </div>
                        </div>
                    </div>

                    {/* Right: Feature listing */}
                    <div>
                        <h4 style={{ fontSize: "22px", fontWeight: "900", color: "#fff", marginBottom: "16px" }}>Core KHA features included:</h4>
                        <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", color: "var(--text-muted)" }}>
                            <li>✦ <b>TimescaleDB partitions</b> out-of-the-box.</li>
                            <li>✦ <b>СП РК 2.03-30-2017 Compliancy</b> verification logs.</li>
                            <li>✦ <b>Real-time Isolation Forest</b> model training checkpoints.</li>
                            <li>✦ <b>Gemini 2.5 context window mapping</b> for expert civil personas.</li>
                            <li>✦ <b>Offline local SQLite fallback mode</b> when WAN connection is lost.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ── Demo CTA Section ── */}
            <section id="cta" style={{ padding: "80px 40px", backgroundColor: "#080b11", borderTop: "1px solid #141a29" }}>
                <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
                    <h2 style={{ fontSize: "36px", fontWeight: "900", color: "#fff", marginBottom: "16px" }}>Connect your municipal edge transmitters.</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.5", marginBottom: "30px" }}>
                        Register new structural bridges, traffic loop sensors, or geospatial robots to the KHA-DIVERGENT unified monitoring core.
                    </p>

                    {demoSubmitted ? (
                        <div style={{ padding: "20px", border: "1px solid var(--neon-green)", backgroundColor: "rgba(0, 229, 255, 0.05)", color: "var(--neon-cyan)", fontWeight: "bold" }}>
                            ✓ Thank you! Node access tokens and SDK documentation have been generated.
                        </div>
                    ) : (
                        <form onSubmit={handleFormSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", textAlign: "left" }}>
                            <input 
                                type="text" 
                                placeholder="Operator Name" 
                                required
                                value={demoForm.name}
                                onChange={e => setDemoForm({...demoForm, name: e.target.value})}
                                style={{ backgroundColor: "#06090e", border: "1px solid var(--border-color)", color: "#fff", padding: "12px", fontSize: "13px" }}
                            />
                            <input 
                                type="email" 
                                placeholder="Municipal Email" 
                                required
                                value={demoForm.email}
                                onChange={e => setDemoForm({...demoForm, email: e.target.value})}
                                style={{ backgroundColor: "#06090e", border: "1px solid var(--border-color)", color: "#fff", padding: "12px", fontSize: "13px" }}
                            />
                            <input 
                                type="text" 
                                placeholder="Municipal Agency" 
                                required
                                value={demoForm.agency}
                                onChange={e => setDemoForm({...demoForm, agency: e.target.value})}
                                style={{ backgroundColor: "#06090e", border: "1px solid var(--border-color)", color: "#fff", padding: "12px", fontSize: "13px" }}
                            />
                            <select 
                                value={demoForm.module}
                                onChange={e => setDemoForm({...demoForm, module: e.target.value})}
                                style={{ backgroundColor: "#06090e", border: "1px solid var(--border-color)", color: "#fff", padding: "12px", fontSize: "13px" }}
                            >
                                <option value="traffic">Traffic Flow Optimization</option>
                                <option value="thermo">Thermographic Energy audits</option>
                                <option value="structural">Structural Geotechnical monitor</option>
                                <option value="mobility">Transit Route economics</option>
                                <option value="fleet">Environmental Fleet patrols</option>
                            </select>
                            <button 
                                type="submit" 
                                style={{
                                    gridColumn: "span 2",
                                    backgroundColor: "var(--neon-cyan)",
                                    color: "#000",
                                    border: "none",
                                    fontWeight: "bold",
                                    padding: "14px",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    marginTop: "10px",
                                    fontFamily: "var(--font-mono)"
                                }}
                            >
                                REQUEST OPERATOR ACCESS ➔
                            </button>
                        </form>
                    )}
                </div>
            </section>

            {/* ── Footer ── */}
            <footer style={{ borderTop: "1px solid #141a29", padding: "40px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                <div>© 2026 KHA-DIVERGENT Systems Core. All rights reserved.</div>
                <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px" }}>
                    <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy Policy</a>
                    <span>·</span>
                    <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms of Service</a>
                    <span>·</span>
                    <a href="#" style={{ color: "inherit", textDecoration: "none" }}>System Status</a>
                </div>
            </footer>

        </div>
    );
}

export default NexoraLanding;
