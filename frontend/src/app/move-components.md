# Component Migration Instructions

To complete the setup for localhost, you need to copy all components from the root `/components` directory to `/src/components/`.

## Manual Steps Required:

1. **Create the src/components directory structure**:
   ```bash
   mkdir -p src/components/ui
   mkdir -p src/components/figma
   ```

2. **Copy all component files**:
   ```bash
   # Copy main components
   cp components/*.tsx src/components/
   
   # Copy UI components
   cp components/ui/*.tsx src/components/ui/
   cp components/ui/*.ts src/components/ui/
   
   # Copy figma components
   cp components/figma/*.tsx src/components/figma/
   ```

3. **Update import paths in all components**:
   After copying, you'll need to update import paths in all component files:
   - Change `'./ui/component'` to `'./ui/component'` (should remain the same)
   - Change `'./components/ComponentName'` to `'./ComponentName'`
   - The imports in App.tsx are already updated to use the src structure

4. **Run the development server**:
   ```bash
   npm install
   npm run dev
   ```

## Alternative Quick Setup:

If you want to set this up quickly, you can use the assistant to help copy the individual component files by asking to copy specific components to the new src structure.

## Expected Final Structure:
```
src/
├── components/
│   ├── AgentDashboard.tsx
│   ├── AgentPerformance.tsx
│   ├── AgentProfile.tsx
│   ├── (... all other main components)
│   ├── ui/
│   │   ├── accordion.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   └── (... all ui components)
│   └── figma/
│       └── ImageWithFallback.tsx
├── styles/
│   └── globals.css
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```