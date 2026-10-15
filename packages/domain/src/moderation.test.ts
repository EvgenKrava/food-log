import { describe, expect, it } from 'vitest';
import {
  applyModeration,
  deletionMode,
  initialModerationState,
  isInModerationQueue,
  isPublic,
  type ModerationState,
} from './moderation.ts';

type Content = { name: string };
const live: Content = { name: 'Йогурт' };
const changed: Content = { name: 'Йогурт персик' };
const AT = '2026-10-15T10:00:00.000Z';

const state = (s: ModerationState<Content>): ModerationState<Content> => s;

describe('initialModerationState', () => {
  it('submits published items and keeps others private', () => {
    expect(initialModerationState<Content>(true, AT)).toEqual({
      status: 'pending',
      submittedAt: AT,
    });
    expect(initialModerationState<Content>(false, AT)).toEqual({ status: 'private' });
  });
});

describe('applyModeration — author events', () => {
  it('publishes a private item', () => {
    expect(
      applyModeration(state({ status: 'private' }), live, { type: 'publish', at: AT }, 'author'),
    ).toEqual({
      ok: true,
      state: { status: 'pending', submittedAt: AT },
      content: live,
      reindex: false,
    });
  });

  it('republishes a rejected item and clears the reason', () => {
    const result = applyModeration(
      state({ status: 'rejected', rejectReason: 'Wrong kcal' }),
      live,
      { type: 'publish', at: AT },
      'author',
    );
    expect(result).toEqual({
      ok: true,
      state: { status: 'pending', submittedAt: AT },
      content: live,
      reindex: false,
    });
  });

  it('refuses to publish an approved item', () => {
    expect(
      applyModeration(state({ status: 'approved' }), live, { type: 'publish', at: AT }, 'author'),
    ).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it('unpublishes a pending item back to private', () => {
    expect(
      applyModeration(
        state({ status: 'pending', submittedAt: AT }),
        live,
        { type: 'unpublish' },
        'author',
      ),
    ).toEqual({ ok: true, state: { status: 'private' }, content: live, reindex: false });
  });

  it('refuses to unpublish an approved item', () => {
    expect(
      applyModeration(state({ status: 'approved' }), live, { type: 'unpublish' }, 'author'),
    ).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it.each(['private', 'pending'] as const)('edits a %s item in place', (status) => {
    const result = applyModeration(
      state({ status }),
      live,
      { type: 'edit', changes: changed, at: AT },
      'author',
    );
    expect(result).toEqual({ ok: true, state: { status }, content: changed, reindex: false });
  });

  it('keeps the reject reason when editing a rejected item', () => {
    const result = applyModeration(
      state({ status: 'rejected', rejectReason: 'Wrong kcal' }),
      live,
      { type: 'edit', changes: changed, at: AT },
      'author',
    );
    expect(result).toEqual({
      ok: true,
      state: { status: 'rejected', rejectReason: 'Wrong kcal' },
      content: changed,
      reindex: false,
    });
  });

  it('stores an edit of an approved item as a pending revision', () => {
    const result = applyModeration(
      state({ status: 'approved', rejectReason: 'Earlier revision rejected' }),
      live,
      { type: 'edit', changes: changed, at: AT },
      'author',
    );
    expect(result).toEqual({
      ok: true,
      state: { status: 'approved', pendingRevision: changed, submittedAt: AT },
      content: live,
      reindex: false,
    });
  });

  it('refuses to edit a hidden item', () => {
    expect(
      applyModeration(
        state({ status: 'hidden' }),
        live,
        { type: 'edit', changes: changed, at: AT },
        'author',
      ),
    ).toMatchObject({ ok: false, code: 'CONFLICT' });
  });
});

describe('applyModeration — admin events', () => {
  it('approves a pending item and requests a reindex', () => {
    expect(
      applyModeration(
        state({ status: 'pending', submittedAt: AT }),
        live,
        { type: 'approve' },
        'admin',
      ),
    ).toEqual({ ok: true, state: { status: 'approved' }, content: live, reindex: true });
  });

  it('approves a pending revision by merging it into the live content', () => {
    expect(
      applyModeration(
        state({ status: 'approved', pendingRevision: changed, submittedAt: AT }),
        live,
        { type: 'approve' },
        'admin',
      ),
    ).toEqual({ ok: true, state: { status: 'approved' }, content: changed, reindex: true });
  });

  it('refuses to approve a private item', () => {
    expect(
      applyModeration(state({ status: 'private' }), live, { type: 'approve' }, 'admin'),
    ).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it('rejects a pending item with a reason', () => {
    expect(
      applyModeration(
        state({ status: 'pending', submittedAt: AT }),
        live,
        { type: 'reject', reason: 'Wrong kcal' },
        'admin',
      ),
    ).toEqual({
      ok: true,
      state: { status: 'rejected', rejectReason: 'Wrong kcal' },
      content: live,
      reindex: false,
    });
  });

  it('rejects a pending revision but keeps the item approved', () => {
    expect(
      applyModeration(
        state({ status: 'approved', pendingRevision: changed, submittedAt: AT }),
        live,
        { type: 'reject', reason: 'Wrong kcal' },
        'admin',
      ),
    ).toEqual({
      ok: true,
      state: { status: 'approved', rejectReason: 'Wrong kcal' },
      content: live,
      reindex: false,
    });
  });

  it('refuses to reject an approved item without a revision', () => {
    expect(
      applyModeration(
        state({ status: 'approved' }),
        live,
        { type: 'reject', reason: 'Wrong kcal' },
        'admin',
      ),
    ).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('hides an approved item, dropping any revision', () => {
    expect(
      applyModeration(
        state({ status: 'approved', pendingRevision: changed, submittedAt: AT }),
        live,
        { type: 'hide' },
        'admin',
      ),
    ).toEqual({ ok: true, state: { status: 'hidden' }, content: live, reindex: true });
  });

  it('refuses to hide a pending item', () => {
    expect(
      applyModeration(state({ status: 'pending' }), live, { type: 'hide' }, 'admin'),
    ).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });
});

describe('applyModeration — roles', () => {
  it('forbids authors from admin events and admins from author events', () => {
    expect(
      applyModeration(state({ status: 'pending' }), live, { type: 'approve' }, 'author'),
    ).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    expect(
      applyModeration(state({ status: 'private' }), live, { type: 'publish', at: AT }, 'admin'),
    ).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});

describe('predicates', () => {
  it('queues pending items and approved items with a revision', () => {
    expect(isInModerationQueue({ status: 'pending' })).toBe(true);
    expect(isInModerationQueue({ status: 'approved', pendingRevision: changed })).toBe(true);
    expect(isInModerationQueue({ status: 'approved' })).toBe(false);
    expect(isInModerationQueue({ status: 'rejected' })).toBe(false);
  });

  it('treats only approved items as public', () => {
    expect(isPublic('approved')).toBe(true);
    expect(isPublic('pending')).toBe(false);
    expect(isPublic('hidden')).toBe(false);
  });

  it('anonymizes approved items on deletion and deletes everything else', () => {
    expect(deletionMode('approved')).toBe('anonymize');
    expect(deletionMode('private')).toBe('delete');
    expect(deletionMode('hidden')).toBe('delete');
  });
});
