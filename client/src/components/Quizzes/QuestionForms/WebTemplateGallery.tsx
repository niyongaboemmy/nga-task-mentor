/**
 * WebTemplateGallery.tsx
 *
 * A visual, live-previewing template gallery for web languages.
 * Replaces the plain card list. Shows a live iframe preview on hover.
 */
import React, { useState } from "react";
import { Eye, CheckCircle, ChevronRight, Globe } from "lucide-react";

export interface WebTemplate {
  id: string;
  category: "layout" | "component" | "form" | "api" | "fullpage" | "ui";
  tag: string; // shown as a badge, e.g. "CSS Grid"
  title: string;
  description: string;
  languages: string[]; // which languages this template applies to
  difficulty: "beginner" | "intermediate" | "advanced";
  /** The starter code map: language → code */
  starterCode: Record<string, string>;
  /** Optional minimal HTML to render in the live preview iframe */
  previewHtml?: string;
}

// ─── Template library ─────────────────────────────────────────────────────────
// Each template has an inline previewHtml for live rendering.
export const WEB_TEMPLATES: WebTemplate[] = [
  // ── HTML ────────────────────────────────────────────────────────────────────
  {
    id: "html-page",
    category: "fullpage",
    tag: "HTML",
    title: "Semantic Web Page",
    description: "Build a complete HTML page with proper semantic structure",
    languages: ["html"],
    difficulty: "beginner",
    starterCode: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
</head>
<body>
  <header>
    <nav>
      <!-- Navigation here -->
    </nav>
  </header>
  <main>
    <h1>Welcome</h1>
    <!-- Main content here -->
  </main>
  <footer>
    <!-- Footer here -->
  </footer>
</body>
</html>`,
    },
    previewHtml: `<style>body{font-family:system-ui;margin:0;background:#f8fafc}header{background:#1e40af;color:white;padding:12px 20px;font-size:14px}main{padding:24px;max-width:600px;margin:0 auto}footer{background:#e2e8f0;padding:12px 20px;text-align:center;font-size:12px;color:#64748b}</style><header>🌐 Navigation</header><main><h1 style="margin-top:0;color:#1e40af">Welcome</h1><p style="color:#475569">Main content area</p></main><footer>© 2024 My Page</footer>`,
  },
  {
    id: "html-form",
    category: "form",
    tag: "HTML",
    title: "Accessible Contact Form",
    description: "Create a labeled, validated HTML form",
    languages: ["html"],
    difficulty: "beginner",
    starterCode: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Contact Form</title>
</head>
<body>
  <main>
    <h1>Contact Us</h1>
    <form action="/submit" method="POST">
      <div class="form-group">
        <label for="name">Full Name</label>
        <input type="text" id="name" name="name" required placeholder="John Doe">
      </div>
      <div class="form-group">
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-group">
        <label for="message">Message</label>
        <textarea id="message" name="message" rows="4" required></textarea>
      </div>
      <button type="submit">Send Message</button>
    </form>
  </main>
</body>
</html>`,
    },
    previewHtml: `<style>body{font-family:system-ui;max-width:400px;margin:0 auto;padding:20px}.form-group{margin-bottom:12px}label{display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#374151}input,textarea{width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;box-sizing:border-box}button{width:100%;padding:10px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600}</style><h2 style="margin-top:0;font-size:16px">Contact Us</h2><div class="form-group"><label>Full Name</label><input placeholder="John Doe"></div><div class="form-group"><label>Email</label><input type="email" placeholder="you@email.com"></div><div class="form-group"><label>Message</label><textarea rows="2"></textarea></div><button>Send Message</button>`,
  },
  {
    id: "html-tailwind",
    category: "layout",
    tag: "Tailwind CSS",
    title: "Tailwind Starter",
    description: "A responsive utility-first layout using Tailwind CDN",
    languages: ["html", "css", "javascript"],
    difficulty: "beginner",
    starterCode: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tailwind Project</title>
  <!-- Load Tailwind CSS from CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Optional Custom Configuration -->
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '#3b82f6' }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-50 text-gray-800 font-sans p-8">
  <div class="max-w-xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6 md:p-8">
    <div class="flex items-center gap-4 mb-4">
      <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">T</div>
      <h1 class="text-2xl font-bold text-gray-900">Tailwind CSS</h1>
    </div>
    <p class="text-gray-600 mb-6">Rapidly build modern websites without ever leaving your HTML.</p>
    <button class="bg-primary hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors">
      Get Started
    </button>
  </div>
</body>
</html>`,
      css: `/* Custom CSS overrides (mostly unnecessary with Tailwind) */\n`,
      javascript: `console.log("Tailwind configured!");\n`,
    },
    previewHtml: `<style>body{font-family:system-ui;background:#f9fafb;padding:20px;margin:0}.card{background:white;border-radius:12px;box-shadow:0 4px 6px -1px rgb(0 0 0/.1);padding:24px;max-width:320px}.header{display:flex;align-items:center;gap:16px;margin-bottom:16px}.circle{width:48px;height:48px;background:#3b82f6;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-weight:700}.btn{background:#3b82f6;color:white;padding:8px 24px;border:none;border-radius:8px;font-weight:600;margin-top:16px}</style><div class="card"><div class="header"><div class="circle">T</div><h2 style="margin:0;font-size:20px">Tailwind</h2></div><p style="color:#4b5563;margin:0;font-size:14px">Rapidly build modern websites.</p><button class="btn">Start</button></div>`,
  },
  {
    id: "html-bootstrap",
    category: "layout",
    tag: "Bootstrap",
    title: "Bootstrap Starter",
    description: "Responsive grid layout using Bootstrap 5 CDN",
    languages: ["html", "css", "javascript"],
    difficulty: "beginner",
    starterCode: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bootstrap Project</title>
  <!-- Load Bootstrap CSS from CDN -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-5">
    <div class="row min-vh-50 align-items-center justify-content-center">
      <div class="col-md-8 col-lg-6 text-center">
        <div class="card shadow-sm border-0 rounded-4">
          <div class="card-body p-5">
            <h1 class="display-6 fw-bold text-primary mb-3">Bootstrap 5</h1>
            <p class="lead text-muted mb-4">Build fast, responsive sites with the world's most popular front-end open source toolkit.</p>
            <button class="btn btn-primary btn-lg rounded-pill px-5">Explore</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Load Bootstrap JS from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`,
      css: `/* Custom CSS overrides */\n`,
      javascript: `console.log("Bootstrap configured!");\n`,
    },
    previewHtml: `<style>body{font-family:system-ui;background:#f8f9fa;padding:24px;margin:0;text-align:center}.card{background:white;border-radius:16px;box-shadow:0 2px 4px rgba(0,0,0,.05);padding:32px;max-width:300px;margin:0 auto}.badge{background:#0d6efd;color:white;padding:4px 8px;border-radius:12px;font-weight:700;font-size:10px}.btn{background:#0d6efd;color:white;padding:10px 32px;border:none;border-radius:50px;font-size:14px;font-weight:600}</style><div class="card"><h2 style="margin:0 0 12px;color:#0d6efd;font-size:24px">Bootstrap</h2><p style="color:#6c757d;font-size:14px;line-height:1.5;margin-bottom:20px">Build fast, responsive sites easily.</p><button class="btn">Explore</button></div>`,
  },

  // ── CSS ────────────────────────────────────────────────────────────────────
  {
    id: "css-flexbox",
    category: "layout",
    tag: "Flexbox",
    title: "Flexbox Navigation Bar",
    description: "Build a responsive nav bar using CSS Flexbox",
    languages: ["css", "html"],
    difficulty: "beginner",
    starterCode: {
      css: `/* Style the navigation bar */
.navbar {
  /* Use flexbox to align items */
  display: flex;
  /* Make items sit on the same row */
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  background: #1e40af;
}

.navbar .logo {
  color: white;
  font-weight: 700;
  font-size: 1.2rem;
}

.navbar .nav-links {
  display: flex;
  gap: 20px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.navbar .nav-links a {
  color: rgba(255,255,255,0.85);
  text-decoration: none;
  font-size: 0.9rem;
  /* Add hover effect */
}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Flexbox Nav</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="navbar">
    <span class="logo">Brand</span>
    <ul class="nav-links">
      <li><a href="#">Home</a></li>
      <li><a href="#">About</a></li>
      <li><a href="#">Contact</a></li>
    </ul>
  </nav>
</body>
</html>`,
    },
    previewHtml: `<style>*{margin:0;box-sizing:border-box}.navbar{display:flex;justify-content:space-between;align-items:center;padding:0 24px;height:52px;background:#1e40af}.logo{color:white;font-weight:700;font-family:system-ui}.nav-links{display:flex;gap:16px;list-style:none}.nav-links a{color:rgba(255,255,255,.85);text-decoration:none;font-size:13px;font-family:system-ui}</style><nav class="navbar"><span class="logo">Brand</span><ul class="nav-links"><li><a href="#">Home</a></li><li><a href="#">About</a></li><li><a href="#">Contact</a></li></ul></nav>`,
  },
  {
    id: "css-grid",
    category: "layout",
    tag: "CSS Grid",
    title: "CSS Grid Card Layout",
    description: "Create a responsive card grid using CSS Grid",
    languages: ["css", "html"],
    difficulty: "intermediate",
    starterCode: {
      css: `.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  padding: 20px;
}

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  padding: 20px;
  /* Add hover animation */
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}

.card h3 {
  margin: 0 0 8px;
  font-size: 1rem;
  color: #1e293b;
}

.card p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Card Grid</title>
  <link rel="stylesheet" href="style.css">
</head>
<body style="background:#f1f5f9;margin:0">
  <div class="card-grid">
    <div class="card">
      <h3>Card One</h3>
      <p>Description for the first card.</p>
    </div>
    <div class="card">
      <h3>Card Two</h3>
      <p>Description for the second card.</p>
    </div>
    <div class="card">
      <h3>Card Three</h3>
      <p>Description for the third card.</p>
    </div>
  </div>
</body>
</html>`,
    },
    previewHtml: `<style>*{margin:0;box-sizing:border-box}body{background:#f1f5f9;font-family:system-ui;padding:10px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{background:white;border-radius:8px;padding:12px;box-shadow:0 1px 6px rgba(0,0,0,.08)}.card h3{margin:0 0 4px;font-size:13px;color:#1e293b}.card p{margin:0;font-size:11px;color:#64748b}</style><div class="grid"><div class="card"><h3>Card One</h3><p>Description goes here</p></div><div class="card"><h3>Card Two</h3><p>Description goes here</p></div><div class="card"><h3>Card Three</h3><p>Description goes here</p></div></div>`,
  },

  // ── JavaScript ───────────────────────────────────────────────────────────
  {
    id: "js-dom",
    category: "component",
    tag: "DOM",
    title: "Interactive DOM Manipulation",
    description: "Build an interactive UI with JavaScript DOM APIs",
    languages: ["javascript"],
    difficulty: "beginner",
    starterCode: {
      javascript: `// Task: Create a counter that starts at 0
// Clicking "+" increases it, "-" decreases it (min 0)

document.addEventListener('DOMContentLoaded', () => {
  const counter = document.getElementById('counter');
  const btnInc = document.getElementById('btn-inc');
  const btnDec = document.getElementById('btn-dec');

  let count = 0;

  // Handle increment
  btnInc.addEventListener('click', () => {
    // TODO: implement
  });

  // Handle decrement
  btnDec.addEventListener('click', () => {
    // TODO: implement (don't go below 0)
  });
});`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Counter</title>
  <style>
    body { font-family: system-ui; display: flex; justify-content: center; padding: 40px; background: #f8fafc; }
    .counter-card { background: white; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,.1); }
    #counter { font-size: 3rem; font-weight: 700; color: #1e293b; margin: 20px 0; }
    .buttons { display: flex; gap: 12px; justify-content: center; }
    button { width: 48px; height: 48px; border-radius: 50%; border: none; font-size: 1.4rem; cursor: pointer; }
    #btn-inc { background: #22c55e; color: white; }
    #btn-dec { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <div class="counter-card">
    <h2>Counter</h2>
    <div id="counter">0</div>
    <div class="buttons">
      <button id="btn-dec">−</button>
      <button id="btn-inc">+</button>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
    },
    previewHtml: `<style>body{font-family:system-ui;display:flex;justify-content:center;padding:20px;background:#f8fafc;margin:0}.card{background:white;padding:24px;border-radius:12px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.08);min-width:160px}.num{font-size:2.5rem;font-weight:700;color:#1e293b;margin:12px 0}.btns{display:flex;gap:10px;justify-content:center}button{width:40px;height:40px;border-radius:50%;border:none;font-size:1.2rem;cursor:pointer}</style><div class="card"><h3 style="margin:0">Counter</h3><div class="num" id="n">0</div><div class="btns"><button style="background:#ef4444;color:white" onclick="let n=document.getElementById('n');n.textContent=Math.max(0,+n.textContent-1)">−</button><button style="background:#22c55e;color:white" onclick="let n=document.getElementById('n');n.textContent=+n.textContent+1">+</button></div></div>`,
  },
  {
    id: "js-fetch",
    category: "api",
    tag: "Fetch API",
    title: "Fetch & Display Data",
    description: "Fetch JSON from an API and render it on the page",
    languages: ["javascript"],
    difficulty: "intermediate",
    starterCode: {
      javascript: `// Task: Fetch posts from https://jsonplaceholder.typicode.com/posts?_limit=5
// and display them in the #post-list container

async function loadPosts() {
  const list = document.getElementById('post-list');
  list.innerHTML = '<li>Loading...</li>';
  
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5');
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const posts = await response.json();
    
    // TODO: Render posts inside #post-list
    // Each <li> should contain the post title
    list.innerHTML = '';
    
  } catch (error) {
    list.innerHTML = \`<li class="error">Error: \${error.message}</li>\`;
  }
}

loadPosts();`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Posts</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 0 16px; }
    #post-list { list-style: none; padding: 0; }
    #post-list li { padding: 12px; margin-bottom: 8px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #3b82f6; }
    .error { border-left-color: #ef4444 !important; color: #ef4444; }
  </style>
</head>
<body>
  <h1>Latest Posts</h1>
  <ul id="post-list"></ul>
  <script src="app.js"></script>
</body>
</html>`,
    },
    previewHtml: `<style>body{font-family:system-ui;max-width:400px;margin:0;padding:10px}ul{list-style:none;padding:0;margin:0}li{padding:10px;margin-bottom:6px;background:#f8fafc;border-radius:6px;border-left:3px solid #3b82f6;font-size:12px;color:#1e293b}</style><h3 style="margin:0 0 10px;font-size:14px">Latest Posts</h3><ul><li>sunt aut facere repellat provident...</li><li>qui est esse</li><li>ea molestias quasi exercitationem...</li><li>eum et est occaecati</li><li>nesciunt quas odio</li></ul>`,
  },

  // ── TypeScript ───────────────────────────────────────────────────────────
  {
    id: "ts-class",
    category: "component",
    tag: "TypeScript",
    title: "Typed Class & Interface",
    description: "Implement a typed class using TypeScript interfaces",
    languages: ["typescript"],
    difficulty: "intermediate",
    starterCode: {
      typescript: `// Task: Implement a generic Stack<T> data structure
// with push, pop, peek, and isEmpty methods

interface Stack<T> {
  push(item: T): void;
  pop(): T | undefined;
  peek(): T | undefined;
  isEmpty(): boolean;
  size(): number;
}

class ArrayStack<T> implements Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    // TODO: add item to top of stack
  }

  pop(): T | undefined {
    // TODO: remove and return top item
    return undefined;
  }

  peek(): T | undefined {
    // TODO: return top item without removing
    return undefined;
  }

  isEmpty(): boolean {
    // TODO: return true if stack has no items
    return true;
  }

  size(): number {
    return this.items.length;
  }
}

// Test your implementation
const stack = new ArrayStack<number>();
stack.push(1);
stack.push(2);
stack.push(3);
console.log(stack.peek()); // Expected: 3
console.log(stack.pop());  // Expected: 3
console.log(stack.size()); // Expected: 2`,
    },
    previewHtml: `<style>body{font-family:monospace;padding:16px;background:#1e1e1e;color:#d4d4d4;margin:0}pre{margin:0;font-size:12px}.kw{color:#569cd6}.fn{color:#dcdcaa}.str{color:#ce9178}.num{color:#b5cea8}</style><pre><span class="kw">interface</span> Stack&lt;T&gt; {
  <span class="fn">push</span>(item: T): <span class="kw">void</span>;
  <span class="fn">pop</span>(): T | <span class="kw">undefined</span>;
  <span class="fn">peek</span>(): T | <span class="kw">undefined</span>;
  <span class="fn">isEmpty</span>(): <span class="kw">boolean</span>;
}

<span class="kw">class</span> ArrayStack&lt;T&gt; <span class="kw">implements</span> Stack&lt;T&gt; {
  <span class="kw">private</span> items: T[] = [];
  <span class="fn">push</span>(item: T) { ... }
}</pre>`,
  },

  // ── React ────────────────────────────────────────────────────────────────
  {
    id: "react-component",
    category: "component",
    tag: "React",
    title: "React State Component",
    description: "Build a stateful React component with hooks",
    languages: ["react"],
    difficulty: "intermediate",
    starterCode: {
      javascript: `import React, { useState } from 'react';

// Task: Build a Todo list component
// - Display a list of todos
// - Allow adding new todos (text input + button)
// - Allow marking todos as done (click to toggle)
// - Show count of completed / total

const TodoApp = () => {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Learn React hooks', done: false },
    { id: 2, text: 'Build a project', done: false },
  ]);
  const [inputValue, setInputValue] = useState('');

  const addTodo = () => {
    // TODO: add inputValue as a new todo and clear input
  };

  const toggleTodo = (id) => {
    // TODO: toggle the done status of the todo with the given id
  };

  return (
    <div className="app">
      <h1>Todo List</h1>
      {/* TODO: Render the todo list */}
      {/* TODO: Render the input + add button */}
    </div>
  );
};

export default TodoApp;`,
    },
    previewHtml: `<style>body{font-family:system-ui;max-width:360px;margin:10px;padding:0}.app{background:white;border-radius:10px;padding:16px;box-shadow:0 2px 10px rgba(0,0,0,.08)}.todo-item{padding:8px 12px;margin-bottom:6px;border-radius:6px;background:#f8fafc;display:flex;align-items:center;gap:8px;font-size:13px}.done{text-decoration:line-through;color:#94a3b8}.input-row{display:flex;gap:6px;margin-top:10px}input{flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px}button{padding:6px 12px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer}</style><div class="app"><h3 style="margin:0 0 10px;font-size:14px">📝 Todo List <span style="font-weight:400;color:#94a3b8;font-size:11px">(1/2 done)</span></h3><div class="todo-item"><span>☑️</span><span class="done">Learn React hooks</span></div><div class="todo-item"><span>☐</span><span>Build a project</span></div><div class="input-row"><input placeholder="Add todo..."><button>+</button></div></div>`,
  },
  {
    id: "react-fetch",
    category: "api",
    tag: "React + API",
    title: "React Data Fetching",
    description: "Fetch and display API data with loading/error states",
    languages: ["react"],
    difficulty: "intermediate",
    starterCode: {
      javascript: `import React, { useState, useEffect } from 'react';

// Task: Fetch users from https://jsonplaceholder.typicode.com/users
// Display: name, email, company name for each user
// Handle: loading state, error state, and empty state

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO: fetch users and update state
    const fetchUsers = async () => {
      try {
        // ...
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="user-list">
      <h2>Users ({users.length})</h2>
      {/* TODO: render user cards */}
    </div>
  );
};

export default UserList;`,
    },
    previewHtml: `<style>body{font-family:system-ui;margin:10px;padding:0}.card{padding:12px;background:white;border-radius:8px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.06)}.name{font-weight:600;font-size:13px;color:#1e293b}.email{font-size:11px;color:#64748b}.company{font-size:10px;color:#94a3b8;margin-top:2px}</style><h4 style="margin:0 0 8px;font-size:13px">Users (3)</h4><div class="card"><div class="name">Leanne Graham</div><div class="email">Sincere@april.biz</div><div class="company">Romaguera-Crona</div></div><div class="card"><div class="name">Ervin Howell</div><div class="email">Shanna@melissa.tv</div><div class="company">Deckow-Crist</div></div><div class="card"><div class="name">Clementine Bauch</div><div class="email">Nathan@yesenia.net</div><div class="company">Romaguera-Jacobson</div></div>`,
  },

  // ── Node.js ──────────────────────────────────────────────────────────────
  {
    id: "node-api",
    category: "api",
    tag: "Node.js",
    title: "Express REST API",
    description: "Build a REST API with Express.js routes and middleware",
    languages: ["nodejs"],
    difficulty: "intermediate",
    starterCode: {
      javascript: `const express = require('express');
const app = express();

app.use(express.json());

// In-memory data store
let todos = [
  { id: 1, title: 'Learn Node.js', completed: false },
  { id: 2, title: 'Build an API', completed: false },
];
let nextId = 3;

// GET /todos - Return all todos
app.get('/todos', (req, res) => {
  // TODO: respond with todos array
});

// POST /todos - Create a new todo
app.post('/todos', (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  // TODO: create todo, add to array, respond with 201 + new todo
});

// PUT /todos/:id - Toggle completed status
app.put('/todos/:id', (req, res) => {
  // TODO: find todo by id, toggle completed, respond with updated todo
  // If not found, respond with 404
});

// DELETE /todos/:id - Delete a todo
app.delete('/todos/:id', (req, res) => {
  // TODO: remove todo by id, respond with 204 No Content
});

const PORT = 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));

module.exports = app; // for testing`,
    },
    previewHtml: `<style>body{font-family:monospace;padding:12px;background:#1e1e1e;color:#d4d4d4;margin:0;font-size:12px}.route{padding:6px;margin-bottom:4px;border-radius:4px;display:flex;align-items:center;gap:8px}.badge{padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;width:40px;text-align:center}.get{background:#1a3a1a;color:#4ade80}.post{background:#1a2a3a;color:#60a5fa}.put{background:#2a2a1a;color:#facc15}.del{background:#3a1a1a;color:#f87171}</style><div><div class="route"><span class="badge get">GET</span><span>/todos</span><span style="color:#666;margin-left:auto">→ 200 []</span></div><div class="route"><span class="badge post">POST</span><span>/todos</span><span style="color:#666;margin-left:auto">→ 201 {}</span></div><div class="route"><span class="badge put">PUT</span><span>/todos/:id</span><span style="color:#666;margin-left:auto">→ 200 {}</span></div><div class="route"><span class="badge del">DEL</span><span>/todos/:id</span><span style="color:#666;margin-left:auto">→ 204</span></div></div>`,
  },
];

// ─── Difficulty badge ──────────────────────────────────────────────────────────
const DIFF_STYLE: Record<string, string> = {
  beginner:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  intermediate:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const CAT_EMOJI: Record<string, string> = {
  layout: "🔲",
  component: "🧩",
  form: "📋",
  api: "🔗",
  fullpage: "🌐",
  ui: "🎨",
};

// ─── Component ─────────────────────────────────────────────────────────────────
interface WebTemplateGalleryProps {
  language: string;
  selectedId: string | null;
  onSelect: (template: WebTemplate) => void;
}

export const WebTemplateGallery: React.FC<WebTemplateGalleryProps> = ({
  language,
  selectedId,
  onSelect,
}) => {
  const [hoveredPreview, setHoveredPreview] = useState<string | null>(null);

  const visible = WEB_TEMPLATES.filter((t) => t.languages.includes(language));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-gray-600">
        <Globe size={28} className="opacity-40" />
        <p className="text-sm">
          No templates for <strong>{language}</strong> yet.
        </p>
      </div>
    );
  }

  const selected = hoveredPreview ?? selectedId;
  const previewTemplate = visible.find((t) => t.id === selected);

  return (
    <div className="flex gap-4 h-[360px]">
      {/* Left: scrollable template list */}
      <div className="w-64 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            onMouseEnter={() => setHoveredPreview(t.id)}
            onMouseLeave={() => setHoveredPreview(null)}
            onClick={() => onSelect(t)}
            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
              selectedId === t.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-800"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{CAT_EMOJI[t.category]}</span>
              <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark px-1.5 py-0.5 rounded">
                {t.tag}
              </span>
              {selectedId === t.id && (
                <CheckCircle size={12} className="ml-auto text-blue-500" />
              )}
            </div>
            <p className="font-semibold text-xs text-text-primary-light dark:text-text-primary-dark">
              {t.title}
            </p>
            <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark/70 mt-0.5 leading-tight">
              {t.description}
            </p>
            <span
              className={`mt-1.5 inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${DIFF_STYLE[t.difficulty]}`}
            >
              {t.difficulty}
            </span>
          </button>
        ))}
      </div>

      {/* Right: live preview panel */}
      <div className="flex-1 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
        {previewTemplate ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-1 text-center">
                {previewTemplate.title}
              </span>
              <button
                type="button"
                onClick={() => onSelect(previewTemplate)}
                className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
              >
                Use this <ChevronRight size={10} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewTemplate.previewHtml ? (
                <iframe
                  srcDoc={previewTemplate.previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title="Template preview"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
                  <Eye size={16} className="mr-2" /> No preview available
                </div>
              )}
            </div>
            {selectedId === previewTemplate.id && (
              <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5">
                <CheckCircle size={11} /> Template applied
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2">
            <Eye size={28} className="opacity-30" />
            <p className="text-sm">Hover a template to preview</p>
          </div>
        )}
      </div>
    </div>
  );
};
