# Duplicate Detection Workflow Change Plan

## Objective
Move duplicate application detection from `onBlur` (when leaving job description field) to trigger AFTER clicking "Generate CV" button.

## Current Behavior
- Duplicate check fires on `onBlur` of job description textarea in `NewApplication.tsx`
- Shows yellow warning box inline on form
- "Generate CV" proceeds immediately without duplicate check

## Desired Behavior
- User fills out form
- User clicks "Generate CV"
- System checks for duplicates
- If duplicates found → show confirmation dialog warning user
- User can proceed anyway or cancel
- If no duplicates → proceed directly with generation

## Implementation Steps

### 1. Modify `src/pages/NewApplication.tsx`

**Remove existing onBlur duplicate check:**
- Remove `onBlur` handler from job description textarea that calls `/api/applications/check-duplicate`
- Remove `duplicateWarning` state (or repurpose it)
- Remove `checkingDuplicate` state
- Remove inline warning box display

**Add new state for dialog:**
```typescript
const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
const [pendingFormData, setPendingFormData] = useState(formData);
const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
```

**Modify handleSubmit:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // First check for duplicates
  setIsCheckingDuplicate(true);
  try {
    const res = await fetch('/api/applications/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobDescription: formData.jobDescription,
        companyName: formData.companyName,
        jobTitle: formData.jobTitle,
      }),
    });
    const data = await res.json();
    
    if (data.hasDuplicate) {
      setDuplicateWarning(data);
      setPendingFormData(formData);
      setShowDuplicateDialog(true);
      setIsCheckingDuplicate(false);
      return;
    }
  } catch {
    // Continue anyway if duplicate check fails
  }
  setIsCheckingDuplicate(false);
  
  // Proceed with generation...
  startGeneration(formData);
};
```

**Add confirmation dialog:**
- Use existing `ConfirmDialog` component
- Show duplicate matches with similarity percentages
- Buttons: "Generate Anyway" (primary) and "Cancel" (secondary)
- On confirm → proceed with `pendingFormData`

**Refactor existing inline warning box:**
- Move the duplicate matches display into the dialog
- Reuse the yellow warning styling

## Files to Modify
- `src/pages/NewApplication.tsx` - main changes

## No Backend Changes Required
The existing `/api/applications/check-duplicate` endpoint already exists and works correctly.
