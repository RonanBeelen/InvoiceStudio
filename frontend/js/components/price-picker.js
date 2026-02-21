/**
 * Price Picker Component
 * Modal overlay for quickly adding price items to a document's line items.
 * Stays open for multiple selections.
 */

const PICKER_CATEGORIES = [
    { key: '', label: 'All' },
    { key: 'product', label: 'Products' },
    { key: 'service', label: 'Services' },
    { key: 'hourly_rate', label: 'Hourly' },
    { key: 'travel', label: 'Travel' },
    { key: 'subscription', label: 'Subscription' },
];

/**
 * Opens the price picker modal.
 * @param {function} onSelect - Called with { description, quantity, unit_price, btw_percentage } for each picked item
 */
export async function openPricePicker(onSelect) {
    // Remove any existing picker
    document.getElementById('price-picker-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'price-picker-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 640px; max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2><i data-lucide="tag" style="width: 20px; height: 20px;"></i> Quick Add from Price Library</h2>
                <button class="modal-close-btn" id="pp-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div style="padding: var(--space-md) var(--space-lg) 0;">
                <input type="text" id="pp-search" class="form-input" placeholder="Search items..." style="width: 100%;">
                <div class="category-tabs" id="pp-categories" style="margin-top: var(--space-sm);"></div>
            </div>
            <div id="pp-items" class="pp-items-list" style="flex: 1; overflow-y: auto; padding: var(--space-md) var(--space-lg) var(--space-lg);"></div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    let activeCategory = '';
    let searchQuery = '';
    let allItems = [];

    // Render category tabs
    const tabsContainer = document.getElementById('pp-categories');
    tabsContainer.innerHTML = PICKER_CATEGORIES.map(c =>
        `<button class="category-tab${c.key === '' ? ' active' : ''}" data-cat="${c.key}">${c.label}</button>`
    ).join('');

    tabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-tab');
        if (!btn) return;
        activeCategory = btn.dataset.cat;
        tabsContainer.querySelectorAll('.category-tab').forEach(b => b.classList.toggle('active', b === btn));
        renderItems();
    });

    // Search
    const searchInput = document.getElementById('pp-search');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = searchInput.value.trim().toLowerCase();
            renderItems();
        }, 200);
    });
    searchInput.focus();

    // Close handlers
    const close = () => modal.remove();
    document.getElementById('pp-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Load items
    const itemsContainer = document.getElementById('pp-items');
    itemsContainer.innerHTML = '<div style="text-align: center; padding: var(--space-xl); color: var(--color-text-secondary);">Loading...</div>';

    try {
        allItems = await api.getPriceItems({ active: true });
    } catch (err) {
        itemsContainer.innerHTML = '<div style="text-align: center; padding: var(--space-xl); color: var(--color-error);">Failed to load items</div>';
        return;
    }

    function renderItems() {
        let filtered = allItems;

        if (activeCategory) {
            filtered = filtered.filter(item => item.category === activeCategory);
        }
        if (searchQuery) {
            filtered = filtered.filter(item =>
                (item.name || '').toLowerCase().includes(searchQuery) ||
                (item.description || '').toLowerCase().includes(searchQuery) ||
                (item.sku || '').toLowerCase().includes(searchQuery)
            );
        }

        if (filtered.length === 0) {
            itemsContainer.innerHTML = `
                <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-secondary);">
                    <i data-lucide="search-x" style="width: 32px; height: 32px; margin-bottom: var(--space-sm);"></i>
                    <p>No items found</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        itemsContainer.innerHTML = filtered.map(item => `
            <div class="pp-item" data-id="${item.id}">
                <div class="pp-item-info">
                    <div class="pp-item-name">${escapeHtml(item.name)}</div>
                    ${item.description ? `<div class="pp-item-desc">${escapeHtml(item.description)}</div>` : ''}
                    <div class="pp-item-meta">
                        ${item.sku ? `<span class="pp-item-sku">${escapeHtml(item.sku)}</span>` : ''}
                        <span class="pp-item-cat">${escapeHtml(item.category || 'general')}</span>
                        <span>BTW ${item.btw_percentage}%</span>
                    </div>
                </div>
                <div class="pp-item-price">
                    <span class="pp-item-amount">&euro;${formatPrice(item.unit_price)}</span>
                    <span class="pp-item-unit">/ ${escapeHtml(item.unit || 'stuk')}</span>
                </div>
                <button class="btn-secondary pp-add-btn" title="Add to document">
                    <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        `).join('');

        lucide.createIcons();

        // Add click handlers
        itemsContainer.querySelectorAll('.pp-item').forEach(el => {
            el.addEventListener('click', (e) => {
                // Don't double-fire if they clicked the button directly
                if (e.target.closest('.pp-add-btn')) return;
                addItem(el.dataset.id);
            });
            el.querySelector('.pp-add-btn').addEventListener('click', () => {
                addItem(el.dataset.id);
            });
        });
    }

    function addItem(itemId) {
        const item = allItems.find(i => i.id === itemId);
        if (!item) return;

        onSelect({
            description: item.name + (item.description ? ' - ' + item.description : ''),
            quantity: item.default_quantity || 1,
            unit_price: parseFloat(item.unit_price) || 0,
            btw_percentage: parseFloat(item.btw_percentage) ?? 21,
        });

        // Flash feedback on the row
        const row = itemsContainer.querySelector(`[data-id="${itemId}"]`);
        if (row) {
            row.classList.add('pp-item-added');
            setTimeout(() => row.classList.remove('pp-item-added'), 600);
        }
    }

    renderItems();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPrice(amount) {
    return parseFloat(amount || 0).toFixed(2).replace('.', ',');
}
