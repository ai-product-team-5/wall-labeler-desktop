import { onBeforeUnmount, onMounted } from 'vue';

export function useKeyboardShortcuts(handler: (event: KeyboardEvent) => void) {
  const onKeydown = (event: KeyboardEvent) => {
    handler(event);
  };

  onMounted(() => {
    document.addEventListener('keydown', onKeydown, true);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown, true);
  });
}
