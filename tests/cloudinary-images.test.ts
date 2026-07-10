import assert from "node:assert/strict";
import test from "node:test";
import { isCloudinaryImageUrl, wardrobeCatalogImageUrl } from "../src/utils/cloudinaryImages";

test("isCloudinaryImageUrl detects Cloudinary delivery URLs", () => {
  assert.equal(
    isCloudinaryImageUrl("https://res.cloudinary.com/demo/image/upload/v123/folder/item.jpg"),
    true,
  );
  assert.equal(isCloudinaryImageUrl("https://example.test/item.jpg"), false);
  assert.equal(isCloudinaryImageUrl("not-a-url"), false);
});

test("wardrobeCatalogImageUrl adds background removal to Cloudinary images", () => {
  assert.equal(
    wardrobeCatalogImageUrl("https://res.cloudinary.com/demo/image/upload/v123/folder/item.jpg"),
    "https://res.cloudinary.com/demo/image/upload/e_background_removal,q_auto,f_auto/v123/folder/item.jpg",
  );
});

test("wardrobeCatalogImageUrl preserves existing Cloudinary transformations", () => {
  assert.equal(
    wardrobeCatalogImageUrl("https://res.cloudinary.com/demo/image/upload/c_fill,w_640/v123/folder/item.jpg"),
    "https://res.cloudinary.com/demo/image/upload/e_background_removal,q_auto,f_auto/c_fill,w_640/v123/folder/item.jpg",
  );
});

test("wardrobeCatalogImageUrl is idempotent and leaves non-Cloudinary URLs unchanged", () => {
  const transformed =
    "https://res.cloudinary.com/demo/image/upload/e_background_removal,q_auto,f_auto/v123/folder/item.jpg";

  assert.equal(wardrobeCatalogImageUrl(transformed), transformed);
  assert.equal(wardrobeCatalogImageUrl("https://example.test/item.jpg"), "https://example.test/item.jpg");
});
