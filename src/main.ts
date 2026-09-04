import { createGame } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const scoreEl = document.getElementById('score');

if (!canvas || !scoreEl) {
  throw new Error('Missing #game canvas or #score element in index.html');
}

createGame(canvas, {
  onScore: (score) => {
    scoreEl.textContent = String(score);
  },
});
