import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';

/**
 * ORGANISM — `<app-topbar>` del shell de ProcureTech OS.
 *
 * Barra superior horizontal con:
 *   - notificaciones rápidas (badge visual sobre `pi pi-bell`)
 *   - bloque de usuario a la derecha con `p-avatar` y `p-menu` (popup)
 *
 * El control de estado del popup es 100 % nativo de PrimeNG
 * (`#menu.toggle($event)`). El estilo dark-corporate vive en el SCSS
 * con `::ng-deep` neutralizando lara-light.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    AvatarModule,
    MenuModule,
    ButtonModule,
    BadgeModule,
    TooltipModule,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  readonly userName = input<string>('Diego L.');
  readonly userRole = input<string>('Admin Global');
  readonly avatarUrl = input<string | null>(null);
  readonly hasUnreadNotifications = input<boolean>(true);

  protected readonly initials = computed(() =>
    this.userName()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );

  /**
   * Modelo del `p-menu` popup. Tipado estricto contra `MenuItem` de PrimeNG.
   * Las rutas se navegan vía `routerLink` (RouterModule importado arriba).
   */
  protected readonly userMenuItems: MenuItem[] = [
    {
      label: 'Mi Perfil',
      icon: 'pi pi-user',
      routerLink: ['/profile'],
    },
    {
      label: 'Configuraciones',
      icon: 'pi pi-cog',
      routerLink: ['/settings/thresholds'],
    },
    {
      label: 'Soporte Técnico',
      icon: 'pi pi-question-circle',
      routerLink: ['/support'],
    },
    { separator: true },
    {
      label: 'Cerrar Sesión',
      icon: 'pi pi-sign-out',
      styleClass: 'menu-item-danger',
      command: () => this.logout(),
    },
  ];

  protected logout(): void {
    // TODO: integrar con AuthService cuando esté disponible.
    //       Limpiar tokens (localStorage/cookies), revocar sesión en API,
    //       y redirigir a /login mediante Router.navigate(['/login']).
    // eslint-disable-next-line no-console
    console.log('[Topbar] logout() — sesión cerrada (simulación)');
  }
}
