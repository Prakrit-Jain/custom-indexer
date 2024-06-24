

export async function exponentialBackoffRetry<T>(fn: () => Promise<T>, retries: number = 5, delayMs: number = 1000) : Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if(i === retries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
        }
    }
}