const TAKA = "\u09F3";
const DASH = "\u2013";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export function budgetLabel(p) {
  if (!p) return TAKA + "0";
  if (p.budget_min && p.budget_max && p.budget_min !== p.budget_max) {
    return TAKA + fmt(p.budget_min) + DASH + fmt(p.budget_max);
  }
  return TAKA + fmt(p.budget_max || p.budget);
}

export function negotiableLabel(p) {
  if (p?.budget_negotiable === true) return "Negotiable";
  if (p?.budget_negotiable === false) return "Fixed price";
  return null;
}