/**
 * Customers Page - Customer address book with CRUD and search
 */

let searchTimeout = null;

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

export async function initCustomers() {
    const html = `
        <div style="padding: var(--space-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-md);">
                <div>
                    <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                        <i data-lucide="users"></i>
                        Customers
                    </h1>
                    <p style="color: var(--color-text-secondary);">
                        Manage your customer address book
                    </p>
                </div>
                <button class="btn-primary" id="add-customer-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                    <i data-lucide="plus"></i>
                    Add Customer
                </button>
            </div>

            <!-- Search bar -->
            <div style="margin-bottom: var(--space-lg);">
                <div style="position: relative; max-width: 400px;">
                    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--color-text-secondary);"></i>
                    <input type="text" id="customer-search" class="form-input" placeholder="Search customers..." style="padding-left: 40px;">
                </div>
            </div>

            <!-- Loading -->
            <div id="customers-loading" class="loading">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Loading customers...</p>
            </div>

            <!-- Customer grid -->
            <div id="customers-grid" style="display: none; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-lg);"></div>

            <!-- Empty state -->
            <div id="customers-empty" style="display: none; text-align: center; padding: var(--space-2xl);" class="dashboard-section">
                <i data-lucide="user-plus" style="width: 64px; height: 64px; color: var(--color-text-secondary); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-text-secondary); margin-bottom: var(--space-sm);">No customers yet</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">Add your first customer to get started.</p>
                <button class="btn-primary" onclick="document.getElementById('add-customer-btn').click()">
                    <i data-lucide="plus"></i> Add Customer
                </button>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    // Load customers
    await loadCustomers();

    // Setup event handlers
    document.getElementById('add-customer-btn').addEventListener('click', () => openCustomerModal());

    document.getElementById('customer-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadCustomers(e.target.value), 300);
    });
}

async function loadCustomers(query = '') {
    const loading = document.getElementById('customers-loading');
    const grid = document.getElementById('customers-grid');
    const empty = document.getElementById('customers-empty');

    loading.style.display = 'block';
    grid.style.display = 'none';
    empty.style.display = 'none';

    try {
        const customers = await api.getCustomers(query);

        loading.style.display = 'none';

        if (customers.length === 0) {
            empty.style.display = 'block';
            lucide.createIcons();
            return;
        }

        grid.style.display = 'grid';
        grid.innerHTML = customers.map(c => renderCustomerCard(c)).join('');
        lucide.createIcons();

        // Attach card event handlers
        grid.querySelectorAll('.customer-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openCustomerModal(btn.dataset.id));
        });

        grid.querySelectorAll('.customer-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteCustomer(btn.dataset.id, btn.dataset.name));
        });
    } catch (error) {
        console.error('Failed to load customers:', error);
        loading.innerHTML = `
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-error);"></i>
            <p style="color: var(--color-error); margin-top: var(--space-md);">Failed to load customers: ${error.message}</p>
        `;
        lucide.createIcons();
    }
}

function renderCustomerCard(customer) {
    const details = [];
    if (customer.company_name) details.push(`<span style="color: var(--color-shamrock); font-weight: var(--font-weight-semibold);">${escapeHtml(customer.company_name)}</span>`);
    if (customer.address) details.push(escapeHtml(customer.address));
    if (customer.postal_code || customer.city) {
        details.push(escapeHtml([customer.postal_code, customer.city].filter(Boolean).join(' ')));
    }

    const contactParts = [];
    if (customer.email) contactParts.push(`<span style="display: flex; align-items: center; gap: 4px;"><i data-lucide="mail" style="width: 14px; height: 14px;"></i>${escapeHtml(customer.email)}</span>`);
    if (customer.phone) contactParts.push(`<span style="display: flex; align-items: center; gap: 4px;"><i data-lucide="phone" style="width: 14px; height: 14px;"></i>${escapeHtml(customer.phone)}</span>`);

    return `
        <div class="template-card">
            <div style="margin-bottom: var(--space-md);">
                <div style="font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-bottom: var(--space-xs);">
                    ${escapeHtml(customer.name)}
                </div>
                <div style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5;">
                    ${details.join('<br>')}
                </div>
            </div>
            ${contactParts.length > 0 ? `
                <div style="font-size: 13px; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 4px; margin-bottom: var(--space-md);">
                    ${contactParts.join('')}
                </div>
            ` : ''}
            <div class="template-actions">
                <button class="action-btn edit-btn customer-edit-btn" data-id="${customer.id}">
                    <i data-lucide="edit"></i> Edit
                </button>
                <button class="action-btn delete-btn customer-delete-btn" data-id="${customer.id}" data-name="${escapeHtml(customer.name)}">
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function openCustomerModal(customerId = null) {
    const isEdit = !!customerId;
    let customer = {};

    if (isEdit) {
        try {
            customer = await api.getCustomer(customerId);
        } catch (error) {
            showNotification('Failed to load customer', 'error');
            return;
        }
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'customer-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
                <button class="modal-close-btn" id="modal-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="customer-form">
                    <div class="settings-grid">
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_name">Name *</label>
                            <input type="text" id="cust_name" class="form-input" required value="${escapeHtml(customer.name || '')}">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_company_name">Company name</label>
                            <input type="text" id="cust_company_name" class="form-input" value="${escapeHtml(customer.company_name || '')}">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_address">Address</label>
                            <input type="text" id="cust_address" class="form-input" value="${escapeHtml(customer.address || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_postal_code">Postal code</label>
                            <input type="text" id="cust_postal_code" class="form-input" value="${escapeHtml(customer.postal_code || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_city">City</label>
                            <input type="text" id="cust_city" class="form-input" value="${escapeHtml(customer.city || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_email">Email</label>
                            <input type="email" id="cust_email" class="form-input" value="${escapeHtml(customer.email || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_phone">Phone</label>
                            <input type="text" id="cust_phone" class="form-input" value="${escapeHtml(customer.phone || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_tax_id">Tax ID (BTW)</label>
                            <input type="text" id="cust_tax_id" class="form-input" value="${escapeHtml(customer.tax_id || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_country">Country</label>
                            <input type="text" id="cust_country" class="form-input" value="${escapeHtml(customer.country || 'Nederland')}">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_notes">Notes</label>
                            <textarea id="cust_notes" class="form-input" rows="2">${escapeHtml(customer.notes || '')}</textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="modal-cancel">Cancel</button>
                <button class="btn-primary" id="modal-save">
                    ${isEdit ? 'Save Changes' : 'Add Customer'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    // Focus first field
    document.getElementById('cust_name').focus();

    // Close handlers
    const closeModal = () => modal.remove();
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save handler
    document.getElementById('modal-save').addEventListener('click', async () => {
        const name = document.getElementById('cust_name').value.trim();
        if (!name) {
            document.getElementById('cust_name').focus();
            return;
        }

        const data = {
            name,
            company_name: document.getElementById('cust_company_name').value.trim(),
            address: document.getElementById('cust_address').value.trim(),
            postal_code: document.getElementById('cust_postal_code').value.trim(),
            city: document.getElementById('cust_city').value.trim(),
            country: document.getElementById('cust_country').value.trim() || 'Nederland',
            email: document.getElementById('cust_email').value.trim(),
            phone: document.getElementById('cust_phone').value.trim(),
            tax_id: document.getElementById('cust_tax_id').value.trim(),
            notes: document.getElementById('cust_notes').value.trim(),
        };

        const saveBtn = document.getElementById('modal-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            if (isEdit) {
                await api.updateCustomer(customerId, data);
                showNotification('Customer updated successfully!');
            } else {
                await api.createCustomer(data);
                showNotification('Customer added successfully!');
            }
            closeModal();
            await loadCustomers(document.getElementById('customer-search')?.value || '');
        } catch (error) {
            showNotification('Failed to save customer: ' + error.message, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Customer';
        }
    });
}

async function deleteCustomer(customerId, customerName) {
    if (!confirm(`Are you sure you want to delete "${customerName}"?`)) return;

    try {
        await api.deleteCustomer(customerId);
        showNotification('Customer deleted');
        await loadCustomers(document.getElementById('customer-search')?.value || '');
    } catch (error) {
        showNotification('Failed to delete customer: ' + error.message, 'error');
    }
}
