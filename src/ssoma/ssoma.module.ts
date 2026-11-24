import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SsomaController } from './ssoma.controller';
import { SsomaService } from './ssoma.service';
import { SignatureEvidenceService } from './signature-evidence.service';
import { SsomaDocumentService } from './ssoma-document.service';
import { SsomaOfficialPdfRenderer } from './ssoma-official-pdf';
import {
  SSOMA_RETENTION_CLOCK,
  SsomaRetentionService,
} from './ssoma-retention.service';
import {
  createPrivateEvidenceStorageFromEnvironment,
  PRIVATE_EVIDENCE_STORAGE,
} from './private-evidence-storage';

@Module({
  imports: [ConfigModule],
  controllers: [SsomaController],
  providers: [
    SsomaService,
    SignatureEvidenceService,
    SsomaDocumentService,
    SsomaOfficialPdfRenderer,
    SsomaRetentionService,
    { provide: SSOMA_RETENTION_CLOCK, useValue: { now: () => new Date() } },
    {
      provide: PRIVATE_EVIDENCE_STORAGE,
      useFactory: () => createPrivateEvidenceStorageFromEnvironment(),
    },
  ],
})
export class SsomaModule {}
