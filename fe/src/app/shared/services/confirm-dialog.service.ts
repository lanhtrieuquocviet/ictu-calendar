import { Injectable, ApplicationRef, createComponent, EnvironmentInjector, inject } from '@angular/core';
import { ConfirmDialogComponent, ConfirmDialogOptions } from '../components/confirm-dialog/confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise(resolve => {
      const ref = createComponent(ConfirmDialogComponent, {
        environmentInjector: this.injector,
      });

      const i = ref.instance;
      if (options.title)       i.title       = options.title;
      if (options.message)     i.message     = options.message;
      if (options.confirmText) i.confirmText = options.confirmText;
      if (options.cancelText)  i.cancelText  = options.cancelText;
      if (options.type)        i.type        = options.type;

      const cleanup = (result: boolean) => {
        resolve(result);
        this.appRef.detachView(ref.hostView);
        ref.destroy();
        host.remove();
      };

      i.confirmed.subscribe(() => cleanup(true));
      i.cancelled.subscribe(() => cleanup(false));

      this.appRef.attachView(ref.hostView);

      const host = document.createElement('div');
      host.appendChild(ref.location.nativeElement);
      document.body.appendChild(host);

      ref.changeDetectorRef.detectChanges();
    });
  }
}
