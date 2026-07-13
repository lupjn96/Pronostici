export interface HistoricalMatch {
  id: string;
  datasetId: string; // Collegamento al dataset di origine

  date: string;
  season?: string;
  competition: string;

  homeTeam: string;
  awayTeam: string;

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

export interface HistoricalDataset {
  id: string;
  name: string;
  source: string;
  importedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  matches: HistoricalMatch[];
}
