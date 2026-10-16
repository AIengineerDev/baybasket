'use client';

import {useState} from 'react';
import {ImageOff} from 'lucide-react';
import type {Product} from '../lib/catalog';
import {productImageSources} from '../lib/product-images.mjs';
import photoData from '../lib/generated-product-photos.json';

const productAssets: Record<string, string> = photoData.productAssets;
const photos: Record<string, string> = photoData.photos;

export function ProductImage({product, small = false}: {product: Product; small?: boolean}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const embeddedPhoto = photos[productAssets[product.id]];
  const sources = [embeddedPhoto, ...productImageSources(product)].filter(Boolean);
  const src = sources.find((url: string) => !failedUrls.includes(url));

  if (src) return <img
    key={src}
    className={small ? 'thumb' : 'retail-photo'}
    src={src}
    alt={product.name}
    loading="lazy"
    decoding="async"
    referrerPolicy="no-referrer"
    width={small ? 36 : 240}
    height={small ? 36 : 160}
    onError={() => setFailedUrls(failed => failed.includes(src) ? failed : [...failed, src])}
  />;

  return product.imageUrl
    ? <span className="photo-fallback"><ImageOff size={25}/><small>Photo unavailable</small></span>
    : <span>{product.icon || '🛒'}</span>;
}
