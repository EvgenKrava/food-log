import type { ModerationStatus } from '@foodlog/contracts';

export type ModerationActor = 'author' | 'admin';

export type ModerationState<C> = {
  status: ModerationStatus;
  rejectReason?: string;
  pendingRevision?: C;
  submittedAt?: string;
};

export type ModerationEvent<C> =
  | { type: 'publish'; at: string }
  | { type: 'unpublish' }
  | { type: 'edit'; changes: C; at: string }
  | { type: 'approve' }
  | { type: 'reject'; reason: string }
  | { type: 'hide' };

export type ModerationResult<C> =
  | { ok: true; state: ModerationState<C>; content: C; reindex: boolean }
  | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string };

const ADMIN_EVENTS: ReadonlySet<ModerationEvent<unknown>['type']> = new Set([
  'approve',
  'reject',
  'hide',
]);

export function initialModerationState<C>(publish: boolean, at: string): ModerationState<C> {
  return publish ? { status: 'pending', submittedAt: at } : { status: 'private' };
}

export function applyModeration<C>(
  state: ModerationState<C>,
  content: C,
  event: ModerationEvent<C>,
  actor: ModerationActor,
): ModerationResult<C> {
  if (ADMIN_EVENTS.has(event.type) !== (actor === 'admin')) {
    return { ok: false, code: 'FORBIDDEN', message: `${event.type} is not allowed for ${actor}` };
  }
  const { status, pendingRevision } = state;
  const hasRevision = pendingRevision !== undefined;
  const conflict: ModerationResult<C> = {
    ok: false,
    code: 'CONFLICT',
    message: `cannot ${event.type} an item in status ${status}${hasRevision ? ' with a pending revision' : ''}`,
  };

  switch (event.type) {
    case 'publish':
      if (status !== 'private' && status !== 'rejected') return conflict;
      return {
        ok: true,
        state: { status: 'pending', submittedAt: event.at },
        content,
        reindex: false,
      };
    case 'unpublish':
      if (status !== 'pending') return conflict;
      return { ok: true, state: { status: 'private' }, content, reindex: false };
    case 'edit':
      if (status === 'hidden') return conflict;
      if (status === 'approved') {
        return {
          ok: true,
          state: { status: 'approved', pendingRevision: event.changes, submittedAt: event.at },
          content,
          reindex: false,
        };
      }
      return { ok: true, state, content: event.changes, reindex: false };
    case 'approve':
      if (status === 'pending') {
        return { ok: true, state: { status: 'approved' }, content, reindex: true };
      }
      if (status === 'approved' && pendingRevision !== undefined) {
        return { ok: true, state: { status: 'approved' }, content: pendingRevision, reindex: true };
      }
      return conflict;
    case 'reject':
      if (status === 'pending') {
        return {
          ok: true,
          state: { status: 'rejected', rejectReason: event.reason },
          content,
          reindex: false,
        };
      }
      if (status === 'approved' && hasRevision) {
        return {
          ok: true,
          state: { status: 'approved', rejectReason: event.reason },
          content,
          reindex: false,
        };
      }
      return conflict;
    case 'hide':
      if (status !== 'approved') return conflict;
      return { ok: true, state: { status: 'hidden' }, content, reindex: true };
  }
}

export function isInModerationQueue(state: ModerationState<unknown>): boolean {
  return state.status === 'pending' || state.pendingRevision !== undefined;
}

export function isPublic(status: ModerationStatus): boolean {
  return status === 'approved';
}

export function deletionMode(status: ModerationStatus): 'anonymize' | 'delete' {
  return status === 'approved' ? 'anonymize' : 'delete';
}
