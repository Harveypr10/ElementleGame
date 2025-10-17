export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireLetter: true,
  requireNumber: true,
  requireSpecialChar: true,
};

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  if (PASSWORD_REQUIREMENTS.requireLetter && !/[a-zA-Z]/.test(password)) {
    errors.push('At least one letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('At least one number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('At least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getPasswordRequirementsText(): string {
  return 'Password must be at least 8 characters and include at least one letter, number, and special character.';
}
