import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/http-errors';
import { Pin } from '../../core/pin.model';
import { PinsService } from '../../core/pins.service';
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
  private readonly pinsService = inject(PinsService);

  /** Bound from the `:id` route parameter by `withComponentInputBinding()`. */
  readonly id = input<string>('');

  /** Null renders the "Pin not found" state — what a 404 from the API produces. */
  readonly pin = signal<Pin | null>(null);
  readonly fetching = signal(true);
  readonly error = signal<ApiError | null>(null);

  constructor() {
    // Re-fetches whenever the route id changes, so navigating between two share
    // links without leaving the route still shows the right pin.
    effect(() => {
      const id = this.id();
      void this.fetch(id);
    });
  }

  private async fetch(id: string): Promise<void> {
    if (!id) {
      this.pin.set(null);
      this.fetching.set(false);
      return;
    }
    this.fetching.set(true);
    this.error.set(null);
    try {
      // Resolves null on a 404 — a deleted or mistyped id is an expected outcome
      // here, not a failure, so it renders the not-found state rather than an error.
      this.pin.set(await this.pinsService.get(id));
    } catch (error) {
      this.pin.set(null);
      this.error.set(error as ApiError);
    } finally {
      this.fetching.set(false);
    }
  }

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
