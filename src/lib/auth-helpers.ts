import type { AuthError } from '@supabase/supabase-js';

export const MIN_PASSWORD_LENGTH = 8;

/** Returns a problem with the password, or null if it is good enough. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use both letters and numbers.';
  return null;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Turns Supabase auth errors into plain messages. */
export function authMessage(error: AuthError | Error | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.';
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) return 'That email or password is not right.';
  if (message.includes('email not confirmed')) return 'Please confirm your email first. We sent you a code.';
  if (message.includes('already registered') || message.includes('already been registered'))
    return 'An account with this email already exists. Try signing in.';
  if (message.includes('token has expired') || message.includes('otp_expired') || message.includes('invalid'))
    return 'That code is wrong or has expired. Ask for a new one.';
  if (message.includes('email rate limit'))
    return 'We have sent too many emails for now. Please try again in about an hour.';
  if (message.includes('rate limit') || message.includes('too many'))
    return 'Too many tries. Please wait a few minutes and try again.';
  if (message.includes('should be different')) return 'Pick a password you have not used before.';
  if (message.includes('weak') || message.includes('password should'))
    return `Pick a stronger password: at least ${MIN_PASSWORD_LENGTH} characters with letters and numbers.`;
  if (message.includes('network') || message.includes('fetch')) return 'No connection. Check your internet and try again.';
  return error.message;
}
