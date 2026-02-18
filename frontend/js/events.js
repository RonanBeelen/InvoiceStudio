/**
 * Lightweight event bus for cross-page data change notifications.
 * Uses native CustomEvent on window - no dependencies.
 */
window.appEvents = {
    emit(eventName, detail = {}) {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    },
    on(eventName, callback) {
        const handler = (e) => callback(e.detail);
        window.addEventListener(eventName, handler);
        return handler; // Return for cleanup if needed
    },
    off(eventName, handler) {
        window.removeEventListener(eventName, handler);
    }
};

// Event name constants
window.AppEvent = {
    TEMPLATE_SAVED: 'app:template-saved',
    TEMPLATE_DELETED: 'app:template-deleted',
    DOCUMENT_SAVED: 'app:document-saved',
    DOCUMENT_DELETED: 'app:document-deleted',
    CUSTOMER_SAVED: 'app:customer-saved',
    CUSTOMER_DELETED: 'app:customer-deleted',
};
