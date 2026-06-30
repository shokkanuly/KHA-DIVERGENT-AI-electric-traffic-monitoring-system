/**
 * KHA-DIVERGENT // ESP32 Telemetry Transmitter
 * Target Board: ESP32 Dev Module (WROOM-32D)
 * Description: Connects to local Wi-Fi, reads infrared building sensors (thermal) 
 *              and ultrasonic range sensors (traffic), then uploads JSON payloads 
 *              to the FastAPI Core server.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Make sure to install ArduinoJson via Library Manager

// Wi-Fi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// FastAPI Ingestion Endpoint (Replace with your server's IP address)
const char* serverUrl = "http://192.168.1.104:8080/api/telemetry";

// Hardware Sensor Pins
#define TRIGGER_PIN  14 // Ultrasonic Trigger Pin for traffic loop speed
#define ECHO_PIN     12 // Ultrasonic Echo Pin
#define TEMP_PIN     34 // Analog ADC1 Pin for infrared thermal sensor (e.g. MLX90614 / Thermistor)
#define POWER_PIN    35 // Analog ADC1 Pin for current transformer / ACS712-style demo sensor

// Node Configuration
const char* nodeId = "ESP32-NODE-ASTANA-01";

void setup() {
  Serial.begin(115200);
  
  // Initialize Pins
  pinMode(TRIGGER_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(TEMP_PIN, INPUT);
  pinMode(POWER_PIN, INPUT);
  
  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("Wi-Fi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

// Read ultrasonic distance sensor to calculate flow speed
float readTrafficSpeed() {
  digitalWrite(TRIGGER_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIGGER_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIGGER_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH);
  float distanceCm = duration * 0.034 / 2;
  
  // Mock velocity calculations based on proximity triggers
  static float lastDistance = distanceCm;
  float speedKmh = 0.0;
  
  if (distanceCm < 15.0 && lastDistance >= 15.0) {
    // Car passed! Speed calculated from timing variations
    speedKmh = random(40, 70);
  } else if (distanceCm < 8.0) {
    // Stationary vehicle in lane (possible congestion)
    speedKmh = random(3, 15);
  } else {
    speedKmh = random(55, 65); // Standard average flow speed
  }
  
  lastDistance = distanceCm;
  return speedKmh;
}

// Read infrared analog temperature values (building loss diagnostics)
float readThermalTemp() {
  int rawAdc = analogRead(TEMP_PIN);
  // Convert ADC register (0-4095) to estimated temperature (-10C to +35C)
  float voltage = (rawAdc / 4095.0) * 3.3;
  float tempC = (voltage * 15.0) - 5.0; // simple calibration curve
  return tempC;
}

// Read current sensor and convert it into a safe prototype load estimate.
float readPowerKw() {
  int rawAdc = analogRead(POWER_PIN);
  float voltage = (rawAdc / 4095.0) * 3.3;
  float amps = max(0.0, (voltage - 1.65) * 18.0);
  float watts = 220.0 * amps;
  return watts / 1000.0;
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Read local sensor registers
    float speed = readTrafficSpeed();
    float temp = readThermalTemp();
    float powerKw = readPowerKw();
    float rawDistance = random(4, 80); // mock distance logic
    bool blocked = (speed < 15.0);
    
    // Compile JSON payload using ArduinoJson
    StaticJsonDocument<256> doc;
    doc["node_id"] = nodeId;
    doc["temp_c"] = round(temp * 10.0) / 10.0;
    doc["distance_cm"] = round(rawDistance * 10.0) / 10.0;
    doc["flow_speed_kmh"] = round(speed * 10.0) / 10.0;
    doc["lane_blocked"] = blocked;
    doc["power_kw"] = round(powerKw * 100.0) / 100.0;
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    // Perform POST upload
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    Serial.print("Uploading IoT Payload: ");
    Serial.println(jsonPayload);
    
    int httpResponseCode = http.POST(jsonPayload);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Server Response Code: ");
      Serial.println(httpResponseCode);
      Serial.println(response);
    } else {
      Serial.print("HTTP Error Code: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  } else {
    Serial.println("Wi-Fi Connection Lost. Reconnecting...");
    WiFi.begin(ssid, password);
  }
  
  // Post sensor readings every 2.5 seconds
  delay(2500);
}
