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

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Resolved entirely in the browser — no network call, so this never hangs or 500s. */
  submit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a valid email address and your password.');
      return;
    }
    const { email, password } = this.form.getRawValue();
    const result = this.auth.login(email, password);
    if (!result.ok) this.error.set(result.error ?? 'Could not sign you in.');
  }

  skipLogin(): void {
    this.auth.demoLogin();
  }
}
