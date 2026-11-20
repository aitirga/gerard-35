// Loaded before every test file (package.json `test`): golpes críticos by chance are off, so every
// blow keeps its number whatever the dice say. The sure ones (Olor a sangre) stay; a test of the
// chance itself sets CRIT_RULES.chance back to 1 for its own fight.
import { CRIT_RULES } from '../src/battle.ts';
CRIT_RULES.chance = 0;
