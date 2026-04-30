import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { BetTabComponent } from './bet-tab.component';

describe('BetTabComponent', () => {
  let fixture: ComponentFixture<BetTabComponent>;
  let component: BetTabComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BetTabComponent, HttpClientTestingModule, FormsModule],
    });
    fixture = TestBed.createComponent(BetTabComponent);
    component = fixture.componentInstance;
    component.drivers = [];
    component.ranking = [];
    component.calendar = [];
    component.userId = 1;
    component.username = 'tester';
    fixture.detectChanges();
  });

  it('renders without crashing', () => {
    expect(component).toBeTruthy();
  });

  it('isDriverSelected returns true if driver code is in another slot', () => {
    component.prediction.top_10 = ['VER', '', '', '', '', '', '', '', '', ''];
    expect(component.isDriverSelected('VER', 1)).toBe(true);
    expect(component.isDriverSelected('VER', 0)).toBe(false);
  });

  it('setTire stores compound for the driver at index', () => {
    component.prediction.top_10[0] = 'VER';
    component.setTire(0, 'start', 'SOFT');
    expect(component.getTire(0, 'start')).toBe('SOFT');
  });
});
