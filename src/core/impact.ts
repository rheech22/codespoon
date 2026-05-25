import type { Graph } from './types.js';

export function findAffectedNodes(changedFiles: string[], graph: Graph): string[] {
  const affected = new Set<string>();

  for (const changedFile of changedFiles) {
    for (const source of graph.sources) {
      if (source.path === changedFile) {
        affected.add(source.nodeId);
      } else if (changedFile.startsWith(source.path + '/')) {
        affected.add(source.nodeId);
      }
    }
  }

  return Array.from(affected);
}
