export interface FrameworkCandidate {
  id: string;
  entry: string;
  sources: string[];
  score: number;
  signals: string[];
}

export interface FrameworkAdapter {
  name: string;
  detect(rootDir: string): boolean;
  extractCandidates(rootDir: string): FrameworkCandidate[];
}
