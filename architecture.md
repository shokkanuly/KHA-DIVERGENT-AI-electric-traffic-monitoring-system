# Astana Twin: Digital Core Architecture

This document describes the 3-level technical system flowchart for raw street-level data simulation, central routing, correlation analyzing, and dashboard rendering.

## System Diagram (Left-to-Right / 3-Level Flowchart)

```mermaid
graph LR
    %% Define Nodes & Layout
    subgraph L1 ["Level 1: Data Generation"]
        direction TB
        sim["Virtual IoT Simulator (Python)"]
        s_traffic["Virtual HC-SR04 (Traffic)"]
        s_co2["Virtual MQ-135 (CO2)"]
        s_thermo["Virtual DHT22 (Thermo)"]
        
        sim --> s_traffic
        sim --> s_co2
        sim --> s_thermo
    end

    subgraph L2 ["Level 2: Backend Core"]
        direction TB
        fastapi["FastAPI Async Router"]
        db["State Manager (Local DB)"]
        gemini["AI Analytics Node (Gemini)"]
        
        fastapi --> db
        fastapi --> gemini
        
        note["Analyzes correlation between CO2 and facade heat loss"]
        gemini -.-> note
    end

    subgraph L3 ["Level 3: Client Visualization"]
        direction TB
        ui["Browser Client / UI"]
        layer_a["Layer A: Traffic Flow"]
        layer_b["Layer B: Thermographics"]
        
        ui --> layer_a
        ui --> layer_b
    end

    %% Flow Connections (Left to Right)
    s_traffic & s_co2 & s_thermo -->|1 JSON packet/sec| fastapi
    db & gemini -->|WebSocket Data Stream| ui

    %% Styling Elements
    classDef l1 fill:#0a0a0c,stroke:#ff9100,stroke-width:2px,color:#fff;
    classDef l2 fill:#0a0a0c,stroke:#00e5ff,stroke-width:2px,color:#fff;
    classDef l3 fill:#0a0a0c,stroke:#f50057,stroke-width:2px,color:#fff;
    
    class sim,s_traffic,s_co2,s_thermo l1;
    class fastapi,db,gemini l2;
    class ui,layer_a,layer_b l3;
```

---

## Architectural Breakdown

### Level 1: Data Generation
- **Virtual IoT Simulator**: A background Python script generating real-time district environmental data.
- **Virtual HC-SR04 (Traffic)**: Simulates inductive loop and speed radars tracking average traffic velocities and lane congestion indexes.
- **Virtual MQ-135 (CO2)**: Simulates air quality sensor inputs measuring parts per million (PPM) of vehicle emissions.
- **Virtual DHT22 (Thermo)**: Simulates building envelopes, outputting surface heat dissipation rates (W/m²) and local ambient temperatures.

### Level 2: Backend Core
- **FastAPI Async Router**: Central routing trunk. Exposes API endpoints receiving the simulator streams, running validation schemas, and handling socket handshakes.
- **State Manager**: Maintains a localized database of building parameters, road coordinates, and rolling speed histories.
- **AI Analytics Node (Gemini 2.5 Flash)**: Correlates the rising CO2 emissions from traffic bottlenecks with building thermal envelope leaks, drafting real-time green corridor routing and structural retrofit logs.

### Level 3: Client Visualization
- **Browser Client**: A cyber-brutalist dashboard rendering dynamic street vector networks and live gauges.
- **Layer A (Traffic Flow)**: Interactive vector canvas highlighting traffic bottle-necks, congestion indicators, and signal timing corrections.
- **Layer B (Thermographics)**: Thermal audit maps showing building polygon leak thresholds, insulation upgrade payback times, and materials recommendations.
