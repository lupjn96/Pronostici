export interface HistoricalMatch {
  id: string;
  datasetId: string; // Collegamento al dataset di origine

  date: string;
  season?: string;
  competition: string;
  competitionKey?: string;

  homeTeam: string;
  awayTeam: string;
  homeTeamKey?: string;
  awayTeamKey?: string;

  homeGoals: number;
  awayGoals: number;

  halfTimeHomeGoals?: number;
  halfTimeAwayGoals?: number;

  homeShots?: number;
  awayShots?: number;

  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;

  homeCorners?: number;
  awayCorners?: number;

  homeYellowCards?: number;
  awayYellowCards?: number;

  homeRedCards?: number;
  awayRedCards?: number;

  homeXG?: number;
  awayXG?: number;

  oddsHome?: number;
  oddsDraw?: number;
  oddsAway?: number;

  source: string;
  importedAt: string;
}

export interface HistoricalDatasetMetadata {
  id: string;
  name: string;
  source: string;
  importedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

export interface HistoricalDataset extends HistoricalDatasetMetadata {
  matches: HistoricalMatch[];
}

export interface HistoricalDiagnostics {
  totalMatches: number;
  totalCompetitions: number;
  uniqueTeams: number;
  timeRange: string;
  pctOdds: number;
  pctXG: number;
  pctComplete: number;
  warnings: { type: 'warning' | 'info'; text: string }[];
}

