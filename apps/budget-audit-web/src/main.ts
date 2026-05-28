import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AppComponent } from './app/app.component';
import { APP_ROUTES } from './app/app.routes';
import { configureAmplify } from './app/amplify.config';
import { environment } from './environments/environment';

configureAmplify(environment);

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    MessageService,
    ConfirmationService,
    importProvidersFrom([]),
  ],
}).catch((err) => console.error(err));
