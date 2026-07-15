// ============================================================
// TransactionStore.js — In-Memory Transaction Ledger
// In production, replace with Redis or a PostgreSQL table.
// Acts as a fast lookup cache for transaction status checks.
// ============================================================

const store = new Map();

export const TransactionStore = {
    /**
     * Save a transaction after processing
     */
    save(transactionId, record) {
        store.set(transactionId, {
            ...record,
            createdAt: new Date().toISOString()
        });
    },

    /**
     * Lookup a transaction by ID
     */
    get(transactionId) {
        return store.get(transactionId) || null;
    },

    /**
     * Get all transactions (for admin/reporting)
     */
    getAll() {
        return Array.from(store.values());
    },

    /**
     * Check if transaction exists
     */
    exists(transactionId) {
        return store.has(transactionId);
    }
};
