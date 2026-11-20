/*
  El artilugio (docs/story-outline.md § The device): the board hidden in the real flat, as the last
  key of gerard-35.

  Four coloured buttons play notes; two neighbours pressed together play a fifth, sixth, seventh or
  eighth (notes.h). Every note sounds on the buzzer, lights its buttons' LEDs, draws a bar on the LCD
  and goes to the game's server, which passes it to the browser. The PIR tells the game when someone
  moves in front of it, so Gerard takes it out in the game.

  It never takes a connection from the game. Every half second it asks the server what it is meant
  to be (artilugio.py):

    asleep  mute and dark: the story has not sent it yet (until the portal at El Nucli)
    alive   it sounds whenever it is pressed, anywhere in the game
    awake   the Queen's last fight: its four lights go round on their own, the LCD changes
    free    after it

  The answer also says how many times the game asked it to sound (Escuchar, or the end of Bernat's
  box), so it can be found by ear: random notes of its scale for a while. The last mode is kept in flash: switched off and on again, it is what it was.

  Board: ESP32 Dev Module on the Keyestudio FKS0001 inventor board (`just artilugio-build`).
  Library: "LiquidCrystal_I2C" by Frank de Brabander (`just artilugio-setup`).

  Jumper wires, each from the peripheral header to the yellow (S) pin of that IO row in the ESP32
  Pin OUT block. Only the yellow row is wired (red is VCC, black GND), and the VCC switch is on 3V3:

      SW1 (red)    -> IO19        RED LED    -> IO25    BUZZER/SPEAKER -> IO5
      SW2 (yellow) -> IO18        YELLOW LED -> IO26    PIR            -> IO34
      SW3 (green)  -> IO17        GREEN LED  -> IO27    SDA (LCD)      -> IO23
      SW4 (blue)   -> IO16        BLUE LED   -> IO33    SCL (LCD)      -> IO32
                                                        DIO (4-digit)  -> IO13
                                                        CLK (4-digit)  -> IO14

  The microphone (SOUND) is not used: its wire on IO34 goes to the PIR. IO0, IO2 and IO12 stay
  free: they are strapping pins and a load on them can stop it booting.
*/

#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Wire.h>

#include "notes.h"
// Its Wi-Fi and key; without secrets.h it still builds, with the example's (`just artilugio-flash` refuses).
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

static const int PIN_BUZZER = 5;
static const int PIN_PIR = 34;
static const int PIN_SDA = 23, PIN_SCL = 32;
static const int PIN_TUBE_SDA = 13, PIN_TUBE_SCL = 14;
// Red, yellow, green, blue: the order of notes.h.
static const int PIN_BUTTON[BUTTONS] = {19, 18, 17, 16};
static const int PIN_LED[BUTTONS] = {25, 26, 27, 33};

static const char *HOSTNAME = "artilugio";
static const unsigned long DEBOUNCE_MS = 40;
static const unsigned long NOTE_MS = 420;
static const unsigned long LIT_MS = 260;
static const unsigned long ASK_EVERY_MS = 500;
static const unsigned long MOTION_GAP_MS = 4000;
static const unsigned long WIFI_WAIT_MS = 15000;
static const uint16_t HTTP_TIMEOUT_MS = 400;

enum Mode : uint8_t { ASLEEP, ALIVE, AWAKE, FREE };
static const char *MODE_NAMES[] = {"asleep", "alive", "awake", "free"};

LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);
Preferences flash;
HTTPClient http;

Mode mode = ASLEEP;
bool online = false;

// ——— The 4-digit tube (TM1650 on Wire1): kept dark ————————————————————————————————————————
static const uint8_t TUBE_DATA_BASE = 0x34, TUBE_CTRL_BASE = 0x24;

void tubeDark() {
  for (uint8_t i = 0; i < 4; i++) {
    Wire1.beginTransmission(TUBE_DATA_BASE + i);
    Wire1.write(0);
    Wire1.endTransmission();
    Wire1.beginTransmission(TUBE_CTRL_BASE + i);
    Wire1.write(0);
    Wire1.endTransmission();
  }
}

// ——— The LCD: the shape of what has sounded, one bar a note ——————————————————————————————
// Eight custom characters, one to eight pixel rows lit from the bottom: two rows of the LCD make a
// bar up to sixteen high. The screen never shows names or what to play.
static const uint8_t SHOWN = 8;
uint8_t history[SHOWN];
uint8_t historyLength = 0;

void makeBars() {
  for (uint8_t level = 0; level < 8; level++) {
    uint8_t glyph[8];
    for (uint8_t row = 0; row < 8; row++) glyph[row] = row >= 7 - level ? 0b11111 : 0;
    lcd.createChar(level, glyph);
  }
}

uint8_t heightOf(uint8_t note) {
  float low = NOTE_HZ[0], high = NOTE_HZ[0];
  for (uint8_t i = 1; i < NOTES; i++) {
    if (NOTE_HZ[i] < low) low = NOTE_HZ[i];
    if (NOTE_HZ[i] > high) high = NOTE_HZ[i];
  }
  return 3 + (uint8_t)roundf(13 * (NOTE_HZ[note] - low) / (high - low));  // 3..16
}

void drawBars() {
  lcd.clear();
  for (uint8_t i = 0; i < historyLength; i++) {
    const uint8_t height = heightOf(history[i]), column = i * 2;
    lcd.setCursor(column, 1);
    lcd.write(height >= 8 ? 7 : height - 1);
    if (height > 8) {
      lcd.setCursor(column, 0);
      lcd.write(height - 9);
    }
  }
}

void drawNote(uint8_t note) {
  if (historyLength == SHOWN) {
    memmove(history, history + 1, SHOWN - 1);
    historyLength--;
  }
  history[historyLength++] = note;
  drawBars();
}

// ——— Lights and sound, never blocking the loop ———————————————————————————————————————————
unsigned long ledOffAt[BUTTONS] = {0, 0, 0, 0};
unsigned long toneOffAt = 0;

void light(uint8_t button, unsigned long ms = LIT_MS) {
  digitalWrite(PIN_LED[button], HIGH);
  ledOffAt[button] = millis() + ms;
}

void sound(float hz, unsigned long ms) {
  tone(PIN_BUZZER, (unsigned int)roundf(hz));
  toneOffAt = millis() + ms;
}

void serviceOutputs() {
  const unsigned long now = millis();
  for (uint8_t b = 0; b < BUTTONS; b++) {
    if (ledOffAt[b] && now >= ledOffAt[b]) {
      digitalWrite(PIN_LED[b], LOW);
      ledOffAt[b] = 0;
    }
  }
  if (toneOffAt && now >= toneOffAt) {
    noTone(PIN_BUZZER);
    toneOffAt = 0;
  }
  // Awake, its four lights go round on their own: the only sign that now it matters.
  if (mode == AWAKE) {
    const uint8_t lit = (now / 300) % BUTTONS;
    for (uint8_t b = 0; b < BUTTONS; b++) {
      if (!ledOffAt[b]) digitalWrite(PIN_LED[b], b == lit ? HIGH : LOW);
    }
  }
}

// ——— Talking to the game's server ——————————————————————————————————————————————————————
// Notes wait here while a chord is still open or a request is under way, and go one per loop.
static const uint8_t QUEUE = 16;
int8_t queued[QUEUE];
uint8_t queueHead = 0, queueLength = 0;
bool motionPending = false;

void enqueue(int8_t item) {  // a note 0-7, or -1 for movement
  if (queueLength == QUEUE) return;
  queued[(queueHead + queueLength++) % QUEUE] = item;
}

bool request(const char *method, const String &path, String *answer = nullptr) {
  if (WiFi.status() != WL_CONNECTED) return false;
  http.begin(String(SERVER_URL) + path);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setReuse(true);
  http.addHeader("x-artilugio-key", ARTILUGIO_KEY);
  const int code = strcmp(method, "POST") == 0 ? http.POST("") : http.GET();
  if (answer && code == 200) *answer = http.getString();
  http.end();
  online = code > 0;
  return code >= 200 && code < 300;
}

void setMode(Mode next);
void sounding(uint8_t times);

void ask() {
  String answer;
  if (!request("GET", "/api/artilugio/board", &answer)) return;
  const int space = answer.indexOf(' ');
  const String name = answer.substring(0, space);
  for (uint8_t m = 0; m < 4; m++) {
    if (name == MODE_NAMES[m]) setMode((Mode)m);
  }
  const int times = space > 0 ? answer.substring(space + 1).toInt() : 0;
  if (times > 0) sounding(times);
}

// ——— Modes ————————————————————————————————————————————————————————————————————————————
void setMode(Mode next) {
  if (next == mode) return;
  Serial.printf("mode %s -> %s\n", MODE_NAMES[mode], MODE_NAMES[next]);
  mode = next;
  flash.putUChar("mode", mode);
  for (uint8_t b = 0; b < BUTTONS; b++) digitalWrite(PIN_LED[b], LOW);
  if (mode == ASLEEP) {
    noTone(PIN_BUZZER);
    lcd.clear();
    lcd.noBacklight();
    return;
  }
  lcd.backlight();
  if (mode == AWAKE) {
    // It wakes: every light at once and a rising sweep through its eight notes.
    for (uint8_t b = 0; b < BUTTONS; b++) light(b, 900);
    lcd.clear();
    lcd.setCursor(0, 0);
    for (uint8_t i = 0; i < 16; i++) lcd.write(i % 8);
    lcd.setCursor(0, 1);
    for (uint8_t i = 0; i < 16; i++) lcd.write(7 - i % 8);
    sound(NOTE_HZ[7], 600);
  } else if (mode == FREE) {
    for (uint8_t b = 0; b < BUTTONS; b++) light(b, 2500);
    drawBars();
  } else {
    drawBars();
  }
}

// Escuchar, and the end of Bernat's box: so it can be found by ear, it beeps random notes of its
// scale for a while (docs/quests/bernat.md, round 5), each with its LEDs. Never the melody in order.
static const unsigned long SEARCH_MS = 6000;

void sounding(uint8_t times) {
  if (mode == ASLEEP) return;
  const unsigned long until = millis() + SEARCH_MS * (times < 3 ? times : 3);
  while ((long)(millis() - until) < 0) {
    const uint8_t note = random(NOTES);
    const uint8_t a = note < BUTTONS ? note : PAIRS[note - BUTTONS][0], b = note < BUTTONS ? note : PAIRS[note - BUTTONS][1];
    digitalWrite(PIN_LED[a], HIGH); digitalWrite(PIN_LED[b], HIGH);
    tone(PIN_BUZZER, (unsigned int)NOTE_HZ[note]);
    delay(160 + random(220));
    digitalWrite(PIN_LED[a], LOW); digitalWrite(PIN_LED[b], LOW);
    noTone(PIN_BUZZER);
    delay(60 + random(260));
    server.handleClient();
  }
}

// ——— Buttons, pairs and the PIR ——————————————————————————————————————————————————————————
bool pressed[BUTTONS] = {false, false, false, false};
unsigned long changedAt[BUTTONS] = {0, 0, 0, 0};
int8_t pending = -1;  // the first button of a press, waiting CHORD_MS for a second
unsigned long pendingAt = 0;

void play(uint8_t note) {
  Serial.printf("note %u\n", note);
  if (mode == ASLEEP) return;  // until the story sends it, it is just a dead board
  sound(NOTE_HZ[note], NOTE_MS);
  if (note < BUTTONS) {
    light(note);
  } else {
    light(PAIRS[note - BUTTONS][0]);
    light(PAIRS[note - BUTTONS][1]);
  }
  if (mode != AWAKE) drawNote(note);
  enqueue(note);
}

void pollButtons() {
  const unsigned long now = millis();
  for (uint8_t b = 0; b < BUTTONS; b++) {
    const bool down = digitalRead(PIN_BUTTON[b]) == LOW;
    if (down == pressed[b] || now - changedAt[b] < DEBOUNCE_MS) continue;
    pressed[b] = down;
    changedAt[b] = now;
    if (!down) continue;
    if (pending < 0) {
      pending = b;
      pendingAt = now;
    } else if (pending != b) {
      play(noteOf(pending, b));
      pending = -1;
    }
  }
  if (pending >= 0 && now - pendingAt >= CHORD_MS) {
    play(pending);
    pending = -1;
  }
}

bool pirWas = false;
unsigned long motionAt = 0;

void pollPir() {
  const bool seen = digitalRead(PIN_PIR) == HIGH;
  if (seen && !pirWas && mode != ASLEEP && millis() - motionAt > MOTION_GAP_MS) {
    motionAt = millis();
    enqueue(-1);
  }
  pirWas = seen;
}

// ——— The network ——————————————————————————————————————————————————————————————————————
unsigned long askedAt = 0;

void serviceNetwork() {
  if (pending >= 0) return;  // a chord still open: its second button must not wait on the network
  if (queueLength) {
    const int8_t item = queued[queueHead];
    queueHead = (queueHead + 1) % QUEUE;
    queueLength--;
    if (item < 0) request("POST", "/api/artilugio/motion");
    else request("POST", "/api/artilugio/note?n=" + String(item));
    return;
  }
  if (millis() - askedAt >= ASK_EVERY_MS) {
    askedAt = millis();
    ask();
  }
}

void handleHealth() {
  String body = String("{\"status\":\"ok\",\"node\":\"") + HOSTNAME + "\",\"ip\":\"" + WiFi.localIP().toString() +
                "\",\"mode\":\"" + MODE_NAMES[mode] + "\",\"server\":" + (online ? "true" : "false") + "}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", body);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("connecting to %s", WIFI_SSID);
  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_WAIT_MS) {
    delay(300);
    Serial.print(".");
  }
  // Without Wi-Fi it still plays in whatever mode it last had; the reconnect goes on by itself.
  if (WiFi.status() == WL_CONNECTED) Serial.printf(" %s\n", WiFi.localIP().toString().c_str());
  else Serial.println(" no Wi-Fi for now");
}

void setup() {
  Serial.begin(115200);
  randomSeed(esp_random());
  for (uint8_t b = 0; b < BUTTONS; b++) {
    pinMode(PIN_BUTTON[b], INPUT);
    pinMode(PIN_LED[b], OUTPUT);
    digitalWrite(PIN_LED[b], LOW);
  }
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  Wire.begin(PIN_SDA, PIN_SCL);
  Wire1.begin(PIN_TUBE_SDA, PIN_TUBE_SCL);
  tubeDark();
  lcd.init();
  makeBars();
  lcd.clear();

  flash.begin("artilugio", false);
  const Mode kept = (Mode)flash.getUChar("mode", ASLEEP);
  mode = kept == ASLEEP ? ALIVE : ASLEEP;  // so setMode does its work
  setMode(kept <= FREE ? kept : ASLEEP);

  connectWiFi();
  if (MDNS.begin(HOSTNAME)) MDNS.addService("http", "tcp", 80);
  server.on("/health", HTTP_GET, handleHealth);
  server.begin();
}

void loop() {
  pollButtons();
  pollPir();
  serviceOutputs();
  serviceNetwork();
  server.handleClient();
}
