export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export interface ParseCSVAsyncOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  chunkSize?: number;
}

/**
 * Parsifica una stringa CSV in modo asincrono e non bloccante.
 * Gestisce separatori dinamici, campi tra virgolette, raddoppio delle virgolette, newline nei campi quotati e BOM.
 */
export async function parseHistoricalCSVAsync(
  csvText: string,
  options: ParseCSVAsyncOptions = {}
): Promise<ParsedCSV> {
  const { onProgress, signal, chunkSize = 50000 } = options;

  // Rimuove il BOM UTF-8 se presente
  if (csvText.startsWith('\uFEFF')) {
    csvText = csvText.slice(1);
  }

  // Rilevamento del separatore basato sulle occorrenze nella prima riga al di fuori delle virgolette
  const firstLineEnd = csvText.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? csvText : csvText.slice(0, firstLineEnd);
  
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  let localInQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') {
      localInQuotes = !localInQuotes;
    } else if (!localInQuotes) {
      if (char === ',') {
        commaCount++;
      } else if (char === ';') {
        semiCount++;
      } else if (char === '\t') {
        tabCount++;
      }
    }
  }

  let separator = ',';
  if (semiCount > commaCount && semiCount > tabCount) {
    separator = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    separator = '\t';
  }

  const results: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const totalLength = csvText.length;

  for (let i = 0; i < totalLength; ) {
    if (signal?.aborted) {
      throw new Error('Parsing cancelled');
    }

    const chunkEnd = Math.min(i + chunkSize, totalLength);
    for (; i < chunkEnd; i++) {
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

    if (onProgress && totalLength > 0) {
      onProgress(Math.min(99, Math.round((i / totalLength) * 100)));
    }

    // Rilascia il thread principale
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Aggiunge l'ultima riga se non completata da un newline
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== '')) {
      results.push(currentRow);
    }
  }

  if (onProgress) {
    onProgress(100);
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
 * Parsifica una stringa CSV in modo robusto, carattere per carattere.
 * Gestisce separatori dinamici, campi tra virgolette, raddoppio delle virgolette e BOM.
 */
export function parseHistoricalCSV(csvText: string): ParsedCSV {
  // Rimuove il BOM UTF-8 se presente
  if (csvText.startsWith('\uFEFF')) {
    csvText = csvText.slice(1);
  }

  // Rilevamento del separatore basato sulle occorrenze nella prima riga al di fuori delle virgolette
  const firstLine = csvText.split(/\r?\n/)[0] || '';
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  let localInQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') {
      localInQuotes = !localInQuotes;
    } else if (!localInQuotes) {
      if (char === ',') {
        commaCount++;
      } else if (char === ';') {
        semiCount++;
      } else if (char === '\t') {
        tabCount++;
      }
    }
  }

  let separator = ',';
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
