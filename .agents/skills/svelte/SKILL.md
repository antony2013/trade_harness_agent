---
name: svelte
description: >-
  Complete development guide for Svelte 5 and SvelteKit. Covers runes ($state, $derived, $effect, $props, $bindable), snippets (#snippet, @render), SvelteKit routing, data loading, actions, and API references.
---

# Svelte & SvelteKit Development Guide

This skill provides comprehensive instructions on designing, implementing, and deploying Svelte 5 web applications and SvelteKit routing, loading patterns, and form actions.

---

## Svelte 5 Core Concepts & Runes

You **MUST** use the Svelte 5 API unless explicitly tasked to write Svelte 4/legacy syntax. Other syntax not explicitly listed like `{#if ...}` blocks stay the same.

- To mark something as state, use the `$state` rune (e.g. `let count = $state(0)` instead of `let count = 0`).
- To mark something as derived, use the `$derived` rune (e.g. `const double = $derived(count * 2)` instead of `$: double = count * 2`).
- To create a side effect, use the `$effect` rune (e.g. `$effect(() => console.log(double))` instead of `$: console.log(double)`).
- To create component props, use the `$props` rune (e.g. `let { foo = true, bar } = $props();` instead of `export let foo = true; export let bar;`).
- When listening to DOM events, do **NOT** use colons as part of the event name anymore (e.g. use `<button onclick={...} />` instead of `<button on:click={...} />`).

### 1. $state & Reactivity
`$state` creates reactive variables that update the UI automatically. Arrays and objects become deeply reactive proxies.

```svelte
<script>
  let count = $state(0);
  let todos = $state([{ done: false, text: 'add more todos' }]);

  function toggle() {
    todos[0].done = !todos[0].done; // Deep reactivity
  }
</script>

<button onclick={() => count++}>Clicked: {count}</button>
```

- **Warning**: Do **NOT** destructure reactive proxies (e.g. `let { done } = todos[0]`), as this breaks reactivity; instead, access properties directly.
- **State in Classes**: Use `$state` in class fields for reactive properties:
  ```typescript
  class Todo {
    done = $state(false);
    text = $state('');
    
    reset() {
      this.text = '';
      this.done = false;
    }
  }
  ```

### 2. $state.raw & $state.snapshot
- **$state.raw**: Creates shallow state where mutations are not tracked. Updates require reassigning the entire object.
  ```typescript
  let person = $state.raw({ name: 'Heraclitus', age: 49 });
  // person.age += 1; // NO effect!
  person = { name: 'Heraclitus', age: 50 }; // Correct
  ```
- **$state.snapshot**: Produces a plain object copy of reactive state (unpacking the proxy).
  ```typescript
  console.log($state.snapshot(counter));
  ```

### 3. $derived & $derived.by
`$derived` computes reactive values based on dependencies. Keep derived expressions pure (no side effects).
- **$derived**:
  ```svelte
  <script>
    let count = $state(0);
    let doubled = $derived(count * 2);
  </script>
  ```
- **$derived.by**: Use for multi-line or complex calculation logic.
  ```svelte
  <script>
    let numbers = $state([1, 2, 3]);
    let total = $derived.by(() => {
      let sum = 0;
      for (const n of numbers) sum += n;
      return sum;
    });
  </script>
  ```
- **Overriding Derived Values**: Reassigning a derived value works for features like optimistic UI. It will reset to the computed value once dependencies update.

### 4. $effect, $effect.pre, $effect.root
`$effect` runs after the DOM updates. Always return a teardown function when needed (e.g., clearing intervals, event listeners).
```svelte
<script>
  let count = $state(0);
  $effect(() => {
    const interval = setInterval(() => { count += 1; }, 1000);
    return () => clearInterval(interval);
  });
</script>
```
- **$effect.pre**: Runs *before* the DOM updates (e.g. for autoscrolling calculations).
- **$effect.root**: Creates a non-tracked scope for nested effects with manual cleanup (does not auto-cleanup).

### 5. $props & $bindable
- **$props**: Access component inputs. Fallback values are set via destructuring.
  ```svelte
  <script>
    let { adjective = 'happy', children } = $props();
  </script>
  ```
- **$props.id()**: Generates a unique ID for the component instance (useful for form labels).
  ```svelte
  <script>
    const uid = $props.id();
  </script>
  <label for="{uid}-input">Name:</label>
  <input id="{uid}-input" />
  ```
- **$bindable**: Marks props as bindable to allow two-way data flow back to the parent.
  ```svelte
  <script>
    let { value = $bindable() } = $props();
  </script>
  ```

### 6. Snippets & {@render ...}
Snippets allow you to define reusable chunks of markup with parameters inside your component. They replace Svelte 4 `<slot>` tags.
- **Definition**:
  ```svelte
  {#snippet figure(image)}
    <figure>
      <img src={image.src} alt={image.caption} />
      <figcaption>{image.caption}</figcaption>
    </figure>
  {/snippet}
  ```
- **Rendering**:
  ```svelte
  {@render figure({ src: 'logo.png', caption: 'Svelte' })}
  ```
- **Passing Snippets to Components**:
  ```svelte
  <Table data={fruits}>
    {#snippet header()}
      <th>fruit</th>
      <th>qty</th>
    {/snippet}
    {#snippet row(d)}
      <td>{d.name}</td>
      <td>{d.qty}</td>
    {/snippet}
  </Table>
  ```
- **Implicit Snippets (Default Children)**:
  ```svelte
  <!-- Button.svelte -->
  <script>
    let { children } = $props();
  </script>
  <button>{@render children()}</button>
  ```
- **Typing Snippets**:
  ```typescript
  import type { Snippet } from 'svelte';
  interface Props {
    children: Snippet;
    row: Snippet<[any]>;
  }
  ```

### 7. <svelte:boundary>
Prevents rendering errors from crashing the whole app. Can be configured with custom failed/pending snippets and onerror handlers.
```svelte
<svelte:boundary onerror={(error) => console.error(error)}>
  <FlakyComponent />
  {#snippet failed(error, reset)}
    <button onclick={reset}>Retry</button>
  {/snippet}
</svelte:boundary>
```

---

## SvelteKit Core Architecture

### 1. Setup & Project Structure
Scaffold using `npx sv create`. Do NOT use `npm create svelte`. Keep dev dependencies in `devDependencies`.

**Minimal Folder Structure**:
```
src/
├── lib/               # Shared code ($lib)
│   └── server/        # Server-only code ($lib/server)
├── routes/            # Routes folder (filesystem routing)
│   ├── +layout.svelte # Shared page shell layout
│   ├── +page.svelte   # Main page
│   └── +server.ts     # API Endpoint (GET/POST etc.)
├── app.html           # HTML template
├── hooks.server.ts    # Global server hooks
```

### 2. Filesystem Routing
Every route is a folder. Visitable routes contain `+page.svelte`.
- **+page.svelte**: Defines the UI.
- **+page.js / +page.ts**: Load data (runs on both server and client).
- **+page.server.js / +page.server.ts**: Load data (always runs on server-side). Can access databases/secrets.
- **+layout.svelte**: Standard page shell/wrapper. Must render child pages with `{@render children()}`:
  ```svelte
  <script>
    let { children, data } = $props();
  </script>
  <nav>Navbar</nav>
  {@render children()}
  ```

### 3. Loading Data & Props
Loader functions supply data to pages and layouts. The return value is injected into the component's `data` prop.
- **Loader (+page.server.ts)**:
  ```typescript
  import type { PageServerLoad } from './$types';
  
  export const load: PageServerLoad = async ({ fetch }) => {
    return {
      title: 'Harness Algo Dashboard',
      data: [1, 2, 3]
    };
  };
  ```
- **Page (+page.svelte)**:
  ```svelte
  <script lang="ts">
    import type { PageProps } from './$types';
    let { data }: PageProps = $props();
  </script>
  <h1>{data.title}</h1>
  ```

### 4. Forms & Actions
`+page.server.ts` can export page `actions` to handle POST requests.
- **Actions Definition (+page.server.ts)**:
  ```typescript
  import { fail, redirect } from '@sveltejs/kit';
  import type { Actions } from './$types';

  export const actions: Actions = {
    login: async ({ request, cookies }) => {
      const data = await request.formData();
      const email = data.get('email');
      
      if (!email) {
        return fail(400, { email, missing: true });
      }
      
      cookies.set('session', 'xyz', { path: '/' });
      redirect(303, '/dashboard');
    }
  };
  ```
- **Form UI (+page.svelte)**:
  ```svelte
  <script lang="ts">
    import { enhance } from '$app/forms';
    let { form } = $props();
  </script>

  <form method="POST" action="?/login" use:enhance>
    <input name="email" value={form?.email ?? ''} />
    <button>Log In</button>
  </form>
  ```
  - **Note**: Use `use:enhance` from `$app/forms` for progressive enhancement (submits via fetch, avoids page refresh). Do **not** use custom handlers or `onsubmit` unless writing custom deserialize logic.

### 5. API Endpoints (+server.ts)
For raw JSON/text endpoints, export functions matching HTTP methods (`GET`, `POST`, `PUT`, `DELETE`).
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  return json({ status: 'running' });
};
```

### 6. Global Hooks (hooks.server.ts)
Runs on every request. Ideal for authenticating session cookies and populating `event.locals`.
```typescript
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const session = event.cookies.get('session');
  event.locals.user = session ? { id: 1, name: 'Trader' } : null;
  
  return resolve(event);
};
```

---

## API & Module Reference

### 1. Navigation (`$app/navigation`)
- `goto(path, options)`: Programmatic navigation.
- `invalidate(urlOrKey)`: Re-runs loaders matching the dependency.
- `invalidateAll()`: Re-runs all loaders for the current route.
- `pushState(path, state)` / `replaceState(path, state)`: Shallow routing history entries (e.g., for modals).

### 2. State (`$app/state`)
- `page`: Reactive object containing `url`, `params`, `data`, `form`, `status`, `error`.
  ```svelte
  <script>
    import { page } from '$app/state';
  </script>
  <p>Current Path: {page.url.pathname}</p>
  ```

### 3. Server Modules (`$app/server`)
- `getRequestEvent()`: Retrieve server `RequestEvent` inside shared library functions.
- `read(fileUrl)`: Reads a static asset compiled by Vite.

### 4. Environments
- `$env/static/private` / `$env/dynamic/private`: Private server-only variables (e.g. database keys, Upstox API secret).
- `$env/static/public` / `$env/dynamic/public`: Public variables prefixed with `PUBLIC_`, safe for the browser.

---

## Common Svelte 5 Pitfalls

1. **Destructuring `$props`**: Avoid destructuring props containing reactive properties unless they are static, or use getters. If you destructure them directly, reactivity might break if mutated.
2. **Importing Runes**: Do **NOT** write `import { $state } from 'svelte'`. Runes are compiler keywords, not functions.
3. **Mixing Client/Server Imports**: Importing server-only secrets/DB libraries into client files will trigger a Vite compile-time error. Always place them in `src/lib/server/` or name the file `*.server.ts`.
4. **Prerendering Pages with Actions**: Do **NOT** set `export const prerender = true` on pages containing POST actions or relying on live session cookies/headers.
