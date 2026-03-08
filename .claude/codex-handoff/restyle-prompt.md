# Codex Restyle Prompt for Pocket Stylist

Copy this ENTIRE prompt into Codex Desktop after connecting to the GitHub repo.

---

## PROMPT TO PASTE INTO CODEX:

```
TASK: Restyle the UI of the Pocket Stylist PWA.
DO NOT change any functionality, API calls, business logic, or data flow.
ONLY change visual styling of React components.

TECH STACK: React + TypeScript + TailwindCSS. Keep it.

DESIGN DIRECTION:
- Modern, clean, fashion-forward aesthetic
- Inspiration: Zara app meets Apple Health UI
- Dark mode by default with warm accent colors
- Typography: Inter or similar modern sans-serif
- Generous whitespace, large touch targets (mobile-first)
- Subtle micro-animations: card fade-in, swipe transitions, pulse on tap
- Outfit cards: magazine-style layout with overlapping images
- Color palette: deep charcoal (#1a1a2e), warm gold accent (#e2b857), soft cream (#faf0e6)

COMPONENT-BY-COMPONENT INSTRUCTIONS:

1. IMPORT FLOW (src/components/import/):
   - BulkPhotoUpload: drag-drop zone with dashed border, animated cloud icon
   - ImportProgress: sleek progress ring (not bar), item count in center
   - ItemReviewCard: polaroid-style card with editable tags as pills

2. STYLING ENGINE (src/components/styling/):
   - MoodSlider: gradient track (blue→red for energy, gray→gold for boldness)
   - DailyOutfits: horizontal swipe cards, 3D card tilt effect on hover
   - OutfitCard: clothing items arranged as aesthetic flat-lay, not grid
   - WeeklyLookbook: calendar strip on top, outfit preview below each day

3. SCANNER (src/components/scanner/):
   - CameraScanner: full-screen camera with subtle corner brackets overlay
   - VerdictCard: large verdict icon with animated entrance
   - BUY = green glow, SKIP = red subtle, CONSIDER = gold

4. CELEBRITY MATCHING (src/components/matching/):
   - ReferenceUpload: Pinterest-style upload area
   - RecreationResults: side-by-side slider (original vs your version)
   - ShareableImage: Instagram Story format (1080x1920)

5. ANALYTICS (src/components/analytics/):
   - WardrobeROI: clean data viz with Recharts, gold accent bars
   - EcoDashboard: nature-inspired colors (greens, blues)
   - GapAnalysis: donut charts showing wardrobe vs calendar balance

6. GLOBAL:
   - Navigation: bottom tab bar (mobile), slide-out sidebar (desktop)
   - Loading states: skeleton screens matching card shapes
   - Empty states: illustrated placeholders with call-to-action
   - Toast notifications: minimal, bottom-right, auto-dismiss 3s

RULES:
- Keep ALL TypeScript types, props, hooks, API calls EXACTLY as they are
- Only modify: className strings, layout structure, TailwindCSS classes
- You MAY add new Tailwind classes or small CSS animations in globals.css
- You MAY restructure JSX layout within components for better visual flow
- You MUST NOT rename files, change exports, or modify any .ts (non-tsx) file
- You MUST NOT remove or change any onClick, onChange, onSubmit handlers
- Test: npm run typecheck && npm run build must pass after your changes

START with the most impactful screens first:
1. DailyOutfits (main screen users see)
2. OutfitCard (most viewed component)
3. MoodSlider (first interaction each day)
4. BulkPhotoUpload (onboarding)
5. CameraScanner (wow-factor feature)
```

---

## HOW TO USE THIS:

1. Open Codex Desktop on your computer
2. Point it to the GitHub repo
3. Paste the prompt above
4. Let Codex restyle the components
5. Review the changes in the Codex diff view
6. If happy: commit and push
7. Railway auto-deploys the beautiful version

## NOTES:
- If Codex breaks typecheck: tell it "npm run typecheck shows errors, fix them"
- If animations are too heavy: ask to "remove animations, keep the layout"
- For Ukrainian localization: add separate prompt "Translate all UI strings to Ukrainian"
