import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CreatePinDto, Pin } from '../../core/pin.model';
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

  /** Bound from query params by `withComponentInputBinding()`, so every dialog is deep-linkable. */
  readonly modal = input<string | undefined>(undefined);
  readonly pinId = input<string | undefined>(undefined);
  readonly state = input<string | undefined>(undefined);

  readonly pins = signal<Pin[]>([
    {
      id: '9a5f6b1c-0d2e-4a7b-8c31-5d6e7f801a2b',
      title: 'Q3 Roadmap Draft',
      body: 'Lock the three headline bets before the planning review on Friday.',
      createdAt: '2026-08-30T09:12:00.000Z',
      updatedAt: '2026-08-30T09:12:00.000Z',
    },
    {
      id: '3c8d4e5f-6a7b-48c9-9d0e-1f2a3b4c5d6e',
      title: 'Migration Checklist',
      body: 'Snapshot the database, run the dry run, then cut over during the quiet window.',
      createdAt: '2026-08-29T16:40:00.000Z',
      updatedAt: '2026-08-29T16:40:00.000Z',
    },
    {
      id: '7e1a2b3c-4d5e-4f60-a1b2-c3d4e5f60718',
      title: 'Rooftop Garden Plan',
      body: 'Six planters along the south wall, herbs first, watering rota on the fridge.',
      createdAt: '2026-08-28T11:05:00.000Z',
      updatedAt: '2026-08-28T11:05:00.000Z',
    },
    {
      id: 'b2c3d4e5-f607-4819-a2b3-c4d5e6f70819',
      title: 'Standup notes — Tuesday',
      body: 'Search indexing is unblocked; billing still waiting on the sandbox key.',
      createdAt: '2026-08-27T08:30:00.000Z',
      updatedAt: '2026-08-27T08:30:00.000Z',
    },
    {
      id: 'c4d5e6f7-0819-4a2b-b3c4-d5e6f708192a',
      title: 'Books to reread',
      body: 'Design of Everyday Things, Thinking in Systems, and the short Calvino one.',
      createdAt: '2026-08-25T19:02:00.000Z',
      updatedAt: '2026-08-25T19:02:00.000Z',
    },
    {
      id: 'd6e7f809-1a2b-4c3d-8e4f-5061728394ab',
      title: 'Office move — week 1',
      body: 'Label every crate by team, and keep the good monitor arms out of storage.',
      createdAt: '2026-08-24T13:47:00.000Z',
      updatedAt: '2026-08-24T13:47:00.000Z',
    },
  ]);

  /** Newest first, with id as a deterministic tiebreaker — mirrors the API's ordering. */
  readonly sortedPins = computed(() =>
    [...this.pins()].sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        b.id.localeCompare(a.id),
    ),
  );

  readonly viewState = computed<ViewState>(() => {
    const requested = this.state();
    if (requested === 'loading' || requested === 'empty' || requested === 'error') {
      return requested;
    }
    return this.pins().length === 0 ? 'empty' : 'ready';
  });

  readonly activeModal = computed<ModalKind | null>(() => {
    const kind = this.modal();
    if (kind === 'new') return 'new';
    if ((kind === 'edit' || kind === 'delete') && this.targetPin()) return kind;
    return null;
  });

  readonly targetPin = computed<Pin | null>(() => {
    const id = this.pinId();
    return id ? (this.pins().find((p) => p.id === id) ?? null) : null;
  });

  readonly skeletons = [0, 1, 2, 3, 4, 5];

  relative(iso: string): string {
    return formatRelative(iso);
  }

  createPin(dto: CreatePinDto): void {
    const now = new Date().toISOString();
    this.pins.update((pins) => [
      {
        id: `pin-${pins.length + 1}-${now}`,
        title: dto.title,
        body: dto.body ?? '',
        createdAt: now,
        updatedAt: now,
      },
      ...pins,
    ]);
    this.closeDialog();
  }

  updatePin(id: string, dto: CreatePinDto): void {
    const now = new Date().toISOString();
    this.pins.update((pins) =>
      pins.map((p) =>
        p.id === id ? { ...p, title: dto.title, body: dto.body ?? '', updatedAt: now } : p,
      ),
    );
    this.closeDialog();
  }

  deletePin(id: string): void {
    this.pins.update((pins) => pins.filter((p) => p.id !== id));
    this.closeDialog();
  }

  saveFromDialog(dto: CreatePinDto): void {
    const target = this.targetPin();
    if (this.activeModal() === 'edit' && target) this.updatePin(target.id, dto);
    else this.createPin(dto);
  }

  /** Every dismissal clears the query params so /wall is the single resting URL. */
  closeDialog(): void {
    void this.router.navigate(['/wall'], { queryParams: {} });
  }
}
