import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// This small POC carries its real retailer photos with its UI. A photo cannot
// fail because a separate public asset request reaches an older deployment.
// Price search responses contain no photo bytes and retain their small payload.
const catalog = JSON.parse(readFileSync(new URL('../data/live.json', import.meta.url), 'utf8'));
const productAssets = {};
const photos = {};
let bytes = 0;
for (const product of catalog.products) {
  if (!product.imageUrl?.startsWith('/products/')) continue;
  if (!/^\/products\/[a-f0-9]+\.(jpg|png)$/.test(product.imageUrl)) {
    throw new Error(`Unsupported photo path for ${product.id}`);
  }
  const photo = readFileSync(new URL('../public' + product.imageUrl, import.meta.url));
  const jpeg = photo.subarray(0, 3).toString('hex') === 'ffd8ff';
  const png = photo.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (!jpeg && !png) throw new Error(`Invalid photo bytes for ${product.id}`);
  const key = createHash('sha256').update(photo).digest('hex').slice(0, 20);
  if (!photos[key]) {
    photos[key] = `data:image/${jpeg ? 'jpeg' : 'png'};base64,${photo.toString('base64')}`;
    bytes += photo.length;
  }
  productAssets[product.id] = key;
}
writeFileSync(new URL('../lib/generated-product-photos.json', import.meta.url), JSON.stringify({productAssets, photos}));
console.log(JSON.stringify({embeddedProductPhotos: Object.keys(productAssets).length, uniquePhotos: Object.keys(photos).length, photoBytes: bytes}));
