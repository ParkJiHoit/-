# UI 폴리시 2차 개선 (호버 게이팅 / 드롭다운 exit 애니메이션) Implementation Plan

> STATUS: DONE (커밋 `c6be5a4` Task 1, `9593ce6` Task 2). Task 3은 계획대로 스킵.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Context:** `make-interfaces-feel-better`, `apple-design`, `emil-design-eng` 3개 디자인 스킬로 진행한 2차 UI 감사에서 findings #1~9를 도출했다. #1~6(leftover `transition: all`, 아이콘 버튼 hit area, `.mac-badge` tabular-nums 등)은 이미 적용 완료했고 커밋 `4a77992`로 푸시돼 있다. 이 플랜은 남은 #7, #8을 다룬다. #9(드롭다운 transform-origin)는 조사 결과 리스크 대비 이득이 작아 **스킵을 권장**한다 — 이유는 아래 Task 3 참고.

**Goal:**
- #7: `:hover` 전용 CSS 규칙들이 `@media (hover: hover)` 가드 없이 걸려 있어, 터치 기기(태블릿/모바일)에서 탭하면 hover 스타일이 "끼인 채" 남았다가 다른 곳을 탭해야 풀리는 문제를 고친다.
- #8: `.mac-dropdown`을 쓰는 5곳의 드롭다운이 열릴 때는 `macScaleIn`으로 부드럽게 나타나지만 닫힐 때는 `{open && (...)}` 조건부 렌더 때문에 즉시 사라진다(exit 애니메이션 없음). 공용 훅으로 짧은 exit 페이드아웃을 추가한다.

**Architecture:**
- #7은 순수 CSS 이동/래핑만 필요하다. 기존 규칙의 값은 절대 바꾸지 않고 `@media (hover: hover) and (pointer: fine) { ... }` 블록으로 감싸기만 한다.
- #8은 `client/src/hooks/`에 새 훅 `useDelayedUnmount(isOpen, delayMs)`을 추가하고(기존 `useCountUp.js`와 같은 컨벤션으로), 5개 호출부에서 `{open && (...)}`를 `{shouldRender && (...)}` + `data-closing` 속성으로 바꾼다. CSS에는 기존 `macScaleIn`과 짝을 이루는 `macScaleOut` 키프레임을 추가한다.

**Tech Stack:** React (Vite), 순수 CSS(애니메이션 라이브러리 불필요). 이 저장소는 클라이언트 자동화 테스트가 없으므로(기존 관례) `npm run build`로 검증한다.

## Global Constraints

- 새 색상/이징 곡선을 발명하지 않는다 — `macScaleIn`이 쓰는 `cubic-bezier(0.4, 0, 0.2, 1)`을 exit에도 그대로 재사용한다.
- 각 Task 완료 후 `git add` + `git commit` (한글, `type: 설명` 형식 — 예: `fix: ...`).
- Task 1과 Task 2는 서로 독립적이다 — 어느 쪽을 먼저 해도 무방하다.
- 모든 Step은 `cd client && npm run build`가 에러 없이 끝나는 것으로 검증한다.

---

### Task 1: `styles.css` — `:hover` 전용 규칙을 hover-capable 기기로 게이팅

**Files:**
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: 없음.
- Produces: 시각적으로 데스크톱(마우스)에서는 동일하게 보이고, 터치 전용 기기에서는 hover 스타일이 아예 적용되지 않는다.

이 파일 안의 아래 규칙들을 각각 `@media (hover: hover) and (pointer: fine) { ... }`로 감싼다. **선택자/속성 값은 그대로 두고 중괄호 블록만 media query로 감싼다.** 순서·들여쓰기는 안 바꿔도 되고, 각 지점을 독립적으로 처리하면 된다(연속되지 않은 지점끼리 하나로 묶을 필요 없음).

- [ ] **Step 1: `.traffic-lights` hover (3줄, 138-140행 부근)**

Before:
```css
.traffic-lights:hover .tl-red::after    { content: '×'; opacity: 1; }
.traffic-lights:hover .tl-yellow::after { content: '–'; opacity: 1; }
.traffic-lights:hover .tl-green::after  { content: '+'; opacity: 1; }
```

After:
```css
@media (hover: hover) and (pointer: fine) {
  .traffic-lights:hover .tl-red::after    { content: '×'; opacity: 1; }
  .traffic-lights:hover .tl-yellow::after { content: '–'; opacity: 1; }
  .traffic-lights:hover .tl-green::after  { content: '+'; opacity: 1; }
}
```

- [ ] **Step 2: `.mac-select:hover` (298행 부근, `.mac-select:focus`는 건드리지 않음)**

Before:
```css
.mac-select:hover  { border-color: var(--text-tertiary); }
.mac-select:focus  { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.25); }
```

After:
```css
@media (hover: hover) and (pointer: fine) {
  .mac-select:hover  { border-color: var(--text-tertiary); }
}
.mac-select:focus  { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.25); }
```

- [ ] **Step 3: `.mac-upload-label:hover` (317-321행 부근)**

Before:
```css
.mac-upload-label:hover {
  border-color: var(--accent) !important;
  color: var(--accent) !important;
  background: rgba(10, 132, 255, 0.06);
}
```

After:
```css
@media (hover: hover) and (pointer: fine) {
  .mac-upload-label:hover {
    border-color: var(--accent) !important;
    color: var(--accent) !important;
    background: rgba(10, 132, 255, 0.06);
  }
}
```

- [ ] **Step 4: `.mac-btn:hover` / `.mac-btn-ghost:hover`(+light) (350행, 366-373행 부근)**

`.mac-btn:active`, `.mac-btn:disabled`는 hover가 아니므로 그대로 둔다.

Before:
```css
.mac-btn:hover:not(:disabled)  { background: var(--accent-hover); }
.mac-btn:active:not(:disabled) { transform: scale(0.97); }
.mac-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```
```css
.mac-btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

[data-theme="light"] .mac-btn-ghost:hover:not(:disabled) {
  background: #D1D1D6;
}
```

After:
```css
@media (hover: hover) and (pointer: fine) {
  .mac-btn:hover:not(:disabled)  { background: var(--accent-hover); }
}
.mac-btn:active:not(:disabled) { transform: scale(0.97); }
.mac-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```
```css
@media (hover: hover) and (pointer: fine) {
  .mac-btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  [data-theme="light"] .mac-btn-ghost:hover:not(:disabled) {
    background: #D1D1D6;
  }
}
```

- [ ] **Step 5: `.mac-table tbody tr:hover` (426행 부근)**

Before:
```css
.mac-table tbody tr:hover { background: var(--bg-overlay); }
```

After:
```css
@media (hover: hover) and (pointer: fine) {
  .mac-table tbody tr:hover { background: var(--bg-overlay); }
}
```

- [ ] **Step 6: 아이콘 버튼 계열 hover 전부 (446-509행 부근) — `.mac-icon-btn`, `.mac-icon-btn-danger`, `.mac-icon-btn-x`, `.mac-icon-btn-accent`, `.mac-icon-btn-star`, `.mac-expand-toggle`**

`:active` 규칙(455-457, 483-485, 497-499행)과 베이스 `transition`/`svg transition` 규칙(446-449, 464-466, 472-474, 487-489, 501-504행)은 hover가 아니므로 그대로 둔다. `:hover` 블록만 개별적으로 감싼다:

```css
@media (hover: hover) and (pointer: fine) {
  .mac-icon-btn:hover {
    transform: scale(1.15);
  }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  .mac-icon-btn-danger:hover {
    background: rgba(255,69,58,0.12);
    color: #FF453A !important;
  }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  .mac-icon-btn-x:hover svg {
    transform: rotate(180deg);
  }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  .mac-icon-btn-accent:hover {
    background: rgba(10,132,255,0.18);
    color: var(--accent) !important;
    transform: scale(1.35);
    box-shadow: 0 0 0 5px rgba(10,132,255,0.14);
  }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  .mac-icon-btn-star:hover {
    background: rgba(255,214,10,0.16);
    color: #FFD60A !important;
    transform: scale(1.25) rotate(-8deg);
  }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  .mac-expand-toggle:hover {
    background: rgba(255,255,255,0.08);
    color: var(--text-primary) !important;
  }
}
```

- [ ] **Step 7: 체크박스 hover (579-582, 599-602, 606-609행 부근) — `:focus-visible`/`:checked`/`:disabled`는 그대로**

Before:
```css
.mac-checkbox:hover:not(:checked):not(:disabled) {
  border-color: rgba(255,255,255,0.30);
  background: rgba(255,255,255,0.05);
}
```
```css
.mac-checkbox:checked:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}
```
```css
[data-theme="light"] .mac-checkbox:hover:not(:checked):not(:disabled) {
  border-color: rgba(0,0,0,0.30);
  background: rgba(0,0,0,0.04);
}
```

After — 세 블록 각각 동일 패턴으로 감싸기:
```css
@media (hover: hover) and (pointer: fine) {
  .mac-checkbox:hover:not(:checked):not(:disabled) {
    border-color: rgba(255,255,255,0.30);
    background: rgba(255,255,255,0.05);
  }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  .mac-checkbox:checked:hover {
    background-color: var(--accent-hover);
    border-color: var(--accent-hover);
  }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  [data-theme="light"] .mac-checkbox:hover:not(:checked):not(:disabled) {
    border-color: rgba(0,0,0,0.30);
    background: rgba(0,0,0,0.04);
  }
}
```

- [ ] **Step 8: 스크롤바 thumb hover (623, 626행 부근)**

Before:
```css
.mac-scroll::-webkit-scrollbar-thumb:hover{ background: #636366; }
```
```css
[data-theme="light"] .mac-scroll::-webkit-scrollbar-thumb:hover{ background: #AEAEB2; }
```

After:
```css
@media (hover: hover) and (pointer: fine) {
  .mac-scroll::-webkit-scrollbar-thumb:hover{ background: #636366; }
}
```
```css
@media (hover: hover) and (pointer: fine) {
  [data-theme="light"] .mac-scroll::-webkit-scrollbar-thumb:hover{ background: #AEAEB2; }
}
```

- [ ] **Step 9: 파일 전체 재검색으로 누락 확인**

Run: `grep -n ":hover" client/src/styles.css`
Expected: 모든 매치 라인이 `@media (hover: hover)` 블록 내부에 있어야 한다(위 Step 1~8에서 다루지 않은 `:hover`가 남아있으면 안 됨 — Step 1~8 작성 시점 기준 총 19곳이었으나, 다른 세션에서 새로 추가된 `:hover`가 있다면 같은 패턴으로 감싼다).

- [ ] **Step 10: 빌드 확인 + 커밋**

Run: `cd client && npm run build`
Expected: 에러 없이 빌드 성공.

```bash
git add client/src/styles.css
git commit -m "fix: :hover 전용 스타일을 hover-capable 기기로 게이팅 (터치기기 sticky-hover 방지)"
git push origin master
```

---

### Task 2: `.mac-dropdown` 닫힘 시 exit 애니메이션 추가

**Files:**
- Create: `client/src/hooks/useDelayedUnmount.js`
- Modify: `client/src/styles.css` (macScaleOut 키프레임 + `.mac-dropdown[data-closing]` 추가)
- Modify: `client/src/components/ColumnVisibilitySettings.jsx`
- Modify: `client/src/components/Navbar.jsx` (2곳: `serviceOpen`, `userMenuOpen`)
- Modify: `client/src/components/SearchHistoryDropdown.jsx`
- Modify: `client/src/pages/SharedReportPage.jsx` (`groupMenuOpen`)

**Interfaces:**
- Consumes: 없음(순수 UI 훅).
- Produces: `useDelayedUnmount(isOpen, delayMs)` — `{ shouldRender, isClosing }`를 반환하는 훅. `isOpen`이 `true`가 되면 즉시 `shouldRender=true`. `isOpen`이 `false`가 되면 `isClosing=true`로 바뀌고 `delayMs` 후에 `shouldRender=false`가 된다(그 사이 DOM이 계속 남아있어서 CSS exit 애니메이션이 재생될 시간을 번다).

- [ ] **Step 1: 훅 작성**

`client/src/hooks/useDelayedUnmount.js` 신규 생성:

```js
import { useEffect, useState } from 'react';

// 조건부 렌더 `{open && (...)}`는 닫힐 때 DOM이 즉시 사라져서 CSS exit
// 애니메이션이 재생될 시간이 없다. 이 훅은 isOpen이 false가 된 뒤에도
// delayMs만큼 더 렌더링을 유지해서, 그 사이 CSS로 exit 트랜지션을 재생할
// 수 있게 해준다. 반환하는 isClosing을 data-closing 속성에 연결해서 쓴다.
export default function useDelayedUnmount(isOpen, delayMs = 120) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }
    if (!shouldRender) return;
    setIsClosing(true);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return { shouldRender, isClosing };
}
```

- [ ] **Step 2: CSS — `macScaleOut` 키프레임 + `data-closing` 규칙 추가**

`client/src/styles.css`의 기존 `.mac-dropdown` 규칙(376-384행 부근) 바로 아래에 추가:

```css
.mac-dropdown[data-closing="true"] {
  animation: macScaleOut 0.12s cubic-bezier(0.4, 0, 0.2, 1) both;
}
```

그리고 `@keyframes macScaleIn { ... }` 정의(670-673행 부근) 바로 아래에 추가:

```css
@keyframes macScaleOut {
  from { opacity: 1; transform: scale(1)    translateY(0); }
  to   { opacity: 0; transform: scale(0.95) translateY(-4px); }
}
```

- [ ] **Step 3: `ColumnVisibilitySettings.jsx` 적용 (51-56행 부근)**

파일 상단 import 구역에 훅 import 추가:
```js
import useDelayedUnmount from '../hooks/useDelayedUnmount';
```

컴포넌트 함수 안, `open` state 선언 아래에 훅 호출 추가:
```jsx
  const { shouldRender: dropdownMounted, isClosing: dropdownClosing } = useDelayedUnmount(open);
```

Before:
```jsx
      {open && (
        <div
          className="mac-dropdown"
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 240, padding: '10px 14px', zIndex: 200 }}
        >
```

After:
```jsx
      {dropdownMounted && (
        <div
          className="mac-dropdown"
          data-closing={dropdownClosing}
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 240, padding: '10px 14px', zIndex: 200 }}
        >
```
(닫는 `)}`는 그대로 둔다 — JSX 트리 구조는 안 바뀜, 조건 변수명과 `data-closing` 속성만 추가되는 것.)

- [ ] **Step 4: `SearchHistoryDropdown.jsx` 적용**

`open` state는 22행 부근에 있다(`const [open, setOpen] = useState(false);`). 같은 패턴으로:
1. `import useDelayedUnmount from '../hooks/useDelayedUnmount';` 추가
2. `const { shouldRender: dropdownMounted, isClosing: dropdownClosing } = useDelayedUnmount(open);` 추가
3. 이 파일에서 `{open && (` 로 시작하는 드롭다운 렌더 블록을 찾아 `{dropdownMounted && (`로 바꾸고, 그 드롭다운 최상위 `<div className="mac-dropdown ...">`에 `data-closing={dropdownClosing}` 속성을 추가한다.

- [ ] **Step 5: `Navbar.jsx` 적용 — 2곳 (`serviceOpen`, `userMenuOpen`)**

이 파일은 드롭다운이 2개라 훅도 2번 호출한다(변수명 충돌 주의):
```jsx
  const { shouldRender: serviceMenuMounted, isClosing: serviceMenuClosing } = useDelayedUnmount(serviceOpen);
  const { shouldRender: userMenuMounted, isClosing: userMenuClosing } = useDelayedUnmount(userMenuOpen);
```

188행 부근:
Before:
```jsx
        {serviceOpen && (
          <div
            className="mac-dropdown p-1.5"
            style={{
              position: 'absolute',
```
After:
```jsx
        {serviceMenuMounted && (
          <div
            className="mac-dropdown p-1.5"
            data-closing={serviceMenuClosing}
            style={{
              position: 'absolute',
```

329행 부근:
Before:
```jsx
          {userMenuOpen && (
            <div className="mac-dropdown p-1.5" style={{
              position: 'absolute', right: 0, top: 'calc(100% + 10px)', minWidth: 180,
            }}>
```
After:
```jsx
          {userMenuMounted && (
            <div className="mac-dropdown p-1.5" data-closing={userMenuClosing} style={{
              position: 'absolute', right: 0, top: 'calc(100% + 10px)', minWidth: 180,
            }}>
```

- [ ] **Step 6: `SharedReportPage.jsx` 적용 (`groupMenuOpen`, 252행 부근)**

`groupMenuOpen` state 선언(67행 부근) 아래에 훅 추가:
```jsx
  const { shouldRender: groupMenuMounted, isClosing: groupMenuClosing } = useDelayedUnmount(groupMenuOpen);
```

Before:
```jsx
                    {groupMenuOpen && (
                      <div
                        className="mac-dropdown mac-scroll p-1.5"
                        style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 160, maxHeight: 280, overflowY: 'auto', zIndex: 10 }}
                      >
```
After:
```jsx
                    {groupMenuMounted && (
                      <div
                        className="mac-dropdown mac-scroll p-1.5"
                        data-closing={groupMenuClosing}
                        style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 160, maxHeight: 280, overflowY: 'auto', zIndex: 10 }}
                      >
```

- [ ] **Step 7: 빌드 확인**

Run: `cd client && npm run build`
Expected: 에러 없이 빌드 성공.

- [ ] **Step 8: 수동 확인 (선택, 브라우저 가능하면)**

`npm run dev`로 로컬 실행 후 네비바 사용자 메뉴 / 컬럼 설정 드롭다운 / 공유 리포트 페이지 그룹 전환 드롭다운을 열고 닫아보면서, 닫힐 때 "뚝" 끊기지 않고 살짝 페이드아웃되는지 확인.

- [ ] **Step 9: 커밋**

```bash
git add client/src/hooks/useDelayedUnmount.js client/src/styles.css client/src/components/ColumnVisibilitySettings.jsx client/src/components/Navbar.jsx client/src/components/SearchHistoryDropdown.jsx client/src/pages/SharedReportPage.jsx
git commit -m "feat: mac-dropdown 닫힘 exit 애니메이션 추가 (useDelayedUnmount 훅)"
git push origin master
```

---

### Task 3 (선택, 스킵 권장): 드롭다운 `transform-origin`을 트리거 위치에 맞추기

**왜 스킵을 권장하는가:** `.mac-dropdown` 사용처를 전부 조사한 결과 위치 전략이 혼재돼 있다:
- `right: 0` 정렬 3곳 — `ColumnVisibilitySettings.jsx`, `Navbar.jsx`(userMenuOpen), `SharedReportPage.jsx`
- `left: 50%` + `transform: translateX(-50%)`로 중앙 정렬 2곳 — `Navbar.jsx`(serviceOpen), `SearchHistoryDropdown.jsx`

`.mac-dropdown`에 전역으로 `transform-origin: top right`를 주면 뒤의 2곳(중앙 정렬)에서 시각적으로 어긋난다. 게다가 중앙 정렬 드롭다운은 이미 인라인 `style={{ transform: 'translateX(-50%)' }}`를 쓰고 있어서, `macScaleIn`/`macScaleOut` 키프레임이 애니메이션 도중 `transform`을 덮어써 `translateX(-50%)`가 일시적으로 사라지는 문제가 이미 잠재해 있을 수 있다(애니메이션이 끝나면 인라인 스타일로 복귀하므로 눈에 크게 띄지는 않을 가능성이 높지만, 미검증).

적용하려면 전역이 아니라 `right: 0` 정렬 3곳에만 별도 클래스(`.mac-dropdown-anchor-right { transform-origin: top right; }`)를 만들어 개별 적용해야 하는데, 이득(육안으로 거의 안 보이는 수준의 폴리시) 대비 손이 많이 가서 우선순위가 낮다. 진행하고 싶다면 위 방식으로 별도 태스크를 새로 작성할 것.

---

## 완료 후

두 Task 모두 마치면 이 문서 상단에 `STATUS: DONE (커밋 <hash1>, <hash2>)`을 추가하고, 세션을 시작한 사용자에게 짧게 요약 보고한다.
