/* Realistic, deterministic sample data (dates are relative to "now"). */
import { uid, addDays, startOfDay, isoDay, round2 } from './util.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MENU = [
  // name, category, emoji, [S, M, L] | [regular], ingredients, description, weight
  ['Margherita', 'pizza', '🍕', [9.5, 13, 16.5], ['Tomato sauce', 'Fresh mozzarella', 'Basil', 'Olive oil'], 'The classic. San Marzano tomatoes, fior di latte and fresh basil.', 14],
  ['Pepperoni Classic', 'pizza', '🍕', [10.5, 14.5, 18], ['Tomato sauce', 'Mozzarella', 'Pepperoni'], 'Crispy-edged pepperoni cups on a mozzarella blanket.', 20],
  ['Hawaiian Pizza', 'pizza', '🍕', [10.5, 14, 17.5], ['Tomato sauce', 'Mozzarella', 'Ham', 'Pineapple'], 'Sweet pineapple and smoky ham on artisan crust.', 8],
  ['Veggie Supreme', 'pizza', '🍕', [10.5, 14, 17.5], ['Tomato sauce', 'Mozzarella', 'Mushrooms', 'Bell peppers', 'Red onions', 'Black olives'], 'Loaded with fresh seasonal vegetables.', 7],
  ['Meat Lovers', 'pizza', '🍕', [12, 16.5, 20.5], ['Tomato sauce', 'Mozzarella', 'Pepperoni', 'Italian sausage', 'Ham', 'Bacon'], 'Four meats, zero apologies.', 10],
  ['Quattro Formaggi', 'pizza', '🍕', [11.5, 15.5, 19.5], ['Mozzarella', 'Parmesan', 'Gorgonzola', 'Provolone'], 'Four Italian cheeses, white base, finished with honey.', 6],
  ['Spicy Diavola', 'pizza', '🍕', [11, 15, 18.5], ['Tomato sauce', 'Mozzarella', 'Pepperoni', 'Jalapeños', 'Chili oil'], 'Calabrian-style heat with pepperoni and jalapeños.', 6],
  ['Truffle Mushroom', 'pizza', '🍕', [12.5, 17, 21.5], ['Mozzarella', 'Mushrooms', 'Truffle oil', 'Parmesan'], 'Roasted mushrooms, parmesan and truffle oil.', 3, false],
  ['Marinara Rustica', 'pizza', '🍕', [9.0, 12, 15], ['San Marzano tomatoes', 'Garlic', 'Oregano', 'Extra virgin olive oil'], 'Neapolitan tradition, rich garlic and herb tomato sauce.', 6],
  ['BBQ Chicken Wings', 'sides', '🍗', [10.5], ['Chicken wings', 'Smoky BBQ sauce', 'Ranch dip'], 'Crisp oven-roasted wings glazed in smoky barbecue sauce.', 12],
  ['Buffalo Chicken Wings', 'sides', '🍗', [10.5], ['Chicken wings', 'Buffalo sauce', 'Blue cheese'], 'Ten fiery wings tossed in tangy buffalo glaze.', 7],
  ['Crispy Chicken Tenders', 'sides', '🍗', [9.5], ['Breaded chicken breast', 'Honey mustard'], 'Golden crispy chicken strips with house dip.', 8],
  ['Garlic Knots', 'sides', '🥖', [5.5], ['Dough', 'Garlic', 'Parsley', 'Olive oil'], 'Six warm knots tossed in garlic butter.', 9],
  ['Caesar Salad', 'sides', '🥗', [8.5], ['Romaine', 'Parmesan', 'Croutons', 'Caesar dressing'], 'Crisp romaine, shaved parmesan, house croutons.', 4],
  ['Mozzarella Sticks', 'sides', '🧀', [7], ['Mozzarella', 'Breadcrumbs', 'Marinara'], 'Golden fried, served with marinara.', 5],
  ['Tiramisu', 'desserts', '🍰', [6.5], ['Mascarpone', 'Espresso', 'Ladyfingers', 'Cocoa'], 'Made in-house every morning.', 5],
  ['Cannoli Duo', 'desserts', '🥐', [5.5], ['Ricotta', 'Chocolate chips', 'Pistachio'], 'Two crisp shells with sweet ricotta cream.', 3],
  ['Cola', 'drinks', '🥤', [2.5], ['Cola'], '12 oz can.', 8],
  ['Sparkling Water', 'drinks', '💧', [2], ['Sparkling water'], '16 oz bottle.', 3],
  ['Italian Soda', 'drinks', '🍋', [3.5], ['Soda water', 'Fruit syrup'], 'Lemon, blood orange or cherry.', 3],
];

const CUSTOMERS = [
  ['Olivia Bennett', '218 Maple Ave, Apt 4B', 'Prefers extra crispy crust'],
  ['Noah Patel', '54 Cedar Lane', ''],
  ['Emma Rodriguez', '902 Willow St', 'Nut allergy — double-check sides'],
  ["Liam O'Connor", '17 Harbor View Rd', 'Office orders every Friday'],
  ['Ava Nguyen', '340 Elm Street, Unit 12', ''],
  ['Ethan Brooks', '76 Sunset Blvd', 'Ring doorbell twice'],
  ['Sophia Kim', '1215 Oakwood Dr', 'Vegetarian'],
  ['Mason Clarke', '8 Birch Court', ''],
  ['Isabella Rossi', '455 Lincoln Ave', 'VIP · birthday in March'],
  ['Lucas Meyer', '62 Park Place, Suite 3', ''],
  ['Mia Johnson', '1809 River Rd', 'Gate code 4471'],
  ['Henry Walker', '33 Chestnut Row', ''],
  ['Charlotte Davis', '710 Highland Pkwy', 'Gluten-free base requests'],
  ['Benjamin Ortiz', '251 Magnolia St', ''],
  ['Amelia Foster', '96 Lakeview Terrace', ''],
  ['Elijah Hughes', '520 Poplar Ave', 'Pays cash'],
  ['Harper Collins', '14 Juniper Way', ''],
  ['James Sullivan', '389 Station Rd', 'Catering enquiries'],
  ['Evelyn Price', '27 Orchard Lane', ''],
  ['Daniel Gomez', '1450 Market St, Apt 9', ''],
  ['Abigail Turner', '603 Cypress Ct', ''],
  ['Jack Morgan', '12 Foundry Row', 'Leave at door'],
  ['Grace Bailey', '884 Prospect Hill', ''],
  ['Samuel Reed', '39 Bayside Dr', ''],
];

const STAFF = [
  ['Marco Bellini', 'Manager', 'Full day (10–10)', 26, '2019-03-04'],
  ['Sofia Rossi', 'Chef', 'Morning (10–5)', 24, '2020-06-15'],
  ['Luca Romano', 'Pizzaiolo', 'Evening (4–11)', 21, '2021-01-11'],
  ['Aisha Khan', 'Cashier', 'Evening (4–11)', 16.5, '2022-08-22'],
  ['Diego Martinez', 'Delivery Driver', 'Evening (4–11)', 15, '2022-11-07'],
  ['Emily Carter', 'Delivery Driver', 'Morning (10–5)', 15, '2023-04-17'],
  ['Jamal Brooks', 'Kitchen Assistant', 'Morning (10–5)', 15.5, '2023-09-05'],
  ['Hannah Lee', 'Server', 'Evening (4–11)', 14, '2024-02-12', 'on_leave'],
];

// title, description, staff index, priority, status, due offset (days)
const TASKS = [
  ['Prep dough for tomorrow', '40 medium dough balls, proof overnight in the walk-in.', 2, 'high', 'in_progress', 0],
  ['Deep clean pizza ovens', 'Scrape deck, brush chamber, check gas line.', 6, 'medium', 'todo', 2],
  ['Count cash drawer', 'End-of-shift reconciliation and deposit slip.', 3, 'high', 'todo', 0],
  ['Order mozzarella & pepperoni', 'Below reorder level — place supplier order before noon.', 0, 'high', 'todo', 1],
  ['Update weekend special board', 'Quattro Formaggi + Cola combo at $19.', 7, 'low', 'done', -1],
  ['Service delivery scooter', 'Oil change and brake check, booked at 2pm.', 4, 'medium', 'todo', 3],
  ['Train new cashier on POS', 'Walk through refunds and split payments.', 0, 'medium', 'in_progress', 4],
  ['Sanitize prep surfaces', 'Full sanitise and temperature log check.', 6, 'high', 'done', -1],
  ['Plan Friday delivery rota', 'Cover for Hannah while she is on leave.', 0, 'medium', 'todo', 2],
  ['Reply to Google reviews', 'Respond to this week’s 8 new reviews.', 5, 'low', 'todo', 5],
  ['Dry goods stock count', 'Flour, yeast, packaging — update the inventory page.', 1, 'medium', 'in_progress', 1],
  ['Test new truffle sauce batch', 'Taste test and decide on menu price.', 1, 'low', 'done', -3],
];

// name, category, unit, qty, reorder level, cost/unit, supplier
const INVENTORY = [
  ['00 Pizza Flour', 'Dough & Flour', 'kg', 48, 25, 1.2, 'Molino Supply Co.'],
  ['Active Dry Yeast', 'Dough & Flour', 'kg', 2.5, 1, 9.5, 'Molino Supply Co.'],
  ['Shredded Mozzarella', 'Cheese', 'kg', 14, 20, 7.8, 'Valley Dairy'],
  ['Fresh Mozzarella', 'Cheese', 'kg', 8, 5, 11.2, 'Valley Dairy'],
  ['Parmesan', 'Cheese', 'kg', 6, 3, 16.5, 'Valley Dairy'],
  ['Gorgonzola', 'Cheese', 'kg', 1.2, 1.5, 18, 'Valley Dairy'],
  ['Pepperoni', 'Meats', 'kg', 3, 5, 12.9, 'Bianchi Provisions'],
  ['Italian Sausage', 'Meats', 'kg', 9, 5, 9.4, 'Bianchi Provisions'],
  ['Ham', 'Meats', 'kg', 6, 4, 8.7, 'Bianchi Provisions'],
  ['Grilled Chicken', 'Meats', 'kg', 7, 5, 8.2, 'Bianchi Provisions'],
  ['Bacon', 'Meats', 'kg', 4, 3, 10.4, 'Bianchi Provisions'],
  ['Mushrooms', 'Vegetables', 'kg', 0, 3, 4.6, 'Greenfield Produce'],
  ['Bell Peppers', 'Vegetables', 'kg', 6, 4, 3.4, 'Greenfield Produce'],
  ['Red Onions', 'Vegetables', 'kg', 9, 4, 1.8, 'Greenfield Produce'],
  ['Black Olives', 'Vegetables', 'kg', 3, 2, 6.2, 'Greenfield Produce'],
  ['Fresh Basil', 'Vegetables', 'bunch', 4, 6, 2.1, 'Greenfield Produce'],
  ['Jalapeños', 'Vegetables', 'kg', 2.5, 1.5, 4.1, 'Greenfield Produce'],
  ['Pizza Sauce', 'Sauces', 'L', 30, 15, 3.2, 'Molino Supply Co.'],
  ['BBQ Sauce', 'Sauces', 'L', 8, 4, 4.4, 'Molino Supply Co.'],
  ['Buffalo Sauce', 'Sauces', 'L', 3, 3, 5.1, 'Molino Supply Co.'],
  ['Extra Virgin Olive Oil', 'Sauces', 'L', 14, 6, 9.8, 'Molino Supply Co.'],
  ['Pizza Boxes 12"', 'Packaging', 'pcs', 240, 150, 0.42, 'PackRight'],
  ['Pizza Boxes 14"', 'Packaging', 'pcs', 90, 120, 0.55, 'PackRight'],
  ['Cola Cans', 'Beverages', 'pcs', 96, 48, 0.62, 'FreshFizz Beverages'],
  ['Sparkling Water', 'Beverages', 'pcs', 60, 24, 0.55, 'FreshFizz Beverages'],
];

const NOTES = ['Extra crispy please', 'No onions', 'Ring bell twice', 'Leave at door', 'Cut into squares', 'Light sauce', 'Extra napkins', 'Call on arrival', 'Birthday order 🎂'];
const GUESTS = ['Tom H.', 'Priya S.', 'Marcus L.', 'Jen W.', 'Carlos D.', 'Rachel T.'];
const GUEST_ADDR = ['4 Mill Street', '120 Rosewood Dr', '88 Canal Rd', '301 Aspen Way', '9 Quarry Lane'];

export function buildSeed(now = new Date()) {
  const r = rng(20240611);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const weighted = (items, w) => {
    let t = items.reduce((a, x, i) => a + w(x, i), 0) * r();
    for (let i = 0; i < items.length; i++) { t -= w(items[i], i); if (t <= 0) return items[i]; }
    return items[items.length - 1];
  };

  /* menu */
  const menu_items = MENU.map(([name, category, emoji, p, ingredients, description, weight, available], i) => ({
    id: uid(), name, category, emoji, description, ingredients, available: available !== false,
    prices: category === 'pizza' ? { small: p[0], medium: p[1], large: p[2] } : { regular: p[0] },
    created_at: addDays(now, -200 + i).toISOString(), _w: weight,
  }));

  /* customers */
  const customers = CUSTOMERS.map(([name, address, notes], i) => ({
    id: uid(), name,
    phone: `(555) ${210 + i * 13}-${String(1000 + ((i * 7919) % 9000)).padStart(4, '0')}`,
    email: `${name.toLowerCase().replace(/'/g, '').replace(/ /g, '.')}@example.com`,
    address: `${address}, Riverton`, notes,
    created_at: addDays(now, -Math.floor(20 + r() * 180)).toISOString(),
  }));

  /* staff + tasks */
  const staff = STAFF.map(([name, role, shift, rate, hired, status], i) => ({
    id: uid(), name, role, shift, hourly_rate: rate, hired_on: hired, status: status || 'active',
    phone: `(555) 08${i}-${String(2200 + i * 311).slice(0, 4)}`,
    email: `${name.toLowerCase().replace(/ /g, '.')}@bellanapoli.example`,
    created_at: addDays(now, -300 + i).toISOString(),
  }));
  const tasks = TASKS.map(([title, description, si, priority, status, due], i) => ({
    id: uid(), title, description, staff_id: staff[si].id, priority, status,
    due_date: isoDay(addDays(now, due)), created_at: addDays(now, -(i % 5)).toISOString(),
  }));

  /* inventory */
  const inventory = INVENTORY.map(([name, category, unit, quantity, reorder_level, cost_per_unit, supplier], i) => ({
    id: uid(), name, category, unit, quantity, reorder_level, cost_per_unit, supplier,
    updated_at: addDays(now, -(1 + Math.floor(r() * 6))).toISOString(), created_at: addDays(now, -120 + i).toISOString(),
  }));

  /* orders */
  const pizzas = menu_items.filter((m) => m.category === 'pizza' && m.available);
  const others = menu_items.filter((m) => m.category !== 'pizza');
  const catW = { sides: 10, desserts: 5, drinks: 12 };
  const HOURS = [[11, 4], [12, 9], [13, 8], [14, 4], [15, 2], [16, 3], [17, 7], [18, 11], [19, 12], [20, 9], [21, 5], [22, 2]];
  const DOW_BASE = [9, 7, 7, 8, 9, 14, 16];
  const DAYS = 120;
  const today = startOfDay(now);
  const orders = [];

  const makeOrder = (created, back) => {
    {
      const type = weighted(['delivery', 'pickup', 'dine-in'], (t) => ({ delivery: 55, pickup: 30, 'dine-in': 15 }[t]));
      const known = r() < 0.86 && type !== 'dine-in';
      const cust = known ? weighted(customers, (_, i) => 1 / Math.pow(i + 1, 0.55)) : null;

      // items
      const lineCount = weighted([1, 2, 3, 4], (x) => ({ 1: 45, 2: 35, 3: 15, 4: 5 }[x]));
      const lines = new Map();
      for (let l = 0; l < lineCount; l++) {
        const isPizza = l === 0 ? r() < 0.92 : r() < 0.6;
        const m = isPizza ? weighted(pizzas, (x) => x._w) : weighted(others, (x) => catW[x.category] * (x._w / 5));
        const size = isPizza ? weighted(['small', 'medium', 'large'], (s) => ({ small: 20, medium: 45, large: 35 }[s])) : 'regular';
        const qty = isPizza ? weighted([1, 2, 3], (q) => ({ 1: 75, 2: 20, 3: 5 }[q])) : weighted([1, 2], (q) => ({ 1: 70, 2: 30 }[q]));
        const key = m.id + size;
        if (lines.has(key)) lines.get(key).qty += qty;
        else lines.set(key, { menu_item_id: m.id, name: m.name, size, qty, unit_price: m.prices[size] });
      }
      const items = [...lines.values()];
      const fee = type === 'delivery' ? 3.99 : 0;
      const total = round2(items.reduce((a, i) => a + i.qty * i.unit_price, 0) + fee);

      // status
      const mins = (now - created) / 60000;
      let status;
      if (r() < 0.03) status = 'cancelled';
      else if (mins < 10) status = 'pending';
      else if (mins < 25) status = 'preparing';
      else if (mins < 35) status = 'ready';
      else if (mins < 55 && type === 'delivery') status = 'out_for_delivery';
      else status = 'delivered';

      const method = weighted(['card', 'cash', 'online'], (x) => ({ card: 55, cash: 25, online: 20 }[x]));
      let payment;
      if (status === 'cancelled') payment = method === 'cash' ? 'pending' : 'refunded';
      else if (status === 'delivered') payment = back <= 5 && r() < 0.04 ? 'pending' : 'paid';
      else payment = method === 'cash' ? 'pending' : 'paid';

      return {
        id: uid(), customer_id: cust ? cust.id : null,
        customer_name: cust ? cust.name : type === 'delivery' ? pick(GUESTS) : 'Walk-in guest',
        order_type: type,
        address: type !== 'delivery' ? '' : cust ? cust.address : `${pick(GUEST_ADDR)}, Riverton`,
        items, delivery_fee: fee, total, payment_method: method, payment_status: payment, delivery_status: status,
        notes: r() < 0.14 ? pick(NOTES) : '', created_at: created.toISOString(),
      };
    }
  };

  for (let back = DAYS; back >= 0; back--) {
    const day = addDays(today, -back);
    const growth = 0.75 + 0.35 * ((DAYS - back) / DAYS);
    const n = Math.max(3, Math.round(DOW_BASE[day.getDay()] * growth + (r() - 0.5) * 4));
    for (let k = 0; k < n; k++) {
      const [h] = weighted(HOURS, (x) => x[1]);
      const created = new Date(day); created.setHours(h, Math.floor(r() * 60), Math.floor(r() * 60));
      // today's orders are covered by the "live" batch below so there is always a kitchen queue to play with
      if (created > now || (back === 0 && now - created < 70 * 60000)) continue;
      orders.push(makeOrder(created, back));
    }
  }
  // a handful of live orders in the last hour, at every stage of the workflow
  [2, 6, 12, 19, 27, 34, 43, 52].forEach((m) => orders.push(makeOrder(new Date(now - m * 60000), 0)));
  orders.sort((a, b) => a.created_at.localeCompare(b.created_at));
  orders.forEach((o, i) => { o.order_no = 1001 + i; });
  menu_items.forEach((m) => delete m._w);

  return { customers, menu_items, staff, tasks, inventory, orders };
}
