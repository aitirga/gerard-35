/**
 * The fight simulator's optional last step (docs/fight-sim.md): a second opinion from Jev, TypeSafe's
 * model, on a finished report. The numbers stay the simulator's; Jev only judges what they mean
 * against what the fights are meant to be. It never runs unless asked (--jev), and --jev-dry-run
 * shows the exact request without sending anything.
 */
export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
export const DEFAULT_INTENT = 'Uri\'s tower in a cosy co-op RPG. Small onions (crias-1) are easy and are how Papagato, the cats\' ánima, levels up. Big onions (cebolla, cebollon) kill the party quickly because each layer adds weight to their blows and one hit peels only one layer. At level 2 Papagato learns Zarpazos, many little claws that peel a layer each, and that is the answer: the player should notice that levelling up is what beats them, and win clearly once they have it. A person thinking a little should be able to manage; losing is not punishing.';

const DIFFICULTY = [
  'The party almost always wins and is barely scratched: nothing to think about',
  'The party usually wins and is hurt, but it is rarely in danger',
  'A real fight: winning takes attention and sometimes the party loses',
  'Most attempts end in defeat unless the player finds the right answer',
  'Nearly every attempt ends in defeat, whatever the player does',
];
/** The questions and state for a report; pure, so it can be read and tested without sending it. */
export function jevRequest(report, { intent = DEFAULT_INTENT, model = 'jev-latest' } = {}) {
  const rows = report.rows ?? report.targets?.map(t => t.row) ?? [];
  const fights = [...new Set(rows.map(row => row.fight))];
  const results = rows.map(({ fight, party, levels, policy, ban, win, rounds, roundsLost, hpLeftWon, koRate, peeledBy, used }) => ({ fight, party, levels, policy, ban, win, rounds, roundsLost, hpLeftWon, koRate, peeledBy, used }));
  const questions = {
    dynamic_holds: {
      type: 'noul',
      instructions: 'Do the numbers in `results` show that the fights behave the way `intent` describes?',
    },
    fairness: {
      type: 'score',
      instructions: 'From `intent` and `results`, how fair does the difficulty look for someone playing it for the first time?',
      criteria: [
        'The way to win cannot be found by playing: results depend on knowing the numbers in advance',
        'The way to win exists but a person would likely give up before finding it',
        'A person who tries a few things would find the way to win after a defeat or two',
        'The way to win is plain from the first attempt',
      ],
    },
    next_lever: {
      type: 'choice',
      instructions: 'Which single change would bring `results` closest to `intent`?',
      criteria: {
        none: 'Nothing needs changing: the results already match the intent',
        foe_power: 'The foes hit too hard or too softly',
        foe_hp: 'The foes have too much or too little PV',
        layers: 'The onions have too many or too few layers',
        peel_skill: 'Zarpazos peels too much or too little, or costs the wrong amount of maná',
        levelling: 'The level that teaches Zarpazos comes too early or too late',
      },
    },
  };
  for (const fight of fights) questions[`difficulty_${fight.replace(/[^a-z0-9]+/gi, '_')}`] = {
    type: 'score',
    instructions: `Going by the rows of \`results\` whose fight is "${fight}", how hard is that fight for its party at its level with a person playing reasonably?`,
    criteria: DIFFICULTY,
  };
  return { model, state: { intent, results, conclusions: report.conclusions ?? [] }, questions };
}
/** Asks Jev. `fetcher` is there so the tests never reach the network. */
export async function askJev(report, { apiKey, intent, model, fetcher = fetch } = {}) {
  if (!apiKey) throw new Error('Jev needs TYPESAFE_API_KEY in the environment or in .env (see .env.example).');
  const response = await fetcher(JEV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(jevRequest(report, { intent, model })),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Jev answered ${response.status}: ${(await response.text()).slice(0, 400)}`);
  const { model: answeredBy, answers, usage } = await response.json();
  return { model: answeredBy, answers, usage };
}
/** One line per answer, for the terminal. */
export function jevLines({ model, answers }) {
  const lines = [`Jev (${model}):`];
  for (const [id, answer] of Object.entries(answers)) {
    if (answer.type === 'noul') lines.push(`  ${id}: ${(answer.noul * 100).toFixed(0)} % sí`);
    else if (answer.type === 'choice') lines.push(`  ${id}: ${answer.choice} (confianza ${answer.confidence.toFixed(2)})`);
    else if (answer.type === 'score') lines.push(`  ${id}: ${answer.score.toFixed(2)} de ${Object.keys(answer.legend).length - 1} (confianza ${answer.confidence.toFixed(2)}): ${answer.legend[String(Math.round(answer.score))]}`);
  }
  return lines;
}
