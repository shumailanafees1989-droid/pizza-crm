# 🍕 Bella Napoli Pizza CRM

A complete, modern, responsive CRM built for pizza shops and pizzerias to manage everyday operations with speed and precision.

---

## 🚀 Quick Start / Local URL

The local web server is currently running and ready to use:

👉 **[http://localhost:5173/](http://localhost:5173/)**

> **Note to run the server in the future:**
> If you close the terminal, you can start the local server anytime by running in PowerShell:
> ```powershell
> powershell -ExecutionPolicy Bypass -File "serve.ps1"
> ```
> (or use any static server like `npx serve .` or Python `python -m http.server 5173`).

---

## 📦 What's Included

### 1. 📊 Dashboard
- **Key Metrics:** Total orders, total revenue, pending orders, today's revenue (with percentage change indicators).
- **Interactive Revenue Chart:** View sales over the last 7, 14, or 30 days with hover tooltips.
- **Order Status Mix:** Real-time donut chart showing 30-day fulfillment ratio.
- **Live Kitchen Queue:** Shows active in-progress orders ordered by age with a 1-click **Advance Status** button.
- **Low Stock & Team Alerts:** Immediate visibility into supplies needing reorder and pending staff tasks.

### 2. 🧾 Orders Management
- **Full CRUD:** Create, view details, edit items/addresses/notes, and delete orders.
- **Dynamic Order Form:**
  - Real-time pricing calculation based on size (Small, Medium, Large, or Regular for sides/drinks).
  - Automatically loads customer delivery addresses.
  - Multi-line item builder with quantity multipliers and delivery fee toggling.
- **Status Workflow:** Transition orders through `Pending` ➔ `Preparing` ➔ `Ready` ➔ `Out for Delivery` / `Picked up` ➔ `Delivered` / `Served`.
- **Payment tracking:** Fast `Mark Paid` action, payment method filter, and status pills.
- **Search & Filters:** Search by order number, customer name, address, or item names. Filter by status, payment, and date range.

### 3. 👥 Customers
- **Directory:** Customer names, phone numbers, emails, delivery addresses, and preference notes.
- **Customer Profile Drawer:** Click any customer to open a slide-out drawer showing their total orders, lifetime spend, average order value, and full chronological order history.
- **Duplicate Prevention:** Prevents accidental duplicate phone numbers.
- **1-Click Order Creation:** Start a new order pre-assigned to that customer directly from their profile.

### 4. 🍕 Menu Management
- **Categories:** Pizzas, Sides, Desserts, and Drinks.
- **Dynamic Pricing Model:** Multi-size pricing (`Small`, `Medium`, `Large`) for pizzas and single pricing for sides/drinks.
- **Ingredients & Allergens:** Tag-based ingredient lists with comma-separated inputs.
- **Availability Switch:** Instant toggle on menu cards to mark items out of stock or seasonal.
- **Sales Analytics:** Displays units sold per item over the last 30 days.

### 5. 🧑‍🍳 Team Management
- **Staff Directory:** Role badges, contact information, hourly wages, shifts, and hire dates.
- **Interactive Kanban Tasks Board:**
  - `To Do`, `In Progress`, and `Done` columns with single-click arrow buttons to move tasks.
  - Due dates with visual **overdue alerts**.
  - Assign staff members with team avatar indicators.

### 6. 📦 Inventory & Stock Alerts
- **Stock Tracking:** Quantities, units (`kg`, `g`, `L`, `pcs`, etc.), unit costs, and suppliers.
- **Visual Stock Meters:** Progress bars with reorder threshold indicators.
- **Restock Action:** Quick adjustment modal with +/- increment shortcuts (+5, +10, +25, +50).
- **Alert Banner:** Automatic alert summarizing all ingredients at or below reorder level.

### 7. 📈 Sales Reports
- **Periodic Breakdown:** Daily, weekly, and monthly aggregations with trend comparisons.
- **Top Sellers:** Ranked by total revenue and quantity sold.
- **Category & Payment Mix:** Visual distribution charts.
- **Export & Print:**
  - **Export CSV:** One-click download of full tabular reporting data.
  - **Print Layout:** Clean print CSS formatting ready for PDF or physical printouts.

### 8. 🗄️ Database & Deployment (Supabase or Demo Mode)
- **Local Demo Mode:** Works instantly out of the box using `localStorage` preloaded with 120 days of realistic orders, team, and inventory.
- **Supabase Integration:**
  - SQL Schema ready in `supabase/schema.sql` with full table definitions, constraints, foreign keys, and Row Level Security (RLS) policies.
  - Connect your database in **Settings** or in `js/config.js` (`SUPABASE_URL` and `SUPABASE_ANON_KEY`).
  - Includes a one-click **Load Sample Data** tool in Settings to populate your remote Supabase project.

---

## 🎨 Design Features
- Curated modern color palette tailored for warm restaurant aesthetics with dark mode support.
- Fully responsive layout: desktop sidebar and mobile hamburger menu with bottom-sheet drawer forms.
- High performance, zero external framework bloat, fast load times.
