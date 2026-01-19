export interface PasswordValidation {
    valid: boolean;
    errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push("At least 8 characters");
    }

    if (!/[a-zA-Z]/.test(password)) {
        errors.push("At least one letter");
    }

    if (!/[0-9]/.test(password)) {
        errors.push("At least one number");
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
        errors.push("At least one special character");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

export function getPasswordRequirementsText(): string {
    return "At least 8 characters including 1 letter, 1 number, and 1 special character";
}
