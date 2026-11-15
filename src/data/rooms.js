export const TOTAL_ROOMS = 50;

export const ROOMS = [
  // ==========================================
  // HTML CHALLENGES (Rooms 1 - 15)
  // ==========================================
  {
    id: 1,
    category: 'HTML',
    question:
      'Room 01 [Easy]: Complete the semantic layout by entering the HTML5 landmark tag that wraps the primary, unique content of a page (exclude angle brackets or include them).',
    codeSnippet: `<body>
  <header>CIPHER//50</header>
  <???>
    <h1>Challenge Terminal</h1>
  </???>
  <footer>System Ready</footer>
</body>`,
    answer: '<main>',
    acceptedAnswers: ['<main>', 'main'],
    hint: 'HTML5 introduced a specific semantic element named after the primary section of the body, distinct from <header>, <nav>, and <footer>.',
  },
  {
    id: 2,
    category: 'HTML',
    question:
      'Room 02 [Easy]: Enter the mandatory HTML attribute used on an <img> element to provide accessible fallback text for screen readers and broken image links.',
    codeSnippet: `<img
  src="/assets/network-topology.png"
  ???="Encrypted server mesh diagram"
/>`,
    answer: 'alt',
    acceptedAnswers: ['alt'],
    hint: 'It is a 3-letter attribute short for "alternative text".',
  },
  {
    id: 3,
    category: 'HTML',
    question:
      'Room 03 [Easy]: Complete the markup with the HTML tag that renders a numbered (ordered) list of items.',
    codeSnippet: `<???>
  <li>Initialize Server</li>
  <li>Connect Database</li>
</???>`,
    answer: '<ol>',
    acceptedAnswers: ['<ol>', 'ol'],
    hint: 'Stands for "Ordered List" (as opposed to <ul> for an unordered bulleted list).',
  },
  {
    id: 4,
    category: 'HTML',
    question:
      'Room 04 [Easy]: Which <input> type attribute value masks typed characters with dots or asterisks for sensitive secrets?',
    codeSnippet: `<form>
  <label for="key">Access Key</label>
  <input id="key" type="???" required />
</form>`,
    answer: 'password',
    acceptedAnswers: ['password'],
    hint: 'Standard HTML input type used on login screens to hide user credentials.',
  },
  {
    id: 5,
    category: 'HTML',
    question:
      'Room 05 [Easy]: Bug Fix — Clicking the label currently does NOT focus the email input. Which attribute on <label> binds it to the input id?',
    codeSnippet: `<label ???="operator-email">Operator Email</label>
<input id="operator-email" type="email" />`,
    answer: 'for',
    acceptedAnswers: ['for'],
    hint: 'This 3-letter HTML attribute mirrors React’s "htmlFor" and must match the input element’s id.',
  },
  {
    id: 6,
    category: 'HTML',
    question:
      'Room 06 [Medium]: Enter the semantic HTML5 tag name used inside a <details> element to define its clickable toggle heading.',
    codeSnippet: `<details>
  <???>View Decryption Logs</???>
  <p>Packet verified at 00:42 UTC.</p>
</details>`,
    answer: 'summary',
    acceptedAnswers: ['summary', '<summary>'],
    hint: 'Without this tag, <details> displays a generic "Details" toggle label.',
  },
  {
    id: 7,
    category: 'HTML',
    question:
      'Room 07 [Medium]: Which boolean attribute prevents users from editing an <input> value while STILL submitting its value with the form?',
    codeSnippet: `<form>
  <input type="text" name="sessionId" value="SESS-901" ??? />
  <button type="submit">Save</button>
</form>`,
    answer: 'readonly',
    acceptedAnswers: ['readonly'],
    hint: 'Unlike "disabled" (which omits the field from form submission), this attribute locks editing while still sending the value.',
  },
  {
    id: 8,
    category: 'HTML',
    question:
      'Room 08 [Medium]: Accessibility — Which HTML attribute on a <th> element explicitly declares whether it is a header for a column ("col") or row ("row")?',
    codeSnippet: `<table>
  <tr>
    <th ???="col">Node</th>
    <th ???="col">Ping</th>
  </tr>
  <tr><td>Alpha</td><td>12ms</td></tr>
</table>`,
    answer: 'scope',
    acceptedAnswers: ['scope'],
    hint: 'A 5-letter attribute that defines the header cell’s "scope" (col, row, colgroup, or rowgroup).',
  },
  {
    id: 9,
    category: 'HTML',
    question:
      'Room 09 [Medium]: Security Fix — When using target="_blank", which rel attribute keyword prevents the opened page from accessing window.opener?',
    codeSnippet: `<a
  href="https://external-portal.example"
  target="_blank"
  rel="???"
>
  Launch External Tool
</a>`,
    answer: 'noopener',
    acceptedAnswers: ['noopener', 'noopener noreferrer', 'noreferrer'],
    hint: 'It literally tells the browser there should be "no opener" reference exposed.',
  },
  {
    id: 10,
    category: 'HTML',
    question:
      'Room 10 [Medium]: Mobile Viewport Bug — Complete the initial-scale value so mobile devices render the page at a 1:1 zoom ratio on first load.',
    codeSnippet: `<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=???"
  />
</head>`,
    answer: '1.0',
    acceptedAnswers: ['1.0', '1'],
    hint: 'A 100% unscaled ratio is written numerically as 1.0 (or 1).',
  },
  {
    id: 11,
    category: 'HTML',
    question:
      'Room 11 [Hard]: Which attribute on <input type="number"> restricts valid numeric entries to increments of 5 (0, 5, 10, ...)?',
    codeSnippet: `<input
  type="number"
  min="0"
  max="100"
  ???="5"
/>`,
    answer: 'step',
    acceptedAnswers: ['step'],
    hint: 'A 4-letter attribute defining the interval "step" between allowed numeric values.',
  },
  {
    id: 12,
    category: 'HTML',
    question:
      'Room 12 [Hard]: Performance — Which loading attribute value defers fetching an off-screen <img> until the user scrolls near it?',
    codeSnippet: `<img
  src="/assets/heavy-map.webp"
  alt="Sector Map"
  loading="???"
/>`,
    answer: 'lazy',
    acceptedAnswers: ['lazy'],
    hint: 'The opposite of "eager" loading.',
  },
  {
    id: 13,
    category: 'HTML',
    question:
      'Room 13 [Hard]: Bug Fix — Why does new FormData(form).get("codename") return null? Enter the missing HTML attribute on the <input>.',
    codeSnippet: `<form id="entry">
  <input id="codename" type="text" value="ghost" />
  <button type="submit">Transmit</button>
</form>
<script>
  const fd = new FormData(document.getElementById('entry'));
  console.log(fd.get('codename')); // null!
</script>`,
    answer: 'name',
    acceptedAnswers: ['name'],
    hint: 'The "id" attribute is for DOM/CSS/labels, whereas HTTP forms and FormData serialize inputs by a different 4-letter attribute.',
  },
  {
    id: 14,
    category: 'HTML',
    question:
      'Room 14 [Hard]: Resource Preloading — When using <link rel="preload">, which mandatory 2-letter attribute tells the browser the asset type (e.g., "font", "style", or "script")?',
    codeSnippet: `<head>
  <link
    rel="preload"
    href="/fonts/mono.woff2"
    ???="font"
    type="font/woff2"
    crossorigin
  />
</head>`,
    answer: 'as',
    acceptedAnswers: ['as'],
    hint: 'It specifies what the browser should treat the preloaded resource "as".',
  },
  {
    id: 15,
    category: 'HTML',
    question:
      'Room 15 [Hard]: Output Prediction — What number is logged to the console by querySelectorAll(".msg").length?',
    codeSnippet: `<template id="alert-tpl">
  <p class="msg">System Breach</p>
</template>
<script>
  console.log(document.querySelectorAll('.msg').length);
</script>`,
    answer: '0',
    acceptedAnswers: ['0'],
    hint: 'Elements inside a <template> live inside an inert DocumentFragment, not in the live DOM tree.',
  },

  // ==========================================
  // CSS CHALLENGES (Rooms 16 - 32)
  // ==========================================
  {
    id: 16,
    category: 'CSS',
    question:
      'Room 16 [Easy]: Enter the box-sizing value so that padding and border are included inside the declared 300px width instead of adding to it.',
    codeSnippet: `.terminal-card {
  width: 300px;
  padding: 24px;
  border: 2px solid #00f0ff;
  box-sizing: ???;
}`,
    answer: 'border-box',
    acceptedAnswers: ['border-box'],
    hint: 'The default is "content-box". The layout-safe alternative stops expanding at the outer border.',
  },
  {
    id: 17,
    category: 'CSS',
    question:
      'Room 17 [Easy]: Enter the justify-content value that pushes the first flex child to the far left edge, the last child to the far right edge, and distributes equal space between items.',
    codeSnippet: `.hud-header {
  display: flex;
  justify-content: ???;
  align-items: center;
}`,
    answer: 'space-between',
    acceptedAnswers: ['space-between'],
    hint: 'Options include center, space-around, space-evenly, and space-_______.',
  },
  {
    id: 18,
    category: 'CSS',
    question:
      'Room 18 [Easy]: Flexbox Axis Logic — When flex-direction is column, which CSS property centers items horizontally along the cross axis? (Enter the property name).',
    codeSnippet: `.stack {
  display: flex;
  flex-direction: column;
  justify-content: center;
  ???: center;
}`,
    answer: 'align-items',
    acceptedAnswers: ['align-items', 'align-items: center'],
    hint: 'In Flexbox, justify-content always controls the main axis, while this property controls the perpendicular cross axis.',
  },
  {
    id: 19,
    category: 'CSS',
    question:
      'Room 19 [Easy]: Bug Fix — The ::before pseudo-element dot never appears on screen. Enter the missing mandatory CSS property name.',
    codeSnippet: `.live-dot::before {
  ???: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #10b981;
}`,
    answer: 'content',
    acceptedAnswers: ['content'],
    hint: 'Without this property (even set to an empty string ""), ::before and ::after pseudo-elements are never generated.',
  },
  {
    id: 20,
    category: 'CSS',
    question:
      'Room 20 [Medium]: Specificity Calculation — Calculate the CSS specificity of this selector in the format ID,Class,Element (example: 0,2,1).',
    codeSnippet: `nav#top-bar .menu-item[data-active="true"] > a::after {
  content: "";
}`,
    answer: '1,2,3',
    acceptedAnswers: ['1,2,3', '(1,2,3)', '1-2-3', '1 2 3'],
    hint: 'IDs: #top-bar (1). Classes/Attributes: .menu-item, [data-active="true"] (2). Elements/Pseudo-elements: nav, a, ::after (3). Combinator > adds 0.',
  },
  {
    id: 21,
    category: 'CSS',
    question:
      'Room 21 [Medium]: Specificity Duel — Which color is applied to <a class="nav-link active"> inside <header id="header">?',
    codeSnippet: `/* Rule A */
#header .nav-link { color: red; }

/* Rule B */
header nav ul li a.nav-link.active { color: lime; }`,
    answer: 'red',
    acceptedAnswers: ['red'],
    hint: 'Compare specificity tuples: (1,1,0) vs (0,2,5). No amount of classes or elements can beat a single ID selector.',
  },
  {
    id: 22,
    category: 'CSS',
    question:
      'Room 22 [Medium]: Enter the CSS Grid value (number + unit) inside repeat(3, ???) to divide the container into 3 equal-width flexible columns.',
    codeSnippet: `.matrix-grid {
  display: grid;
  grid-template-columns: repeat(3, ???);
  gap: 16px;
}`,
    answer: '1fr',
    acceptedAnswers: ['1fr'],
    hint: 'CSS Grid introduced the fractional unit "fr" to share free space proportionally.',
  },
  {
    id: 23,
    category: 'CSS',
    question:
      'Room 23 [Medium]: Grid Logic — Which keyword inside repeat(???, minmax(240px, 1fr)) collapses empty tracks to 0px so items stretch to fill the entire row?',
    codeSnippet: `.responsive-cards {
  display: grid;
  grid-template-columns: repeat(???, minmax(240px, 1fr));
  gap: 16px;
}`,
    answer: 'auto-fit',
    acceptedAnswers: ['auto-fit'],
    hint: 'Between auto-fill and auto-fit, choose the one that "fits" existing tracks across the available width.',
  },
  {
    id: 24,
    category: 'CSS',
    question:
      'Room 24 [Medium]: Bug Fix — The sticky sidebar fails to stick while scrolling. Which CSS property on .layout-wrapper breaks position: sticky? (Enter the property name).',
    codeSnippet: `.layout-wrapper {
  overflow: hidden;
  min-height: 2000px;
}
.sidebar {
  position: sticky;
  top: 24px;
}`,
    answer: 'overflow',
    acceptedAnswers: ['overflow', 'overflow: hidden'],
    hint: 'Setting hidden, scroll, or auto on this clipping property on any ancestor prevents sticky positioning from attaching to the viewport.',
  },
  {
    id: 25,
    category: 'CSS',
    question:
      'Room 25 [Medium]: Combinator Prediction — Which paragraph text turns cyan (#00f0ff): First, Second, or Both?',
    codeSnippet: `<section>
  <h2>Protocol</h2>
  <p>First</p>
  <p>Second</p>
</section>
<style>
  h2 + p { color: #00f0ff; }
</style>`,
    answer: 'First',
    acceptedAnswers: ['First', 'first'],
    hint: 'The "+" (next-sibling / adjacent) combinator only matches the element immediately following h2, unlike "~".',
  },
  {
    id: 26,
    category: 'CSS',
    question:
      'Room 26 [Medium]: Margin Collapsing — In normal block flow, how many pixels of vertical space separate .box-1 and .box-2? (Include "px", e.g., 50px).',
    codeSnippet: `.box-1 {
  margin-bottom: 30px;
}
.box-2 {
  margin-top: 20px;
}`,
    answer: '30px',
    acceptedAnswers: ['30px', '30'],
    hint: 'Adjacent vertical margins in block layout collapse to the larger of the two values rather than adding together.',
  },
  {
    id: 27,
    category: 'CSS',
    question:
      'Room 27 [Hard]: CSS Custom Properties — Assuming --theme-color is undefined everywhere, what final color does .child render?',
    codeSnippet: `.parent {
  --color: red;
  color: blue;
}
.child {
  color: var(--theme-color, var(--color));
}`,
    answer: 'red',
    acceptedAnswers: ['red'],
    hint: 'Custom properties inherit down the DOM tree, and var() evaluates its second argument as a fallback when the first variable is missing.',
  },
  {
    id: 28,
    category: 'CSS',
    question:
      'Room 28 [Hard]: Flexbox Overflow Bug — A long unbroken token stretches .flex-item past its 300px parent instead of truncating with "...". Which CSS property must be set to 0 on .flex-item?',
    codeSnippet: `.row {
  display: flex;
  width: 300px;
}
.flex-item {
  flex: 1;
  ???: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}`,
    answer: 'min-width',
    acceptedAnswers: ['min-width', 'min-width: 0'],
    hint: 'Flex items default to min-width: auto, preventing them from shrinking smaller than their intrinsic content width.',
  },
  {
    id: 29,
    category: 'CSS',
    question:
      'Room 29 [Hard]: Stacking Context Bug — Why does .modal (z-index: 9999) render behind .panel-b (z-index: 2)? Enter the CSS property on .panel-a that creates a trapping stacking context.',
    codeSnippet: `.panel-a {
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
}`,
    answer: 'opacity',
    acceptedAnswers: ['opacity', 'opacity: 0.99'],
    hint: 'Any value less than 1 on this transparency property creates a brand new stacking context (and containing block issues for fixed elements if transform/filter are used).',
  },
  {
    id: 30,
    category: 'CSS',
    question:
      'Room 30 [Hard]: Modern Pseudo-Classes — What text color does <button class="btn"> inside <div id="main" class="card"> receive?',
    codeSnippet: `/* Rule A */
:where(#main) .btn { color: orange; }

/* Rule B */
.card .btn { color: cyan; }`,
    answer: 'cyan',
    acceptedAnswers: ['cyan'],
    hint: 'Unlike :is(), the :where() functional pseudo-class always contributes ZERO specificity (0,0,0) regardless of the selectors inside it.',
  },
  {
    id: 31,
    category: 'CSS',
    question:
      'Room 31 [Hard]: Fluid Typography — Given a 1000px viewport width and root 1rem = 16px, what computed font-size in pixels does clamp() resolve to? (Include "px").',
    codeSnippet: `.hero-title {
  font-size: clamp(1rem, 5vw, 2.5rem);
}`,
    answer: '40px',
    acceptedAnswers: ['40px', '40'],
    hint: 'Convert all three values to px: min = 16px, preferred = 5% of 1000px (50px), max = 2.5 * 16px (40px).',
  },
  {
    id: 32,
    category: 'CSS',
    question:
      'Room 32 [Hard]: Grid Track Placement — On this 4-column grid, which vertical grid column line number does .panel end at?',
    codeSnippet: `.board {
  display: grid;
  grid-template-columns: repeat(4, 100px);
}
.panel {
  grid-column: 2 / span 2;
}`,
    answer: '4',
    acceptedAnswers: ['4'],
    hint: 'Line 2 + spanning 2 column tracks = ending at grid line 2 + 2.',
  },

  // ==========================================
  // JAVASCRIPT CHALLENGES (Rooms 33 - 50)
  // ==========================================
  {
    id: 33,
    category: 'JavaScript',
    question:
      'Room 33 [Easy]: Output Prediction — What exact value is logged to the console?',
    codeSnippet: `console.log(1 + "2" + 3);`,
    answer: '123',
    acceptedAnswers: ['123', '"123"', "'123'"],
    hint: 'The + operator evaluates left-to-right; once a string is encountered, subsequent numbers are coerced into strings and concatenated.',
  },
  {
    id: 34,
    category: 'JavaScript',
    question:
      'Room 34 [Easy]: Output Prediction — Enter the two booleans logged to the console separated by a space (e.g., false true).',
    codeSnippet: `console.log(0 == false, 0 === false);`,
    answer: 'true false',
    acceptedAnswers: ['true false', 'true, false', 'true,false'],
    hint: 'Loose equality (==) coerces false to 0, whereas strict equality (===) compares both type and value without coercion.',
  },
  {
    id: 35,
    category: 'JavaScript',
    question:
      'Room 35 [Easy]: Array Methods — What exact JSON array string is logged to the console?',
    codeSnippet: `const nums = [1, 2, 3, 4];
const res = nums
  .filter((n) => n % 2 === 0)
  .map((n) => n * 10);

console.log(JSON.stringify(res));`,
    answer: '[20,40]',
    acceptedAnswers: ['[20,40]', '[20, 40]'],
    hint: 'First filter keeps only even numbers [2, 4], then map multiplies each by 10.',
  },
  {
    id: 36,
    category: 'JavaScript',
    question:
      'Room 36 [Easy]: Array Reduce — What final number is logged to the console?',
    codeSnippet: `const packets = [5, 10, 15];
const total = packets.reduce((acc, cur) => acc + cur, 10);
console.log(total);`,
    answer: '40',
    acceptedAnswers: ['40'],
    hint: 'Notice the initial accumulator value is 10, not 0.',
  },
  {
    id: 37,
    category: 'JavaScript',
    question:
      'Room 37 [Medium]: Reference Semantics — What number is logged for a.score?',
    codeSnippet: `const a = { score: 100 };
const b = a;
b.score = 250;
console.log(a.score);`,
    answer: '250',
    acceptedAnswers: ['250'],
    hint: 'Objects are assigned by reference in JavaScript; both variables point to the exact same object in heap memory.',
  },
  {
    id: 38,
    category: 'JavaScript',
    question:
      'Room 38 [Medium]: Bug / Gotcha Prediction — Calling .sort() without a comparator sorts elements lexicographically. What number is logged at arr[1]?',
    codeSnippet: `const arr = [10, 2, 30, 1];
arr.sort();
console.log(arr[1]);`,
    answer: '10',
    acceptedAnswers: ['10'],
    hint: 'When converted to UTF-16 strings ("1", "10", "2", "30"), "10" comes before "2".',
  },
  {
    id: 39,
    category: 'JavaScript',
    question:
      'Room 39 [Medium]: Classic Closure Loop Bug — Because var is function-scoped rather than block-scoped, what single digit is logged three times?',
    codeSnippet: `for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}`,
    answer: '3',
    acceptedAnswers: ['3'],
    hint: 'All three callbacks share the same i binding, which reaches its terminating value before the timer callbacks execute.',
  },
  {
    id: 40,
    category: 'JavaScript',
    question:
      'Room 40 [Medium]: Closures — Trace the lexical environment and enter the number logged on the final line.',
    codeSnippet: `function createCounter(start) {
  let count = start;
  return () => ++count;
}
const next = createCounter(5);
next();
console.log(next());`,
    answer: '7',
    acceptedAnswers: ['7'],
    hint: 'Prefix increment (++count) increments first and returns the updated value. The function is invoked twice.',
  },
  {
    id: 41,
    category: 'JavaScript',
    question:
      'Room 41 [Medium]: Hoisting & TDZ — Unlike var, accessing a let variable inside its Temporal Dead Zone throws an error even with typeof. Enter the exact JS Error class name thrown.',
    codeSnippet: `function inspect() {
  console.log(typeof cipherKey);
  let cipherKey = 42;
}
inspect();`,
    answer: 'ReferenceError',
    acceptedAnswers: ['ReferenceError'],
    hint: 'Reading an uninitialized let/const binding inside the Temporal Dead Zone throws a ________Error.',
  },
  {
    id: 42,
    category: 'JavaScript',
    question:
      'Room 42 [Medium]: Nullish Coalescing vs Logical OR — Enter the exact string logged to the console.',
    codeSnippet: `const retries = 0;
const a = retries || 3;
const b = retries ?? 3;
console.log(\`\${a}-\${b}\`);`,
    answer: '3-0',
    acceptedAnswers: ['3-0', '"3-0"', "'3-0'"],
    hint: '|| falls back on any falsy value (including 0), whereas ?? only falls back on null or undefined.',
  },
  {
    id: 43,
    category: 'JavaScript',
    question:
      'Room 43 [Medium]: DOM Manipulation — What number is logged by li.children.length after assigning textContent?',
    codeSnippet: `const li = document.createElement('li');
li.textContent = '<b>Alert</b>';
console.log(li.children.length);`,
    answer: '0',
    acceptedAnswers: ['0'],
    hint: 'textContent inserts raw text nodes and does NOT parse HTML tags into child DOM elements (unlike innerHTML).',
  },
  {
    id: 44,
    category: 'JavaScript',
    question:
      'Room 44 [Hard]: Event Loop — Enter the exact 4-letter output sequence printed to the console (no spaces, e.g., ABCD).',
    codeSnippet: `console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');`,
    answer: 'ADCB',
    acceptedAnswers: ['ADCB'],
    hint: 'Synchronous logs run first, then the microtask queue (Promise callbacks) drains completely before the next macrotask (setTimeout).',
  },
  {
    id: 45,
    category: 'JavaScript',
    question:
      'Room 45 [Hard]: Async/Await Control Flow — Enter the exact 4-digit output sequence printed to the console (no spaces, e.g., 1234).',
    codeSnippet: `async function run() {
  console.log(1);
  await Promise.resolve();
  console.log(2);
}
console.log(3);
run();
console.log(4);`,
    answer: '3142',
    acceptedAnswers: ['3142'],
    hint: 'An async function runs synchronously up to its first await expression, then yields control back to the caller while the rest schedules as a microtask.',
  },
  {
    id: 46,
    category: 'JavaScript',
    question:
      'Room 46 [Hard]: Promise Combinators — What exact string is logged to the console by Promise.all?',
    codeSnippet: `const p1 = Promise.resolve('OK');
const p2 = Promise.reject('ERR');
const p3 = Promise.resolve('DONE');

Promise.all([p1, p2, p3])
  .then(() => console.log('PASS'))
  .catch((err) => console.log(err));`,
    answer: 'ERR',
    acceptedAnswers: ['ERR', '"ERR"', "'ERR'"],
    hint: 'Promise.all short-circuits and rejects immediately with the reason of the first rejected promise.',
  },
  {
    id: 47,
    category: 'JavaScript',
    question:
      'Room 47 [Hard]: Set Deduplication — What final number is logged to the console?',
    codeSnippet: `const codes = [4, 2, 4, 1, 2];
const unique = [...new Set(codes)];
console.log(unique.length + unique[1]);`,
    answer: '5',
    acceptedAnswers: ['5'],
    hint: 'Set removes duplicates while preserving first-seen insertion order: [4, 2, 1]. Add its length to the element at index 1.',
  },
  {
    id: 48,
    category: 'JavaScript',
    question:
      'Room 48 [Hard]: Array Aggregation — Trace the reducer and enter the value logged for grouped.a.',
    codeSnippet: `const events = [
  { key: 'a', pts: 2 },
  { key: 'b', pts: 3 },
  { key: 'a', pts: 5 },
];
const grouped = events.reduce((acc, { key, pts }) => {
  acc[key] = (acc[key] ?? 0) + pts;
  return acc;
}, {});
console.log(grouped.a);`,
    answer: '7',
    acceptedAnswers: ['7'],
    hint: 'Nullish coalescing (??) initializes missing keys to 0 and adds every matching event pts.',
  },
  {
    id: 49,
    category: 'JavaScript',
    question:
      'Room 49 [Hard]: Functional Pipeline & Currying — Trace the pipeline starting from 2 and enter the final logged number.',
    codeSnippet: `const add = (a) => (b) => a + b;
const mul = (a) => (b) => a * b;
const pipeline = [add(3), mul(4), add(1)];

const result = pipeline.reduce((val, fn) => fn(val), 2);
console.log(result);`,
    answer: '21',
    acceptedAnswers: ['21'],
    hint: 'Step by step: add(3)(2) -> 5, then mul(4)(5) -> 20, then add(1)(20).',
  },
  {
    id: 50,
    category: 'JavaScript',
    question:
      'Room 50 [Final Boss]: Async Interleaving + Closure State — Trace the microtask suspension order carefully and enter the final number logged.',
    codeSnippet: `async function unlockVault() {
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

unlockVault().then((val) => console.log(val));`,
    answer: '30',
    acceptedAnswers: ['30'],
    hint: 'mutate() suspends at its await, letting "key += 5" run synchronously (15) BEFORE "key *= 2" executes on resume.',
  },
];

export function getRoomById(id) {
  return ROOMS.find((room) => room.id === id) || ROOMS[0];
}

export function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function checkRoomAnswer(room, userInput) {
  const normalizedInput = normalizeAnswer(userInput);
  if (!normalizedInput) return false;

  const candidates = [room.answer, ...(room.acceptedAnswers || [])];
  for (const candidate of candidates) {
    if (normalizeAnswer(candidate) === normalizedInput) {
      return true;
    }
  }

  // Allow forgiving quote/semicolon stripping for CSS/JS outputs
  const compactInput = normalizedInput
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/;$/, '')
    .trim();
  for (const candidate of candidates) {
    const compactCandidate = normalizeAnswer(candidate)
      .replace(/^['"`]|['"`]$/g, '')
      .replace(/;$/, '')
      .trim();
    if (compactCandidate === compactInput) {
      return true;
    }
  }

  return false;
}
