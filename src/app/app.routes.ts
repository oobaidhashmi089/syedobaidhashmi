import { Routes } from '@angular/router';
import { ResumeBuilderComponent } from './resume/resume-builder.component';
import { CoverLetterComponent } from './cover-letter/cover-letter.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { AdminLoginComponent } from './admin-login/admin-login.component';
import { adminAuthGuard } from './core/admin-auth.guard';

export const routes: Routes = [
  { path: '', component: PortfolioComponent },
  { path: 'login', component: AdminLoginComponent },
  { path: 'resume', canActivate: [adminAuthGuard], component: ResumeBuilderComponent },
  { path: 'cover-letter', canActivate: [adminAuthGuard], component: CoverLetterComponent },
];
