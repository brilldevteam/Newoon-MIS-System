import { Module } from '@nestjs/common';
import { IdDocumentReaderService } from './id-document-reader.service';

// One on-server passport / QID reader (a single OCR worker) shared by the client register and the enquiry form.
@Module({
  providers: [IdDocumentReaderService],
  exports: [IdDocumentReaderService]
})
export class IdDocumentReaderModule {}
