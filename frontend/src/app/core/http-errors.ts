import { HttpErrorResponse } from '@angular/common/http';

/** A transport-agnostic view of a failed call, shaped for direct display in the UI. */
export interface ApiError {
  /** 0 when the request never reached the server (offline, DNS, CORS). */
  status: number;
  /** One sentence, safe to render verbatim. */
  message: string;
  /** Per-field messages parsed out of a Nest ValidationPipe 400, keyed by control name. */
  fieldErrors: Record<string, string>;
}

const NETWORK_MESSAGE = 'Could not reach the board. Check your connection and try again.';

/** Nest's ValidationPipe emits `"title must be shorter than or equal to 120 characters"`. */
const KNOWN_FIELDS = ['title', 'body', 'email', 'password', 'name', 'key', 'value'];

function extractMessages(body: unknown): string[] {
  if (typeof body === 'string') return [body];
  if (body === null || typeof body !== 'object') return [];
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return [message];
  if (Array.isArray(message)) return message.filter((m): m is string => typeof m === 'string');
  return [];
}

/**
 * Normalises anything HttpClient can throw. Never throws itself: an unusable error
 * body degrades to a generic sentence rather than blanking the screen.
 */
export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, message: NETWORK_MESSAGE, fieldErrors: {} };
  }

  // status 0 means the browser blocked or dropped the request — the server never
  // answered, so `error.error` holds a ProgressEvent, not an API body.
  if (error.status === 0) {
    return { status: 0, message: NETWORK_MESSAGE, fieldErrors: {} };
  }

  const messages = extractMessages(error.error);
  const fieldErrors: Record<string, string> = {};
  for (const message of messages) {
    const field = KNOWN_FIELDS.find((f) => message.startsWith(`${f} `));
    // First message per field wins: validators run in declaration order, so the
    // earliest one is the most specific ("must not be empty" before "must be a string").
    if (field && !fieldErrors[field]) fieldErrors[field] = sentence(message);
  }

  return {
    status: error.status,
    message: sentence(messages[0] ?? defaultMessage(error.status)),
    fieldErrors,
  };
}

function defaultMessage(status: number): string {
  if (status === 404) return 'That item no longer exists.';
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You do not have access to this.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return 'The request could not be completed.';
}

/** Capitalises and full-stops a raw validator string so it reads as UI copy. */
function sentence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'The request could not be completed.';
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}
