import { ConflictException, NotFoundException } from '@nestjs/common';
import { SsomaAttendanceStatus, SsomaTalkStatus } from 'src/generated/prisma';
import { mapSsomaDatabaseError } from './ssoma-database-errors';
import {
  ssomaAttendanceStatuses,
  ssomaTalkStatuses,
  ssomaTalkTransition,
} from './ssoma-lifecycle';

describe('SSOMA foundation', () => {
  it('derives lifecycle states and typed transitions from Phase 2 enums', () => {
    expect(ssomaTalkStatuses).toEqual(Object.values(SsomaTalkStatus));
    expect(ssomaAttendanceStatuses).toEqual(Object.values(SsomaAttendanceStatus));
    expect(
      ssomaTalkTransition(SsomaTalkStatus.draft, SsomaTalkStatus.inProgress),
    ).toEqual({ from: 'draft', to: 'inProgress' });
  });

  it('maps unique and missing-record database conflicts to HTTP exceptions', () => {
    expect(mapSsomaDatabaseError({ code: 'P2002', meta: { target: ['talkId'] } })).toBeInstanceOf(
      ConflictException,
    );
    expect(mapSsomaDatabaseError({ code: 'P2025' })).toBeInstanceOf(NotFoundException);
    expect(mapSsomaDatabaseError({ code: 'P1001' })).toBeNull();
    expect(mapSsomaDatabaseError(new Error('not prisma'))).toBeNull();
  });
});
