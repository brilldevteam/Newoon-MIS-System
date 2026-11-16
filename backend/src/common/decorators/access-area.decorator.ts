import { SetMetadata } from '@nestjs/common';

export const ACCESS_AREA_KEY = 'accessArea';

// Overrides the role-matrix area an endpoint belongs to, when it serves a different workflow than its controller
// (for example the client lookup used inside the KYC form).
export const AccessArea = (area: string) => SetMetadata(ACCESS_AREA_KEY, area);
