/**
 * Email provider for magic link authentication.
 *
 * - Resend: primary provider, configured via RESEND_API_KEY
 * - Console: dev-only fallback, logs magic link to stdout
 * - Production without RESEND_API_KEY: API starts, magic link login is disabled
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface EmailProvider {
    sendMagicLink(to: string, token: string, verifyUrl: string): Promise<{ success: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Resend provider
// ---------------------------------------------------------------------------

class ResendEmailProvider implements EmailProvider {
    constructor(
        private apiKey: string,
        private from: string,
    ) { }

    async sendMagicLink(to: string, _token: string, verifyUrl: string): Promise<{ success: boolean; error?: string }> {
        try {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: this.from,
                    to: [to],
                    subject: "Login to Manga CMS",
                    html: `
                        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                            <h2 style="color: #1a1a1a;">Login to Manga CMS</h2>
                            <p>Click the button below to log in. This link expires in 15 minutes.</p>
                            <a href="${verifyUrl}"
                               style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                               Log In
                            </a>
                            <p style="color: #666; font-size: 14px;">
                                If you didn't request this, you can safely ignore this email.
                            </p>
                            <p style="color: #999; font-size: 12px;">
                                Or copy this URL: ${verifyUrl}
                            </p>
                        </div>
                    `,
                }),
            });

            if (!res.ok) {
                const body = await res.text();
                return { success: false, error: `Resend API error (${res.status}): ${body}` };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    }
}

// ---------------------------------------------------------------------------
// Console fallback (development only)
// ---------------------------------------------------------------------------

class ConsoleEmailProvider implements EmailProvider {
    async sendMagicLink(to: string, token: string, verifyUrl: string): Promise<{ success: boolean; error?: string }> {
        console.log(`\n📧 [DEV] Magic link for ${to}:`);
        console.log(`   ${verifyUrl}`);
        console.log(`   Token: ${token}\n`);
        return { success: true };
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _provider: EmailProvider | null = null;

/**
 * Get the email provider.
 *
 * In production, returns null if RESEND_API_KEY is not set. The API server
 * still starts, but callers must treat magic link login as unavailable.
 * In dev, falls back to ConsoleEmailProvider.
 */
export function getEmailProvider(): EmailProvider | null {
    if (_provider) return _provider;

    const resendKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM ?? "Manga CMS <noreply@example.com>";

    if (resendKey) {
        _provider = new ResendEmailProvider(resendKey, emailFrom);
        console.log("✅ Email provider: Resend");
        return _provider;
    }

    if (IS_PRODUCTION) {
        // Fail closed: no email provider in production
        console.warn("⚠️  No RESEND_API_KEY set — magic link login is disabled in production");
        return null;
    }

    _provider = new ConsoleEmailProvider();
    console.log("📧 Email provider: Console (dev only — set RESEND_API_KEY for real email)");
    return _provider;
}

export function isEmailConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
}
