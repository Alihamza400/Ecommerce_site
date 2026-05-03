import logger from '../utils/logger.js';
import { RoutingEngine } from './RoutingEngine.js';

export class FailoverManager {
    /**
     * Executes payment with fallback logic.
     * @param {Object} gateways - The registry of available gateways
     * @param {string} initialGatewayName - The gateway to try first
     * @param {Object} paymentRequest - The payment data
     * @param {string} requestId - Unique ID for tracing
     * @returns {Promise<Object>}
     */
    static async executeWithFailover(gateways, initialGatewayName, paymentRequest, requestId) {
        const MAX_ATTEMPTS = 3;
        let attempt = 1;
        let currentGatewayName = initialGatewayName;
        let lastError = null;

        while (attempt <= MAX_ATTEMPTS && currentGatewayName) {
            const gateway = gateways[currentGatewayName];
            
            if (!gateway) {
                logger.error(`[FailoverManager] Gateway ${currentGatewayName} not found in registry.`, { requestId });
                break;
            }

            logger.info(`[FailoverManager] Attempt ${attempt}/${MAX_ATTEMPTS} via ${currentGatewayName}`, { requestId });

            try {
                const rawResult = await gateway.pay(paymentRequest);
                
                logger.info(`[FailoverManager] Payment succeeded via ${currentGatewayName}`, { 
                    requestId, 
                    transactionId: rawResult.transactionId 
                });

                return {
                    success: true,
                    gatewayUsed: currentGatewayName,
                    transactionId: rawResult.transactionId,
                    status: rawResult.status,
                    isFailover: attempt > 1,
                    metadata: rawResult.metadata
                };

            } catch (err) {
                lastError = err;
                logger.warn(`[FailoverManager] Payment failed via ${currentGatewayName}`, { 
                    requestId, 
                    error: err.message 
                });

                // Get fallback
                const fallbackName = RoutingEngine.getFallback(currentGatewayName, paymentRequest);
                
                if (!fallbackName || fallbackName === currentGatewayName) {
                    logger.warn(`[FailoverManager] No fallback available for ${currentGatewayName}`, { requestId });
                    break;
                }

                logger.info(`[FailoverManager] Initiating failover: ${currentGatewayName} -> ${fallbackName}`, { requestId });
                currentGatewayName = fallbackName;
                attempt++;
            }
        }

        // Exhausted attempts or no fallback
        logger.error(`[FailoverManager] All attempts exhausted. Payment failed.`, { requestId, attempts: attempt - 1 });
        return {
            success: false,
            gatewayUsed: currentGatewayName || initialGatewayName,
            transactionId: 'N/A',
            status: 'failed',
            isFailover: attempt > 1,
            metadata: { error: lastError ? lastError.message : 'Unknown error' }
        };
    }
}
