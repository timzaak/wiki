/**
 * Locale Helper
 * Accept-Language header parsing and locale utilities
 */

module.exports = {
  /**
   * Parse Accept-Language header and extract preferred languages
   * @param {string} header - Accept-Language header value (e.g., "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7")
   * @returns {string[]} Array of locale codes sorted by priority (primary language code only)
   *
   * Example:
   * Input: "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
   * Output: ["zh", "en"]
   */
  parseAcceptLanguage (header) {
    if (!header || typeof header !== 'string') {
      return []
    }

    try {
      return header
        .split(',')
        .map(langPart => {
          // Split locale and q value (priority)
          const [locale, qValue] = langPart.split(';')

          // Extract primary language code only (e.g., "zh-CN" -> "zh")
          const code = locale.trim().toLowerCase().split('-')[0]

          // Parse q value (priority), default to 1.0
          const q = qValue ? parseFloat(qValue.split('=')[1]) : 1.0

          return { code, q }
        })
        .filter(item => item.code && !isNaN(item.q)) // Filter invalid entries
        .sort((a, b) => b.q - a.q) // Sort by priority (descending)
        .map(item => item.code)
    } catch (err) {
      // If parsing fails, return empty array
      return []
    }
  }
}
