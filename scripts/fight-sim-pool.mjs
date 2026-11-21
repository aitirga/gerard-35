/**
 * The fight simulator's rows shared among threads (docs/fight-sim.md § Speed): each row's fights are
 * cut in pieces (`PIECE` fights, each fight with its own seed) and every piece goes to whichever
 * thread is free, so one long row does not hold the rest. The same job gives the same row whoever
 * plays it: a table played in threads is the table played in one. `createPool().play` is a `Play`
 * (src/balance.ts); `close()` when done, or the process waits.
 */
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { playRuns, simulate, tallyRuns } from '../src/battle-sim.ts';

const PIECE = 20;
if (!isMainThread) {
  // A thread: plays each piece it is sent and hands its fights back.
  parentPort.on('message', ({ job, from, to }) => {
    try { parentPort.postMessage({ list: playRuns(job.setup, job.seed, from, to, job.tuning) }); }
    catch (error) { parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
  });
}

/** `size` threads at most (the cores less one), started as the work needs them. One job, or one thread, is played here. */
export function createPool(size = Math.max(1, availableParallelism() - 1)) {
  const workers = [], idle = [], queue = [];
  const next = worker => {
    const task = queue.shift();
    if (!task) { idle.push(worker); return; }
    worker.task = task;
    worker.postMessage({ job: task.job, from: task.from, to: task.to });
  };
  const start = () => {
    const worker = new Worker(new URL(import.meta.url), { execArgv: ['--experimental-strip-types', '--no-warnings'] });
    worker.on('message', ({ list, error }) => { const task = worker.task; worker.task = undefined; if (error) task.fail(new Error(error)); else task.done(list); next(worker); });
    worker.on('error', error => worker.task?.fail(error));
    workers.push(worker);
    return worker;
  };
  return {
    size,
    /** Every job's row, in the order given. */
    async play(jobs) {
      if (size <= 1 || jobs.length <= 1) return jobs.map(job => simulate(job.setup, job.runs, job.seed, job.tuning));
      const rows = jobs.map(job => {
        const pieces = [];
        for (let from = 0; from < job.runs; from += PIECE) pieces.push(new Promise((done, fail) => queue.push({ job, from, to: Math.min(job.runs, from + PIECE), done, fail })));
        return Promise.all(pieces).then(lists => tallyRuns(job.setup, lists.flat(), job.seed, job.tuning));
      });
      while (idle.length && queue.length) next(idle.pop());
      while (workers.length < size && queue.length) next(start());
      return Promise.all(rows);
    },
    async close() { await Promise.all(workers.map(worker => worker.terminate())); },
  };
}
