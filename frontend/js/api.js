/**
 * API Client for Invoice/Quote PDF Builder
 * Handles all communication with the FastAPI backend
 */

const API_BASE = '';  // Same origin, so empty string

class APIClient {
    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        // For FormData, let browser set Content-Type with boundary
        const isFormData = options.body instanceof FormData;
        const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };

        // Add auth token if available (await session to avoid race condition on page load)
        if (window.auth) {
            try {
                const session = await window.auth.getSession();
                console.log('[API] Session:', session ? 'exists' : 'null', session ? Object.keys(session) : '');
                if (session?.access_token) {
                    defaultHeaders['Authorization'] = `Bearer ${session.access_token}`;
                    console.log('[API] Token added to request');
                } else {
                    console.warn('[API] No access_token in session');
                }
            } catch (e) {
                console.error('[API] Session error:', e);
            }
        } else {
            console.warn('[API] window.auth not available');
        }

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
            cache: 'no-store',
        };

        try {
            const response = await fetch(url, config);

            // Handle 401 - clear invalid session and redirect to login
            if (response.status === 401) {
                if (!window._authRedirecting) {
                    window._authRedirecting = true;
                    // Clear the cached Supabase session to prevent redirect loops
                    // (login page would otherwise find the stale session and redirect back here)
                    if (window.auth?.forceSignOut) {
                        await window.auth.forceSignOut();
                    }
                    window.location.href = '/login';
                }
                throw new Error('Sessie verlopen. Log opnieuw in.');
            }

            // Handle 429 - Rate limit exceeded
            if (response.status === 429) {
                const data = await response.json();
                const err = new Error(data.detail?.message || 'Rate limit exceeded');
                err.status = 429;
                err.rateLimit = data.detail;
                throw err;
            }

            // Parse response
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ==================== Template Methods ====================

    /**
     * Get all templates
     * @returns {Promise<Array>} List of templates
     */
    async getTemplates() {
        return this.request('/api/templates');
    }

    /**
     * Get a specific template by ID
     * @param {string} templateId - UUID of the template
     * @returns {Promise<Object>} Template object
     */
    async getTemplate(templateId) {
        return this.request(`/api/templates/${templateId}`);
    }

    /**
     * Create a new template
     * @param {Object} templateData - { name, description, template_json }
     * @returns {Promise<Object>} Created template
     */
    async createTemplate(templateData) {
        const result = await this.request('/api/templates', {
            method: 'POST',
            body: JSON.stringify(templateData),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.TEMPLATE_SAVED, { id: result?.id, action: 'create' });
        return result;
    }

    /**
     * Update an existing template
     * @param {string} templateId - UUID of the template
     * @param {Object} templateData - { name, description, template_json }
     * @returns {Promise<Object>} Updated template
     */
    async updateTemplate(templateId, templateData) {
        const result = await this.request(`/api/templates/${templateId}`, {
            method: 'PUT',
            body: JSON.stringify(templateData),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.TEMPLATE_SAVED, { id: templateId, action: 'update' });
        return result;
    }

    /**
     * Delete a template
     * @param {string} templateId - UUID of the template
     * @returns {Promise<Object>} Deletion confirmation
     */
    async deleteTemplate(templateId) {
        const result = await this.request(`/api/templates/${templateId}`, {
            method: 'DELETE',
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.TEMPLATE_DELETED, { id: templateId });
        return result;
    }

    /**
     * Get a PDF preview for a template
     * @param {string} templateId - UUID of the template
     * @returns {Promise<Object>} Preview with base64 PDF
     */
    async getTemplatePreview(templateId) {
        return this.request(`/api/templates/${templateId}/preview`);
    }

    /**
     * Generate PDF from template
     * @param {string} templateId - UUID of the template
     * @param {Object} inputData - Field values for PDF generation
     * @param {string} filename - Optional custom filename
     * @returns {Promise<Object>} PDF generation result with URL
     */
    async generatePdf(templateId, inputData, filename = null) {
        return this.request('/api/generate-pdf', {
            method: 'POST',
            body: JSON.stringify({
                template_id: templateId,
                input_data: inputData,
                filename: filename
            }),
        });
    }

    // ==================== Settings ====================

    async getSettings() {
        return this.request('/api/settings');
    }

    async updateSettings(settingsData) {
        return this.request('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(settingsData),
        });
    }

    async getNextDocumentNumber(documentType) {
        return this.request(`/api/settings/next-number/${documentType}`);
    }

    // ==================== Customers ====================

    async getCustomers(query = '') {
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        return this.request(`/api/customers${params}`);
    }

    async getCustomer(customerId) {
        return this.request(`/api/customers/${customerId}`);
    }

    async createCustomer(customerData) {
        const result = await this.request('/api/customers', {
            method: 'POST',
            body: JSON.stringify(customerData),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.CUSTOMER_SAVED, { id: result?.id, action: 'create' });
        return result;
    }

    async updateCustomer(customerId, customerData) {
        const result = await this.request(`/api/customers/${customerId}`, {
            method: 'PUT',
            body: JSON.stringify(customerData),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.CUSTOMER_SAVED, { id: customerId, action: 'update' });
        return result;
    }

    async deleteCustomer(customerId) {
        const result = await this.request(`/api/customers/${customerId}`, {
            method: 'DELETE',
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.CUSTOMER_DELETED, { id: customerId });
        return result;
    }

    // ==================== Documents ====================

    async getDocuments(filters = {}) {
        const params = new URLSearchParams();
        if (filters.type) params.set('type', filters.type);
        if (filters.status) params.set('status', filters.status);
        if (filters.customer_id) params.set('customer_id', filters.customer_id);
        const qs = params.toString();
        return this.request(`/api/documents${qs ? '?' + qs : ''}`);
    }

    async getDocument(documentId) {
        return this.request(`/api/documents/${documentId}`);
    }

    async createDocument(documentData) {
        const result = await this.request('/api/documents', {
            method: 'POST',
            body: JSON.stringify(documentData),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.DOCUMENT_SAVED, { id: result?.id, action: 'create' });
        return result;
    }

    async updateDocument(documentId, data) {
        const result = await this.request(`/api/documents/${documentId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.DOCUMENT_SAVED, { id: documentId, action: 'update' });
        return result;
    }

    async deleteDocument(documentId) {
        const result = await this.request(`/api/documents/${documentId}`, {
            method: 'DELETE',
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.DOCUMENT_DELETED, { id: documentId });
        return result;
    }

    async generateDocumentPdf(documentId) {
        return this.request(`/api/documents/${documentId}/generate-pdf`, {
            method: 'POST',
        });
    }

    // ==================== AI Template ====================

    async generateTemplateFromImage(file, documentType = 'invoice') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', documentType);
        return this.request('/api/ai/generate-template', {
            method: 'POST',
            body: formData,
        });
    }

    async getAiRateLimit() {
        return this.request('/api/ai/rate-limit');
    }

    // ==================== Price Items ====================

    async getPriceItems(filters = {}) {
        const params = new URLSearchParams();
        if (filters.category) params.set('category', filters.category);
        if (filters.q) params.set('q', filters.q);
        if (filters.active !== undefined) params.set('active', filters.active);
        const qs = params.toString();
        return this.request(`/api/price-items${qs ? '?' + qs : ''}`);
    }

    async getPriceItemCategories() {
        return this.request('/api/price-items/categories');
    }

    async getPriceItem(itemId) {
        return this.request(`/api/price-items/${itemId}`);
    }

    async createPriceItem(data) {
        const result = await this.request('/api/price-items', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.PRICE_ITEM_SAVED, { id: result?.id, action: 'create' });
        return result;
    }

    async updatePriceItem(itemId, data) {
        const result = await this.request(`/api/price-items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.PRICE_ITEM_SAVED, { id: itemId, action: 'update' });
        return result;
    }

    async deletePriceItem(itemId) {
        const result = await this.request(`/api/price-items/${itemId}`, {
            method: 'DELETE',
        });
        if (window.appEvents) window.appEvents.emit(AppEvent.PRICE_ITEM_DELETED, { id: itemId });
        return result;
    }

    // ==================== Document Sending ====================

    async sendDocument(documentId, data) {
        return this.request(`/api/documents/${documentId}/send`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getSendHistory(documentId) {
        return this.request(`/api/documents/${documentId}/sends`);
    }

    async sendReminder(documentId, data) {
        return this.request(`/api/documents/${documentId}/send/reminder`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async markDocumentSent(documentId, data = {}) {
        return this.request(`/api/documents/${documentId}/mark-sent`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ==================== Activity ====================

    async getDocumentActivity(documentId, limit = 20) {
        return this.request(`/api/documents/${documentId}/activity?limit=${limit}`);
    }

    async getActivityFeed(limit = 20) {
        return this.request(`/api/activity/feed?limit=${limit}`);
    }

    // ==================== Email Events ====================

    async getEmailEvents(filters = {}) {
        const params = new URLSearchParams();
        if (filters.document_id) params.set('document_id', filters.document_id);
        if (filters.processed !== undefined) params.set('processed', filters.processed);
        if (filters.limit) params.set('limit', filters.limit);
        const qs = params.toString();
        return this.request(`/api/email-events${qs ? '?' + qs : ''}`);
    }

    async getUnreadEventCount() {
        return this.request('/api/email-events/unread-count');
    }

    async dismissEmailEvent(eventId) {
        return this.request(`/api/email-events/${eventId}/dismiss`, {
            method: 'POST',
        });
    }

    async dismissAllEmailEvents() {
        return this.request('/api/email-events/dismiss-all', {
            method: 'POST',
        });
    }

    // ==================== Automations ====================

    async getAutomations() {
        return this.request('/api/automations');
    }

    async getAutomation(ruleId) {
        return this.request(`/api/automations/${ruleId}`);
    }

    async createAutomation(data) {
        return this.request('/api/automations', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateAutomation(ruleId, data) {
        return this.request(`/api/automations/${ruleId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteAutomation(ruleId) {
        return this.request(`/api/automations/${ruleId}`, {
            method: 'DELETE',
        });
    }

    async pauseAutomation(ruleId) {
        return this.request(`/api/automations/${ruleId}/pause`, {
            method: 'POST',
        });
    }

    async resumeAutomation(ruleId) {
        return this.request(`/api/automations/${ruleId}/resume`, {
            method: 'POST',
        });
    }

    async triggerAutomation(ruleId) {
        return this.request(`/api/automations/${ruleId}/trigger`, {
            method: 'POST',
        });
    }

    async getAutomationRuns(ruleId, limit = 20) {
        return this.request(`/api/automations/${ruleId}/runs?limit=${limit}`);
    }

    // ==================== Statistics ====================

    async getStatistics() {
        return this.request('/api/statistics/overview');
    }

    async getDashboardStats() {
        return this.request('/api/statistics/dashboard');
    }

    // ==================== Health Check ====================

    /**
     * Check service health
     * @returns {Promise<Object>} Health status
     */
    async checkHealth() {
        return this.request('/health');
    }
}

// Create singleton instance
const api = new APIClient();

// Export for use in other scripts
window.api = api;
