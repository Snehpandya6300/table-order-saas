/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as aggregatorAdapters from "../aggregatorAdapters.js";
import type * as aggregatorIngest from "../aggregatorIngest.js";
import type * as aggregatorInternal from "../aggregatorInternal.js";
import type * as aggregatorSignature from "../aggregatorSignature.js";
import type * as aggregatorWebhook from "../aggregatorWebhook.js";
import type * as aggregators from "../aggregators.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as categories from "../categories.js";
import type * as couponOps from "../couponOps.js";
import type * as customers from "../customers.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as inventoryOps from "../inventoryOps.js";
import type * as marketing from "../marketing.js";
import type * as marketingInternal from "../marketingInternal.js";
import type * as menuAi from "../menuAi.js";
import type * as menuItems from "../menuItems.js";
import type * as orders from "../orders.js";
import type * as otp from "../otp.js";
import type * as planRequests from "../planRequests.js";
import type * as reportCatalogue from "../reportCatalogue.js";
import type * as reports from "../reports.js";
import type * as reservations from "../reservations.js";
import type * as restaurants from "../restaurants.js";
import type * as riders from "../riders.js";
import type * as staff from "../staff.js";
import type * as tables from "../tables.js";
import type * as tokens from "../tokens.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  aggregatorAdapters: typeof aggregatorAdapters;
  aggregatorIngest: typeof aggregatorIngest;
  aggregatorInternal: typeof aggregatorInternal;
  aggregatorSignature: typeof aggregatorSignature;
  aggregatorWebhook: typeof aggregatorWebhook;
  aggregators: typeof aggregators;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  categories: typeof categories;
  couponOps: typeof couponOps;
  customers: typeof customers;
  http: typeof http;
  inventory: typeof inventory;
  inventoryOps: typeof inventoryOps;
  marketing: typeof marketing;
  marketingInternal: typeof marketingInternal;
  menuAi: typeof menuAi;
  menuItems: typeof menuItems;
  orders: typeof orders;
  otp: typeof otp;
  planRequests: typeof planRequests;
  reportCatalogue: typeof reportCatalogue;
  reports: typeof reports;
  reservations: typeof reservations;
  restaurants: typeof restaurants;
  riders: typeof riders;
  staff: typeof staff;
  tables: typeof tables;
  tokens: typeof tokens;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
