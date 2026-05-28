import { InjectionToken } from '@angular/core';
import type { AppEnvironment } from '../../amplify.config';

export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('APP_ENVIRONMENT');
