export const DEFAULT_PRODUCT_IMAGE = '/product-placeholder.svg';

export function useImageFallback(image: HTMLImageElement) {
  if (!image.src.endsWith(DEFAULT_PRODUCT_IMAGE)) {
    image.src = DEFAULT_PRODUCT_IMAGE;
  }
}
