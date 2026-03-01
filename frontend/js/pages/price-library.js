/**
 * Price Library Page — Service/product catalog with CRUD, search and category filter
 */

let searchTimeout = null;
let currentCategory = '';
let selectedItems = new Set();
let showingArchived = false;

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

// ==================== Import Column Mapping Config ====================

const COLUMN_MAP_CONFIG = [
    {
        field: 'name', label: 'Name *', required: true,
        aliases: ['name', 'naam', 'product', 'service', 'dienst', 'artikel', 'article', 'item', 'product name', 'productnaam', 'item name'],
    },
    {
        field: 'description', label: 'Description', required: false,
        aliases: ['description', 'beschrijving', 'omschrijving', 'desc', 'details', 'toelichting', 'notes', 'opmerkingen'],
    },
    {
        field: 'unit_price', label: 'Price *', required: true,
        aliases: ['price', 'prijs', 'unit price', 'eenheidsprijs', 'stukprijs', 'tarief', 'rate', 'bedrag', 'amount', 'cost', 'kosten', 'unitprice', 'unit_price'],
    },
    {
        field: 'category', label: 'Category', required: false,
        aliases: ['category', 'categorie', 'type', 'soort', 'groep', 'group'],
    },
    {
        field: 'unit', label: 'Unit', required: false,
        aliases: ['unit', 'eenheid', 'per', 'uom', 'unit of measure'],
    },
    {
        field: 'btw_percentage', label: 'VAT %', required: false,
        aliases: ['vat', 'btw', 'tax', 'btw%', 'vat%', 'btw percentage', 'vat percentage', 'belasting', 'tax rate'],
    },
    {
        field: 'default_quantity', label: 'Default Qty', required: false,
        aliases: ['quantity', 'aantal', 'qty', 'hoeveelheid', 'default quantity', 'standaard aantal'],
    },
    {
        field: 'sku', label: 'SKU / Article Code', required: false,
        aliases: ['sku', 'artikelcode', 'article code', 'code', 'artikelnummer', 'product code', 'productcode', 'item code', 'ref', 'reference', 'referentie'],
    },
];

function autoDetectColumnMapping(headers) {
    const mapping = {};
    const usedColumns = new Set();
    const normalizedHeaders = headers.map(h =>
        (h || '').toString().toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').trim()
    );

    // Phase 1: Exact match
    for (const config of COLUMN_MAP_CONFIG) {
        for (let i = 0; i < normalizedHeaders.length; i++) {
            if (usedColumns.has(i)) continue;
            if (config.aliases.includes(normalizedHeaders[i])) {
                mapping[config.field] = i;
                usedColumns.add(i);
                break;
            }
        }
    }

    // Phase 2: Contains match for unmapped fields
    for (const config of COLUMN_MAP_CONFIG) {
        if (mapping[config.field] !== undefined) continue;
        for (let i = 0; i < normalizedHeaders.length; i++) {
            if (usedColumns.has(i)) continue;
            const h = normalizedHeaders[i];
            if (config.aliases.some(alias => h.includes(alias) || alias.includes(h))) {
                mapping[config.field] = i;
                usedColumns.add(i);
                break;
            }
        }
    }

    return mapping;
}

function normalizeCategory(raw) {
    if (!raw) return 'general';
    const lower = raw.toString().toLowerCase().trim();
    const map = {
        'product': 'product', 'producten': 'product', 'products': 'product',
        'service': 'service', 'dienst': 'service', 'diensten': 'service', 'services': 'service',
        'hourly': 'hourly_rate', 'hourly_rate': 'hourly_rate', 'uurloon': 'hourly_rate', 'uurtarief': 'hourly_rate',
        'travel': 'travel', 'reiskosten': 'travel', 'reis': 'travel', 'reizen': 'travel',
        'subscription': 'subscription', 'abonnement': 'subscription', 'abonnementen': 'subscription',
    };
    return map[lower] || 'general';
}

/** Auto-detect category from item name, description and unit when no category column is provided */
function autoDetectCategory(name, description, unit) {
    const text = `${name || ''} ${description || ''}`.toLowerCase();

    // Hourly rate — check first (most specific)
    if (unit === 'uur' || /\b(uurtarief|uurloon|hourly|per uur|consultancy|advies)\b/.test(text)) {
        return 'hourly_rate';
    }

    // Travel
    if (unit === 'km' || /\b(reis|travel|km|kilometer|vervoer|transport|parkeer|brandstof|fuel|mileage)\b/.test(text)) {
        return 'travel';
    }

    // Subscription
    if (unit === 'maand' || /\b(abonnement|subscription|licentie|license|saas|hosting|maandelijks|monthly|jaarlijks|yearly|recurring)\b/.test(text)) {
        return 'subscription';
    }

    // Service — broad keywords
    if (/\b(dienst|service|installatie|installation|onderhoud|maintenance|reparatie|repair|advies|consult|design|ontwerp|ontwikkel|develop|training|coaching|support|implementatie|configuratie|migratie|audit|analyse|analysis|schoonmaak|cleaning|beheer|management)\b/.test(text)) {
        return 'service';
    }

    // Product — physical goods / materials
    if (/\b(product|artikel|materiaal|material|onderdeel|part|component|kabel|cable|schroef|bout|moer|stekker|adapter|printer|laptop|server|monitor|toetsenbord|muis|accessoire|accessory|apparaat|device|hardware|software|licentie|meubel|furniture|voorraad|stock|item|stuk)\b/.test(text)) {
        return 'product';
    }

    return 'general';
}

function normalizeUnit(raw) {
    if (!raw) return 'stuk';
    const lower = raw.toString().toLowerCase().trim();
    const map = {
        'stuk': 'stuk', 'piece': 'stuk', 'pcs': 'stuk', 'st': 'stuk', 'stuks': 'stuk', 'pieces': 'stuk', 'each': 'stuk',
        'uur': 'uur', 'hour': 'uur', 'hours': 'uur', 'hr': 'uur', 'uren': 'uur',
        'km': 'km', 'kilometer': 'km', 'kilometers': 'km',
        'maand': 'maand', 'month': 'maand', 'months': 'maand', 'mo': 'maand', 'maanden': 'maand',
        'dag': 'dag', 'day': 'dag', 'days': 'dag', 'dagen': 'dag',
        'project': 'project', 'proj': 'project',
        'm2': 'm2', 'm\u00B2': 'm2', 'vierkante meter': 'm2', 'square meter': 'm2',
    };
    return map[lower] || 'stuk';
}

function parsePrice(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return raw >= 0 ? raw : null;
    let str = raw.toString().trim().replace(/[^\d.,-]/g, '');
    // Dutch format: 1.234,56
    if (/,\d{1,2}$/.test(str) && str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',') && !str.includes('.')) {
        str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return (!isNaN(num) && num >= 0) ? Math.round(num * 100) / 100 : null;
}

function parsePercentage(raw) {
    if (raw === null || raw === undefined || raw === '') return 21;
    const str = raw.toString().replace('%', '').trim().replace(',', '.');
    const num = parseFloat(str);
    if (isNaN(num) || num < 0 || num > 100) return 21;
    return num;
}

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

function showConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger' }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 440px;">
                <div class="modal-header">
                    <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="${variant === 'danger' ? 'alert-triangle' : 'archive'}" style="width: 22px; height: 22px; color: ${variant === 'danger' ? 'var(--color-error)' : '#d69e2e'};"></i>
                        ${title}
                    </h2>
                    <button class="modal-close-btn" id="confirm-close">
                        <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: var(--space-lg) var(--space-xl);">
                    <p style="color: var(--color-text-secondary); line-height: 1.6; font-size: 15px;">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="confirm-cancel">${cancelLabel}</button>
                    <button class="${variant === 'danger' ? 'btn-danger' : 'btn-warning'}" id="confirm-action" style="padding: var(--space-sm) var(--space-xl);">
                        ${confirmLabel}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        lucide.createIcons();

        const close = (result) => {
            overlay.remove();
            resolve(result);
        };
        document.getElementById('confirm-action').addEventListener('click', () => close(true));
        document.getElementById('confirm-cancel').addEventListener('click', () => close(false));
        document.getElementById('confirm-close').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
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
                <div style="display: flex; gap: var(--space-md);">
                    <button class="btn-secondary" id="toggle-archived-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="archive"></i>
                        Archived
                    </button>
                    <button class="btn-secondary" id="import-items-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="upload"></i>
                        Import
                    </button>
                    <button class="btn-primary" id="add-item-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="plus"></i>
                        New Item
                    </button>
                </div>
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

            <!-- Selection bar -->
            <div id="price-selection-bar" class="bulk-selection-bar" style="display: none;">
                <div style="display: flex; align-items: center; gap: var(--space-md);">
                    <input type="checkbox" id="price-select-all" class="bulk-checkbox">
                    <span id="price-selected-count" style="font-weight: var(--font-weight-semibold); color: var(--color-text-primary);"></span>
                </div>
                <div style="display: flex; gap: var(--space-sm);">
                    <button class="btn-warning" id="price-archive-selected" style="display: flex; align-items: center; gap: var(--space-xs); padding: var(--space-sm) var(--space-lg);">
                        <i data-lucide="archive" style="width: 16px; height: 16px;"></i>
                        Archive
                    </button>
                    <button class="btn-danger" id="price-delete-selected" style="display: flex; align-items: center; gap: var(--space-xs); padding: var(--space-sm) var(--space-lg);">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        Delete
                    </button>
                </div>
            </div>

            <!-- Item grid -->
            <div id="price-grid" class="card-grid card-grid--4" style="display: none;"></div>

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
    document.getElementById('import-items-btn').addEventListener('click', () => openImportModal());

    document.getElementById('toggle-archived-btn').addEventListener('click', () => {
        showingArchived = !showingArchived;
        const btn = document.getElementById('toggle-archived-btn');
        if (showingArchived) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-warning');
            btn.innerHTML = '<i data-lucide="arrow-left"></i> Back to Active';
        } else {
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-secondary');
            btn.innerHTML = '<i data-lucide="archive"></i> Archived';
        }
        lucide.createIcons();
        const query = document.getElementById('price-search')?.value || '';
        loadPriceItems(query, currentCategory);
    });

    document.getElementById('price-select-all').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.price-item-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) selectedItems.add(cb.dataset.id);
            else selectedItems.delete(cb.dataset.id);
        });
        updatePriceSelectionBar();
    });

    document.getElementById('price-archive-selected').addEventListener('click', () => bulkArchiveSelectedItems());
    document.getElementById('price-delete-selected').addEventListener('click', () => bulkDeleteSelectedItems());

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
        const filters = { active: !showingArchived };
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

        grid.querySelectorAll('.price-archive-btn').forEach(btn => {
            btn.addEventListener('click', () => archivePriceItem(btn.dataset.id, btn.dataset.name));
        });

        grid.querySelectorAll('.price-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePriceItem(btn.dataset.id, btn.dataset.name));
        });

        // Checkbox selection handlers
        selectedItems.clear();
        updatePriceSelectionBar();

        grid.querySelectorAll('.price-item-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) selectedItems.add(cb.dataset.id);
                else selectedItems.delete(cb.dataset.id);
                updatePriceSelectionBar();
            });
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
        <div class="card-sectioned dashboard-section" data-item-id="${item.id}">
            <div class="card-header" style="padding-bottom: var(--space-sm);">
                <div class="card-title" style="flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; flex: 1;">
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="tag" style="width: 18px; height: 18px; color: var(--color-shamrock); flex-shrink: 0;"></i>
                        <strong style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.name)}</strong>
                    </div>
                    ${item.description ? `<span style="font-size: 12px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">${escapeHtml(item.description)}</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0;">
                    <span style="
                        background: ${color}15;
                        color: ${color};
                        font-size: 11px;
                        font-weight: var(--font-weight-semibold);
                        padding: 3px 10px;
                        border-radius: 12px;
                    ">${getCategoryLabel(item.category)}</span>
                    <input type="checkbox" class="bulk-checkbox price-item-checkbox" data-id="${item.id}" style="flex-shrink: 0;">
                </div>
            </div>
            <div class="card-body" style="padding-top: var(--space-sm);">
                <div class="card-row">
                    <span class="card-label">Price</span>
                    <span style="font-weight: 700; color: var(--color-shamrock); font-family: var(--font-mono);">&euro; ${formatCurrency(item.unit_price)}</span>
                </div>
                <div class="card-row">
                    <span class="card-label">Unit</span>
                    <span>${getUnitLabel(item.unit)}</span>
                </div>
                <div class="card-row">
                    <span class="card-label">VAT</span>
                    <span>${item.btw_percentage}%</span>
                </div>
                ${item.default_quantity !== 1 ? `
                    <div class="card-row">
                        <span class="card-label">Default qty</span>
                        <span>${item.default_quantity}</span>
                    </div>
                ` : ''}
                ${item.sku ? `
                    <div class="card-row">
                        <span class="card-label">SKU</span>
                        <span>${escapeHtml(item.sku)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="card-actions">
                <button class="btn-secondary price-edit-btn" data-id="${item.id}" style="font-size: 12px; padding: 4px 12px;">
                    <i data-lucide="pencil" style="width: 14px; height: 14px;"></i> Edit
                </button>
                ${showingArchived ? `
                    <button class="btn-primary price-restore-btn" data-id="${item.id}" style="font-size: 12px; padding: 4px 12px;">
                        <i data-lucide="archive-restore" style="width: 14px; height: 14px;"></i> Restore
                    </button>
                ` : `
                    <button class="btn-secondary price-archive-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" style="font-size: 12px; padding: 4px 12px; color: #d69e2e;">
                        <i data-lucide="archive" style="width: 14px; height: 14px;"></i>
                    </button>
                `}
                <button class="btn-secondary price-delete-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" style="font-size: 12px; padding: 4px 12px; color: var(--color-error);">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
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

function updatePriceSelectionBar() {
    const bar = document.getElementById('price-selection-bar');
    const countEl = document.getElementById('price-selected-count');
    const selectAllCb = document.getElementById('price-select-all');
    const allCheckboxes = document.querySelectorAll('.price-item-checkbox');

    if (selectedItems.size > 0) {
        bar.style.display = 'flex';
        countEl.textContent = `${selectedItems.size} selected`;
        selectAllCb.checked = allCheckboxes.length > 0 && selectedItems.size === allCheckboxes.length;
        selectAllCb.indeterminate = selectedItems.size > 0 && selectedItems.size < allCheckboxes.length;
    } else {
        bar.style.display = 'none';
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
    }
}

async function bulkArchiveSelectedItems() {
    const count = selectedItems.size;
    if (count === 0) return;
    const confirmed = await showConfirmDialog({
        title: 'Archive Items',
        message: `Archive ${count} item${count > 1 ? 's' : ''}? They will be hidden but can be restored later.`,
        confirmLabel: 'Archive',
        variant: 'warning',
    });
    if (!confirmed) return;

    try {
        const result = await api.bulkArchivePriceItems([...selectedItems]);
        showNotification(`${result.archived} item${result.archived !== 1 ? 's' : ''} archived`);
        selectedItems.clear();
        const query = document.getElementById('price-search')?.value || '';
        await loadPriceItems(query, currentCategory);
    } catch (error) {
        showNotification('Failed to archive: ' + error.message, 'error');
    }
}

async function bulkDeleteSelectedItems() {
    const count = selectedItems.size;
    if (count === 0) return;
    const confirmed = await showConfirmDialog({
        title: 'Delete Items',
        message: `Permanently delete ${count} item${count > 1 ? 's' : ''}? This action cannot be undone.`,
        confirmLabel: 'Delete',
        variant: 'danger',
    });
    if (!confirmed) return;

    try {
        const result = await api.bulkDeletePriceItems([...selectedItems]);
        showNotification(`${result.deleted} item${result.deleted !== 1 ? 's' : ''} permanently deleted`);
        selectedItems.clear();
        const query = document.getElementById('price-search')?.value || '';
        await loadPriceItems(query, currentCategory);
    } catch (error) {
        showNotification('Failed to delete: ' + error.message, 'error');
    }
}

async function archivePriceItem(itemId, itemName) {
    const confirmed = await showConfirmDialog({
        title: 'Archive Item',
        message: `Archive "${itemName}"? It will be hidden but can be restored later.`,
        confirmLabel: 'Archive',
        variant: 'warning',
    });
    if (!confirmed) return;

    try {
        await api.archivePriceItem(itemId);
        showNotification('Item archived');
        const query = document.getElementById('price-search')?.value || '';
        await loadPriceItems(query, currentCategory);
    } catch (error) {
        showNotification('Failed to archive: ' + error.message, 'error');
    }
}

async function deletePriceItem(itemId, itemName) {
    const confirmed = await showConfirmDialog({
        title: 'Delete Item',
        message: `Permanently delete "${itemName}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        variant: 'danger',
    });
    if (!confirmed) return;

    try {
        await api.deletePriceItem(itemId);
        showNotification('Item permanently deleted');
        const query = document.getElementById('price-search')?.value || '';
        await loadPriceItems(query, currentCategory);
    } catch (error) {
        showNotification('Failed to delete: ' + error.message, 'error');
    }
}

// ==================== Import Modal ====================

function openImportModal() {
    let parsedData = null;   // { headers: string[], rows: any[][] }
    let columnMapping = {};  // field -> columnIndex

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'import-modal';

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.maxWidth = '600px';
    modal.appendChild(content);

    // ---- Step 1: Upload ----
    function renderUploadStep() {
        content.style.maxWidth = '600px';
        content.innerHTML = `
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="upload"></i> Import Price Items
                </h2>
                <button class="modal-close-btn" id="import-close"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
            </div>
            <div class="modal-body">
                <div id="import-dropzone" style="border: 2px dashed var(--gray-300); border-radius: var(--radius-lg); padding: var(--space-2xl); text-align: center; cursor: pointer; transition: all 0.2s;">
                    <i data-lucide="file-spreadsheet" style="width: 48px; height: 48px; color: var(--color-shamrock); margin-bottom: var(--space-md);"></i>
                    <p style="font-size: 16px; font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-bottom: var(--space-sm);">
                        Drop your file here or click to browse
                    </p>
                    <p style="font-size: 13px; color: var(--color-text-secondary);">Supports .xlsx, .xls, and .csv files</p>
                    <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display: none;">
                </div>
                <div id="import-file-info" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: var(--gray-50); border-radius: var(--radius-md);"></div>
                <div id="import-error" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.2); border-radius: var(--radius-md); color: var(--color-error); font-size: 14px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="import-cancel">Cancel</button>
                <button class="btn-primary" id="import-next" disabled>Next: Map Columns</button>
            </div>
        `;
        lucide.createIcons();
        wireUploadEvents();
    }

    function wireUploadEvents() {
        document.getElementById('import-close')?.addEventListener('click', () => modal.remove());
        document.getElementById('import-cancel')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const dropzone = document.getElementById('import-dropzone');
        const fileInput = document.getElementById('import-file-input');

        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-shamrock)';
            dropzone.style.background = 'rgba(0,143,122,0.04)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--gray-300)';
            dropzone.style.background = '';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--gray-300)';
            dropzone.style.background = '';
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFile(e.target.files[0]);
        });

        document.getElementById('import-next')?.addEventListener('click', () => renderMapStep());
    }

    function handleFile(file) {
        const errorDiv = document.getElementById('import-error');
        const infoDiv = document.getElementById('import-file-info');
        const nextBtn = document.getElementById('import-next');
        errorDiv.style.display = 'none';

        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
            errorDiv.textContent = `Unsupported file type "${ext}". Please use .xlsx, .xls, or .csv.`;
            errorDiv.style.display = 'block';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            errorDiv.textContent = 'File is too large (max 5 MB).';
            errorDiv.style.display = 'block';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (jsonData.length < 2) {
                    errorDiv.textContent = 'File must have at least a header row and one data row.';
                    errorDiv.style.display = 'block';
                    return;
                }

                const headers = jsonData[0].map(h => String(h).trim());
                const rows = jsonData.slice(1).filter(row =>
                    row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
                );

                if (rows.length === 0) {
                    errorDiv.textContent = 'No data rows found in the file.';
                    errorDiv.style.display = 'block';
                    return;
                }

                parsedData = { headers, rows };
                columnMapping = autoDetectColumnMapping(headers);

                infoDiv.style.display = 'block';
                infoDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: var(--space-md);">
                        <i data-lucide="file-check" style="width: 24px; height: 24px; color: var(--color-shamrock);"></i>
                        <div>
                            <div style="font-weight: var(--font-weight-semibold);">${escapeHtml(file.name)}</div>
                            <div style="font-size: 13px; color: var(--color-text-secondary);">${rows.length} rows, ${headers.length} columns</div>
                        </div>
                    </div>
                `;
                lucide.createIcons();
                nextBtn.disabled = false;
            } catch (err) {
                errorDiv.textContent = 'Failed to parse file: ' + err.message;
                errorDiv.style.display = 'block';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // ---- Step 2: Map Columns ----
    function renderMapStep() {
        content.style.maxWidth = '700px';
        const previewRows = parsedData.rows.slice(0, 5);

        const mappingSelects = COLUMN_MAP_CONFIG.map(config => {
            const options = ['<option value="-1">-- Skip --</option>'];
            parsedData.headers.forEach((h, i) => {
                const selected = columnMapping[config.field] === i ? 'selected' : '';
                options.push(`<option value="${i}" ${selected}>${escapeHtml(h)}</option>`);
            });
            return `
                <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm) 0; border-bottom: 1px solid var(--gray-100);">
                    <div style="width: 150px; font-weight: var(--font-weight-semibold); font-size: 14px; color: var(--color-text-primary); flex-shrink: 0;">
                        ${config.label}
                    </div>
                    <div style="font-size: 18px; color: var(--color-text-secondary);">&larr;</div>
                    <select class="form-input import-col-select" data-field="${config.field}" style="flex: 1;">
                        ${options.join('')}
                    </select>
                </div>
            `;
        }).join('');

        const tableHeaders = parsedData.headers.map(h =>
            `<th style="padding: 6px 10px; font-size: 12px; white-space: nowrap; background: var(--gray-50); border-bottom: 2px solid var(--gray-200);">${escapeHtml(h)}</th>`
        ).join('');
        const tableRows = previewRows.map(row => {
            const cells = parsedData.headers.map((_, i) =>
                `<td style="padding: 4px 10px; font-size: 13px; border-bottom: 1px solid var(--gray-100); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(String(row[i] ?? ''))}</td>`
            ).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        content.innerHTML = `
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="columns-3"></i> Map Columns
                </h2>
                <button class="modal-close-btn" id="import-close"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
            </div>
            <div class="modal-body" style="max-height: 65vh; overflow-y: auto;">
                <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: var(--space-lg);">
                    Found <strong>${parsedData.rows.length}</strong> rows. Map your spreadsheet columns to price item fields:
                </p>
                <div style="margin-bottom: var(--space-xl);">${mappingSelects}</div>
                <details style="margin-top: var(--space-md);">
                    <summary style="cursor: pointer; font-size: 13px; color: var(--color-text-secondary); font-weight: var(--font-weight-semibold);">
                        Preview first ${previewRows.length} rows
                    </summary>
                    <div style="overflow-x: auto; margin-top: var(--space-sm); border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead><tr>${tableHeaders}</tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </details>
                <div id="import-map-error" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.2); border-radius: var(--radius-md); color: var(--color-error); font-size: 14px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="import-back">Back</button>
                <button class="btn-primary" id="import-confirm" style="display: flex; align-items: center; gap: var(--space-xs);">
                    <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                    Import ${parsedData.rows.length} Items
                </button>
            </div>
        `;
        lucide.createIcons();
        wireMapEvents();
    }

    function wireMapEvents() {
        document.getElementById('import-close')?.addEventListener('click', () => modal.remove());
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.querySelectorAll('.import-col-select').forEach(select => {
            select.addEventListener('change', () => {
                const field = select.dataset.field;
                const val = parseInt(select.value);
                if (val === -1) delete columnMapping[field];
                else columnMapping[field] = val;
            });
        });

        document.getElementById('import-back')?.addEventListener('click', () => {
            renderUploadStep();
            // Restore file info since we already parsed
            if (parsedData) {
                document.getElementById('import-next').disabled = false;
                const infoDiv = document.getElementById('import-file-info');
                infoDiv.style.display = 'block';
                infoDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: var(--space-md);">
                        <i data-lucide="file-check" style="width: 24px; height: 24px; color: var(--color-shamrock);"></i>
                        <div>
                            <div style="font-weight: var(--font-weight-semibold);">File loaded</div>
                            <div style="font-size: 13px; color: var(--color-text-secondary);">${parsedData.rows.length} rows, ${parsedData.headers.length} columns</div>
                        </div>
                    </div>
                `;
                lucide.createIcons();
            }
        });

        document.getElementById('import-confirm')?.addEventListener('click', () => executeImport());
    }

    // ---- Execute Import ----
    async function executeImport() {
        const errorDiv = document.getElementById('import-map-error');
        errorDiv.style.display = 'none';

        // Validate required columns are mapped
        if (columnMapping.name === undefined) {
            errorDiv.textContent = 'You must map the "Name" column.';
            errorDiv.style.display = 'block';
            return;
        }
        if (columnMapping.unit_price === undefined) {
            errorDiv.textContent = 'You must map the "Price" column.';
            errorDiv.style.display = 'block';
            return;
        }

        // Build items from mapping
        const items = [];
        const clientErrors = [];

        for (let i = 0; i < parsedData.rows.length; i++) {
            const row = parsedData.rows[i];
            const getValue = (field) => columnMapping[field] !== undefined ? row[columnMapping[field]] : undefined;

            const name = (getValue('name') || '').toString().trim();
            if (!name) {
                clientErrors.push({ row: i + 2, error: 'Empty name' });
                continue;
            }

            const price = parsePrice(getValue('unit_price'));
            if (price === null) {
                clientErrors.push({ row: i + 2, error: 'Invalid or missing price', name });
                continue;
            }

            const description = (getValue('description') || '').toString().trim() || null;
            const unit = normalizeUnit(getValue('unit'));
            const rawCategory = getValue('category');
            // Use explicit category if provided, otherwise auto-detect from name/description/unit
            const category = rawCategory ? normalizeCategory(rawCategory) : autoDetectCategory(name, description, unit);

            items.push({
                name,
                description,
                unit_price: price,
                category,
                unit,
                btw_percentage: parsePercentage(getValue('btw_percentage')),
                default_quantity: parseFloat(getValue('default_quantity')) || 1,
                sku: (getValue('sku') || '').toString().trim() || null,
            });
        }

        if (items.length === 0) {
            errorDiv.textContent = `No valid items to import. ${clientErrors.length} rows had errors.`;
            errorDiv.style.display = 'block';
            return;
        }

        // Disable button and show progress
        const confirmBtn = document.getElementById('import-confirm');
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = 'Importing...';

        try {
            const result = await api.bulkCreatePriceItems(items);
            const allErrors = [...clientErrors, ...(result.errors || [])];
            renderResultStep({ created: result.created, errors: allErrors });
        } catch (err) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i data-lucide="check" style="width: 16px; height: 16px;"></i> Import ${items.length} Items`;
            lucide.createIcons();
            errorDiv.textContent = 'Import failed: ' + err.message;
            errorDiv.style.display = 'block';
        }
    }

    // ---- Step 3: Results ----
    function renderResultStep(results) {
        content.style.maxWidth = '600px';
        const iconColor = results.created > 0 ? 'var(--color-shamrock)' : 'var(--color-error)';
        const iconName = results.created > 0 ? 'check-circle' : 'alert-circle';

        const errorRows = results.errors.length > 0
            ? `<div style="margin-top: var(--space-lg);">
                <p style="font-weight: var(--font-weight-semibold); color: var(--color-error); margin-bottom: var(--space-sm);">Errors (${results.errors.length}):</p>
                <div style="max-height: 200px; overflow-y: auto; background: var(--gray-50); border-radius: var(--radius-md); padding: var(--space-sm);">
                    ${results.errors.map(e => `<div style="font-size: 13px; padding: 4px 0; color: var(--color-text-secondary);">Row ${e.row}: ${escapeHtml(e.error)}${e.name ? ` (${escapeHtml(e.name)})` : ''}</div>`).join('')}
                </div>
            </div>`
            : '';

        content.innerHTML = `
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="${iconName}" style="color: ${iconColor};"></i> Import Complete
                </h2>
                <button class="modal-close-btn" id="import-close"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: var(--space-lg) 0;">
                    <div style="font-size: 48px; font-weight: var(--font-weight-bold); color: var(--color-shamrock);">${results.created}</div>
                    <div style="font-size: 16px; color: var(--color-text-secondary);">items imported successfully</div>
                </div>
                ${errorRows}
            </div>
            <div class="modal-footer">
                <button class="btn-primary" id="import-done">Done</button>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('import-close')?.addEventListener('click', () => modal.remove());
        document.getElementById('import-done')?.addEventListener('click', async () => {
            modal.remove();
            const query = document.getElementById('price-search')?.value || '';
            await loadPriceItems(query, currentCategory);
        });
    }

    // Start with upload step
    document.body.appendChild(modal);
    renderUploadStep();
}
