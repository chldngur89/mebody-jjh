# Brand color rollback

Applied on branch **`brand-color-unify`** (jjh + mebody-server).

Palette: cream `#FFFFF3` / green `#014725`.

## Quick rollback (recommended)

### mebody-jjh
```bash
cd ~/Desktop/mebody/mebody-jjh
git checkout main
# discard uncommitted brand work on the branch if needed:
# git branch -D brand-color-unify
```

Or keep branch but undo only color files:
```bash
git checkout main -- src/index.css src/data/axisTheme.ts src/theme/brand.ts
git checkout main -- src/components
```

### mebody-server
```bash
cd ~/Desktop/mebody/mebody-server
git checkout main
```

## Partial rollback (CSS tokens only)

In [`src/index.css`](../src/index.css), delete the block starting with:

`MEBODY BRAND OVERRIDE`

That restores emerald/teal class colors from the original theme dump. Hardcoded hex in TSX would still be brand until you restore those files from `main`.
