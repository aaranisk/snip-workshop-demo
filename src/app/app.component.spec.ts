import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { LinkApiService } from './link-api.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{
        provide: LinkApiService,
        useValue: { list: () => Promise.resolve([]), create: () => Promise.resolve({}) }
      }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Make it Snip.');
    expect(fixture.componentInstance).toBeTruthy();
  });
});
