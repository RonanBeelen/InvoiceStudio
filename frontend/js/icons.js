/**
 * Lucide Icons Helper
 * Provides mapping from emoji to Lucide icon names and utility functions
 */

window.Icons = {
    /**
     * Emoji to Lucide icon name mapping
     * Matches design system: minimalist, clean line-art, rounded corners
     */
    mapping: {
        '📄': 'file-text',
        '🎨': 'palette',
        '⚡': 'zap',
        '📚': 'library',
        '✨': 'sparkles',
        '💾': 'save',
        '🚀': 'rocket',
        '✅': 'check-circle',
        '📭': 'inbox',
        '📋': 'clipboard',
        '✏️': 'edit',
        '🗑️': 'trash-2',
        '⏳': 'loader-2',
        '📥': 'download',
        '➕': 'plus-circle',
        '⚠': 'alert-triangle',
        '✓': 'check',
        '❌': 'x-circle',
        '🏠': 'home',
        '←': 'arrow-left'
    },

    /**
     * Create a new icon element
     * @param {string} name - Icon name (emoji or lucide name)
     * @param {number} size - Icon size in pixels (default: 24)
     * @param {string} className - Optional CSS class names
     * @returns {HTMLElement} Icon element
     */
    create(name, size = 24, className = '') {
        const iconName = this.mapping[name] || name;
        const i = document.createElement('i');
        i.setAttribute('data-lucide', iconName);
        i.setAttribute('width', size);
        i.setAttribute('height', size);
        if (className) {
            i.className = className;
        }
        return i;
    },

    /**
     * Replace an element's content with an icon
     * @param {HTMLElement} element - Element to replace
     * @param {string} iconName - Icon name
     * @param {number} size - Icon size
     */
    replace(element, iconName, size = 24) {
        const icon = this.create(iconName, size);
        element.replaceWith(icon);
        this.init();
    },

    /**
     * Initialize all Lucide icons on the page
     * Call this after dynamically adding icons to the DOM
     */
    init() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else {
            console.warn('Lucide library not loaded');
        }
    },

    /**
     * Create an icon HTML string (for template literals)
     * @param {string} name - Icon name
     * @param {number} size - Icon size
     * @param {string} style - Optional inline style
     * @returns {string} HTML string
     */
    html(name, size = 24, style = '') {
        const iconName = this.mapping[name] || name;
        const styleAttr = style ? ` style="${style}"` : '';
        return `<i data-lucide="${iconName}" width="${size}" height="${size}"${styleAttr}></i>`;
    }
};

// Auto-initialize icons when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Icons.init());
} else {
    Icons.init();
}
