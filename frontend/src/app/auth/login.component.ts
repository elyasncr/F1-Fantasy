import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthResponse } from '../shared/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-overlay">
      <div class="login-box">
        <div class="f1-logo-mock">🏎️</div>
        <h2>Acesso ao Paddock</h2>
        <div class="input-group">
          <input [(ngModel)]="usernameInput" placeholder="Piloto" (keyup.enter)="actionAuth()">
        </div>
        <div class="input-group">
          <input [(ngModel)]="passwordInput" type="password" placeholder="Senha" (keyup.enter)="actionAuth()">
        </div>
        <button (click)="actionAuth()" class="btn-cta">
          {{ isRegistering ? 'Assinar Contrato' : 'Entrar' }}
        </button>
        <p class="toggle-link" (click)="toggleMode()">
          {{ isRegistering ? 'Já tenho Superlicença' : 'Solicitar Superlicença' }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: flex; justify-content: center; align-items: center; z-index: 100; }
    .login-box { background: #1e1f26; padding: 50px; border-radius: 16px; width: 350px; text-align: center; border: 1px solid #2d2e36; }
    .f1-logo-mock { font-size: 3rem; margin-bottom: 10px; }
    .input-group input { width: 100%; padding: 12px; margin-bottom: 10px; background: #15161b; border: 1px solid #333; color: white; border-radius: 6px; box-sizing: border-box; }
    .btn-cta { width: 100%; padding: 12px; background: #e10600; border: none; color: white; border-radius: 6px; font-weight: bold; cursor: pointer; text-transform: uppercase; }
    .toggle-link { color: #666; margin-top: 15px; cursor: pointer; font-size: 0.9rem; text-decoration: underline; }
  `],
})
export class LoginComponent {
  @Output() authenticated = new EventEmitter<AuthResponse>();

  usernameInput = '';
  passwordInput = '';
  isRegistering = false;

  constructor(private api: ApiService) {}

  actionAuth() {
    if (this.isRegistering) {
      this.api.register(this.usernameInput, this.passwordInput).subscribe(() => {
        alert('Licença emitida!');
        this.toggleMode();
      });
    } else {
      this.api.login(this.usernameInput, this.passwordInput).subscribe((r) => {
        this.authenticated.emit(r);
      });
    }
  }

  toggleMode() {
    this.isRegistering = !this.isRegistering;
  }
}
