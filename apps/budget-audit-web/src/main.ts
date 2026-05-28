import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AppComponent } from './app/app.component';
import { configureAmplify } from './app/amplify.config';
import { environment } from './environments/environment';

configureAmplify(environment);

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    MessageService,
    ConfirmationService,
    importProvidersFrom([]),
  ],
}).catch((err) => console.error(err));
