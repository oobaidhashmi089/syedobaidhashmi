import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../core/admin-auth.service';
import { NetworkCanvasComponent } from '../shared/network-canvas/network-canvas.component';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NetworkCanvasComponent],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css',
})
export class AdminLoginComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  error = '';
  busy = false;

  submit(): void {
    this.error = '';
    this.busy = true;
    const ok = this.auth.login(this.email, this.password);
    this.busy = false;
    if (!ok) {
      this.error = 'Invalid email or password.';
      return;
    }
    const ret =
      this.route.snapshot.queryParamMap.get('returnUrl')?.startsWith('/') &&
      !this.route.snapshot.queryParamMap.get('returnUrl')?.startsWith('//')
        ? this.route.snapshot.queryParamMap.get('returnUrl')!
        : '/resume';
    void this.router.navigateByUrl(ret);
  }
}
