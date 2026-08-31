import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly isAdmin = this.auth.isAdmin;

  logout(): void {
    this.auth.logout();
  }
}
