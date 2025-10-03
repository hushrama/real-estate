# Image Upload Helper & AddProperty UI Documentation

## Overview
Comprehensive image upload functionality for React Native with Supabase Storage integration, including progress tracking, blob conversion, and fallback strategies.

---

## 1. Image Upload Helper (`src/utils/imageUpload.ts`)

### Key Features
- **Multiple image selection** from gallery (up to 10 images)
- **Camera integration** for taking photos
- **Progress tracking** for batch uploads
- **Blob conversion** with platform-specific handling
- **Fallback strategies** for blob conversion failures
- **Storage path and public URL** return values

### Exported Interfaces

```typescript
export interface UploadedImage {
  storagePath: string;    // Path in Supabase Storage
  publicUrl: string;       // Public accessible URL
  localUri: string;        // Original local URI
}

export interface UploadProgress {
  index: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}
```

### Main Functions

#### `pickMultipleImages(maxImages: number): Promise<string[]>`
Selects multiple images from the device gallery.

```typescript
const uris = await pickMultipleImages(10);
// Returns: ['file:///path/img1.jpg', 'file:///path/img2.jpg', ...]
```

#### `takePhoto(): Promise<string | null>`
Opens camera to take a photo.

```typescript
const uri = await takePhoto();
// Returns: 'file:///path/photo.jpg' or null
```

#### `uploadPropertyImages(propertyId, imageUris, onProgress?): Promise<UploadedImage[]>`
Main upload function with progress tracking.

```typescript
const uploadedImages = await uploadPropertyImages(
  'property-uuid',
  ['file:///img1.jpg', 'file:///img2.jpg'],
  (progress) => {
    console.log('Upload progress:', progress);
  }
);

// Returns:
// [
//   {
//     storagePath: 'property-images/uuid/timestamp_0.jpg',
//     publicUrl: 'https://...supabase.co/.../timestamp_0.jpg',
//     localUri: 'file:///img1.jpg'
//   },
//   ...
// ]
```

#### `uploadSinglePropertyImage(propertyId, uri, displayOrder): Promise<UploadedImage>`
Uploads a single image with display order.

```typescript
const image = await uploadSinglePropertyImage('property-uuid', uri, 0);
```

#### `deletePropertyImage(imageUrl: string): Promise<void>`
Deletes an image from storage.

```typescript
await deletePropertyImage('https://...supabase.co/.../image.jpg');
```

---

## 2. RN-Specific Pitfalls & Solutions

### Problem 1: Blob Construction in React Native
**Issue**: React Native's Blob implementation differs from Web API.

**Solution**: Use `expo-file-system` to read file as base64, then convert to Uint8Array:

```typescript
const base64 = await FileSystem.readAsStringAsync(uri, {
  encoding: 'base64',
});

const byteCharacters = atob(base64);
const byteArray = new Uint8Array(byteCharacters.length);
for (let i = 0; i < byteCharacters.length; i++) {
  byteArray[i] = byteCharacters.charCodeAt(i);
}

const blob = new Blob([byteArray as any], { type: mimeType } as any);
```

**Why**: React Native doesn't have native `Blob` constructor that accepts ArrayBuffer/Uint8Array directly.

### Problem 2: File URI Format
**Issue**: Different platforms use different URI schemes.

**Formats**:
- iOS: `file:///var/mobile/Containers/...`
- Android: `file:///data/user/0/...`
- Web: `blob:http://localhost:...`

**Solution**: Platform-specific handling with fallback to `fetch()`:

```typescript
if (Platform.OS === 'web') {
  const response = await fetch(uri);
  return await response.blob();
}
// ... use FileSystem for native platforms
```

### Problem 3: MIME Type Detection
**Issue**: React Native doesn't provide file metadata like MIME type.

**Solution**: Extract from file extension:

```typescript
const getMimeType = (uri: string): string => {
  const ext = uri.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    // ...
  };
  return mimeTypes[ext || 'jpg'] || 'image/jpeg';
};
```

### Problem 4: Memory Issues with Large Images
**Issue**: Loading multiple large images can cause out-of-memory errors.

**Solution**: 
- Set `quality: 0.8` in ImagePicker options (20% compression)
- Process images sequentially, not in parallel
- Clear progress state after completion

### Problem 5: Permission Handling
**Issue**: iOS and Android require explicit permissions.

**Solution**: Request permissions before access:

```typescript
const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('Permission Required', 'Need camera roll access');
  return false;
}
```

---

## 3. AddProperty Screen (`src/screens/AddPropertyScreen.tsx`)

### Features

#### Image Management
- **Multiple selection** from gallery or camera
- **Thumbnail grid** with numbered badges
- **Reordering** with up/down arrows
- **Delete** individual images
- **First image** is automatically the cover photo

#### Form Validation
- **Required fields**: title, price, address, city, state, zip, bedrooms, bathrooms
- **Type validation**: numeric fields (price, bedrooms, bathrooms)
- **Image requirement**: at least 1 image required
- **Real-time validation**: Publish button disabled until valid

#### Upload Progress
- **Visual feedback** for each image
- **Status indicators**: pending, uploading, completed, error
- **Loading spinner** during upload
- **Error handling** with user-friendly messages

### Usage Flow

1. **Fill form fields** (required fields marked with *)
2. **Add images** via gallery or camera
3. **Reorder images** to set cover photo (first position)
4. **Click Publish** (disabled until valid)
5. **Images upload** with progress indicators
6. **Property created** in database
7. **Image records** linked to property
8. **Navigate back** on success

### Validation Rules

```typescript
// Required fields check
const requiredFields = [
  'title', 'price', 'address', 'city', 'state', 
  'zipCode', 'bedrooms', 'bathrooms', 'propertyType'
];

// Numeric validation
price > 0
bedrooms >= 0
bathrooms >= 0

// Image requirement
images.length > 0
```

### Property Type Selection
- **Options**: House, Apartment, Condo, Townhouse
- **Visual buttons** with active state styling
- **Default**: House

### Amenities Input
- **Format**: Comma-separated values
- **Example**: "Pool, Garage, Fireplace, Modern Kitchen"
- **Processing**: Split, trim, filter empty strings

### Image Reordering

```typescript
// Move image up or down
const handleReorderImage = (fromIndex: number, direction: 'up' | 'down') => {
  const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
  
  if (toIndex < 0 || toIndex >= images.length) return;
  
  setImages(prev => {
    const updated = [...prev];
    [updated[fromIndex], updated[toIndex]] = [updated[toIndex], updated[fromIndex]];
    return updated.map((img, i) => ({ ...img, order: i }));
  });
};
```

---

## 4. Development Tools

### Recommended Packages

#### For debugging blob issues:
```bash
npm install rn-fetch-blob
```

Usage:
```typescript
import RNFetchBlob from 'rn-fetch-blob';

const blob = await RNFetchBlob.fs.readFile(uri, 'base64');
```

#### For advanced file operations:
```bash
npm install expo-file-system
```

Already integrated in the upload helper.

### Debugging Tips

#### 1. Log blob information:
```typescript
console.log('Blob size:', blob.size);
console.log('Blob type:', blob.type);
console.log('URI:', uri);
```

#### 2. Test on different platforms:
- Test on iOS device (not simulator for camera)
- Test on Android device
- Test on web (different blob handling)

#### 3. Monitor network requests:
```typescript
// In Supabase upload
const { error: uploadError } = await supabase.storage
  .from('properties')
  .upload(storagePath, blob, {
    contentType: getMimeType(uri),
    upsert: false,
  });

console.log('Upload error:', uploadError);
```

#### 4. Check Supabase Storage:
- Navigate to Supabase Dashboard → Storage → properties bucket
- Verify files are uploaded with correct paths
- Check file sizes and content types

### Common Issues & Fixes

#### Issue: "Failed to convert image URI"
**Cause**: Blob conversion failed
**Fix**: Check file URI format, verify file exists

#### Issue: "Upload failed with 400 error"
**Cause**: Invalid content type or blob format
**Fix**: Verify MIME type is correct, check blob construction

#### Issue: "Out of memory error"
**Cause**: Too many large images
**Fix**: Reduce image quality, process sequentially

#### Issue: "Permission denied"
**Cause**: Missing gallery/camera permissions
**Fix**: Call permission request functions before picker

---

## 5. Storage Structure

### Supabase Storage Path Format
```
properties/
  └── property-images/
      └── {propertyId}/
          ├── {timestamp}_0.jpg    (cover photo)
          ├── {timestamp}_1.jpg
          └── {timestamp}_2.jpg
```

### Database Records

#### `properties` table:
```sql
{
  id: uuid,
  seller_id: uuid,
  title: text,
  price: numeric,
  amenities: jsonb,  -- ['Pool', 'Garage', ...]
  status: 'available',
  ...
}
```

#### `property_images` table:
```sql
{
  id: uuid,
  property_id: uuid,
  image_url: text,     -- Public URL
  display_order: int,  -- 0 = cover photo
  created_at: timestamp
}
```

---

## 6. Performance Considerations

### Image Optimization
- **Quality**: 0.8 (80%) quality setting in ImagePicker
- **Max images**: 10 images per property
- **Sequential upload**: Process one image at a time
- **Progress tracking**: Update UI after each image

### Memory Management
```typescript
// Clear progress after completion
onSettled: () => {
  setIsUploading(false);
  setUploadProgress([]);
}
```

### Network Efficiency
- **Blob reuse**: Convert URI once, upload immediately
- **Error recovery**: Throw error on first failure (don't continue batch)
- **Storage paths**: Use timestamps to avoid naming conflicts

---

## 7. Testing Checklist

- [ ] Pick single image from gallery
- [ ] Pick multiple images (10 max)
- [ ] Take photo with camera
- [ ] Reorder images (up/down)
- [ ] Delete images
- [ ] Form validation (required fields)
- [ ] Numeric field validation
- [ ] Upload progress indicators
- [ ] Error handling (network failure)
- [ ] Success flow (property created)
- [ ] Image display in property details
- [ ] Multiple platform testing (iOS/Android/Web)

---

## 8. Security Notes

### Storage Policies
- **Bucket**: `properties` (should be public for read)
- **RLS**: Enable Row Level Security on `property_images` table
- **Upload auth**: Only authenticated sellers can upload

### File Validation
- **Type checking**: Only allow image MIME types
- **Size limits**: Consider adding max file size check
- **Content verification**: Validate file is actually an image

### Public URLs
- Generated by Supabase Storage
- Publicly accessible (no auth required for viewing)
- Permanent URLs (don't change unless file deleted)

---

## Acceptance Criteria ✅

✅ Upload function returns array of storage paths and public URLs
✅ AddProperty UI disables Publish until required fields are valid
✅ Progress tracking for batch uploads
✅ Image reordering with visual feedback
✅ RN-specific blob handling with fallback strategies
✅ Comprehensive error handling
✅ Platform-specific URI handling
✅ MIME type detection from file extension
✅ Memory-efficient sequential processing
✅ Form validation with clear error messages
