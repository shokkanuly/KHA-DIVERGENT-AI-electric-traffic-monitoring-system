# Astana Twin: District Digital Core Simulator

**Astana Twin** is a high-fidelity real-time Digital Double (software simulator) of a single city block (Nurzhol sector A, Astana). It is designed to model and correlate street-level telemetry data (traffic speed and density, air quality emissions, building thermal leaks) and audit urban efficiencies using a combination of real Machine Learning (scikit-learn Anomaly Detection) and Generative AI (Gemini 2.5).

---

## 🚀 Key Features

1. **Real-time Telemetry Simulation**: A background simulator (`twin_simulator.py`) generates and streams synthetic telemetry packets once per second, modeling a realistic urban sector with virtual HC-SR04, MQ-135, and DHT22 sensors.
2. **ML Anomaly Classification (scikit-learn)**: An `IsolationForest` model is trained on startup on 300 synthetic nominal records (calibrated to real Astana traffic baselines), preprocessing incoming data with **Pandas DataFrames** and **NumPy** to classify anomalies in real time with confidence percentages.
3. **SQLite Persistent Database (Pandas-powered)**: All telemetry, AI audit results, and chat messages are saved to `kha_divergent.db` (SQLite WAL mode). The `/api/db/stats` endpoint uses `pd.read_sql_query()` to compute live **Pandas analytics** (avg speed, avg CO₂, peak CO₂, etc.) across the last 100 records.
4. **AI Chat Advisor with History (Gemini 2.5 Flash)**: Two domain-specific AI chat advisors — one for traffic, one for thermographics — both route through the FastAPI backend (`/api/chat`), which saves every conversation to SQLite. Chat history **persists across page reloads** and is visible in the DB Monitor panel.
5. **Generative AI Auditing (Gemini 2.5 Flash)**: Analyzes correlation between traffic CO₂ emissions and facade heat loss, drafting green-wave phase durations and building envelope retrofit guidelines with ROI in KZT.
6. **Physical IoT Hardware Layer**: ESP32 firmware (`esp32_firmware.ino`) already written for the physical prototype. Architecture supports POST from any edge device to `/api/telemetry`.
7. **Cyber-Brutalist Operator Dashboard**: Responsive HTML5 Canvas city map, WebSocket real-time stream, Database Monitor panel (4 tabs: Traffic Log / Thermo Log / Chat History / Analytics), scrolling ticker logs.

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

The simulator posts telemetry packets in the following structure:
```json
{
  "timestamp": "2026-06-13T14:15:22Z",
  "district_id": "nurzhol_sector_A",
  "metrics": {
    "traffic_speed_kmh": 12.0, 
    "congestion_index": 89.0, 
    "air_quality_co2_ppm": 850.0, 
    "facade_heat_loss_w_m2": 145.0, 
    "ambient_temp_c": 31.2 
  },
  "ai_trigger": false
}
```

---

## 🛠️ Installation & Setup

Ensure Python 3.10+ is installed on your environment.

### 1. Clone & Install Dependencies
Navigate to the project folder (`y_prototype`) and install the required modules:
```bash
pip install fastapi uvicorn httpx pydantic scikit-learn pandas numpy requests
```

### 2. Start the FastAPI Server
Run the backend web router. It binds to port `8080` and starts training the `IsolationForest` model:
```bash
python main.py
```
*Verification output:*
`INFO:KHA-FastAPICore:Scikit-Learn IsolationForest Anomaly Detector fitted successfully.`
`Uvicorn running on http://0.0.0.0:8080`

### 3. Start the Astana Twin Simulator
In a separate terminal, launch the background data synthesizer to feed live streams into the dashboard:
```bash
python twin_simulator.py
```

### 4. Access the Operator Panel
Open your browser and navigate to:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 📈 ML Methodology and Preprocessing
On startup, a synthetic dataset of 200 normal records is built using `numpy.random.normal` and loaded into a `pandas.DataFrame` representing nominal urban parameters:
- Traffic Speeds: $50 \pm 4 \text{ km/h}$
- Congestion: $30\% \pm 4\%$
- Air Quality (CO2): $410 \text{ PPM} \pm 15 \text{ PPM}$
- Facade Heat Loss: $95 \text{ W/m}^2 \pm 8 \text{ W/m}^2$

We fit an **IsolationForest** model (with a contamination rate of $0.05$). For every incoming simulated packet:
1. Metrics are converted into a Pandas DataFrame.
2. The model predicts normal ($+1$) vs anomaly ($-1$).
3. The raw anomaly score is calculated using `score_samples()`.
4. Anomalies are flagged on the dashboard with a calculated prediction confidence percentage.
