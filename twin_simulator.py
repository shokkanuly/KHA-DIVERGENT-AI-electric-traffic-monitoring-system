import time
import requests
import random
import math
from datetime import datetime, timezone

URL_TWIN = "http://localhost:8080/api/twin/telemetry"
URL_HARDWARE = "http://localhost:8080/api/telemetry"
DISTRICT_ID = "nurzhol_sector_A"

print("Astana Twin Multi-Channel Simulator active.")
print(f"Streaming twin telemetry to {URL_TWIN}")
print(f"Streaming hardware telemetry (Structural, Mobility, Fleet) to {URL_HARDWARE}")

# ── Baseline parameters ───────────────────────
# Traffic/Thermal
traffic_speed = 52.0
congestion = 30.0
co2_ppm = 410.0
heat_loss = 95.0
ambient_temp = 30.0

# Structural
struct_damage_index = 0.05
struct_freq = 12.4
struct_displacement = 0.25
struct_moisture = 35.0
struct_pressure = 12.0

# Fleet robots state
robots = [
    {"id": "robot_01", "x": 100.0, "y": 100.0, "heading": 0.0},
    {"id": "robot_02", "x": 450.0, "y": 100.0, "heading": 90.0},
    {"id": "robot_03", "x": 100.0, "y": 350.0, "heading": 180.0},
    {"id": "robot_04", "x": 450.0, "y": 350.0, "heading": 270.0},
]

event_timer = 0
is_anomaly_active = False

def utc_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

try:
    while True:
        event_timer += 1
        
        # 1. Traffic/Thermal Anomaly Event Logic (every 30s)
        if event_timer % 30 == 0:
            is_anomaly_active = True
            print("\n[SIMULATOR ALERT] Triggering Traffic & Structural Anomaly Event!")
        elif event_timer % 30 == 10:
            is_anomaly_active = False
            print("\n[SIMULATOR INFO] Resolving anomaly, returning to nominal operations.")

        # ─────────────────────────────────────────────
        # CHANNEL 1: Traffic & Thermographic Twin
        # ─────────────────────────────────────────────
        if is_anomaly_active:
            traffic_speed = max(8.0, traffic_speed - random.uniform(5.0, 10.0))
            congestion = min(95.0, congestion + random.uniform(8.0, 15.0))
            co2_ppm = min(980.0, co2_ppm + random.uniform(50.0, 100.0))
            heat_loss = min(180.0, heat_loss + random.uniform(3.0, 8.0))
            ai_trigger = True
        else:
            traffic_speed = min(58.0, max(42.0, traffic_speed + random.uniform(-2.0, 2.0) if traffic_speed > 30 else traffic_speed + 5.0))
            congestion = max(20.0, min(45.0, congestion + random.uniform(-3.0, 3.0) if congestion < 60 else congestion - 5.0))
            co2_ppm = max(390.0, min(480.0, co2_ppm + random.uniform(-10.0, 10.0) if co2_ppm < 600 else co2_ppm - 40.0))
            heat_loss = max(70.0, min(120.0, heat_loss + random.uniform(-2.0, 2.0) if heat_loss < 140 else heat_loss - 5.0))
            ai_trigger = False
        ambient_temp = max(28.0, min(33.0, ambient_temp + random.uniform(-0.3, 0.3)))

        payload_twin = {
            "timestamp": utc_now(),
            "district_id": DISTRICT_ID,
            "metrics": {
                "traffic_speed_kmh": round(traffic_speed, 1),
                "congestion_index": round(congestion, 1),
                "air_quality_co2_ppm": round(co2_ppm, 1),
                "facade_heat_loss_w_m2": round(heat_loss, 1),
                "ambient_temp_c": round(ambient_temp, 1)
            },
            "ai_trigger": ai_trigger
        }
        
        # ─────────────────────────────────────────────
        # CHANNEL 2: Structural health
        # ─────────────────────────────────────────────
        if is_anomaly_active:
            accel_x = random.uniform(-0.15, 0.15)
            accel_z = 1.0 + random.uniform(-0.25, 0.25)
            struct_freq = max(8.5, struct_freq - 0.4)
            struct_displacement = min(1.8, struct_displacement + 0.12)
            struct_damage_index = min(0.95, struct_damage_index + 0.08)
            struct_moisture = min(88.0, struct_moisture + random.uniform(1.0, 3.5))
            struct_pressure = min(75.0, struct_pressure + random.uniform(2.0, 6.0))
        else:
            accel_x = random.uniform(-0.02, 0.02)
            accel_z = 1.0 + random.uniform(-0.03, 0.03)
            struct_freq = min(12.4, max(11.0, struct_freq + 0.1 if struct_freq < 12.0 else struct_freq + random.uniform(-0.05, 0.05)))
            struct_displacement = max(0.2, min(0.4, struct_displacement - 0.05 if struct_displacement > 0.4 else struct_displacement + random.uniform(-0.02, 0.02)))
            struct_damage_index = max(0.04, min(0.12, struct_damage_index - 0.03 if struct_damage_index > 0.1 else struct_damage_index + random.uniform(-0.005, 0.005)))
            struct_moisture = max(30.0, min(42.0, struct_moisture + random.uniform(-0.5, 0.5)))
            struct_pressure = max(10.0, min(16.0, struct_pressure + random.uniform(-0.2, 0.2)))

        payload_struct = {
            "channel": "structural",
            "timestamp": utc_now(),
            "district_id": DISTRICT_ID,
            "node_id": "bridge_model_01",
            "metrics": {
                "accel_x_g": round(accel_x, 3),
                "accel_z_g": round(accel_z, 3),
                "dominant_freq_hz": round(struct_freq, 1),
                "displacement_mm": round(struct_displacement, 2),
                "damage_index": round(struct_damage_index, 2),
                "soil_pressure_kpa": round(struct_pressure, 1),
                "moisture_pct": round(struct_moisture, 1)
            }
        }

        # ─────────────────────────────────────────────
        # CHANNEL 3: Mobility scenario comparison
        # ─────────────────────────────────────────────
        bus_speed = max(12.0, min(28.0, 20.0 + random.uniform(-3.0, 3.0) - (congestion * 0.1)))
        bus_congestion = min(95.0, max(45.0, 65.0 + random.uniform(-5.0, 5.0) + (congestion * 0.2)))
        bus_co2 = max(90.0, min(150.0, 120.0 + random.uniform(-8.0, 8.0)))
        bus_riders = int(1500 + random.randint(-200, 200))
        
        payload_mobility_a = {
            "channel": "mobility",
            "timestamp": utc_now(),
            "district_id": DISTRICT_ID,
            "scenario": "A",
            "metrics": {
                "avg_speed_kmh": round(bus_speed, 1),
                "congestion_index": round(bus_congestion, 1),
                "co2_g_passenger_km": round(bus_co2, 1),
                "rider_count": bus_riders
            }
        }

        lrt_speed = max(38.0, min(52.0, 45.0 + random.uniform(-1.0, 1.0)))
        lrt_congestion = max(5.0, min(25.0, 12.0 + random.uniform(-2.0, 2.0)))
        lrt_co2 = max(10.0, min(20.0, 15.0 + random.uniform(-1.0, 1.0)))
        lrt_riders = int(2800 + random.randint(-300, 300))

        payload_mobility_b = {
            "channel": "mobility",
            "timestamp": utc_now(),
            "district_id": DISTRICT_ID,
            "scenario": "B",
            "metrics": {
                "avg_speed_kmh": round(lrt_speed, 1),
                "congestion_index": round(lrt_congestion, 1),
                "co2_g_passenger_km": round(lrt_co2, 1),
                "rider_count": lrt_riders
            }
        }

        # ─────────────────────────────────────────────
        # CHANNEL 4: Fleet environmental monitoring
        # ─────────────────────────────────────────────
        hotspot_x, hotspot_y = 300.0, 225.0
        payloads_fleet = []

        for robot in robots:
            robot["heading"] += random.uniform(-15.0, 15.0)
            rad = math.radians(robot["heading"])
            robot["x"] = max(20.0, min(580.0, robot["x"] + math.cos(rad) * 12.0))
            robot["y"] = max(20.0, min(430.0, robot["y"] + math.sin(rad) * 12.0))
            
            dx = robot["x"] - hotspot_x
            dy = robot["y"] - hotspot_y
            dist = math.sqrt(dx*dx + dy*dy)
            
            chromium_val = 348.0 * math.exp(-dist / 140.0) + random.uniform(-2.0, 2.0)
            chromium_val = max(1.0, round(chromium_val, 1))
            
            gas_co = max(1.5, round(25.0 * math.exp(-dist / 160.0) + random.uniform(-0.5, 0.5), 1))
            temp_val = round(21.0 + random.uniform(-1.0, 1.0), 1)
            hum_val = round(45.0 + random.uniform(-2.0, 2.0), 1)

            payload_robot = {
                "channel": "fleet",
                "timestamp": utc_now(),
                "district_id": "qarmet_sector_B",
                "node_id": robot["id"],
                "position_x": round(robot["x"], 1),
                "position_y": round(robot["y"], 1),
                "heading_deg": round(robot["heading"] % 360.0, 1),
                "metrics": {
                    "gas_co_ppm": gas_co,
                    "chromium_mpc_multiplier": chromium_val,
                    "temperature_c": temp_val,
                    "humidity_pct": hum_val
                }
            }
            payloads_fleet.append(payload_robot)

        # ─────────────────────────────────────────────
        # Perform POST uploads
        # ─────────────────────────────────────────────
        try:
            r1 = requests.post(URL_TWIN, json=payload_twin, timeout=1.5)
            r2 = requests.post(URL_HARDWARE, json=payload_struct, timeout=1.5)
            r3_a = requests.post(URL_HARDWARE, json=payload_mobility_a, timeout=1.5)
            r3_b = requests.post(URL_HARDWARE, json=payload_mobility_b, timeout=1.5)
            for p_fleet in payloads_fleet:
                requests.post(URL_HARDWARE, json=p_fleet, timeout=1.0)
                
            print(f"[{utc_now()}] Stream batch completed successfully.")
        except Exception as e:
            print(f"Connection warning: {e}. FastAPI server offline?")

        time.sleep(1.0)

except KeyboardInterrupt:
    print("\nSimulator stopped by user.")
