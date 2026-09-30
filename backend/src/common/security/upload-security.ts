import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { extname, sep } from 'path';

export const MAX_UPLOAD_FILE_SIZE_BYTES = Number(process.env.MAX_UPLOAD_FILE_SIZE_BYTES || 10 * 1024 * 1024);
export const MAX_UPLOAD_FILE_COUNT = Number(process.env.MAX_UPLOAD_FILE_COUNT || 20);

type UploadKind = 'pdf' | 'word' | 'excel' | 'image';

type UploadedFileLike = {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

const dangerousExtensions = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.hta',
  '.html',
  '.jar',
  '.js',
  '.jse',
  '.lnk',
  '.msi',
  '.php',
  '.ps1',
  '.scr',
  '.sh',
  '.svg',
  '.vb',
  '.vbe',
  '.vbs',
  '.wsf',
  '.docm',
  '.xlsm'
]);

const allowedExtensionsByKind: Record<UploadKind, Set<string>> = {
  pdf: new Set(['.pdf']),
  word: new Set(['.doc', '.docx']),
  excel: new Set(['.xls', '.xlsx']),
  image: new Set(['.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp'])
};

const allowedMimeTypesByKind: Record<UploadKind, Set<string>> = {
  pdf: new Set(['application/pdf']),
  word: new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  excel: new Set([
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  image: new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
};

export const standardDocumentKinds: UploadKind[] = ['pdf', 'word', 'excel', 'image'];
export const crrfDocumentKinds: UploadKind[] = ['pdf', 'excel'];

export function uploadInterceptorOptions(allowedKinds: UploadKind[] = standardDocumentKinds): MulterOptions {
  return {
    limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES, files: MAX_UPLOAD_FILE_COUNT },
    fileFilter: (_request, file, callback) => {
      try {
        validateUploadFileMetadata(file, allowedKinds);
        callback(null, true);
      } catch (error) {
        callback(error as Error, false);
      }
    }
  };
}

export function validateUploadFiles(files: UploadedFileLike[], allowedKinds: UploadKind[], label = 'file') {
  if (files.length > MAX_UPLOAD_FILE_COUNT) {
    throw new BadRequestException(`Upload a maximum of ${MAX_UPLOAD_FILE_COUNT} files at a time.`);
  }

  for (const file of files) {
    validateUploadFile(file, allowedKinds, label);
  }
}

export function validateUploadFile(file: UploadedFileLike, allowedKinds: UploadKind[], label = 'file') {
  validateUploadFileMetadata(file, allowedKinds);

  if (!file.buffer?.length) {
    throw new BadRequestException(`Upload a valid ${label}.`);
  }

  if (!matchesAllowedSignature(file, allowedKinds)) {
    throw new BadRequestException(`${file.originalname} content does not match the allowed file type.`);
  }
}

export function safeResponseFileName(fileName: string) {
  return encodeURIComponent((fileName || 'document').replace(/[\r\n"]/g, ' '));
}

export function isPathInsideRoot(candidatePath: string, rootPath: string) {
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${sep}`);
}

function validateUploadFileMetadata(file: UploadedFileLike, allowedKinds: UploadKind[]) {
  const extension = extname(file.originalname || '').toLowerCase();
  const mimeType = (file.mimetype || '').toLowerCase();

  if (!file.originalname || !extension) {
    throw new BadRequestException('Uploaded file must have a valid extension.');
  }

  if (dangerousExtensions.has(extension)) {
    throw new BadRequestException(`${file.originalname} is not allowed.`);
  }

  if ((file.size || 0) > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new BadRequestException(`${file.originalname} exceeds the ${Math.floor(MAX_UPLOAD_FILE_SIZE_BYTES / 1024 / 1024)} MB upload limit.`);
  }

  const extensionAllowed = allowedKinds.some((kind) => allowedExtensionsByKind[kind].has(extension));
  const mimeAllowed = allowedKinds.some((kind) => allowedMimeTypesByKind[kind].has(mimeType));

  if (!extensionAllowed || !mimeAllowed) {
    throw new BadRequestException(`${file.originalname} is not an allowed file type.`);
  }
}

function matchesAllowedSignature(file: UploadedFileLike, allowedKinds: UploadKind[]) {
  return allowedKinds.some((kind) => {
    if (kind === 'pdf') return hasPdfSignature(file.buffer);
    if (kind === 'image') return hasImageSignature(file.buffer);
    if (kind === 'word') return hasOfficeSignature(file);
    if (kind === 'excel') return hasOfficeSignature(file);
    return false;
  });
}

function hasPdfSignature(buffer?: Buffer) {
  return Boolean(buffer?.subarray(0, 4).equals(Buffer.from('%PDF')));
}

function hasImageSignature(buffer?: Buffer) {
  if (!buffer?.length) return false;
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const gif = buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  const webp = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || gif || webp;
}

function hasOfficeSignature(file: UploadedFileLike) {
  const extension = extname(file.originalname || '').toLowerCase();
  const buffer = file.buffer;
  if (!buffer || buffer.length < 4) return false;
  const zipBased = ['.docx', '.xlsx'].includes(extension) && buffer.subarray(0, 2).toString('ascii') === 'PK';
  const compound = ['.doc', '.xls'].includes(extension) && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  return zipBased || compound;
}
