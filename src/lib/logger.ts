import * as Sentry from "@sentry/nextjs";

/** Redact PII and secrets from strings before sending to Sentry */
function scrubPII(text: string): string {
    return text
        .replace(/sk_(live|test)_[A-Za-z0-9]+/g, "sk_***REDACTED***")
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer ***REDACTED***")
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***EMAIL***")
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "***IP***")
        .replace(/cus_[A-Za-z0-9]+/g, "cus_***")
        .replace(/sub_[A-Za-z0-9]+/g, "sub_***")
        .replace(/pi_[A-Za-z0-9]+/g, "pi_***")
        .replace(/eyJ[A-Za-z0-9\-._~+/]{20,}=*/g, "***JWT***");
}

/**
 * Thin wrapper around console + Sentry.
 * Drop-in replacement for console.error / console.warn:
 *   - Keeps console output for dev (Sentry is disabled in dev)
 *   - Sends to Sentry in production
 *   - Scrubs PII/secrets before Sentry transmission
 */
export const logger = {
    error(...args: unknown[]) {
        console.error(...args);
        const error = args.find((a) => a instanceof Error);
        if (error) {
            const context = scrubPII(
                args.filter((a) => typeof a === "string").join(" ")
            );
            Sentry.captureException(error, { extra: { context } });
        } else {
            Sentry.captureMessage(
                scrubPII(args.map(String).join(" ")),
                "error",
            );
        }
    },
    warn(...args: unknown[]) {
        console.warn(...args);
        // Sample warnings at 20% to reduce Sentry noise/cost
        if (Math.random() < 0.2) {
            Sentry.captureMessage(
                scrubPII(args.map(String).join(" ")),
                "warning",
            );
        }
    },
};
