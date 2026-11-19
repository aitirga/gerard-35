/*
  Which GPIO drives an LED?

  Diagnostic sketch: drives every safe ESP32 output pin HIGH in turn for a
  second and a half, printing the pin number first. Watch the board, note which
  number is on screen when an LED lights, then put that number in PIN_LED in
  firmware/artilugio/artilugio.ino.

  Serial monitor at 115200 baud. The sweep repeats until you upload something
  else, so you can watch it twice to be sure.

  Only pins that are safe to drive are listed: 6-11 are wired to the flash
  chip, 34-39 are input-only, and 1/3 are the USB serial lines.
*/

#include <Arduino.h>

static const int CANDIDATE_PINS[] = {2,  4,  5,  12, 13, 14, 15, 16, 17, 18,
                                     19, 21, 22, 23, 25, 26, 27, 32, 33};
static const size_t PIN_COUNT = sizeof(CANDIDATE_PINS) / sizeof(CANDIDATE_PINS[0]);

static const unsigned long ON_MS = 1500;
static const unsigned long GAP_MS = 400;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("GPIO sweep: note the pin number shown when the green LED lights.");
}

void loop() {
  for (size_t index = 0; index < PIN_COUNT; index++) {
    const int pin = CANDIDATE_PINS[index];
    Serial.printf("--> GPIO %d  (%u of %u)\n", pin, (unsigned)index + 1, (unsigned)PIN_COUNT);

    pinMode(pin, OUTPUT);
    digitalWrite(pin, HIGH);
    delay(ON_MS);
    digitalWrite(pin, LOW);

    // Release the pin so the next one starts from a clean state and the
    // board's other peripherals are left alone.
    pinMode(pin, INPUT);
    delay(GAP_MS);
  }

  Serial.println("sweep finished, starting again in 3 s");
  delay(3000);
}
