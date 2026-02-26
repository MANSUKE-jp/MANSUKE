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

// ── isPasskeySupported ────────────────────────────────────────────

export function isPasskeySupported() {
    return (
        typeof window !== 'undefined' &&
        !!window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
}
