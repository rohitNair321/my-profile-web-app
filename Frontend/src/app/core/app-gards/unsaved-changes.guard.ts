import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import { ConfirmDialogService } from '../services/confirm-dialog.service';

/**
 * Any admin page with editable form state should implement this so the
 * unsavedChangesGuard can prompt Save / Discard / Keep-editing before leaving.
 */
export interface AdminDirtyComponent {
  /** True when the page holds unsaved edits */
  isDirty(): boolean;
  /** Persist the edits. May return an Observable or Promise the guard awaits. */
  saveChanges(): Observable<any> | Promise<any>;
  /** Revert edits back to the last-saved state */
  discardChanges(): void;
}

/**
 * Blocks navigation away from an admin page with unsaved changes and shows the
 * shared confirm dialog (Save / Discard / Keep editing). Safe to attach to any
 * route — if the component does not implement the interface, it is a no-op.
 */
export const unsavedChangesGuard: CanDeactivateFn<Partial<AdminDirtyComponent>> = async (component) => {
  if (typeof component?.isDirty !== 'function' || !component.isDirty()) {
    return true;
  }

  const dialog = inject(ConfirmDialogService);
  const choice = await dialog.choice({
    title:   'Unsaved changes',
    message: 'You have unsaved changes on this page. Do you want to save them before leaving?',
    icon:    'save',
  });

  if (choice === 'cancel') return false;

  if (choice === 'discard') {
    component.discardChanges?.();
    return true;
  }

  // choice === 'save'
  try {
    const result = component.saveChanges!();
    if (isObservable(result)) {
      await firstValueFrom(result);
    } else {
      await result;
    }
    return true;
  } catch {
    // Save failed — keep the user on the page so they don't lose data
    return false;
  }
};
