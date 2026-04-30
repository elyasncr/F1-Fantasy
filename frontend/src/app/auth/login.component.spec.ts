import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule, FormsModule],
    });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('renders without crashing', () => {
    expect(component).toBeTruthy();
  });

  it('toggleMode flips isRegistering', () => {
    expect(component.isRegistering).toBe(false);
    component.toggleMode();
    expect(component.isRegistering).toBe(true);
  });

  it('emits authenticated event on successful login', (done) => {
    component.usernameInput = 'alice';
    component.passwordInput = 'p';
    component.authenticated.subscribe((ev) => {
      expect(ev.username).toBe('alice');
      done();
    });
    component.actionAuth();
    const req = httpMock.expectOne('http://localhost:8000/login');
    req.flush({ user_id: 1, username: 'alice' });
  });
});
