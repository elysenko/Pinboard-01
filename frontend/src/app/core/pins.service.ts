import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { ApiError, toApiError } from './http-errors';
import { CreatePinDto, Pin, UpdatePinDto } from './pin.model';

/** Newest first, `id` descending as a tiebreaker — identical to the API's ordering. */
export function sortPins(pins: readonly Pin[]): Pin[] {
  return [...pins].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
  );
}

/**
 * The live pin store, backed by `GET/POST/PATCH/DELETE /api/pins`.
 *
 * Held at root scope so the wall, the detail route and the dialogs all read one
 * array: deleting a pin on the wall is immediately reflected anywhere else it is
 * rendered, without a second round trip.
 */
@Injectable({ providedIn: 'root' })
export class PinsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/pins`;

  private readonly store = signal<Pin[]>([]);
  private readonly inFlight = signal(0);

  /** Always sorted, so consumers never have to re-sort. */
  readonly pins = computed(() => sortPins(this.store()));
  readonly loading = computed(() => this.inFlight() > 0);
  readonly error = signal<ApiError | null>(null);
  /** False until the first list response lands, so "empty" is never shown pre-fetch. */
  readonly loaded = signal(false);

  /**
   * Fetches the wall. Repeat calls are cheap no-ops once loaded unless `force` is
   * set, so navigating wall -> detail -> wall does not refetch on every hop.
   */
  async load(force = false): Promise<void> {
    if (this.loaded() && !force) return;
    this.inFlight.update((n) => n + 1);
    try {
      const pins = await firstValueFrom(this.http.get<Pin[]>(this.url));
      this.store.set(pins);
      this.error.set(null);
      this.loaded.set(true);
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.inFlight.update((n) => n - 1);
    }
  }

  /** Resolves `null` for a 404 so the detail view can render its not-found state. */
  async get(id: string): Promise<Pin | null> {
    this.inFlight.update((n) => n + 1);
    try {
      const pin = await firstValueFrom(this.http.get<Pin>(`${this.url}/${encodeURIComponent(id)}`));
      this.upsertLocal(pin);
      this.error.set(null);
      return pin;
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 404) {
        this.removeLocal(id);
        this.error.set(null);
        return null;
      }
      this.error.set(apiError);
      throw apiError;
    } finally {
      this.inFlight.update((n) => n - 1);
    }
  }

  /**
   * Creates a pin and splices the server's row into the store, so the new note is on
   * the wall the moment the dialog closes without waiting for a second GET.
   * Rejects with an ApiError carrying `fieldErrors` when the server returns a 400.
   */
  async create(dto: CreatePinDto): Promise<Pin> {
    return this.mutate(() => this.http.post<Pin>(this.url, dto));
  }

  async update(id: string, dto: UpdatePinDto): Promise<Pin> {
    return this.mutate(() => this.http.patch<Pin>(`${this.url}/${encodeURIComponent(id)}`, dto));
  }

  async remove(id: string): Promise<void> {
    this.inFlight.update((n) => n + 1);
    try {
      await firstValueFrom(this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`));
      this.removeLocal(id);
      this.error.set(null);
    } catch (error) {
      const apiError = toApiError(error);
      // Already gone is the outcome the caller wanted — treat it as success and
      // reconcile the local copy rather than showing an error for a no-op.
      if (apiError.status === 404) {
        this.removeLocal(id);
        return;
      }
      throw apiError;
    } finally {
      this.inFlight.update((n) => n - 1);
    }
  }

  private async mutate(call: () => Observable<Pin>): Promise<Pin> {
    this.inFlight.update((n) => n + 1);
    try {
      const pin = await firstValueFrom(call());
      this.upsertLocal(pin);
      this.error.set(null);
      return pin;
    } catch (error) {
      throw toApiError(error);
    } finally {
      this.inFlight.update((n) => n - 1);
    }
  }

  private upsertLocal(pin: Pin): void {
    this.store.update((pins) => {
      const index = pins.findIndex((p) => p.id === pin.id);
      if (index === -1) return [pin, ...pins];
      const next = [...pins];
      next[index] = pin;
      return next;
    });
  }

  private removeLocal(id: string): void {
    this.store.update((pins) => pins.filter((p) => p.id !== id));
  }
}
