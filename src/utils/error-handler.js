import logger from './logger.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export class RetryableError extends Error {
  constructor(message, retryable = true) {
    super(message);
    this.name = 'RetryableError';
    this.retryable = retryable;
  }
}

export async function withRetry(fn, context = 'operation', maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug({ attempt, context }, 'Attempt %d/%d', attempt, maxRetries);
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err.retryable !== false && attempt < maxRetries;
      
      logger.warn(
        { attempt, maxRetries, error: err.message, retryable: isRetryable },
        `${context} failed (attempt ${attempt}/${maxRetries})${isRetryable ? ', retrying...' : ''}`
      );
      
      if (!isRetryable) {
        throw err;
      }
      
      const delay = RETRY_DELAY_MS * attempt;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw new RetryableError(`${context} failed after ${maxRetries} retries: ${lastError.message}`);
}

export function handleError(err, context = 'unknown') {
  logger.error(
    { error: err.message, stack: err.stack, context },
    `Error in ${context}`
  );
  // Fallback gracefully
  return { success: false, error: err.message };
}
