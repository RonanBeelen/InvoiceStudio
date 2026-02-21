/**
 * Price Library Page — Service/product catalog with CRUD, search and category filter
 */

let searchTimeout = null;
let currentCategory = '';

const CATEGORIES = [
    { value: '', label: 'All' },
    { value: 'product', label: 'Products' },
    { value: 'service', label: 'Services' },
    { value: 'hourly_rate', label: 'Hourly Rate' },
    { value: 'travel', label: 'Travel' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'general', label: 'Other' },
];

const UNITS = [
    { value: 'stuk', label: 'Piece' },
    { value: 'uur', label: 'Hour' },
    { value: 'km', label: 'Kilometer' },
    { value: 'maand', label: 'Month' },
    { value: 'dag', label: 'Day' },
    { value: 'project', label: 'Project' },
    { value: 'm2', label: 'm\u00B2' },
];

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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    return Number(amount || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function getCategoryLabel(value) {
    const cat = CATEGORIES.find(c => c.value === value);
    return cat ? cat.label : value || 'Other';
}

function getUnitLabel(value) {
    const u = UNITS.find(u => u.value === value);
    return u ? u.label : value || 'Piece';
}

export async function initPriceLibrary() {
    currentCategory = '';

    const categoryTabsHtml = CATEGORIES.map(c => `
        <button class="category-tab ${c.value === '' ? 'active' : ''}" data-category="${c.value}">
            ${c.label}
        </button>
    `).join('');

    const html = `
        <div style="padding: var(--space-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-md);">
                <div>
                    <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                        <i data-lucide="tag"></i>
                        Price Library
                    </h1>
                    <p style="color: var(--color-text-secondary);">
                        Manage your products, services and rates
                    </p>
                </div>
                <button class="btn-primary" id="add-item-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                    <i data-lucide="plus"></i>
                    New Item
                </button>
            </div>

            <!-- Category tabs + search -->
            <div style="display: flex; align-items: center; gap: var(--space-lg); margin-bottom: var(--space-lg); flex-wrap: wrap;">
                <div class="category-tabs" id="category-tabs" style="display: flex; gap: var(--space-xs); overflow-x: auto; flex-shrink: 0;">
                    ${categoryTabsHtml}
                </div>
                <div style="position: relative; min-width: 250px; flex: 1; max-width: 400px;">
                    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--color-text-secondary);"></i>
                    <input type="text" id="price-search" class="form-input" placeholder="Search items..." style="padding-left: 40px;">
                </div>
            </div>

            <!-- Loading -->
            <div id="price-loading" class="loading">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Loading items...</p>
            </div>

            <!-- Item grid -->
            <div id="price-grid" style="display: none; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-lg);"></div>

            <!-- Empty state -->
            <div id="price-empty" style="display: none; text-align: center; padding: var(--space-2xl);" class="dashboard-section">
                <i data-lucide="tag" style="width: 64px; height: 64px; color: var(--color-text-secondary); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-text-secondary); margin-bottom: var(--space-sm);">No items yet</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">Add your first product or service to get started.</p>
                <button class="btn-primary" onclick="document.getElementById('add-item-btn').click()">
                    <i data-lucide="plus"></i> New Item
                </button>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    await loadPriceItems();

    // Event handlers
    document.getElementById('add-item-btn').addEventListener('click', () => openPriceItemModal());

    document.getElementById('price-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadPriceItems(e.target.value, currentCategory), 300);
    });

    document.getElementById('category-tabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.category-tab');
        if (!tab) return;
        currentCategory = tab.dataset.category;
        document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const query = document.getElementById('price-search')?.value || '';
        loadPriceItems(query, currentCategory);
    });
}

async function loadPriceItems(query = '', category = '') {
    const loading = document.getElementById('price-loading');
    const grid = document.getElementById('price-grid');
    const empty = document.getElementById('price-empty');

    loading.style.display = 'block';
    grid.style.display = 'none';
    empty.style.display = 'none';

    try {
        const filters = { active: true };
        if (query) filters.q = query;
        if (category) filters.category = category;

        const items = await api.getPriceItems(filters);

        loading.style.display = 'none';

        if (items.length === 0) {
            empty.style.display = 'block';
            lucide.createIcons();
            return;
        }

        grid.style.display = 'grid';
        grid.innerHTML = items.map(item => renderPriceItemCard(item)).join('');
        lucide.createIcons();

        // Attach event handlers
        grid.querySelectorAll('.price-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openPriceItemModal(btn.dataset.id));
        });

        grid.querySelectorAll('.price-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePriceItem(btn.dataset.id, btn.dataset.name));
        });
    } catch (error) {
        console.error('Failed to load price items:', error);
        loading.innerHTML = `
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-error);"></i>
            <p style="color: var(--color-error); margin-top: var(--space-md);">Failed to load: ${error.message}</p>
        `;
        lucide.createIcons();
    }
}

function renderPriceItemCard(item) {
    const categoryColors = {
        product: 'var(--color-shamrock)',
        service: 'var(--color-mountain-meadow)',
        hourly_rate: '#6366f1',
        travel: '#f59e0b',
        subscription: '#ec4899',
        general: 'var(--color-text-secondary)',
    };
    const color = categoryColors[item.category] || categoryColors.general;

    return `
        <div class="template-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                <div style="min-width: 0; flex: 1;">
                    <div style="font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-bottom: var(--space-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(item.name)}
                    </div>
                    ${item.description ? `<div style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.4; margin-bottom: var(--space-sm); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(item.description)}</div>` : ''}
                </div>
                <span style="
                    background: ${color}15;
                    color: ${color};
                    font-size: 11px;
                    font-weight: var(--font-weight-semibold);
                    padding: 3px 10px;
                    border-radius: 12px;
                    flex-shrink: 0;
                    margin-left: var(--space-sm);
                ">${getCategoryLabel(item.category)}</span>
            </div>

            <div style="display: flex; align-items: baseline; gap: var(--space-sm); margin-bottom: var(--space-sm);">
                <span style="font-size: 24px; font-weight: var(--font-weight-bold); color: var(--color-shamrock); font-family: var(--font-mono);">
                    &euro; ${formatCurrency(item.unit_price)}
                </span>
                <span style="font-size: 13px; color: var(--color-text-secondary);">
                    per ${getUnitLabel(item.unit)}
                </span>
            </div>

            <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-md); flex-wrap: wrap;">
                <span class="field-badge">${item.btw_percentage}% VAT</span>
                ${item.default_quantity !== 1 ? `<span class="field-badge">Default: ${item.default_quantity}</span>` : ''}
                ${item.sku ? `<span class="field-badge">SKU: ${escapeHtml(item.sku)}</span>` : ''}
            </div>

            <div class="template-actions">
                <button class="action-btn edit-btn price-edit-btn" data-id="${item.id}">
                    <i data-lucide="edit"></i> Edit
                </button>
                <button class="action-btn delete-btn price-delete-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}">
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </div>
        </div>
    `;
}

async function openPriceItemModal(itemId = null) {
    const isEdit = !!itemId;
    let item = {};

    if (isEdit) {
        try {
            item = await api.getPriceItem(itemId);
        } catch (error) {
            showNotification('Failed to load item', 'error');
            return;
        }
    }

    const categoryOptions = CATEGORIES.filter(c => c.value !== '').map(c =>
        `<option value="${c.value}" ${(item.category || 'general') === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    const unitOptions = UNITS.map(u =>
        `<option value="${u.value}" ${(item.unit || 'stuk') === u.value ? 'selected' : ''}>${u.label}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'price-item-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${isEdit ? 'Edit Item' : 'New Item'}</h2>
                <button class="modal-close-btn" id="modal-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="price-item-form">
                    <div class="settings-grid">
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="pi_name">Name *</label>
                            <input type="text" id="pi_name" class="form-input" required value="${escapeHtml(item.name || '')}" placeholder="e.g. Website Maintenance">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="pi_description">Description</label>
                            <textarea id="pi_description" class="form-input" rows="2" placeholder="Short description of the item">${escapeHtml(item.description || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pi_category">Category</label>
                            <select id="pi_category" class="form-input">
                                ${categoryOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pi_sku">Article Code (SKU)</label>
                            <input type="text" id="pi_sku" class="form-input" value="${escapeHtml(item.sku || '')}" placeholder="Optional">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pi_unit_price">Price *</label>
                            <input type="number" id="pi_unit_price" class="form-input" step="0.01" min="0" required value="${item.unit_price ?? ''}" placeholder="0.00">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pi_unit">Unit</label>
                            <select id="pi_unit" class="form-input">
                                ${unitOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pi_btw">VAT %</label>
                            <select id="pi_btw" class="form-input">
                                <option value="21" ${(item.btw_percentage ?? 21) == 21 ? 'selected' : ''}>21%</option>
                                <option value="9" ${item.btw_percentage == 9 ? 'selected' : ''}>9%</option>
                                <option value="0" ${item.btw_percentage == 0 ? 'selected' : ''}>0% (Exempt)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pi_qty">Default Quantity</label>
                            <input type="number" id="pi_qty" class="form-input" step="0.01" min="0" value="${item.default_quantity ?? 1}">
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="modal-cancel">Cancel</button>
                <button class="btn-primary" id="modal-save">
                    ${isEdit ? 'Save Changes' : 'Add Item'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    document.getElementById('pi_name').focus();

    // Close handlers
    const closeModal = () => modal.remove();
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save handler
    document.getElementById('modal-save').addEventListener('click', async () => {
        const name = document.getElementById('pi_name').value.trim();
        if (!name) {
            document.getElementById('pi_name').focus();
            return;
        }

        const unitPrice = parseFloat(document.getElementById('pi_unit_price').value);
        if (isNaN(unitPrice) || unitPrice < 0) {
            document.getElementById('pi_unit_price').focus();
            return;
        }

        const data = {
            name,
            description: document.getElementById('pi_description').value.trim(),
            category: document.getElementById('pi_category').value,
            sku: document.getElementById('pi_sku').value.trim(),
            unit_price: unitPrice,
            unit: document.getElementById('pi_unit').value,
            btw_percentage: parseFloat(document.getElementById('pi_btw').value),
            default_quantity: parseFloat(document.getElementById('pi_qty').value) || 1,
        };

        const saveBtn = document.getElementById('modal-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            if (isEdit) {
                await api.updatePriceItem(itemId, data);
                showNotification('Item updated successfully!');
            } else {
                await api.createPriceItem(data);
                showNotification('Item added successfully!');
            }
            closeModal();
            const query = document.getElementById('price-search')?.value || '';
            await loadPriceItems(query, currentCategory);
        } catch (error) {
            showNotification('Failed to save: ' + error.message, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
        }
    });
}

async function deletePriceItem(itemId, itemName) {
    if (!confirm(`Are you sure you want to delete "${itemName}"?`)) return;

    try {
        await api.deletePriceItem(itemId);
        showNotification('Item deleted');
        const query = document.getElementById('price-search')?.value || '';
        await loadPriceItems(query, currentCategory);
    } catch (error) {
        showNotification('Failed to delete: ' + error.message, 'error');
    }
}
