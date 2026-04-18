import type { ProjectEditor } from '@/types/editor';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

export function useProjectKeyboardShortcuts(
  editor: Pick<ProjectEditor, 'state' | 'actions' | 'controls'>
) {
  useKeyboardShortcuts((event) => {
    if (isTypingTarget(event.target)) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void editor.actions.saveProject(false);
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editor.state.selectedWallId) {
        event.preventDefault();
        editor.actions.deleteSelectedWall();
      }
      return;
    }

    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'c'
    ) {
      if (editor.state.image) {
        event.preventDefault();
        editor.controls.toggleCornerSnap();
      }
      return;
    }

    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'v'
    ) {
      if (editor.state.image) {
        event.preventDefault();
        editor.controls.toggleShowCorners();
      }
      return;
    }

    if (event.key === 'Enter' || event.code === 'NumpadEnter') {
      event.preventDefault();
      editor.controls.finishDraft();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      editor.controls.cancelDraft();
    }
  });
}
