/**
 * Simple hash-based router for SPA navigation
 * No dependencies, pure vanilla JavaScript
 */

/**
 * Show unsaved changes modal. Returns promise resolving to user's choice.
 * @returns {Promise<'save'|'discard'|'cancel'>}
 */
function showUnsavedChangesModal() {
    return new Promise((resolve) => {
        document.getElementById('unsaved-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'unsaved-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 440px;">
                <div class="modal-header">
                    <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="alert-triangle" style="color: var(--color-shamrock);"></i>
                        Niet-opgeslagen wijzigingen
                    </h2>
                    <button class="modal-close-btn" data-choice="cancel">
                        <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="color: var(--color-text-secondary); margin: 0;">
                        Wilt u de aanpassingen opslaan voordat u verdergaat?
                    </p>
                </div>
                <div class="modal-footer" style="justify-content: flex-end; gap: var(--space-md);">
                    <button class="btn-secondary" data-choice="discard" style="color: var(--color-error);">
                        Niet opslaan
                    </button>
                    <button class="btn-secondary" data-choice="cancel">
                        Annuleren
                    </button>
                    <button class="btn-primary" data-choice="save" style="display: flex; align-items: center; gap: var(--space-xs);">
                        <i data-lucide="save" style="width: 16px; height: 16px;"></i>
                        Opslaan
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const saveBtn = modal.querySelector('[data-choice="save"]');
        saveBtn.focus();

        let resolved = false;
        const cleanup = (choice) => {
            if (resolved) return;
            resolved = true;
            document.removeEventListener('keydown', escHandler);
            modal.remove();
            resolve(choice);
        };

        modal.querySelectorAll('[data-choice]').forEach(btn => {
            btn.addEventListener('click', () => cleanup(btn.dataset.choice));
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup('cancel');
        });

        const escHandler = (e) => {
            if (e.key === 'Escape') cleanup('cancel');
        };
        document.addEventListener('keydown', escHandler);
    });
}

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.contentArea = null;

        // Dirty state tracking
        this._previousHash = window.location.hash || '#/home';
        this._dirtyChecker = null;
        this._dirtySaver = null;
        this._suppressHashChange = false;

        // Listen for hash changes (navigation)
        window.addEventListener('hashchange', () => this.handleRouteChange());

        // Handle initial page load
        window.addEventListener('load', () => this.handleRouteChange());

        // Warn on tab close/refresh with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    /**
     * Register a dirty state checker and save function for the current page.
     * @param {Function} isDirtyFn - Returns true if page has unsaved changes
     * @param {Function} saveFn - Async function to save current page state
     */
    setDirtyGuard(isDirtyFn, saveFn) {
        this._dirtyChecker = isDirtyFn;
        this._dirtySaver = saveFn;
    }

    clearDirtyGuard() {
        this._dirtyChecker = null;
        this._dirtySaver = null;
    }

    isDirty() {
        try {
            return typeof this._dirtyChecker === 'function' && this._dirtyChecker();
        } catch {
            return false;
        }
    }

    /**
     * Register a route handler
     * @param {string} path - Route path (e.g., 'home', 'designer')
     * @param {Function} handler - Async function to handle route
     */
    register(path, handler) {
        this.routes[path] = handler;
    }

    /**
     * Set the content area element where pages will be rendered
     * @param {HTMLElement} element - Content area DOM element
     */
    setContentArea(element) {
        this.contentArea = element;
    }

    /**
     * Navigate to a specific path
     * @param {string} path - Route path
     * @param {Object} params - Optional query parameters
     */
    navigate(path, params = {}) {
        const queryString = Object.keys(params).length > 0
            ? '?' + new URLSearchParams(params).toString()
            : '';
        window.location.hash = `#/${path}${queryString}`;
    }

    /**
     * Get current path from hash
     * @returns {string} Current route path
     */
    getCurrentPath() {
        const hash = window.location.hash.slice(1); // Remove #
        const path = hash.split('?')[0].slice(1); // Remove / and split on ?
        return path || 'home';
    }

    /**
     * Get query parameters from hash
     * @returns {Object} Query parameters as key-value pairs
     */
    getQueryParams() {
        const hash = window.location.hash;
        const queryString = hash.includes('?') ? hash.split('?')[1] : '';
        return Object.fromEntries(new URLSearchParams(queryString));
    }

    /**
     * Handle route change (hash change or initial load)
     */
    async handleRouteChange() {
        // Skip if we're restoring the hash after a cancelled navigation
        if (this._suppressHashChange) {
            this._suppressHashChange = false;
            return;
        }

        const newHash = window.location.hash;

        // Check if current page has unsaved changes
        if (this.isDirty()) {
            // Restore previous hash without creating a history entry
            // (replaceState does NOT trigger hashchange, so no suppress needed)
            history.replaceState(null, '', this._previousHash);

            const choice = await showUnsavedChangesModal();

            if (choice === 'save') {
                try {
                    await this._dirtySaver();
                    this.clearDirtyGuard();
                    window.location.hash = newHash;
                } catch (error) {
                    // Save failed — stay on current page (page's own error notification handles it)
                }
                return;
            } else if (choice === 'discard') {
                this.clearDirtyGuard();
                window.location.hash = newHash;
                return;
            } else {
                // Cancel — stay on current page (hash already restored)
                return;
            }
        }

        // Navigation proceeds — clear any previous guard and update hash tracking
        this.clearDirtyGuard();
        this._previousHash = newHash;

        const path = this.getCurrentPath();
        const handler = this.routes[path];

        if (!handler) {
            console.error(`No route found: ${path}`);
            this.navigate('home');
            return;
        }

        // Update active menu item
        this.updateActiveMenuItem(path);

        // Show loading state
        if (this.contentArea) {
            this.contentArea.innerHTML = `
                <div class="loading">
                    <div class="loader-pulse">
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__dot"></div>
                    </div>
                    <p>Laden...</p>
                </div>
            `;
        }

        try {
            // Execute route handler
            await handler();
            this.currentRoute = path;
        } catch (error) {
            console.error('Route error:', error);
            if (this.contentArea) {
                this.contentArea.innerHTML = `
                    <div class="error-state">
                        <i data-lucide="alert-triangle"></i>
                        <h2>Fout bij laden</h2>
                        <p>${error.message}</p>
                        <button class="btn btn-primary" onclick="router.navigate('home')">
                            <i data-lucide="home"></i>
                            Terug naar Home
                        </button>
                    </div>
                `;
                lucide.createIcons();
            }
        }
    }

    /**
     * Update active menu item based on current route
     * @param {string} path - Current route path
     */
    updateActiveMenuItem(path) {
        document.querySelectorAll('.menu-item').forEach(item => {
            const route = item.getAttribute('data-route');
            if (route === path) {
                item.classList.add('menu-item-selected');
            } else {
                item.classList.remove('menu-item-selected');
            }
        });
    }

    /**
     * Render HTML content to the content area
     * @param {string} html - HTML content to render
     */
    render(html) {
        if (this.contentArea) {
            this.contentArea.innerHTML = `<div class="page-content">${html}</div>`;

            // Initialize Lucide icons after rendering
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
}

// Create global router instance
const router = new Router();
window.router = router;
