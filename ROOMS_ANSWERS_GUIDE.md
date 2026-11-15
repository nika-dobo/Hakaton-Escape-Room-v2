# CIPHER//50 — Complete Room Questions, Hints & Answer Key

This reference sheet contains all **50 rooms** from `src/data/rooms.js`, including each room's question, code snippet, hint, canonical answer, and accepted variations.

## Quick Answer Table

| Room | Category | Canonical Answer | Accepted Variants |
| --- | --- | --- | --- |
| Room 01 | HTML | `<main>` | `<main>`, `main` |
| Room 02 | HTML | `alt` | `alt` |
| Room 03 | HTML | `<ol>` | `<ol>`, `ol` |
| Room 04 | HTML | `password` | `password` |
| Room 05 | HTML | `for` | `for` |
| Room 06 | HTML | `summary` | `summary`, `<summary>` |
| Room 07 | HTML | `readonly` | `readonly` |
| Room 08 | HTML | `scope` | `scope` |
| Room 09 | HTML | `noopener` | `noopener`, `noopener noreferrer`, `noreferrer` |
| Room 10 | HTML | `1.0` | `1.0`, `1` |
| Room 11 | HTML | `step` | `step` |
| Room 12 | HTML | `lazy` | `lazy` |
| Room 13 | HTML | `name` | `name` |
| Room 14 | HTML | `as` | `as` |
| Room 15 | HTML | `0` | `0` |
| Room 16 | CSS | `border-box` | `border-box` |
| Room 17 | CSS | `space-between` | `space-between` |
| Room 18 | CSS | `align-items` | `align-items`, `align-items: center` |
| Room 19 | CSS | `content` | `content` |
| Room 20 | CSS | `1,2,3` | `1,2,3`, `(1,2,3)`, `1-2-3`, `1 2 3` |
| Room 21 | CSS | `red` | `red` |
| Room 22 | CSS | `1fr` | `1fr` |
| Room 23 | CSS | `auto-fit` | `auto-fit` |
| Room 24 | CSS | `overflow` | `overflow`, `overflow: hidden` |
| Room 25 | CSS | `First` | `First`, `first` |
| Room 26 | CSS | `30px` | `30px`, `30` |
| Room 27 | CSS | `red` | `red` |
| Room 28 | CSS | `min-width` | `min-width`, `min-width: 0` |
| Room 29 | CSS | `opacity` | `opacity`, `opacity: 0.99` |
| Room 30 | CSS | `cyan` | `cyan` |
| Room 31 | CSS | `40px` | `40px`, `40` |
| Room 32 | CSS | `4` | `4` |
| Room 33 | JavaScript | `123` | `123`, `"123"`, `'123'` |
| Room 34 | JavaScript | `true false` | `true false`, `true, false`, `true,false` |
| Room 35 | JavaScript | `[20,40]` | `[20,40]`, `[20, 40]` |
| Room 36 | JavaScript | `40` | `40` |
| Room 37 | JavaScript | `250` | `250` |
| Room 38 | JavaScript | `10` | `10` |
| Room 39 | JavaScript | `3` | `3` |
| Room 40 | JavaScript | `7` | `7` |
| Room 41 | JavaScript | `ReferenceError` | `ReferenceError` |
| Room 42 | JavaScript | `3-0` | `3-0`, `"3-0"`, `'3-0'` |
| Room 43 | JavaScript | `0` | `0` |
| Room 44 | JavaScript | `ADCB` | `ADCB` |
| Room 45 | JavaScript | `3142` | `3142` |
| Room 46 | JavaScript | `ERR` | `ERR`, `"ERR"`, `'ERR'` |
| Room 47 | JavaScript | `5` | `5` |
| Room 48 | JavaScript | `7` | `7` |
| Room 49 | JavaScript | `21` | `21` |
| Room 50 | JavaScript | `30` | `30` |

---

## Detailed Room-by-Room Guide

### Room 01 (HTML)

**Question:** Room 01 [Easy]: Complete the semantic layout by entering the HTML5 landmark tag that wraps the primary, unique content of a page (exclude angle brackets or include them).

```html
<body>
  <header>CIPHER//50</header>
  <???>
    <h1>Challenge Terminal</h1>
  </???>
  <footer>System Ready</footer>
</body>
```

- **Hint:** HTML5 introduced a specific semantic element named after the primary section of the body, distinct from <header>, <nav>, and <footer>.
- **Answer:** `<main>`
- **Also Accepted:** `<main>`, `main`

### Room 02 (HTML)

**Question:** Room 02 [Easy]: Enter the mandatory HTML attribute used on an <img> element to provide accessible fallback text for screen readers and broken image links.

```html
<img
  src="/assets/network-topology.png"
  ???="Encrypted server mesh diagram"
/>
```

- **Hint:** It is a 3-letter attribute short for "alternative text".
- **Answer:** `alt`

### Room 03 (HTML)

**Question:** Room 03 [Easy]: Complete the markup with the HTML tag that renders a numbered (ordered) list of items.

```html
<???>
  <li>Initialize Server</li>
  <li>Connect Database</li>
</???>
```

- **Hint:** Stands for "Ordered List" (as opposed to <ul> for an unordered bulleted list).
- **Answer:** `<ol>`
- **Also Accepted:** `<ol>`, `ol`

### Room 04 (HTML)

**Question:** Room 04 [Easy]: Which <input> type attribute value masks typed characters with dots or asterisks for sensitive secrets?

```html
<form>
  <label for="key">Access Key</label>
  <input id="key" type="???" required />
</form>
```

- **Hint:** Standard HTML input type used on login screens to hide user credentials.
- **Answer:** `password`

### Room 05 (HTML)

**Question:** Room 05 [Easy]: Bug Fix — Clicking the label currently does NOT focus the email input. Which attribute on <label> binds it to the input id?

```html
<label ???="operator-email">Operator Email</label>
<input id="operator-email" type="email" />
```

- **Hint:** This 3-letter HTML attribute mirrors React’s "htmlFor" and must match the input element’s id.
- **Answer:** `for`

### Room 06 (HTML)

**Question:** Room 06 [Medium]: Enter the semantic HTML5 tag name used inside a <details> element to define its clickable toggle heading.

```html
<details>
  <???>View Decryption Logs</???>
  <p>Packet verified at 00:42 UTC.</p>
</details>
```

- **Hint:** Without this tag, <details> displays a generic "Details" toggle label.
- **Answer:** `summary`
- **Also Accepted:** `summary`, `<summary>`

### Room 07 (HTML)

**Question:** Room 07 [Medium]: Which boolean attribute prevents users from editing an <input> value while STILL submitting its value with the form?

```html
<form>
  <input type="text" name="sessionId" value="SESS-901" ??? />
  <button type="submit">Save</button>
</form>
```

- **Hint:** Unlike "disabled" (which omits the field from form submission), this attribute locks editing while still sending the value.
- **Answer:** `readonly`

### Room 08 (HTML)

**Question:** Room 08 [Medium]: Accessibility — Which HTML attribute on a <th> element explicitly declares whether it is a header for a column ("col") or row ("row")?

```html
<table>
  <tr>
    <th ???="col">Node</th>
    <th ???="col">Ping</th>
  </tr>
  <tr><td>Alpha</td><td>12ms</td></tr>
</table>
```

- **Hint:** A 5-letter attribute that defines the header cell’s "scope" (col, row, colgroup, or rowgroup).
- **Answer:** `scope`

### Room 09 (HTML)

**Question:** Room 09 [Medium]: Security Fix — When using target="_blank", which rel attribute keyword prevents the opened page from accessing window.opener?

```html
<a
  href="https://external-portal.example"
  target="_blank"
  rel="???"
>
  Launch External Tool
</a>
```

- **Hint:** It literally tells the browser there should be "no opener" reference exposed.
- **Answer:** `noopener`
- **Also Accepted:** `noopener`, `noopener noreferrer`, `noreferrer`

### Room 10 (HTML)

**Question:** Room 10 [Medium]: Mobile Viewport Bug — Complete the initial-scale value so mobile devices render the page at a 1:1 zoom ratio on first load.

```html
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=???"
  />
</head>
```

- **Hint:** A 100% unscaled ratio is written numerically as 1.0 (or 1).
- **Answer:** `1.0`
- **Also Accepted:** `1.0`, `1`

### Room 11 (HTML)

**Question:** Room 11 [Hard]: Which attribute on <input type="number"> restricts valid numeric entries to increments of 5 (0, 5, 10, ...)?

```html
<input
  type="number"
  min="0"
  max="100"
  ???="5"
/>
```

- **Hint:** A 4-letter attribute defining the interval "step" between allowed numeric values.
- **Answer:** `step`

### Room 12 (HTML)

**Question:** Room 12 [Hard]: Performance — Which loading attribute value defers fetching an off-screen <img> until the user scrolls near it?

```html
<img
  src="/assets/heavy-map.webp"
  alt="Sector Map"
  loading="???"
/>
```

- **Hint:** The opposite of "eager" loading.
- **Answer:** `lazy`

### Room 13 (HTML)

**Question:** Room 13 [Hard]: Bug Fix — Why does new FormData(form).get("codename") return null? Enter the missing HTML attribute on the <input>.

```html
<form id="entry">
  <input id="codename" type="text" value="ghost" />
  <button type="submit">Transmit</button>
</form>
<script>
  const fd = new FormData(document.getElementById('entry'));
  console.log(fd.get('codename')); // null!
</script>
```

- **Hint:** The "id" attribute is for DOM/CSS/labels, whereas HTTP forms and FormData serialize inputs by a different 4-letter attribute.
- **Answer:** `name`

### Room 14 (HTML)

**Question:** Room 14 [Hard]: Resource Preloading — When using <link rel="preload">, which mandatory 2-letter attribute tells the browser the asset type (e.g., "font", "style", or "script")?

```html
<head>
  <link
    rel="preload"
    href="/fonts/mono.woff2"
    ???="font"
    type="font/woff2"
    crossorigin
  />
</head>
```

- **Hint:** It specifies what the browser should treat the preloaded resource "as".
- **Answer:** `as`

### Room 15 (HTML)

**Question:** Room 15 [Hard]: Output Prediction — What number is logged to the console by querySelectorAll(".msg").length?

```html
<template id="alert-tpl">
  <p class="msg">System Breach</p>
</template>
<script>
  console.log(document.querySelectorAll('.msg').length);
</script>
```

- **Hint:** Elements inside a <template> live inside an inert DocumentFragment, not in the live DOM tree.
- **Answer:** `0`

### Room 16 (CSS)

**Question:** Room 16 [Easy]: Enter the box-sizing value so that padding and border are included inside the declared 300px width instead of adding to it.

```css
.terminal-card {
  width: 300px;
  padding: 24px;
  border: 2px solid #00f0ff;
  box-sizing: ???;
}
```

- **Hint:** The default is "content-box". The layout-safe alternative stops expanding at the outer border.
- **Answer:** `border-box`

### Room 17 (CSS)

**Question:** Room 17 [Easy]: Enter the justify-content value that pushes the first flex child to the far left edge, the last child to the far right edge, and distributes equal space between items.

```css
.hud-header {
  display: flex;
  justify-content: ???;
  align-items: center;
}
```

- **Hint:** Options include center, space-around, space-evenly, and space-_______.
- **Answer:** `space-between`

### Room 18 (CSS)

**Question:** Room 18 [Easy]: Flexbox Axis Logic — When flex-direction is column, which CSS property centers items horizontally along the cross axis? (Enter the property name).

```css
.stack {
  display: flex;
  flex-direction: column;
  justify-content: center;
  ???: center;
}
```

- **Hint:** In Flexbox, justify-content always controls the main axis, while this property controls the perpendicular cross axis.
- **Answer:** `align-items`
- **Also Accepted:** `align-items`, `align-items: center`

### Room 19 (CSS)

**Question:** Room 19 [Easy]: Bug Fix — The ::before pseudo-element dot never appears on screen. Enter the missing mandatory CSS property name.

```css
.live-dot::before {
  ???: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #10b981;
}
```

- **Hint:** Without this property (even set to an empty string ""), ::before and ::after pseudo-elements are never generated.
- **Answer:** `content`

### Room 20 (CSS)

**Question:** Room 20 [Medium]: Specificity Calculation — Calculate the CSS specificity of this selector in the format ID,Class,Element (example: 0,2,1).

```css
nav#top-bar .menu-item[data-active="true"] > a::after {
  content: "";
}
```

- **Hint:** IDs: #top-bar (1). Classes/Attributes: .menu-item, [data-active="true"] (2). Elements/Pseudo-elements: nav, a, ::after (3). Combinator > adds 0.
- **Answer:** `1,2,3`
- **Also Accepted:** `1,2,3`, `(1,2,3)`, `1-2-3`, `1 2 3`

### Room 21 (CSS)

**Question:** Room 21 [Medium]: Specificity Duel — Which color is applied to <a class="nav-link active"> inside <header id="header">?

```css
/* Rule A */
#header .nav-link { color: red; }

/* Rule B */
header nav ul li a.nav-link.active { color: lime; }
```

- **Hint:** Compare specificity tuples: (1,1,0) vs (0,2,5). No amount of classes or elements can beat a single ID selector.
- **Answer:** `red`

### Room 22 (CSS)

**Question:** Room 22 [Medium]: Enter the CSS Grid value (number + unit) inside repeat(3, ???) to divide the container into 3 equal-width flexible columns.

```css
.matrix-grid {
  display: grid;
  grid-template-columns: repeat(3, ???);
  gap: 16px;
}
```

- **Hint:** CSS Grid introduced the fractional unit "fr" to share free space proportionally.
- **Answer:** `1fr`

### Room 23 (CSS)

**Question:** Room 23 [Medium]: Grid Logic — Which keyword inside repeat(???, minmax(240px, 1fr)) collapses empty tracks to 0px so items stretch to fill the entire row?

```css
.responsive-cards {
  display: grid;
  grid-template-columns: repeat(???, minmax(240px, 1fr));
  gap: 16px;
}
```

- **Hint:** Between auto-fill and auto-fit, choose the one that "fits" existing tracks across the available width.
- **Answer:** `auto-fit`

### Room 24 (CSS)

**Question:** Room 24 [Medium]: Bug Fix — The sticky sidebar fails to stick while scrolling. Which CSS property on .layout-wrapper breaks position: sticky? (Enter the property name).

```css
.layout-wrapper {
  overflow: hidden;
  min-height: 2000px;
}
.sidebar {
  position: sticky;
  top: 24px;
}
```

- **Hint:** Setting hidden, scroll, or auto on this clipping property on any ancestor prevents sticky positioning from attaching to the viewport.
- **Answer:** `overflow`
- **Also Accepted:** `overflow`, `overflow: hidden`

### Room 25 (CSS)

**Question:** Room 25 [Medium]: Combinator Prediction — Which paragraph text turns cyan (#00f0ff): First, Second, or Both?

```css
<section>
  <h2>Protocol</h2>
  <p>First</p>
  <p>Second</p>
</section>
<style>
  h2 + p { color: #00f0ff; }
</style>
```

- **Hint:** The "+" (next-sibling / adjacent) combinator only matches the element immediately following h2, unlike "~".
- **Answer:** `First`
- **Also Accepted:** `First`, `first`

### Room 26 (CSS)

**Question:** Room 26 [Medium]: Margin Collapsing — In normal block flow, how many pixels of vertical space separate .box-1 and .box-2? (Include "px", e.g., 50px).

```css
.box-1 {
  margin-bottom: 30px;
}
.box-2 {
  margin-top: 20px;
}
```

- **Hint:** Adjacent vertical margins in block layout collapse to the larger of the two values rather than adding together.
- **Answer:** `30px`
- **Also Accepted:** `30px`, `30`

### Room 27 (CSS)

**Question:** Room 27 [Hard]: CSS Custom Properties — Assuming --theme-color is undefined everywhere, what final color does .child render?

```css
.parent {
  --color: red;
  color: blue;
}
.child {
  color: var(--theme-color, var(--color));
}
```

- **Hint:** Custom properties inherit down the DOM tree, and var() evaluates its second argument as a fallback when the first variable is missing.
- **Answer:** `red`

### Room 28 (CSS)

**Question:** Room 28 [Hard]: Flexbox Overflow Bug — A long unbroken token stretches .flex-item past its 300px parent instead of truncating with "...". Which CSS property must be set to 0 on .flex-item?

```css
.row {
  display: flex;
  width: 300px;
}
.flex-item {
  flex: 1;
  ???: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- **Hint:** Flex items default to min-width: auto, preventing them from shrinking smaller than their intrinsic content width.
- **Answer:** `min-width`
- **Also Accepted:** `min-width`, `min-width: 0`

### Room 29 (CSS)

**Question:** Room 29 [Hard]: Stacking Context Bug — Why does .modal (z-index: 9999) render behind .panel-b (z-index: 2)? Enter the CSS property on .panel-a that creates a trapping stacking context.

```css
.panel-a {
  position: relative;
  z-index: 1;
  opacity: 0.99;
}
.panel-a .modal {
  position: fixed;
  z-index: 9999;
}
.panel-b {
  position: relative;
  z-index: 2;
}
```

- **Hint:** Any value less than 1 on this transparency property creates a brand new stacking context (and containing block issues for fixed elements if transform/filter are used).
- **Answer:** `opacity`
- **Also Accepted:** `opacity`, `opacity: 0.99`

### Room 30 (CSS)

**Question:** Room 30 [Hard]: Modern Pseudo-Classes — What text color does <button class="btn"> inside <div id="main" class="card"> receive?

```css
/* Rule A */
:where(#main) .btn { color: orange; }

/* Rule B */
.card .btn { color: cyan; }
```

- **Hint:** Unlike :is(), the :where() functional pseudo-class always contributes ZERO specificity (0,0,0) regardless of the selectors inside it.
- **Answer:** `cyan`

### Room 31 (CSS)

**Question:** Room 31 [Hard]: Fluid Typography — Given a 1000px viewport width and root 1rem = 16px, what computed font-size in pixels does clamp() resolve to? (Include "px").

```css
.hero-title {
  font-size: clamp(1rem, 5vw, 2.5rem);
}
```

- **Hint:** Convert all three values to px: min = 16px, preferred = 5% of 1000px (50px), max = 2.5 * 16px (40px).
- **Answer:** `40px`
- **Also Accepted:** `40px`, `40`

### Room 32 (CSS)

**Question:** Room 32 [Hard]: Grid Track Placement — On this 4-column grid, which vertical grid column line number does .panel end at?

```css
.board {
  display: grid;
  grid-template-columns: repeat(4, 100px);
}
.panel {
  grid-column: 2 / span 2;
}
```

- **Hint:** Line 2 + spanning 2 column tracks = ending at grid line 2 + 2.
- **Answer:** `4`

### Room 33 (JavaScript)

**Question:** Room 33 [Easy]: Output Prediction — What exact value is logged to the console?

```javascript
console.log(1 + "2" + 3);
```

- **Hint:** The + operator evaluates left-to-right; once a string is encountered, subsequent numbers are coerced into strings and concatenated.
- **Answer:** `123`
- **Also Accepted:** `123`, `"123"`, `'123'`

### Room 34 (JavaScript)

**Question:** Room 34 [Easy]: Output Prediction — Enter the two booleans logged to the console separated by a space (e.g., false true).

```javascript
console.log(0 == false, 0 === false);
```

- **Hint:** Loose equality (==) coerces false to 0, whereas strict equality (===) compares both type and value without coercion.
- **Answer:** `true false`
- **Also Accepted:** `true false`, `true, false`, `true,false`

### Room 35 (JavaScript)

**Question:** Room 35 [Easy]: Array Methods — What exact JSON array string is logged to the console?

```javascript
const nums = [1, 2, 3, 4];
const res = nums
  .filter((n) => n % 2 === 0)
  .map((n) => n * 10);

console.log(JSON.stringify(res));
```

- **Hint:** First filter keeps only even numbers [2, 4], then map multiplies each by 10.
- **Answer:** `[20,40]`
- **Also Accepted:** `[20,40]`, `[20, 40]`

### Room 36 (JavaScript)

**Question:** Room 36 [Easy]: Array Reduce — What final number is logged to the console?

```javascript
const packets = [5, 10, 15];
const total = packets.reduce((acc, cur) => acc + cur, 10);
console.log(total);
```

- **Hint:** Notice the initial accumulator value is 10, not 0.
- **Answer:** `40`

### Room 37 (JavaScript)

**Question:** Room 37 [Medium]: Reference Semantics — What number is logged for a.score?

```javascript
const a = { score: 100 };
const b = a;
b.score = 250;
console.log(a.score);
```

- **Hint:** Objects are assigned by reference in JavaScript; both variables point to the exact same object in heap memory.
- **Answer:** `250`

### Room 38 (JavaScript)

**Question:** Room 38 [Medium]: Bug / Gotcha Prediction — Calling .sort() without a comparator sorts elements lexicographically. What number is logged at arr[1]?

```javascript
const arr = [10, 2, 30, 1];
arr.sort();
console.log(arr[1]);
```

- **Hint:** When converted to UTF-16 strings ("1", "10", "2", "30"), "10" comes before "2".
- **Answer:** `10`

### Room 39 (JavaScript)

**Question:** Room 39 [Medium]: Classic Closure Loop Bug — Because var is function-scoped rather than block-scoped, what single digit is logged three times?

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
```

- **Hint:** All three callbacks share the same i binding, which reaches its terminating value before the timer callbacks execute.
- **Answer:** `3`

### Room 40 (JavaScript)

**Question:** Room 40 [Medium]: Closures — Trace the lexical environment and enter the number logged on the final line.

```javascript
function createCounter(start) {
  let count = start;
  return () => ++count;
}
const next = createCounter(5);
next();
console.log(next());
```

- **Hint:** Prefix increment (++count) increments first and returns the updated value. The function is invoked twice.
- **Answer:** `7`

### Room 41 (JavaScript)

**Question:** Room 41 [Medium]: Hoisting & TDZ — Unlike var, accessing a let variable inside its Temporal Dead Zone throws an error even with typeof. Enter the exact JS Error class name thrown.

```javascript
function inspect() {
  console.log(typeof cipherKey);
  let cipherKey = 42;
}
inspect();
```

- **Hint:** Reading an uninitialized let/const binding inside the Temporal Dead Zone throws a ________Error.
- **Answer:** `ReferenceError`

### Room 42 (JavaScript)

**Question:** Room 42 [Medium]: Nullish Coalescing vs Logical OR — Enter the exact string logged to the console.

```javascript
const retries = 0;
const a = retries || 3;
const b = retries ?? 3;
console.log(`${a}-${b}`);
```

- **Hint:** || falls back on any falsy value (including 0), whereas ?? only falls back on null or undefined.
- **Answer:** `3-0`
- **Also Accepted:** `3-0`, `"3-0"`, `'3-0'`

### Room 43 (JavaScript)

**Question:** Room 43 [Medium]: DOM Manipulation — What number is logged by li.children.length after assigning textContent?

```javascript
const li = document.createElement('li');
li.textContent = '<b>Alert</b>';
console.log(li.children.length);
```

- **Hint:** textContent inserts raw text nodes and does NOT parse HTML tags into child DOM elements (unlike innerHTML).
- **Answer:** `0`

### Room 44 (JavaScript)

**Question:** Room 44 [Hard]: Event Loop — Enter the exact 4-letter output sequence printed to the console (no spaces, e.g., ABCD).

```javascript
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
```

- **Hint:** Synchronous logs run first, then the microtask queue (Promise callbacks) drains completely before the next macrotask (setTimeout).
- **Answer:** `ADCB`

### Room 45 (JavaScript)

**Question:** Room 45 [Hard]: Async/Await Control Flow — Enter the exact 4-digit output sequence printed to the console (no spaces, e.g., 1234).

```javascript
async function run() {
  console.log(1);
  await Promise.resolve();
  console.log(2);
}
console.log(3);
run();
console.log(4);
```

- **Hint:** An async function runs synchronously up to its first await expression, then yields control back to the caller while the rest schedules as a microtask.
- **Answer:** `3142`

### Room 46 (JavaScript)

**Question:** Room 46 [Hard]: Promise Combinators — What exact string is logged to the console by Promise.all?

```javascript
const p1 = Promise.resolve('OK');
const p2 = Promise.reject('ERR');
const p3 = Promise.resolve('DONE');

Promise.all([p1, p2, p3])
  .then(() => console.log('PASS'))
  .catch((err) => console.log(err));
```

- **Hint:** Promise.all short-circuits and rejects immediately with the reason of the first rejected promise.
- **Answer:** `ERR`
- **Also Accepted:** `ERR`, `"ERR"`, `'ERR'`

### Room 47 (JavaScript)

**Question:** Room 47 [Hard]: Set Deduplication — What final number is logged to the console?

```javascript
const codes = [4, 2, 4, 1, 2];
const unique = [...new Set(codes)];
console.log(unique.length + unique[1]);
```

- **Hint:** Set removes duplicates while preserving first-seen insertion order: [4, 2, 1]. Add its length to the element at index 1.
- **Answer:** `5`

### Room 48 (JavaScript)

**Question:** Room 48 [Hard]: Array Aggregation — Trace the reducer and enter the value logged for grouped.a.

```javascript
const events = [
  { key: 'a', pts: 2 },
  { key: 'b', pts: 3 },
  { key: 'a', pts: 5 },
];
const grouped = events.reduce((acc, { key, pts }) => {
  acc[key] = (acc[key] ?? 0) + pts;
  return acc;
}, {});
console.log(grouped.a);
```

- **Hint:** Nullish coalescing (??) initializes missing keys to 0 and adds every matching event pts.
- **Answer:** `7`

### Room 49 (JavaScript)

**Question:** Room 49 [Hard]: Functional Pipeline & Currying — Trace the pipeline starting from 2 and enter the final logged number.

```javascript
const add = (a) => (b) => a + b;
const mul = (a) => (b) => a * b;
const pipeline = [add(3), mul(4), add(1)];

const result = pipeline.reduce((val, fn) => fn(val), 2);
console.log(result);
```

- **Hint:** Step by step: add(3)(2) -> 5, then mul(4)(5) -> 20, then add(1)(20).
- **Answer:** `21`

### Room 50 (JavaScript)

**Question:** Room 50 [Final Boss]: Async Interleaving + Closure State — Trace the microtask suspension order carefully and enter the final number logged.

```javascript
async function unlockVault() {
  let key = 10;
  const mutate = async () => {
    await Promise.resolve();
    key *= 2;
  };
  const pending = mutate();
  key += 5;
  await pending;
  return key;
}

unlockVault().then((val) => console.log(val));
```

- **Hint:** mutate() suspends at its await, letting "key += 5" run synchronously (15) BEFORE "key *= 2" executes on resume.
- **Answer:** `30`

