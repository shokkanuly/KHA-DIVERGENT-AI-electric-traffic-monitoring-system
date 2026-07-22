# 🌐 KHA-DIVERGENT: Multi-Domain Digital Twin Platform (Astana Twin v2)

**KHA-DIVERGENT** is a unified, real-time industrial and urban Digital Twin platform. It combines street-level environmental monitoring, geostructural health analysis, transit route scenario comparisons, and mobile environmental fleet surveys into a single dashboard. The core features live Machine Learning (scikit-learn `IsolationForest`), geotechnical regressions, shortest-path DiGraph calculations (NetworkX), Inverse Distance Weighting spatial overlays, and Generative AI (Gemini 2.5) expert personas.

For a full breakdown of platform capabilities and mathematical details, see [FEATURES.md](file:///Users/aibek/Desktop/civil%20project/FEATURES.md).

---

## 🚀 Key Combined Capabilities

1. **Multi-Channel Telemetry Ingestion**: Integrates 4 data streams: Traffic/CO₂ indices, building heat dissipation (DHT22), structural stress (SP RK 2.03-30-2017 bridge sensors), and 4 patrol robots patrolling Qarmet metallurgical complex zones.
2. **Double ML Anomaly Detectors (scikit-learn)**: Runs parallel `IsolationForest` models trained on-the-fly to classify traffic bottle-necks and structural integrity events in real time.
3. **Advanced Civil & Geotechnical Heuristics**:
   - Geotechnical regression forecasting "Time to Concern" hours remaining for retaining walls.
   - NetworkX shortest-path sequential routing comparing Bus vs. LRT commute times.
   - IDW spatial interpolation overlay generating live soil heavy metal contamination maps.
4. **4-Persona AI Chat Advisory Panel**: Persistent chat portals with four expert Gemini personas (Traffic Coordinator, Building Energy Advisor, Structural Safety Engineer, and Transit Economist) that remember chat history across page reloads.
5. **Cyber-Brutalist Operator Panel**: A unified CSS-based dashboard layout combining live Canvas/SVG grids, dynamic IDW heatmaps, scrolling system tick logs, physical IoT edge logs, and transaction tables.

---

## 📐 3-Level Technical Architecture

```
 Level 1: Data Generation     ──[1 packet/sec]──>    Level 2: Backend Core       ──[WebSockets]──>    Level 3: Client Visualization
┌──────────────────────────┐                      ┌───────────────────────────┐                    ┌────────────────────────────┐
│   Virtual IoT Simulator  │                      │   FastAPI Async Router    │                    │     Browser Client UI      │
│  (Python Synthesizer)    │                      │  (Schema & Ingest Route)  │                    │   (Monospace Layout)       │
├──────────────────────────┤                      ├───────────────────────────┤                    ├────────────────────────────┤
│  Virtual HC-SR04 Radar   │                      │  State Manager (Local DB) │                    │  Layer A: Traffic Flow     │
│  Virtual MQ-135 (CO2)    │                      │  scikit-learn Anomaly Det │                    │  Layer B: Thermographics   │
│  Virtual DHT22 (Thermo)  │                      │  Gemini AI Analytics Node │                    │  ML & AI Analysis Console  │
└──────────────────────────┘                      └───────────────────────────┘                    └────────────────────────────┘
```

### 1. Level 1: Data Generation (Python Simulator)
- **HC-SR04 (Traffic)**: Tracks traffic average speeds and lane congestion.
- **MQ-135 (CO2)**: Tracks vehicle emissions (PPM).
- **DHT22 (Thermo)**: Monitors ambient temperature and building surface heat loss (W/m²).

### 2. Level 2: Backend Core (FastAPI & scikit-learn)
- **FastAPI Router**: Direct connection point for simulator streams. Validates schemas via Pydantic models.
- **Isolation Forest Model**: Fits a scikit-learn anomaly classifier on historical nominal datasets on startup, evaluating incoming vectors for anomalies and calculating confidence score percentages.
- **AI Analytics Node**: Queries the `gemini-2.5-flash` model to analyze correlations between CO2 pollution peaks and building thermal leakage under freezing/hot conditions.

### 3. Level 3: Client Visualization (HTML5 Canvas UI)
- **Traffic Layer**: Renders vehicle lines, congestion warnings, and active AI signal alterations (Green Wave chevrons / Bus priority).
- **Thermographic Layer**: Renders color-coded heat maps of buildings, simulating insulation upgrades, payback years (ROI), and material guidelines.

---

## 🧪 Data Schema (JSON Payload)
The simulator streams telemetry packets across multiple channels in the following formats:

### 1. Traffic & Thermographic Twin Schema (FastAPI Ingestion)
```json
{
  "timestamp": "2026-06-13T14:15:22Z",
  "district_id": "nurzhol_sector_A",
  "metrics": {
    "traffic_speed_kmh": 52.0, 
    "congestion_index": 30.0, 
    "air_quality_co2_ppm": 410.0, 
    "facade_heat_loss_w_m2": 95.0, 
    "ambient_temp_c": 30.0 
  },
  "ai_trigger": false
}
```

### 2. Structural Health Twin Schema (SP RK 2.03-30-2017)
```json
{
  "channel": "structural",
  "timestamp": "2026-07-09T14:15:22Z",
  "district_id": "nurzhol_sector_A",
  "node_id": "bridge_model_01",
  "metrics": {
    "accel_x_g": 0.02,
    "accel_z_g": 0.98,
    "dominant_freq_hz": 12.4,
    "displacement_mm": 0.31,
    "damage_index": 0.07,
    "soil_pressure_kpa": 12.0,
    "moisture_pct": 35.0
  }
}
```

### 3. Mobility Scenario Comparison Schema
```json
{
  "channel": "mobility",
  "timestamp": "2026-07-09T14:15:22Z",
  "district_id": "nurzhol_sector_A",
  "scenario": "B", // 'A' for Bus corridor, 'B' for LRT
  "metrics": {
    "avg_speed_kmh": 45.0,
    "congestion_index": 15.0,
    "co2_g_passenger_km": 15.0,
    "rider_count": 2800
  }
}
```

### 4. Fleet Environmental Robot Telemetry Schema
```json
{
  "channel": "fleet",
  "timestamp": "2026-07-09T14:15:22Z",
  "district_id": "qarmet_sector_B",
  "node_id": "robot_01",
  "position_x": 120.5,
  "position_y": 80.2,
  "heading_deg": 45.0,
  "metrics": {
    "gas_co_ppm": 12.0,
    "chromium_mpc_multiplier": 45.2,
    "temperature_c": 22.4,
    "humidity_pct": 55.0
  }
}
```

---

## 🛠️ Installation & Setup

Ensure you have Python 3.10+, Node.js (with npm), and Docker installed.

### 1. Setup the Database (TimescaleDB)
Spin up the local TimescaleDB container mapping it to port `5433` (to avoid conflicts with standard PostgreSQL instances):
```bash
docker compose up -d
```
*Note:* The schema is created automatically and converted to a TimescaleDB hyper-table on backend startup.

### 2. Setup Environment Variables
Copy `.env.example` to `.env` and fill in your Gemini API key (optional — runs in local fallback mode if not configured):
```bash
cp .env.example .env
```
Make sure `DB_PORT=5433` is set in the `.env` file to match the Docker container port mapping.

### 3. Build the React Frontend
Navigate to the `frontend/` directory, install package dependencies, and compile the production React bundle:
```bash
cd frontend
npm install
npm run build
cd ..
```
FastAPI is configured to mount and serve the compiled static React assets from `frontend/dist`.

### 4. Install Python Dependencies
Install the required packages including the PostgreSQL driver (`psycopg2-binary`) and forecasting engine (`prophet`):
```bash
python3 -m pip install -r requirements.txt
```

### 5. Start the Services
Run the backend server in one terminal:
```bash
python3 main.py
```

In a second terminal, start the background Digital Twin simulator:
```bash
python3 twin_simulator.py
```

*(Optional)* In a third terminal, start the mock ESP32 Edge transmitter to test the physical IoT node panel logs:
```bash
python3 mock_esp32.py
```

### 6. Access the Operator Panel
Open your browser and navigate to:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 📈 ML & Forecasting Methodology
On startup, a synthetic dataset of 300 normal records is built and loaded into a Pandas DataFrame representing nominal urban parameters. We fit an **IsolationForest** model (with a contamination rate of $0.05$).

For time-series telemetry forecasting:
1. Every 7 seconds, the client fetches a 30-second future forecast for traffic speed and CO₂ level parameters.
2. The FastAPI backend queries the last 5 minutes of time-series telemetry from TimescaleDB.
3. The server fits a **Prophet** forecasting model on this timeline and returns the next 30 seconds of projected data.
4. If Prophet is not available or encounters errors, the server falls back on a sliding window linear regression trend.
5. The forecasted speed is plotted as a dotted cyan line on the dashboard chart.

