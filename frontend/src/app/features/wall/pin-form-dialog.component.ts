import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CreatePinDto, PIN_BODY_MAX, PIN_TITLE_MAX, Pin } from '../../core/pin.model';

/** Titles that are only whitespace are rejected as empty, mirroring the API's trim-then-validate. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim().length === 0 ? { blank: true } : null;
}

@Component({
  selector: 'app-pin-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './pin-form-dialog.component.html',
  styleUrl: './pin-form-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PinFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly pin = input<Pin | null>(null);
  readonly save = output<CreatePinDto>();
  readonly cancel = output<void>();

  readonly titleMax = PIN_TITLE_MAX;
  readonly bodyMax = PIN_BODY_MAX;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, notBlank, Validators.maxLength(PIN_TITLE_MAX)]],
    body: ['', [Validators.maxLength(PIN_BODY_MAX)]],
  });

  private readonly titleValue = signal('');
  private readonly bodyValue = signal('');

  readonly titleCount = computed(() => this.titleValue().length);
  readonly bodyCount = computed(() => this.bodyValue().length);
  readonly isEdit = computed(() => this.pin() !== null);

  constructor() {
    this.form.valueChanges.subscribe((v) => {
      this.titleValue.set(v.title ?? '');
      this.bodyValue.set(v.body ?? '');
    });
    // Re-seed the form when the dialog is deep-linked straight onto a different pin.
    effect(() => {
      const pin = this.pin();
      this.form.reset({ title: pin?.title ?? '', body: pin?.body ?? '' });
    });
  }

  ngOnInit(): void {
    const pin = this.pin();
    this.form.reset({ title: pin?.title ?? '', body: pin?.body ?? '' });
  }

  showError(name: 'title' | 'body'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  errorFor(name: 'title' | 'body'): string {
    const errors = this.form.controls[name].errors ?? {};
    if (errors['required'] || errors['blank']) return 'Title is required.';
    if (errors['maxlength']) {
      const max = name === 'title' ? PIN_TITLE_MAX : PIN_BODY_MAX;
      const label = name === 'title' ? 'Title' : 'Body';
      return `${label} must be ${max} characters or fewer.`;
    }
    return 'That value is not valid.';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, body } = this.form.getRawValue();
    this.save.emit({ title: title.trim(), body: body.trim() });
  }
}
