/** Speech-only formatting. Never edits the displayed testimony or its truth expression. */
function chineseNumber(value) {
  const digits = '零一二三四五六七八九';
  if (value < 10) return digits[value];
  if (value < 20) return '十' + (value % 10 ? digits[value % 10] : '');
  return digits[Math.floor(value / 10)] + '十' + (value % 10 ? digits[value % 10] : '');
}
export function normalizeForSpeech(text) {
  return String(text)
    .replace(/(^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g, (_, prefix, hour, minute) => {
      const m = Number(minute);
      return prefix + chineseNumber(Number(hour)) + '点' + (m === 0 ? '整' : (m < 10 ? '零' : '') + chineseNumber(m) + '分');
    })
    .replace(/[“”「」『』]/g, '')
    .replace(/;/g, '；')
    .replace(/\r?\n+/g, '。')
    .replace(/\s+/g, ' ')
    .replace(/。{2,}/g, '。')
    .trim();
}
