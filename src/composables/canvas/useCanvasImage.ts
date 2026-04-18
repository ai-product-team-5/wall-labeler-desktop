import { nextTick, ref, watch, type Ref } from 'vue';
import type { ImageAsset } from '@/types/project';

interface UseCanvasImageOptions {
  image: Ref<ImageAsset | null>;
  resetTransientState: () => void;
  onImageReady: () => void;
}

export function useCanvasImage(options: UseCanvasImageOptions) {
  const imageElement = ref<HTMLImageElement | null>(null);

  // 图片切换时，把草稿和视口之类的临时状态重置掉，避免上一个项目残留。
  watch(
    () => options.image.value?.dataUrl,
    async (dataUrl) => {
      options.resetTransientState();

      if (!dataUrl) {
        imageElement.value = null;
        return;
      }

      const img = new window.Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      imageElement.value = img;
      await nextTick();
      options.onImageReady();
    },
    { immediate: true }
  );

  return {
    imageElement
  };
}
