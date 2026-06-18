# Quebec Ministry Exam Calculator

React + Vite + TypeScript app for estimating the ministry exam grade needed to reach a passing final result in Quebec secondary courses.

## Tech

- React
- Vite
- TypeScript
- Tailwind CSS
- Browser `localStorage` for saved course scenarios

## Run

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Calculation

The app uses factual weighted calculations only:

- School result = Term 1 x 20% + Term 2 x 20% + Term 3 x 60%
- Final result = school result x school weight + exam result x exam weight
- Required exam = (target final result - school result x school weight) / exam weight

The default target is 60%, and the default Secondary 4/5 ministry exam weight is 50%. The app includes links to Quebec government pages and notes that official final results may use ministry conversion and moderation.
