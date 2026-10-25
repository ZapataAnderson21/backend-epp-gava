import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetUser } from 'src/decorators/get-user.decorator';
import { SsomaReasonDto } from './dto/ssoma-reason.dto';
import {
  AddSsomaParticipantsDto,
  CreateSsomaTalkDto,
  ListSsomaTalksQueryDto,
  SearchSsomaWorkersQueryDto,
  SsomaAuditQueryDto,
  SsomaAvailabilityQueryDto,
  UpdateSsomaTalkDto,
} from './dto/ssoma-talk.dto';
import { SsomaService } from './ssoma.service';
import { SsomaRequestUser } from './ssoma-user-context';
import { CaptureSignatureDto } from './dto/capture-signature.dto';
import { SignatureEvidenceService } from './signature-evidence.service';
import { SsomaDocumentService } from './ssoma-document.service';
import { PublishSsomaDocumentDto, StartSsomaRevisionDto } from './dto/ssoma-publication.dto';
import { ClearSsomaRetentionHoldDto, RunSsomaRetentionDto, SetSsomaRetentionHoldDto } from './dto/ssoma-retention.dto';
import { SsomaRetentionService } from './ssoma-retention.service';

@Controller('ssoma')
export class SsomaController {
  constructor(
    private readonly ssoma: SsomaService,
    private readonly signatures: SignatureEvidenceService,
    private readonly documents: SsomaDocumentService,
    private readonly retention: SsomaRetentionService,
  ) {}

  @Post('talks/:id/attendance/:attendanceId/signature')
  @UseInterceptors(FileInterceptor('signature', {
    limits: { fileSize: 1_000_000, files: 1, fields: 1, fieldSize: 128 },
    fileFilter: (_request, file, callback) => {
      if (file.mimetype !== 'image/png') return callback(new BadRequestException('Solo se aceptan firmas PNG.'), false);
      callback(null, true);
    },
  }))
  captureSignature(
    @Param('id', ParseIntPipe) talkId: number,
    @Param('attendanceId', ParseIntPipe) attendanceId: number,
    @Body() dto: CaptureSignatureDto,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: SsomaRequestUser,
  ) {
    if (!file) throw new BadRequestException('Debe adjuntar una firma PNG.');
    return this.signatures.capture({
      talkId,
      attendanceId,
      workerId: dto.workerId,
      actorUserId: user.userId,
      mimeType: file.mimetype,
      bytes: file.buffer,
    });
  }

  @Post('talks/:id/close')
  closeTalk(
    @Param('id', ParseIntPipe) talkId: number,
    @Body() dto: PublishSsomaDocumentDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.documents.closeTalk(talkId, user.userId, dto.idempotencyKey);
  }

  @Post('talks/:id/revisions')
  startRevision(
    @Param('id', ParseIntPipe) talkId: number,
    @Body() dto: StartSsomaRevisionDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    const { reason, ...overrides } = dto;
    return this.documents.startRevision(talkId, user.userId, reason, overrides);
  }

  @Post('talks/:id/revisions/:revisionId/publish')
  publishRevision(
    @Param('id', ParseIntPipe) talkId: number,
    @Param('revisionId', ParseIntPipe) revisionId: number,
    @Body() dto: PublishSsomaDocumentDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.documents.publishRevision(talkId, revisionId, user.userId, dto.idempotencyKey);
  }

  @Get('talks/:id/versions')
  listDocumentVersions(@Param('id', ParseIntPipe) talkId: number) {
    return this.documents.listVersions(talkId);
  }

  @Get('talks/:id/revisions')
  listRevisions(@Param('id', ParseIntPipe) talkId: number) {
    return this.documents.listRevisions(talkId);
  }

  @Get('talks/:id/publications/reconciliation')
  reconcilePublications(@Param('id', ParseIntPipe) talkId: number) {
    return this.documents.reconcilePublications(talkId);
  }

  @Get('talks/:id/document')
  async downloadCurrentPdf(@Param('id', ParseIntPipe) talkId: number) {
    const bytes = await this.documents.downloadCurrent(talkId);
    return new StreamableFile(bytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="ssoma-talk-${talkId}.pdf"`,
      length: bytes.length,
    });
  }

  @Get('talks/:id/versions/:versionId/document')
  async downloadVersionPdf(
    @Param('id', ParseIntPipe) talkId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    const bytes = await this.documents.downloadVersion(talkId, versionId);
    return new StreamableFile(bytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="ssoma-talk-${talkId}-version-${versionId}.pdf"`,
      length: bytes.length,
    });
  }

  @Get('maintenance/retention/status')
  getRetentionStatus() {
    return this.retention.status();
  }

  @Get('maintenance/retention/orphans')
  getRetentionOrphanReport() {
    return this.retention.orphanReport();
  }

  @Post('maintenance/retention/run')
  runRetentionMaintenance(@Body() dto: RunSsomaRetentionDto = {}) {
    return this.retention.runMaintenance(dto.batchSize);
  }

  @Post('signature-evidence/:evidenceId/retention-hold')
  setRetentionHold(
    @Param('evidenceId', ParseIntPipe) evidenceId: number,
    @Body() dto: SetSsomaRetentionHoldDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.retention.setRetentionHold(evidenceId, user.userId, dto.reason, dto.holdUntil ? new Date(dto.holdUntil) : null);
  }

  @Delete('signature-evidence/:evidenceId/retention-hold')
  clearRetentionHold(
    @Param('evidenceId', ParseIntPipe) evidenceId: number,
    @Body() dto: ClearSsomaRetentionHoldDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.retention.clearRetentionHold(evidenceId, user.userId, dto.reason);
  }

  @Post('talks')
  createTalk(
    @Body() dto: CreateSsomaTalkDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.createTalk(dto, user.userId);
  }

  @Get('talks')
  listTalks(@Query() query: ListSsomaTalksQueryDto) {
    return this.ssoma.listTalks(query);
  }

  @Get('talks/:id')
  findTalk(@Param('id', ParseIntPipe) id: number) {
    return this.ssoma.findTalk(id);
  }

  @Patch('talks/:id')
  updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSsomaTalkDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.updateDraft(id, dto, user.userId);
  }

  @Post('talks/:id/start')
  startTalk(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.startTalk(id, user.userId);
  }

  @Post('talks/:id/open')
  openTalk(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.openTalk(id, user.userId);
  }

  @Post('talks/:id/annul')
  annulTalk(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SsomaReasonDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.annulTalk(id, dto.reason, user.userId);
  }

  @Get('workers')
  searchWorkers(@Query() query: SearchSsomaWorkersQueryDto) {
    return this.ssoma.searchWorkers(query);
  }

  @Get('availability')
  getAvailability(@Query() query: SsomaAvailabilityQueryDto) {
    return this.ssoma.getAvailability(query.date, query.workerIds);
  }

  @Post('talks/:id/participants')
  addParticipants(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddSsomaParticipantsDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.addParticipants(id, dto.workerIds, user.userId);
  }

  @Post('talks/:id/participants/:attendanceId/remove')
  removeParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Param('attendanceId', ParseIntPipe) attendanceId: number,
    @Body() dto: SsomaReasonDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.removeParticipant(id, attendanceId, dto.reason, user.userId);
  }

  @Post('talks/:id/attendance/:attendanceId/invalidate')
  invalidateAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Param('attendanceId', ParseIntPipe) attendanceId: number,
    @Body() dto: SsomaReasonDto,
    @GetUser() user: SsomaRequestUser,
  ) {
    return this.ssoma.invalidateAttendance(id, attendanceId, dto.reason, user.userId);
  }

  @Get('talks/:id/audit')
  auditHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: SsomaAuditQueryDto,
  ) {
    return this.ssoma.auditHistory(id, query);
  }
}
