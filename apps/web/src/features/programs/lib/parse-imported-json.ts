import { PROGRAM_IMPORT_MAX_PAYLOAD_BYTES } from '@gym-companion/validation';

export type ParsedImportJson =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

export function indexToLineColumn(
  text: string,
  index: number,
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < clamped; i += 1) {
    if (text[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function locationFromJsonSyntaxError(
  text: string,
  error: SyntaxError,
): { line: number; column: number } | null {
  const positionMatch = /position\s+(\d+)/i.exec(error.message);
  if (positionMatch) {
    return indexToLineColumn(text, Number(positionMatch[1]));
  }
  const lineCol = /line\s+(\d+)\s+column\s+(\d+)/i.exec(error.message);
  if (lineCol) {
    return { line: Number(lineCol[1]), column: Number(lineCol[2]) };
  }
  return null;
}

export function parseImportedJsonText(text: string): ParsedImportJson {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'JSON invalide. Colle le JSON généré par l’IA.' };
  }

  const bytes = new TextEncoder().encode(trimmed).length;
  if (bytes > PROGRAM_IMPORT_MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      message: `JSON invalide. Le JSON dépasse ${PROGRAM_IMPORT_MAX_PAYLOAD_BYTES} octets.`,
    };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    if (error instanceof SyntaxError) {
      const location =
        locationFromJsonSyntaxError(trimmed, error) ??
        indexToLineColumn(trimmed, Math.max(0, trimmed.length - 1));
      return {
        ok: false,
        message: `JSON invalide. Ligne ${location.line}, colonne ${location.column} : JSON invalide.`,
      };
    }
    return { ok: false, message: 'JSON invalide.' };
  }
}
