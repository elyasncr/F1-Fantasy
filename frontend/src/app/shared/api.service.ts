import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuthResponse { user_id: number; username: string; }
export interface Driver { code: string; name: string; team: string; number: number; image: string; car: string; }
export interface RankingEntry { username: string; total_points: number; }

export interface PredictionPayload {
  user_id: number;
  race_slug: string;
  top_10: string[];
  tire_strategies: Record<string, { start: string; end: string }>;
  driver_of_day: string;
  most_positions_gained: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, { username, password });
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, { username, password });
  }

  getDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${this.baseUrl}/drivers`);
  }

  getRanking(): Observable<RankingEntry[]> {
    return this.http.get<RankingEntry[]>(`${this.baseUrl}/ranking`);
  }

  submitPrediction(payload: PredictionPayload): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/predict`, payload);
  }
}
