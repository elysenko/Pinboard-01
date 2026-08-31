import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
  readonly confirm = output<string>();
  readonly cancel = output<void>();
}
