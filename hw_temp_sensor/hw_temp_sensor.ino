#include <ArduinoHttpClient.h>
#include <WiFiNINA.h>
#include <DHT.h>
#include "secrets.h"

/* edge server config */
#define SERVER_IP                         "192.168.1.106"
#define SERVER_PORT                       3000
#define SERVER_PATH                       "/temperature"
#define UUID                              "291ae7d6-f593-414f-beed-c7eb01f1a449"

/* pin config */
#define PIN_DHT                           2

WiFiClient wifi;
HttpClient http = HttpClient(wifi, SERVER_IP, SERVER_PORT);

DHT dht(PIN_DHT, DHT22);

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  Serial.println("Arduino temperature sensor node");

  dht.begin();

  Serial.print("Connecting to WiFi...");
  while(WiFi.begin(WIFI_SSID, WIFI_PASSWORD /* defined in secrets.h */) != WL_CONNECTED) {
    Serial.print('.');
    delay(5000);
  }
  Serial.println("done.");
}

void loop() {
  float temp = dht.readTemperature();
  Serial.print(F("Temperature: ")); Serial.print(temp); Serial.println(F(" C"));

  String postData = "{\"id\":\"" UUID "\",\"temperature\":" + String(temp) + "}";
  http.post(SERVER_PATH, "application/json", postData);
  Serial.print(F("\tResponse code: ")); Serial.print(http.responseStatusCode());
  Serial.print(F(", response body: ")); Serial.println(http.responseBody());

  delay(2000);
}
