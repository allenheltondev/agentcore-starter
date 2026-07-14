import { Logger } from '@aws-lambda-powertools/logger';

// Single Powertools Logger shared across the backend functions. serviceName
// comes from POWERTOOLS_SERVICE_NAME (set in template.yaml Globals), matching
// the convention in readysetcloud/content-tracking.
export const logger = new Logger();
