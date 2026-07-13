export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parsifica una stringa CSV in modo robusto, carattere per carattere.
 * Gestisce separatori dinamici, campi tra virgolette, raddoppio delle virgolette e BOM.
 */
export function parseHistoricalCSV(csvText: string): ParsedCSV {
  // Rimuove il BOM UTF-8 se presente
  if (csvText.startsWith('\uFEFF')) {
    csvText = csvText.slice(1);
  }

  // Rilevamento del separatore basato sulle occorrenze nella prima riga
  const firstLine = csvText.split(/\r?\n/)[0] || '';
  let separator = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) {
    separator = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    separator = '\t';
  }

  const results: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // salta la seconda virgoletta
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === separator) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        
        // Ignora righe completamente vuote
        if (currentRow.some(field => field !== '')) {
          results.push(currentRow);
        }
        currentRow = [];
        
        if (char === '\r' && nextChar === '\n') {
          i++; // salta il carattere newline accoppiato
        }
      } else {
        currentField += char;
      }
    }
  }

  // Aggiunge l'ultima riga se non completata da un newline
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== '')) {
      results.push(currentRow);
    }
  }

  if (results.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: results[0],
    rows: results.slice(1),
  };
}

/**
 * Converte stringhe numeriche, inclusi decimali con virgola italiana (es. "1,25" -> 1.25)
 */
export function parseNumberItalian(value: string | undefined): number {
  if (value === undefined || value === null || value.trim() === '') {
    return NaN;
  }
  const cleanValue = value.trim().replace(',', '.');
  return Number(cleanValue);
}
