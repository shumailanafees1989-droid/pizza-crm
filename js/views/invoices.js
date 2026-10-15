import { store, update } from '../store.js';
import {
  $, $$, esc, icon, fmtMoney, fmtDateTime, fmtDate, timeAgo, debounce, sum, round2, download, isoDay
} from '../util.js';
import { openModal, badge, pager, empty, iconBtn, run, toast } from '../ui.js';
import {
  ORDER_STATUS, PAYMENT_STATUS, ORDER_TYPES, PAYMENT_METHODS, customerMap, customerName,
  itemsSummary, sizeLabel, getPrefs, isCancelled
} from '../domain.js';

const PAGE = 15;
const state = { q: '', payment: '', range: 'all', page: 1 };

/* =========================================================================
   INVOICE MODAL (Standalone, printable & downloadable)
   ========================================================================= */
export function openInvoiceModal(order, initialLayout = 'invoice') {
  if (!order) return;
  const prefs = getPrefs();
  const map = customerMap();
  const cust = map.get(order.customer_id);
  const custName = customerName(order, map);
  const invNo = `INV-${order.order_no || String(order.id).slice(0, 6).toUpperCase()}`;
  const subtotal = sum(order.items || [], (i) => i.qty * i.unit_price);
  const fee = +order.delivery_fee || 0;
  const taxRate = 0.0825; // 8.25% standard sales tax
  const taxAmount = round2(subtotal * taxRate);
  const total = +order.total || (subtotal + fee);

  let currentLayout = initialLayout; // 'invoice' | 'receipt'

  function getInvoiceHTML(layout) {
    const isReceipt = layout === 'receipt';
    return `
      <div class="invoice-container ${isReceipt ? 'thermal' : 'formal'}" id="printableInvoice">
        <!-- Watermark / Status Stamp -->
        <div class="invoice-stamp ${order.payment_status === 'paid' ? 'paid' : 'pending'}">
          ${order.payment_status === 'paid' ? 'PAID' : 'PAYMENT DUE'}
        </div>

        <!-- Header -->
        <header class="inv-header">
          <div class="inv-brand">
            <span class="inv-logo">🍕</span>
            <div>
              <h2 class="inv-shop">${esc(prefs.shopName)}</h2>
              <p class="inv-tagline">Artisan Pizzas & Italian Specialties</p>
              <div class="inv-meta sm muted">
                <div>104 Artisan Way, Riverton</div>
                <div>Tel: (555) 019-8800 · support@bellanapoli.example</div>
                <div>Tax ID: US-884920194</div>
              </div>
            </div>
          </div>
          <div class="inv-doc-info">
            <div class="inv-title">${isReceipt ? 'ORDER RECEIPT' : 'TAX INVOICE'}</div>
            <div class="inv-num">${invNo}</div>
            <div class="inv-meta-row"><span>Date:</span> <b>${fmtDate(order.created_at)}</b></div>
            <div class="inv-meta-row"><span>Time:</span> <b>${fmtDateTime(order.created_at).split(',')[1] || ''}</b></div>
            <div class="inv-meta-row"><span>Order Ref:</span> <b>#${order.order_no}</b></div>
            <div class="inv-meta-row"><span>Type:</span> <b>${ORDER_TYPES[order.order_type] || order.order_type}</b></div>
          </div>
        </header>

        <div class="inv-divider"></div>

        <!-- Customer / Order Info -->
        <section class="inv-parties">
          <div class="inv-party">
            <span class="inv-subhead">BILL TO / CUSTOMER</span>
            <div class="inv-party-name"><b>${esc(custName)}</b></div>
            ${cust?.phone ? `<div>Phone: ${esc(cust.phone)}</div>` : ''}
            ${cust?.email ? `<div>Email: ${esc(cust.email)}</div>` : ''}
            ${order.order_type === 'delivery' && order.address ? `<div class="inv-addr"><b>Delivery Address:</b><br>${esc(order.address)}</div>` : ''}
          </div>
          <div class="inv-party right">
            <span class="inv-subhead">PAYMENT INFORMATION</span>
            <div class="inv-meta-row"><span>Method:</span> <b>${PAYMENT_METHODS[order.payment_method] || order.payment_method}</b></div>
            <div class="inv-meta-row"><span>Status:</span> <b>${PAYMENT_STATUS[order.payment_status]?.label || order.payment_status}</b></div>
            ${order.notes ? `<div class="inv-notes"><b>Kitchen Notes:</b> <i>${esc(order.notes)}</i></div>` : ''}
          </div>
        </section>

        <!-- Line Items Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>Item Description</th>
              <th style="width:90px">Size</th>
              <th class="num" style="width:60px">Qty</th>
              <th class="num" style="width:90px">Price</th>
              <th class="num" style="width:100px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <b>${esc(item.name)}</b>
                </td>
                <td>${esc(sizeLabel(item.size))}</td>
                <td class="num">${item.qty}</td>
                <td class="num">${fmtMoney(item.unit_price)}</td>
                <td class="num"><b>${fmtMoney(item.qty * item.unit_price)}</b></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals & Calculations -->
        <div class="inv-bottom">
          <div class="inv-msg">
            <b>Thank you for dining with ${esc(prefs.shopName)}!</b>
            <p>Fresh dough made in-house every morning. San Marzano tomatoes & 100% whole milk mozzarella.</p>
            <div class="inv-barcode" aria-hidden="true">||| | ||||| || |||||| | |||| |||| ||| |||||</div>
          </div>
          <div class="inv-calc">
            <div class="inv-calc-row"><span>Subtotal:</span> <span>${fmtMoney(subtotal)}</span></div>
            ${fee > 0 ? `<div class="inv-calc-row"><span>Delivery Fee:</span> <span>${fmtMoney(fee)}</span></div>` : ''}
            <div class="inv-calc-row"><span>Sales Tax (incl.):</span> <span>${fmtMoney(taxAmount)}</span></div>
            <div class="inv-calc-row grand">
              <span>Total Amount:</span>
              <b>${fmtMoney(total)}</b>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="inv-foot">
          <div>Bella Napoli Pizzeria &copy; ${new Date().getFullYear()} · Riverton</div>
          <div>Questions regarding this invoice? Email billing@bellanapoli.example</div>
        </footer>
      </div>
    `;
  }

  const modal = openModal({
    title: `Invoice #${order.order_no} (${invNo})`,
    size: 'lg',
    body: `
      <div class="inv-toolbar no-print">
        <div class="tabs pill" id="invLayoutTabs">
          <button type="button" class="tab ${currentLayout === 'invoice' ? 'active' : ''}" data-layout="invoice">${icon('fileText', 14)} Full Tax Invoice</button>
          <button type="button" class="tab ${currentLayout === 'receipt' ? 'active' : ''}" data-layout="receipt">${icon('receipt', 14)} Thermal Receipt Slip</button>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn ghost sm" id="btnDownloadHTML" title="Save offline copy">${icon('download', 14)} Download HTML</button>
        <button type="button" class="btn primary sm" id="btnPrintInv">${icon('print', 14)} Print Invoice</button>
      </div>
      <div id="invRenderWrap">${getInvoiceHTML(currentLayout)}</div>
    `,
    footer: `
      ${order.payment_status === 'pending' ? `<button type="button" class="btn soft green" id="btnInvMarkPaid">${icon('dollar', 14)} Mark as Paid</button>` : ''}
      <span class="grow"></span>
      <button type="button" class="btn ghost" data-close>Close</button>
      <button type="button" class="btn primary" id="btnBottomPrint">${icon('print', 16)} Print</button>
    `,
    onMount: (el, api) => {
      const renderWrap = $('#invRenderWrap', el);

      // Toggle Layout
      el.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-layout]');
        if (tab) {
          currentLayout = tab.dataset.layout;
          $$('#invLayoutTabs .tab', el).forEach(t => t.classList.toggle('active', t.dataset.layout === currentLayout));
          renderWrap.innerHTML = getInvoiceHTML(currentLayout);
        }
      });

      // Print
      const doPrint = () => {
        window.print();
      };
      $('#btnPrintInv', el)?.addEventListener('click', doPrint);
      $('#btnBottomPrint', el)?.addEventListener('click', doPrint);

      // Download HTML Invoice
      $('#btnDownloadHTML', el)?.addEventListener('click', () => {
        const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${invNo} - ${esc(prefs.shopName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #222; margin: 0; padding: 24px; }
    .invoice-container { max-width: 780px; margin: 0 auto; border: 1px solid #ddd; padding: 32px; border-radius: 8px; }
    .inv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .inv-logo { font-size: 38px; }
    .inv-shop { margin: 0 0 4px; font-size: 22px; }
    .inv-tagline { margin: 0 0 6px; color: #666; font-size: 13px; }
    .inv-doc-info { text-align: right; }
    .inv-title { font-size: 20px; font-weight: 700; color: #e5432d; }
    .inv-num { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .inv-meta-row { font-size: 13px; margin: 2px 0; }
    .inv-divider { height: 2px; background: #eee; margin: 20px 0; }
    .inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13.5px; }
    .inv-subhead { font-size: 11px; text-transform: uppercase; color: #888; font-weight: 700; letter-spacing: .05em; display: block; margin-bottom: 4px; }
    .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13.5px; }
    .inv-table th { background: #f8f8f8; text-align: left; padding: 9px 10px; border-bottom: 2px solid #ddd; font-size: 12px; }
    .inv-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .num { text-align: right; }
    .inv-bottom { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; margin-bottom: 24px; }
    .inv-calc { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 14px; }
    .inv-calc-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
    .inv-calc-row.grand { font-size: 17px; font-weight: 700; border-top: 2px dashed #ddd; margin-top: 8px; padding-top: 8px; color: #e5432d; }
    .inv-stamp { display: inline-block; padding: 4px 10px; border: 2px solid; font-weight: 800; border-radius: 4px; font-size: 13px; text-transform: uppercase; margin-bottom: 12px; }
    .inv-stamp.paid { color: #2f9e63; border-color: #2f9e63; }
    .inv-stamp.pending { color: #d98a0b; border-color: #d98a0b; }
    .inv-foot { text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
    .inv-barcode { font-family: monospace; letter-spacing: 2px; font-size: 16px; margin-top: 12px; opacity: .6; }
  </style>
</head>
<body>
  ${getInvoiceHTML('invoice')}
</body>
</html>`;
        download(`${invNo}.html`, fullDoc, 'text/html');
        toast(`Invoice ${invNo}.html downloaded`);
      });

      // Mark Paid from Invoice
      $('#btnInvMarkPaid', el)?.addEventListener('click', async () => {
        await run(() => update('orders', order.id, { payment_status: 'paid' }), `Order #${order.order_no} marked paid`);
        order.payment_status = 'paid';
        renderWrap.innerHTML = getInvoiceHTML(currentLayout);
        $('#btnInvMarkPaid', el)?.remove();
      });
    }
  });

  return modal;
}

/* =========================================================================
   INVOICES VIEW (Browse & manage all customer invoices)
   ========================================================================= */
export default {
  title: 'Invoices',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2 class="page-sub">Generate, view, and print sales invoices and customer receipts.</h2></div>
        <div class="head-actions">
          <button class="btn primary" data-act="quick-invoice">${icon('receipt')} Generate from Order</button>
        </div>
      </div>

      <div class="kpi-grid compact" id="invKpis"></div>

      <section class="card">
        <div class="toolbar">
          <div class="search">
            ${icon('search', 16)}
            <input id="invSearch" class="input" type="search" placeholder="Search invoice #, order #, customer, phone…" value="${esc(state.q)}" aria-label="Search invoices">
          </div>
          <select id="invPayFilter" class="input" aria-label="Filter by payment">
            <option value="">All payment statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Payment Due (Unpaid)</option>
            <option value="refunded">Refunded</option>
          </select>
          <select id="invRangeFilter" class="input" aria-label="Filter by time">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
        <div id="invTableList"></div>
      </section>
    `;

    $('#invPayFilter', root).value = state.payment;
    $('#invRangeFilter', root).value = state.range;

    const list = () => {
      renderKpis(root);
      renderTable(root);
    };

    $('#invSearch', root).addEventListener('input', debounce((e) => {
      state.q = e.target.value;
      state.page = 1;
      renderTable(root);
    }));

    $('#invPayFilter', root).addEventListener('change', (e) => {
      state.payment = e.target.value;
      state.page = 1;
      list();
    });

    $('#invRangeFilter', root).addEventListener('change', (e) => {
      state.range = e.target.value;
      state.page = 1;
      list();
    });

    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) {
        const row = e.target.closest('tr[data-id]');
        if (row && !e.target.closest('button,a')) {
          const o = store.data.orders.find(x => x.id === row.dataset.id);
          if (o) openInvoiceModal(o, 'invoice');
        }
        return;
      }

      const id = btn.dataset.id;
      const order = id && store.data.orders.find(o => o.id === id);

      switch (btn.dataset.act) {
        case 'quick-invoice':
          openSelectOrderModal();
          break;
        case 'view-invoice':
          openInvoiceModal(order, 'invoice');
          break;
        case 'print-receipt':
          openInvoiceModal(order, 'receipt');
          break;
        case 'mark-paid':
          await run(() => update('orders', order.id, { payment_status: 'paid' }), `Invoice for Order #${order.order_no} marked paid`);
          list();
          break;
        case 'page':
          state.page = +btn.dataset.p;
          renderTable(root);
          break;
      }
    });

    list();
    return { refresh: list };
  }
};

function getFilteredOrders() {
  const map = customerMap();
  const q = state.q.trim().toLowerCase();
  const now = new Date();
  const since = state.range === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : state.range === 'all' ? null
    : new Date(Date.now() - (+state.range) * 86400000);

  return store.data.orders.filter(o => {
    if (isCancelled(o)) return false; // Invoices are generated for valid orders
    if (state.payment && o.payment_status !== state.payment) return false;
    if (since && new Date(o.created_at) < since) return false;
    if (q) {
      const invNum = `inv-${o.order_no}`;
      const cust = customerName(o, map).toLowerCase();
      const items = (o.items || []).map(i => i.name).join(' ').toLowerCase();
      const hay = `${invNum} #${o.order_no} ${cust} ${o.address || ''} ${items}`;
      if (!hay.includes(q.replace('#', ''))) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function renderKpis(root) {
  const valid = store.data.orders.filter(o => !isCancelled(o));
  const totalInvoiced = sum(valid, o => o.total);
  const paidOrders = valid.filter(o => o.payment_status === 'paid');
  const paidAmount = sum(paidOrders, o => o.total);
  const pendingOrders = valid.filter(o => o.payment_status === 'pending');
  const pendingAmount = sum(pendingOrders, o => o.total);

  $('#invKpis', root).innerHTML = [
    ['Total Invoiced', fmtMoney(totalInvoiced), 'fileText', 'blue', `${valid.length} total orders`],
    ['Collected / Paid', fmtMoney(paidAmount), 'check', 'green', `${paidOrders.length} settled invoices`],
    ['Payment Due', fmtMoney(pendingAmount), 'dollar', 'amber', `${pendingOrders.length} pending payment`],
    ['Avg Invoice', fmtMoney(valid.length ? totalInvoiced / valid.length : 0), 'trend', 'red', 'Per completed order'],
  ].map(([l, v, ic, tone, sub]) => `
    <div class="kpi tone-${tone}">
      <div class="kpi-ic">${icon(ic, 20)}</div>
      <div>
        <span class="kpi-label">${l}</span>
        <b class="kpi-val">${v}</b>
        <small class="muted">${sub}</small>
      </div>
    </div>
  `).join('');
}

function renderTable(root) {
  const el = $('#invTableList', root);
  const rows = getFilteredOrders();
  const maxPage = Math.max(1, Math.ceil(rows.length / PAGE));
  if (state.page > maxPage) state.page = maxPage;
  const page = rows.slice((state.page - 1) * PAGE, state.page * PAGE);
  const map = customerMap();

  if (!rows.length) {
    el.innerHTML = empty('🧾', 'No invoices found', 'Try adjusting your search filters or generate an invoice for an existing order.');
    return;
  }

  el.innerHTML = `
    <div class="table-wrap">
      <table class="table stack">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date & Time</th>
            <th>Customer</th>
            <th>Items</th>
            <th class="num">Amount</th>
            <th>Payment</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          ${page.map(o => {
            const invNo = `INV-${o.order_no}`;
            const cName = customerName(o, map);
            return `
              <tr data-id="${o.id}" class="clickable">
                <td data-label="Invoice #">
                  <b class="order-no" style="color:var(--primary)">${invNo}</b>
                  <div class="muted sm">Order #${o.order_no}</div>
                </td>
                <td data-label="Date">
                  <div>${fmtDate(o.created_at)}</div>
                  <div class="muted sm">${timeAgo(o.created_at)}</div>
                </td>
                <td data-label="Customer">
                  <b>${esc(cName)}</b>
                  <div class="muted sm">${ORDER_TYPES[o.order_type] || o.order_type}</div>
                </td>
                <td data-label="Items" class="items-cell">${esc(itemsSummary(o, 2))}</td>
                <td data-label="Amount" class="num"><b>${fmtMoney(o.total)}</b></td>
                <td data-label="Payment">
                  ${badge(PAYMENT_STATUS[o.payment_status]?.label, PAYMENT_STATUS[o.payment_status]?.tone)}
                  <div class="muted sm">${PAYMENT_METHODS[o.payment_method] || ''}</div>
                </td>
                <td class="actions" data-label="">
                  <button class="btn soft sm" data-act="view-invoice" data-id="${o.id}">
                    ${icon('fileText', 14)} Invoice
                  </button>
                  <button class="btn ghost sm" data-act="print-receipt" data-id="${o.id}" title="Print Kitchen/Delivery Receipt">
                    ${icon('receipt', 14)} Slip
                  </button>
                  ${o.payment_status === 'pending' ? `
                    <button class="btn soft green sm" data-act="mark-paid" data-id="${o.id}" title="Mark Paid">
                      ${icon('dollar', 14)} Pay
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ${pager(state.page, rows.length, PAGE)}
  `;
}

function openSelectOrderModal() {
  const map = customerMap();
  const recent = store.data.orders.slice(0, 30);

  openModal({
    title: 'Select Order to Generate Invoice',
    size: 'md',
    body: `
      <p class="muted">Select any recent order to generate, preview, and print its invoice or receipt:</p>
      <div class="field" style="margin-top:14px">
        <label for="selOrderInv">Choose Order:</label>
        <select class="input" id="selOrderInv">
          ${recent.map(o => `
            <option value="${o.id}">#${o.order_no} — ${esc(customerName(o, map))} (${fmtMoney(o.total)}) — ${fmtDate(o.created_at)}</option>
          `).join('')}
        </select>
      </div>
    `,
    footer: `
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="button" class="btn primary" id="btnConfirmGenInv">Generate Invoice</button>
    `,
    onMount: (el, api) => {
      $('#btnConfirmGenInv', el)?.addEventListener('click', () => {
        const id = $('#selOrderInv', el).value;
        const o = store.data.orders.find(x => x.id === id);
        api.close();
        if (o) openInvoiceModal(o, 'invoice');
      });
    }
  });
}
