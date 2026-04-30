import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient() // <--- OBRIGATÓRIO: Habilita Login e Cadastro
  ]
}).catch(err => console.error(err));