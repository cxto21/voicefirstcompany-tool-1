/**
 * Sentence Splitter for Real-Time Conversational Voice Streaming
 * Analyzes incoming token streams, accurately detects sentence boundaries,
 * avoids false splits on decimals/abbreviations, and emits cohesive spoken sentences.
 */

const KNOWN_ABBREVIATIONS = new Set([
  "dr.", "dra.", "sr.", "sra.", "srta.", "prof.", "ing.", "lic.", "gen.",
  "vs.", "ej.", "etc.", "e.g.", "i.e.", "p. ej.", "p.ej.", "q1.", "q2.", "q3.", "q4.",
  "art.", "num.", "no.", "mr.", "mrs.", "ms.", "st.", "inc.", "ltd.", "corp.", "dept.",
]);

export class SentenceSplitter {
  private buffer = "";
  private onSentenceCallback: (sentence: string, isLast: boolean) => void;

  constructor(onSentence: (sentence: string, isLast: boolean) => void) {
    this.onSentenceCallback = onSentence;
  }

  public feed(chunk: string) {
    this.buffer += chunk;
    this.processBuffer(false);
  }

  public finish() {
    this.processBuffer(true);
  }

  public reset() {
    this.buffer = "";
  }

  /**
   * Scans the text buffer to find the index where the first complete sentence ends.
   * Returns the end index (exclusive) in text, or -1 if no complete boundary found.
   */
  private findSentenceBoundary(text: string): number {
    const len = text.length;
    let i = 0;

    while (i < len) {
      const ch = text[i];

      // Newlines are always hard breaks if preceded by words
      if (ch === "\n") {
        const preceding = text.slice(0, i).trim();
        if (preceding.length > 0) {
          return i + 1;
        }
        i++;
        continue;
      }

      // Sentence terminators: . ! ?
      if (ch === "." || ch === "!" || ch === "?") {
        // Handle ellipses (...) -> wait until after the last dot
        if (ch === "." && i + 1 < len && text[i + 1] === ".") {
          while (i < len && text[i] === ".") {
            i++;
          }
          // After ellipses, check if followed by whitespace or end
          if (i >= len || /\s/.test(text[i])) {
            const preceding = text.slice(0, i).trim();
            if (preceding.length > 0) {
              return i;
            }
          }
          continue;
        }

        // Check if period is a decimal point between digits (e.g. 3.7 or 1.5)
        if (ch === "." && i > 0 && i + 1 < len) {
          const prevChar = text[i - 1];
          const nextChar = text[i + 1];
          if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
            i++;
            continue;
          }
        }

        // Check if period belongs to a known abbreviation (e.g. "Q3." or "Dr." or "etc.")
        if (ch === ".") {
          // Look backwards for the word before this dot
          const beforeDot = text.slice(0, i + 1);
          const match = beforeDot.match(/([a-zA-Z0-9.]+)\.$/);
          if (match) {
            const word = match[0].toLowerCase();
            if (KNOWN_ABBREVIATIONS.has(word)) {
              i++;
              continue;
            }
          }
        }

        const nextIdx = i + 1;

        // Check if period is inside a word or domain name without whitespace (e.g. "example.com", "app.tsx", "3.7")
        if (ch === "." && nextIdx < len && /[a-zA-Z0-9]/.test(text[nextIdx])) {
          i++;
          continue;
        }

        // Must be followed by whitespace, quote, or closing punctuation
        if (nextIdx >= len) {
          // If at the end of buffer and ended with exclamation or question mark:
          if (ch === "!" || ch === "?") {
            const preceding = text.slice(0, nextIdx).trim();
            if (preceding.length > 0) {
              return nextIdx;
            }
          }
          // For a period at the end of the streaming buffer, wait for the next token to confirm if it's followed by space or a domain extension (like .com)
          return -1;
        }

        const nextChar = text[nextIdx];
        if (/\s/.test(nextChar) || nextChar === '"' || nextChar === "'" || nextChar === "»" || nextChar === "”") {
          const preceding = text.slice(0, nextIdx).trim();
          if (preceding.length > 0) {
            return nextIdx;
          }
        }
      }

      // Soft boundary: if a single sentence is getting extremely long (> 130 chars) without terminal punctuation,
      // allow splitting on a major clause delimiter (; or ,) after at least 60 characters and 10 words.
      if ((ch === ";" || ch === ",") && i >= 65) {
        const preceding = text.slice(0, i).trim();
        const wordCount = preceding.split(/\s+/).filter(Boolean).length;
        if (wordCount >= 10 && i + 1 < len && /\s/.test(text[i + 1])) {
          return i + 1;
        }
      }

      i++;
    }

    return -1;
  }

  private processBuffer(isFinal: boolean) {
    // Strip action tokens from working buffer
    let cleanText = this.buffer.replace(/\[\[\[ACTION:.*?\]\]\]/g, "");

    while (true) {
      const boundary = this.findSentenceBoundary(cleanText);
      if (boundary === -1) {
        break;
      }

      const sentence = cleanText.slice(0, boundary).trim();
      cleanText = cleanText.slice(boundary);

      if (sentence.length > 0) {
        this.onSentenceCallback(sentence, false);
      }
    }

    if (isFinal) {
      const remaining = cleanText.trim();
      if (remaining.length > 0) {
        this.onSentenceCallback(remaining, true);
      }
      this.buffer = "";
    } else {
      this.buffer = cleanText;
    }
  }
}


