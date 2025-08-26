# Setlist Planner Matrix Dot Menu Implementation

## Overview
This implementation adds a dot menu (⋮) to each row in the setlist planner matrix view, allowing users to edit rows in a modal dialog.

## Changes Made

### 1. New Component: SetlistPlannerRowEditor
- **Location**: `src/core/components/setlistPlan/SetlistPlanMainComponents.tsx`
- **Purpose**: Extracted row editing functionality from the songs tab into a reusable modal component
- **Features**: 
  - Displays song name for song rows
  - Shows row type indicator (Song/Divider)
  - Provides delete button functionality
  - Includes markdown comment editor
  - Uses ReactiveInputDialog for mobile-responsive modal

### 2. DotMenu Integration
- **Song Rows**: Added dot menu with "Edit" option to `SetlistPlannerMatrixSongRow`
- **Divider Rows**: Added dot menu with "Edit" option to `SetlistPlannerDividerRow`
- **State Management**: Added React state for dialog visibility and menu closing
- **User Flow**: Click dots → Select "Edit" → Modal opens with row editor

### 3. Table Structure Updates
- **New Column**: Added `.td.dotMenu` column to all table structures
- **CSS**: Added `--dot-menu-width: 30px` variable and styling for the new column
- **Consistency**: Added dotMenu column to:
  - Header row
  - Song rows
  - Divider rows  
  - All footer rows (3 total)

### 4. CSS Changes
```css
.SetlistPlannerMatrix {
    --dot-menu-width: 30px;  /* New variable */
}

.SetlistPlannerMatrix .td.dotMenu {
    width: var(--dot-menu-width);
    white-space: nowrap;
    justify-content: center;
    align-items: center;
}
```

## Column Structure (Left to Right)
1. **Delete** - Delete button (existing)
2. **Song Name** - Song info and controls (existing)
3. **Song Length** - Duration display (existing)  
4. **Segments** - Multiple allocation columns (existing)
5. **Rehearsal Time** - Total time (existing)
6. **Balance** - Point balance (existing)
7. **Dot Menu** - **NEW** - Three dots menu with edit option

## User Experience
1. User sees three vertical dots (⋮) in the rightmost column of each song/divider row
2. Clicking the dots opens a dropdown menu with "Edit" option
3. Clicking "Edit" opens a modal dialog with:
   - Song name (for song rows)
   - Row type indicator (Song/Divider chip)
   - Delete button
   - Comment editor (Markdown)
   - Close button

## Technical Details
- **State Management**: Uses React.useState for dialog visibility and menu closing
- **Type Safety**: Proper TypeScript interfaces for all components
- **Accessibility**: Uses Material-UI components for consistent UX
- **Responsive**: ReactiveInputDialog ensures mobile compatibility
- **Performance**: Conditional rendering to only mount dialog when needed

## Files Modified
1. `src/core/components/setlistPlan/SetlistPlanMainComponents.tsx` - Main implementation
2. `public/style/setlistPlan.css` - Column styling

## Testing
The implementation follows existing patterns in the codebase and should work correctly when the application runs. All component exports and imports are properly structured.