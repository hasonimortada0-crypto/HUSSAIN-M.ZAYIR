import type { Product } from './types';

export const PRODUCT_WARRANTY = 'ضمان حقيقي استبدال لمدة سنتين';

export function withProductWarranty(product: Product): Product {
  return {
    ...product,
    specs: {
      ...(product.specs || {}),
      'الضمان': PRODUCT_WARRANTY,
    },
  };
}
