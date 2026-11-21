/*
  El artilugio (docs/story-outline.md § The device): the board hidden in the real flat, as the last
  key of gerard-35.

  Four coloured buttons play notes; two neighbours pressed together play a fifth, sixth, seventh or
  eighth (notes.h). Every note sounds on the buzzer, lights its buttons' LEDs, draws a bar on the LCD
  and goes to the game's server, which passes it to the browser.

  Once the story sends it, it calls out from its hiding place until it is found: a burst of random
  notes now and then, closer together while its PIR sees someone. It calls out only while the server
  has just said "alive" and a game is open: without the server, or with nobody playing, it is silent
  whatever mode it kept. Someone in front of it for a few
  seconds, or a button pressed, and it is found. From then on, while it is pressed or the PIR keeps
  seeing someone, Gerard holds it out in the game, wherever he is.

  It never takes a connection from the game. Every half second it asks the server what it is meant
  to be (artilugio.py):

    asleep  mute and dark: the story has not sent it yet (until the portal at El Nucli)
    alive   it sounds whenever it is pressed, anywhere in the game
    awake   the Queen's last fight: its four lights go round on their own, the LCD changes
    free    after it

  The answer also says how many times the game asked it to sound (the end of Bernat's box): a few
  seconds of random notes of its scale; and whether a game is open (`<mode> <times> <1|0>`). A
  server that has not heard from the game yet says "unknown", and the board keeps its mode. The mode, and whether it has been found, are kept in flash:
  switched off and on again, it is what it was. Put to sleep by the story, it is lost again.

  Board: ESP32 Dev Module on the Keyestudio FKS0001 inventor board (`just artilugio-build`).
  Library: "LiquidCrystal_I2C" by Frank de Brabander (`just artilugio-setup`).

  The first time it is flashed by USB; from then on it takes new firmware over the Wi-Fi: the
  Arduino IDE lists it among its network ports as "artilugio" and asks for ARTILUGIO_KEY as the
  password, or `just artilugio-flash <its IP>`.

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

#include <ArduinoOTA.h>
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
// Until it is found: a burst of notes this often, or this often while someone is in front of it.
static const unsigned long SEARCH_EVERY_MS = 12000, SEARCH_NEAR_MS = 3000;
// Someone in front of it this long and it is found.
static const unsigned long FOUND_AFTER_MS = 6000;
// After power on the PIR settles for a while, firing on its own; a gap shorter than PIR_GAP_MS in
// what it sees is still the same person.
static const unsigned long PIR_WARMUP_MS = 30000, PIR_GAP_MS = 1500;
// Once found, while someone is in front of it, the game hears of them this often (Gerard keeps it
// out; he puts it away after src/artilugio-held.ts PUT_AWAY_AFTER without a word).
static const unsigned long MOTION_EVERY_MS = 2000;
static const unsigned long WIFI_WAIT_MS = 15000;
// The server's last "alive, and a game is open" counts for this long: unanswered past it, it goes quiet.
static const unsigned long HEARD_MS = 3000;
static const uint16_t HTTP_TIMEOUT_MS = 400;

enum Mode : uint8_t { ASLEEP, ALIVE, AWAKE, FREE };
static const char *MODE_NAMES[] = {"asleep", "alive", "awake", "free"};

LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);
Preferences flash;
HTTPClient http;

Mode mode = ASLEEP;
bool online = false;
bool found = false;  // someone has found it since the story sent it
// When the server last said "alive" with a game open: the only time it calls out to be found.
unsigned long calledForAt = 0;

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

// A note's buttons: one alone, or the two of a pair.
void lightNote(uint8_t note, unsigned long ms = LIT_MS) {
  if (note < BUTTONS) {
    light(note, ms);
  } else {
    light(PAIRS[note - BUTTONS][0], ms);
    light(PAIRS[note - BUTTONS][1], ms);
  }
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

void enqueue(int8_t item) {  // a note 0-7, or -1 for movement
  if (queueLength == QUEUE) return;
  queued[(queueHead + queueLength++) % QUEUE] = item;
}

bool request(const char *method, const String &path, String *answer = nullptr) {
  if (WiFi.status() != WL_CONNECTED) return false;
  http.begin(String(SERVER_URL) + path);
  // Connecting too, or a slow server would freeze the buttons for the library's five seconds.
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
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
void beepFor(unsigned long ms);
static const unsigned long SEARCH_MS = 6000;  // one call from the game: this long, three at most

void ask() {
  String answer;
  if (!request("GET", "/api/artilugio/board", &answer)) return;
  const int space = answer.indexOf(' ');
  const String name = answer.substring(0, space);
  for (uint8_t m = 0; m < 4; m++) {
    if (name == MODE_NAMES[m]) setMode((Mode)m);
  }
  const int second = answer.indexOf(' ', space + 1);
  const int times = space > 0 ? answer.substring(space + 1).toInt() : 0;
  const bool playing = second > 0 && answer.substring(second + 1).toInt() == 1;
  if (name == "alive" && playing) calledForAt = millis();
  if (times > 0) beepFor(SEARCH_MS * (times < 3 ? times : 3));
}

// ——— Modes ————————————————————————————————————————————————————————————————————————————
unsigned long beepUntil = 0, nextBeepAt = 0, calledAt = 0;

void setMode(Mode next) {
  if (next == mode) return;
  Serial.printf("mode %s -> %s\n", MODE_NAMES[mode], MODE_NAMES[next]);
  mode = next;
  flash.putUChar("mode", mode);
  for (uint8_t b = 0; b < BUTTONS; b++) digitalWrite(PIN_LED[b], LOW);
  // Sent by the story, it calls out at once; put to sleep, it is lost again.
  calledAt = millis() - 2 * SEARCH_EVERY_MS;
  if (mode == ASLEEP) {
    beepUntil = millis();
    if (found) flash.putBool("found", found = false);
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

// ——— Being found ————————————————————————————————————————————————————————————————————————
// So it can be found by ear (docs/quests/bernat.md, round 5): random notes of its scale, each with
// its LEDs, never the melody in order, and never holding up the buttons. Sent by the story and not
// found yet, it calls out in bursts, closer together while someone is in front of it.
bool someoneThere = false;
float callJitter = 0;

void beepFor(unsigned long ms) {
  if (mode == ASLEEP) return;
  const unsigned long until = millis() + ms;
  if ((long)(until - beepUntil) > 0) beepUntil = until;
}

void setFound(const char *how) {
  if (found) return;
  flash.putBool("found", found = true);
  beepUntil = millis();
  Serial.printf("found: %s\n", how);
}

void serviceSearch() {
  const unsigned long now = millis();
  const unsigned long gap = someoneThere ? SEARCH_NEAR_MS : SEARCH_EVERY_MS;
  const bool calledFor = calledForAt && now - calledForAt < HEARD_MS;
  if (mode == ALIVE && !found && calledFor && now - calledAt >= gap * (1 + callJitter)) {
    calledAt = now;
    callJitter = random(500) / 1000.0f;
    beepFor(700 + random(900));
  }
  if ((long)(beepUntil - now) > 0 && (long)(now - nextBeepAt) >= 0) {
    const uint8_t note = random(NOTES);
    const unsigned long ms = 160 + random(220);
    sound(NOTE_HZ[note], ms);
    lightNote(note, ms);
    nextBeepAt = now + ms + 60 + random(260);
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
  setFound("pressed");  // and its note has Gerard take it out
  sound(NOTE_HZ[note], NOTE_MS);
  lightNote(note);
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

// The PIR: someone in front of it. Not found yet, someone there long enough finds it; found, the
// game hears of them every MOTION_EVERY_MS while they stay, so Gerard keeps it out.
unsigned long seenSince = 0, seenAt = 0, motionAt = 0;

void pollPir() {
  const unsigned long now = millis();
  if (now < PIR_WARMUP_MS) return;
  if (digitalRead(PIN_PIR) == HIGH) {
    if (!someoneThere) seenSince = now;
    seenAt = now;
  }
  someoneThere = seenAt && now - seenAt <= PIR_GAP_MS;
  if (!someoneThere || mode == ASLEEP) return;
  if (!found && now - seenSince >= FOUND_AFTER_MS) setFound("someone in front of it");
  if (found && now - motionAt >= MOTION_EVERY_MS) {
    motionAt = now;
    enqueue(-1);
  }
}

// ——— The network ——————————————————————————————————————————————————————————————————————
unsigned long askedAt = 0;

void serviceNetwork() {
  if (pending >= 0) return;  // a chord still open: its second button must not wait on the network
  if (WiFi.status() != WL_CONNECTED) return;  // what was played waits for the network to come back
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

// ——— What it says about itself (/health) ————————————————————————————————————————————————
// How often it lost the Wi-Fi since it started and the Wi-Fi's reason the last time; the longest the
// loop took since /health last asked (a frozen board misses its buttons); what the PIR sees now.
uint16_t drops = 0;
uint8_t lastDrop = 0;
unsigned long loopAt = 0, slowest = 0;

// Why it last started: switched on, restarted by an update, or something wrong (the power dipping,
// a crash, the watchdog), so a board that goes quiet for a moment can be told apart from one that
// restarted.
const char *startedBy() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "power";
    case ESP_RST_SW: return "restart";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_PANIC: return "crash";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT: return "watchdog";
    default: return "other";
  }
}

void handleHealth() {
  String body = String("{\"status\":\"ok\",\"node\":\"") + HOSTNAME + "\",\"ip\":\"" + WiFi.localIP().toString() +
                "\",\"mode\":\"" + MODE_NAMES[mode] + "\",\"found\":" + (found ? "true" : "false") +
                ",\"server\":" + (online ? "true" : "false") + ",\"up\":" + String(millis() / 1000) +
                ",\"started\":\"" + startedBy() + "\",\"rssi\":" + String(WiFi.RSSI()) + ",\"drops\":" + String(drops) +
                ",\"lastDrop\":" + String(lastDrop) + ",\"slowest\":" + String(slowest) +
                ",\"pir\":" + String(digitalRead(PIN_PIR)) + "}";
  slowest = 0;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", body);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.setAutoReconnect(true);
  // Never dozing between the router's beacons: the usual cause of an ESP32 dropping off for seconds.
  WiFi.setSleep(false);
  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t info) {
    drops++;
    lastDrop = info.wifi_sta_disconnected.reason;
  }, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
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
  found = flash.getBool("found", false);
  const Mode kept = (Mode)flash.getUChar("mode", ASLEEP);
  mode = kept == ASLEEP ? ALIVE : ASLEEP;  // so setMode does its work
  setMode(kept <= FREE ? kept : ASLEEP);

  connectWiFi();
  // New firmware over the Wi-Fi, with its key as the password; it goes quiet and dark while it
  // arrives. ArduinoOTA also starts mDNS, as artilugio.local.
  ArduinoOTA.setHostname(HOSTNAME);
  ArduinoOTA.setPassword(ARTILUGIO_KEY);
  ArduinoOTA.onStart([] {
    noTone(PIN_BUZZER);
    for (uint8_t b = 0; b < BUTTONS; b++) digitalWrite(PIN_LED[b], LOW);
    Serial.println("new firmware over Wi-Fi");
  });
  ArduinoOTA.begin();
  MDNS.addService("http", "tcp", 80);
  server.on("/health", HTTP_GET, handleHealth);
  server.begin();
}

void loop() {
  const unsigned long now = millis();
  if (loopAt && now - loopAt > slowest) slowest = now - loopAt;
  loopAt = now;
  pollButtons();
  pollPir();
  serviceSearch();
  serviceOutputs();
  serviceNetwork();
  server.handleClient();
  ArduinoOTA.handle();
}
