/**
 * New Document Page - Create invoices and quotes
 * Dynamic line items, auto-calculations, customer selection
 */

let documentType = 'invoice';
let selectedCustomerId = null;
let selectedTemplateId = null;
let lineItems = [{ description: '', quantity: 1, unit_price: 0, btw_percentage: 21 }];
let allCustomers = [];
let defaultBtw = 21;

function showNotification(message, type = 'success') {
    const existing = document.querySelector('.settings-notification');
    if (existing) existing.remove();
    const notif = document.createElement('div');
    notif.className = `settings-notification settings-notification-${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

export async function initNewDocument() {
    // Check URL params for pre-selected template
    const params = router.getParams ? router.getParams() : {};
    const presetTemplateId = params.template_id || new URLSearchParams(window.location.hash.split('?')[1] || '').get('template_id');

    const html = `
        <div style="padding: var(--space-lg); max-width: 1000px; margin: 0 auto;">
            <div style="margin-bottom: var(--space-xl);">
                <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                    <i data-lucide="file-plus"></i>
                    New Document
                </h1>
                <p style="color: var(--color-text-secondary);">
                    Create a new invoice or quote
                </p>
            </div>

            <!-- Document Type Toggle -->
            <div class="settings-section">
                <div class="doc-type-toggle">
                    <button class="doc-type-btn active" data-type="invoice" id="btn-invoice">
                        <i data-lucide="receipt"></i> Invoice
                    </button>
                    <button class="doc-type-btn" data-type="quote" id="btn-quote">
                        <i data-lucide="file-text"></i> Quote
                    </button>
                </div>
            </div>

            <!-- Template Selection -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i data-lucide="layout-template"></i>
                    <h2>Template</h2>
                </div>
                <select id="template-select" class="form-input" style="max-width: 400px;">
                    <option value="">Select a template...</option>
                </select>
            </div>

            <!-- Customer Selection -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i data-lucide="user"></i>
                    <h2>Customer</h2>
                </div>
                <div style="display: flex; gap: var(--space-md); align-items: flex-start;">
                    <div style="flex: 1; position: relative;">
                        <input type="text" id="customer-search-input" class="form-input" placeholder="Search customers...">
                        <div id="customer-dropdown" class="customer-dropdown" style="display: none;"></div>
                    </div>
                    <button class="btn-secondary" id="add-customer-inline" style="white-space: nowrap;">
                        <i data-lucide="plus" style="width: 16px; height: 16px;"></i> New
                    </button>
                </div>
                <div id="selected-customer-card" style="display: none; margin-top: var(--space-md);"></div>
            </div>

            <!-- Document Details -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i data-lucide="calendar"></i>
                    <h2>Details</h2>
                </div>
                <div class="settings-grid">
                    <div class="form-group">
                        <label class="form-label">Document number</label>
                        <div class="number-preview" id="doc-number-preview">Loading...</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="doc-date">Date</label>
                        <input type="date" id="doc-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="doc-due-date">Due date</label>
                        <input type="date" id="doc-due-date" class="form-input">
                    </div>
                </div>
            </div>

            <!-- Line Items -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i data-lucide="list"></i>
                    <h2>Line Items</h2>
                </div>
                <div class="line-items-table">
                    <div class="line-items-header">
                        <span class="li-col-desc">Description</span>
                        <span class="li-col-qty">Qty</span>
                        <span class="li-col-price">Price</span>
                        <span class="li-col-btw">BTW</span>
                        <span class="li-col-total">Total</span>
                        <span class="li-col-action"></span>
                    </div>
                    <div id="line-items-body"></div>
                </div>
                <button class="btn-secondary" id="add-line-btn" style="margin-top: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="plus" style="width: 16px; height: 16px;"></i> Add line
                </button>
            </div>

            <!-- Totals -->
            <div class="settings-section">
                <div class="totals-panel">
                    <div class="totals-row">
                        <span>Subtotal</span>
                        <span id="total-subtotal">0,00</span>
                    </div>
                    <div id="btw-breakdown"></div>
                    <div class="totals-row totals-grand">
                        <span>Total</span>
                        <span id="total-grand">0,00</span>
                    </div>
                </div>
            </div>

            <!-- Notes -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i data-lucide="message-square"></i>
                    <h2>Notes</h2>
                </div>
                <textarea id="doc-notes" class="form-input" rows="3" placeholder="Optional notes..."></textarea>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: var(--space-md); margin-top: var(--space-lg); margin-bottom: var(--space-2xl);">
                <button class="btn-secondary" id="save-concept-btn" style="padding: var(--space-md) var(--space-xl);">
                    <i data-lucide="save" style="width: 16px; height: 16px;"></i> Save as Concept
                </button>
                <button class="btn-primary" id="generate-btn" style="padding: var(--space-md) var(--space-xl); font-size: 16px;">
                    <i data-lucide="zap" style="width: 18px; height: 18px;"></i> Generate PDF
                </button>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    // Load data
    await Promise.all([loadTemplates(presetTemplateId), loadCustomers(), loadNextNumber(), loadSettings()]);
    renderLineItems();
    setupEventHandlers();
}

async function loadSettings() {
    try {
        const settings = await api.getSettings();
        defaultBtw = parseFloat(settings.default_btw_percentage) || 21;
        lineItems.forEach(li => { if (li.btw_percentage === 21) li.btw_percentage = defaultBtw; });

        // Set due date based on payment terms
        const days = settings.default_payment_terms_days || 30;
        const due = new Date();
        due.setDate(due.getDate() + days);
        const dueDateInput = document.getElementById('doc-due-date');
        if (dueDateInput && !dueDateInput.value) {
            dueDateInput.value = due.toISOString().split('T')[0];
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

async function loadTemplates(presetId) {
    try {
        const templates = await api.getTemplates();
        const select = document.getElementById('template-select');
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
        if (presetId) {
            select.value = presetId;
            selectedTemplateId = presetId;
        }
    } catch (e) {
        console.error('Failed to load templates:', e);
    }
}

async function loadCustomers() {
    try {
        allCustomers = await api.getCustomers();
    } catch (e) {
        console.error('Failed to load customers:', e);
    }
}

async function loadNextNumber() {
    try {
        const result = await api.getNextDocumentNumber(documentType);
        document.getElementById('doc-number-preview').textContent = result.formatted;
    } catch (e) {
        document.getElementById('doc-number-preview').textContent = '—';
    }
}

function setupEventHandlers() {
    // Document type toggle
    document.getElementById('btn-invoice').addEventListener('click', () => switchDocType('invoice'));
    document.getElementById('btn-quote').addEventListener('click', () => switchDocType('quote'));

    // Template selection
    document.getElementById('template-select').addEventListener('change', (e) => {
        selectedTemplateId = e.target.value || null;
    });

    // Customer search
    let searchTimeout;
    const searchInput = document.getElementById('customer-search-input');
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => showCustomerDropdown(searchInput.value), 200);
    });
    searchInput.addEventListener('focus', () => showCustomerDropdown(searchInput.value));
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('customer-dropdown');
        if (dropdown && !e.target.closest('#customer-search-input') && !e.target.closest('#customer-dropdown')) {
            dropdown.style.display = 'none';
        }
    });

    // Add new customer inline
    document.getElementById('add-customer-inline').addEventListener('click', async () => {
        // Import and use the customer modal from customers page
        const { openCustomerModal } = await import('./customers.js');
        if (typeof openCustomerModal === 'function') {
            // We can't easily reuse the modal since it reloads the page
            // Instead, navigate to customers page
        }
        // Simple inline approach: navigate to customers, then come back
        showNotification('Use the Customers page to add a new customer, then come back here.', 'info');
    });

    // Add line item
    document.getElementById('add-line-btn').addEventListener('click', () => {
        lineItems.push({ description: '', quantity: 1, unit_price: 0, btw_percentage: defaultBtw });
        renderLineItems();
    });

    // Save as concept
    document.getElementById('save-concept-btn').addEventListener('click', () => submitDocument(false));

    // Generate PDF
    document.getElementById('generate-btn').addEventListener('click', () => submitDocument(true));

    // Register dirty state guard for unsaved changes detection
    router.setDirtyGuard(
        () => {
            const hasContent = lineItems.some(li => li.description.trim() !== '');
            const hasCustomer = !!selectedCustomerId;
            const hasNotes = (document.getElementById('doc-notes')?.value || '').trim() !== '';
            return hasContent || hasCustomer || hasNotes;
        },
        () => submitDocument(false)
    );
}

function switchDocType(type) {
    documentType = type;
    document.querySelectorAll('.doc-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    loadNextNumber();
}

function showCustomerDropdown(query) {
    const dropdown = document.getElementById('customer-dropdown');
    const filtered = allCustomers.filter(c => {
        const q = (query || '').toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || (c.company_name || '').toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="customer-dropdown-item" style="color: var(--color-text-secondary);">No customers found</div>';
    } else {
        dropdown.innerHTML = filtered.slice(0, 8).map(c => `
            <div class="customer-dropdown-item" data-id="${c.id}">
                <strong>${escapeHtml(c.name)}</strong>
                ${c.company_name ? `<span style="color: var(--color-text-secondary);"> - ${escapeHtml(c.company_name)}</span>` : ''}
                ${c.city ? `<br><small style="color: var(--color-text-secondary);">${escapeHtml(c.city)}</small>` : ''}
            </div>
        `).join('');
    }

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.customer-dropdown-item[data-id]').forEach(item => {
        item.addEventListener('click', () => {
            selectCustomer(item.dataset.id);
            dropdown.style.display = 'none';
        });
    });
}

function selectCustomer(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;

    selectedCustomerId = customerId;
    document.getElementById('customer-search-input').value = customer.name;

    const card = document.getElementById('selected-customer-card');
    card.style.display = 'block';
    card.innerHTML = `
        <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: var(--space-md); display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <strong>${escapeHtml(customer.name)}</strong>
                ${customer.company_name ? `<br><span style="color: var(--color-shamrock);">${escapeHtml(customer.company_name)}</span>` : ''}
                ${customer.address ? `<br>${escapeHtml(customer.address)}` : ''}
                ${customer.postal_code || customer.city ? `<br>${escapeHtml([customer.postal_code, customer.city].filter(Boolean).join(' '))}` : ''}
            </div>
            <button class="btn-secondary" onclick="document.getElementById('selected-customer-card').style.display='none'; document.getElementById('customer-search-input').value=''; window._clearCustomer();" style="padding: 4px 8px; font-size: 12px;">
                <i data-lucide="x" style="width: 14px; height: 14px;"></i>
            </button>
        </div>
    `;
    lucide.createIcons();
}

// Global helper for clearing customer from inline onclick
window._clearCustomer = () => { selectedCustomerId = null; };

function renderLineItems() {
    const body = document.getElementById('line-items-body');
    body.innerHTML = lineItems.map((item, i) => `
        <div class="line-item-row" data-index="${i}">
            <input type="text" class="form-input li-col-desc" placeholder="Description" value="${escapeHtml(item.description)}" data-field="description">
            <input type="number" class="form-input li-col-qty" min="0" step="1" value="${item.quantity}" data-field="quantity">
            <input type="number" class="form-input li-col-price" min="0" step="0.01" value="${item.unit_price}" data-field="unit_price">
            <select class="form-input li-col-btw" data-field="btw_percentage">
                <option value="21" ${item.btw_percentage == 21 ? 'selected' : ''}>21%</option>
                <option value="9" ${item.btw_percentage == 9 ? 'selected' : ''}>9%</option>
                <option value="0" ${item.btw_percentage == 0 ? 'selected' : ''}>0%</option>
            </select>
            <span class="li-col-total li-line-total">${formatCurrency(item.quantity * item.unit_price)}</span>
            <button class="li-col-action li-remove-btn" data-index="${i}" ${lineItems.length === 1 ? 'disabled' : ''}>
                <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
        </div>
    `).join('');

    lucide.createIcons();

    // Event handlers for inputs
    body.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', (e) => {
            const row = e.target.closest('.line-item-row');
            const idx = parseInt(row.dataset.index);
            const field = e.target.dataset.field;

            if (field === 'description') {
                lineItems[idx].description = e.target.value;
            } else if (field === 'quantity') {
                lineItems[idx].quantity = parseFloat(e.target.value) || 0;
            } else if (field === 'unit_price') {
                lineItems[idx].unit_price = parseFloat(e.target.value) || 0;
            } else if (field === 'btw_percentage') {
                lineItems[idx].btw_percentage = parseFloat(e.target.value);
            }

            // Update line total
            const total = lineItems[idx].quantity * lineItems[idx].unit_price;
            row.querySelector('.li-line-total').textContent = formatCurrency(total);

            updateTotals();
        });
    });

    // Remove buttons
    body.querySelectorAll('.li-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            lineItems.splice(idx, 1);
            renderLineItems();
            updateTotals();
        });
    });

    updateTotals();
}

function updateTotals() {
    let subtotal = 0;
    const btwByRate = {};

    lineItems.forEach(item => {
        const lineTotal = item.quantity * item.unit_price;
        subtotal += lineTotal;
        const btwAmount = lineTotal * (item.btw_percentage / 100);
        btwByRate[item.btw_percentage] = (btwByRate[item.btw_percentage] || 0) + btwAmount;
    });

    const totalBtw = Object.values(btwByRate).reduce((s, v) => s + v, 0);
    const grandTotal = subtotal + totalBtw;

    document.getElementById('total-subtotal').textContent = formatCurrency(subtotal);

    // BTW breakdown
    const btwHtml = Object.entries(btwByRate)
        .filter(([, amount]) => amount > 0)
        .map(([rate, amount]) => `
            <div class="totals-row totals-btw">
                <span>BTW ${rate}%</span>
                <span>${formatCurrency(amount)}</span>
            </div>
        `).join('');
    document.getElementById('btw-breakdown').innerHTML = btwHtml;

    document.getElementById('total-grand').textContent = formatCurrency(grandTotal);
}

function formatCurrency(amount) {
    return amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function submitDocument(generatePdf) {
    // Validation
    if (!selectedTemplateId) {
        showNotification('Please select a template', 'error');
        return;
    }

    const validItems = lineItems.filter(li => li.description.trim());
    if (validItems.length === 0) {
        showNotification('Add at least one line item with a description', 'error');
        return;
    }

    const btn = generatePdf ? document.getElementById('generate-btn') : document.getElementById('save-concept-btn');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner-inline" style="width: 20px; height: 20px; border-width: 2px;"></div> Processing...';

    try {
        const docDate = document.getElementById('doc-date').value;
        const dueDate = document.getElementById('doc-due-date').value;

        // Format dates for display (DD-MM-YYYY)
        const formatDisplayDate = (isoDate) => {
            if (!isoDate) return '';
            const [y, m, d] = isoDate.split('-');
            return `${d}-${m}-${y}`;
        };

        const result = await api.createDocument({
            document_type: documentType,
            template_id: selectedTemplateId,
            customer_id: selectedCustomerId,
            line_items: validItems,
            date: formatDisplayDate(docDate),
            due_date: formatDisplayDate(dueDate),
            due_date_iso: dueDate,
            notes: document.getElementById('doc-notes').value,
            generate_pdf: generatePdf,
        });

        if (generatePdf && result.pdf_url) {
            showNotification('PDF generated successfully!');
            // Show success with download link
            const successDiv = document.createElement('div');
            successDiv.className = 'settings-section';
            successDiv.style.cssText = 'background: rgba(77, 223, 181, 0.1); border: 2px solid var(--color-shamrock); text-align: center; padding: var(--space-xl);';
            successDiv.innerHTML = `
                <i data-lucide="check-circle" style="width: 48px; height: 48px; color: var(--color-shamrock); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-shamrock); margin-bottom: var(--space-md);">PDF Generated!</h2>
                <p style="margin-bottom: var(--space-lg);">Document ${escapeHtml(result.document_number)} has been created.</p>
                <div style="display: flex; gap: var(--space-md); justify-content: center;">
                    <a href="${result.pdf_url}" target="_blank" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="download"></i> Download PDF
                    </a>
                    <button class="btn-secondary" onclick="window.location.hash='#/documents'" style="display: inline-flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="files"></i> View Documents
                    </button>
                    <button class="btn-secondary" onclick="window.location.hash='#/new-document'" style="display: inline-flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="plus"></i> New Document
                    </button>
                </div>
            `;
            // Insert after the action buttons
            btn.closest('div').replaceWith(successDiv);
            lucide.createIcons();
        } else {
            showNotification('Document saved as concept!');
            window.location.hash = '#/documents';
        }
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}
