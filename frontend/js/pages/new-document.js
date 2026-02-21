/**
 * New Document Page - Create invoices and quotes
 * Dynamic line items, auto-calculations, customer selection
 */
import { openPricePicker } from '/js/components/price-picker.js';

let documentType = 'invoice';
let selectedCustomerId = null;
let selectedTemplateId = null;
let lineItems = [{ description: '', quantity: 1, unit_price: 0, btw_percentage: 21 }];
let allCustomers = [];
let defaultBtw = 21;
let editingDocumentId = null;
let editingDocumentNumber = null;
let initialFormSnapshot = null;

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
    // Reset all state for a fresh form
    documentType = 'invoice';
    selectedCustomerId = null;
    selectedTemplateId = null;
    lineItems = [{ description: '', quantity: 1, unit_price: 0, btw_percentage: 21 }];
    allCustomers = [];
    editingDocumentId = null;
    editingDocumentNumber = null;
    initialFormSnapshot = null;

    // Check URL params for pre-selected template or edit mode
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const presetTemplateId = urlParams.get('template_id');
    editingDocumentId = urlParams.get('edit');

    const isEdit = !!editingDocumentId;
    const pageTitle = isEdit ? 'Edit Document' : 'New Document';
    const pageSubtitle = isEdit ? 'Edit an existing invoice or quote' : 'Create a new invoice or quote';
    const pageIcon = isEdit ? 'file-edit' : 'file-plus';

    const html = `
        <div style="padding: var(--space-lg); max-width: 1000px; margin: 0 auto;">
            <div style="margin-bottom: var(--space-xl);">
                <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                    <i data-lucide="${pageIcon}"></i>
                    ${pageTitle}
                </h1>
                <p style="color: var(--color-text-secondary);">
                    ${pageSubtitle}
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
                <div style="display: flex; gap: var(--space-md); margin-top: var(--space-md);">
                    <button class="btn-secondary" id="add-line-btn" style="display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="plus" style="width: 16px; height: 16px;"></i> Add line
                    </button>
                    <button class="btn-secondary" id="quick-add-btn" style="display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="tag" style="width: 16px; height: 16px;"></i> Quick Add
                    </button>
                </div>
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
                    <i data-lucide="save" style="width: 16px; height: 16px;"></i> ${isEdit ? 'Save Changes' : 'Save as Concept'}
                </button>
                <button class="btn-primary" id="generate-btn" style="padding: var(--space-md) var(--space-xl); font-size: 16px;">
                    <i data-lucide="zap" style="width: 18px; height: 18px;"></i> ${isEdit ? 'Save & Generate PDF' : 'Generate PDF'}
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

    // In edit mode, load the existing document and populate the form
    if (isEdit) {
        await loadExistingDocument(editingDocumentId);
    }

    // Take snapshot AFTER all data is loaded (including edit data)
    initialFormSnapshot = getFormSnapshot();
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

    // Add new customer inline via modal
    document.getElementById('add-customer-inline').addEventListener('click', () => {
        openNewCustomerModal();
    });

    // Add line item
    document.getElementById('add-line-btn').addEventListener('click', () => {
        lineItems.push({ description: '', quantity: 1, unit_price: 0, btw_percentage: defaultBtw });
        renderLineItems();
    });

    // Quick Add from Price Library
    document.getElementById('quick-add-btn').addEventListener('click', () => {
        openPricePicker((item) => {
            lineItems.push(item);
            renderLineItems();
        });
    });

    // Save as concept
    document.getElementById('save-concept-btn').addEventListener('click', () => submitDocument(false));

    // Generate PDF
    document.getElementById('generate-btn').addEventListener('click', () => submitDocument(true));

    // Register dirty state guard for unsaved changes detection
    // Uses saveDocument() directly (no UI/navigation) so the router controls the flow
    router.setDirtyGuard(
        () => {
            const current = getFormSnapshot();
            return current !== initialFormSnapshot;
        },
        async () => {
            await saveDocument(false);
            showNotification(editingDocumentId ? 'Document updated!' : 'Document saved as concept!');
        }
    );
}

function getFormSnapshot() {
    return JSON.stringify({
        documentType,
        selectedCustomerId,
        selectedTemplateId,
        lineItems: lineItems.map(li => ({
            description: li.description.trim(),
            quantity: li.quantity,
            unit_price: li.unit_price,
            btw_percentage: li.btw_percentage,
        })),
        date: document.getElementById('doc-date')?.value || '',
        dueDate: document.getElementById('doc-due-date')?.value || '',
        notes: (document.getElementById('doc-notes')?.value || '').trim(),
    });
}

function switchDocType(type) {
    documentType = type;
    document.querySelectorAll('.doc-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    // Don't change number when editing an existing document
    if (!editingDocumentId) {
        loadNextNumber();
    }
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

function openNewCustomerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'customer-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Customer</h2>
                <button class="modal-close-btn" id="nc-modal-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="nc-customer-form">
                    <div class="settings-grid">
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="nc_name">Name *</label>
                            <input type="text" id="nc_name" class="form-input" required>
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="nc_company_name">Company name</label>
                            <input type="text" id="nc_company_name" class="form-input">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="nc_address">Address</label>
                            <input type="text" id="nc_address" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="nc_postal_code">Postal code</label>
                            <input type="text" id="nc_postal_code" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="nc_city">City</label>
                            <input type="text" id="nc_city" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="nc_email">Email</label>
                            <input type="email" id="nc_email" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="nc_phone">Phone</label>
                            <input type="text" id="nc_phone" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="nc_tax_id">Tax ID (BTW)</label>
                            <input type="text" id="nc_tax_id" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="nc_country">Country</label>
                            <input type="text" id="nc_country" class="form-input" value="Nederland">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="nc_notes">Notes</label>
                            <textarea id="nc_notes" class="form-input" rows="2"></textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="nc-modal-cancel">Cancel</button>
                <button class="btn-primary" id="nc-modal-save">Add Customer</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();
    document.getElementById('nc_name').focus();

    const closeModal = () => modal.remove();
    document.getElementById('nc-modal-close').addEventListener('click', closeModal);
    document.getElementById('nc-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.getElementById('nc-modal-save').addEventListener('click', async () => {
        const name = document.getElementById('nc_name').value.trim();
        if (!name) {
            document.getElementById('nc_name').focus();
            return;
        }

        const data = {
            name,
            company_name: document.getElementById('nc_company_name').value.trim(),
            address: document.getElementById('nc_address').value.trim(),
            postal_code: document.getElementById('nc_postal_code').value.trim(),
            city: document.getElementById('nc_city').value.trim(),
            country: document.getElementById('nc_country').value.trim() || 'Nederland',
            email: document.getElementById('nc_email').value.trim(),
            phone: document.getElementById('nc_phone').value.trim(),
            tax_id: document.getElementById('nc_tax_id').value.trim(),
            notes: document.getElementById('nc_notes').value.trim(),
        };

        const saveBtn = document.getElementById('nc-modal-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const newCustomer = await api.createCustomer(data);
            showNotification('Customer added!');
            closeModal();

            // Reload customers and auto-select the new one
            await loadCustomers();
            if (newCustomer?.id) {
                selectCustomer(newCustomer.id);
            }
        } catch (error) {
            showNotification('Failed: ' + error.message, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Add Customer';
        }
    });
}

async function loadExistingDocument(docId) {
    try {
        const doc = await api.getDocument(docId);

        editingDocumentNumber = doc.document_number;

        // Set document type
        documentType = doc.document_type || 'invoice';
        document.querySelectorAll('.doc-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === documentType);
        });

        // Set document number (fixed, not editable in edit mode)
        const numberPreview = document.getElementById('doc-number-preview');
        if (numberPreview) {
            numberPreview.textContent = doc.document_number;
        }

        // Set template
        if (doc.template_id) {
            selectedTemplateId = doc.template_id;
            const templateSelect = document.getElementById('template-select');
            if (templateSelect) templateSelect.value = doc.template_id;
        }

        // Set customer
        if (doc.customer_id) {
            selectedCustomerId = doc.customer_id;
            // Try to find customer in loaded list and display
            const customer = allCustomers.find(c => c.id === doc.customer_id);
            if (customer) {
                selectCustomer(doc.customer_id);
            } else {
                // Customer not in list, show name from document
                document.getElementById('customer-search-input').value = doc.customer_name || '';
            }
        }

        // Set dates (stored as ISO YYYY-MM-DD in DB)
        if (doc.date) {
            document.getElementById('doc-date').value = doc.date;
        }
        if (doc.due_date) {
            document.getElementById('doc-due-date').value = doc.due_date;
        }

        // Set line items
        if (doc.line_items && doc.line_items.length > 0) {
            lineItems = doc.line_items.map(li => ({
                description: li.description || '',
                quantity: li.quantity || 1,
                unit_price: li.unit_price || 0,
                btw_percentage: li.btw_percentage != null ? li.btw_percentage : defaultBtw,
            }));
        }
        renderLineItems();

        // Set notes
        if (doc.notes) {
            document.getElementById('doc-notes').value = doc.notes;
        }

    } catch (error) {
        console.error('Failed to load document for editing:', error);
        showNotification('Failed to load document: ' + error.message, 'error');
    }
}

/**
 * Core save logic — builds payload and calls API.
 * Returns the result on success, throws on failure.
 */
async function saveDocument(generatePdf) {
    const validItems = lineItems.filter(li => li.description.trim());
    if (validItems.length === 0) {
        throw new Error('Add at least one line item with a description');
    }
    if (!selectedTemplateId) {
        throw new Error('Please select a template');
    }

    const docDate = document.getElementById('doc-date').value;
    const dueDate = document.getElementById('doc-due-date').value;

    const formatDisplayDate = (isoDate) => {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-');
        return `${d}-${m}-${y}`;
    };

    const payload = {
        document_type: documentType,
        template_id: selectedTemplateId,
        customer_id: selectedCustomerId,
        line_items: validItems,
        date: formatDisplayDate(docDate),
        due_date: formatDisplayDate(dueDate),
        due_date_iso: dueDate,
        notes: document.getElementById('doc-notes').value,
        generate_pdf: generatePdf,
    };

    console.log('[SaveDocument] Mode:', editingDocumentId ? 'UPDATE' : 'CREATE');
    console.log('[SaveDocument] Payload:', JSON.stringify(payload, null, 2));

    let result;
    if (editingDocumentId) {
        result = await api.updateDocument(editingDocumentId, payload);
    } else {
        result = await api.createDocument(payload);
    }

    console.log('[SaveDocument] Result:', JSON.stringify(result, null, 2));
    return result;
}

/**
 * Full submit flow — called by buttons. Handles UI feedback and navigation.
 */
async function submitDocument(generatePdf) {
    console.log(`[Submit] === START === generatePdf=${generatePdf}, editId=${editingDocumentId}`);

    // Disable both buttons to prevent double-submission
    const generateBtn = document.getElementById('generate-btn');
    const conceptBtn = document.getElementById('save-concept-btn');
    const btn = generatePdf ? generateBtn : conceptBtn;
    const originalHtml = btn.innerHTML;
    generateBtn.disabled = true;
    conceptBtn.disabled = true;
    btn.innerHTML = '<div class="spinner-inline" style="width: 20px; height: 20px; border-width: 2px;"></div> Processing...';

    try {
        console.log('[Submit] Calling saveDocument...');
        const result = await saveDocument(generatePdf);
        console.log('[Submit] saveDocument returned:', result ? `total=${result.total_amount}, pdf_url=${result.pdf_url || 'none'}` : 'NULL');

        if (!result) {
            throw new Error('Server returned empty response — update may not have persisted');
        }

        // Clear dirty guard so router doesn't block navigation
        router.clearDirtyGuard();
        console.log('[Submit] Dirty guard cleared');

        const docNumber = result.document_number || editingDocumentNumber || '';

        if (generatePdf && result.pdf_url) {
            console.log('[Submit] PDF generated, showing success div');
            showNotification(editingDocumentId ? 'Document updated & PDF generated!' : 'PDF generated successfully!');
            const successDiv = document.createElement('div');
            successDiv.className = 'settings-section';
            successDiv.style.cssText = 'background: rgba(77, 223, 181, 0.1); border: 2px solid var(--color-shamrock); text-align: center; padding: var(--space-xl);';
            successDiv.innerHTML = `
                <i data-lucide="check-circle" style="width: 48px; height: 48px; color: var(--color-shamrock); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-shamrock); margin-bottom: var(--space-md);">PDF Generated!</h2>
                <p style="margin-bottom: var(--space-lg);">Document ${escapeHtml(docNumber)} has been ${editingDocumentId ? 'updated' : 'created'}.</p>
                <div style="display: flex; gap: var(--space-md); justify-content: center; flex-wrap: wrap;">
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
            btn.closest('div').replaceWith(successDiv);
            lucide.createIcons();
        } else {
            console.log(`[Submit] No PDF flow. generatePdf=${generatePdf}, pdf_url=${result.pdf_url}. Navigating to #/documents`);
            showNotification(editingDocumentId ? 'Document updated!' : 'Document saved as concept!');
            window.location.hash = '#/documents';
        }
        console.log('[Submit] === END (success) ===');
    } catch (error) {
        console.error('[Submit] === END (error) ===', error);
        showNotification('Failed: ' + error.message, 'error');
        generateBtn.disabled = false;
        conceptBtn.disabled = false;
        btn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}
