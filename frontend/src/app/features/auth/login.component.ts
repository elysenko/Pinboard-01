import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly error = signal<string | null>(null);
  readonly pending = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Exchanges credentials for a JWT via POST /api/auth/login. */
  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a valid email address and your password.');
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.pending.set(true);
    try {
      const result = await this.auth.login(email, password);
      if (!result.ok) this.error.set(result.error ?? 'Could not sign you in.');
    } finally {
      this.pending.set(false);
    }
  }

  /** Signs in as the seeded admin account — a real session, not a local stub. */
  async skipLogin(): Promise<void> {
    this.error.set(null);
    this.pending.set(true);
    try {
      const result = await this.auth.demoLogin();
      if (!result.ok) this.error.set(result.error ?? 'Demo Mode is unavailable.');
    } finally {
      this.pending.set(false);
    }
  }
}
