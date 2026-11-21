import test from 'node:test';
import assert from 'node:assert/strict';
import { LINES_NURIA } from '../src/friends/nuria.ts';
import { LINES_MARTA } from '../src/friends/marta.ts';
import { LINES_EMILIE } from '../src/friends/emilie.ts';
import { LINES_LUCA } from '../src/friends/luca.ts';
import { LINES_UNI } from '../src/friends/universidad.ts';

// Every ánima mission ends with Gerard and Aitor sending the people helped to the choir
// (docs/quests/coro.md § The choir room): it is why they turn up there every morning after.
/** The missions whose people Gerard speaks Catalan with. */
const CATALAN = ['nuria', 'luca', 'universidad'];
const ENDINGS = { nuria: LINES_NURIA, marta: LINES_MARTA, emilie: LINES_EMILIE, luca: LINES_LUCA, universidad: LINES_UNI };

test('every ánima mission ends with Gerard and Aitor naming the choir, where it is, and asking them to always remember it', () => {
  for (const [mission, lines] of Object.entries(ENDINGS)) {
    const coro = lines.coro;
    assert.ok(coro, `${mission} has its choir lines`);
    const by = speaker => coro.lines.filter(l => l.speaker === speaker).map(l => l.text).join(' ');
    assert.match(by('aitor'), /A cop de diapasó/, `${mission}: Aitor, who directs it, names the choir`);
    assert.match(by('aitor'), /Meridiana/, `${mission}: and says where it is`);
    // Gerard speaks Catalan with his people (docs/chapter-1.md § Catalan with his people): Nuria, Luca and the university friends.
    const catalan = CATALAN.includes(mission);
    assert.match(by('gerard35'), catalan ? /Passi el que passi/ : /Pase lo que pase/, `${mission}: Gerard asks them to come whatever happens`);
    assert.match(by('gerard35'), catalan ? /sempre/i : /siempre/i, `${mission}: and to always remember it`);
    assert.ok(coro.lines.some(l => l.speaker !== 'aitor' && l.speaker !== 'gerard35'), `${mission}: the people helped answer`);
  }
});
