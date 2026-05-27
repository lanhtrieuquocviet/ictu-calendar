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

  confirmWithInput(options: ConfirmDialogOptions): Promise<string | null> {
    return new Promise(resolve => {
      const ref = createComponent(ConfirmDialogComponent, {
        environmentInjector: this.injector,
      });

      const i = ref.instance;
      if (options.title)            i.title            = options.title;
      if (options.message)          i.message          = options.message;
      if (options.confirmText)      i.confirmText      = options.confirmText;
      if (options.cancelText)       i.cancelText       = options.cancelText;
      if (options.type)             i.type             = options.type;
      if (options.inputLabel)       i.inputLabel       = options.inputLabel;
      if (options.inputPlaceholder) i.inputPlaceholder = options.inputPlaceholder;

      const cleanup = (result: string | null) => {
        resolve(result);
        this.appRef.detachView(ref.hostView);
        ref.destroy();
        host.remove();
      };

      i.confirmed.subscribe((val: string) => cleanup(val ?? ''));
      i.cancelled.subscribe(() => cleanup(null));

      this.appRef.attachView(ref.hostView);

      const host = document.createElement('div');
      host.appendChild(ref.location.nativeElement);
      document.body.appendChild(host);

      ref.changeDetectorRef.detectChanges();
    });
  }
}
