import { POLICY_IDS, normalizeConfig, runSimulation, type SimulationConfig } from './combat/simulator.ts';
import type { CombatDefinition } from './combat/types.ts';

// A separate worker keeps large batches off the UI thread; cancellation terminates this worker.
self.onmessage = (message: MessageEvent<{ config: SimulationConfig; baseline: CombatDefinition }>) => {
  try {
    const { baseline } = message.data;
    const config = normalizeConfig(message.data.config);
    const reports = POLICY_IDS.map((policy, index) => {
      const report = runSimulation({ ...config, policy }, baseline);
      self.postMessage({ type: 'progress', completed: index + 1, total: POLICY_IDS.length });
      return report;
    });
    self.postMessage({ type: 'complete', reports });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
