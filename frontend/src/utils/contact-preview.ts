export function filledContactRows(rows: string[][]): string[][] {
  return rows.filter((row) => row[2]?.trim() && row[2].trim() !== '-').map((row, index) => [String(index + 1), row[1], row[2]]);
}
