/**
 * src/utils/passkey.js
 * WebAuthn passkey utilities.
 * Automatically uses 'localhost' as RP ID when running on localhost.
 */

// ── Helpers ───────────────────────────────────────────────────────

function b64urlToBuffer(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

function bufferToB64url(buf) {
    const bytes = new Uint8Array(buf);
    let str = '';
    bytes.forEach(b => (str += String.fromCharCode(b)));
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Localhost detection ───────────────────────────────────────────

function isLocalhost() {
    return (
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.hostname === '::1'
    );
}

/**
 * Override rpId & related options for localhost development.
 * On production (mansuke.jp) challenge data from the CF is used as-is.
 */
function resolveRpId(challengeData) {
    if (isLocalhost()) return 'localhost';
    return challengeData.rpId || challengeData.rp?.id || 'mansuke.jp';
}

// ── registerPasskey ───────────────────────────────────────────────

export async function registerPasskey(challengeData) {
    const rpId = resolveRpId(challengeData);

    const publicKey = {
        challenge: b64urlToBuffer(challengeData.challenge),
        rp: {
            name: challengeData.rp?.name || 'MANSUKEアカウント',
            id: rpId,
        },
        user: {
            id: b64urlToBuffer(challengeData.userId),
            name: challengeData.userName,
            displayName: challengeData.displayName,
        },
        pubKeyCredParams: challengeData.pubKeyCredParams || [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: challengeData.authenticatorSelection || {
            residentKey: 'required',
            userVerification: 'required',
        },
        attestation: 'none',
        timeout: challengeData.timeout || 60000,
        excludeCredentials: (challengeData.excludeCredentials || []).map(c => ({
            ...c,
            id: b64urlToBuffer(c.id),
        })),
    };

    const credential = await navigator.credentials.create({ publicKey });

    return {
        id: credential.id,
        rawId: bufferToB64url(credential.rawId),
        type: credential.type,
        response: {
            attestationObject: bufferToB64url(credential.response.attestationObject),
            clientDataJSON: bufferToB64url(credential.response.clientDataJSON),
        },
    };
}

// ── authenticatePasskey ───────────────────────────────────────────

export async function authenticatePasskey(challengeData) {
    const rpId = resolveRpId(challengeData);

    const publicKey = {
        challenge: b64urlToBuffer(challengeData.challenge),
        rpId,
        userVerification: 'required',
        timeout: challengeData.timeout || 60000,
        allowCredentials: (challengeData.allowCredentials || []).map(c => ({
            ...c,
            id: b64urlToBuffer(c.id),
        })),
    };

    const assertion = await navigator.credentials.get({ publicKey });

    return {
        id: assertion.id,
        rawId: bufferToB64url(assertion.rawId),
        type: assertion.type,
        response: {
            authenticatorData: bufferToB64url(assertion.response.authenticatorData),
            clientDataJSON: bufferToB64url(assertion.response.clientDataJSON),
            signature: bufferToB64url(assertion.response.signature),
            userHandle: assertion.response.userHandle
                ? bufferToB64url(assertion.response.userHandle)
                : null,
        },
    };
}

// ── isWebAuthnAvailable (sync, basic API check) ─────────────────────

export function isWebAuthnAvailable() {
    return (
        typeof window !== 'undefined' &&
        !!window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
}

// ── isPasskeySupported (async, real availability check) ──────────────

export async function isPasskeySupported() {
    if (
        typeof window === 'undefined' ||
        !window.PublicKeyCredential
    ) return false;
    try {
        // Check if a platform authenticator (Touch ID, Face ID, etc.) is available
        const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (platformAvailable) return true;

        // Even if no platform authenticator, the browser may support
        // cross-platform authenticators (security keys, etc.)
        // In that case WebAuthn is still usable
        if (typeof PublicKeyCredential.isConditionalMediationAvailable === 'function') {
            return true; // Modern browser with passkey support
        }

        // Fallback: WebAuthn API exists, allow attempt
        return true;
    } catch {
        return false;
    }
}

// ── getPasskeyErrorMessage ───────────────────────────────────────────

export function getPasskeyErrorMessage(err) {
    if (!err) return 'パスキー操作に失敗しました';

    // User cancelled
    if (err.name === 'NotAllowedError' || err.message?.includes('cancel')) {
        return null; // null = user cancelled, no error to show
    }

    // No authenticator available
    if (err.name === 'NotSupportedError') {
        return 'このデバイスはパスキーに対応していません。別のデバイスまたはブラウザをお試しください。';
    }

    // Security context issue
    if (err.name === 'SecurityError') {
        return 'セキュリティエラーが発生しました。HTTPS接続を確認してください。';
    }

    // Timeout
    if (err.name === 'AbortError') {
        return 'パスキー操作がタイムアウトしました。もう一度お試しください。';
    }

    // Invalid state (e.g., credential already registered)
    if (err.name === 'InvalidStateError') {
        return 'このパスキーはすでに登録されています。';
    }

    // Cloud function errors
    if (err.code === 'functions/not-found') {
        return 'チャレンジが見つかりません。再度お試しください。';
    }

    return err.message || 'パスキー操作に失敗しました';
}
