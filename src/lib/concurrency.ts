const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process async tasks with limited concurrency.
 * Each worker picks tasks from a shared queue and executes them sequentially,
 * with an optional inter-task delay to avoid API rate limits.
 */
export async function processWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
    interTaskDelayMs: number = 300
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < tasks.length) {
            const index = nextIndex++;
            results[index] = await tasks[index]();
            if (nextIndex < tasks.length) await delay(interTaskDelayMs);
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
    );
    return results;
}
