// ── Password Validator ────────────────────────────────────────────────
// Policy: 8–32 chars, must include at least one lowercase letter and one digit

export function validatePassword(pw) {
    const errors = [];
    if (!pw || pw.length < 8) errors.push('8文字以上で入力してください');
    if (pw && pw.length > 32) errors.push('32文字以内で入力してください');
    if (pw && !/[a-z]/.test(pw)) errors.push('小文字アルファベットを1文字以上含めてください');
    if (pw && !/[0-9]/.test(pw)) errors.push('数字を1文字以上含めてください');
    return errors;
}

export function isPasswordValid(pw) {
    return validatePassword(pw).length === 0;
}

// ── Nickname Validator ────────────────────────────────────────────────
// Policy: 1–10 characters

export function validateNickname(name) {
    const errors = [];
    if (!name || name.trim().length === 0) errors.push('ニックネームを入力してください');
    if (name && name.trim().length > 10) errors.push('10文字以内で入力してください');
    return errors;
}

export function isNicknameValid(name) {
    return validateNickname(name).length === 0;
}

// ── Email Validator ───────────────────────────────────────────────────

export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !re.test(email)) return ['有効なメールアドレスを入力してください'];
    return [];
}

export function isEmailValid(email) {
    return validateEmail(email).length === 0;
}

// ── Phone Validator ───────────────────────────────────────────────────

export function validatePhone(phone) {
    // Accept formats like 090-1234-5678 or +81901234567 etc.
    const cleaned = phone?.replace(/[\s\-().]/g, '');
    if (!cleaned || cleaned.length < 10) return ['有効な電話番号を入力してください'];
    return [];
}

export function isPhoneValid(phone) {
    return validatePhone(phone).length === 0;
}

// ── Birthday Validator ────────────────────────────────────────────────

export function validateBirthday({ year, month, day }) {
    if (!year || !month || !day) return ['生年月日を入力してください'];
    const d = new Date(year, month - 1, day);
    if (
        d.getFullYear() !== Number(year) ||
        d.getMonth() + 1 !== Number(month) ||
        d.getDate() !== Number(day)
    ) {
        return ['有効な日付を入力してください'];
    }
    return [];
}
