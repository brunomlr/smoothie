/**
 * Generate a deterministic placeholder hash based on input
 * Uses the original hash to seed the output so the same action always gets the same placeholder.
 * Used to hide real transaction hashes for demo wallets.
 */
export function generatePlaceholderHash(seed: string): string {
  // Use multiple seed values from different parts of the input for better distribution
  const hexChars = '0123456789abcdef'
  let result = ''

  for (let i = 0; i < 64; i++) {
    // Combine seed character codes with position for variety
    const seedIndex = i % seed.length
    const charCode = seed.charCodeAt(seedIndex)
    const nextCharCode = seed.charCodeAt((seedIndex + 1) % seed.length)
    const prevCharCode = seed.charCodeAt((seedIndex + seed.length - 1) % seed.length)

    // Mix multiple values together
    const mixed = (charCode * 31 + nextCharCode * 17 + prevCharCode * 13 + i * 7) ^ (i * charCode)
    result += hexChars[Math.abs(mixed) % 16]
  }

  return result
}
