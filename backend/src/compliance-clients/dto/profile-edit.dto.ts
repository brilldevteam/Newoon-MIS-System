import { IsIn } from 'class-validator';

// Client-page edits now go to the client records; see client-records.dto.ts.

// Multipart field sent with a file whose number and expiry date should be read to pre-fill the upload form.
export class ReadIdentityDocumentDto {
  @IsIn(['QID', 'PASSPORT'])
  identityType!: 'QID' | 'PASSPORT';
}
