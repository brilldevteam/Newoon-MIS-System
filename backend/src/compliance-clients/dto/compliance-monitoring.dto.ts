import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const SCREENING_LISTS = ['UN', 'OFAC', 'EU', 'NCTC', 'PPO_LIST', 'WORLD_CHECK', 'GOOGLE', 'OTHER'] as const;
export const SCREENING_RESULTS = ['PENDING', 'CLEAR', 'REVIEW', 'ALERT'] as const;
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const CDD_TYPES = ['SIMPLIFIED', 'REGULAR', 'ENHANCED'] as const;
export const RISK_REASONS = [
  'PEP_IDENTIFIED', 'SANCTIONS_FINDING', 'ADVERSE_MEDIA', 'OWNERSHIP_COMPLEXITY', 'COUNTRY_RISK',
  'INDUSTRY_RISK', 'SOURCE_OF_FUNDS_CONCERN', 'ENHANCED_MONITORING_REQUIRED', 'PROFESSIONAL_JUDGEMENT', 'OTHER'
] as const;
export const EXPIRY_TYPES = ['PASSPORT', 'QID', 'CR', 'TRADE_LICENSE', 'COMPUTER_CARD', 'OTHER'] as const;

// Multipart sends repeated fields as an array, a single field as a string, or a comma-separated string.
const toList = ({ value }: { value: unknown }) =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((item) => String(item).trim()).filter(Boolean);

// Multipart form fields sent with optional evidence files.
export class CreateScreeningDto {
  @IsDateString()
  screenedAt!: string;

  @IsIn(SCREENING_RESULTS)
  result!: (typeof SCREENING_RESULTS)[number];

  @IsString()
  @MaxLength(4000)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  scope?: string;

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(SCREENING_LISTS.length)
  @IsIn(SCREENING_LISTS, { each: true })
  listsChecked?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reviewId?: string;
}

export class RequestRiskChangeDto {
  @IsIn(RISK_LEVELS)
  proposedRisk!: (typeof RISK_LEVELS)[number];

  @IsOptional()
  @IsIn(CDD_TYPES)
  proposedCdd?: (typeof CDD_TYPES)[number];

  @IsIn(RISK_REASONS)
  reasonCategory!: (typeof RISK_REASONS)[number];

  @IsString()
  @MaxLength(4000)
  explanation!: string;
}

export class DecideRiskChangeDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class CompleteReviewDto {
  @IsIn(['NO_CHANGE', 'RISK_CHANGE_REQUESTED', 'EXIT_RECOMMENDED'])
  outcome!: 'NO_CHANGE' | 'RISK_CHANGE_REQUESTED' | 'EXIT_RECOMMENDED';

  @IsString()
  @MaxLength(6000)
  findings!: string;

  @IsOptional()
  @IsIn(RISK_LEVELS)
  proposedRisk?: (typeof RISK_LEVELS)[number];

  @IsOptional()
  @IsIn(CDD_TYPES)
  proposedCdd?: (typeof CDD_TYPES)[number];

  @IsOptional()
  @IsIn(RISK_REASONS)
  reasonCategory?: (typeof RISK_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  explanation?: string;
}

export class CancelDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class SaveExpiryItemDto {
  @IsIn(EXPIRY_TYPES)
  documentType!: (typeof EXPIRY_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  documentLabel?: string;

  @IsString()
  @MaxLength(200)
  holderName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  holderRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentNumber?: string;

  @IsDateString()
  expiryDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
