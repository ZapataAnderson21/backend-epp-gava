import {
  SsomaAttendanceStatus,
  SsomaTalkStatus,
} from 'src/generated/prisma';

export const ssomaTalkStatuses = Object.values(SsomaTalkStatus);

export type SsomaTalkTransition = Readonly<{
  from: SsomaTalkStatus;
  to: SsomaTalkStatus;
}>;

/** State pairs are typed against the Phase 2 Prisma enum; task 2 owns transition policy. */
export const ssomaTalkTransition = (
  from: SsomaTalkStatus,
  to: SsomaTalkStatus,
): SsomaTalkTransition => ({ from, to });

export const ssomaAttendanceStatuses = Object.values(SsomaAttendanceStatus);
