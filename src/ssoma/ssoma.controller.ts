import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
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

@Controller('ssoma')
export class SsomaController {
  constructor(
    private readonly ssoma: SsomaService,
    private readonly signatures: SignatureEvidenceService,
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
