/**
 * Network Utilities for Mobile App
 * 
 * Handles network connectivity checks and retry logic
 * for Android and iOS platforms.
 */

import { Platform } from 'react-native';
import Logger from './logger';

/**
 * Check if device has network connectivity
 * 
 * Note: This is an optimistic check that doesn't block on external dependencies.
 * Network errors will still be handled by the retry logic.
 * 
 * @param {string} healthCheckUrl - Health check URL (use app's own endpoint in production)
 * @returns {Promise<boolean>} True if connected (optimistic on failure)
 */
export async function isNetworkAvailable(healthCheckUrl = null) {
    // Skip network check if no URL provided (optimistic approach)
    if (!healthCheckUrl) {
        return true;
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(healthCheckUrl, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        Logger.warn('Network check failed:', error.message);
        // Optimistically assume network is available
        return true;
    }
}

/**
 * Wait for network connection
 * 
 * @param {number} timeout - Maximum wait time in ms
 * @returns {Promise<boolean>} True if network becomes available
 */
export async function waitForNetwork(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (await isNetworkAvailable()) {
            return true;
        }
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
}

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {boolean} options.checkNetwork - Check network before retry (default: false)
 * @returns {Promise<any>} Result from function
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        checkNetwork = false
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Check network before retry (except first attempt)
            if (attempt > 0 && checkNetwork) {
                const hasNetwork = await isNetworkAvailable();
                if (!hasNetwork) {
                    Logger.warn(`Retry ${attempt}: No network, waiting...`);
                    const networkAvailable = await waitForNetwork(5000);
                    if (!networkAvailable) {
                        throw new Error('No network connection available');
                    }
                }
            }
            
            // Try the function
            return await fn();
            
        } catch (error) {
            lastError = error;
            
            // Don't retry on certain errors (client errors)
            if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404) {
                throw error;
            }
            
            // If this was the last attempt, throw the error
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Calculate delay with exponential backoff
            const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
            Logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, error.message);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

/**
 * Check if error is network-related
 * 
 * @param {Error} error - Error to check
 * @returns {boolean} True if network error
 */
export function isNetworkError(error) {
    if (!error) return false;
    
    const networkErrorMessages = [
        'Network request failed',
        'Request timeout',
        'Cannot connect to server',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'network error',
        'Failed to fetch'
    ];
    
    const message = error.message?.toLowerCase() || '';
    return networkErrorMessages.some(msg => message.includes(msg.toLowerCase()));
}

export default {
    isNetworkAvailable,
    waitForNetwork,
    retryWithBackoff,
    isNetworkError
};
