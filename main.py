"""
KHA-DIVERGENT FastAPI Core v3.0
================================
Stack: Python · FastAPI · scikit-learn · Pandas · NumPy · SQLite
Hackathon: Smart City Digital Twin — Astana, Kazakhstan

Architecture:
  IoT Nodes (ESP32) ──┐
                       ├──▶ FastAPI Core ──▶ SQLite DB (traffic_logs / thermo_logs / chat_history)
  Astana Twin Sim ────┘         │
                                 └──▶ WebSocket broadcast ──▶ Dashboard UI
"""

import os
import json
import logging
import sqlite3
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from functools import partial

import httpx
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
logger = logging.getLogger("KHA-FastAPI")

# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="KHA-DIVERGENT Smart City API",
    version="3.0.0",
    description="Digital Twin for Astana — Traffic, Thermal, AI Chat with persistent SQLite DB"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# DATABASE — SQLite + Pandas
# ─────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "kha_divergent.db")

def _db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row   # dict-like access
    conn.execute("PRAGMA journal_mode=WAL")  # concurrent reads
    return conn

def init_database():
    """Create all tables if they don't already exist."""
    conn = _db_connect()
    cur = conn.cursor()

    # ── Traffic Telemetry Log ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS traffic_logs (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            ts               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            district_id      TEXT,
            traffic_speed    REAL,
            congestion_index REAL,
            co2_ppm          REAL,
            heat_loss_wm2    REAL,
            ambient_temp_c   REAL,
            is_anomaly       INTEGER DEFAULT 0,
            anomaly_score    REAL    DEFAULT 0.0,
            source           TEXT    DEFAULT 'twin'
        )
    """)

    # ── Thermographic Building Audit Log ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS thermo_logs (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            ts                      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            building_id             TEXT,
            building_name           TEXT,
            construction_year       INTEGER,
            base_heat_loss_wm2      REAL,
            insulation_type         TEXT,
            insulation_thickness_mm INTEGER,
            reduction_percent       INTEGER,
            annual_co2_tons         REAL,
            annual_savings_kzt      INTEGER,
            ai_analysis             TEXT,
            ai_recommendations      TEXT
        )
    """)

    # ── AI Chat History ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            ts         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            session_id TEXT NOT NULL DEFAULT 'default',
            mode       TEXT NOT NULL,       -- 'traffic' | 'thermo'
            role       TEXT NOT NULL,       -- 'user' | 'assistant'
            content    TEXT NOT NULL,
            context    TEXT                 -- JSON snapshot of live data at query time
        )
    """)

    conn.commit()
    conn.close()
    logger.info("SQLite database initialised at %s", DB_PATH)

# Initialise DB immediately at import time
init_database()

# Thread-pool wrapper so sync SQLite doesn't block the event loop
async def run_db(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))

# ── DB write helpers ──────────────────────────

def _save_traffic_log(row: dict):
    conn = _db_connect()
    conn.execute("""
        INSERT INTO traffic_logs
            (district_id, traffic_speed, congestion_index, co2_ppm,
             heat_loss_wm2, ambient_temp_c, is_anomaly, anomaly_score, source)
        VALUES
            (:district_id, :traffic_speed, :congestion_index, :co2_ppm,
             :heat_loss_wm2, :ambient_temp_c, :is_anomaly, :anomaly_score, :source)
    """, row)
    conn.commit()
    conn.close()

def _save_thermo_log(row: dict):
    conn = _db_connect()
    conn.execute("""
        INSERT INTO thermo_logs
            (building_id, building_name, construction_year, base_heat_loss_wm2,
             insulation_type, insulation_thickness_mm, reduction_percent,
             annual_co2_tons, annual_savings_kzt, ai_analysis, ai_recommendations)
        VALUES
            (:building_id, :building_name, :construction_year, :base_heat_loss_wm2,
             :insulation_type, :insulation_thickness_mm, :reduction_percent,
             :annual_co2_tons, :annual_savings_kzt, :ai_analysis, :ai_recommendations)
    """, row)
    conn.commit()
    conn.close()

def _save_chat_message(session_id: str, mode: str, role: str, content: str, context: dict):
    conn = _db_connect()
    conn.execute("""
        INSERT INTO chat_history (session_id, mode, role, content, context)
        VALUES (?, ?, ?, ?, ?)
    """, (session_id, mode, role, content, json.dumps(context)))
    conn.commit()
    conn.close()

# ── DB read helpers (return Pandas DataFrames) ──

def _fetch_traffic_history(limit: int = 50) -> list:
    conn = _db_connect()
    df = pd.read_sql_query(
        "SELECT * FROM traffic_logs ORDER BY id DESC LIMIT ?",
        conn, params=(limit,)
    )
    conn.close()
    return df.to_dict(orient="records")

def _fetch_thermo_history(limit: int = 50) -> list:
    conn = _db_connect()
    df = pd.read_sql_query(
        "SELECT * FROM thermo_logs ORDER BY id DESC LIMIT ?",
        conn, params=(limit,)
    )
    conn.close()
    return df.to_dict(orient="records")

def _fetch_chat_history(session_id: str, mode: str, limit: int = 30) -> list:
    conn = _db_connect()
    df = pd.read_sql_query("""
        SELECT id, ts, role, content, context
        FROM chat_history
        WHERE session_id = ? AND mode = ?
        ORDER BY id DESC LIMIT ?
    """, conn, params=(session_id, mode, limit))
    conn.close()
    # Reverse so oldest first
    return df.iloc[::-1].to_dict(orient="records")

def _fetch_db_stats() -> dict:
    """Return record counts using Pandas — demonstrates the data stack."""
    conn = _db_connect()
    stats = {}
    for table in ("traffic_logs", "thermo_logs", "chat_history"):
        df = pd.read_sql_query(f"SELECT COUNT(*) as cnt FROM {table}", conn)
        stats[table] = int(df["cnt"].iloc[0])
    # Traffic analytics via Pandas
    df_t = pd.read_sql_query(
        "SELECT traffic_speed, congestion_index, co2_ppm FROM traffic_logs ORDER BY id DESC LIMIT 100",
        conn
    )
    if not df_t.empty:
        stats["traffic_analytics"] = {
            "avg_speed_100":    round(float(df_t["traffic_speed"].mean()), 2),
            "avg_congestion":   round(float(df_t["congestion_index"].mean()), 2),
            "avg_co2":          round(float(df_t["co2_ppm"].mean()), 2),
            "max_co2":          round(float(df_t["co2_ppm"].max()), 2),
            "min_speed":        round(float(df_t["traffic_speed"].min()), 2),
        }
    conn.close()
    return stats

# ─────────────────────────────────────────────
# WEBSOCKET CONNECTION MANAGER
# ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)
        logger.info("WS client connected — total: %d", len(self.active_connections))

    def disconnect(self, ws: WebSocket):
        if ws in self.active_connections:
            self.active_connections.remove(ws)

    async def broadcast(self, message: str):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

# ─────────────────────────────────────────────
# SCIKIT-LEARN — IsolationForest Anomaly Detector
# (Trained on synthetic nominal Astana data)
# ─────────────────────────────────────────────
FEATURES = ["traffic_speed_kmh", "congestion_index", "air_quality_co2_ppm",
            "facade_heat_loss_w_m2", "ambient_temp_c"]

logger.info("Training IsolationForest anomaly detector on synthetic nominal dataset...")
np.random.seed(42)
_df_train = pd.DataFrame({
    "traffic_speed_kmh":      np.random.normal(50.0, 4.0, 300),
    "congestion_index":       np.random.normal(30.0, 4.0, 300),
    "air_quality_co2_ppm":    np.random.normal(410.0, 20.0, 300),
    "facade_heat_loss_w_m2":  np.random.normal(95.0,  8.0, 300),
    "ambient_temp_c":         np.random.normal(30.0,  0.5, 300),
})
ml_model = IsolationForest(contamination=0.05, random_state=42, n_estimators=150)
ml_model.fit(_df_train[FEATURES])
logger.info("IsolationForest model ready.")

# ─────────────────────────────────────────────
# UTILS
# ─────────────────────────────────────────────
def clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = lines[1:] if lines[0].strip().startswith("```") else lines
        lines = lines[:-1] if lines and lines[-1].strip().startswith("```") else lines
        text = "\n".join(lines).strip()
    return text

def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────
class HardwareTelemetry(BaseModel):
    node_id: str
    temp_c: float
    distance_cm: float
    flow_speed_kmh: float = 0.0
    lane_blocked: bool = False

class TwinMetrics(BaseModel):
    traffic_speed_kmh: float
    congestion_index: float
    air_quality_co2_ppm: float
    facade_heat_loss_w_m2: float
    ambient_temp_c: float

class TwinTelemetry(BaseModel):
    timestamp: str
    district_id: str
    metrics: TwinMetrics
    ai_trigger: bool

class TelemetryPayload(BaseModel):
    city: str
    district_id: str
    metrics: TwinMetrics

class ThermoPayload(BaseModel):
    building_id: str
    name: str
    age: int
    current_loss_wm2: float
    insulation_type: str
    target_thickness_mm: int
    calculated_reduction_percent: int

class ChatRequest(BaseModel):
    message: str
    mode: str                          # 'traffic' | 'thermo'
    session_id: str = "default"
    context: dict = {}

# ─────────────────────────────────────────────
# ENDPOINTS — IoT Hardware Telemetry
# ─────────────────────────────────────────────
@app.post("/api/telemetry")
async def receive_hardware_telemetry(data: HardwareTelemetry):
    """Receives live POST packets from physical ESP32 nodes."""
    logger.info("ESP32 [%s]: Temp=%.1f°C  Speed=%.1f km/h", data.node_id, data.temp_c, data.flow_speed_kmh)

    payload = {
        "source": "physical_hardware",
        "node_id": data.node_id,
        "type": "esp32_telemetry",
        "payload": {
            "temperature": data.temp_c,
            "distance_sensor": data.distance_cm,
            "calculated_speed": data.flow_speed_kmh,
            "lane_status": "BLOCKED" if data.lane_blocked else "CLEAR"
        }
    }
    await manager.broadcast(json.dumps(payload))
    return {"status": "SUCCESS", "clients": len(manager.active_connections)}

# ─────────────────────────────────────────────
# ENDPOINTS — Astana Twin Telemetry (saves to DB)
# ─────────────────────────────────────────────
@app.post("/api/twin/telemetry")
async def receive_twin_telemetry(data: TwinTelemetry):
    """
    Receives synthetic telemetry from twin_simulator.py,
    runs IsolationForest classification,
    persists to SQLite traffic_logs via Pandas,
    broadcasts to dashboard WebSocket clients.
    """
    m = data.metrics

    # ── ML Anomaly Detection ──
    df_test = pd.DataFrame([{
        "traffic_speed_kmh":     m.traffic_speed_kmh,
        "congestion_index":      m.congestion_index,
        "air_quality_co2_ppm":   m.air_quality_co2_ppm,
        "facade_heat_loss_w_m2": m.facade_heat_loss_w_m2,
        "ambient_temp_c":        m.ambient_temp_c,
    }])
    prediction    = ml_model.predict(df_test[FEATURES])[0]
    anomaly_score = float(ml_model.score_samples(df_test[FEATURES])[0])
    is_anomaly    = bool(prediction == -1)
    confidence    = round(max(0, min(100, (0.5 - anomaly_score) * 450))) if is_anomaly else 0

    # ── Persist to SQLite ──
    await run_db(_save_traffic_log, {
        "district_id":       data.district_id,
        "traffic_speed":     m.traffic_speed_kmh,
        "congestion_index":  m.congestion_index,
        "co2_ppm":           m.air_quality_co2_ppm,
        "heat_loss_wm2":     m.facade_heat_loss_w_m2,
        "ambient_temp_c":    m.ambient_temp_c,
        "is_anomaly":        int(is_anomaly),
        "anomaly_score":     round(anomaly_score, 4),
        "source":            "twin",
    })

    payload = {
        "source":      "twin_simulator",
        "type":        "twin_telemetry",
        "timestamp":   data.timestamp,
        "district_id": data.district_id,
        "metrics": {
            "traffic_speed_kmh":     m.traffic_speed_kmh,
            "congestion_index":      m.congestion_index,
            "air_quality_co2_ppm":   m.air_quality_co2_ppm,
            "facade_heat_loss_w_m2": m.facade_heat_loss_w_m2,
            "ambient_temp_c":        m.ambient_temp_c,
        },
        "ai_trigger":  data.ai_trigger,
        "ml_analysis": {
            "is_anomaly":     is_anomaly,
            "anomaly_score":  round(anomaly_score, 3),
            "confidence_pct": confidence,
        },
    }
    await manager.broadcast(json.dumps(payload))
    return {"status": "SUCCESS", "clients": len(manager.active_connections), "is_anomaly": is_anomaly}

# ─────────────────────────────────────────────
# ENDPOINTS — Traffic AI Analysis (Gemini)
# ─────────────────────────────────────────────
@app.post("/api/analyze")
async def analyze_telemetry(payload: TelemetryPayload, x_gemini_key: str = Header(None)):
    api_key = x_gemini_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return _local_traffic_fallback(payload)

    prompt = f"""You are the Chief AI Urban Logistics & Energy Efficiency Coordinator for Astana City.
Analyze this Astana Twin District Telemetry Snapshot:
- District: {payload.district_id}
- Avg Traffic Speed: {payload.metrics.traffic_speed_kmh} km/h
- Congestion Index: {payload.metrics.congestion_index}%
- Air Quality (CO2): {payload.metrics.air_quality_co2_ppm} PPM
- Facade Heat Loss: {payload.metrics.facade_heat_loss_w_m2} W/m²
- Ambient Temperature: {payload.metrics.ambient_temp_c}°C

Analyze the correlation between traffic speed/congestion (CO2 emissions) and building heat loss.
Return strictly in JSON:
{{
  "analysis": "detailed assessment in Russian",
  "recommendations": "concrete traffic light and thermal retrofit actions in Russian",
  "adjustments": [{{"roadId": "R1", "action": "GREEN_WAVE", "direction": "East-West", "duration": 15, "reason": "reason in Russian"}}],
  "efficiencyMetrics": {{"travelTimeReduction": 22, "co2Reduction": 14, "avgSpeedIncrease": 18}}
}}"""

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json"}}

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(api_url, json=body, timeout=25.0)
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail="Gemini endpoint error")
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(clean_json_response(text))
        except Exception as e:
            logger.error("Gemini traffic analysis error: %s", e)
            return _local_traffic_fallback(payload)

def _local_traffic_fallback(payload: TelemetryPayload) -> dict:
    co2   = payload.metrics.air_quality_co2_ppm
    speed = payload.metrics.traffic_speed_kmh
    loss  = payload.metrics.facade_heat_loss_w_m2

    analysis = f"[Local AI] Уровень CO₂: {co2:.0f} PPM. Средняя скорость: {speed:.1f} км/ч. Теплопотери фасада: {loss:.0f} Вт/м²."
    recs     = "Параметры в пределах нормы. Регулировка светофоров стандартная."
    adjs     = []
    eff      = {"travelTimeReduction": 5, "co2Reduction": 4, "avgSpeedIncrease": 6}

    if co2 > 700:
        analysis += f" ⚠️ Критическое скопление CO₂ на перекрёстке Node-A."
        recs      = "Активировать режим «Зелёная волна» для разгрузки перекрёстка Node-A."
        adjs      = [{"roadId": "R2", "action": "GREEN_WAVE", "direction": "East-West", "duration": 25, "reason": "CO₂ Node-A разгрузка"},
                     {"roadId": "R5", "action": "BUS_PRIORITY", "direction": "North-South", "duration": 15, "reason": "Приоритет BRT обхода"}]
        eff       = {"travelTimeReduction": 24, "co2Reduction": 18, "avgSpeedIncrease": 20}
    elif loss > 130:
        analysis += f" Высокие теплопотери ({loss:.0f} Вт/м²)."
        recs      = "Рекомендован локальный аудит изоляции фасадов."
        adjs      = [{"roadId": "R1", "action": "GREEN_WAVE", "direction": "East-West", "duration": 10, "reason": "Номинальный режим"}]
        eff       = {"travelTimeReduction": 8, "co2Reduction": 6, "avgSpeedIncrease": 7}

    return {"analysis": analysis, "recommendations": recs, "adjustments": adjs, "efficiencyMetrics": eff}

# ─────────────────────────────────────────────
# ENDPOINTS — Thermal AI Analysis (saves to DB)
# ─────────────────────────────────────────────
@app.post("/api/analyze-thermo")
async def analyze_thermo(payload: ThermoPayload, x_gemini_key: str = Header(None)):
    api_key = x_gemini_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        result = _local_thermo_fallback(payload)
    else:
        prompt = f"""You are the Senior AI Building Energy Efficiency Consultant for Astana Municipality.
Analyze the following building thermal loss configuration:
- Building ID: {payload.building_id}
- Building Name: {payload.name}
- Construction Year: {payload.age}
- Current Heat Loss: {payload.current_loss_wm2} W/m²
- Installed Insulation: {payload.insulation_type}
- Simulated Upgrade Thickness: {payload.target_thickness_mm} mm
- Estimated Heat Loss Reduction: {payload.calculated_reduction_percent}%

Recommend specific building envelope retrofits for Astana's sub-zero climate (-30°C winters).
Return strictly in JSON:
{{
  "analysis": "detailed thermal loss assessment in Russian",
  "recommendations": "insulation material and installation recommendations in Russian",
  "kpi": {{"annualCo2ReductionTons": 4.8, "annualCostSavingKzt": 340000}}
}}"""

        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json"}}

        async with httpx.AsyncClient() as client:
            try:
                r = await client.post(api_url, json=body, timeout=25.0)
                if r.status_code != 200:
                    raise HTTPException(status_code=502, detail="Gemini endpoint error")
                text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                result = json.loads(clean_json_response(text))
            except Exception as e:
                logger.error("Gemini thermo analysis error: %s", e)
                result = _local_thermo_fallback(payload)

    # ── Persist thermo audit to SQLite ──
    await run_db(_save_thermo_log, {
        "building_id":              payload.building_id,
        "building_name":            payload.name,
        "construction_year":        payload.age,
        "base_heat_loss_wm2":       payload.current_loss_wm2,
        "insulation_type":          payload.insulation_type,
        "insulation_thickness_mm":  payload.target_thickness_mm,
        "reduction_percent":        payload.calculated_reduction_percent,
        "annual_co2_tons":          result.get("kpi", {}).get("annualCo2ReductionTons", 0),
        "annual_savings_kzt":       result.get("kpi", {}).get("annualCostSavingKzt", 0),
        "ai_analysis":              result.get("analysis", ""),
        "ai_recommendations":       result.get("recommendations", ""),
    })

    return result

def _local_thermo_fallback(payload: ThermoPayload) -> dict:
    saved   = payload.current_loss_wm2 * (payload.calculated_reduction_percent / 100.0)
    co2     = round(saved * 0.045, 1)
    savings = int(saved * 2300)
    return {
        "analysis": f"[Local AI] Аудит {payload.name} ({payload.age} г.). Теплопотери {payload.current_loss_wm2} Вт/м² — признак устаревшего теплового контура ({payload.insulation_type}).",
        "recommendations": f"Монтаж утеплителя {payload.target_thickness_mm} мм. Рекомендуются плиты базальтовой ваты (≥110 кг/м³) для климата Астаны (-30°C зима).",
        "kpi": {"annualCo2ReductionTons": co2, "annualCostSavingKzt": savings}
    }

# ─────────────────────────────────────────────
# ENDPOINTS — AI CHAT (saves history to SQLite)
# ─────────────────────────────────────────────
@app.post("/api/chat")
async def ai_chat(req: ChatRequest, x_gemini_key: str = Header(None)):
    """
    Handles AI chat messages for both traffic and thermo modes.
    Saves conversation to SQLite chat_history table.
    Returns AI reply (Gemini or local fallback).
    """
    api_key = x_gemini_key or os.getenv("GEMINI_API_KEY")

    # Save user message to DB
    await run_db(_save_chat_message, req.session_id, req.mode, "user", req.message, req.context)

    # Fetch recent history from DB for context (last 6 exchanges = 12 rows)
    history_rows = await run_db(_fetch_chat_history, req.session_id, req.mode, 12)

    if not api_key:
        reply = _local_chat_fallback(req.message, req.mode, req.context)
    else:
        reply = await _call_gemini_chat(api_key, req.message, req.mode, req.context, history_rows)

    # Save AI reply to DB
    await run_db(_save_chat_message, req.session_id, req.mode, "assistant", reply, {})

    return {"reply": reply, "session_id": req.session_id, "mode": req.mode}

async def _call_gemini_chat(api_key: str, user_msg: str, mode: str, context: dict, history: list) -> str:
    """Build a context-aware prompt and send to Gemini 2.5 Flash."""
    if mode == "traffic":
        system = f"""Ты — AI-координатор дорожного движения системы KHA-DIVERGENT для Астаны.
Текущие данные телеметрии:
• Средняя скорость: {context.get('avgSpeed', '?')} км/ч
• Индекс заторов: {context.get('congestionRate', '?')}%
• CO₂: {context.get('co2Ppm', '?')} PPM
• Теплопотери фасадов: {context.get('facadeHeatLoss', '?')} Вт/м²
• Температура: {context.get('ambientTemp', '?')}°C
• Активные AI-регулировки: {context.get('appliedAdjustments', 'нет')}
Дорожная сеть: R1=Turan Ave, R2=Kabanbay Batyr, R3=Mangilik El, R4=Kunayev St, R5=Dostyk St, R6=Syganak St.
Отвечай кратко (2-4 предложения). Можешь рекомендовать действия: GREEN_WAVE, BUS_PRIORITY, EMERGENCY_CORRIDOR на дорогах R1-R6."""
    else:
        b = context.get("selectedBuilding") or {}
        system = f"""Ты — AI-консультант по энергоэффективности зданий для Астаны, система KHA-DIVERGENT.
Данные выбранного здания: {b.get('name','?')} (ID: {b.get('id','?')}), год постройки: {b.get('age','?')},
изоляция: {b.get('insulation','?')}, теплопотери: {b.get('h0','?')} Вт/м².
Климат Астаны: -30°C зима, +35°C лето. Норма теплопотерь: <80 Вт/м².
Отвечай кратко (2-4 предложения). Давай конкретные рекомендации по материалам (базальтовая вата, EPS, PIR-плиты, полиуретан)."""

    # Build contents with conversation history
    contents = []
    for row in history[-8:]:   # last 8 messages for context window
        gemini_role = "user" if row["role"] == "user" else "model"
        contents.append({"role": gemini_role, "parts": [{"text": row["content"]}]})

    # Append current message (with system context)
    contents.append({"role": "user", "parts": [{"text": system + "\n\nВопрос: " + user_msg}]})

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(api_url, json={"contents": contents}, timeout=20.0)
            if r.status_code != 200:
                raise Exception(f"Gemini returned {r.status_code}")
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error("Gemini chat error: %s", e)
            return _local_chat_fallback(user_msg, mode, context)

def _local_chat_fallback(msg: str, mode: str, ctx: dict) -> str:
    m = msg.lower()
    if mode == "traffic":
        speed = ctx.get("avgSpeed", 0)
        co2   = ctx.get("co2Ppm", 0)
        cong  = ctx.get("congestionRate", 0)
        if any(k in m for k in ["congestion", "пробка", "затор", "traffic"]):
            status = "⚠️ Высокая загрузка" if cong > 50 else "✅ Нормальный поток"
            return f"{status}. Индекс заторов: {cong}%. {'Рекомендую GREEN_WAVE на R1 (Turan Ave).' if cong > 50 else 'Светофоры в стандартном режиме.'}"
        if any(k in m for k in ["co2", "air", "воздух", "выброс"]):
            return f"CO₂: {co2:.0f} PPM. {'⚠️ Превышение нормы — рекомендую разгрузку R2.' if co2 > 600 else '✅ В норме (<450 PPM).'}"
        if any(k in m for k in ["speed", "скорость", "быстро"]):
            return f"Средняя скорость по 6 коридорам: {speed:.1f} км/ч. {'Трафик замедлен.' if speed < 35 else 'Трафик в норме.'}"
        return f"Статус: скорость {speed:.1f} км/ч, заторы {cong}%, CO₂ {co2:.0f} PPM. Добавьте Gemini API ключ для детального анализа."
    else:
        b = ctx.get("selectedBuilding") or {}
        if not b:
            return "Пожалуйста, выберите здание на карте для получения теплового анализа."
        h0 = b.get('h0', 0)
        if any(k in m for k in ["insulation", "изоляция", "утеплитель", "материал"]):
            return f"Для {b.get('name','здания')} ({h0} Вт/м²): рекомендую базальтовую вату 120-150 мм для климата Астаны. Текущая: {b.get('insulation','неизвестно')}."
        if any(k in m for k in ["cost", "стоимость", "экономия", "savings", "окупаемость"]):
            savings = round(h0 * 0.4 * 2300)
            return f"Расчётная экономия для {b.get('name','здания')}: ~{savings:,} тг/год при утеплении 150 мм. Окупаемость ~4-6 лет."
        if any(k in m for k in ["rating", "класс", "energy", "энергия"]):
            rating = "A" if h0 < 55 else "B" if h0 < 90 else "C" if h0 < 130 else "D" if h0 < 185 else "E"
            return f"{b.get('name','Здание')} — энергокласс {rating} ({h0} Вт/м²). Целевой стандарт СНИП РК: <80 Вт/м²."
        return f"{b.get('name','Здание')} ({b.get('id','?')}): теплопотери {h0} Вт/м², год {b.get('age','?')}, изоляция: {b.get('insulation','?')}. Добавьте Gemini API ключ для полного анализа."

# ─────────────────────────────────────────────
# ENDPOINTS — Database History (Pandas-powered)
# ─────────────────────────────────────────────
@app.get("/api/history/traffic")
async def get_traffic_history(limit: int = 50):
    """Returns recent traffic telemetry records from SQLite via Pandas DataFrame."""
    records = await run_db(_fetch_traffic_history, limit)
    return {"records": records, "count": len(records)}

@app.get("/api/history/thermo")
async def get_thermo_history(limit: int = 30):
    """Returns recent thermographic audit records from SQLite via Pandas DataFrame."""
    records = await run_db(_fetch_thermo_history, limit)
    return {"records": records, "count": len(records)}

@app.get("/api/history/chat")
async def get_chat_history(
    session_id: str = "default",
    mode: str = "traffic",
    limit: int = 30
):
    """Returns chat history for a given session from SQLite."""
    records = await run_db(_fetch_chat_history, session_id, mode, limit)
    return {"records": records, "session_id": session_id, "mode": mode}

@app.get("/api/db/stats")
async def get_db_stats():
    """Returns database statistics and Pandas-computed analytics."""
    stats = await run_db(_fetch_db_stats)
    return stats

# ─────────────────────────────────────────────
# WEBSOCKET
# ─────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive, handle pings
    except WebSocketDisconnect:
        manager.disconnect(ws)

# ─────────────────────────────────────────────
# STATIC FILE SERVING (frontend)
# ─────────────────────────────────────────────
app.mount("/", StaticFiles(directory=".", html=True), name="static")

# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
