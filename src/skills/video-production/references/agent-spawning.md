# Agent Spawning Animation

## Visualization Concept

```
        ┌─────────┐
        │ Agent 1 │◄──┐
        └─────────┘   │
                      │
┌─────────────┐   ┌───┴───┐   ┌─────────┐
│ Orchestrator│───│ Task  │───│ Agent 2 │
└─────────────┘   │ Tool  │   └─────────┘
                  └───┬───┘
                      │
        ┌─────────┐   │
        │ Agent 3 │◄──┘
        └─────────┘
```

## Animation Sequence

```python
class AgentSpawning(Scene):
    def construct(self):
        # 1. Show orchestrator
        orch = self.create_orchestrator()
        self.play(FadeIn(orch))

        # 2. Task tool appears
        task = self.create_task_tool()
        task.next_to(orch, RIGHT, buff=1)
        arrow = Arrow(orch.get_right(), task.get_left())
        self.play(Create(arrow), FadeIn(task))

        # 3. Agents spawn outward
        agents = self.create_agents(3)
        for i, agent in enumerate(agents):
            angle = (i - 1) * PI / 4  # Spread upward
            agent.move_to(task.get_right() + RIGHT * 2 + UP * np.sin(angle) * 1.5)

        spawn_arrows = [Arrow(task.get_right(), a.get_left()) for a in agents]
        self.play(
            *[Create(a) for a in spawn_arrows],
            *[FadeIn(a) for a in agents],
            run_time=1.5
        )

        # 4. Agents process (spinner)
        self.play_spinners(agents)

        # 5. Results return
        self.play_completion(agents, task)
```

## Agent Box Design

```python
def create_agent(self, name: str, color: str) -> VGroup:
    box = RoundedRectangle(
        width=2.5, height=1,
        corner_radius=0.15,
        fill_color=color,
        fill_opacity=0.2,
        stroke_color=color
    )

    icon = Text("🤖", font_size=24)
    icon.move_to(box.get_left() + RIGHT * 0.4)

    label = Text(name, font_size=14, color=WHITE)
    label.move_to(box.get_center() + RIGHT * 0.3)

    return VGroup(box, icon, label)
```

## Spinner Animation

```python
def play_spinners(self, agents: list):
    spinners = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

    for _ in range(10):
        for spinner in spinners:
            texts = [Text(spinner, color=CYAN) for _ in agents]
            for text, agent in zip(texts, agents):
                text.next_to(agent, LEFT, buff=0.2)
            self.add(*texts)
            self.wait(0.1)
            self.remove(*texts)
```

## Completion Animation

```python
def play_completion(self, agents: list, task: VGroup):
    checkmarks = []
    for agent in agents:
        check = Text("✓", color=GREEN, font_size=24)
        check.next_to(agent, LEFT, buff=0.2)
        checkmarks.append(check)

    self.play(*[Write(c) for c in checkmarks])

    # Results flow back
    return_arrows = [
        Arrow(a.get_left(), task.get_right(), color=GREEN)
        for a in agents
    ]
    self.play(*[Create(a) for a in return_arrows])
```
