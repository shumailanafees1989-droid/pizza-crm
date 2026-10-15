/* Business-domain constants and helpers shared by views. */
import { store } from './store.js';
import { sum } from './util.js';

export const CATEGORIES = [
  { key: 'pizza', label: 'Pizzas', emoji: '🍕' },
  { key: 'sides', label: 'Sides', emoji: '🍗' },
  { key: 'desserts', label: 'Desserts', emoji: '🍰' },
  { key: 'drinks', label: 'Drinks', emoji: '🥤' },
];
export const categoryLabel = (k) => CATEGORIES.find((c) => c.key === k)?.label || k;
export const categoryEmoji = (k) => CATEGORIES.find((c) => c.key === k)?.emoji || '🍽️';

export const SIZES = [
  { key: 'small', label: 'Small', short: 'S', desc: '10"' },
  { key: 'medium', label: 'Medium', short: 'M', desc: '12"' },
  { key: 'large', label: 'Large', short: 'L', desc: '14"' },
];
export const sizeLabel = (k) => SIZES.find((s) => s.key === k)?.label || (k === 'regular' ? 'Regular' : k);
export const sizeShort = (k) => SIZES.find((s) => s.key === k)?.short || '';

export const ROLES = ['Manager', 'Chef', 'Pizzaiolo', 'Cashier', 'Server', 'Delivery Driver', 'Kitchen Assistant'];
export const STAFF_STATUS = {
  active: { label: 'Active', tone: 'green' },
  on_leave: { label: 'On leave', tone: 'amber' },
  inactive: { label: 'Inactive', tone: 'gray' },
};
export const PRIORITY = {
  low: { label: 'Low', tone: 'gray' },
  medium: { label: 'Medium', tone: 'amber' },
  high: { label: 'High', tone: 'red' },
};
export const TASK_STATUS = {
  todo: { label: 'To do', tone: 'gray' },
  in_progress: { label: 'In progress', tone: 'blue' },
  done: { label: 'Done', tone: 'green' },
};

export const ORDER_TYPES = { delivery: 'Delivery', pickup: 'Pickup', 'dine-in': 'Dine-in' };
export const PAYMENT_METHODS = { card: 'Card', cash: 'Cash', online: 'Online' };
export const PAYMENT_STATUS = {
  paid: { label: 'Paid', tone: 'green' },
  pending: { label: 'Unpaid', tone: 'amber' },
  refunded: { label: 'Refunded', tone: 'gray' },
};
export const ORDER_STATUS = {
  pending: { label: 'Pending', tone: 'amber', color: '#f4a622' },
  preparing: { label: 'Preparing', tone: 'blue', color: '#3b82c4' },
  ready: { label: 'Ready', tone: 'purple', color: '#8b5cf6' },
  out_for_delivery: { label: 'Out for delivery', tone: 'indigo', color: '#5b6ee1' },
  delivered: { label: 'Delivered', tone: 'green', color: '#2f9e63' },
  cancelled: { label: 'Cancelled', tone: 'red', color: '#d9534f' },
};
export function statusLabel(status, type) {
  if (status === 'delivered') return type === 'pickup' ? 'Picked up' : type === 'dine-in' ? 'Served' : 'Delivered';
  return ORDER_STATUS[status]?.label || status;
}
export const flowFor = (type) =>
  type === 'delivery'
    ? ['pending', 'preparing', 'ready', 'out_for_delivery', 'delivered']
    : ['pending', 'preparing', 'ready', 'delivered'];
export function nextStatus(o) {
  if (['delivered', 'cancelled'].includes(o.delivery_status)) return null;
  const f = flowFor(o.order_type);
  const i = f.indexOf(o.delivery_status);
  return i === -1 ? f[1] : f[i + 1] ?? null;
}

export const isCancelled = (o) => o.delivery_status === 'cancelled';
export const isActive = (o) => !['delivered', 'cancelled'].includes(o.delivery_status);
/** Orders that count towards sales (everything except cancelled). */
export const sales = (orders) => orders.filter((o) => !isCancelled(o));
export const revenueOf = (orders) => sum(sales(orders), (o) => o.total);
export const unitsOf = (o) => sum(o.items || [], (i) => i.qty);

export const customerMap = () => new Map(store.data.customers.map((c) => [c.id, c]));
export const customerName = (o, map = customerMap()) => map.get(o.customer_id)?.name || o.customer_name || 'Walk-in guest';

export function itemsSummary(o, max = 2) {
  const items = o.items || [];
  const parts = items.map((i) => `${i.qty}× ${i.name}${i.size && i.size !== 'regular' ? ` (${sizeShort(i.size)})` : ''}`);
  return parts.length > max ? `${parts.slice(0, max).join(', ')} +${parts.length - max} more` : parts.join(', ') || '—';
}

export const stockState = (i) => (+i.quantity <= 0 ? 'out' : +i.quantity <= +i.reorder_level ? 'low' : 'ok');
export const STOCK = {
  ok: { label: 'In stock', tone: 'green' },
  low: { label: 'Low stock', tone: 'amber' },
  out: { label: 'Out of stock', tone: 'red' },
};

/* ---------- preferences (kept in the browser) ---------- */
const PREF_KEY = 'pizzacrm:prefs';
const DEFAULT_PREFS = { shopName: 'Bella Napoli Pizzeria', deliveryFee: 3.99 };
export const getPrefs = () => {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
};
export const setPrefs = (p) => localStorage.setItem(PREF_KEY, JSON.stringify({ ...getPrefs(), ...p }));

/** Map<customer_id, orders[]> */
export function ordersByCustomer() {
  const m = new Map();
  for (const o of store.data.orders) {
    if (!o.customer_id) continue;
    if (!m.has(o.customer_id)) m.set(o.customer_id, []);
    m.get(o.customer_id).push(o);
  }
  return m;
}
