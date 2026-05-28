import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { configureAmplify } from './app/amplify.config';
import { environment } from './environments/environment';

configureAmplify(environment);

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient()],
}).catch((err) => console.error(err));
