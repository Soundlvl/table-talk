// client/src/utils.ts

/**
 * A mapping from lowercase Latin characters to Runic Unicode characters.
 * This is a simplified mapping for visual obfuscation.
 */
const latinToRunicMap: { [key: string]: string } = {
  a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ',
  f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ', j: 'ᛃ',
  k: 'ᚲ', l: 'ᛚ', m: 'ᛗ', n: 'ᚾ', o: 'ᛟ',
  p: 'ᛈ', q: 'ᛩ', // Using ᛩ for q as it's sometimes used for Q-like sounds, or ᚲᚹ could be an alternative
  r: 'ᚱ', s: 'ᛊ', t: 'ᛏ', u: 'ᚢ', v: 'ᚹ',
  w: 'ᚹ', x: 'ᛪ', // Using ᛪ for x (ks sound)
  y: 'ᛁ', z: 'ᛉ',
};

/**
 * Converts Latin text to a string of Runic characters based on latinToRunicMap.
 * Characters not in the map (like spaces, numbers, punctuation) are preserved.
 * @param {string} text - The Latin text to convert.
 * @returns {string} The text with Latin characters replaced by Runic ones.
 */
function latinToRunic(text: string): string {
  if (!text) return '';
  let runicText: string = '';
  for (let i = 0; i < text.length; i++) {
    const charLower: string = text[i].toLowerCase();
    runicText += latinToRunicMap[charLower] || text[i];
  }
  return runicText;
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} The shuffled array.
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Scrambles the characters within a single word.
 * Handles multi-byte Unicode characters correctly.
 * @param {string} word - The word to scramble.
 * @returns {string} The scrambled word.
 */
function scrambleWord(word: string): string {
  const chars: string[] = Array.from(word); // Use Array.from for Unicode compatibility
  return shuffleArray(chars).join('');
}

/**
 * Converts Latin text to Runic and then scrambles the letters within each Runic word.
 * Preserves spaces between words.
 * @param {string} text - The original Latin text.
 * @returns {string} The scrambled Runic text.
 */
export function getScrambledRunicText(text: string): string {
  if (!text) return '';
  const runicText: string = latinToRunic(text);
  return runicText
    .split(' ')
    .map(scrambleWord)
    .join(' ');
}

/**
 * Generates a consistent HSL color from a string (e.g., a character name).
 * Ensures that a given string will always produce the same color.
 * Used for avatars and message borders.
 * @param {string} str - The input string.
 * @returns {string} An HSL color string (e.g., 'hsl(120, 50%, 40%)').
 */
export const nameToHslColor = (str: string): string => {
  if (!str) return 'hsl(0, 0%, 70%)'; // Default color for safety if called with empty string
  let hash: number = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h: number = hash % 360;
  return `hsl(${h}, 50%, 40%)`;
};

/**
 * Extracts initials from a name string.
 * Handles single names (up to 2 chars) or multi-word names (first letter of first and last word).
 * @param {string} name - The name to get initials from.
 * @returns {string} The uppercase initials.
 */
export const getInitials = (name: string): string => {
  if (!name) return '';
  const words: string[] = name.trim().split(/\s+/); 
  if (words.length > 1 && words[0] && words[words.length - 1]) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};