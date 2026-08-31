import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pin } from '../../core/pin.model';
import { formatAbsolute, formatRelative } from '../../core/time';

@Component({
  selector: 'app-pin-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pin-detail.component.html',
  styleUrl: './pin-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PinDetailComponent {
  /** Bound from the `:id` route parameter by `withComponentInputBinding()`. */
  readonly id = input<string>('');

  readonly pins = signal<Pin[]>([
    {
      id: '9a5f6b1c-0d2e-4a7b-8c31-5d6e7f801a2b',
      title: 'Q3 Roadmap Draft',
      body: 'Lock the three headline bets before the planning review on Friday. Everything else moves to the parking lot until the quarter opens, and the pricing experiment only ships if the billing sandbox is stable by the 12th.',
      createdAt: '2026-08-30T09:12:00.000Z',
      updatedAt: '2026-08-30T09:12:00.000Z',
    },
    {
      id: '3c8d4e5f-6a7b-48c9-9d0e-1f2a3b4c5d6e',
      title: 'Migration Checklist',
      body: 'Snapshot the database, run the dry run, then cut over during the quiet window. Keep the old read replica warm for a week in case anything needs to be replayed.',
      createdAt: '2026-08-29T16:40:00.000Z',
      updatedAt: '2026-08-29T18:02:00.000Z',
    },
    {
      id: '7e1a2b3c-4d5e-4f60-a1b2-c3d4e5f60718',
      title: 'Rooftop Garden Plan',
      body: 'Six planters along the south wall, herbs first, watering rota on the fridge. Tomatoes only once we know how much shade the stairwell throws in the afternoon.',
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

  /** Null renders the "Pin not found" state — the same shape a 404 from the API produces. */
  readonly pin = computed<Pin | null>(
    () => this.pins().find((p) => p.id === this.id()) ?? null,
  );

  readonly wasEdited = computed(() => {
    const pin = this.pin();
    return pin !== null && pin.updatedAt !== pin.createdAt;
  });

  absolute(iso: string): string {
    return formatAbsolute(iso);
  }

  relative(iso: string): string {
    return formatRelative(iso);
  }
}
