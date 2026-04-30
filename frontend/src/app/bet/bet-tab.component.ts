import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Driver, RankingEntry } from '../shared/api.service';

interface CalendarRace {
  date: string;
  gp: string;
  sprint: boolean;
}

interface Prediction {
  top_10: string[];
  tire_strategies: Record<string, { start: string; end: string }>;
  driver_of_day: string;
  most_positions_gained: string;
}

@Component({
  selector: 'app-bet-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bet-layout">
      <div class="main-column">
        <div class="panel">
          <div class="panel-header"><h3>🚦 Grid de Largada</h3><small>Defina as posições e estratégia de pneus</small></div>
          <div class="grid-list">
            <div *ngFor="let i of [0,1,2,3,4,5,6,7,8,9]; let idx = index" class="driver-card">
              <div class="position-marker">P{{idx + 1}}</div>
              <div class="driver-content">
                <div class="driver-selection-row">
                  <img [src]="getDriverImage(prediction.top_10[idx])" (error)="handleImageError($event)" class="driver-avatar">
                  <div class="select-container">
                    <select [(ngModel)]="prediction.top_10[idx]" class="premium-select" [class.filled]="prediction.top_10[idx]">
                      <option value="" disabled selected>Selecione o Piloto...</option>
                      <option *ngFor="let d of drivers" [value]="d.code" [disabled]="isDriverSelected(d.code, idx)">
                        {{d.name}} #{{d.number}} ({{d.team}})
                      </option>
                    </select>
                  </div>
                </div>
                <div class="tire-strategy-box">
                  <div class="strategy-col">
                    <span class="tire-label">LARGADA</span>
                    <div class="tire-toggles">
                      <button (click)="setTire(idx, 'start', 'SOFT')" [class.active]="getTire(idx, 'start') === 'SOFT'" class="tire-dot soft"></button>
                      <button (click)="setTire(idx, 'start', 'MEDIUM')" [class.active]="getTire(idx, 'start') === 'MEDIUM'" class="tire-dot medium"></button>
                      <button (click)="setTire(idx, 'start', 'HARD')" [class.active]="getTire(idx, 'start') === 'HARD'" class="tire-dot hard"></button>
                    </div>
                  </div>
                  <div class="arrow">➜</div>
                  <div class="strategy-col">
                    <span class="tire-label">FINAL</span>
                    <div class="tire-toggles">
                      <button (click)="setTire(idx, 'end', 'SOFT')" [class.active]="getTire(idx, 'end') === 'SOFT'" class="tire-dot soft"></button>
                      <button (click)="setTire(idx, 'end', 'MEDIUM')" [class.active]="getTire(idx, 'end') === 'MEDIUM'" class="tire-dot medium"></button>
                      <button (click)="setTire(idx, 'end', 'HARD')" [class.active]="getTire(idx, 'end') === 'HARD'" class="tire-dot hard"></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="side-column">
        <div class="panel">
          <div class="panel-header"><h3>🔥 Especiais</h3></div>
          <div class="special-input">
            <label>Piloto do Dia</label>
            <div class="special-row">
              <img [src]="getDriverImageByName(prediction.driver_of_day)" (error)="handleImageError($event)" class="mini-avatar">
              <select [(ngModel)]="prediction.driver_of_day" class="premium-select">
                <option value="" disabled>Escolha...</option>
                <option *ngFor="let d of drivers" [value]="d.name">{{d.name}}</option>
              </select>
            </div>
          </div>
          <div class="special-input">
            <label>Maior Evolução</label>
            <div class="special-row">
              <img [src]="getDriverImageByName(prediction.most_positions_gained)" (error)="handleImageError($event)" class="mini-avatar">
              <select [(ngModel)]="prediction.most_positions_gained" class="premium-select">
                <option value="" disabled>Escolha...</option>
                <option *ngFor="let d of drivers" [value]="d.name">{{d.name}}</option>
              </select>
            </div>
          </div>
          <button (click)="submitPrediction()" class="btn-save-all">💾 SALVAR PREDIÇÃO</button>
        </div>

        <div class="panel calendar-panel">
          <div class="panel-header"><h3>📅 Calendário 2026</h3></div>
          <div class="calendar-list">
            <div *ngFor="let race of calendar" class="race-item">
              <div class="race-header"><span class="race-date">{{race.date}}</span><span class="race-country">{{race.gp}}</span></div>
              <div class="race-events"><span *ngIf="race.sprint" class="badge sprint">SPRINT</span><span class="badge race">CORRIDA</span></div>
            </div>
          </div>
        </div>

        <div class="panel ranking-panel">
          <div class="panel-header"><h3>🌎 Ranking Global</h3></div>
          <ul class="ranking-list">
            <li *ngFor="let u of ranking" [class.me]="u.username === username">
              #{{ranking.indexOf(u)+1}} {{u.username}} - {{u.total_points}} pts
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bet-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; padding: 25px; max-width: 1600px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    .driver-card { display: flex; align-items: center; gap: 15px; background: #1a1b21; margin-bottom: 12px; padding: 15px; border-radius: 10px; border-left: 4px solid transparent; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .driver-card:hover { border-left-color: #e10600; background: #202129; transform: translateX(5px); }
    .driver-content { flex: 1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .driver-selection-row, .special-row { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 250px; }
    .driver-avatar { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; background: #333; border: 1px solid #444; }
    .mini-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #333; border: 1px solid #444; }
    .select-container { flex: 1; }
    .tire-strategy-box { display: flex; align-items: center; gap: 15px; background: #131418; padding: 8px 15px; border-radius: 8px; border: 1px solid #2d2e36; }
    .strategy-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .tire-label { font-size: 0.6rem; color: #8a8a93; font-weight: bold; }
    .tire-toggles { display: flex; gap: 6px; }
    .tire-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; opacity: 0.3; background: transparent; padding: 0; }
    .tire-dot:hover { opacity: 0.7; transform: scale(1.1); }
    .tire-dot.active { opacity: 1; transform: scale(1.2); border-color: #fff; box-shadow: 0 0 5px currentColor; }
    .tire-dot.soft { background-color: #ff3333; color: #ff3333; }
    .tire-dot.medium { background-color: #ffcc00; color: #ffcc00; }
    .tire-dot.hard { background-color: #f0f0f0; color: #f0f0f0; }
    .arrow { color: #8a8a93; }
    .panel { background: #1e1f26; border-radius: 12px; border: 1px solid #2d2e36; margin-bottom: 25px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .panel-header { padding: 18px 25px; background: rgba(255,255,255,0.02); border-bottom: 1px solid #2d2e36; display: flex; justify-content: space-between; align-items: center; }
    .premium-select { background-color: #15161b; color: #fff; border: 1px solid #333; border-radius: 6px; padding: 12px 15px; width: 100%; cursor: pointer; }
    .btn-save-all { width: 100%; padding: 15px; background: #e10600; color: white; border: none; font-weight: 800; cursor: pointer; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; margin-top: 15px; }
    .position-marker { font-size: 1.2rem; font-weight: 900; color: #8a8a93; width: 35px; text-align: center; font-style: italic; }
    .special-input { margin-bottom: 15px; }
    .special-input label { display: block; margin-bottom: 5px; color: #e10600; font-weight: bold; font-size: 0.8rem; text-transform: uppercase; }
    .calendar-list { max-height: 350px; overflow-y: auto; }
    .race-item { padding: 12px 15px; border-bottom: 1px solid #2d2e36; }
    .race-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .race-date { color: #e10600; font-weight: 800; font-size: 0.8rem; }
    .race-country { font-weight: bold; font-size: 0.9rem; }
    .race-events { display: flex; gap: 5px; }
    .badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #333; color: #aaa; }
    .badge.sprint { background: #ffcc00; color: #000; }
    .badge.race { background: #e10600; color: #fff; }
    .ranking-list { padding: 12px 25px; list-style: none; margin: 0; }
    .ranking-list li { padding: 6px 0; color: #ccc; font-size: 0.9rem; }
    .ranking-list li.me { color: #fff; font-weight: bold; }
  `],
})
export class BetTabComponent {
  @Input() drivers: Driver[] = [];
  @Input() ranking: RankingEntry[] = [];
  @Input() calendar: CalendarRace[] = [];
  @Input() userId: number | null = null;
  @Input() username = '';

  prediction: Prediction = {
    top_10: new Array(10).fill(''),
    tire_strategies: {},
    driver_of_day: '',
    most_positions_gained: '',
  };

  constructor(private api: ApiService) {}

  isDriverSelected(code: string, idx: number): boolean {
    return this.prediction.top_10.includes(code) && this.prediction.top_10[idx] !== code;
  }

  getDriverImage(code: string): string {
    const d = this.drivers.find((x) => x.code === code);
    return d ? d.image : 'assets/drivers/placeholder.png';
  }

  getDriverImageByName(name: string): string {
    const d = this.drivers.find((x) => x.name === name);
    return d ? d.image : 'assets/drivers/placeholder.png';
  }

  handleImageError(event: any) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
  }

  setTire(idx: number, type: 'start' | 'end', compound: string) {
    const code = this.prediction.top_10[idx];
    if (!code) return;
    if (!this.prediction.tire_strategies[code]) this.prediction.tire_strategies[code] = { start: '', end: '' };
    this.prediction.tire_strategies[code][type] = compound;
  }

  getTire(idx: number, type: 'start' | 'end'): string {
    const code = this.prediction.top_10[idx];
    return code && this.prediction.tire_strategies[code] ? this.prediction.tire_strategies[code][type] : '';
  }

  submitPrediction() {
    if (!this.userId) return;
    this.api
      .submitPrediction({
        user_id: this.userId,
        race_slug: this.calendar[0]?.gp || 'AUS',
        top_10: this.prediction.top_10,
        tire_strategies: this.prediction.tire_strategies,
        driver_of_day: this.prediction.driver_of_day,
        most_positions_gained: this.prediction.most_positions_gained,
      })
      .subscribe(() => alert('Estratégia salva no banco de dados!'));
  }
}
