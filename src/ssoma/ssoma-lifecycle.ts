import {
  SsomaAttendanceStatus,
  SsomaTalkStatus,
} from 'src/generated/prisma';

export const ssomaTalkStatuses = Object.values(SsomaTalkStatus);

export type SsomaTalkTransition = Readonly<{
  action: 'start' | 'open' | 'annul';
  from: SsomaTalkStatus;
  to: SsomaTalkStatus;
}>;

/** Only transitions represented by the Phase 2 lifecycle are exposed. */
export const ssomaTalkTransitions: readonly SsomaTalkTransition[] = [
  { action: 'start', from: SsomaTalkStatus.draft, to: SsomaTalkStatus.inProgress },
  { action: 'open', from: SsomaTalkStatus.inProgress, to: SsomaTalkStatus.open },
  { action: 'annul', from: SsomaTalkStatus.draft, to: SsomaTalkStatus.annulled },
  { action: 'annul', from: SsomaTalkStatus.inProgress, to: SsomaTalkStatus.annulled },
  { action: 'annul', from: SsomaTalkStatus.open, to: SsomaTalkStatus.annulled },
];

export function getSsomaTalkTransition(
  action: SsomaTalkTransition['action'],
  from: SsomaTalkStatus,
): SsomaTalkTransition | undefined {
  return ssomaTalkTransitions.find(
    (transition) => transition.action === action && transition.from === from,
  );
}

export const ssomaAttendanceStatuses = Object.values(SsomaAttendanceStatus);
