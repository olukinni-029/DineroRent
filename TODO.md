# TODO

## Move Admin Endpoints to Admin Controller

### Tasks
- [x] Move `approveVendor` and `rejectVendor` functions from `vendor.controller.ts` to `admin.controller.ts`
- [x] Update `admin.routes.ts` to include routes for approve and reject vendor endpoints
- [x] Remove `approveVendor` and `rejectVendor` functions from `vendor.controller.ts`
- [x] Remove approve and reject routes from `vendor.routes.ts`
- [x] Ensure proper imports in `admin.controller.ts` (VendorService, asyncHandler, etc.)
- [x] Test the moved endpoints to ensure functionality is preserved
- [x] Move `approveListing` function from `listing.controller.ts` to `admin.controller.ts`
- [x] Update `admin.routes.ts` to include route for approve listing endpoint
- [x] Remove `approveListing` function from `listing.controller.ts`
- [x] Remove approve listing route from `listing.routes.ts` (if exists)
