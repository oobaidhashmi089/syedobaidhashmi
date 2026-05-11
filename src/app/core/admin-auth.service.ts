import { Injectable } from '@angular/core';

const SESSION_KEY = 'ats-studio-admin-session';

/**
 * Client-side gate for the resume editor. Not secure against determined attackers;
 * suitable for casual privacy only.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly adminEmail = 'syedhashmi089@gmail.com';
  private readonly adminPassword = '@Syedhashmi089@';

  isAuthenticated(): boolean {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }

  login(email: string, password: string): boolean {
    const ok =
      email.trim().toLowerCase() === this.adminEmail.toLowerCase() &&
      password === this.adminPassword;
    if (ok) {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    return ok;
  }

  logout(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}
