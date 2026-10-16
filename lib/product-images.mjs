// Keep a same-product retailer image as a backup when a local asset cannot load.
export function productImageSources(product) {
  let original = product.imageSource;
  if (original) {
    try {
      const url = new URL(original);
      if (url.protocol !== 'https:') original = undefined;
      else if (url.hostname === 'target.scene7.com') {
        url.searchParams.set('wid', '360');
        url.searchParams.set('hei', '360');
        url.searchParams.set('fmt', 'jpeg');
        original = url.href;
      }
    } catch { original = undefined; }
  }
  return [...new Set([product.imageUrl, original].filter(Boolean))];
}
