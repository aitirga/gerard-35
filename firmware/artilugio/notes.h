// The artilugio's notes (docs/story-outline.md § The device). The game holds the same table in
// src/castle.ts (ARTILUGIO_NOTES, ARTILUGIO_PAIRS) and src/artilugio.ts (CHORD_MS);
// tests/artilugio.test.mjs checks that both agree.
//
// Buttons 0-3 are red, yellow, green and blue. Alone they play the G7 chord (Sol, Si, Re, Fa); each
// pair of neighbours on the ring of colours plays the note of G Phrygian dominant between its two
// buttons (La-flat, Do, Mi-flat, and the Sol above). Notes 4-7 are those pairs, in this order.
#pragma once
#include <stdint.h>

static const uint8_t BUTTONS = 4;
static const uint8_t NOTES = 8;
static const float NOTE_HZ[] = {392.00, 493.88, 587.33, 698.46, 415.30, 523.25, 622.25, 783.99};
static const uint8_t PAIRS[][2] = {{0, 1}, {1, 2}, {2, 3}, {3, 0}};
// Two buttons pressed this close together (ms) are one pair.
static const unsigned long CHORD_MS = 60;

// The note one press plays: a button alone, or a pair of the table; any other two sound the first.
inline uint8_t noteOf(uint8_t a, int8_t b) {
  if (b < 0 || b == a) return a;
  for (uint8_t i = 0; i < 4; i++) {
    if ((PAIRS[i][0] == a && PAIRS[i][1] == b) || (PAIRS[i][0] == b && PAIRS[i][1] == a)) return BUTTONS + i;
  }
  return a;
}
