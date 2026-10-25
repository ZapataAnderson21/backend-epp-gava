import { Module } from '@nestjs/common';
import { SsomaController } from './ssoma.controller';
import { SsomaService } from './ssoma.service';
import { SignatureEvidenceService } from './signature-evidence.service';
import { SsomaDocumentService } from './ssoma-document.service';
import { SsomaOfficialPdfRenderer } from './ssoma-official-pdf';
import {
  PRIVATE_EVIDENCE_STORAGE,
  LocalFilesystemPrivateEvidenceStorage,
  UnavailablePrivateEvidenceStorage,
} from './private-evidence-storage';

@Module({
  controllers: [SsomaController],
  providers: [
    SsomaService,
    SignatureEvidenceService,
    SsomaDocumentService,
    SsomaOfficialPdfRenderer,
    {
      provide: PRIVATE_EVIDENCE_STORAGE,
      useFactory: () => {
        const provider = process.env.SSOMA_EVIDENCE_STORAGE;
        if (provider === 'local') {
          const root = process.env.SSOMA_EVIDENCE_LOCAL_ROOT;
          if (!root) throw new Error('SSOMA_EVIDENCE_LOCAL_ROOT is required for local evidence storage');
          return new LocalFilesystemPrivateEvidenceStorage(root, process.env.NODE_ENV ?? 'development');
        }
        return new UnavailablePrivateEvidenceStorage();
      },
    },
  ],
})
export class SsomaModule {}
