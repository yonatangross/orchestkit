# Scenario 4: Open Source CLI Tool

**Prompt:** "Build a plugin system for a CLI tool"
**Users:** Other developers
**Goal:** Extensibility without complexity

---

## Right-Sized Architecture: Extension Points, Not Plugin Framework

The most common mistake in plugin system design is building a full plugin framework when extension points suffice. A plugin framework implies: discovery, registration, lifecycle management, dependency resolution, versioning, sandboxing. Extension points imply: a function signature and a config file.

### The Spectrum of Extensibility

```
Simple ──────────────────────────────────────────────── Complex

JSON Config    Hook Functions    Plugin Interface    Plugin Registry
  "key": val    on_before()       class Plugin:       + Discovery
                on_after()          def run():        + Versioning
                                                      + Dependencies
                                                      + Sandboxing

LOC: 0         LOC: 50-100      LOC: 200-500       LOC: 2,000-5,000
```

**Start at the left. Move right only when users ask.**

## Decision Matrix: Config vs Hooks vs Plugins

| Question | JSON Config | Hook Functions | Plugin Interface | Plugin Registry |
|----------|-------------|---------------|-----------------|-----------------|
| Can users add new behavior? | No | Limited | Yes | Yes |
| Can users add new commands? | No | No | Yes | Yes |
| Is third-party code isolated? | N/A | No | No | Maybe |
| Discovery needed? | No | No | No | Yes |
| Dependency management? | No | No | No | Yes |
| **When to use** | Behavior toggles | Lifecycle events | New capabilities | Ecosystem |

### Level 1: JSON Config (0 LOC for plugin system)

When all you need is user-configurable behavior:

```json
{
  "output_format": "json",
  "max_retries": 3,
  "ignore_patterns": ["*.tmp", "node_modules/"],
  "custom_headers": {
    "X-Custom": "value"
  }
}
```

This is not a plugin system. But it solves 60% of "extensibility" requests. Before building plugins, ask: "Would a config option solve this?"

**LOC: 0** for the plugin system. ~50 LOC for config loading.

### Level 2: Hook Functions (~100 LOC)

When users need to run code at specific lifecycle points:

```python
# hooks.py - The entire "plugin system"
import importlib.util
from pathlib import Path
from typing import Callable, Any

# Hook registry
_hooks: dict[str, list[Callable]] = {
    "before_run": [],
    "after_run": [],
    "on_error": [],
    "transform_output": [],
}

def register_hook(event: str, fn: Callable) -> None:
    if event not in _hooks:
        raise ValueError(f"Unknown hook: {event}. Available: {list(_hooks.keys())}")
    _hooks[event].append(fn)

def run_hooks(event: str, **kwargs) -> Any:
    result = kwargs.get("data")
    for fn in _hooks[event]:
        output = fn(**kwargs)
        if event == "transform_output" and output is not None:
            result = output
    return result

def load_hooks_from_file(path: Path) -> None:
    """Load user hooks from a Python file."""
    if not path.exists():
        return
    spec = importlib.util.spec_from_file_location("user_hooks", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    # Auto-register functions named hook_*
    for name in dir(module):
        if name.startswith("hook_"):
            event = name[5:]  # hook_before_run -> before_run
            if event in _hooks:
                register_hook(event, getattr(module, name))
```

User creates `~/.mytool/hooks.py`:

```python
def hook_before_run(command, args, **kwargs):
    print(f"Running: {command}")

def hook_transform_output(data, **kwargs):
    # Add timestamp to all output
    data["processed_at"] = datetime.now().isoformat()
    return data

def hook_on_error(error, **kwargs):
    # Send error to custom logging service
    requests.post("https://my-log.example.com", json={"error": str(error)})
```

**LOC: ~100** for the hook system. Users extend without touching your code.

This is what OrchestKit uses. The `hooks.json` + TypeScript handlers pattern is a mature version of this approach.

### Level 3: Plugin Interface (~300 LOC)

When users need to add new commands or capabilities:

```python
# plugin.py - Plugin interface
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

@dataclass
class PluginMetadata:
    name: str
    version: str
    description: str

class Plugin(ABC):
    """Base class for plugins. Implement this to extend the CLI."""

    @abstractmethod
    def metadata(self) -> PluginMetadata:
        """Return plugin metadata."""
        ...

    def commands(self) -> dict[str, Callable]:
        """Return dict of command_name -> handler. Optional."""
        return {}

    def hooks(self) -> dict[str, Callable]:
        """Return dict of hook_name -> handler. Optional."""
        return {}

    def activate(self) -> None:
        """Called when plugin is loaded. Optional setup."""
        pass

    def deactivate(self) -> None:
        """Called when plugin is unloaded. Optional cleanup."""
        pass
```

Plugin loader:

```python
# loader.py
import importlib
import pkgutil
from pathlib import Path

class PluginLoader:
    def __init__(self, plugin_dir: Path):
        self.plugin_dir = plugin_dir
        self._plugins: dict[str, Plugin] = {}

    def discover(self) -> list[Plugin]:
        """Find and load all plugins in plugin directory."""
        if not self.plugin_dir.exists():
            return []

        plugins = []
        for finder, name, _ in pkgutil.iter_modules([str(self.plugin_dir)]):
            try:
                module = importlib.import_module(f"plugins.{name}")
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (isinstance(attr, type)
                        and issubclass(attr, Plugin)
                        and attr is not Plugin):
                        plugin = attr()
                        plugin.activate()
                        self._plugins[plugin.metadata().name] = plugin
                        plugins.append(plugin)
            except Exception as e:
                print(f"Failed to load plugin {name}: {e}")

        return plugins

    def get_commands(self) -> dict[str, Callable]:
        """Collect all commands from all plugins."""
        commands = {}
        for plugin in self._plugins.values():
            for cmd_name, handler in plugin.commands().items():
                if cmd_name in commands:
                    print(f"Warning: Command '{cmd_name}' already registered")
                    continue
                commands[cmd_name] = handler
        return commands
```

User creates `~/.mytool/plugins/my_plugin.py`:

```python
from mytool.plugin import Plugin, PluginMetadata

class MyPlugin(Plugin):
    def metadata(self):
        return PluginMetadata(
            name="my-plugin",
            version="1.0.0",
            description="Adds custom analysis command",
        )

    def commands(self):
        return {"analyze": self.run_analysis}

    def run_analysis(self, args):
        print(f"Analyzing: {args}")
```

**LOC: ~300** for interface + loader + discovery. No dependency management. No versioning beyond metadata.

### Level 4: Plugin Registry (2,000-5,000 LOC)

**You almost certainly do not need this.** This is for tools with an ecosystem (VS Code, Terraform, Grafana).

A full plugin registry adds:
- Package manager integration (`mytool install plugin-name`)
- Version resolution and compatibility matrix
- Plugin marketplace/index
- Sandboxing and permission model
- Dependency resolution between plugins
- Hot-reload without restart
- Plugin update notifications

**Build this when:** You have 50+ community plugins and users expect `npm install`-like experience.

## Over-Engineering Traps

### Trap 1: Plugin Registry for 3 Plugins (+2,000 LOC)

```
What you build:
  plugin_registry/
    registry.py           # Plugin index + search
    installer.py          # Download + install
    resolver.py           # Dependency resolution
    sandbox.py            # Permission isolation
    updater.py            # Version checking
    marketplace_api.py    # Remote plugin index

What you actually need:
  "Put your Python file in ~/.mytool/plugins/"
```

**LOC impact:** 2,000 lines of infrastructure for 3 plugins.
**Better approach:** Directory-based discovery (Level 3) until you have 20+ plugins.

### Trap 2: Full Dependency Resolution (+500 LOC)

```
What you build:
  class DependencyResolver:
      def resolve(self, plugin, graph):
          # Topological sort, cycle detection,
          # version compatibility matrix...

What actually happens:
  Plugin A depends on Plugin B.
  You have 3 plugins.
  "Install B before A" in the README covers it.
```

### Trap 3: Sandboxing Before Trust Model (+800 LOC)

```
What you build:
  class PluginSandbox:
      def __init__(self):
          self.allowed_imports = [...]
          self.allowed_operations = [...]
      def execute(self, plugin, context):
          # RestrictedPython, subprocess isolation...

Reality:
  Your CLI runs on the user's machine.
  They installed the plugin voluntarily.
  If they wanted to run malicious code, they'd just... run it.
```

Sandboxing matters for: browser extensions, server-side plugin execution, multi-tenant systems. It does NOT matter for a CLI tool where the user installs plugins on their own machine.

### Trap 4: Backward Compatibility Guarantees Day One (+300 LOC)

```
What you build:
  class PluginV1Adapter:
      """Adapts v1 plugins to v2 interface."""
      ...
  class PluginV2Adapter:
      """Adapts v2 plugins to v3 interface."""
      ...

What you should do:
  CHANGELOG.md:
    ## v2.0 (Breaking)
    - Plugin interface changed: `run()` renamed to `execute()`
    - Update your plugins.
```

You have 3 plugins and 50 users. A breaking change with a changelog entry is fine. Adapter layers are for ecosystems with 500+ plugins where you cannot break everyone.

## Right-Sized vs Over-Engineered Comparison

| Aspect | Right-Sized (Level 2-3) | Over-Engineered (Level 4) |
|--------|------------------------|---------------------------|
| **LOC** | 100-300 | 2,000-5,000 |
| **User experience** | "Drop a .py file here" | `mytool install plugin-name` |
| **Maintenance** | Minimal | Plugin compatibility matrix |
| **Time to build** | 1-2 days | 2-4 weeks |
| **Appropriate when** | < 20 plugins, trusted users | 50+ plugins, ecosystem |
| **Example** | OrchestKit hooks, pytest plugins | VS Code extensions, Terraform providers |

## Progression Path

```
v1.0: JSON config only
  |
  | User asks: "Can I run custom code before each command?"
  v
v1.1: Add hook functions (Level 2)
  |
  | User asks: "Can I add new commands?"
  v
v2.0: Add plugin interface (Level 3)
  |
  | 30+ community plugins, users want `tool install`
  v
v3.0: Add plugin registry (Level 4)
```

Each level is additive. You never throw away the previous level. Hooks still work when you add plugins. Config still works when you add hooks.

## Real-World Examples

| Tool | Plugin System | Level | Why |
|------|--------------|-------|-----|
| **pytest** | `conftest.py` + entry points | 3 | Fixture and hook system, no registry |
| **pre-commit** | `.pre-commit-config.yaml` | 1-2 | Config points to git repos |
| **ESLint** | npm packages + config | 3-4 | npm IS the registry |
| **VS Code** | Full marketplace | 4 | 50,000+ extensions, sandboxed |
| **Terraform** | Provider registry | 4 | Hundreds of providers, versioned |
| **OrchestKit** | `hooks.json` + TypeScript | 2-3 | Hook-based with plugin manifests |
| **Claude Code** | `.claude-plugin/plugin.json` | 2-3 | Manifest + skills + hooks |

Notice: pytest, one of the most extensible Python tools, uses Level 3. No registry, no sandboxing, no dependency resolution between plugins. It has been sufficient for 15 years and thousands of plugins.
