import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('login posts to /login with credentials', () => {
    service.login('alice', 'p').subscribe();
    const req = httpMock.expectOne('http://localhost:8000/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'alice', password: 'p' });
    req.flush({ user_id: 1, username: 'alice' });
  });

  it('register posts to /register', () => {
    service.register('bob', 'x').subscribe();
    const req = httpMock.expectOne('http://localhost:8000/register');
    expect(req.request.method).toBe('POST');
    req.flush({ user_id: 2, username: 'bob' });
  });

  it('getDrivers fetches from /drivers', () => {
    service.getDrivers().subscribe();
    httpMock.expectOne('http://localhost:8000/drivers').flush([]);
  });

  it('getRanking fetches from /ranking', () => {
    service.getRanking().subscribe();
    httpMock.expectOne('http://localhost:8000/ranking').flush([]);
  });

  it('submitPrediction posts to /predict', () => {
    const payload = { user_id: 1, race_slug: 'AUS', top_10: [], tire_strategies: {}, driver_of_day: '', most_positions_gained: '' };
    service.submitPrediction(payload).subscribe();
    const req = httpMock.expectOne('http://localhost:8000/predict');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ status: 'ok' });
  });
});
