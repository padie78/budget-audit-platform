import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../ui/organisms/sidebar/sidebar.component';
import { TopbarComponent } from '../../ui/organisms/topbar/topbar.component';

/* =============================================================================
 * ShellLayoutComponent — chrome del workspace (Sidebar + Topbar + outlet).
 *
 * Es un layout reusable: la rutas hijas se inyectan dentro de `<router-outlet>`
 * sin tener que repetir Sidebar/Topbar por feature. Cada page concreta solo
 * implementa su contenido y se monta como child route del shell.
 * ============================================================================= */
@Component({
  selector: 'app-shell-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarComponent, TopbarComponent, RouterModule],
  templateUrl: './shell-layout.component.html',
  styleUrl: './shell-layout.component.scss',
})
export class ShellLayoutComponent {
  protected readonly pendingAuditsCount = signal(7);
  protected readonly legalRisksCount = signal(3);
}
