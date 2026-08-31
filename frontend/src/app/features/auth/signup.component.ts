import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return !confirm || password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly error = signal<string | null>(null);
  readonly pending = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  /** Registers via POST /api/auth/signup; the first account on an instance is ADMIN. */
  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.hasError('mismatch')) {
      this.error.set('The two passwords do not match.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Fill in every field. Passwords need at least 8 characters.');
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    this.pending.set(true);
    try {
      const result = await this.auth.signup(name, email, password);
      if (!result.ok) this.error.set(result.error ?? 'Could not create your account.');
    } finally {
      this.pending.set(false);
    }
  }

  /** Signs in as the seeded admin account — a real session, not a local stub. */
  async skipSignup(): Promise<void> {
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
