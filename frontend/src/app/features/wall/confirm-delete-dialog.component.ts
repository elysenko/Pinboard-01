import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ApiError } from '../../core/http-errors';
import { Pin } from '../../core/pin.model';

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  templateUrl: './confirm-delete-dialog.component.html',
  styleUrl: './confirm-delete-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDeleteDialogComponent {
  readonly pin = input.required<Pin>();
  /** Set when `DELETE /api/pins/:id` failed, so the dialog can explain itself. */
  readonly serverError = input<ApiError | null>(null);
  /** True while the delete is in flight — blocks a double submit. */
  readonly pending = input(false);
  readonly confirm = output<string>();
  readonly cancel = output<void>();
}
