# 🌟 KHA-DIVERGENT Platform Capabilities (What This App Can Do)

The **KHA-DIVERGENT Unified Digital Twin Platform** is a multi-domain, time-series powered urban and industrial double designed for real-time monitoring, machine learning safety auditing, and autonomous AI-driven dispatching. 

Here is a breakdown of what the application does:

---

## 🚦 1. Dynamic Real-Time Telemetry & Multi-Channel Ingestion
The platform runs a high-throughput, concurrent ingestion loop via FastAPI (`/api/telemetry` and `/api/twin/telemetry`) that receives, parses, and logs time-series data across four independent operational channels:
- **Traffic & Ambient Conditions**: Tracks road speeds, lane congestion index, and ambient air CO₂ pollution (PPM).
- **Thermographics & Energy Audit**: Tracks building envelopes, building age, insulation profiles, and active surface heat dissipation (W/m²).
- **Structural Health (SP RK 2.03-30-2017)**: Captures sub-millimeter displacement, structural damage indexes, soil moisture (%), soil lateral pressure (kPa), and dual-axis acceleration vectors.
- **Fleet Environmental Robots**: Ingests real-time telemetry from up to 4 mobile detector robots patrolling heavy metal industrial sites (such as the Qarmet metallurgical complex).

---

## 🧠 2. Machine Learning & Predictive Anomaly Detection
The backend features two independent **scikit-learn Isolation Forest** models trained automatically on startup using nominal baseline distributions:
- **Traffic Anomaly Classifier**: Detects traffic jams, gridlocks, and sudden air pollution spikes.
- **Structural Anomaly Classifier**: Detects seismic events, retaining wall strain, and high-vibration bridge displacement.
- Each incoming telemetry vector is evaluated in real-time, yielding a classification state (**NORMAL** vs. **ANOMALY**), an anomaly score, and a confidence percentage.

---

## 📐 3. Advanced Geostructural & Transportation Mathematics
- **Geotechnical Heuristic Regression**: Analyzes lateral pressure and moisture trends behind concrete retaining walls. It uses linear regression to project a **"Time to Concern" (hours remaining)** before structural limits are violated.
- **NetworkX Shortest-Path Commute Times**: Models the corridor between Vokzal and KarGTU as a sequential graph (`Vokzal ➔ City Mall ➔ Meduniversitet ➔ KarGTU`). It dynamically adjusts edge weights based on congestion parameters to compute live travel time deltas between Scenario A (Buses) and Scenario B (LRT).
- **IDW Geospatial Soil Interpolation**: Takes coordinate streams ($x, y$) and chromium pollution readings from the mobile robot fleet to compute a live **Inverse Distance Weighting (IDW)** grid overlay. This simulates a real-time kriging soil pollution map.

---

## 🤖 4. Autonomous Control & Generative AI Experts (Gemini 2.5)
The platform features an active smart grid loop that makes automated decisions (e.g., triggering `GREEN_WAVE` traffic sequences or `BUS_PRIORITY` channels) and coordinates four domain-specific **Gemini 2.5 Flash** expert advisors:
1. **Traffic AI Coordinator**: Optimizes intersection signal phases, responds to congestion bottlenecks, and clears corridors for emergency vehicles.
2. **Energy Efficiency Consultant**: Performs building thermal loss audits, recommends insulation materials (basalt wool, PIR plates, polyurethane), and calculates retrofit payback periods (ROI in KZT).
3. **Structural Safety Advisor (СП РК)**: Reviews structural integrity, flags safety code violations, and suggests anchor reinforcements in accordance with **СП РК 2.03-30-2017** and **SP RK EN 1998-5**.
4. **Transit Economist (LRT Specialist)**: Computes LRT payback periods, calculates environmental savings from zero-emission transport offsets, and provides economic justifications using data points from the Astana LRT project.

---

## 🖥️ 5. Operator Panel & Database Transaction Monitoring
- **Real-Time Interactive Canvas**: Visualizes dynamic road vectors, traffic light indicators, building insulation maps, and circular robot movement trajectories.
- **Live 2D IDW Heatmap Overlay**: Renders a pink-to-red chromium exceedance heatmap layer directly over the industrial plant footprint.
- **SQLite WAL Transaction Monitor**: Displays a live, auto-updating ledger of database records across all 7 schemas (`traffic_logs`, `thermo_logs`, `structural_logs`, `mobility_logs`, `fleet_logs`, `chat_history`, and `control_events`).
- **Interactive Chat Console**: Allows operators to switch chat context between Traffic, Thermo, Structural, and Mobility modes to converse with the corresponding Gemini advisor.
