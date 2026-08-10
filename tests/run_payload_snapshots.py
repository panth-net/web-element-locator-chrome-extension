#!/usr/bin/env python3
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_URL = (ROOT / "content.js").resolve().as_uri()
CHROME = os.environ.get("CHROME_BIN", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

DEFAULT_FIELDS = "{ page: true, target: true, owner: true, selector: false, html: false, position: false }"
TARGET_ONLY_FIELDS = "{ page: false, target: true, owner: false, selector: false, html: false, position: false }"
TARGET_OWNER_FIELDS = "{ page: false, target: true, owner: true, selector: false, html: false, position: false }"
SELECTOR_FIELDS = "{ page: false, target: true, owner: false, selector: true, html: false, position: false }"
FULL_FIELDS = "{ page: true, target: true, owner: true, selector: true, html: true, position: true }"


SCENARIOS = [
    {
        "name": "default_sidebar",
        "url_suffix": "?token=secret&email=person@example.com#dashboard",
        "fields": DEFAULT_FIELDS,
        "target": "#projectsButton-12345678",
        "body": """
          <aside data-testid="left-sidebar" class="left-sidebar w-64 border-r">
            <nav aria-label="Primary">
              <button id="projectsButton-12345678" aria-label="Projects" class="flex items-center gap-2 px-4 py-2 rounded-md text-sm nav-item">
                Projects
              </button>
              <div class="sidebar-noise">""" + " ".join(f"<span>Item {i}</span>" for i in range(80)) + """</div>
            </nav>
          </aside>
        """,
        "snapshot": """page: /tmp/web-element-locator-default_sidebar.html#dashboard
target: button[aria-label="Projects"].nav-item text="Projects"
owner: aside[data-testid="left-sidebar"].left-sidebar""",
        "max_tokens": 150,
    },
    {
        "name": "target_only",
        "fields": TARGET_ONLY_FIELDS,
        "target": "#projectsButton-12345678",
        "body": """
          <aside data-testid="left-sidebar" class="left-sidebar w-64 border-r">
            <button id="projectsButton-12345678" aria-label="Projects" class="flex items-center gap-2 px-4 py-2 rounded-md text-sm nav-item">
              Projects
            </button>
          </aside>
        """,
        "snapshot": 'target: button[aria-label="Projects"].nav-item text="Projects"',
        "max_tokens": 60,
    },
    {
        "name": "password_privacy",
        "url_suffix": "?password=supersecret#login",
        "fields": DEFAULT_FIELDS,
        "target": "#passwordInput",
        "body": """
          <section data-component="LoginForm" class="login-panel">
            <form class="login-form">
              <input id="passwordInput" type="password" name="password" placeholder="Password" value="supersecret-token">
            </form>
          </section>
        """,
        "snapshot": """page: /tmp/web-element-locator-password_privacy.html#login
target: input#passwordInput[type="password"][name="password"][placeholder="Password"]
owner: section[data-component="LoginForm"].login-panel""",
        "forbidden": ["supersecret", "value=", "?password"],
    },
    {
        "name": "textarea_privacy",
        "fields": DEFAULT_FIELDS,
        "target": "#notes",
        "body": """
          <section data-component="NotesPanel" class="notes-panel">
            <textarea id="notes" name="notes" placeholder="Private notes">do not copy this private note</textarea>
          </section>
        """,
        "snapshot": """page: /tmp/web-element-locator-textarea_privacy.html
target: textarea#notes[name="notes"][placeholder="Private notes"]
owner: section[data-component="NotesPanel"].notes-panel""",
        "forbidden": ["do not copy", "private note", "value="],
    },
    {
        "name": "full_capped",
        "fields": FULL_FIELDS,
        "target": "#wideButton",
        "body": """
          <aside data-testid="left-sidebar" class="left-sidebar">
            <button
              id="wideButton"
              aria-label="Open project settings"
              class="nav-item flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-blue-500 hover:bg-blue-600 border border-slate-200 shadow-sm transition focus-visible:ring-2 project-settings-action very-long-class-name-one very-long-class-name-two very-long-class-name-three very-long-class-name-four very-long-class-name-five very-long-class-name-six"
            >Settings</button>
          </aside>
        """,
        "contains": [
            "selector: [data-testid=\"left-sidebar\"] button#wideButton",
            "html: <button id=\"wideButton\" aria-label=\"Open project settings\" class=\"nav-item flex items-center gap-2 px-4 py-2 rounded-md text-sm\">Settings</button>",
            "position: x=",
        ],
        "html_max": 300,
    },
    {
        "name": "route_href_query_stripped",
        "fields": TARGET_ONLY_FIELDS,
        "target": "#routeLink-12345678",
        "body": """
          <a id="routeLink-12345678" href="/projects?token=secret#overview" class="nav-link">Projects</a>
        """,
        "snapshot": 'target: a[href="/projects#overview"].nav-link text="Projects"',
        "forbidden": ["token=secret", "?token"],
    },
    {
        "name": "mailto_privacy_full",
        "fields": FULL_FIELDS,
        "target": "#emailLink",
        "body": """
          <a id="emailLink" href="mailto:person@example.com" class="contact-link">Email us</a>
        """,
        "contains": [
            "target: a#emailLink.contact-link text=\"Email us\"",
            "selector: main#fixture a#emailLink",
            "html: <a id=\"emailLink\" class=\"contact-link\">Email us</a>",
            "position: x=",
        ],
        "forbidden": ["person@example.com", "href="],
        "html_max": 300,
    },
    {
        "name": "tel_privacy",
        "fields": TARGET_ONLY_FIELDS,
        "target": "#phoneLink",
        "body": """
          <a id="phoneLink" href="tel:+15555551212" class="contact-link">Call us</a>
        """,
        "snapshot": 'target: a#phoneLink.contact-link text="Call us"',
        "forbidden": ["15555551212", "href="],
    },
    {
        "name": "script_href_privacy",
        "fields": TARGET_ONLY_FIELDS,
        "target": "#scriptLink",
        "body": """
          <a id="scriptLink" href="JavaScript:secretToken()" class="action-link">Run</a>
        """,
        "snapshot": 'target: a#scriptLink.action-link text="Run"',
        "forbidden": ["secretToken", "href="],
    },
    {
        "name": "data_href_privacy",
        "fields": TARGET_ONLY_FIELDS,
        "target": "#dataLink",
        "body": """
          <a id="dataLink" href=" data:text/plain,secret" class="data-link">Data</a>
        """,
        "snapshot": 'target: a#dataLink.data-link text="Data"',
        "forbidden": ["data:text", "secret", "href="],
    },
    {
        "name": "wrapper_textarea_privacy",
        "fields": TARGET_OWNER_FIELDS,
        "target": "#labelWrap",
        "body": """
          <section data-component="FormPanel" class="form-panel">
            <label id="labelWrap" class="field-label">Note <textarea name="note">short secret</textarea></label>
          </section>
        """,
        "snapshot": """target: label#labelWrap.field-label text="Note"
owner: section[data-component="FormPanel"].form-panel""",
        "forbidden": ["short secret"],
    },
    {
        "name": "wrapper_contenteditable_privacy",
        "fields": TARGET_OWNER_FIELDS,
        "target": "#editorWrap",
        "body": """
          <section data-component="EditorPanel" class="editor-panel">
            <div id="editorWrap" class="editor-card" style="display:block; min-height:48px; padding:16px;"><span contenteditable="true">short draft</span></div>
          </section>
        """,
        "snapshot": """target: div#editorWrap.editor-card
owner: section[data-component="EditorPanel"].editor-panel""",
        "forbidden": ["short draft"],
    },
    {
        "name": "generic_section_no_owner",
        "fields": TARGET_OWNER_FIELDS,
        "target": "#saveButton",
        "body": """
          <section><button id="saveButton">Save</button></section>
        """,
        "contains": ['target: button#saveButton text="Save"'],
        "forbidden": ["owner: section"],
    },
    {
        "name": "bare_selector_omitted",
        "fields": SELECTOR_FIELDS,
        "target": "#fixture span",
        "body": """
          <div><span>Plain</span></div>
        """,
        "snapshot": 'target: span text="Plain"',
    },
    {
        "name": "utility_classes_filtered",
        "fields": TARGET_ONLY_FIELDS,
        "target": "#utilButton",
        "body": """
          <button id="utilButton" class="flex items-start justify-center content-center">Save</button>
        """,
        "snapshot": 'target: button#utilButton text="Save"',
        "forbidden": ["items-start", "content-center", "justify-center"],
    },
    {
        "name": "fallback_copy",
        "fields": TARGET_ONLY_FIELDS,
        "target": "#fallbackButton",
        "fallback": True,
        "body": """
          <button id="fallbackButton" aria-label="Fallback copy" class="copy-button">Copy</button>
        """,
        "snapshot": 'target: button#fallbackButton[aria-label="Fallback copy"].copy-button text="Copy"',
    },
]


def main():
    if not Path(CHROME).exists():
        raise SystemExit(f"Chrome not found at {CHROME}. Set CHROME_BIN to run these tests.")

    for scenario in SCENARIOS:
        result = run_scenario(scenario)
        assert_result(scenario, result)
        print(f"ok {scenario['name']}")

    print(f"{len(SCENARIOS)} payload snapshot tests passed")


def run_scenario(scenario):
    path = Path(f"/tmp/web-element-locator-{scenario['name']}.html")
    path.write_text(render_harness(scenario), encoding="utf-8")
    url = path.as_uri() + scenario.get("url_suffix", "")
    with tempfile.TemporaryDirectory(prefix=f"web-element-locator-{scenario['name']}-") as user_data_dir:
        cmd = [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--allow-file-access-from-files",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-crash-reporter",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--no-default-browser-check",
            "--no-first-run",
            f"--user-data-dir={user_data_dir}",
            "--virtual-time-budget=2500",
            "--dump-dom",
            url,
        ]
        completed = run_chrome_dump(cmd)
    output = completed.stdout + completed.stderr

    if completed.returncode != 0:
        raise AssertionError(output)

    copied = extract_tag(output, "copied")
    status = json.loads(extract_tag(output, "status"))
    return {"copied": copied, "status": status, "raw": output}


def run_chrome_dump(cmd):
    process = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    try:
        stdout, stderr = process.communicate(timeout=12)
        return subprocess.CompletedProcess(cmd, process.returncode, stdout, stderr)
    except subprocess.TimeoutExpired:
        process.kill()
        stdout, stderr = process.communicate()
        output = (stdout or "") + (stderr or "")

        if '<pre id="copied">' in output and '<pre id="status">' in output:
            return subprocess.CompletedProcess(cmd, 0, stdout, stderr)

        return subprocess.CompletedProcess(cmd, process.returncode, stdout, stderr)


def render_harness(scenario):
    clipboard_setup = """
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText(text) {
            window.__copied = text;
            document.getElementById('copied').textContent = text;
            return Promise.resolve();
          }
        }
      });
    """

    if scenario.get("fallback"):
        clipboard_setup = """
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText() {
                return Promise.reject(new Error('force fallback'));
              }
            }
          });
          document.execCommand = () => {
            window.__copied = document.activeElement.value;
            document.getElementById('copied').textContent = window.__copied;
            return true;
          };
        """

    return f"""<!doctype html>
<html>
  <head>
    <style>
      body {{ margin: 0; font-family: sans-serif; }}
      aside, section {{ display: block; width: 320px; min-height: 240px; padding: 20px; }}
      button {{ width: 220px; height: 42px; }}
      input, textarea {{ width: 220px; height: 36px; }}
      textarea {{ height: 80px; }}
    </style>
  </head>
  <body>
    <main id="fixture">
      {scenario["body"]}
    </main>
    <pre id="copied"></pre>
    <pre id="status"></pre>
    <script>
      window.__pageClick = false;
      document.body.addEventListener('click', () => {{ window.__pageClick = true; }});
      window.chrome = {{ runtime: {{ onMessage: {{ addListener(fn) {{ window.__aiLocatorListener = fn; }} }} }} }};
      {clipboard_setup}
      window.onerror = (message, source, line, column) => {{
        document.getElementById('status').textContent = JSON.stringify({{
          error: `${{message}} @ ${{line}}:${{column}}`
        }});
      }};
    </script>
    <script src="{CONTENT_URL}"></script>
    <script>
      async function runScenario() {{
        const target = document.querySelector('{scenario["target"]}');
        const rect = target.getBoundingClientRect();
        const x = rect.left + Math.max(4, Math.min(12, rect.width / 2));
        const y = rect.top + Math.max(4, Math.min(12, rect.height / 2));

        window.__aiLocatorListener({{
          type: 'AI_LOCATOR_START',
          fields: {scenario["fields"]}
        }});

        target.dispatchEvent(new MouseEvent('mousemove', {{ bubbles: true, clientX: x, clientY: y }}));
        target.dispatchEvent(new PointerEvent('pointerup', {{ bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }}));
        target.dispatchEvent(new MouseEvent('click', {{ bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }}));

        await new Promise((resolve) => setTimeout(resolve, 25));
        const root = document.getElementById('web-element-locator-root');
        const banner = root?.shadowRoot?.querySelector('.banner')?.textContent || '';
        const inspectorActive = document.documentElement.classList.contains('web-element-locator-active');
        const outlineDisplay = root?.shadowRoot?.querySelector('.outline')?.style.display || '';
        await new Promise((resolve) => setTimeout(resolve, 1900));

        document.getElementById('status').textContent = JSON.stringify({{
          pageClick: window.__pageClick,
          banner,
          inspectorActive,
          outlineDisplay,
          rootGone: !document.getElementById('web-element-locator-root')
        }});
      }}

      runScenario();
    </script>
  </body>
</html>"""


def extract_tag(output, tag_id):
    match = re.search(rf'<pre id="{tag_id}">(.*?)</pre>', output, re.S)
    if not match:
        raise AssertionError(f"Missing #{tag_id} in Chrome output:\n{output}")

    return html.unescape(match.group(1)).strip()


def assert_result(scenario, result):
    copied = result["copied"]
    status = result["status"]

    if status.get("error"):
        raise AssertionError(status["error"])

    if scenario.get("snapshot") is not None and copied != scenario["snapshot"]:
        raise AssertionError(
            f"{scenario['name']} snapshot mismatch\nExpected:\n{scenario['snapshot']}\nActual:\n{copied}"
        )

    for needle in scenario.get("contains", []):
        if needle not in copied:
            raise AssertionError(f"{scenario['name']} missing expected text: {needle}\n{copied}")

    for needle in scenario.get("forbidden", []):
        if needle in copied:
            raise AssertionError(f"{scenario['name']} leaked forbidden text: {needle}\n{copied}")

    if "search_terms" in copied or "instruction_to_ai" in copied:
        raise AssertionError(f"{scenario['name']} contains removed payload fields:\n{copied}")

    if "ancestor" in copied.lower():
        raise AssertionError(f"{scenario['name']} contains ancestor chain text:\n{copied}")

    if "position:" in copied and scenario["fields"] != FULL_FIELDS:
        raise AssertionError(f"{scenario['name']} included position by default:\n{copied}")

    if "html:" in copied and scenario["fields"] != FULL_FIELDS:
        raise AssertionError(f"{scenario['name']} included html by default:\n{copied}")

    if scenario.get("max_tokens") and token_count(copied) > scenario["max_tokens"]:
        raise AssertionError(f"{scenario['name']} exceeded token budget:\n{token_count(copied)}\n{copied}")

    if scenario.get("html_max"):
        html_line = next((line for line in copied.splitlines() if line.startswith("html: ")), "")
        html_value = html_line.removeprefix("html: ")
        if len(html_value) > scenario["html_max"]:
            raise AssertionError(f"{scenario['name']} html exceeded cap: {len(html_value)}")

    if status.get("pageClick") is not False:
        raise AssertionError(f"{scenario['name']} did not suppress page click: {status}")

    if status.get("banner") != "Copied to clipboard.":
        raise AssertionError(f"{scenario['name']} did not show copied state: {status}")

    if status.get("inspectorActive") is not False:
        raise AssertionError(f"{scenario['name']} kept inspector active after copy: {status}")

    if status.get("outlineDisplay") != "none":
        raise AssertionError(f"{scenario['name']} kept hover outline visible after copy: {status}")

    if status.get("rootGone") is not True:
        raise AssertionError(f"{scenario['name']} inspector did not exit after copy: {status}")


def token_count(text):
    return len(re.findall(r"\S+", text))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
