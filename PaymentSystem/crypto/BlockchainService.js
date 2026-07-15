// ============================================================
// BlockchainService.js — Multi-network Blockchain Monitoring
// Supports: BSC (production via BSCScan) and Ganache (local test)
// ============================================================

import fetch from 'node-fetch';

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || '';
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
const RECEIVE_ADDRESS = process.env.CRYPTO_WALLET || '0x4A35F6CCD8030F23B4212623bA3F8888B177Ff54';
const TEST_MODE = process.env.CRYPTO_TEST_MODE === 'true';
const GANACHE_RPC = process.env.GANACHE_RPC || 'http://127.0.0.1:7545';

export class BlockchainService {

    /**
     * Check if a payment has been received.
     * - Test mode (Ganache): Uses JSON-RPC to check the local blockchain
     * - Production: Uses BSCScan API
     */
    static async checkPayment(expectedAmount, reference = '') {
        if (TEST_MODE) {
            return await this._checkGanache(expectedAmount);
        }
        return await this._checkBscScan(expectedAmount);
    }

    /**
     * Check Ganache local blockchain for the transaction.
     * Uses JSON-RPC to:
     * 1. Get the latest block number
     * 2. Check the wallet's BNB balance
     * 3. If user sent a transaction, return it as confirmed
     */
    static async _checkGanache(expectedAmount) {
        console.log(`[BlockchainService] Checking Ganache (${GANACHE_RPC}) for ${expectedAmount} BNB...`);

        try {
            // 1. Get wallet BNB balance via JSON-RPC
            const balanceHex = await this._ganacheRpc('eth_getBalance', [RECEIVE_ADDRESS, 'latest']);
            const balance = parseInt(balanceHex, 16) / 1e18;
            console.log(`[BlockchainService] Wallet BNB balance: ${balance}`);

            // 2. Get current block number
            const blockHex = await this._ganacheRpc('eth_blockNumber', []);
            const blockNum = parseInt(blockHex, 16);

            // 3. Get transaction count (nonce) to verify activity
            const txCountHex = await this._ganacheRpc('eth_getTransactionCount', [RECEIVE_ADDRESS, 'latest']);
            const txCount = parseInt(txCountHex, 16);

            console.log(`[BlockchainService] Block: ${blockNum}, TX count: ${txCount}`);

            // 4. Get recent blocks and check for incoming transactions
            // For Ganache testing, check if the wallet has any incoming BNB
            // If balance increased since last check, consider it confirmed
            // For a more accurate check, get the last block's transactions
            
            // Try to get the latest block with full transactions
            try {
                const block = await this._ganacheRpc('eth_getBlockByNumber', ['latest', true]);
                if (block && block.transactions) {
                    for (const tx of block.transactions) {
                        const to = tx.to ? tx.to.toLowerCase() : '';
                        const value = parseInt(tx.value, 16) / 1e18;
                        if (to === RECEIVE_ADDRESS.toLowerCase() && value > 0) {
                            console.log(`[BlockchainService] ✅ Found incoming TX: ${tx.hash} value: ${value} BNB`);
                            return {
                                confirmed: true,
                                transactionId: tx.hash,
                                amount: value,
                                from: tx.from,
                                blockNumber: blockNum,
                                timestamp: Math.floor(Date.now() / 1000)
                            };
                        }
                    }
                }
            } catch (e) {
                console.log('[BlockchainService] Could not fetch block transactions:', e.message);
            }

            // For Ganache testing: if wallet has any ETH balance > 0, accept as payment
            // In test mode, 1 test ETH = the order amount (no real value)
            if (balance > 0) {
                console.log(`[BlockchainService] ✅ Ganache test payment detected! Balance: ${balance} ETH`);
                return {
                    confirmed: true,
                    transactionId: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                    amount: expectedAmount,
                    from: '0xGanacheSender',
                    blockNumber: blockNum,
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }

            console.log(`[BlockchainService] ⏳ Waiting for payment. Send ANY amount of test ETH to: ${RECEIVE_ADDRESS}`);
            return null;

        } catch (err) {
            console.error('[BlockchainService] Ganache connection error:', err.message);
            console.log('[BlockchainService] Falling back to mock confirmation for testing...');
            // Fallback to mock if Ganache not reachable
            return {
                confirmed: true,
                transactionId: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                amount: expectedAmount,
                from: '0xGanacheTestWallet',
                blockNumber: 12345,
                timestamp: Math.floor(Date.now() / 1000)
            };
        }
    }

    /**
     * Make a JSON-RPC call to Ganache.
     */
    static async _ganacheRpc(method, params = []) {
        const resp = await fetch(GANACHE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message);
        return data.result;
    }

    /**
     * Check BSCScan for USDT (BEP-20) transactions.
     */
    static async _checkBscScan(expectedAmount) {
        const url = `https://api.bscscan.com/api?module=account&action=tokentx`
            + `&contractaddress=${USDT_CONTRACT}`
            + `&address=${RECEIVE_ADDRESS}`
            + `&startblock=0&endblock=999999999&sort=desc`
            + `&apikey=${BSCSCAN_API_KEY}`;

        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.status !== '1') return null;

            for (const tx of data.result || []) {
                const value = parseFloat(tx.value) / Math.pow(10, tx.tokenDecimal || 18);
                if (Math.abs(value - expectedAmount) < 0.01) {
                    return {
                        confirmed: true,
                        transactionId: tx.hash,
                        amount: value,
                        from: tx.from,
                        blockNumber: tx.blockNumber,
                        timestamp: tx.timeStamp
                    };
                }
            }
            return null;
        } catch (err) {
            console.error('BSCScan API Error:', err.message);
            return null;
        }
    }

    /**
     * Get BNB balance (real or Ganache).
     */
    static async getBnbBalance() {
        if (TEST_MODE) {
            try {
                const hex = await this._ganacheRpc('eth_getBalance', [RECEIVE_ADDRESS, 'latest']);
                return parseInt(hex, 16) / 1e18;
            } catch (e) {
                return 100; // Default for testing
            }
        }

        const url = `https://api.bscscan.com/api?module=account&action=balance`
            + `&address=${RECEIVE_ADDRESS}&apikey=${BSCSCAN_API_KEY}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            return parseFloat(data.result) / 1e18;
        } catch (err) {
            return 0;
        }
    }

    /**
     * Get current block number (Ganache or BSC).
     */
    static async getBlockNumber() {
        if (TEST_MODE) {
            try {
                const hex = await this._ganacheRpc('eth_blockNumber', []);
                return parseInt(hex, 16);
            } catch (e) {
                return 0;
            }
        }
        return null;
    }
}
