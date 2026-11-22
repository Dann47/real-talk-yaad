/** Money and number formatting. */

/** 4250 → "J$4,250.00" */
export function money(amount: number, decimals = 2): string {
  const sign = amount < 0 ? '−' : '';
  const [whole, cents] = Math.abs(amount).toFixed(decimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}J$${grouped}${cents ? `.${cents}` : ''}`;
}
