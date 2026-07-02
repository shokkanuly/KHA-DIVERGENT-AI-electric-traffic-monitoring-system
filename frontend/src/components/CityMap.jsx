import React, { useEffect, useRef, useState } from 'react';

const INTERSECTIONS = [
    { id: "I1", name: "Turan / Kunayev",        x: 150, y: 100 },
    { id: "I2", name: "Turan / Dostyk",          x: 350, y: 100 },
    { id: "I3", name: "Turan / Syganak",         x: 520, y: 100 },
    { id: "I4", name: "Kabanbay / Kunayev",      x: 150, y: 250 },
    { id: "I5", name: "Kabanbay / Dostyk",       x: 350, y: 250 },
    { id: "I6", name: "Kabanbay / Syganak",      x: 520, y: 250 },
    { id: "I7", name: "Mangilik / Kunayev",      x: 150, y: 400 },
    { id: "I8", name: "Mangilik / Dostyk",       x: 350, y: 400 },
    { id: "I9", name: "Mangilik / Syganak",      x: 520, y: 400 }
];

function CityMap({
    currentMode,
    roadsRef,
    buildingsRef,
    carsRef,
    appliedAdjustments,
    selectedBuilding,
    setSelectedBuilding
}) {
    const canvasRef = useRef(null);
    const [mouseCoords, setMouseCoords] = useState("LAT: 51.1601 / LNG: 71.4272");

    // Handle canvas resizing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        function resize() {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Canvas drawing animation loop
    useEffect(() => {
        let animFrameId;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const scaleX = canvas.width / 640;
            const scaleY = canvas.height / 480;

            // 1. Background Grid
            ctx.strokeStyle = "rgba(255, 255, 255, 0.018)";
            ctx.lineWidth = 1;
            const gridSize = 30;
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            // 2. Buildings
            buildingsRef.current.forEach(b => {
                const bx = b.x * scaleX;
                const by = b.y * scaleY;
                const bw = b.w * scaleX;
                const bh = b.h * scaleY;

                ctx.beginPath();
                ctx.rect(bx, by, bw, bh);

                if (currentMode === "traffic") {
                    ctx.fillStyle = "#141420";
                    ctx.strokeStyle = "#1e1e2e";
                    ctx.lineWidth = 1.5;
                    ctx.fill();
                    ctx.stroke();

                    // Window grid pattern
                    ctx.strokeStyle = "rgba(255,255,255,0.04)";
                    ctx.lineWidth = 0.5;
                    const winW = bw / 5, winH = bh / 3;
                    for (let wx = bx + winW; wx < bx + bw - 2; wx += winW) {
                        ctx.beginPath(); ctx.moveTo(wx, by + 2); ctx.lineTo(wx, by + bh - 2); ctx.stroke();
                    }
                    for (let wy = by + winH; wy < by + bh - 2; wy += winH) {
                        ctx.beginPath(); ctx.moveTo(bx + 2, wy); ctx.lineTo(bx + bw - 2, wy); ctx.stroke();
                    }
                } else {
                    // Thermographic color heatmap (Professional matte gradient colors)
                    let heatCol = "rgba(244, 63, 94, 0.8)"; // Red
                    if (b.currentLoss < 55)       heatCol = "rgba(14, 165, 233, 0.8)"; // Cool Blue
                    else if (b.currentLoss < 90)  heatCol = "rgba(16, 185, 129, 0.8)"; // Emerald Green
                    else if (b.currentLoss < 130) heatCol = "rgba(245, 158, 11, 0.8)"; // Amber
                    else if (b.currentLoss < 185) heatCol = "rgba(249, 115, 22, 0.8)"; // Orange

                    // Glow effect for hot buildings
                    if (b.currentLoss > 185) {
                        ctx.shadowColor = "var(--neon-magenta)";
                        ctx.shadowBlur = 8;
                    }
                    ctx.fillStyle = heatCol;
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    if (selectedBuilding && selectedBuilding.id === b.id) {
                        ctx.strokeStyle = "#ffffff";
                        ctx.lineWidth = 2.5;
                    } else {
                        ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
                        ctx.lineWidth = 1;
                    }
                    ctx.stroke();
                }

                // ID label
                ctx.fillStyle = currentMode === "traffic" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.7)";
                ctx.font = `bold ${Math.max(8, Math.round(8.5 * scaleX))}px 'JetBrains Mono'`;
                ctx.fillText(b.id, bx + 5, by + 16);
            });

            // 3. Roads
            roadsRef.current.forEach(r => {
                const rx1 = r.x1 * scaleX;
                const ry1 = r.y1 * scaleY;
                const rx2 = r.x2 * scaleX;
                const ry2 = r.y2 * scaleY;

                if (currentMode === "traffic") {
                    ctx.beginPath();
                    ctx.moveTo(rx1, ry1);
                    ctx.lineTo(rx2, ry2);
                    ctx.strokeStyle = "rgba(0,0,0,0.8)";
                    ctx.lineWidth = 18;
                    ctx.stroke();

                    // Speed colored surface (Refined dashboard color palette)
                    let rCol = "var(--neon-green)";
                    if (r.currentSpeed < 30)      rCol = "var(--neon-magenta)";
                    else if (r.currentSpeed < 45) rCol = "var(--neon-orange)";
                    else if (r.currentSpeed < 55) rCol = "var(--neon-yellow)";

                    ctx.beginPath();
                    ctx.moveTo(rx1, ry1);
                    ctx.lineTo(rx2, ry2);
                    ctx.strokeStyle = rCol;
                    ctx.lineWidth = 12;
                    ctx.stroke();

                    // Center line
                    ctx.beginPath();
                    ctx.moveTo(rx1, ry1);
                    ctx.lineTo(rx2, ry2);
                    ctx.strokeStyle = "rgba(255,255,255,0.08)";
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([8, 10]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // AI adjustments draw overlays
                    const activeAdj = appliedAdjustments.find(a => a.roadId === r.id);
                    if (activeAdj) {
                        ctx.save();
                        if (activeAdj.action === "GREEN_WAVE") {
                            ctx.beginPath();
                            ctx.moveTo(rx1, ry1);
                            ctx.lineTo(rx2, ry2);
                            ctx.strokeStyle = "rgba(57, 255, 20, 0.9)";
                            ctx.lineWidth = 4;
                            ctx.setLineDash([8, 12]);
                            ctx.lineDashOffset = -Date.now() / 20;
                            ctx.stroke();
                        } else if (activeAdj.action === "EMERGENCY_CORRIDOR") {
                            const dx = rx2 - rx1, dy = ry2 - ry1;
                            const len = Math.sqrt(dx * dx + dy * dy);
                            const nx = (-dy / len) * 9, ny = (dx / len) * 9;
                            ctx.lineWidth = 2;
                            const strobe = Math.floor(Date.now() / 120) % 2 === 0;

                            ctx.beginPath();
                            ctx.moveTo(rx1 + nx, ry1 + ny);
                            ctx.lineTo(rx2 + nx, ry2 + ny);
                            ctx.strokeStyle = strobe ? "#f50057" : "#00e5ff";
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(rx1 - nx, ry1 - ny);
                            ctx.lineTo(rx2 - nx, ry2 - ny);
                            ctx.strokeStyle = strobe ? "#00e5ff" : "#f50057";
                            ctx.stroke();
                        } else if (activeAdj.action === "BUS_PRIORITY") {
                            const dx = rx2 - rx1, dy = ry2 - ry1;
                            const len = Math.sqrt(dx * dx + dy * dy);
                            const nx = (-dy / len) * 7, ny = (dx / len) * 7;

                            ctx.beginPath();
                            ctx.moveTo(rx1 + nx, ry1 + ny);
                            ctx.lineTo(rx2 + nx, ry2 + ny);
                            ctx.strokeStyle = "rgba(0, 229, 255, 0.75)";
                            ctx.lineWidth = 3;
                            ctx.setLineDash([5, 7]);
                            ctx.stroke();
                        }
                        ctx.restore();
                    }
                } else {
                    ctx.beginPath();
                    ctx.moveTo(rx1, ry1);
                    ctx.lineTo(rx2, ry2);
                    ctx.strokeStyle = "#151520";
                    ctx.lineWidth = 10;
                    ctx.stroke();
                }

                // Street Name box labels
                ctx.save();
                ctx.setLineDash([]);
                const midX = (rx1 + rx2) / 2;
                const midY = (ry1 + ry2) / 2;
                const dx = rx2 - rx1, dy = ry2 - ry1;
                let angle = Math.atan2(dy, dx);
                if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

                ctx.translate(midX, midY);
                ctx.rotate(angle);

                const text = r.name.toUpperCase();
                ctx.font = "bold 8px 'JetBrains Mono'";
                const tw = ctx.measureText(text).width;

                ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
                ctx.fillRect(-tw / 2 - 5, -8, tw + 10, 16);
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 1;
                ctx.strokeRect(-tw / 2 - 5, -8, tw + 10, 16);

                const isActive = appliedAdjustments.some(a => a.roadId === r.id);
                ctx.fillStyle = isActive ? "#f8e71c" : "rgba(255,255,255,0.75)";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(text, 0, 0);
                ctx.restore();
            });

            // 4. Intersections
            if (currentMode === "traffic") {
                INTERSECTIONS.forEach(intNode => {
                    const ix = intNode.x * scaleX;
                    const iy = intNode.y * scaleY;

                    ctx.beginPath();
                    ctx.arc(ix, iy, 10, 0, 2 * Math.PI);
                    ctx.fillStyle = "#000";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(255,255,255,0.3)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Pulsing traffic light dot
                    ctx.beginPath();
                    ctx.arc(ix, iy, 4.5, 0, 2 * Math.PI);
                    const pulse = (Date.now() / 380) % 3;
                    ctx.fillStyle = pulse < 1.3 ? "var(--neon-green)" : pulse < 1.7 ? "var(--neon-yellow)" : "var(--neon-magenta)";
                    ctx.fill();

                    // Green wave outer ring pulse
                    if (appliedAdjustments.length > 0) {
                        const r = 13 + Math.sin(Date.now() / 130) * 3;
                        ctx.beginPath();
                        ctx.arc(ix, iy, r, 0, 2 * Math.PI);
                        ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                });
            }

            // 5. Cars
            if (currentMode === "traffic") {
                carsRef.current.forEach(car => {
                    const road = roadsRef.current.find(r => r.id === car.roadId);
                    if (!road) return;

                    const speedMult = road.currentSpeed / road.baseSpeed;
                    const step = 0.003 * car.speed * speedMult;

                    car.pos += step * car.dir;
                    if (car.pos > 1.0) { car.pos = 1.0; car.dir = -1; }
                    else if (car.pos < 0.0) { car.pos = 0.0; car.dir = 1; }

                    const rx1 = road.x1 * scaleX, ry1 = road.y1 * scaleY;
                    const rx2 = road.x2 * scaleX, ry2 = road.y2 * scaleY;

                    const cx = rx1 + (rx2 - rx1) * car.pos;
                    const cy = ry1 + (ry2 - ry1) * car.pos;

                    ctx.fillStyle = car.color;
                    ctx.fillRect(cx - 4, cy - 3, 8, 6);
                    ctx.strokeStyle = "rgba(0,0,0,0.5)";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cx - 4, cy - 3, 8, 6);

                    // Emergency strobes
                    const isEmergencyRoad = appliedAdjustments.some(a => a.roadId === road.id && a.action === "EMERGENCY_CORRIDOR");
                    if (isEmergencyRoad && Math.random() > 0.5) {
                        ctx.fillStyle = Math.random() > 0.5 ? "var(--neon-cyan)" : "var(--neon-magenta)";
                        ctx.fillRect(cx - 2, cy - 2, 4, 4);
                    }
                });
            }

            animFrameId = requestAnimationFrame(draw);
        }

        draw();

        return () => cancelAnimationFrame(animFrameId);
    }, [currentMode, appliedAdjustments, selectedBuilding]);

    // Handle mouse movements
    function handleMouseMove(e) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const lat = (51.1601 + (240 - my) * 0.00003).toFixed(5);
        const lng = (71.4272 + (mx - 320) * 0.00005).toFixed(5);
        setMouseCoords(`LAT: ${lat} / LNG: ${lng}`);
    }

    // Handle clicking a building polygon in Thermographics mode
    function handleCanvasClick(e) {
        if (currentMode !== "thermo") return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (640 / canvas.width);
        const my = (e.clientY - rect.top) * (480 / canvas.height);

        let clicked = null;
        for (const b of buildingsRef.current) {
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
                clicked = b;
                break;
            }
        }

        if (clicked) {
            setSelectedBuilding({ ...clicked });
        }
    }

    return (
        <section className="panel map-panel">
            <div className="panel-header">
                <h2>
                    {currentMode === 'traffic' 
                        ? "CITY ROADWAY LAYER (TRAFFIC FLOW)" 
                        : "THERMAL DEVIATION HEATMAP (BUILDING CONTOURS)"
                    }
                </h2>
                <div className="coordinates-display">{mouseCoords}</div>
            </div>
            <div className="canvas-container">
                <canvas 
                    ref={canvasRef} 
                    id="cityMapCanvas"
                    onMouseMove={handleMouseMove}
                    onClick={handleCanvasClick}
                />
                
                <div className="map-legend">
                    <div className="legend-title">LEGEND</div>
                    <div className="legend-items">
                        {currentMode === "traffic" ? (
                            <>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "var(--neon-green)" }}></div><span>Smooth Flow (&gt; 55 km/h)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "var(--neon-yellow)" }}></div><span>Moderate (45-55 km/h)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "var(--neon-orange)" }}></div><span>Slow (30-45 km/h)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "var(--neon-magenta)" }}></div><span>Congested (&lt; 30 km/h)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "rgba(16, 185, 129, 0.9)" }}></div><span>AI Green Wave (Active)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "var(--neon-cyan)" }}></div><span>BRT Priority (Active)</span></div>
                            </>
                        ) : (
                            <>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "rgba(14, 165, 233, 0.8)" }}></div><span>Well Insulated (&lt; 55 W/m²)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "rgba(16, 185, 129, 0.8)" }}></div><span>Efficient (55-90 W/m²)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "rgba(245, 158, 11, 0.8)" }}></div><span>Nominal (90-130 W/m²)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "rgba(249, 115, 22, 0.8)" }}></div><span>Elevated (130-185 W/m²)</span></div>
                                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: "rgba(244, 63, 94, 0.8)" }}></div><span>Heat Leak (&gt; 185 W/m²)</span></div>
                            </>
                        )}
                    </div>
                </div>

                <div className="map-district-badge">NURZHOL SECTOR A · ASTANA</div>
            </div>
            <div className="panel-footer">
                <span>VISUAL ENGINE: VECTOR LAYERS WITH STREET CORRIDORS</span>
                <span>ZOOM: 100% (CLICKABLE)</span>
            </div>
        </section>
    );
}

export default CityMap;
