// ==========================================
// HIGH-LEVEL DATA MODELS & CONFIG
// ==========================================

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

// ==========================================
// CENTRAL SYSTEM STATE CONTROLLER
// ==========================================
class CitySystemState {
    constructor() {
        this.currentMode = "traffic";
        this.weather = "Sunny";
        this.timeOfDay = "18:30";
        this.density = 2; // 1: Low, 2: Normal, 3: High
        this.congestionRate = 35;
        this.avgSpeed = 48.2;
        this.collisionActive = false;

        this.selectedBuilding = null;
        this.selectedInsulationThickness = 50;

        this.appliedAdjustments = [];
        this.packetCount = 0;
        this.co2Ppm = 410.0;
        this.facadeHeatLoss = 95.0;
        this.ambientTemp = 30.0;
        this.districtId = "nurzhol_sector_A";

        // Gemini API key — persisted in localStorage
        this.geminiApiKey = localStorage.getItem("gemini_api_key") || "";

        this.roads = BASE_ROADS.map(r => ({ ...r }));
        this.buildings = BASE_BUILDINGS.map(b => ({ ...b }));
        this.cars = [];
        this.speedHistory = [52, 54, 50, 48, 52, 55, 53, 51, 49, 48];

        // Chat history for context-aware responses
        this.trafficChatHistory = [];
        this.thermoChatHistory = [];

        this.initCars();
    }

    initCars() {
        this.cars = [];
        for (let i = 0; i < 50; i++) {
            const road = this.roads[Math.floor(Math.random() * this.roads.length)];
            this.cars.push({
                roadId: road.id,
                pos: Math.random(),
                dir: Math.random() > 0.5 ? 1 : -1,
                speed: 0.8 + Math.random() * 0.4,
                color: `hsl(${Math.random() * 30 + 180}, 80%, 70%)`
            });
        }
    }

    updateTelemetryStats() {
        const activeSpeeds = this.roads.map(r => r.currentSpeed);
        this.avgSpeed = activeSpeeds.reduce((a, b) => a + b, 0) / activeSpeeds.length;
        const baseAvg = this.roads.reduce((a, b) => a + b.baseSpeed, 0) / this.roads.length;
        this.congestionRate = Math.max(0, Math.round((1 - (this.avgSpeed / baseAvg)) * 100));

        if (Math.random() > 0.82) {
            this.speedHistory.push(parseFloat(this.avgSpeed.toFixed(1)));
            if (this.speedHistory.length > 20) this.speedHistory.shift();
        }
    }

    reset() {
        this.collisionActive = false;
        this.appliedAdjustments = [];
        this.roads = BASE_ROADS.map(r => ({ ...r }));
        this.buildings = BASE_BUILDINGS.map(b => ({ ...b }));
        this.initCars();
        this.updateTelemetryStats();
    }
}

// ==========================================
// VECTOR CANVAS RENDERER
// ==========================================
class MapRenderer {
    constructor(canvasId, state) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.state = state;
        this.resize();
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const scaleX = this.canvas.width / 640;
        const scaleY = this.canvas.height / 480;

        // 1. Background Grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.018)";
        ctx.lineWidth = 1;
        const gridSize = 30;
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
        }

        // 2. Buildings
        this.state.buildings.forEach(b => {
            const bx = b.x * scaleX;
            const by = b.y * scaleY;
            const bw = b.w * scaleX;
            const bh = b.h * scaleY;

            ctx.beginPath();
            ctx.rect(bx, by, bw, bh);

            if (this.state.currentMode === "traffic") {
                ctx.fillStyle = "#141420";
                ctx.strokeStyle = "#1e1e2e";
                ctx.lineWidth = 1.5;
                ctx.fill();
                ctx.stroke();

                // Small window grid pattern
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
                // Thermographic color heatmap
                let heatCol = "#f50057";
                if (b.currentLoss < 55)       heatCol = "#0055ff";
                else if (b.currentLoss < 90)  heatCol = "#00e5ff";
                else if (b.currentLoss < 130) heatCol = "#ffff00";
                else if (b.currentLoss < 185) heatCol = "#ff9100";

                // Glow effect for hot buildings
                if (b.currentLoss > 185) {
                    ctx.shadowColor = "#f50057";
                    ctx.shadowBlur = 10;
                }
                ctx.fillStyle = heatCol;
                ctx.fill();
                ctx.shadowBlur = 0;

                if (this.state.selectedBuilding && this.state.selectedBuilding.id === b.id) {
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 3;
                } else {
                    ctx.strokeStyle = "rgba(0,0,0,0.6)";
                    ctx.lineWidth = 1.5;
                }
                ctx.stroke();
            }

            // Building ID label
            ctx.fillStyle = this.state.currentMode === "traffic" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.7)";
            ctx.font = `bold ${Math.max(8, Math.round(8.5 * scaleX))}px 'JetBrains Mono'`;
            ctx.fillText(b.id, bx + 5, by + 16);
        });

        // 3. Roads
        this.state.roads.forEach(r => {
            const rx1 = r.x1 * scaleX;
            const ry1 = r.y1 * scaleY;
            const rx2 = r.x2 * scaleX;
            const ry2 = r.y2 * scaleY;

            if (this.state.currentMode === "traffic") {
                // Road shadow/underlay
                ctx.beginPath();
                ctx.moveTo(rx1, ry1);
                ctx.lineTo(rx2, ry2);
                ctx.strokeStyle = "rgba(0,0,0,0.8)";
                ctx.lineWidth = 18;
                ctx.stroke();

                // Speed-colored road surface
                let rCol = "#39ff14";
                if (r.currentSpeed < 30)      rCol = "#f50057";
                else if (r.currentSpeed < 45) rCol = "#ff9100";
                else if (r.currentSpeed < 55) rCol = "#f8e71c";

                ctx.beginPath();
                ctx.moveTo(rx1, ry1);
                ctx.lineTo(rx2, ry2);
                ctx.strokeStyle = rCol;
                ctx.lineWidth = 12;
                ctx.setLineDash([]);
                ctx.stroke();

                // Road centerline
                ctx.beginPath();
                ctx.moveTo(rx1, ry1);
                ctx.lineTo(rx2, ry2);
                ctx.strokeStyle = "rgba(255,255,255,0.08)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([8, 10]);
                ctx.stroke();
                ctx.setLineDash([]);

                // AI overlay
                const activeAdj = this.state.appliedAdjustments.find(a => a.roadId === r.id);
                if (activeAdj) {
                    this.drawAIAdjustmentOverlay(r, rx1, ry1, rx2, ry2, activeAdj.action);
                }
            } else {
                ctx.beginPath();
                ctx.moveTo(rx1, ry1);
                ctx.lineTo(rx2, ry2);
                ctx.strokeStyle = "#151520";
                ctx.lineWidth = 10;
                ctx.stroke();
            }

            // Street name labels
            this.drawStreetLabel(r, rx1, ry1, rx2, ry2);
        });

        // 4. Intersection nodes (traffic mode)
        if (this.state.currentMode === "traffic") {
            INTERSECTIONS.forEach(intNode => {
                const ix = intNode.x * scaleX;
                const iy = intNode.y * scaleY;

                // Outer ring
                ctx.beginPath();
                ctx.arc(ix, iy, 10, 0, 2 * Math.PI);
                ctx.fillStyle = "#000";
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.3)";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Signal dot
                ctx.beginPath();
                ctx.arc(ix, iy, 4.5, 0, 2 * Math.PI);
                const pulse = (Date.now() / 380) % 3;
                ctx.fillStyle = pulse < 1.3 ? "#39ff14" : pulse < 1.7 ? "#f8e71c" : "#f50057";
                ctx.fill();

                // AI pulse ring
                if (this.state.appliedAdjustments.length > 0) {
                    const r = 13 + Math.sin(Date.now() / 130) * 3;
                    ctx.beginPath();
                    ctx.arc(ix, iy, r, 0, 2 * Math.PI);
                    ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            });
        }

        // 5. Cars (traffic mode)
        if (this.state.currentMode === "traffic") {
            this.state.cars.forEach(car => {
                const road = this.state.roads.find(r => r.id === car.roadId);
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

                // Car body
                ctx.fillStyle = car.color;
                ctx.fillRect(cx - 4, cy - 3, 8, 6);
                ctx.strokeStyle = "rgba(0,0,0,0.5)";
                ctx.lineWidth = 1;
                ctx.strokeRect(cx - 4, cy - 3, 8, 6);

                // Emergency strobe
                const isEmergencyRoad = this.state.appliedAdjustments.some(a => a.roadId === road.id && a.action === "EMERGENCY_CORRIDOR");
                if (isEmergencyRoad && Math.random() > 0.5) {
                    ctx.fillStyle = Math.random() > 0.5 ? "var(--neon-cyan)" : "var(--neon-magenta)";
                    ctx.fillRect(cx - 2, cy - 2, 4, 4);
                }
            });
        }
    }

    // AI road overlay effects
    drawAIAdjustmentOverlay(road, rx1, ry1, rx2, ry2, action) {
        const ctx = this.ctx;
        ctx.save();

        if (action === "GREEN_WAVE") {
            ctx.beginPath();
            ctx.moveTo(rx1, ry1);
            ctx.lineTo(rx2, ry2);
            ctx.strokeStyle = "rgba(57, 255, 20, 0.9)";
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 12]);
            ctx.lineDashOffset = -Date.now() / 20;
            ctx.stroke();
        } else if (action === "EMERGENCY_CORRIDOR") {
            const dx = rx2 - rx1, dy = ry2 - ry1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = (-dy / len) * 9, ny = (dx / len) * 9;
            ctx.lineWidth = 2;
            const strobe = Math.floor(Date.now() / 120) % 2 === 0;

            ctx.beginPath();
            ctx.moveTo(rx1 + nx, ry1 + ny);
            ctx.lineTo(rx2 + nx, ry2 + ny);
            ctx.strokeStyle = strobe ? "#f50057" : "#00e5ff";
            ctx.setLineDash([]);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(rx1 - nx, ry1 - ny);
            ctx.lineTo(rx2 - nx, ry2 - ny);
            ctx.strokeStyle = strobe ? "#00e5ff" : "#f50057";
            ctx.stroke();
        } else if (action === "BUS_PRIORITY") {
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

    // Street name labels parallel to roads
    drawStreetLabel(road, rx1, ry1, rx2, ry2) {
        const ctx = this.ctx;
        ctx.save();
        ctx.setLineDash([]);

        const midX = (rx1 + rx2) / 2;
        const midY = (ry1 + ry2) / 2;
        const dx = rx2 - rx1, dy = ry2 - ry1;
        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

        ctx.translate(midX, midY);
        ctx.rotate(angle);

        const text = road.name.toUpperCase();
        ctx.font = "bold 8px 'JetBrains Mono'";
        const tw = ctx.measureText(text).width;

        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(-tw / 2 - 5, -8, tw + 10, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-tw / 2 - 5, -8, tw + 10, 16);

        const isActive = this.state.appliedAdjustments.some(a => a.roadId === road.id);
        ctx.fillStyle = isActive ? "#f8e71c" : "rgba(255,255,255,0.75)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }
}

// ==========================================
// AI SERVICE (FastAPI backend proxy)
// ==========================================
class AIService {
    static async runAudit(state, onProgress, onComplete) {
        const telemetrySnapshot = {
            city: "Astana",
            district_id: state.districtId || "nurzhol_sector_A",
            metrics: {
                traffic_speed_kmh: state.avgSpeed,
                congestion_index: state.congestionRate,
                air_quality_co2_ppm: state.co2Ppm,
                facade_heat_loss_w_m2: state.facadeHeatLoss,
                ambient_temp_c: state.ambientTemp
            }
        };

        onProgress("[CONNECTING TO FASTAPI CORE AI AGENT MODULE...]");
        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-gemini-key": state.geminiApiKey
                },
                body: JSON.stringify(telemetrySnapshot)
            });

            if (!response.ok) throw new Error(`Server HTTP ${response.status}`);
            const result = await response.json();
            onComplete(result);
        } catch (err) {
            console.error("FastAPI AI Proxy failure:", err);
            onProgress(`[AI MODULE OFFLINE: ${err.message}. RUNNING LOCAL MODEL...]`);
            setTimeout(() => onComplete(AIService.runLocalAI(state)), 400);
        }
    }

    static async runThermoAudit(state, onProgress, onComplete) {
        const bldg = state.selectedBuilding;
        if (!bldg) return;

        const calculatedReduction = Math.round(((bldg.h0 - bldg.currentLoss) / bldg.h0) * 100);
        const payload = {
            building_id: bldg.id,
            name: bldg.name,
            age: bldg.age,
            current_loss_wm2: bldg.h0,
            insulation_type: bldg.insulation,
            target_thickness_mm: state.selectedInsulationThickness,
            calculated_reduction_percent: calculatedReduction
        };

        onProgress("[CONNECTING TO FASTAPI THERMO AI AGENT MODULE...]");
        try {
            const response = await fetch("/api/analyze-thermo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-gemini-key": state.geminiApiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server HTTP ${response.status}`);
            const result = await response.json();
            onComplete(result);
        } catch (err) {
            console.error("FastAPI Thermo AI Proxy failure:", err);
            onProgress(`[AI MODULE OFFLINE: ${err.message}. RUNNING LOCAL MODEL...]`);
            setTimeout(() => onComplete(AIService.runLocalThermoAI(payload)), 400);
        }
    }

    /**
     * AI CHAT — routes through FastAPI /api/chat which saves to SQLite DB
     * Falls back gracefully if server unavailable
     */
    static async runChat(userMessage, context, mode, apiKey, sessionId = "default") {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-gemini-key": apiKey
            },
            body: JSON.stringify({
                message: userMessage,
                mode: mode,
                session_id: sessionId,
                context: context
            })
        });
        if (!response.ok) throw new Error(`Chat API error: ${response.status}`);
        const data = await response.json();
        return data.reply;
    }

    // Local fallback AI for traffic
    static runLocalAI(state) {
        let analysis = `[Local AI] Телеметрия дорожной сети зафиксирована. Плотность: ${state.density === 1 ? 'низкая' : state.density === 2 ? 'номинальная' : 'высокая (час пик)'}. `;
        let recommendations = "Светофорная регулировка в штатном режиме.";
        let adjustments = [];
        let travelTimeReduction = 5, co2Reduction = 3, avgSpeedIncrease = 4;

        if (state.collisionActive) {
            analysis += "Критическое ДТП на Kabanbay Batyr Ave (R2). Скорость снижена до 6 км/ч.";
            recommendations = "Развернуть аварийный зеленый коридор на Turan Avenue и активировать зеленый сигнал на Kabanbay.";
            adjustments = [
                { roadId: "R2", action: "EMERGENCY_CORRIDOR", direction: "East-West", duration: 30, reason: "Аварийный коридор ДТП" },
                { roadId: "R1", action: "GREEN_WAVE", direction: "East-West", duration: 20, reason: "Зеленая волна обхода" }
            ];
            travelTimeReduction = 28; co2Reduction = 16; avgSpeedIncrease = 18;
        } else if (state.density === 3) {
            analysis += "Пиковая городская нагрузка на перекрестках Kunayev St и Syganak St.";
            recommendations = "Синхронизировать фазы зеленой волны по Turan и Mangilik El. BRT приоритет на Dostyk.";
            adjustments = [
                { roadId: "R1", action: "GREEN_WAVE", direction: "East-West", duration: 15, reason: "Зеленая волна Turan Ave" },
                { roadId: "R3", action: "GREEN_WAVE", direction: "East-West", duration: 15, reason: "Зеленая волна Mangilik El" },
                { roadId: "R5", action: "BUS_PRIORITY", direction: "North-South", duration: 10, reason: "BRT приоритет Dostyk St" }
            ];
            travelTimeReduction = 19; co2Reduction = 12; avgSpeedIncrease = 15;
        } else if (state.co2Ppm > 700) {
            analysis += `Критическое накопление CO₂ (${state.co2Ppm.toFixed(0)} PPM). Скорость снижена до ${state.avgSpeed.toFixed(0)} км/ч.`;
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

    // Local fallback AI for thermals
    static runLocalThermoAI(payload) {
        const saved_wm2 = payload.current_loss_wm2 * (payload.calculated_reduction_percent / 100.0);
        const co2_saved = Math.round(saved_wm2 * 0.045 * 10) / 10;
        const savings_kzt = Math.round(saved_wm2 * 2300);

        const analysis = `[Local AI] Теплотехнический аудит здания ${payload.name} (${payload.age} г.). Теплопотери ${payload.current_loss_wm2} Вт/м² указывают на устаревший тепловой контур (${payload.insulation}).`;
        const recommendations = `Монтаж фасадного утеплителя толщиной ${payload.target_thickness_mm} мм. Рекомендуются плиты базальтовой ваты высокой плотности (от 110 кг/м³) или негорючие вентилируемые фасады для климата Астаны.`;

        return { analysis, recommendations, kpi: { annualCo2ReductionTons: co2_saved, annualCostSavingKzt: savings_kzt } };
    }
}

// ==========================================
// DATABASE MANAGER
// Polls /api/history/* and /api/db/stats
// Renders into DB Monitor panel tabs
// Stack: SQLite · Pandas · Python
// ==========================================
class DatabaseManager {
    constructor() {
        this.activeTab = "traffic";
        this.activeChatMode = "traffic";
        this.sessionId = this._getOrCreateSession();
        this._setupTabs();
        this._setupChatFilter();
        this.refresh();
        // Auto-refresh every 5 seconds
        setInterval(() => this.refresh(), 5000);
    }

    _getOrCreateSession() {
        let sid = localStorage.getItem("kha_session_id");
        if (!sid) {
            sid = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            localStorage.setItem("kha_session_id", sid);
        }
        return sid;
    }

    _setupTabs() {
        document.querySelectorAll(".db-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".db-tab").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".db-tab-content").forEach(p => {
                    p.classList.remove("active");
                    p.classList.add("hidden");
                });
                btn.classList.add("active");
                this.activeTab = btn.dataset.dbtab;
                const pane = document.getElementById("dbPane" + this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1));
                if (pane) {
                    pane.classList.remove("hidden");
                    pane.classList.add("active");
                }
                if (this.activeTab === "chat") this.renderChatHistory();
                if (this.activeTab === "analytics") this.renderAnalytics();
            });
        });
    }

    _setupChatFilter() {
        document.querySelectorAll(".db-filter-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".db-filter-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.activeChatMode = btn.dataset.chatmode;
                this.renderChatHistory();
            });
        });
    }

    async refresh() {
        try {
            await Promise.all([
                this.refreshStats(),
                this.activeTab === "traffic" ? this.refreshTrafficTable() :
                this.activeTab === "thermo"  ? this.refreshThermoTable() :
                this.activeTab === "chat"    ? this.renderChatHistory() :
                this.activeTab === "analytics" ? this.renderAnalytics() : Promise.resolve()
            ]);
            const el = document.getElementById("dbLastRefresh");
            if (el) el.textContent = "Last refresh: " + new Date().toLocaleTimeString("en-GB", { hour12: false });
        } catch (e) {
            console.warn("DB refresh error:", e);
        }
    }

    async refreshStats() {
        try {
            const r = await fetch("/api/db/stats");
            if (!r.ok) return;
            const stats = await r.json();
            const el = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
            el("dbChipTraffic", "TRAFFIC: " + (stats.traffic_logs || 0));
            el("dbChipThermo",  "THERMO: "  + (stats.thermo_logs  || 0));
            el("dbChipChat",    "CHAT: "    + (stats.chat_history || 0));

            // Cache for analytics
            this._stats = stats;
        } catch(e) { /* server not ready */ }
    }

    async refreshTrafficTable() {
        try {
            const r = await fetch("/api/history/traffic?limit=30");
            if (!r.ok) return;
            const data = await r.json();
            const tbody = document.getElementById("trafficDbBody");
            if (!tbody) return;

            if (!data.records || data.records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="db-empty">No traffic records yet. Twin simulator will populate shortly…</td></tr>';
                return;
            }

            tbody.innerHTML = data.records.map((row, i) => {
                const ts = row.ts ? row.ts.replace("T", " ").replace("Z", "") : "--";
                const anomaly = row.is_anomaly
                    ? '<td class="anomaly-yes">⚠️ YES</td>'
                    : '<td class="anomaly-no">✅ NO</td>';
                return `<tr>
                    <td>${row.id}</td>
                    <td>${ts.slice(11, 19)}</td>
                    <td>${(row.traffic_speed || 0).toFixed(1)}</td>
                    <td>${(row.congestion_index || 0).toFixed(0)}%</td>
                    <td>${(row.co2_ppm || 0).toFixed(0)}</td>
                    <td>${(row.heat_loss_wm2 || 0).toFixed(0)}</td>
                    ${anomaly}
                </tr>`;
            }).join("");
        } catch(e) { /* server not ready */ }
    }

    async refreshThermoTable() {
        try {
            const r = await fetch("/api/history/thermo?limit=20");
            if (!r.ok) return;
            const data = await r.json();
            const tbody = document.getElementById("thermoDbBody");
            if (!tbody) return;

            if (!data.records || data.records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="db-empty">No thermo audits yet — click a building &amp; run AI audit.</td></tr>';
                return;
            }

            tbody.innerHTML = data.records.map(row => {
                const ts = row.ts ? row.ts.slice(11, 19) : "--";
                const bname = (row.building_name || "?").slice(0, 18);
                return `<tr>
                    <td>${row.id}</td>
                    <td>${ts}</td>
                    <td title="${row.building_name || ''}">${bname}</td>
                    <td>${(row.base_heat_loss_wm2 || 0).toFixed(0)}</td>
                    <td>${row.insulation_thickness_mm || 0}</td>
                    <td>${row.reduction_percent || 0}%</td>
                    <td>${(row.annual_co2_tons || 0).toFixed(1)} t</td>
                    <td>${(row.annual_savings_kzt || 0).toLocaleString()}</td>
                </tr>`;
            }).join("");
        } catch(e) { /* server not ready */ }
    }

    async renderChatHistory() {
        try {
            const r = await fetch(`/api/history/chat?session_id=${this.sessionId}&mode=${this.activeChatMode}&limit=40`);
            if (!r.ok) return;
            const data = await r.json();
            const log = document.getElementById("dbChatHistoryLog");
            if (!log) return;

            if (!data.records || data.records.length === 0) {
                log.innerHTML = '<div class="db-empty">No chat history yet for this session. Start chatting with the AI!</div>';
                return;
            }

            log.innerHTML = data.records.map(row => {
                const ts = row.ts ? row.ts.slice(11, 19) : "";
                const isUser = row.role === "user";
                const isThermo = this.activeChatMode === "thermo";
                const cls = isUser ? "db-user" : (isThermo ? "db-ai-thermo" : "db-ai");
                const icon = isUser ? "👤" : (isThermo ? "🔥" : "🚦");
                const content = (row.content || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                return `<div class="db-hist-msg ${cls}">
                    <span class="db-hist-ts">[${ts}] ${icon}</span>${content}
                </div>`;
            }).join("");

            log.scrollTop = log.scrollHeight;
        } catch(e) { /* server not ready */ }
    }

    renderAnalytics() {
        if (!this._stats) return;
        const ta = this._stats.traffic_analytics || {};
        const el = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
        el("analyticsAvgSpeed",    ta.avg_speed_100  != null ? ta.avg_speed_100.toFixed(1) + " km/h" : "--");
        el("analyticsAvgCong",     ta.avg_congestion != null ? ta.avg_congestion.toFixed(1) + "%" : "--");
        el("analyticsAvgCo2",      ta.avg_co2        != null ? ta.avg_co2.toFixed(0) + " ppm" : "--");
        el("analyticsMaxCo2",      ta.max_co2        != null ? ta.max_co2.toFixed(0) + " ppm" : "--");
        el("analyticsMinSpeed",    ta.min_speed      != null ? ta.min_speed.toFixed(1) + " km/h" : "--");
        el("analyticsTotalTraffic", (this._stats.traffic_logs || 0).toLocaleString());
    }

    // Called by chat functions to pass sessionId
    getSessionId() { return this.sessionId; }
}

// ==========================================
// TYPEWRITER (thread-safe, no garbling)
// ==========================================
function typewrite(text, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    // Direct set — no character-by-character to avoid encoding issues
    el.textContent = text;
    el.scrollTop = el.scrollHeight;
}

// ==========================================
// CHAT PANEL HELPERS
// ==========================================
function appendChatMsg(logId, text, type) {
    const log = document.getElementById(logId);
    if (!log) return;
    const msg = document.createElement("div");
    msg.className = `chat-msg ${type}`;
    msg.textContent = text;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
}

function removeChatMsg(logId, el) {
    const log = document.getElementById(logId);
    if (log && el && log.contains(el)) log.removeChild(el);
}

// ==========================================
// WEBSOCKET REAL IoT HARDWARE LISTENER
// ==========================================
function connectWebSocket(state, onAiTrigger) {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        document.getElementById("routerStatus").textContent = "FASTAPI: WS CONNECTED";
        document.getElementById("routerStatus").style.color = "var(--neon-green)";
    };

    socket.onclose = () => {
        document.getElementById("routerStatus").textContent = "FASTAPI: RECONNECTING";
        document.getElementById("routerStatus").style.color = "var(--neon-orange)";
        setTimeout(() => connectWebSocket(state, onAiTrigger), 4000);
    };

    socket.onerror = (err) => console.error("WebSocket error:", err);

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.source === "twin_simulator" && data.type === "twin_telemetry") {
                // Update live state
                state.avgSpeed      = data.metrics.traffic_speed_kmh;
                state.congestionRate = data.metrics.congestion_index;
                state.co2Ppm        = data.metrics.air_quality_co2_ppm;
                state.facadeHeatLoss = data.metrics.facade_heat_loss_w_m2;
                state.ambientTemp    = data.metrics.ambient_temp_c;

                // Update UI widgets
                document.getElementById("congestionRate").textContent = Math.round(state.congestionRate) + "%";
                document.getElementById("avgSpeed").textContent = state.avgSpeed.toFixed(1);
                document.getElementById("co2Level").textContent = Math.round(state.co2Ppm);

                const heatDev = (state.facadeHeatLoss - 100.0) * 0.05;
                document.getElementById("heatLossDev").textContent = (heatDev >= 0 ? "+" : "") + heatDev.toFixed(1) + "°C";

                // ML Anomaly Banner
                if (data.ml_analysis) {
                    const ml = data.ml_analysis;
                    const statusEl = document.getElementById("mlAnomalyStatus");
                    const scoreEl  = document.getElementById("mlAnomalyScore");
                    const bannerEl = document.getElementById("mlAnomalyBanner");

                    if (statusEl && scoreEl && bannerEl) {
                        scoreEl.textContent = `SCORE: ${ml.anomaly_score.toFixed(3)}`;
                        if (ml.is_anomaly) {
                            statusEl.textContent = `⚠️ ANOMALY DETECTED (${ml.confidence_pct}% CONFIDENCE)`;
                            statusEl.className = "anomaly-status text-red";
                            bannerEl.style.borderColor = "var(--neon-magenta)";
                            bannerEl.style.backgroundColor = "rgba(245, 0, 87, 0.08)";
                        } else {
                            statusEl.textContent = "NOMINAL (NO ANOMALY)";
                            statusEl.className = "anomaly-status text-green";
                            bannerEl.style.borderColor = "#1a1a24";
                            bannerEl.style.backgroundColor = "rgba(0,0,0,0.5)";
                        }
                    }
                }

                // Update road speeds from twin data
                state.roads.forEach(r => {
                    const factor = (r.id === "R2" || r.id === "R4") ? 0.75 : 1.15;
                    r.currentSpeed = Math.min(r.baseSpeed, Math.round(state.avgSpeed * factor));
                });

                // Update Keruen City Mall's thermal from twin data
                const keruen = state.buildings.find(b => b.id === "B1");
                if (keruen) {
                    keruen.currentLoss = state.facadeHeatLoss;
                    if (state.selectedBuilding && state.selectedBuilding.id === "B1") {
                        window.__syncThermoSidebar && window.__syncThermoSidebar();
                    }
                }

                if (data.ai_trigger && typeof onAiTrigger === "function") {
                    onAiTrigger();
                }

                // Stream log
                addStreamLine("astana", `<span class="timestamp">[${now()}]</span><b style="color:var(--neon-cyan)">[ASTANA TWIN]</b> speed=${state.avgSpeed.toFixed(1)} co2=${state.co2Ppm.toFixed(0)} anomaly=${data.ml_analysis?.is_anomaly ? '⚠️' : '✅'}`);
            }

            if (data.source === "physical_hardware" && data.type === "esp32_telemetry") {
                document.getElementById("iotNodeBadge").textContent = "PHYSICAL NODE ACTIVE";
                document.getElementById("iotNodeBadge").style.backgroundColor = "var(--neon-green)";
                document.getElementById("iotNodeBadge").style.color = "#000";
                document.getElementById("iotNodeAddr").textContent = "CONNECTED (WS)";
                document.getElementById("iotNodeId").textContent = data.node_id;

                const sensors = data.payload;
                document.getElementById("regGpio14").textContent = `${sensors.distance_sensor.toFixed(1)} cm`;
                document.getElementById("regAdc1").textContent = `${sensors.temperature.toFixed(1)} °C`;

                const r2 = state.roads.find(r => r.id === "R2");
                if (r2) r2.currentSpeed = Math.round(sensors.calculated_speed);

                const keruen = state.buildings.find(b => b.id === "B1");
                if (keruen && sensors.temperature > 0) {
                    keruen.h0 = Math.round(sensors.temperature * 8.5);
                    if (state.selectedBuilding && state.selectedBuilding.id === "B1") {
                        window.__syncThermoSidebar && window.__syncThermoSidebar();
                    }
                }

                addStreamLine("traffic", `<span class="timestamp">[${now()}]</span><b style="color:var(--neon-green)">[ESP32]</b> node=${data.node_id} dist=${sensors.distance_sensor.toFixed(0)}cm temp=${sensors.temperature.toFixed(1)}°C`);
            }
        } catch (e) {
            console.error("Error routing hardware packet:", e);
        }
    };
}

function now() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function addStreamLine(cls, html) {
    const line = document.createElement("div");
    line.className = `stream-line ${cls}`;
    line.innerHTML = html;
    const logConsole = document.getElementById("streamLogConsole");
    if (!logConsole) return;
    logConsole.appendChild(line);
    while (logConsole.children.length > 12) logConsole.removeChild(logConsole.firstChild);
    logConsole.scrollTop = logConsole.scrollHeight;
}

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const state = new CitySystemState();
    const renderer = new MapRenderer("cityMapCanvas", state);

    connectWebSocket(state, () => {
        const btn = document.getElementById("runAiBtn");
        if (btn && !btn.disabled) triggerAiAudit();
    });

    // ── API KEY MANAGEMENT ──
    const keyInput     = document.getElementById("geminiApiKey");
    const saveKeyBtn   = document.getElementById("saveKeyBtn");
    const clearKeyBtn  = document.getElementById("clearKeyBtn");
    const keyStatusMsg = document.getElementById("keyStatusMsg");
    const aiEngineBadge = document.getElementById("aiEngineBadge");

    function updateKeyUI() {
        const thermoBadge = document.getElementById("thermoAiEngineBadge");
        if (state.geminiApiKey) {
            keyInput.value = state.geminiApiKey;
            clearKeyBtn.classList.remove("hidden");
            keyStatusMsg.textContent = "✅ Gemini API Key active — LLM engine enabled.";
            keyStatusMsg.style.color = "var(--neon-green)";
            aiEngineBadge.textContent = "GEMINI LLM";
            aiEngineBadge.style.backgroundColor = "var(--neon-cyan)";
            aiEngineBadge.style.color = "#000";
            if (thermoBadge) {
                thermoBadge.textContent = "GEMINI LLM";
                thermoBadge.style.backgroundColor = "var(--neon-cyan)";
                thermoBadge.style.color = "#000";
            }
        } else {
            keyInput.value = "";
            clearKeyBtn.classList.add("hidden");
            keyStatusMsg.textContent = "Running in Local fallback mode (No Key)";
            keyStatusMsg.style.color = "var(--text-muted)";
            aiEngineBadge.textContent = "LOCAL AI";
            aiEngineBadge.style.backgroundColor = "var(--neon-orange)";
            aiEngineBadge.style.color = "#000";
            if (thermoBadge) {
                thermoBadge.textContent = "LOCAL AI";
                thermoBadge.style.backgroundColor = "var(--neon-orange)";
                thermoBadge.style.color = "#000";
            }
        }
    }
    updateKeyUI();

    saveKeyBtn.addEventListener("click", () => {
        const key = keyInput.value.trim();
        if (key) {
            state.geminiApiKey = key;
            localStorage.setItem("gemini_api_key", key);
            updateKeyUI();
        }
    });

    clearKeyBtn.addEventListener("click", () => {
        state.geminiApiKey = "";
        localStorage.removeItem("gemini_api_key");
        updateKeyUI();
    });

    // Enter key saves API key
    keyInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveKeyBtn.click();
    });

    // ── MODE TOGGLE ──
    document.getElementById("modeToggleGroup").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn || btn.classList.contains("active")) return;

        document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.currentMode = btn.getAttribute("data-mode");

        if (state.currentMode === "traffic") {
            document.getElementById("mapPanelTitle").textContent = "CITY ROADWAY LAYER (TRAFFIC FLOW)";
            document.getElementById("trafficWidgets").classList.remove("hidden");
            document.getElementById("thermoWidgets").classList.add("hidden");
        } else {
            document.getElementById("mapPanelTitle").textContent = "THERMAL DEVIATION HEATMAP (BUILDING CONTOURS)";
            document.getElementById("trafficWidgets").classList.add("hidden");
            document.getElementById("thermoWidgets").classList.remove("hidden");

            if (state.selectedBuilding) {
                syncThermoSidebar();
            } else {
                document.getElementById("bldgNoSelection").classList.remove("hidden");
                document.getElementById("bldgDetails").classList.add("hidden");
            }
        }
        updateLegend();
    });

    // ── FASTAPI STREAM PACKET DISPLAY ──
    setInterval(() => {
        state.packetCount++;
        const isTrafficType = Math.random() > 0.38;

        if (isTrafficType) {
            const r = state.roads[Math.floor(Math.random() * state.roads.length)];
            const pkt = { router: "FastAPI_Core", packet_id: state.packetCount, type: "traffic_data", data: { road_id: r.id, street: r.name, speed: r.currentSpeed, congestion: Math.round(100 - (r.currentSpeed / r.baseSpeed) * 100) } };
            addStreamLine("traffic", `<span class="timestamp">[${now()}]</span>${JSON.stringify(pkt)}`);
        } else {
            const b = state.buildings[Math.floor(Math.random() * state.buildings.length)];
            const pkt = { router: "FastAPI_Core", packet_id: state.packetCount, type: "thermo_data", data: { bldg_id: b.id, name: b.name, loss_wm2: Math.round(b.currentLoss), efficient: b.currentLoss < 100 } };
            addStreamLine("thermo", `<span class="timestamp">[${now()}]</span>${JSON.stringify(pkt)}`);
        }
    }, 700);

    // ── MAP MOUSE INTERACTIONS ──
    const mapCanvas = document.getElementById("cityMapCanvas");

    mapCanvas.addEventListener("mousemove", (e) => {
        const rect = mapCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const lat = (51.1601 + (240 - my) * 0.00003).toFixed(5);
        const lng = (71.4272 + (mx - 320) * 0.00005).toFixed(5);
        document.getElementById("mouseCoords").textContent = `LAT: ${lat} / LNG: ${lng}`;
    });

    mapCanvas.addEventListener("click", (e) => {
        if (state.currentMode !== "thermo") return;

        const rect = mapCanvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (640 / mapCanvas.width);
        const my = (e.clientY - rect.top) * (480 / mapCanvas.height);

        let clicked = null;
        for (const b of state.buildings) {
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
                clicked = b;
                break;
            }
        }

        if (clicked) {
            state.selectedBuilding = clicked;
            syncThermoSidebar();

            // Notify chat about building selection
            const thermoChatLog = document.getElementById("thermoChatLog");
            if (thermoChatLog) {
                appendChatMsg("thermoChatLog", `📌 Building selected: ${clicked.name} (${clicked.id}) — Heat loss: ${clicked.h0} W/m², Built: ${clicked.age}, Insulation: ${clicked.insulation}`, "ai-msg ai-msg-magenta");
            }
        }
    });

    // ── DISTURBANCE SLIDER ──
    const flowDist = document.getElementById("flowDisturbance");
    const distVal  = document.getElementById("disturbanceVal");

    function applyDisturbance() {
        const val = parseInt(flowDist.value);
        distVal.textContent = `${val}%`;
        state.roads.forEach(r => {
            if (state.collisionActive && r.id === "R2") return;
            const drop = (val / 100) * 0.6;
            r.currentSpeed = Math.round(r.baseSpeed * (1 - drop));
        });
    }
    flowDist.addEventListener("input", applyDisturbance);

    // ── COLLISION TRIGGER ──
    const collisionBtn = document.getElementById("triggerAccidentBtn");
    collisionBtn.addEventListener("click", () => {
        state.collisionActive = true;
        collisionBtn.disabled = true;
        collisionBtn.textContent = "⚠️ ROAD COLLISION DETECTED (CLEARING IN 12S)";
        collisionBtn.style.backgroundColor = "var(--neon-magenta)";
        collisionBtn.style.color = "#fff";

        const r2 = state.roads.find(r => r.id === "R2");
        if (r2) r2.currentSpeed = 5;

        addStreamLine("thermo", `<span class="timestamp">[${now()}]</span><b style="color:var(--neon-magenta)">[EMERGENCY]</b> {"router":"FastAPI_Emergency","alert":"COLLISION_ON_R2","severity":"CRITICAL"}`);

        document.getElementById("alertMarquee").textContent = "⚠️ EMERGENCY STATE: COLLISION DETECTED ON KABANBAY BATYR AVENUE ── FASTAPI SPLITTER REDIRECTING TRAFFIC ── ROUTING MAP OVERLAYS ACTIVE ──";
        document.getElementById("alertMarquee").parentElement.style.background = "var(--neon-magenta)";
        document.getElementById("alertMarquee").parentElement.style.color = "#ffffff";

        triggerAiAudit();

        setTimeout(() => {
            state.collisionActive = false;
            collisionBtn.disabled = false;
            collisionBtn.textContent = "TRIGGER SIMULATED ROAD COLLISION";
            collisionBtn.style.backgroundColor = "var(--neon-orange)";
            collisionBtn.style.color = "#000";
            applyDisturbance();
            document.getElementById("alertMarquee").textContent = "⚡ KHA-DIVERGENT SYSTEM BROADCAST: UNIFIED TELEMETRY DISPATCHING IN PROGRESS ── ESP32 PACKET BUFFER NORMAL ── REGULAR TRAFFIC FLOW ACTIVE ── MONITORED THERMAL CHANNELS: 147 OUTLETS ──";
            document.getElementById("alertMarquee").parentElement.style.background = "linear-gradient(90deg, var(--neon-cyan), #00bcd4, var(--neon-cyan))";
            document.getElementById("alertMarquee").parentElement.style.color = "#000";
        }, 12000);
    });

    // ── INSULATION SLIDER & THERMO SIDEBAR SYNC ──
    const insulationThick = document.getElementById("insulationThickness");
    const thickVal = document.getElementById("thicknessVal");

    function syncThermoSidebar() {
        const b = state.selectedBuilding;
        if (!b) return;

        document.getElementById("bldgNoSelection").classList.add("hidden");
        document.getElementById("bldgDetails").classList.remove("hidden");
        document.getElementById("bldgId").textContent = `${b.name.toUpperCase()} (#${b.id})`;

        const thickness = parseInt(insulationThick.value);
        thickVal.textContent = `${thickness} mm`;
        state.selectedInsulationThickness = thickness;

        const h0 = b.h0;
        const hNew = Math.round(h0 * (50 / (50 + thickness)));
        b.currentLoss = hNew;

        document.getElementById("heatLossVal").textContent = hNew;

        const reduction = Math.round(((h0 - hNew) / h0) * 100);
        document.getElementById("heatReductionPercent").textContent = `-${reduction}%`;

        const cost = 2800 + (140 * thickness);
        const annualSavings = (h0 - hNew) * 160;
        const years = annualSavings > 0 ? (cost / annualSavings).toFixed(1) : 0;
        document.getElementById("paybackYears").textContent = `${years} Years`;

        const rating = (loss) => {
            if (loss < 55)  return "A";
            if (loss < 90)  return "B";
            if (loss < 130) return "C";
            if (loss < 185) return "D";
            return "E";
        };

        const rate0 = rating(h0);
        const rateNew = rating(hNew);
        document.getElementById("energyClass").textContent = rate0;

        if (rateNew !== rate0 && thickness > 0) {
            document.getElementById("classUpgradeNotice").classList.remove("hidden");
            document.getElementById("upgradedClass").textContent = rateNew;
        } else {
            document.getElementById("classUpgradeNotice").classList.add("hidden");
        }
    }

    // Expose syncThermoSidebar globally for WebSocket handler
    window.__syncThermoSidebar = syncThermoSidebar;
    insulationThick.addEventListener("input", syncThermoSidebar);

    // ── AI TRAFFIC AUDIT ──
    const runAiBtn   = document.getElementById("runAiBtn");
    const termBody   = document.getElementById("aiResponseTerminal");

    async function triggerAiAudit() {
        runAiBtn.disabled = true;
        runAiBtn.textContent = "AI LOGISTIC CORE PROCESSING...";
        document.getElementById("aiTerminalStatus").textContent = "COMPUTING";

        await AIService.runAudit(state,
            (prog) => { termBody.textContent = prog; },
            (result) => {
                runAiBtn.disabled = false;
                runAiBtn.textContent = "⚡ RUN AI OPTIMIZATION AUDIT";
                document.getElementById("aiTerminalStatus").textContent = "ACTIVE";

                typewrite(result.analysis + "\n\n📋 RECOMMENDATIONS:\n" + result.recommendations, "aiResponseTerminal");

                state.appliedAdjustments = result.adjustments || [];

                const adjListUl = document.getElementById("activeAdjustmentsList");
                adjListUl.innerHTML = "";

                if (result.adjustments && result.adjustments.length > 0) {
                    result.adjustments.forEach(adj => {
                        const li = document.createElement("li");
                        const cls = adj.action === "EMERGENCY_CORRIDOR" ? "emergency-adj" : adj.action === "BUS_PRIORITY" ? "bus-adj" : "";
                        if (cls) li.className = cls;
                        li.innerHTML = `<span>${adj.reason} (<b>${adj.roadId}</b>)</span><span class="adj-badge">+${adj.duration}s</span>`;
                        adjListUl.appendChild(li);

                        const roadObj = state.roads.find(r => r.id === adj.roadId);
                        if (roadObj && (adj.action === "GREEN_WAVE" || adj.action === "EMERGENCY_CORRIDOR")) {
                            roadObj.currentSpeed = Math.min(roadObj.baseSpeed, roadObj.currentSpeed + 15);
                        }
                    });
                } else {
                    adjListUl.innerHTML = '<li class="empty-list-msg">No active adjustments. Timers nominal.</li>';
                }

                document.getElementById("kpiTravelReduction").textContent = `-${result.efficiencyMetrics.travelTimeReduction}%`;
                document.getElementById("kpiCo2Reduction").textContent = `-${result.efficiencyMetrics.co2Reduction}%`;
            }
        );
    }
    runAiBtn.addEventListener("click", triggerAiAudit);

    // ── AI THERMAL AUDIT ──
    const runThermoAiBtn = document.getElementById("runThermoAiBtn");

    async function triggerThermoAiAudit() {
        if (!state.selectedBuilding) {
            appendChatMsg("thermoChatLog", "⚠️ Please select a building on the map first.", "ai-msg ai-msg-magenta");
            return;
        }
        runThermoAiBtn.disabled = true;
        runThermoAiBtn.textContent = "AUDITING ENVELOPE CONTROLS...";
        document.getElementById("thermoAiTerminalStatus").textContent = "COMPUTING";

        await AIService.runThermoAudit(state,
            (prog) => { document.getElementById("thermoAiResponseTerminal").textContent = prog; },
            (result) => {
                runThermoAiBtn.disabled = false;
                runThermoAiBtn.textContent = "⚡ RUN AI BUILDING AUDIT";
                document.getElementById("thermoAiTerminalStatus").textContent = "ACTIVE";

                typewrite(result.analysis + "\n\n📋 THERMAL RECOMMENDATIONS:\n" + result.recommendations, "thermoAiResponseTerminal");

                document.getElementById("kpiThermoCo2").textContent = `${result.kpi.annualCo2ReductionTons.toFixed(1)} Tons`;
                document.getElementById("kpiThermoSavings").textContent = `${result.kpi.annualCostSavingKzt.toLocaleString()} KZT`;

                // Refresh DB thermo table
                if (window.__dbManager) window.__dbManager.refreshThermoTable();
            }
        );
    }

    if (runThermoAiBtn) runThermoAiBtn.addEventListener("click", triggerThermoAiAudit);

    // ──────────────────────────────
    // AI CHAT — TRAFFIC PANEL
    // Routes through /api/chat (saves to SQLite)
    // ──────────────────────────────
    const trafficChatInput   = document.getElementById("trafficChatInput");
    const trafficChatSendBtn = document.getElementById("trafficChatSendBtn");

    async function sendTrafficChat() {
        const msg = trafficChatInput.value.trim();
        if (!msg) return;
        trafficChatInput.value = "";

        appendChatMsg("trafficChatLog", msg, "user-msg");

        const context = {
            avgSpeed: state.avgSpeed,
            congestionRate: state.congestionRate,
            co2Ppm: state.co2Ppm,
            facadeHeatLoss: state.facadeHeatLoss,
            ambientTemp: state.ambientTemp,
            appliedAdjustments: state.appliedAdjustments
        };

        const loadingMsg = appendChatMsg("trafficChatLog", "⏳ Analyzing traffic data...", "chat-msg loading");
        trafficChatSendBtn.disabled = true;

        try {
            const sessionId = window.__dbManager ? window.__dbManager.getSessionId() : "default";
            const reply = await AIService.runChat(msg, context, "traffic", state.geminiApiKey, sessionId);
            removeChatMsg("trafficChatLog", loadingMsg);
            appendChatMsg("trafficChatLog", reply, "ai-msg");
            if (window.__dbManager) window.__dbManager.renderChatHistory();
        } catch (err) {
            removeChatMsg("trafficChatLog", loadingMsg);
            appendChatMsg("trafficChatLog", `[Local Fallback] ${getLocalTrafficReply(msg, state)}`, "ai-msg");
        }

        trafficChatSendBtn.disabled = false;
    }

    trafficChatSendBtn.addEventListener("click", sendTrafficChat);
    trafficChatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendTrafficChat(); });

    // ──────────────────────────────
    // AI CHAT — THERMO PANEL
    // Routes through /api/chat (saves to SQLite)
    // ──────────────────────────────
    const thermoChatInput   = document.getElementById("thermoChatInput");
    const thermoChatSendBtn = document.getElementById("thermoChatSendBtn");

    async function sendThermoChat() {
        const msg = thermoChatInput.value.trim();
        if (!msg) return;
        thermoChatInput.value = "";

        appendChatMsg("thermoChatLog", msg, "user-msg");

        const context = {
            selectedBuilding: state.selectedBuilding,
            avgSpeed: state.avgSpeed,
            co2Ppm: state.co2Ppm,
            ambientTemp: state.ambientTemp
        };

        const loadingMsg = appendChatMsg("thermoChatLog", "⏳ Analyzing building data...", "chat-msg loading");
        thermoChatSendBtn.disabled = true;

        try {
            const sessionId = window.__dbManager ? window.__dbManager.getSessionId() : "default";
            const reply = await AIService.runChat(msg, context, "thermo", state.geminiApiKey, sessionId);
            removeChatMsg("thermoChatLog", loadingMsg);
            appendChatMsg("thermoChatLog", reply, "ai-msg ai-msg-magenta");
            if (window.__dbManager) window.__dbManager.renderChatHistory();
        } catch (err) {
            removeChatMsg("thermoChatLog", loadingMsg);
            appendChatMsg("thermoChatLog", `[Local Fallback] ${getLocalThermoReply(msg, state)}`, "ai-msg ai-msg-magenta");
        }

        thermoChatSendBtn.disabled = false;
    }

    thermoChatSendBtn.addEventListener("click", sendThermoChat);
    thermoChatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendThermoChat(); });


    // ── LOCAL FALLBACK CHAT REPLIES ──
    function getLocalTrafficReply(msg, state) {
        const m = msg.toLowerCase();
        if (m.includes("congestion") || m.includes("пробка") || m.includes("traffic")) {
            return `Current congestion: ${state.congestionRate}%. ${state.congestionRate > 50 ? "High congestion — consider activating GREEN_WAVE on R1 (Turan Avenue)." : "Traffic is flowing normally."}`;
        }
        if (m.includes("co2") || m.includes("air") || m.includes("emission")) {
            return `CO₂ level: ${state.co2Ppm.toFixed(0)} PPM. ${state.co2Ppm > 600 ? "Elevated — recommend signal coordination on R2." : "Within acceptable range (<450 PPM nominal)."}`;
        }
        if (m.includes("speed") || m.includes("скорость")) {
            return `Average speed: ${state.avgSpeed.toFixed(1)} km/h across 6 monitored corridors (R1-R6 in Nurzhol Sector A).`;
        }
        return `Current system status: Speed ${state.avgSpeed.toFixed(1)} km/h, Congestion ${state.congestionRate}%, CO₂ ${state.co2Ppm.toFixed(0)} PPM. Add a Gemini API key for intelligent analysis.`;
    }

    function getLocalThermoReply(msg, state) {
        const b = state.selectedBuilding;
        const m = msg.toLowerCase();
        if (!b) return "Please select a building on the map to get thermal analysis.";
        if (m.includes("insulation") || m.includes("изоляция") || m.includes("утеплитель")) {
            return `For ${b.name} (${b.h0} W/m²): recommend basalt wool 120-150mm boards for Astana's -30°C climate. Current: ${b.insulation}.`;
        }
        if (m.includes("cost") || m.includes("savings") || m.includes("экономия")) {
            const savings = Math.round(b.h0 * 0.4 * 2300);
            return `Estimated savings for ${b.name}: ~${savings.toLocaleString()} KZT/year with 150mm insulation upgrade.`;
        }
        return `${b.name} (${b.id}): Heat loss ${b.h0} W/m², built ${b.age}, current insulation: ${b.insulation}. Add Gemini API key for detailed analysis.`;
    }

    // ── MAP LEGEND ──
    function updateLegend() {
        const container = document.getElementById("legendItems");
        container.innerHTML = "";
        const items = state.currentMode === "traffic" ? [
            { color: "var(--neon-green)",   label: "Smooth Flow (> 55 km/h)" },
            { color: "var(--neon-yellow)",  label: "Moderate (45-55 km/h)" },
            { color: "var(--neon-orange)",  label: "Slow (30-45 km/h)" },
            { color: "var(--neon-magenta)", label: "Congested (< 30 km/h)" },
            { color: "rgba(57,255,20,0.9)", label: "AI Green Wave (Active)" },
            { color: "var(--neon-cyan)",    label: "BRT Priority (Active)" }
        ] : [
            { color: "#0055ff", label: "Well Insulated (< 55 W/m²)" },
            { color: "#00e5ff", label: "Efficient (55-90 W/m²)" },
            { color: "#ffff00", label: "Nominal (90-130 W/m²)" },
            { color: "#ff9100", label: "Elevated (130-185 W/m²)" },
            { color: "#f50057", label: "Heat Leak (> 185 W/m²)" }
        ];
        items.forEach(item => {
            container.innerHTML += `<div class="legend-item"><div class="legend-color" style="background-color:${item.color}"></div><span>${item.label}</span></div>`;
        });
    }

    // ── SPEED CHART (Canvas Brutalist) ──
    function drawSpeedChart() {
        const c = document.getElementById("speedChartCanvas");
        if (!c) return;
        const chartCtx = c.getContext("2d");
        c.width = c.parentElement.clientWidth;
        c.height = c.parentElement.clientHeight;

        chartCtx.clearRect(0, 0, c.width, c.height);
        const pad = 14, w = c.width - pad * 2, h = c.height - pad * 2;

        // Grid lines
        chartCtx.strokeStyle = "#1a1a24";
        chartCtx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad + (h / 4) * i;
            chartCtx.beginPath(); chartCtx.moveTo(pad, y); chartCtx.lineTo(pad + w, y); chartCtx.stroke();
        }

        const maxLimit = 80;
        if (state.speedHistory.length < 2) return;

        // Area fill
        chartCtx.beginPath();
        state.speedHistory.forEach((s, i) => {
            const cx = pad + (i / (state.speedHistory.length - 1)) * w;
            const cy = pad + h - (s / maxLimit) * h;
            i === 0 ? chartCtx.moveTo(cx, cy) : chartCtx.lineTo(cx, cy);
        });
        chartCtx.lineTo(pad + w, pad + h);
        chartCtx.lineTo(pad, pad + h);
        chartCtx.closePath();
        chartCtx.fillStyle = "rgba(248, 231, 28, 0.06)";
        chartCtx.fill();

        // Line
        chartCtx.beginPath();
        chartCtx.strokeStyle = "var(--neon-yellow)";
        chartCtx.lineWidth = 2;
        state.speedHistory.forEach((s, i) => {
            const cx = pad + (i / (state.speedHistory.length - 1)) * w;
            const cy = pad + h - (s / maxLimit) * h;
            i === 0 ? chartCtx.moveTo(cx, cy) : chartCtx.lineTo(cx, cy);
        });
        chartCtx.stroke();

        // Last value dot
        const lastS = state.speedHistory[state.speedHistory.length - 1];
        const lastX = pad + w;
        const lastY = pad + h - (lastS / maxLimit) * h;
        chartCtx.beginPath();
        chartCtx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        chartCtx.fillStyle = "#fff";
        chartCtx.fill();

        // Labels
        chartCtx.fillStyle = "#555";
        chartCtx.font = "7px 'JetBrains Mono'";
        chartCtx.fillText(`${maxLimit} KM/H`, 1, pad + 6);
        chartCtx.fillText("0 KM/H", 1, pad + h + 1);
    }

    // ── GLOBAL ANIMATION LOOP ──
    function loop() {
        state.updateTelemetryStats();
        document.getElementById("congestionRate").textContent = `${state.congestionRate}%`;
        document.getElementById("avgSpeed").textContent = state.avgSpeed.toFixed(1);
        renderer.draw();
        drawSpeedChart();
        requestAnimationFrame(loop);
    }

    // Initialise
    applyDisturbance();
    updateLegend();
    triggerAiAudit(); // Run AI audit immediately on load
    loop();

    // ── INIT DATABASE MANAGER ──
    // Must be last so all DOM elements are ready
    window.__dbManager = new DatabaseManager();
});
