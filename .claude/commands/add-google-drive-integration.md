---
name: add-google-drive-integration
description: Add Google Drive file picker integration to the wardrobe import flow. Use this skill when the user asks to add Google Drive upload, import from Google Drive, connect Google Drive to the app, add a "load from Drive" button, or integrate cloud storage for photo/file imports. Covers Google Drive Picker API setup, OAuth scope expansion, UI button creation, and file download handling.
---

# Add Google Drive Integration

Add a "Upload from Google Drive" button to the wardrobe import page that lets users pick photos from their Google Drive.

## Architecture overview

The Google Drive Picker API runs entirely in the browser. The flow is:

1. User clicks "Upload from Google Drive" button
2. App requests additional OAuth scope (`drive.readonly`) using the existing Google auth
3. Google Picker UI opens (Google-hosted modal)
4. User selects files
5. App downloads selected files via Google Drive API
6. Files are processed through the existing import pipeline (compress → analyze → save)

## Implementation plan

### Step 1: Google Cloud Console setup

Use Playwright to configure APIs:

1. Go to Google Cloud Console → APIs & Services → Library
2. Enable **Google Drive API** (if not already enabled)
3. Enable **Google Picker API**
4. Go to Credentials → OAuth 2.0 Client ID
5. Note the Client ID (same one used for Google Sign-In)
6. Create or note an **API Key** for the Picker (restricted to Drive Picker API)
7. Add the API key to `.env`:
   ```
   GOOGLE_PICKER_API_KEY=your_key_here
   ```
8. Expose it via the backend status endpoint or Vite env (`VITE_GOOGLE_PICKER_API_KEY`)

### Step 2: Add OAuth scope for Drive

Modify the Google Sign-In initialization to request Drive read access:

**File: `src/pages/LoginPage.tsx`** or wherever Google Sign-In is initialized:

The Picker API needs an OAuth access token (not the ID token used for authentication). Two approaches:

**Option A: Incremental authorization (recommended)**
- Keep login as-is (only `openid email profile` scope)
- When user clicks "Upload from Drive", request incremental consent for `https://www.googleapis.com/auth/drive.readonly`
- Use `google.accounts.oauth2.initTokenClient()` for the incremental scope

**Option B: Request at login**
- Add Drive scope to initial login (heavier, requires re-consent from all users)

Go with **Option A** — it's less intrusive and follows Google's best practices.

### Step 3: Create Google Drive Picker component

Create `src/components/import/GoogleDrivePicker.tsx`:

```typescript
// Key implementation points:

// 1. Load the Google Picker API script dynamically
//    <script src="https://apis.google.com/js/api.js">

// 2. Initialize token client for Drive scope
//    const tokenClient = google.accounts.oauth2.initTokenClient({
//      client_id: GOOGLE_CLIENT_ID,
//      scope: 'https://www.googleapis.com/auth/drive.readonly',
//      callback: (response) => { /* use response.access_token */ }
//    });

// 3. Build and show the Picker
//    const picker = new google.picker.PickerBuilder()
//      .addView(google.picker.ViewId.DOCS_IMAGES)  // Only show images
//      .setOAuthToken(accessToken)
//      .setDeveloperKey(PICKER_API_KEY)
//      .setCallback(pickerCallback)
//      .setMaxItems(20)  // Match existing batch limit
//      .build();

// 4. In pickerCallback, for each selected file:
//    - Fetch file content via Drive API: GET https://www.googleapis.com/drive/v3/files/{id}?alt=media
//    - Convert to base64
//    - Feed into existing importApi.analyzeImage() pipeline

// 5. Handle errors gracefully:
//    - User denies Drive permission → show friendly message
//    - File too large → compress first
//    - Network error → retry with exponential backoff
```

### Step 4: Integrate into ImportPage

**File: `src/pages/ImportPage.tsx`**

Add the Google Drive button alongside the existing DropZone:

```
Import photos:
[DropZone - drag & drop / file picker]
[📁 Upload from Google Drive]    ← NEW BUTTON
```

The button should:
- Be styled consistently with the existing UI (TailwindCSS)
- Use a Google Drive icon (from lucide-react: `HardDrive` or custom SVG)
- Show loading state while Picker loads
- Only appear when user is logged in via Google (not demo mode)

### Step 5: Handle downloaded files

Once files are picked from Drive:
1. Download each file using the access token
2. Convert to `File` objects
3. Run through `compressImageToBase64()` (existing utility)
4. Call `importApi.analyzeImage()` for each (same as DropZone flow)
5. Show progress in the existing batch UI

### Step 6: Environment variables

Add to `.env.example`:
```
GOOGLE_PICKER_API_KEY=YOUR_PICKER_API_KEY_HERE
```

Add to `server/api/index.ts` status endpoint (or use VITE_ prefix for client-side):
```typescript
// Expose picker config to frontend
GOOGLE_PICKER_API_KEY: !!process.env.GOOGLE_PICKER_API_KEY
```

### Step 7: Update types

Add Drive-related types to `src/types/`:
```typescript
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
}
```

## Testing checklist

After implementation:
- [ ] `npm run typecheck` passes
- [ ] Button appears only for Google-authenticated users
- [ ] Clicking button shows Google consent (first time only)
- [ ] Picker opens and shows user's Drive images
- [ ] Selected images flow through existing import pipeline
- [ ] Batch progress works correctly
- [ ] Demo mode: button is hidden or disabled with tooltip
- [ ] Error handling: permission denied, network failure, unsupported file type

## Security considerations

- The Drive access token is used client-side only, never sent to the backend
- Access token has short expiry (~1 hour), no refresh token needed
- Only `drive.readonly` scope — app cannot modify user's Drive
- Files are downloaded client-side, compressed, then sent through existing upload flow
- No Drive file metadata is stored in the database
