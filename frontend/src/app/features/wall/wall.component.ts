import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/http-errors';
import { CreatePinDto, Pin } from '../../core/pin.model';
import { PinsService } from '../../core/pins.service';
import { formatRelative } from '../../core/time';
import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog.component';
import { PinFormDialogComponent } from './pin-form-dialog.component';

type ViewState = 'ready' | 'loading' | 'empty' | 'error';
type ModalKind = 'new' | 'edit' | 'delete';

@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [RouterLink, PinFormDialogComponent, ConfirmDeleteDialogComponent],
  templateUrl: './wall.component.html',
  styleUrl: './wall.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WallComponent {
  private readonly router = inject(Router);
  private readonly pinsService = inject(PinsService);

  /** Bound from query params by `withComponentInputBinding()`, so every dialog is deep-linkable. */
  readonly modal = input<string | undefined>(undefined);
  readonly pinId = input<string | undefined>(undefined);
  readonly state = input<string | undefined>(undefined);

  /** Live rows from `GET /api/pins`, already ordered newest-first by the service. */
  readonly sortedPins = this.pinsService.pins;

  /** Set while a dialog's save/delete is in flight; cleared on success. */
  readonly dialogError = signal<ApiError | null>(null);
  readonly saving = signal(false);

  constructor() {
    // Forced, so returning to the wall always re-reads the board. The store is
    // already populated by then, so this refreshes in the background without
    // dropping the grid back to skeletons.
    void this.pinsService.load(true);
    // A dialog opened for a different pin (or closed) starts from a clean slate,
    // so a validation message from a previous save is never shown against a new one.
    effect(() => {
      this.modal();
      this.pinId();
      this.dialogError.set(null);
    });
  }

  readonly viewState = computed<ViewState>(() => {
    // The footer links force a state so each variant stays reviewable on a live board.
    const requested = this.state();
    if (requested === 'loading' || requested === 'empty' || requested === 'error') {
      return requested;
    }
    // Only the *first* load shows skeletons; a background refresh keeps the wall up.
    if (!this.pinsService.loaded()) {
      return this.pinsService.error() !== null ? 'error' : 'loading';
    }
    return this.sortedPins().length === 0 ? 'empty' : 'ready';
  });

  readonly activeModal = computed<ModalKind | null>(() => {
    const kind = this.modal();
    if (kind === 'new') return 'new';
    if ((kind === 'edit' || kind === 'delete') && this.targetPin()) return kind;
    return null;
  });

  readonly targetPin = computed<Pin | null>(() => {
    const id = this.pinId();
    return id ? (this.sortedPins().find((p) => p.id === id) ?? null) : null;
  });

  readonly skeletons = [0, 1, 2, 3, 4, 5];

  relative(iso: string): string {
    return formatRelative(iso);
  }

  /** The error state's "Try again" link re-runs the fetch it failed on. */
  retry(): void {
    void this.pinsService.load(true);
  }

  async saveFromDialog(dto: CreatePinDto): Promise<void> {
    const target = this.activeModal() === 'edit' ? this.targetPin() : null;
    this.saving.set(true);
    this.dialogError.set(null);
    try {
      if (target) await this.pinsService.update(target.id, dto);
      else await this.pinsService.create(dto);
      this.closeDialog();
    } catch (error) {
      // Stays open with the server's message so the typed note is never lost.
      this.dialogError.set(error as ApiError);
    } finally {
      this.saving.set(false);
    }
  }

  async deletePin(id: string): Promise<void> {
    this.saving.set(true);
    this.dialogError.set(null);
    try {
      await this.pinsService.remove(id);
      this.closeDialog();
    } catch (error) {
      this.dialogError.set(error as ApiError);
    } finally {
      this.saving.set(false);
    }
  }

  /** Every dismissal clears the query params so /wall is the single resting URL. */
  closeDialog(): void {
    void this.router.navigate(['/wall'], { queryParams: {} });
  }
}
