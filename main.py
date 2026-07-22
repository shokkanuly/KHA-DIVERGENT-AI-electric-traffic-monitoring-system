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
import psycopg2
import psycopg2.extras
import asyncio
import sqlite3
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
# DATABASE — PostgreSQL + TimescaleDB
# ─────────────────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5433"))
DB_NAME = os.getenv("DB_NAME", "astana_twin")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgrespassword")
SQLITE_PATH = os.getenv("SQLITE_PATH", "kha_divergent.db")
DB_BACKEND = os.getenv("DB_BACKEND", "postgres")

def _db_connect():
    if DB_BACKEND == "sqlite":
        return sqlite3.connect(SQLITE_PATH)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def _init_sqlite_database():
    conn = sqlite3.connect(SQLITE_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS traffic_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            district_id TEXT,
            traffic_speed REAL,
            congestion_index REAL,
            co2_ppm REAL,
            heat_loss_wm2 REAL,
            ambient_temp_c REAL,
            is_anomaly INTEGER DEFAULT 0,
            anomaly_score REAL DEFAULT 0.0,
            source TEXT DEFAULT 'twin'
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS thermo_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            building_id TEXT,
            building_name TEXT,
            construction_year INTEGER,
            base_heat_loss_wm2 REAL,
            insulation_type TEXT,
            insulation_thickness_mm INTEGER,
            reduction_percent INTEGER,
            annual_co2_tons REAL,
            annual_savings_kzt INTEGER,
            ai_analysis TEXT,
            ai_recommendations TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            session_id TEXT NOT NULL DEFAULT 'default',
            mode TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            context TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS control_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            district_id TEXT,
            mode TEXT,
            risk_level TEXT,
            signal_phase TEXT,
            power_state TEXT,
            power_usage_kw REAL,
            reason TEXT,
            action_json TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS structural_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            district_id TEXT,
            node_id TEXT,
            accel_x_g REAL,
            accel_z_g REAL,
            dominant_freq_hz REAL,
            displacement_mm REAL,
            damage_index REAL,
            soil_pressure_kpa REAL DEFAULT 0.0,
            moisture_pct REAL DEFAULT 0.0,
            is_anomaly INTEGER DEFAULT 0,
            anomaly_score REAL DEFAULT 0.0
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mobility_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            district_id TEXT,
            scenario TEXT,
            avg_speed_kmh REAL,
            congestion_index REAL,
            co2_g_passenger_km REAL,
            rider_count INTEGER
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fleet_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            district_id TEXT,
            node_id TEXT,
            position_x REAL,
            position_y REAL,
            heading_deg REAL,
            gas_co_ppm REAL,
            chromium_mpc_multiplier REAL,
            temperature_c REAL,
            humidity_pct REAL
        )
    """)
    conn.commit()
    conn.close()
    logger.info("SQLite database initialised at %s.", SQLITE_PATH)

def init_database():
    """Create all tables if they don't already exist in PostgreSQL / TimescaleDB."""
    global DB_BACKEND
    try:
        conn = _db_connect()
    except Exception as e:
        logger.warning("PostgreSQL unavailable, falling back to SQLite: %s", e)
        DB_BACKEND = "sqlite"
        _init_sqlite_database()
        return
    cur = conn.cursor()

    # Enable TimescaleDB extension if available
    try:
        cur.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;")
        conn.commit()
        logger.info("TimescaleDB extension checked/loaded.")
    except Exception as e:
        conn.rollback()
        logger.warning("TimescaleDB extension load failed (falling back to standard PostgreSQL): %s", e)

    # ── Traffic Telemetry Log ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS traffic_logs (
            id               SERIAL,
            ts               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            district_id      TEXT,
            traffic_speed    REAL,
            congestion_index REAL,
            co2_ppm          REAL,
            heat_loss_wm2    REAL,
            ambient_temp_c   REAL,
            is_anomaly       INTEGER DEFAULT 0,
            anomaly_score    REAL    DEFAULT 0.0,
            source           TEXT    DEFAULT 'twin',
            PRIMARY KEY (id, ts)
        )
    """)

    # Convert to hypertable if TimescaleDB is loaded
    try:
        cur.execute("SELECT create_hypertable('traffic_logs', 'ts', if_not_exists => TRUE);")
        conn.commit()
        logger.info("traffic_logs table converted to TimescaleDB hypertable.")
    except Exception as e:
        conn.rollback()
        logger.info("Standard table used for traffic_logs (no hypertable creation): %s", e)

    # ── Thermographic Building Audit Log ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS thermo_logs (
            id                      SERIAL PRIMARY KEY,
            ts                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

    # ── Smart Grid + Signal Control Event Log ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS control_events (
            id             SERIAL PRIMARY KEY,
            ts             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            district_id    TEXT,
            mode           TEXT,
            risk_level     TEXT,
            signal_phase   TEXT,
            power_state    TEXT,
            power_usage_kw REAL,
            reason         TEXT,
            action_json    TEXT
        )
    """)

    # ── AI Chat History ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id         SERIAL PRIMARY KEY,
            ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            session_id TEXT NOT NULL DEFAULT 'default',
            mode       TEXT NOT NULL,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            context    TEXT
        )
    """)

    # ── Structural Logs ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS structural_logs (
            id               SERIAL,
            ts               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            district_id      TEXT,
            node_id          TEXT,
            accel_x_g        REAL,
            accel_z_g        REAL,
            dominant_freq_hz REAL,
            displacement_mm  REAL,
            damage_index     REAL,
            soil_pressure_kpa REAL DEFAULT 0.0,
            moisture_pct     REAL DEFAULT 0.0,
            is_anomaly       INTEGER DEFAULT 0,
            anomaly_score    REAL    DEFAULT 0.0,
            PRIMARY KEY (id, ts)
        )
    """)
    try:
        cur.execute("SELECT create_hypertable('structural_logs', 'ts', if_not_exists => TRUE);")
        conn.commit()
    except Exception:
        conn.rollback()

    # ── Mobility Logs ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mobility_logs (
            id                 SERIAL,
            ts                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            district_id        TEXT,
            scenario           TEXT,
            avg_speed_kmh      REAL,
            congestion_index   REAL,
            co2_g_passenger_km REAL,
            rider_count        INTEGER,
            PRIMARY KEY (id, ts)
        )
    """)
    try:
        cur.execute("SELECT create_hypertable('mobility_logs', 'ts', if_not_exists => TRUE);")
        conn.commit()
    except Exception:
        conn.rollback()

    # ── Fleet Logs ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fleet_logs (
            id                      SERIAL,
            ts                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            district_id             TEXT,
            node_id                 TEXT,
            position_x              REAL,
            position_y              REAL,
            heading_deg             REAL,
            gas_co_ppm              REAL,
            chromium_mpc_multiplier REAL,
            temperature_c           REAL,
            humidity_pct            REAL,
            PRIMARY KEY (id, ts)
        )
    """)
    try:
        cur.execute("SELECT create_hypertable('fleet_logs', 'ts', if_not_exists => TRUE);")
        conn.commit()
    except Exception:
        conn.rollback()

    conn.commit()
    conn.close()
    logger.info("PostgreSQL database initialised successfully.")

# Initialise DB immediately at import time
init_database()

# Thread-pool wrapper so blocking DB queries don't block the async event loop
async def run_db(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))

# ── DB write helpers ──────────────────────────

def _save_traffic_log(row: dict):
    conn = _db_connect()
    cur = conn.cursor()
    if DB_BACKEND == "sqlite":
        cur.execute("""
            INSERT INTO traffic_logs
                (district_id, traffic_speed, congestion_index, co2_ppm,
                 heat_loss_wm2, ambient_temp_c, is_anomaly, anomaly_score, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["district_id"], row["traffic_speed"], row["congestion_index"], row["co2_ppm"],
            row["heat_loss_wm2"], row["ambient_temp_c"], row["is_anomaly"], row["anomaly_score"], row["source"]
        ))
    else:
        cur.execute("""
            INSERT INTO traffic_logs
                (district_id, traffic_speed, congestion_index, co2_ppm,
                 heat_loss_wm2, ambient_temp_c, is_anomaly, anomaly_score, source)
            VALUES
                (%(district_id)s, %(traffic_speed)s, %(congestion_index)s, %(co2_ppm)s,
                 %(heat_loss_wm2)s, %(ambient_temp_c)s, %(is_anomaly)s, %(anomaly_score)s, %(source)s)
        """, row)
    conn.commit()
    conn.close()

def _save_thermo_log(row: dict):
    conn = _db_connect()
    cur = conn.cursor()
    if DB_BACKEND == "sqlite":
        cur.execute("""
            INSERT INTO thermo_logs
                (building_id, building_name, construction_year, base_heat_loss_wm2,
                 insulation_type, insulation_thickness_mm, reduction_percent,
                 annual_co2_tons, annual_savings_kzt, ai_analysis, ai_recommendations)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["building_id"], row["building_name"], row["construction_year"], row["base_heat_loss_wm2"],
            row["insulation_type"], row["insulation_thickness_mm"], row["reduction_percent"],
            row["annual_co2_tons"], row["annual_savings_kzt"], row["ai_analysis"], row["ai_recommendations"]
        ))
    else:
        cur.execute("""
            INSERT INTO thermo_logs
                (building_id, building_name, construction_year, base_heat_loss_wm2,
                 insulation_type, insulation_thickness_mm, reduction_percent,
                 annual_co2_tons, annual_savings_kzt, ai_analysis, ai_recommendations)
            VALUES
                (%(building_id)s, %(building_name)s, %(construction_year)s, %(base_heat_loss_wm2)s,
                 %(insulation_type)s, %(insulation_thickness_mm)s, %(reduction_percent)s,
                 %(annual_co2_tons)s, %(annual_savings_kzt)s, %(ai_analysis)s, %(ai_recommendations)s)
        """, row)
    conn.commit()
    conn.close()

def _save_chat_message(session_id: str, mode: str, role: str, content: str, context: dict):
    conn = _db_connect()
    cur = conn.cursor()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    cur.execute(f"""
        INSERT INTO chat_history (session_id, mode, role, content, context)
        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
    """, (session_id, mode, role, content, json.dumps(context)))
    conn.commit()
    conn.close()

def _save_control_event(row: dict):
    conn = _db_connect()
    cur = conn.cursor()
    if DB_BACKEND == "sqlite":
        cur.execute("""
            INSERT INTO control_events
                (district_id, mode, risk_level, signal_phase, power_state,
                 power_usage_kw, reason, action_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["district_id"], row["mode"], row["risk_level"], row["signal_phase"],
            row["power_state"], row["power_usage_kw"], row["reason"], row["action_json"]
        ))
    else:
        cur.execute("""
            INSERT INTO control_events
                (district_id, mode, risk_level, signal_phase, power_state,
                 power_usage_kw, reason, action_json)
            VALUES
                (%(district_id)s, %(mode)s, %(risk_level)s, %(signal_phase)s,
                 %(power_state)s, %(power_usage_kw)s, %(reason)s, %(action_json)s)
        """, row)
    conn.commit()
    conn.close()

def _save_structural_log(row: dict):
    conn = _db_connect()
    cur = conn.cursor()
    if DB_BACKEND == "sqlite":
        cur.execute("""
            INSERT INTO structural_logs
                (district_id, node_id, accel_x_g, accel_z_g, dominant_freq_hz,
                 displacement_mm, damage_index, soil_pressure_kpa, moisture_pct, is_anomaly, anomaly_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["district_id"], row["node_id"], row["accel_x_g"], row["accel_z_g"],
            row["dominant_freq_hz"], row["displacement_mm"], row["damage_index"],
            row.get("soil_pressure_kpa", 0.0), row.get("moisture_pct", 0.0),
            row.get("is_anomaly", 0), row.get("anomaly_score", 0.0)
        ))
    else:
        cur.execute("""
            INSERT INTO structural_logs
                (district_id, node_id, accel_x_g, accel_z_g, dominant_freq_hz,
                 displacement_mm, damage_index, soil_pressure_kpa, moisture_pct, is_anomaly, anomaly_score)
            VALUES
                (%(district_id)s, %(node_id)s, %(accel_x_g)s, %(accel_z_g)s, %(dominant_freq_hz)s,
                 %(displacement_mm)s, %(damage_index)s, %(soil_pressure_kpa)s, %(moisture_pct)s,
                 %(is_anomaly)s, %(anomaly_score)s)
        """, row)
    conn.commit()
    conn.close()

def _save_mobility_log(row: dict):
    conn = _db_connect()
    cur = conn.cursor()
    if DB_BACKEND == "sqlite":
        cur.execute("""
            INSERT INTO mobility_logs
                (district_id, scenario, avg_speed_kmh, congestion_index, co2_g_passenger_km, rider_count)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            row["district_id"], row["scenario"], row["avg_speed_kmh"],
            row["congestion_index"], row["co2_g_passenger_km"], row["rider_count"]
        ))
    else:
        cur.execute("""
            INSERT INTO mobility_logs
                (district_id, scenario, avg_speed_kmh, congestion_index, co2_g_passenger_km, rider_count)
            VALUES
                (%(district_id)s, %(scenario)s, %(avg_speed_kmh)s, %(congestion_index)s,
                 %(co2_g_passenger_km)s, %(rider_count)s)
        """, row)
    conn.commit()
    conn.close()

def _save_fleet_log(row: dict):
    conn = _db_connect()
    cur = conn.cursor()
    if DB_BACKEND == "sqlite":
        cur.execute("""
            INSERT INTO fleet_logs
                (district_id, node_id, position_x, position_y, heading_deg,
                 gas_co_ppm, chromium_mpc_multiplier, temperature_c, humidity_pct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["district_id"], row["node_id"], row["position_x"], row["position_y"],
            row["heading_deg"], row["gas_co_ppm"], row["chromium_mpc_multiplier"],
            row["temperature_c"], row["humidity_pct"]
        ))
    else:
        cur.execute("""
            INSERT INTO fleet_logs
                (district_id, node_id, position_x, position_y, heading_deg,
                 gas_co_ppm, chromium_mpc_multiplier, temperature_c, humidity_pct)
            VALUES
                (%(district_id)s, %(node_id)s, %(position_x)s, %(position_y)s, %(heading_deg)s,
                 %(gas_co_ppm)s, %(chromium_mpc_multiplier)s, %(temperature_c)s, %(humidity_pct)s)
        """, row)
    conn.commit()
    conn.close()

# ── DB read helpers (return lists of dicts) ──

def _fetch_traffic_history(limit: int = 50) -> list:
    conn = _db_connect()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    df = pd.read_sql_query(
        f"SELECT * FROM traffic_logs ORDER BY id DESC LIMIT {placeholder}",
        conn, params=(limit,)
    )
    conn.close()
    if 'ts' in df.columns:
        df['ts'] = pd.to_datetime(df['ts']).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df.to_dict(orient="records")

def _fetch_thermo_history(limit: int = 50) -> list:
    conn = _db_connect()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    df = pd.read_sql_query(
        f"SELECT * FROM thermo_logs ORDER BY id DESC LIMIT {placeholder}",
        conn, params=(limit,)
    )
    conn.close()
    if 'ts' in df.columns:
        df['ts'] = pd.to_datetime(df['ts']).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df.to_dict(orient="records")

def _fetch_chat_history(session_id: str, mode: str, limit: int = 30) -> list:
    conn = _db_connect()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    df = pd.read_sql_query(f"""
        SELECT id, ts, role, content, context
        FROM chat_history
        WHERE session_id = {placeholder} AND mode = {placeholder}
        ORDER BY id DESC LIMIT {placeholder}
    """, conn, params=(session_id, mode, limit))
    conn.close()
    if 'ts' in df.columns:
        df['ts'] = pd.to_datetime(df['ts']).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df.iloc[::-1].to_dict(orient="records")

def _fetch_control_history(limit: int = 30) -> list:
    conn = _db_connect()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    df = pd.read_sql_query(
        f"SELECT * FROM control_events ORDER BY id DESC LIMIT {placeholder}",
        conn, params=(limit,)
    )
    conn.close()
    if 'ts' in df.columns:
        df['ts'] = pd.to_datetime(df['ts']).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df.to_dict(orient="records")

def _fetch_structural_history(limit: int = 50) -> list:
    conn = _db_connect()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    df = pd.read_sql_query(
        f"SELECT * FROM structural_logs ORDER BY id DESC LIMIT {placeholder}",
        conn, params=(limit,)
    )
    conn.close()
    if 'ts' in df.columns:
        df['ts'] = pd.to_datetime(df['ts']).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df.to_dict(orient="records")

def _fetch_mobility_history(limit: int = 50) -> list:
    conn = _db_connect()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    df = pd.read_sql_query(
        f"SELECT * FROM mobility_logs ORDER BY id DESC LIMIT {placeholder}",
        conn, params=(limit,)
    )
    conn.close()
    if 'ts' in df.columns:
        df['ts'] = pd.to_datetime(df['ts']).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df.to_dict(orient="records")

def _fetch_fleet_history(limit: int = 50) -> list:
    conn = _db_connect()
    placeholder = "?" if DB_BACKEND == "sqlite" else "%s"
    df = pd.read_sql_query(
        f"SELECT * FROM fleet_logs ORDER BY id DESC LIMIT {placeholder}",
        conn, params=(limit,)
    )
    conn.close()
    if 'ts' in df.columns:
        df['ts'] = pd.to_datetime(df['ts']).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df.to_dict(orient="records")

def _fetch_db_stats() -> dict:
    """Return record counts using Pandas — demonstrates the data stack."""
    conn = _db_connect()
    stats = {}
    tables = ("traffic_logs", "thermo_logs", "chat_history", "control_events", "structural_logs", "mobility_logs", "fleet_logs")
    for table in tables:
        df = pd.read_sql_query(f"SELECT COUNT(*) as cnt FROM {table}", conn)
        stats[table] = int(df["cnt"].iloc[0])
    # Traffic analytics via Pandas
    df_t = pd.read_sql_query(
        "SELECT traffic_speed, congestion_index, co2_ppm FROM traffic_logs ORDER BY id DESC LIMIT 100",
        conn
    )
    conn.close()
    if not df_t.empty:
        stats["traffic_analytics"] = {
            "avg_speed_100":    round(float(df_t["traffic_speed"].mean()), 2),
            "avg_congestion":   round(float(df_t["congestion_index"].mean()), 2),
            "avg_co2":          round(float(df_t["co2_ppm"].mean()), 2),
            "max_co2":          round(float(df_t["co2_ppm"].max()), 2),
            "min_speed":        round(float(df_t["traffic_speed"].min()), 2),
        }
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

# ── STRUCTURAL HEALTH ANOMALY DETECTOR ──
STRUCTURAL_FEATURES = ["accel_x_g", "accel_z_g", "dominant_freq_hz", "displacement_mm", "damage_index"]
logger.info("Training structural IsolationForest anomaly detector on nominal dataset...")
_df_struct_train = pd.DataFrame({
    "accel_x_g":        np.random.normal(0.00, 0.01, 300),
    "accel_z_g":        np.random.normal(1.00, 0.01, 300),
    "dominant_freq_hz": np.random.normal(12.0, 0.5, 300),
    "displacement_mm":  np.random.normal(0.20, 0.03, 300),
    "damage_index":     np.random.normal(0.02, 0.005, 300),
})
structural_ml_model = IsolationForest(contamination=0.05, random_state=42, n_estimators=150)
structural_ml_model.fit(_df_struct_train[STRUCTURAL_FEATURES])
logger.info("Structural IsolationForest model ready.")

# ── RETAINING WALL FAILURE REGRESSION ──
def estimate_time_to_concern(moisture: float, pressure: float) -> float:
    """Estimates time-to-concern (hours) based on moisture and pressure load thresholds."""
    moisture_limit = 90.0
    pressure_limit = 80.0
    
    moisture_risk = moisture / moisture_limit
    pressure_risk = pressure / pressure_limit
    max_risk = max(moisture_risk, pressure_risk)
    
    if max_risk >= 1.0:
        return 0.0
    
    remaining_hours = (1.0 - max_risk) * 48.0
    return round(max(0.5, remaining_hours), 1)

# ── NETWORKX ROUTING CORRIDOR ──
import networkx as nx
def calculate_corridor_travel_times(congestion_index_bus: float, congestion_index_lrt: float) -> dict:
    """Computes transit time from Vokzal to KarGTU using sequential NetworkX weighted routing."""
    G_bus = nx.DiGraph()
    G_bus.add_edge("Vokzal", "City Mall", base_time=8.0)
    G_bus.add_edge("City Mall", "Meduniversitet", base_time=6.0)
    G_bus.add_edge("Meduniversitet", "KarGTU", base_time=10.0)
    
    bus_multiplier = 1.0 + (congestion_index_bus / 100.0) * 1.5
    for u, v, d in G_bus.edges(data=True):
        G_bus[u][v]['weight'] = d['base_time'] * bus_multiplier
        
    G_lrt = nx.DiGraph()
    G_lrt.add_edge("Vokzal", "City Mall", base_time=4.0)
    G_lrt.add_edge("City Mall", "Meduniversitet", base_time=3.0)
    G_lrt.add_edge("Meduniversitet", "KarGTU", base_time=5.0)
    
    lrt_multiplier = 1.0 + (congestion_index_lrt / 100.0) * 0.1
    for u, v, d in G_lrt.edges(data=True):
        G_lrt[u][v]['weight'] = d['base_time'] * lrt_multiplier
        
    path = ["Vokzal", "City Mall", "Meduniversitet", "KarGTU"]
    time_bus = sum(G_bus[path[i]][path[i+1]]['weight'] for i in range(len(path)-1))
    time_lrt = sum(G_lrt[path[i]][path[i+1]]['weight'] for i in range(len(path)-1))
    
    return {
        "bus": {
            "total_time_min": round(time_bus, 1),
            "stages": {f"{path[i]}->{path[i+1]}": round(G_bus[path[i]][path[i+1]]['weight'], 1) for i in range(len(path)-1)}
        },
        "lrt": {
            "total_time_min": round(time_lrt, 1),
            "stages": {f"{path[i]}->{path[i+1]}": round(G_lrt[path[i]][path[i+1]]['weight'], 1) for i in range(len(path)-1)}
        },
        "delta_percent": round(((time_bus - time_lrt) / time_bus) * 100, 1)
    }

# ── INVERSE DISTANCE WEIGHTING (IDW) GEOSPATIAL INTERPOLATION ──
def compute_idw_grid(points: list, grid_size: int = 15, width: float = 600.0, height: float = 450.0) -> list:
    """Computes a 2D interpolated matrix overlay using Inverse Distance Weighting."""
    if not points:
        grid = []
        for i in range(grid_size):
            for j in range(grid_size):
                grid.append({
                    "x": round((i + 0.5) * (width / grid_size), 1),
                    "y": round((j + 0.5) * (height / grid_size), 1),
                    "val": 0.0
                })
        return grid
        
    grid = []
    x_step = width / grid_size
    y_step = height / grid_size
    
    for i in range(grid_size):
        for j in range(grid_size):
            gx = (i + 0.5) * x_step
            gy = (j + 0.5) * y_step
            
            num = 0.0
            den = 0.0
            exact_match = False
            exact_val = 0.0
            
            for pt in points:
                dx = gx - pt["x"]
                dy = gy - pt["y"]
                dist_sq = dx*dx + dy*dy
                if dist_sq < 1e-4:
                    exact_match = True
                    exact_val = pt["val"]
                    break
                
                weight = 1.0 / dist_sq
                num += pt["val"] * weight
                den += weight
                
            if exact_match:
                val = exact_val
            elif den > 0:
                val = num / den
            else:
                val = 0.0
                
            grid.append({
                "x": round(gx, 1),
                "y": round(gy, 1),
                "val": round(val, 2)
            })
    return grid

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
    power_kw: Optional[float] = None

class UnifiedTelemetry(BaseModel):
    channel: Optional[str] = None
    node_id: Optional[str] = None
    district_id: Optional[str] = "nurzhol_sector_A"
    timestamp: Optional[str] = None
    scenario: Optional[str] = None
    metrics: Optional[dict] = None
    ai_trigger: Optional[bool] = None
    # Original hardware fields
    temp_c: Optional[float] = None
    distance_cm: Optional[float] = None
    flow_speed_kmh: Optional[float] = 0.0
    lane_blocked: Optional[bool] = False
    power_kw: Optional[float] = None
    # Fleet positions
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    heading_deg: Optional[float] = None

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

class SmartControlRequest(BaseModel):
    district_id: str = "nurzhol_sector_A"
    mode: str = "AUTO"
    metrics: Optional[TwinMetrics] = None
    hardware: dict = {}
    manual_action: Optional[str] = None

# ─────────────────────────────────────────────
# SMART GRID + SIGNAL CONTROL STATE
# ─────────────────────────────────────────────
smart_control_state = {
    "district_id": "nurzhol_sector_A",
    "mode": "AUTO",
    "risk_level": "LOW",
    "signal_phase": "GREEN_EW",
    "power_state": "ON",
    "relay_command": "RELAY_ON",
    "traffic_light": {"red": False, "yellow": False, "green": True},
    "power_usage_kw": 0.0,
    "reason": "System initialized. Waiting for telemetry.",
    "recommended_actions": [],
    "last_updated": utc_now(),
}

def _estimate_power_kw(metrics: Optional[TwinMetrics], hardware: dict) -> float:
    if hardware.get("power_kw") is not None:
        return round(float(hardware["power_kw"]), 2)
    if not metrics:
        return 0.0
    heat_component = max(0.0, metrics.facade_heat_loss_w_m2 - 70.0) * 0.035
    co2_component = max(0.0, metrics.air_quality_co2_ppm - 400.0) * 0.002
    temp_component = max(0.0, metrics.ambient_temp_c - 25.0) * 0.18
    return round(2.8 + heat_component + co2_component + temp_component, 2)

def _local_smart_control(req: SmartControlRequest) -> dict:
    metrics = req.metrics
    hardware = req.hardware or {}
    power_kw = _estimate_power_kw(metrics, hardware)
    temp_c = float(hardware.get("temp_c") or hardware.get("temperature") or (metrics.ambient_temp_c if metrics else 0.0))
    speed = float(hardware.get("flow_speed_kmh") or (metrics.traffic_speed_kmh if metrics else 50.0))
    congestion = float(metrics.congestion_index if metrics else (100 if hardware.get("lane_blocked") else 20))
    heat_loss = float(metrics.facade_heat_loss_w_m2 if metrics else 90.0)
    lane_blocked = bool(hardware.get("lane_blocked", False))

    signal_phase = "GREEN_EW"
    power_state = "ON"
    relay_command = "RELAY_ON"
    risk = "LOW"
    actions = ["Keep normal monitoring cycle"]
    reason = "Telemetry is within normal operating range."

    if req.manual_action:
        action = req.manual_action.upper()
        if action == "POWER_OFF":
            power_state, relay_command = "OFF", "RELAY_OFF"
            risk, reason = "MANUAL", "Operator manually switched prototype power output off."
        elif action == "POWER_ON":
            power_state, relay_command = "ON", "RELAY_ON"
            risk, reason = "MANUAL", "Operator manually restored prototype power output."
        elif action in {"GREEN_EW", "GREEN_NS", "YELLOW_HOLD", "ALL_RED"}:
            signal_phase = action
            risk, reason = "MANUAL", f"Operator manually selected traffic phase {action}."
        actions = ["Manual override active", "Return to AUTO after demo step"]
    elif temp_c >= 45 or power_kw >= 9.5:
        risk = "CRITICAL"
        signal_phase = "ALL_RED"
        power_state = "OFF"
        relay_command = "RELAY_OFF"
        reason = "Critical heat or power load detected. Prototype relay output disabled."
        actions = ["Cut non-critical prototype load", "Hold traffic safely", "Notify operator"]
    elif lane_blocked or speed < 15:
        risk = "HIGH"
        signal_phase = "YELLOW_HOLD"
        power_state = "REDUCED" if power_kw > 6.5 else "ON"
        relay_command = "RELAY_LIMIT" if power_state == "REDUCED" else "RELAY_ON"
        reason = "Lane blockage detected. Holding cautious signal cycle and reducing load if needed."
        actions = ["Activate yellow caution", "Prioritize emergency clearance", "Watch power trend"]
    elif congestion >= 70 or speed < 28:
        risk = "MEDIUM"
        signal_phase = "GREEN_EW"
        power_state = "REDUCED" if power_kw > 7.0 or heat_loss > 145 else "ON"
        relay_command = "RELAY_LIMIT" if power_state == "REDUCED" else "RELAY_ON"
        reason = "Traffic congestion is high. Extending east-west green wave."
        actions = ["Extend green phase by 20 seconds", "Reduce non-critical lighting load", "Recheck in 30 seconds"]
    elif power_kw > 7.5 or temp_c >= 36:
        risk = "MEDIUM"
        signal_phase = "GREEN_NS"
        power_state = "REDUCED"
        relay_command = "RELAY_LIMIT"
        reason = "Power or temperature is rising. Reducing prototype load while keeping traffic moving."
        actions = ["Dim non-critical load", "Route flow through north-south phase", "Continue monitoring"]

    traffic_light = {
        "red": signal_phase == "ALL_RED",
        "yellow": signal_phase == "YELLOW_HOLD",
        "green": signal_phase in {"GREEN_EW", "GREEN_NS"},
    }

    return {
        "district_id": req.district_id,
        "mode": req.mode,
        "risk_level": risk,
        "signal_phase": signal_phase,
        "power_state": power_state,
        "relay_command": relay_command,
        "traffic_light": traffic_light,
        "power_usage_kw": power_kw,
        "reason": reason,
        "recommended_actions": actions,
        "last_updated": utc_now(),
    }

# ─────────────────────────────────────────────
# ENDPOINTS — IoT Hardware Telemetry
# ─────────────────────────────────────────────
@app.post("/api/telemetry")
async def receive_hardware_telemetry(data: UnifiedTelemetry):
    """Receives live POST packets from physical/simulated edge nodes across multiple domains."""
    if data.channel == "structural":
        m = data.metrics or {}
        accel_x_g = m.get("accel_x_g", 0.0)
        accel_z_g = m.get("accel_z_g", 1.0)
        dominant_freq_hz = m.get("dominant_freq_hz", 12.0)
        displacement_mm = m.get("displacement_mm", 0.2)
        damage_index = m.get("damage_index", 0.02)
        soil_pressure_kpa = m.get("soil_pressure_kpa", 0.0)
        moisture_pct = m.get("moisture_pct", 0.0)

        # Run structural IsolationForest
        df_test = pd.DataFrame([{
            "accel_x_g": accel_x_g,
            "accel_z_g": accel_z_g,
            "dominant_freq_hz": dominant_freq_hz,
            "displacement_mm": displacement_mm,
            "damage_index": damage_index
        }])
        prediction = structural_ml_model.predict(df_test[STRUCTURAL_FEATURES])[0]
        anomaly_score = float(structural_ml_model.score_samples(df_test[STRUCTURAL_FEATURES])[0])
        is_anomaly = bool(prediction == -1)
        confidence = round(max(0, min(100, (0.5 - anomaly_score) * 450))) if is_anomaly else 0

        # Calculate time to concern
        time_to_concern = estimate_time_to_concern(moisture_pct, soil_pressure_kpa)

        # Save to database
        await run_db(_save_structural_log, {
            "district_id": data.district_id or "nurzhol_sector_A",
            "node_id": data.node_id or "bridge_model_01",
            "accel_x_g": accel_x_g,
            "accel_z_g": accel_z_g,
            "dominant_freq_hz": dominant_freq_hz,
            "displacement_mm": displacement_mm,
            "damage_index": damage_index,
            "soil_pressure_kpa": soil_pressure_kpa,
            "moisture_pct": moisture_pct,
            "is_anomaly": int(is_anomaly),
            "anomaly_score": round(anomaly_score, 4)
        })

        payload = {
            "source": "physical_hardware",
            "type": "structural_telemetry",
            "timestamp": data.timestamp or utc_now(),
            "district_id": data.district_id or "nurzhol_sector_A",
            "node_id": data.node_id or "bridge_model_01",
            "metrics": {
                "accel_x_g": accel_x_g,
                "accel_z_g": accel_z_g,
                "dominant_freq_hz": dominant_freq_hz,
                "displacement_mm": displacement_mm,
                "damage_index": damage_index,
                "soil_pressure_kpa": soil_pressure_kpa,
                "moisture_pct": moisture_pct
            },
            "ml_analysis": {
                "is_anomaly": is_anomaly,
                "anomaly_score": round(anomaly_score, 3),
                "confidence_pct": confidence
            },
            "time_to_concern_hours": time_to_concern
        }
        await manager.broadcast(json.dumps(payload))
        return {"status": "SUCCESS", "channel": "structural", "clients": len(manager.active_connections)}

    elif data.channel == "mobility":
        m = data.metrics or {}
        scenario = m.get("scenario") or data.scenario or "A"
        avg_speed_kmh = m.get("avg_speed_kmh", 22.0)
        congestion_index = m.get("congestion_index", 50.0)
        co2_g_passenger_km = m.get("co2_g_passenger_km", 120.0)
        rider_count = m.get("rider_count", 1500)

        await run_db(_save_mobility_log, {
            "district_id": data.district_id or "nurzhol_sector_A",
            "scenario": scenario,
            "avg_speed_kmh": avg_speed_kmh,
            "congestion_index": congestion_index,
            "co2_g_passenger_km": co2_g_passenger_km,
            "rider_count": rider_count
        })

        payload = {
            "source": "physical_hardware",
            "type": "mobility_telemetry",
            "timestamp": data.timestamp or utc_now(),
            "district_id": data.district_id or "nurzhol_sector_A",
            "scenario": scenario,
            "metrics": {
                "avg_speed_kmh": avg_speed_kmh,
                "congestion_index": congestion_index,
                "co2_g_passenger_km": co2_g_passenger_km,
                "rider_count": rider_count
            }
        }
        await manager.broadcast(json.dumps(payload))
        return {"status": "SUCCESS", "channel": "mobility", "clients": len(manager.active_connections)}

    elif data.channel == "fleet":
        m = data.metrics or {}
        position_x = data.position_x if data.position_x is not None else m.get("position_x", 100.0)
        position_y = data.position_y if data.position_y is not None else m.get("position_y", 100.0)
        heading_deg = data.heading_deg if data.heading_deg is not None else m.get("heading_deg", 0.0)
        gas_co_ppm = m.get("gas_co_ppm", 10.0)
        chromium_mpc_multiplier = m.get("chromium_mpc_multiplier", 1.0)
        temperature_c = m.get("temperature_c", 20.0)
        humidity_pct = m.get("humidity_pct", 40.0)

        await run_db(_save_fleet_log, {
            "district_id": data.district_id or "qarmet_sector_B",
            "node_id": data.node_id or "robot_01",
            "position_x": position_x,
            "position_y": position_y,
            "heading_deg": heading_deg,
            "gas_co_ppm": gas_co_ppm,
            "chromium_mpc_multiplier": chromium_mpc_multiplier,
            "temperature_c": temperature_c,
            "humidity_pct": humidity_pct
        })

        payload = {
            "source": "physical_hardware",
            "type": "fleet_telemetry",
            "timestamp": data.timestamp or utc_now(),
            "district_id": data.district_id or "qarmet_sector_B",
            "node_id": data.node_id or "robot_01",
            "position_x": position_x,
            "position_y": position_y,
            "heading_deg": heading_deg,
            "metrics": {
                "gas_co_ppm": gas_co_ppm,
                "chromium_mpc_multiplier": chromium_mpc_multiplier,
                "temperature_c": temperature_c,
                "humidity_pct": humidity_pct
            }
        }
        await manager.broadcast(json.dumps(payload))
        return {"status": "SUCCESS", "channel": "fleet", "clients": len(manager.active_connections)}

    else:
        # Fallback to original hardware telemetry behavior
        node_id = data.node_id or "ESP32-NODE-ASTANA-01"
        temp_c = data.temp_c if data.temp_c is not None else 25.0
        distance_cm = data.distance_cm if data.distance_cm is not None else 50.0
        flow_speed_kmh = data.flow_speed_kmh if data.flow_speed_kmh is not None else 0.0
        lane_blocked = bool(data.lane_blocked)
        power_kw = data.power_kw

        logger.info("ESP32 [%s]: Temp=%.1f°C  Speed=%.1f km/h", node_id, temp_c, flow_speed_kmh)

        control_decision = _local_smart_control(SmartControlRequest(
            district_id="nurzhol_sector_A",
            mode="AUTO",
            hardware={
                "temp_c": temp_c,
                "distance_cm": distance_cm,
                "flow_speed_kmh": flow_speed_kmh,
                "lane_blocked": lane_blocked,
                "power_kw": power_kw,
            }
        ))
        smart_control_state.update(control_decision)

        payload = {
            "source": "physical_hardware",
            "node_id": node_id,
            "type": "esp32_telemetry",
            "payload": {
                "temperature": temp_c,
                "distance_sensor": distance_cm,
                "calculated_speed": flow_speed_kmh,
                "lane_status": "BLOCKED" if lane_blocked else "CLEAR",
                "power_usage_kw": control_decision["power_usage_kw"],
                "control": control_decision,
            }
        }
        await manager.broadcast(json.dumps(payload))
        await manager.broadcast(json.dumps({
            "source": "smart_control",
            "type": "control_decision",
            "payload": control_decision,
        }))
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

    if data.ai_trigger or is_anomaly:
        control_decision = _local_smart_control(SmartControlRequest(
            district_id=data.district_id,
            mode="AUTO",
            metrics=m,
        ))
        smart_control_state.update(control_decision)
        await manager.broadcast(json.dumps({
            "source": "smart_control",
            "type": "control_decision",
            "payload": control_decision,
        }))

    return {"status": "SUCCESS", "clients": len(manager.active_connections), "is_anomaly": is_anomaly}

# ─────────────────────────────────────────────
# ENDPOINTS — Smart Grid + Signal Control
# ─────────────────────────────────────────────
@app.get("/api/control/status")
async def get_control_status():
    return smart_control_state

@app.post("/api/control/decision")
async def create_control_decision(req: SmartControlRequest):
    decision = _local_smart_control(req)
    smart_control_state.update(decision)

    await run_db(_save_control_event, {
        "district_id": decision["district_id"],
        "mode": decision["mode"],
        "risk_level": decision["risk_level"],
        "signal_phase": decision["signal_phase"],
        "power_state": decision["power_state"],
        "power_usage_kw": decision["power_usage_kw"],
        "reason": decision["reason"],
        "action_json": json.dumps(decision["recommended_actions"]),
    })

    await manager.broadcast(json.dumps({
        "source": "smart_control",
        "type": "control_decision",
        "payload": decision,
    }))
    return decision

@app.post("/api/control/manual")
async def manual_control(req: SmartControlRequest):
    if not req.manual_action:
        raise HTTPException(status_code=400, detail="manual_action is required")
    req.mode = "MANUAL"
    return await create_control_decision(req)

# ─────────────────────────────────────────────
# ENDPOINTS — Traffic AI Analysis (Gemini)
# ─────────────────────────────────────────────
@app.post("/api/analyze")
async def analyze_telemetry(payload: TelemetryPayload):
    api_key = os.getenv("GEMINI_API_KEY")
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
async def analyze_thermo(payload: ThermoPayload):
    api_key = os.getenv("GEMINI_API_KEY")
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

    # ── Persist thermo audit to PostgreSQL ──
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
# ENDPOINTS — AI CHAT (saves history to DB)
# ─────────────────────────────────────────────
@app.post("/api/chat")
async def ai_chat(req: ChatRequest):
    """
    Handles AI chat messages for both traffic and thermo modes.
    Saves conversation to chat_history table.
    Returns AI reply (Gemini or local fallback).
    """
    api_key = os.getenv("GEMINI_API_KEY")

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
    elif mode == "structural":
        system = f"""Ты — ведущий AI-консультант по строительной безопасности и геотехническому мониторингу (Structural Health Advisor) системы KHA-DIVERGENT для Астаны.
Твоя работа регулируется нормами СП РК 2.03-30-2017 и SP RK EN 1998-5 (сейсмостойкое проектирование в Казахстане).
Данные датчиков конструкции:
• Ускорение X: {context.get('accel_x_g', '?')} g
• Ускорение Z: {context.get('accel_z_g', '?')} g
• Доминантная частота: {context.get('dominant_freq_hz', '?')} Гц
• Смещение: {context.get('displacement_mm', '?')} мм
• Индекс повреждения конструкции: {context.get('damage_index', '?')}
• Давление грунта: {context.get('soil_pressure_kpa', '?')} кПа
• Влажность грунта: {context.get('moisture_pct', '?')}%
• Статус аномалий ML: {'Аномалия обнаружена!' if context.get('isAnomaly') else 'Нормальное состояние'}
• Расчетное время до критического состояния: {context.get('timeToConcern', '?')} ч.
Отвечай кратко и профессионально (2-4 предложения). Давай рекомендации в терминах СП РК и Еврокодов (усиление ригелей, инъектирование грунтов, укрепление анкерами)."""
    elif mode == "mobility":
        system = f"""Ты — AI-транспортный экономист и специалист по планированию городской мобильности системы KHA-DIVERGENT для Астаны.
Учитывай опыт ЛРТ Астаны (Tarlan Astana, 2026), задержки проекта и критику исходных прогнозов.
Текущие показатели коридора Караганда-Темиртау (сравнение сценариев):
• Автобусы (Сценарий А): Скорость: {context.get('bus_speed', '?')} км/ч, Заторы: {context.get('bus_congestion', '?')}%, CO₂: {context.get('bus_co2', '?')} г/пасс-км, Пассажиропоток: {context.get('bus_riders', '?')} пасс/день.
• LRT (Сценарий B): Скорость: {context.get('lrt_speed', '?')} км/ч, Заторы: {context.get('lrt_congestion', '?')}%, CO₂: {context.get('lrt_co2', '?')} г/пасс-км, Пассажиропоток: {context.get('lrt_riders', '?')} пасс/день.
• Время в пути (NetworkX): Автобус: {context.get('bus_travel_time', '?')} мин, LRT: {context.get('lrt_travel_time', '?')} мин.
Отвечай кратко и экономически аргументированно (2-4 предложения). Доказывай окупаемость LRT, оперируя цифрами (пассажиропоток ~28,000 в день, интервал движения 8-9 минут при 60% загрузке поездов по 350 мест, окупаемость 25-30 лет)."""
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
        return f"Статус: скорость {speed:.1f} км/ч, заторы {cong}%, CO₂ {co2:.0f} PPM. Добавьте Gemini API ключ в .env для детального анализа."
    elif mode == "structural":
        ax = ctx.get("accel_x_g", 0.0)
        az = ctx.get("accel_z_g", 1.0)
        df = ctx.get("dominant_freq_hz", 12.0)
        di = ctx.get("damage_index", 0.02)
        status = "⚠️ Критическое повреждение" if di > 0.4 else "✅ Конструкция стабильна"
        return f"{status}. Индекс повреждения: {di:.2f}. Частота колебаний: {df:.1f} Гц. Ускорение Z: {az:.2f}g. По СП РК 2.03-30-2017: показатели в пределах проектных допусков."
    elif mode == "mobility":
        bus_t = ctx.get("bus_travel_time", 24.0)
        lrt_t = ctx.get("lrt_travel_time", 12.0)
        co2_saving = 120.0 - 15.0 # bus vs lrt
        return f"Экономический анализ: LRT сокращает время в пути с {bus_t} мин до {lrt_t} мин (экономия {bus_t - lrt_t} мин). Снижение выбросов CO₂ на пассажиро-километр составляет {co2_saving:.1f} г (сокращение на 87.5%). Проектный срок окупаемости: 26 лет при 28,000 пасс/день."
    else:
        b = ctx.get("selectedBuilding") or {}
        if not b:
            return "Пожалуйста, выберите здание на карте для получения теплового анализа."
        h0 = b.get('h0', 0)
        if any(k in m for k in ["insulation", "изоляция", "утеплитель", "материал"]):
            return f"Для {b.get('name','здания')} ({h0} Вт/м²): рекомендую базальтовую вату 120-150 мм для климата Астаны. Текущая: {b.get('insulation','неизвестно')}."
        if any(k in m for k in ["cost", "стоимость", "экономия", "savings", "окупаемость"]):
            savings = round(h0 * 0.4 * 2300)
            return f"Расчётная экономия для {b.get('name','здания')}: ~${savings:,} KZT/year с утеплением 150 мм. Окупаемость ~4-6 лет."
        if any(k in m for k in ["rating", "класс", "energy", "энергия"]):
            rating = "A" if h0 < 55 else "B" if h0 < 90 else "C" if h0 < 130 else "D" if h0 < 185 else "E"
            return f"{b.get('name','Здание')} — энергокласс {rating} ({h0} Вт/м²). Целевой стандарт СНИП РК: <80 Вт/м²."
        return f"{b.get('name','Здание')} ({b.get('id','?')}): теплопотери {h0} Вт/м², год {b.get('age','?')}, изоляция: {b.get('insulation','?')}. Добавьте Gemini API ключ в .env для полного анализа."

# ─────────────────────────────────────────────
# ENDPOINTS — Database History (Pandas-powered)
# ─────────────────────────────────────────────
@app.get("/api/history/traffic")
async def get_traffic_history(limit: int = 50):
    """Returns recent traffic telemetry records from PostgreSQL via Pandas DataFrame."""
    records = await run_db(_fetch_traffic_history, limit)
    return {"records": records, "count": len(records)}

@app.get("/api/history/thermo")
async def get_thermo_history(limit: int = 30):
    """Returns recent thermographic audit records from PostgreSQL via Pandas DataFrame."""
    records = await run_db(_fetch_thermo_history, limit)
    return {"records": records, "count": len(records)}

@app.get("/api/history/chat")
async def get_chat_history(
    session_id: str = "default",
    mode: str = "traffic",
    limit: int = 30
):
    """Returns chat history for a given session from PostgreSQL."""
    records = await run_db(_fetch_chat_history, session_id, mode, limit)
    return {"records": records, "session_id": session_id, "mode": mode}

@app.get("/api/history/control")
async def get_control_history(limit: int = 30):
    """Returns recent smart grid / signal control decisions."""
    records = await run_db(_fetch_control_history, limit)
    return {"records": records, "count": len(records)}

@app.get("/api/history/structural")
async def get_structural_history(limit: int = 50):
    """Returns recent structural telemetry logs."""
    records = await run_db(_fetch_structural_history, limit)
    return {"records": records, "count": len(records)}

@app.get("/api/history/mobility")
async def get_mobility_history(limit: int = 50):
    """Returns recent mobility telemetry logs."""
    records = await run_db(_fetch_mobility_history, limit)
    return {"records": records, "count": len(records)}

@app.get("/api/history/fleet")
async def get_fleet_history(limit: int = 50):
    """Returns recent fleet telemetry logs and computes live IDW heatmap grid."""
    records = await run_db(_fetch_fleet_history, limit)
    points = [{"x": r["position_x"], "y": r["position_y"], "val": r["chromium_mpc_multiplier"]} for r in records if r["position_x"] is not None]
    heatmap_grid = compute_idw_grid(points, grid_size=15)
    return {"records": records, "count": len(records), "heatmap": heatmap_grid}

@app.get("/api/scenario/compare")
async def compare_scenarios():
    """Compares Scenario A (bus) vs Scenario B (LRT) travel times via NetworkX and forecasts via Prophet."""
    conn = _db_connect()
    df_a = pd.read_sql_query("SELECT ts, avg_speed_kmh, congestion_index, co2_g_passenger_km, rider_count FROM mobility_logs WHERE scenario = 'A' ORDER BY id DESC LIMIT 100", conn)
    df_b = pd.read_sql_query("SELECT ts, avg_speed_kmh, congestion_index, co2_g_passenger_km, rider_count FROM mobility_logs WHERE scenario = 'B' ORDER BY id DESC LIMIT 100", conn)
    conn.close()
    
    stats_a = {
        "avg_speed": round(float(df_a["avg_speed_kmh"].mean()), 1) if not df_a.empty else 22.0,
        "avg_congestion": round(float(df_a["congestion_index"].mean()), 1) if not df_a.empty else 65.0,
        "avg_co2": round(float(df_a["co2_g_passenger_km"].mean()), 1) if not df_a.empty else 120.0,
        "avg_riders": round(float(df_a["rider_count"].mean()), 0) if not df_a.empty else 1500.0
    }
    stats_b = {
        "avg_speed": round(float(df_b["avg_speed_kmh"].mean()), 1) if not df_b.empty else 45.0,
        "avg_congestion": round(float(df_b["congestion_index"].mean()), 1) if not df_b.empty else 15.0,
        "avg_co2": round(float(df_b["co2_g_passenger_km"].mean()), 1) if not df_b.empty else 15.0,
        "avg_riders": round(float(df_b["rider_count"].mean()), 0) if not df_b.empty else 2800.0
    }
    
    routing = calculate_corridor_travel_times(stats_a["avg_congestion"], stats_b["avg_congestion"])
    
    forecast_a_speed = []
    forecast_b_speed = []
    status = "success"
    
    try:
        from prophet import Prophet
        import logging
        logging.getLogger('prophet').setLevel(logging.ERROR)
        logging.getLogger('cmdstanpy').setLevel(logging.ERROR)
        
        def run_prophet_forecast(df, col):
            if len(df) < 10:
                raise Exception("Insufficient data for Prophet")
            df_prophet = df[['ts', col]].rename(columns={'ts': 'ds', col: 'y'})
            df_prophet['ds'] = pd.to_datetime(df_prophet['ds']).dt.tz_localize(None)
            m = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
            m.fit(df_prophet)
            future = m.make_future_dataframe(periods=30, freq='s', include_history=False)
            forecast = m.predict(future)
            return forecast[['ds', 'yhat']].to_dict(orient="records")
            
        forecast_a_speed = run_prophet_forecast(df_a, "avg_speed_kmh")
        forecast_b_speed = run_prophet_forecast(df_b, "avg_speed_kmh")
        
        for item in forecast_a_speed:
            item['ds'] = item['ds'].strftime("%Y-%m-%dT%H:%M:%SZ")
        for item in forecast_b_speed:
            item['ds'] = item['ds'].strftime("%Y-%m-%dT%H:%M:%SZ")
            
    except Exception as e:
        logger.warning("Prophet scenario forecast failed, using linear trends: %s", e)
        status = "fallback"
        for i in range(1, 31):
            ds_future = (datetime.utcnow() + pd.Timedelta(seconds=i)).strftime("%Y-%m-%dT%H:%M:%SZ")
            forecast_a_speed.append({"ds": ds_future, "yhat": round(max(5.0, stats_a["avg_speed"] - 0.05 * i), 1)})
            forecast_b_speed.append({"ds": ds_future, "yhat": round(min(80.0, stats_b["avg_speed"] + 0.02 * i), 1)})
            
    return {
        "scenario_a": stats_a,
        "scenario_b": stats_b,
        "routing": routing,
        "forecast_a": forecast_a_speed,
        "forecast_b": forecast_b_speed,
        "status": status
    }

@app.get("/api/db/stats")
async def get_db_stats():
    """Returns database statistics and Pandas-computed analytics."""
    stats = await run_db(_fetch_db_stats)
    return stats

# ─────────────────────────────────────────────
# ENDPOINTS — Config & Forecasting
# ─────────────────────────────────────────────
@app.get("/api/config")
async def get_config():
    """Check configuration settings."""
    return {"gemini_active": bool(os.getenv("GEMINI_API_KEY"))}

@app.get("/api/forecast")
async def get_forecast():
    """
    Fetches historical telemetry data from TimescaleDB, fits a Prophet model,
    and returns a 30-second forecast for traffic speed and CO2 levels.
    """
    conn = _db_connect()
    if DB_BACKEND == "sqlite":
        df = pd.read_sql_query("""
            SELECT ts, traffic_speed, co2_ppm
            FROM traffic_logs
            WHERE datetime(ts) >= datetime('now', '-5 minutes')
            ORDER BY ts ASC
        """, conn)
    else:
        df = pd.read_sql_query("""
            SELECT ts, traffic_speed, co2_ppm 
            FROM traffic_logs 
            WHERE ts >= NOW() - INTERVAL '5 minutes'
            ORDER BY ts ASC
        """, conn)
    conn.close()
    
    if df.empty or len(df) < 10:
        return {"speed_forecast": [], "co2_forecast": [], "status": "insufficient_data"}
        
    df['ds'] = pd.to_datetime(df['ts']).dt.tz_localize(None)
    
    speed_forecast_list = []
    co2_forecast_list = []
    status = "success"
    
    try:
        from prophet import Prophet
        import logging
        logging.getLogger('prophet').setLevel(logging.ERROR)
        logging.getLogger('cmdstanpy').setLevel(logging.ERROR)
        
        # Speed Forecast
        df_speed = df[['ds', 'traffic_speed']].rename(columns={'traffic_speed': 'y'})
        m_speed = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
        m_speed.fit(df_speed)
        future_speed = m_speed.make_future_dataframe(periods=30, freq='s', include_history=False)
        forecast_speed = m_speed.predict(future_speed)
        speed_forecast_list = forecast_speed[['ds', 'yhat']].to_dict(orient="records")
        
        # CO2 Forecast
        df_co2 = df[['ds', 'co2_ppm']].rename(columns={'co2_ppm': 'y'})
        m_co2 = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
        m_co2.fit(df_co2)
        future_co2 = m_co2.make_future_dataframe(periods=30, freq='s', include_history=False)
        forecast_co2 = m_co2.predict(future_co2)
        co2_forecast_list = forecast_co2[['ds', 'yhat']].to_dict(orient="records")
    except Exception as e:
        logger.error("Prophet forecasting failed, using fallback trend: %s", e)
        last_ts = df['ds'].iloc[-1]
        last_speed = df['traffic_speed'].iloc[-1]
        last_co2 = df['co2_ppm'].iloc[-1]
        
        speed_trend = (df['traffic_speed'].iloc[-1] - df['traffic_speed'].iloc[0]) / len(df) if len(df) > 1 else 0
        co2_trend = (df['co2_ppm'].iloc[-1] - df['co2_ppm'].iloc[0]) / len(df) if len(df) > 1 else 0
        
        for i in range(1, 31):
            ds_future = last_ts + pd.Timedelta(seconds=i)
            speed_forecast_list.append({
                "ds": ds_future,
                "yhat": max(5.0, min(80.0, last_speed + speed_trend * i))
            })
            co2_forecast_list.append({
                "ds": ds_future,
                "yhat": max(300.0, min(1200.0, last_co2 + co2_trend * i))
            })
        status = "fallback"

    for item in speed_forecast_list:
        item['ds'] = item['ds'].strftime("%Y-%m-%dT%H:%M:%SZ")
    for item in co2_forecast_list:
        item['ds'] = item['ds'].strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "speed_forecast": speed_forecast_list,
        "co2_forecast": co2_forecast_list,
        "status": status
    }

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
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")

# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
