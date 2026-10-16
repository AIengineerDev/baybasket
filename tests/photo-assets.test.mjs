import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {productImageSources} from '../lib/product-images.mjs';

// Run after building: validate the files that will actually be deployed.
const catalog = JSON.parse(readFileSync('data/live.json', 'utf8'));
const embedded = JSON.parse(readFileSync('lib/generated-product-photos.json', 'utf8'));
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const assets = resolve('dist/server', config.assets.directory);
const unique = new Set();
for (const product of catalog.products) {
  assert.match(product.imageUrl, /^\/products\/[a-f0-9]+\.(jpg|png)$/);
  const built = readFileSync(resolve(assets, '.' + product.imageUrl));
  const source = readFileSync('public' + product.imageUrl);
  const dataUrl = embedded.photos[embedded.productAssets[product.id]];
  assert.match(dataUrl, /^data:image\/(jpeg|png);base64,/);
  assert.deepEqual(Buffer.from(dataUrl.split(',')[1], 'base64'), source,
    'The embedded photo must be the actual collected image, including for old cached search records');
  assert.deepEqual(built, source, 'Packaged photo must match its collected file');
  const magic = product.imageUrl.endsWith('.jpg') ? 'ffd8ff' : '89504e470d0a1a0a';
  assert.equal(built.subarray(0, magic.length / 2).toString('hex'), magic);
  const sources = productImageSources(product);
  assert.equal(sources[0], product.imageUrl);
  assert.match(sources[1], /^https:\/\//, 'Every real product needs a retailer photo backup');
  if (product.id.startsWith('target:')) assert.equal(new URL(sources[1]).searchParams.get('fmt'), 'jpeg');
  unique.add(product.imageUrl);
}
assert.deepEqual(productImageSources({imageUrl: '/same.jpg', imageSource: '/same.jpg'}), ['/same.jpg']);
assert.deepEqual(productImageSources({}), []);
console.log(JSON.stringify({products: catalog.products.length, packagedPhotos: unique.size, embeddedPhotos: Object.keys(embedded.productAssets).length, retailerBackups: 'passed'}));
