import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/auth.service';

/**
 * The shell carries two contracts the deploy gate depends on:
 * the `app-ready` readiness landmark and the "PinBoard" product title.
 * Both are asserted here so a refactor cannot quietly drop them.
 */
describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let auth: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    auth = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('creates the root component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('keeps the app-ready readiness landmark on the hydrated root', () => {
    const ready = el('app-ready');
    expect(ready).not.toBeNull();
    // The post-deploy render gate waits for this element; it must be the outermost node.
    expect(ready).toBe(fixture.nativeElement.firstElementChild);
  });

  it('renders the PinBoard product title', () => {
    expect(el('app-title')?.textContent?.trim()).toBe('PinBoard');
    expect(fixture.nativeElement.textContent).toContain('PinBoard');
  });

  it('links the brand and primary nav at the wall', () => {
    expect(el('brand-link')?.getAttribute('href')).toBe('/wall');
    expect(el('nav-wall')?.textContent?.trim()).toBe('The wall');
  });

  it('shows log in / sign up while signed out, and no user chip', () => {
    expect(el('nav-login')).not.toBeNull();
    expect(el('nav-signup')).not.toBeNull();
    expect(el('user-chip')).toBeNull();
    expect(el('logout-button')).toBeNull();
  });

  it('shows the user chip and hides admin nav for a signed-in non-admin', () => {
    auth.user.set({
      id: 'u1',
      email: 'user@example.com',
      name: 'Ada Lovelace',
      role: 'USER',
    });
    fixture.detectChanges();

    expect(el('user-chip')?.textContent).toContain('Ada Lovelace');
    expect(el('logout-button')).not.toBeNull();
    expect(el('nav-login')).toBeNull();
    // Admin surfaces stay hidden for a plain USER.
    expect(el('nav-admin')).toBeNull();
    expect(el('tab-admin')).toBeNull();
  });

  it('reveals the admin nav only for an ADMIN', () => {
    auth.user.set({
      id: 'a1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    });
    fixture.detectChanges();

    expect(el('nav-admin')?.getAttribute('href')).toBe('/admin/settings');
    expect(el('tab-admin')).not.toBeNull();
  });

  it('exposes a deep-linkable "new pin" entry point', () => {
    // The tab-bar shortcut must carry ?modal=new so the dialog has a real address.
    expect(el('tab-new')?.getAttribute('href')).toBe('/wall?modal=new');
  });
});
