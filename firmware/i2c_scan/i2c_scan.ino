/*
  Are both displays wired correctly, and at which addresses?

  Scans both of the ESP32's I2C controllers on the pins the game uses and
  prints whatever answers. Serial monitor at 115200 baud.

  Expected, once everything is wired:

    bus 0 (LCD)       found 0x27          some backpacks are 0x3F instead
    bus 1 (4-digit)   found 0x24..0x27    TM1650 brightness registers
                      found 0x34..0x37    TM1650 digit registers

  no devices found -> that bus's SDA/SCL are swapped, on other pins, or loose.
  Swapping SDA and SCL is harmless, and the usual cause.

  ESP32 I2C is not tied to particular pins: change the constants below to try
  another pair, then copy whatever works into firmware/artilugio/artilugio.ino.
*/

#include <Arduino.h>
#include <Wire.h>

static const int LCD_SDA = 23;
static const int LCD_SCL = 32;
static const int TUBE_SDA = 13;  // the tube's DIO
static const int TUBE_SCL = 14;  // the tube's CLK

void scan(TwoWire &bus, const char *label, int sda, int scl) {
  Serial.printf("bus %s (SDA=%d SCL=%d)\n", label, sda, scl);
  int found = 0;
  for (uint8_t address = 1; address < 127; address++) {
    bus.beginTransmission(address);
    if (bus.endTransmission() == 0) {
      Serial.printf("    found 0x%02X\n", address);
      found++;
    }
  }
  if (found == 0) Serial.println("    nothing - check the two wires, try swapping them");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin(LCD_SDA, LCD_SCL);
  Wire1.begin(TUBE_SDA, TUBE_SCL);
  Serial.println();
  Serial.println("scanning both I2C buses");
}

void loop() {
  scan(Wire, "0 / LCD", LCD_SDA, LCD_SCL);
  scan(Wire1, "1 / 4-digit tube", TUBE_SDA, TUBE_SCL);
  Serial.println();
  delay(3000);
}
