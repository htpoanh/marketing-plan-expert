// Zod runtime schemas — primary export surface (each name is a `z.object(...)`).
export * from "./generated/api";

// TypeScript types — re-exported under a separate namespace to avoid name
// collisions (Orval generates both a Zod schema *and* a TS type for every
// schema, so `export *` from both clashes for shared names like
// `CreateBrandBody`, `GenerateAdsAudienceBody`, etc.).
//
// Usage:
//   import { CreateBrandBody as CreateBrandBodySchema } from "@workspace/api-zod"; // zod
//   import { types } from "@workspace/api-zod";                                     // ts types
//   const body: types.CreateBrandBody = { ... };
export * as types from "./generated/types";
