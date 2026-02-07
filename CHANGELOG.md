# Changelog

All notable changes to the OrchestKit Claude Code Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-02-07)


### ⚠ BREAKING CHANGES

* **playgrounds:** Reorganized from 26 granular plugins to 2-tier system
* **readme:** ork-memory plugin replaced by 3 separate plugins:
    - ork-memory-graph (Tier 1): zero-config graph memory (remember, recall, load-context)
    - ork-memory-mem0 (Tier 2): opt-in cloud memory requiring MEM0_API_KEY (mem0-memory, mem0-sync)
    - ork-memory-fabric (Tier 3): orchestration layer (memory-fabric)
* **#228:** Plugin development workflow has changed
* Marketplace no longer auto-installs ork plugin when added.
* **skills:** Skills moved from category-based to flat structure
* **structure:** Skill paths changed from nested to flat-category structure
* **hooks:** Plugin directory structure changed

### Features

* **#209:** Remotion setup and video production skills ([#234](https://github.com/yonatangross/orchestkit/issues/234)) ([a7a854a](https://github.com/yonatangross/orchestkit/commit/a7a854af1f8c6767e8411f4a2fe3a2e4498d9aff))
* **#212:** CC 2.1.19 full modernization ([#220](https://github.com/yonatangross/orchestkit/issues/220)) ([9c76b8b](https://github.com/yonatangross/orchestkit/commit/9c76b8bdc2c6207c20408f96ff25c93f4f2629c3))
* **#212:** CC 2.1.19 Skills Enhancement + Tests Update (v5.2.0) ([#223](https://github.com/yonatangross/orchestkit/issues/223)) ([7539cf9](https://github.com/yonatangross/orchestkit/commit/7539cf90a67fa5f2cd50630085ca3e48e2efd6f5))
* **#231:** Auto-generate commands/ from user-invocable skills ([#232](https://github.com/yonatangross/orchestkit/issues/232)) ([13d062b](https://github.com/yonatangross/orchestkit/commit/13d062b25ac8631714d5d2e1b8d9c99b2e30f154))
* **#235:** Unified hook dispatchers - 84% async reduction ([#236](https://github.com/yonatangross/orchestkit/issues/236)) ([852f277](https://github.com/yonatangross/orchestkit/commit/852f277e3dd1fb46ae08138209c960d4f56930f3))
* **#239:** Add Setup unified dispatcher for initialization hooks ([#240](https://github.com/yonatangross/orchestkit/issues/240)) ([d45e9d2](https://github.com/yonatangross/orchestkit/commit/d45e9d2ad8294cedec4dc5c25d8735b758e44d17))
* Add /skillforge:configure command and bundle system ([97250ad](https://github.com/yonatangross/orchestkit/commit/97250ad2bcb27697bdfe1aeb7692f9fa2772ebd4))
* Add 5 new skills and update .claude directory ([cf6ff11](https://github.com/yonatangross/orchestkit/commit/cf6ff11d95270c500c7a9ad17afcd448cf48ce89))
* Add 5 new skills and update .claude directory ([ae48573](https://github.com/yonatangross/orchestkit/commit/ae485739d78662849ae76cd426591aaa3ffa2cdc))
* Add 6 new retrieval/AI skills and enhance existing skills ([8284744](https://github.com/yonatangross/orchestkit/commit/82847446bec79ac6d2225289c7919ee26eb76ae8))
* Add 6 product thinking agents and pipeline workflow ([5a99396](https://github.com/yonatangross/orchestkit/commit/5a993967f859f54605643cebb08456d34572db59))
* Add 6 product thinking agents and pipeline workflow ([5c325b3](https://github.com/yonatangross/orchestkit/commit/5c325b36221d57eecf3097c645fcd7772b3ae5fd))
* Add 7 backend skills with complete subdirectories (v4.4.1) ([48d606e](https://github.com/yonatangross/orchestkit/commit/48d606e5e08a6dfa13930863b83c7541a626db25))
* Add accessibility, event-driven, and database skills with new agents ([bb45439](https://github.com/yonatangross/orchestkit/commit/bb454391f0805406f121d52adf93968855bf8dd7))
* Add agent lifecycle hooks for multi-Claude coordination ([eab2465](https://github.com/yonatangross/orchestkit/commit/eab2465b1db5544c2cff974026891a1dbb8cf9a7))
* Add CC 2.1.11 Setup hooks and fix Bash 3.2 compatibility ([22de133](https://github.com/yonatangross/orchestkit/commit/22de133c4a3a6e0599f9424bdbfe84d438a23a35))
* Add CC 2.1.2 support and 138 new hook tests ([3e3cbb5](https://github.com/yonatangross/orchestkit/commit/3e3cbb5c8ccc4dbf216065e5a1091af1784540bc))
* Add colored ANSI output to all hook dispatchers ([a8d2cdc](https://github.com/yonatangross/orchestkit/commit/a8d2cdc747e636bfe7e790e54bc4f4c9461608c6))
* Add comprehensive CI/CD and cleanup AI slop (v4.6.1) ([6d72011](https://github.com/yonatangross/orchestkit/commit/6d720115368e8c70bf07bf66c16679145870df94))
* Add comprehensive security testing framework (v4.5.1) ([3d3e41a](https://github.com/yonatangross/orchestkit/commit/3d3e41abce06607e426829c7fc3f28206c6ad083))
* Add comprehensive skill, MCP, task hook tests ([9446fe5](https://github.com/yonatangross/orchestkit/commit/9446fe503b21d76714a37ebcdbca24a0be45fdc8))
* Add dispatchers for consolidated hook output ([7cf8747](https://github.com/yonatangross/orchestkit/commit/7cf874741b938cf96f96393daa8d679de1ab1af6))
* Add git/GitHub workflow skills and enforcement hooks ([d7f6378](https://github.com/yonatangross/orchestkit/commit/d7f6378ca9aefbbeadc56cb6629acadc9f9da931))
* Add git/GitHub workflow skills and enforcement hooks ([eaa9fef](https://github.com/yonatangross/orchestkit/commit/eaa9fefe60e649b818a436a4ec3f9891106ea9f2))
* Add marketplace plugin registry (v4.4.0) ([4fc3ed8](https://github.com/yonatangross/orchestkit/commit/4fc3ed8fce8c25c003f3a69d40fd67fcfff802f5))
* Add marketplace plugin registry for installable bundles ([33bfd83](https://github.com/yonatangross/orchestkit/commit/33bfd83d20fded90012cb792c3302e3aaef7c6c4))
* Add Motion animations and i18n date patterns (v4.4.0) ([2bd6f89](https://github.com/yonatangross/orchestkit/commit/2bd6f8939586de71a768a1f0b144d00edbf3fe18))
* Add Motion animations and i18n date patterns (v4.4.0) ([6435972](https://github.com/yonatangross/orchestkit/commit/64359721ebd53404369527132e1e60b649c5d571))
* Add multi-worktree coordination system (v4.6.0) ([8176619](https://github.com/yonatangross/orchestkit/commit/8176619d1968932397cc40f97926f222106c4e1d))
* Add testing framework improvements for 9/10 quality score ([9204380](https://github.com/yonatangross/orchestkit/commit/9204380c74485638a1b98aa2356fd9c6c11003b4))
* **agent-browser:** Sync skill to upstream v0.7.0 ([#211](https://github.com/yonatangross/orchestkit/issues/211)) ([db51a5c](https://github.com/yonatangross/orchestkit/commit/db51a5cbe6f799ae6c07827efd09f77f952f00dc)), closes [#210](https://github.com/yonatangross/orchestkit/issues/210)
* **ai-ml:** AI/ML Roadmap 2026 - 21 skills, 6 agents, comprehensive integration ([#171](https://github.com/yonatangross/orchestkit/issues/171)) ([3f1402e](https://github.com/yonatangross/orchestkit/commit/3f1402ef1d93c7ea186bbdc4d4c0c5d148cf0a15))
* **analytics:** implement optional anonymous analytics ([#59](https://github.com/yonatangross/orchestkit/issues/59)) ([f12904f](https://github.com/yonatangross/orchestkit/commit/f12904f153e435c3af6a69b181fb999c768477f8))
* **browser:** Replace Playwright MCP with agent-browser CLI ([#175](https://github.com/yonatangross/orchestkit/issues/175)) ([#176](https://github.com/yonatangross/orchestkit/issues/176)) ([9bafb6e](https://github.com/yonatangross/orchestkit/commit/9bafb6ead546e3648c2576a4083de789ac7e502d))
* CC 2.1.4 full overhaul - version 4.7.0 ([#30](https://github.com/yonatangross/orchestkit/issues/30)) ([db3f9ad](https://github.com/yonatangross/orchestkit/commit/db3f9ad504b4edfcf0c8b05e11e907f6d8f05d78))
* **cc217:** implement CC 2.1.7 compatibility improvements ([#38](https://github.com/yonatangross/orchestkit/issues/38)) ([fb4f8c5](https://github.com/yonatangross/orchestkit/commit/fb4f8c5a07974d9e3e3886ff2c80956c0db51efd))
* **ci:** cross-platform CI with Node 20/22/24 matrix ([#244](https://github.com/yonatangross/orchestkit/issues/244)) ([e32f6dd](https://github.com/yonatangross/orchestkit/commit/e32f6dd0a13a4522cd115522c435f65001c00e4c))
* comprehensive plugin improvements ([#60](https://github.com/yonatangross/orchestkit/issues/60), [#62](https://github.com/yonatangross/orchestkit/issues/62), [#63](https://github.com/yonatangross/orchestkit/issues/63), [#64](https://github.com/yonatangross/orchestkit/issues/64)) ([a0e2e20](https://github.com/yonatangross/orchestkit/commit/a0e2e205fa3376cebffd2615b9e2c4eef83be165))
* **config:** add OrchestKit-branded spinner verbs (CC 2.1.23) ([#288](https://github.com/yonatangross/orchestkit/issues/288)) ([6d09c6b](https://github.com/yonatangross/orchestkit/commit/6d09c6b8fef3fc89defa58782418a1369404fa69)), closes [#287](https://github.com/yonatangross/orchestkit/issues/287)
* **feedback+memory:** implement Phase 1 core libraries and tests ([ca95e2b](https://github.com/yonatangross/orchestkit/commit/ca95e2bf6cb5c2b0f40ac1b30adeeb2af3eecee5))
* **feedback:** implement agent performance tracking ([#55](https://github.com/yonatangross/orchestkit/issues/55)) ([7e4584d](https://github.com/yonatangross/orchestkit/commit/7e4584ddaff81dda1a740c3c0590e238ca43495e))
* **feedback:** implement cross-project pattern sync ([#48](https://github.com/yonatangross/orchestkit/issues/48)) ([aa30070](https://github.com/yonatangross/orchestkit/commit/aa300705c5c545e7a52eb87743e4899e455f2dca))
* **feedback:** implement Phase 4 skill usage analytics ([#56](https://github.com/yonatangross/orchestkit/issues/56)) ([e248676](https://github.com/yonatangross/orchestkit/commit/e2486761a6c1e90a605434129f078cdb588c4b6d))
* **feedback:** implement satisfaction detection ([#57](https://github.com/yonatangross/orchestkit/issues/57)) ([d1bffbb](https://github.com/yonatangross/orchestkit/commit/d1bffbb73f2dcc20a3026e3dd7c141de15d17feb))
* **feedback:** implement skill evolution system ([#58](https://github.com/yonatangross/orchestkit/issues/58)) ([6ec8255](https://github.com/yonatangross/orchestkit/commit/6ec82559d478332f2aa10ab8e45427a29e5d749a))
* **hooks:** Add automatic GitHub issue progress tracking ([e638499](https://github.com/yonatangross/orchestkit/commit/e6384991b4231ff8d1092670c4a285af2f68ce7a))
* **hooks:** Add skill-auto-suggest prompt hook ([#123](https://github.com/yonatangross/orchestkit/issues/123)) ([67943a1](https://github.com/yonatangross/orchestkit/commit/67943a13b584c23e3edf4cc78f956c980a0fdc3f))
* **hooks:** Add skill-auto-suggest prompt hook ([#123](https://github.com/yonatangross/orchestkit/issues/123)) ([3c90dc4](https://github.com/yonatangross/orchestkit/commit/3c90dc4082575c30f1a0c0a0505fba6d7a82fba3))
* **hooks:** CC 2.1.x compliance and hook optimizations ([#170](https://github.com/yonatangross/orchestkit/issues/170)) ([3391fb1](https://github.com/yonatangross/orchestkit/commit/3391fb1fde63088ac24cbf26a37a8306f20df2d8))
* **hooks:** Implement context-pruning-advisor hook ([#126](https://github.com/yonatangross/orchestkit/issues/126)) ([#168](https://github.com/yonatangross/orchestkit/issues/168)) ([18f9d71](https://github.com/yonatangross/orchestkit/commit/18f9d7188954a1861d46dbe3f5804c17a218a5ce))
* **hooks:** Implement error-solution-suggester hook ([#124](https://github.com/yonatangross/orchestkit/issues/124)) ([#169](https://github.com/yonatangross/orchestkit/issues/169)) ([68143fe](https://github.com/yonatangross/orchestkit/commit/68143fe5688126f8c797b28ff8e31f0abf9eec29))
* **hooks:** Implement pre-commit-simulation and wire changelog-generator ([#130](https://github.com/yonatangross/orchestkit/issues/130), [#160](https://github.com/yonatangross/orchestkit/issues/160)) ([698c9c5](https://github.com/yonatangross/orchestkit/commit/698c9c59dd3e3f513748aae216f4c4005ac86288))
* **hooks:** improve auto-suggest UX with three-tier messaging ([#278](https://github.com/yonatangross/orchestkit/issues/278)) ([#290](https://github.com/yonatangross/orchestkit/issues/290)) ([de1a8a0](https://github.com/yonatangross/orchestkit/commit/de1a8a019742ba42f0558eee29a891e72499ce5f))
* Initial release of SkillForge Claude Plugin v1.0.0 ([910e763](https://github.com/yonatangross/orchestkit/commit/910e7632b13623ddf35be037746f9bf56f2bd204))
* **mem0:** enhance mem0 integration with agent skills and new hooks ([1341757](https://github.com/yonatangross/orchestkit/commit/1341757d1dda00b665fa6de429010320dba2ad0b))
* **mem0:** implement decision sync with mem0 cloud ([#47](https://github.com/yonatangross/orchestkit/issues/47)) ([723b119](https://github.com/yonatangross/orchestkit/commit/723b1197af61524485fd3a4adc1bbcd8ed360808))
* **mem0:** Implement Memory Fabric v2.0 unified memory system ([17d1d2f](https://github.com/yonatangross/orchestkit/commit/17d1d2f2cef10fa507320fafb56a6a43063ece62))
* **mem0:** implement Phase 2 agent memory hooks ([#44](https://github.com/yonatangross/orchestkit/issues/44), [#45](https://github.com/yonatangross/orchestkit/issues/45)) ([d2e87f6](https://github.com/yonatangross/orchestkit/commit/d2e87f661b55515874f352ada70ed652b3d8ca30))
* **mem0:** implement Phase 3 session memory hooks ([#46](https://github.com/yonatangross/orchestkit/issues/46), [#47](https://github.com/yonatangross/orchestkit/issues/47)) ([ee1e536](https://github.com/yonatangross/orchestkit/commit/ee1e53680340209fb964c05d9fbdb3ad8a03d568))
* **mem0:** Mem0 Pro Integration v4.20.0 - Graph memory, cross-agent federation, session continuity ([880084a](https://github.com/yonatangross/orchestkit/commit/880084a921e3fe7381d3de1b923a0de91556f98e))
* **memory:** health checks, metrics, queue recovery, graph-viz — v5.6.0 ([#270](https://github.com/yonatangross/orchestkit/issues/270)) ([1c9ff8d](https://github.com/yonatangross/orchestkit/commit/1c9ff8d859c9a58d372dac6233372f62ed58f981))
* Migrate 72 skills to slim Tier 1 format with 75% token reduction ([2ab19c0](https://github.com/yonatangross/orchestkit/commit/2ab19c08461420b628e86d47ba9c71c96652016f))
* **multimodal:** Add Multimodal AI Foundation skills and agent ([#71](https://github.com/yonatangross/orchestkit/issues/71)) ([62b832c](https://github.com/yonatangross/orchestkit/commit/62b832c9baa0d169b45516762d5f5b97bd9faadc))
* Opus 4.6 + CC 2.1.34 Upgrade (Milestone [#53](https://github.com/yonatangross/orchestkit/issues/53)) ([#345](https://github.com/yonatangross/orchestkit/issues/345)) ([20d1f4f](https://github.com/yonatangross/orchestkit/commit/20d1f4faf0a3de9dc4d01ab1b702f4143bc58323))
* OrchestKit v5.3.0 — CC 2.1.20 feature adoption ([#241](https://github.com/yonatangross/orchestkit/issues/241)) ([f80f263](https://github.com/yonatangross/orchestkit/commit/f80f2638c422723b2147bc2420dde082918e3654))
* **patterns:** Implement automatic pattern extraction system ([#48](https://github.com/yonatangross/orchestkit/issues/48), [#49](https://github.com/yonatangross/orchestkit/issues/49)) ([58256b2](https://github.com/yonatangross/orchestkit/commit/58256b23f0ccaf507275e349a74891a3e40d60a5))
* **playgrounds:** fix video playback, improve wizard UX ([#296](https://github.com/yonatangross/orchestkit/issues/296), [#297](https://github.com/yonatangross/orchestkit/issues/297), [#298](https://github.com/yonatangross/orchestkit/issues/298)) ([#299](https://github.com/yonatangross/orchestkit/issues/299)) ([ed558c7](https://github.com/yonatangross/orchestkit/commit/ed558c72ca54280cadf3ea570ef1ce5720c4c019))
* **playgrounds:** v6.0.0 two-tier plugin system + accessibility + ES5 ([#316](https://github.com/yonatangross/orchestkit/issues/316)) ([4fc1fab](https://github.com/yonatangross/orchestkit/commit/4fc1fab26feb60df6b30dcc47ee6e15a11c570ed))
* Rename plugin to skf + silent hooks + version automation ([#25](https://github.com/yonatangross/orchestkit/issues/25)) ([aec0179](https://github.com/yonatangross/orchestkit/commit/aec0179a8dbe606ec9f11c15ebda14ee974f4cac))
* SkillForge v4.6.3 - New Retrieval Skills & Tier 3 References ([24a0d2f](https://github.com/yonatangross/orchestkit/commit/24a0d2f7666a83d6eff0cc89b789ba79d6ceb655))
* **skills:** Add 5 frontend skills and assign to agents ([#112](https://github.com/yonatangross/orchestkit/issues/112)-[#116](https://github.com/yonatangross/orchestkit/issues/116), [#164](https://github.com/yonatangross/orchestkit/issues/164)) ([0ab9996](https://github.com/yonatangross/orchestkit/commit/0ab9996bb2c9838661a56fce2726efcf4b0ec47c))
* **skills:** Add 5 frontend skills and enhance setup validation ([4399012](https://github.com/yonatangross/orchestkit/commit/4399012d5535f92bbae861c26b9a0f83126c135e))
* **skills:** Add Backend Skills 2026 milestone ([#83](https://github.com/yonatangross/orchestkit/issues/83)-[#88](https://github.com/yonatangross/orchestkit/issues/88)) ([6cdbb16](https://github.com/yonatangross/orchestkit/commit/6cdbb16695c880f3d022d6521b1420d1f2cea98f))
* **skills:** Add checklists and examples to git/github skills ([50a5f09](https://github.com/yonatangross/orchestkit/commit/50a5f093a330d61792047e8915db25f565600985))
* **skills:** Add examples and templates to connection-pooling and idempotency-patterns ([957c2a3](https://github.com/yonatangross/orchestkit/commit/957c2a36d1497df8751311943702a996f316e445))
* **skills:** Add mem0-sync skill for automatic session persistence ([56593c9](https://github.com/yonatangross/orchestkit/commit/56593c9a22bfe0906a4ac2d49b598847c9c2924a))
* **skills:** Add Phase 2 Quality & Scale skills ([#89](https://github.com/yonatangross/orchestkit/issues/89)-[#94](https://github.com/yonatangross/orchestkit/issues/94)) ([9950c56](https://github.com/yonatangross/orchestkit/commit/9950c5691f9038487caef0680af7a14089832c2a))
* **skills:** Add Related Skills and Key Decisions sections to 34 skills ([9305c8a](https://github.com/yonatangross/orchestkit/commit/9305c8a5f326593e402cf81f070cfa3515951912))
* **skills:** CC 2.1.7 skills migration - flat structure ([46a25b2](https://github.com/yonatangross/orchestkit/commit/46a25b20fc866b4072436565ebb9e21b668484e3))
* **skills:** update to February 2026 best practices (v5.7.0) ([#280](https://github.com/yonatangross/orchestkit/issues/280)) ([f594215](https://github.com/yonatangross/orchestkit/commit/f5942150ae324a2d25033646f50c2959fe23b1e6))
* Update .claude skills to PostgreSQL 18 ([cfd66ae](https://github.com/yonatangross/orchestkit/commit/cfd66ae90fd0f0305b679b09a29cc792fdbb4b51))
* Update .claude skills to PostgreSQL 18 ([d122e93](https://github.com/yonatangross/orchestkit/commit/d122e9311b4aca4e41e317749d031af00f9b7e6c))
* Update logo and sync .claude from skillforge ([46c6151](https://github.com/yonatangross/orchestkit/commit/46c6151e2429880055ab42be030e8ce7492f9982))
* Update plugin.json with new agents and hooks ([6707604](https://github.com/yonatangross/orchestkit/commit/67076041a82c7594b30d79a8a107deac16762dca))
* **v4.18:** Add CC 2.1.11 Setup hooks, expand skills and agents ([d508c03](https://github.com/yonatangross/orchestkit/commit/d508c0323a74752a029f96e778ffdd0a67a4f584))
* v4.4.0 - Frontend updates + 7 backend skills with full subdirectories ([3c1ac90](https://github.com/yonatangross/orchestkit/commit/3c1ac906b58b703462cbea168a8cde7094a3782d))
* v4.5.0 - Complete Claude Code 2.1.1 feature utilization ([f0288b5](https://github.com/yonatangross/orchestkit/commit/f0288b531d3d99e6488a3c5324a7d7d21d519e32))


### Bug Fixes

* **#213:** Cleanup marketplace naming and broken symlinks ([#218](https://github.com/yonatangross/orchestkit/issues/218)) ([73d77d3](https://github.com/yonatangross/orchestkit/commit/73d77d3482a7e4673935be538e7670123d1e8eb1))
* **#213:** Remove engine field from all 33 modular plugins ([#216](https://github.com/yonatangross/orchestkit/issues/216)) ([477b4ca](https://github.com/yonatangross/orchestkit/commit/477b4ca0a18a2bb3f3211cadc7f507cc3a1fcda3))
* **#213:** Remove invalid marketplace schema fields and add CI validation ([#214](https://github.com/yonatangross/orchestkit/issues/214)) ([e088878](https://github.com/yonatangross/orchestkit/commit/e0888785dbb0905a18fa03fc0ec114c3aa447fe0))
* **#213:** Restore required source field in marketplace.json ([#215](https://github.com/yonatangross/orchestkit/issues/215)) ([185977b](https://github.com/yonatangross/orchestkit/commit/185977bac710ca2f21415d2ffd76bf518be7bc6c))
* **#224:** Add missing command field to SessionStart hook ([#225](https://github.com/yonatangross/orchestkit/issues/225)) ([06d1a71](https://github.com/yonatangross/orchestkit/commit/06d1a71313c15372b5bf0b81df043c05223552b2))
* **#224:** Move hooks to hooks/hooks.json for external project compatibility ([#226](https://github.com/yonatangross/orchestkit/issues/226)) ([8b27bbf](https://github.com/yonatangross/orchestkit/commit/8b27bbfea7cb0cf902a7378cc3f89824b87a7fe4))
* **#228:** Replace symlinks with build system for plugin distribution ([#229](https://github.com/yonatangross/orchestkit/issues/229)) ([e5d1c35](https://github.com/yonatangross/orchestkit/commit/e5d1c352961fcce3dba00be684867e91d44109e3))
* **#68:** Add commands/ directory for autocomplete support ([#69](https://github.com/yonatangross/orchestkit/issues/69)) ([9221ee9](https://github.com/yonatangross/orchestkit/commit/9221ee93be7e9aa2256730bf41cc3fb68ec444b8))
* Add CC 2.1.1 spec compliance to all hook outputs ([4f7c783](https://github.com/yonatangross/orchestkit/commit/4f7c78364f50c2e754308f010b2a66e5d425efb4))
* Add required current_task field to session state template ([3433ea0](https://github.com/yonatangross/orchestkit/commit/3433ea04b3d2a0a10ece7fb25e9b0a56ebaec033))
* **agent-browser:** Add discovery mode to templates for runnable out-of-box ([#178](https://github.com/yonatangross/orchestkit/issues/178)) ([b374dd1](https://github.com/yonatangross/orchestkit/commit/b374dd1dd2e35d949e13b1d6d28cb3a5463d4a6b))
* **agents:** correct model and context mode misconfigurations ([#39](https://github.com/yonatangross/orchestkit/issues/39)) ([07657da](https://github.com/yonatangross/orchestkit/commit/07657da87ceeae5e74a03111b77f004714fc9a99))
* Align marketplace.json with Claude Code schema ([#22](https://github.com/yonatangross/orchestkit/issues/22)) ([c61b530](https://github.com/yonatangross/orchestkit/commit/c61b530615f629f06954cc81ef141091a660445a))
* Align plugin.json with Claude Code schema ([#23](https://github.com/yonatangross/orchestkit/issues/23)) ([045717e](https://github.com/yonatangross/orchestkit/commit/045717ec2e47d1be817047081e7b226fd4261cc1))
* **build:** sync marketplace versions and propagate deps ([#273](https://github.com/yonatangross/orchestkit/issues/273)) ([a22ec94](https://github.com/yonatangross/orchestkit/commit/a22ec94551be8034e1b65814248d57df53581f9a))
* **ci:** Add CHANGELOG 4.20.0 entry and update version references ([9cd5980](https://github.com/yonatangross/orchestkit/commit/9cd5980a4dd67640e2c55e4eb89471c5651bdf86))
* **ci:** comprehensive test coverage and CC 2.1.7 path fixes [v4.15.2] ([924e98e](https://github.com/yonatangross/orchestkit/commit/924e98e48a44e712dcb6ff1c866495ad402eead6))
* **ci:** Correct hook counts and add missing user-invocable fields ([20ce45c](https://github.com/yonatangross/orchestkit/commit/20ce45c228144525dc0cc885699c081e4c826612))
* **ci:** Resolve 9 CI failures with count updates and missing files ([20482b6](https://github.com/yonatangross/orchestkit/commit/20482b62cea641f2ffb2f1a6592c6e7a0dbbd3ca))
* Complete skill validation and handoff system fixes ([2b830ee](https://github.com/yonatangross/orchestkit/commit/2b830ee32b180d653cbb95c9edd251196f70340e))
* Config system validation and test coverage ([e9213c7](https://github.com/yonatangross/orchestkit/commit/e9213c786e887edebd2798209b76cc90aa5cee16))
* Coordination hook JSON output + dynamic component counting ([#20](https://github.com/yonatangross/orchestkit/issues/20)) ([999939c](https://github.com/yonatangross/orchestkit/commit/999939c1684185536c2a16e8d6fc99f022dd5c97))
* Correct hooks count from 92 to 90 ([#18](https://github.com/yonatangross/orchestkit/issues/18)) ([17c7d65](https://github.com/yonatangross/orchestkit/commit/17c7d659a1db1b29f10698fcc074af0525613218))
* Correct security test filename in CI workflow ([ab9bfe3](https://github.com/yonatangross/orchestkit/commit/ab9bfe3020a829e88dc0fd5d4a2063254795887b))
* Full CC 2.1.1 and schema compliance validation ([f2c188e](https://github.com/yonatangross/orchestkit/commit/f2c188ec3b0bfdd4b1f2a385953d76dc5a16f632))
* **hooks:** Add CLAUDE_SESSION_ID fallback in realtime-sync.sh ([9649b66](https://github.com/yonatangross/orchestkit/commit/9649b66c9a416cf0f99aa15573063bce7bbc9887))
* **hooks:** Add default value for CLAUDE_SESSION_ID in memory-fabric-init ([54fb1c3](https://github.com/yonatangross/orchestkit/commit/54fb1c36aab2b3f5d5fa0ec3ecf94815d6d24844))
* **hooks:** Add stdin consumption to prevent broken pipe errors ([#174](https://github.com/yonatangross/orchestkit/issues/174)) ([5ff8a6f](https://github.com/yonatangross/orchestkit/commit/5ff8a6f1c6fea1acd725bce02b116e0b3de98abf))
* **hooks:** CC 2.1.7 compliance - remove ANSI from JSON output ([8119495](https://github.com/yonatangross/orchestkit/commit/81194952ad60b158b921ac72e46dec6df74076cd))
* **hooks:** CC 2.1.7 compliance and comprehensive test suite ([78bded2](https://github.com/yonatangross/orchestkit/commit/78bded2e7426e7f1e56746324ca492422e275b61))
* **hooks:** Ensure coverage-threshold-gate outputs valid JSON ([e00bcd1](https://github.com/yonatangross/orchestkit/commit/e00bcd1bfdb1b0648f738fea72892de83a7ce15c))
* **hooks:** Ensure test-runner.sh outputs proper JSON on early exit ([3c2210a](https://github.com/yonatangross/orchestkit/commit/3c2210a7253c7e0d1c94a98399b364901add985c))
* **hooks:** Make Stop hooks truly silent by logging to files ([928365e](https://github.com/yonatangross/orchestkit/commit/928365e02d485a95341ed04c1bfde91bc9a01aa1))
* **hooks:** Remove unsupported additionalContext from SessionStart hooks ([4e91142](https://github.com/yonatangross/orchestkit/commit/4e91142f143ec74b13b598c6ab34c8fcc187dcd0))
* **hooks:** Stop hook schema compliance - remove hookSpecificOutput ([9bef613](https://github.com/yonatangross/orchestkit/commit/9bef6134e80ec48b59e8532a1b5044d57776551b))
* **hooks:** update hooks to CC 2.1.7 output format ([1091895](https://github.com/yonatangross/orchestkit/commit/10918950fe5842d9d40697e9a37615f8a60ee702))
* **hooks:** Update mem0-decision-saver messaging for v1.2.0 ([91d4915](https://github.com/yonatangross/orchestkit/commit/91d49152157c06de9fcebe28f76f5587b0891ee0))
* Include built plugins/ in git for marketplace distribution ([#230](https://github.com/yonatangross/orchestkit/issues/230)) ([449721b](https://github.com/yonatangross/orchestkit/commit/449721bf4b7d3c7a985c0a0082f5d869d6f0f8b1))
* Make all pretool hooks CC 2.1.2 compliant ([b72fd0d](https://github.com/yonatangross/orchestkit/commit/b72fd0dc3280dfec0069045b38108d0d693aca6d))
* Make hooks silent on success, only show errors/warnings ([#24](https://github.com/yonatangross/orchestkit/issues/24)) ([5c352e3](https://github.com/yonatangross/orchestkit/commit/5c352e3310e13a6f96edea8105fe96d2b443cb90))
* Marketplace schema compatibility + cleanup runtime artifacts ([#21](https://github.com/yonatangross/orchestkit/issues/21)) ([dbf16c0](https://github.com/yonatangross/orchestkit/commit/dbf16c0036f69e182c72b612d671dbf0a28c7762))
* **marketplace:** remove deps key rejected by Claude Code schema ([#279](https://github.com/yonatangross/orchestkit/issues/279)) ([a4f36c2](https://github.com/yonatangross/orchestkit/commit/a4f36c2482d1b8774c049639825ee736864677ed))
* **paths:** complete migration to flat skill structure ([8f12814](https://github.com/yonatangross/orchestkit/commit/8f1281487402ececafb2399f8c759e49c03243a9))
* Prevent marketplace auto-install by restructuring plugin architecture ([#227](https://github.com/yonatangross/orchestkit/issues/227)) ([b998f97](https://github.com/yonatangross/orchestkit/commit/b998f97d78fd4db24c3a259baef80a49e41b49f0))
* **recall:** Rename Flags section to Advanced Flags ([7394d47](https://github.com/yonatangross/orchestkit/commit/7394d4750101369ca545c79314a81b1f02cb343d))
* Remove invalid 'engines' field from plugin manifest ([00221e4](https://github.com/yonatangross/orchestkit/commit/00221e42931cab9e40d370a1e7f6c9cb15cf5dea))
* Remove invalid allowed-tools field from plugin.json ([#173](https://github.com/yonatangross/orchestkit/issues/173)) ([972b920](https://github.com/yonatangross/orchestkit/commit/972b920a2779c3205f065a4ed22484b4e1d51bf7))
* Remove template literals from skills + enforce version/changelog in CI ([#27](https://github.com/yonatangross/orchestkit/issues/27)) ([05129a3](https://github.com/yonatangross/orchestkit/commit/05129a37f0ecdf484c1eed866f9a747341a39ed3))
* Resolve all hook errors with unbound variables and noisy output ([492b096](https://github.com/yonatangross/orchestkit/commit/492b096453971ef20fc7964a2cb0bf948669f542))
* Resolve CI failures for PR [#163](https://github.com/yonatangross/orchestkit/issues/163) ([277bcaf](https://github.com/yonatangross/orchestkit/commit/277bcafefb9bd4ab34523fdd1acbffb6d70cd2de))
* Resolve hook shell errors with unbound variables and JSON output ([0ac79db](https://github.com/yonatangross/orchestkit/commit/0ac79dbff162d9054fc7d43b70f8f59c3ad564cf))
* Resolve hook stdin caching and JSON field name issues ([c22cfca](https://github.com/yonatangross/orchestkit/commit/c22cfca747a1d6bd0848fb7159890856117dfefc))
* Resolve LSP, linting, and hook errors ([7e92386](https://github.com/yonatangross/orchestkit/commit/7e9238689eeb19378118ec7dfbf37539a537bd69))
* Resolve mem0-pre-compaction-sync.sh errors ([5673a3b](https://github.com/yonatangross/orchestkit/commit/5673a3bc9ff368677b1d5b638c10b1076a0c51d0))
* Resolve ruff linting errors and exclude templates ([bde17ed](https://github.com/yonatangross/orchestkit/commit/bde17ed1e9628389bcf06ab7756a06e125d26a20))
* Resolve skill/subagent test failures and hook errors for v4.6.2 ([40646cf](https://github.com/yonatangross/orchestkit/commit/40646cfe7621f0f99f4e446d86f057b104f537ba))
* resolve startup hook errors and test failures ([#37](https://github.com/yonatangross/orchestkit/issues/37)) ([ba5112a](https://github.com/yonatangross/orchestkit/commit/ba5112a1d4de05765b05cf1925fa46498a88b7db))
* **skills:** Add missing sections to frontend skills ([f0ee7fb](https://github.com/yonatangross/orchestkit/commit/f0ee7fb4cb7dd2980c409825f2f27483d8a28ed6))
* **structure:** move skills to root level per CC plugin standard ([16593a2](https://github.com/yonatangross/orchestkit/commit/16593a2761a73e6c77cfad1ad165055d1d808635))
* Sync marketplace.json version to 4.17.2 ([4e29f1b](https://github.com/yonatangross/orchestkit/commit/4e29f1b122d6df65b49765816efb6be23e81b9f1))
* Sync plugin.json with actual .claude structure ([57a0bd1](https://github.com/yonatangross/orchestkit/commit/57a0bd1c67f787f1cef9671eecc9b9b9d4245018))
* Sync plugin.json with actual .claude structure ([204d4f5](https://github.com/yonatangross/orchestkit/commit/204d4f558b795bac20bef02b7b6260f4c63163ee))
* **tests:** fix syntax error in test-agent-required-hooks.sh ([#65](https://github.com/yonatangross/orchestkit/issues/65)) ([fbfd5af](https://github.com/yonatangross/orchestkit/commit/fbfd5afa0449c81a6bc1d49881b6eeaf9f3fbb14))
* **tests:** resolve Feedback System Tests infrastructure issues ([d5f3899](https://github.com/yonatangross/orchestkit/commit/d5f3899400026b403910f0df7260393c88839653))
* **tests:** resolve pre-existing test failures ([aef5823](https://github.com/yonatangross/orchestkit/commit/aef5823070255aaa200b031793629d0e092a7881))
* **tests:** Update CC version check to require &gt;= 2.1.11 ([448a05b](https://github.com/yonatangross/orchestkit/commit/448a05bf7efb640651c119b699d2d4ae94d4fc2d))
* **tests:** Update thresholds for expanded skills and hooks ([2bdcaa5](https://github.com/yonatangross/orchestkit/commit/2bdcaa5995bc885e895cba2ffbd657d9c0891e9a))
* Update all references from CC 2.1.1 to CC 2.1.2 ([cd98b1f](https://github.com/yonatangross/orchestkit/commit/cd98b1f17be7525db1444946d7cc44f42932ad9c))
* Update component counts to match actual v4.6.3 ([#17](https://github.com/yonatangross/orchestkit/issues/17)) ([49c64a9](https://github.com/yonatangross/orchestkit/commit/49c64a9dae4f7f8988791aded3dfb57d4b85c870))
* update marketplace description to 149 hooks ([f636e83](https://github.com/yonatangross/orchestkit/commit/f636e83c9642c038b1246330c13d944e49d25987))
* Update README naming and fix hooks count in about ([#26](https://github.com/yonatangross/orchestkit/issues/26)) ([02a020c](https://github.com/yonatangross/orchestkit/commit/02a020c864db36f87bf60e81b9d1f2aa577343bd))
* use ${CLAUDE_PLUGIN_ROOT} for plugin installation compatibility ([#34](https://github.com/yonatangross/orchestkit/issues/34)) ([d78ea55](https://github.com/yonatangross/orchestkit/commit/d78ea55742b373724e61eca3b94f3b30371f35a8))
* Version consistency and missing metadata (v4.4.1) ([500a1bd](https://github.com/yonatangross/orchestkit/commit/500a1bd3a76d0eed5b5069ef2aa4f9c43b46ed58))


### Performance Improvements

* **#200:** Complete lifecycle hooks TS delegation + remove _lib ([#201](https://github.com/yonatangross/orchestkit/issues/201)) ([1c84339](https://github.com/yonatangross/orchestkit/commit/1c843397d3648d5cfce21fe0d7e240018260e2a9))
* **hooks:** optimize SessionStart and PromptSubmit latency ([09fb786](https://github.com/yonatangross/orchestkit/commit/09fb78631e09d011518f57e89ea9ee23eedab961))
* **hooks:** parallelize all major dispatchers for 2-3x faster execution ([d4097b5](https://github.com/yonatangross/orchestkit/commit/d4097b58c94a3f1f05847d03ea73f21007120229))
* **hooks:** TypeScript/ESM migration for 2-5x performance ([#196](https://github.com/yonatangross/orchestkit/issues/196)) ([#186](https://github.com/yonatangross/orchestkit/issues/186)) ([741fccb](https://github.com/yonatangross/orchestkit/commit/741fccbf6f088c33f2e4d7715a9d5e09a22573b3))


### Documentation

* **readme:** update counts and add playgrounds for v5.5.0 ([#268](https://github.com/yonatangross/orchestkit/issues/268)) ([f7f0f06](https://github.com/yonatangross/orchestkit/commit/f7f0f060ae38d7d9e3aa1d4c51307ff1128f04bf))


### Code Refactoring

* **hooks:** consolidate to 24 hooks + v4.11.0 ([#36](https://github.com/yonatangross/orchestkit/issues/36)) ([e844b4b](https://github.com/yonatangross/orchestkit/commit/e844b4b25d0da25b3cd635d5573690a05ec0a2d9))
* **structure:** CC 2.1.7 compliance - flatten skills, remove redundant context ([99bd80d](https://github.com/yonatangross/orchestkit/commit/99bd80d3228b9c21abc97064fccccf75e7bb0d25))

## [6.0.2] - 2026-02-06

### Added

- **#328 (P1-C)**: `complexity: low|medium|high` field added to all 199 skill frontmatters for Opus 4.6 adaptive thinking alignment
- **#337 (P2-E)**: New `upgrade-assessment` user-invocable skill — 6-phase readiness evaluation with structured JSON scoring across 6 dimensions
- **#338 (P2-F)**: New `platform-upgrade-knowledge` reference skill with scoring rubrics and compatibility matrices
- **#333 (P2-D)**: 128K output token guidance added to implement skill, context-engineering, and 3 agent definitions
- **#331 (P2-B)**: New `model-cost-advisor` SubagentStart hook — analyzes task complexity and recommends optimal model for cost savings
- **#325 (P0-B)**: Prefill-guard SessionStart hook warns about Opus 4.6 breaking change (prefilled assistant messages return 400 errors)
- **#346 (P1-E)**: Agent `memory` frontmatter — all 36 agents (31 `project` scope, 5 `local` scope) (CC 2.1.33)
- **#347 (P1-F)**: New `TeammateIdle` and `TaskCompleted` hook events with progress-reporter and completion-tracker handlers (CC 2.1.33)
- **#335 (P3-B)**: New `/ork:audit-full` user-invocable skill — single-pass whole-codebase audit (security, architecture, dependencies) leveraging 1M context window with 4 references, 2 assets, 1 checklist, 1 script
- Batch script `scripts/add-complexity.mjs` for applying complexity classifications
- **#334 (P3-A)**: Agent Teams dual-mode orchestration — `/ork:implement` and 5 other user-invocable skills (assess, brainstorm, explore, fix-issue, review-pr, verify) support both Task tool (star topology) and Agent Teams (mesh topology) via `ORCHESTKIT_PREFER_TEAMS` env var
- **#405**: TeamCreate, SendMessage, TeamDelete tools added to all 36 agents
- **#406**: task-dependency-patterns skill updated with Agent Teams coordination patterns
- **#407**: multi-agent-orchestration skill updated with mesh topology patterns
- **#362**: 4 Agent Teams lifecycle hooks (team-formation-advisor, teammate-progress-reporter, teammate-completion-tracker, team-coordination-advisor)
- **#391 (P2-B)**: Interactive Agent Selector playground with search, category/task filters, quiz wizard, and 10 scenario suggestions
- **Fumadocs site scaffold** (Milestone #56): Fumadocs v16.5 + Next.js + MDX + Orama search, reference pages auto-generated for all 200 skills, 36 agents, 15 hook categories

- **Tavily Integration**: 3-tier web research workflow (WebFetch → Tavily → agent-browser) with curl patterns for search/extract/map APIs, graceful degradation when `TAVILY_API_KEY` is unset
- **Tavily Site Discovery**: competitive-monitoring skill gains Tavily map+extract pre-step for competitor URL enumeration
- **Tavily Agent Awareness**: web-research-analyst, market-intelligence, and product-strategist agents updated with Tavily directives
- **BrightData MCP**: `BRIGHTDATA_API_TOKEN` env var documented for BrightData web scraping MCP server

### Fixed

- **SEC-001**: SQL injection prevention — `multi-instance-cleanup` and `cleanup-instance` now validate instance IDs with `/^[a-zA-Z0-9_\-.:]+$/` before SQLite interpolation
- **SEC-003**: Atomic file writes — `multi-instance-lock` uses write-to-temp + `renameSync` to prevent TOCTOU race conditions in lock files
- README.md hook count corrected (120 → 119)

### Changed

- **#348 (P2-G)**: `Task(agent_type)` restrictions on python-performance-engineer and demo-producer (CC 2.1.33)
- **#349 (P1-G)**: CC minimum version bumped to >= 2.1.33 (from 2.1.32) for agent memory and new hook events
- **#330 (P2-A)**: 13 agents migrated from `mcp__sequential-thinking` to Opus 4.6 native adaptive thinking
- **#329 (P1-D)**: TOKEN_BUDGETS now scale dynamically with `CLAUDE_MAX_CONTEXT` (2% of context window per CC 2.1.32)
- **#332 (P2-C)**: Enhanced `pre-compact-saver` v2.0 — preserves decision logs, memory tier snapshots, compaction frequency analytics
- **#324 (P0-A)**: Replace hardcoded model string in multi-instance-init.ts with dynamic `detectModel()`
- **#326 (P1-A)**: Memory context tier limits expanded (1200→3000 chars memory, 800→1200 chars profile)
- **#327 (P1-B)**: CC minimum version updated to >= 2.1.33 across CLAUDE.md, README, hooks README, marketplace
- MCP configuration docs updated with Opus 4.6 sequential-thinking deprecation note
- CI workflow renames for clarity and pipeline parallelism
- Skill count: 197 → 200 (added upgrade-assessment, platform-upgrade-knowledge, audit-full)
- Hook count: 117 → 119 (91 global + 22 agent + 6 skill-scoped)
- Opus 4.6 callouts added to top 5 user-invocable skills (verify, review-pr, fix-issue, implement, explore)
- Agent `memory` frontmatter expanded from 22 to all 36 agents

### Removed

- Deprecated `sequential-thinking-auto` pretool hook (Opus 4.6 native adaptive thinking replaces MCP sequential-thinking)
- **#362**: 6 coordination hooks removed as redundant with CC native Agent Teams (team-formation-hook, team-coordinator, teammate-monitor, team-cleanup, team-health-check, team-context-share)

---


## [6.0.1] - 2026-02-05

### Changed

- **orkl manifest**: Removed 12 language-specific skills to keep orkl truly universal (107 → from 119 skills)
  - Removed: run-tests, background-jobs, connection-pooling, caching-strategies, rate-limiting, api-versioning, error-handling-rfc9457, input-validation, property-based-testing, i18n-date-patterns, image-optimization, type-safety-validation

### Added

- **LangGraph skills**: Added Quick Start sections, 6 cross-links (up from 3), and evaluation test cases
- **New skills**: langgraph-streaming, langgraph-subgraphs, langgraph-tools
- **Progressive disclosure**: Refactored mcp-server-building and database-versioning into main SKILL.md + references/

### Fixed

- Documentation count sync: README.md, CLAUDE.md, CONTRIBUTING.md now show correct counts (197 skills, 36 agents, 117 hooks)

---


## [6.0.0] - 2026-02-04

### Changed

- **Breaking**: Reorganized plugins from 26 granular plugins to 2-tier architecture:
  - `orkl` (119 skills) — Universal toolkit, language-agnostic, all workflows work out of the box
  - `ork` (195 skills) — Full specialized toolkit with Python, React, LLM/RAG patterns
- Renamed `ork-lite` to `orkl` for shorter prefix
- All 36 agents and 117 hooks included in BOTH plugins
- Deleted 25 domain-specific plugin manifests (ork-accessibility, ork-backend-patterns, ork-memory-*, etc.)
- Memory plugins (graph, mem0, fabric) now included directly in orkl
- No more dependency issues — every workflow works without additional installs

### Added

- `web-research-analyst` agent for browser automation and competitive intelligence
- `research` category for agent indexes
- `competitive-monitoring` skill (22 user-invocable skills total)

### Fixed

- Bash 3.2 compatibility in generate-indexes.sh (macOS default shell)
- Agent index generation now includes all categories correctly
- Playgrounds updated for two-tier plugin system (setup-wizard, data.js, index.html)

---

## [5.7.5] - 2026-02-04

### Fixed

- CI report generation using tsx for ESM compatibility

---


## [5.7.4] - 2026-02-04

### Fixed

- TODO: Describe your changes here

---


## [5.7.3] - 2026-02-03

### Changed

- Removed redundant skill-resolver hook (Claude Code natively auto-injects skills from agent frontmatter)
- Hook count: 117 total (89 global + 28 agent/skill-scoped)
- Eval framework focuses on agent routing correctness via CLAUDE.md agent-index (removed skill metrics)

### Fixed

- Eval scripts: Fixed dry-run mode to create all required output directories
- Eval scripts: Fixed path prefixes in golden test commands
- Eval scripts: Added explicit exit 0 to ensure proper exit status
- CI workflow: Exclude eval scripts from artifact to prevent overwriting

---


## [5.7.2] - 2026-02-03

### Added

- **Three-tier auto-suggest UX**: Confidence-based messaging for skill injection
  - SILENT (≥90%): No user notification, just inject
  - NOTIFY (80-89%): Brief "💡 Loaded: X" notification
  - SUGGEST (70-79%): Suggest skills with context
  - HINT (50-69%): Hint at possible matches

- **AGENTS.md cross-tool compatibility**: Generate AGENTS.md alongside CLAUDE.md
  - Enables compatibility with Cursor, Codex, Amp, Zed
  - AGENTS.md follows the open standard at https://agents.md/

- **CI-based index effectiveness evaluation**: A/B comparison framework
  - 12 golden tests covering 8 different agents
  - Compares with-index vs without-index performance
  - Metrics: build success, lint compliance, test pass, agent routing

- Dynamic test discovery via `scripts/ci/run-tests.sh` (discovers 154 tests vs ~100 hardcoded)
- Reusable test-runner workflow (`.github/workflows/reusable-test-runner.yml`)
- Composite action for test execution (`.github/actions/run-tests/action.yml`)
- Expanded npm caching strategy (node_modules, vitest cache)
- Multi-tier skill scenario test assertion (notify-tier generates systemMessage)

### Changed

- Removed redundant skill-resolver hook (Claude Code natively auto-injects skills from agent frontmatter)
- Hook count: 117 total (89 global + 28 agent/skill-scoped)
- CI workflows now use SHA-pinned GitHub Actions
- Test execution uses dynamic discovery instead of hardcoded invocations
- Eval framework focuses on agent routing correctness via CLAUDE.md agent-index

### Security

- Pin `googleapis/release-please-action@v4` to SHA commit (SEC-001)
- Fix shell injection risk in version-check.yml by using env variable pattern for `github.head_ref` (SEC-002)
- Quote `inputs.ci-setup-flags` in setup action to prevent command injection (SEC-003)
- All 8 external GitHub Actions now pinned to SHA commits for supply chain security
- Add SHA documentation in `.github/action-versions.md`
- Replaced arbitrary `eval` with allowlist-based command execution
- Pinned yq to v4.40.5 with SHA256 checksum verification
- Added cleanup traps for temp directories on EXIT/ERR

---

## [5.7.1] - 2026-02-02

### Added

- Dynamic test discovery via `scripts/ci/run-tests.sh` (discovers 154 tests vs ~100 hardcoded)
- Reusable test-runner workflow (`.github/workflows/reusable-test-runner.yml`)
- Composite action for test execution (`.github/actions/run-tests/action.yml`)
- Expanded npm caching strategy (node_modules, vitest cache)

### Changed

- CI workflows now use SHA-pinned GitHub Actions
- Test execution uses dynamic discovery instead of hardcoded invocations

### Security

- Replaced arbitrary `eval` with allowlist-based command execution
- Pinned yq to v4.40.5 with SHA256 checksum verification
- Added cleanup traps for temp directories on EXIT/ERR


## [5.7.0] - 2026-02-02

### Changed

- **Model Updates (February 2026)**:
  - OpenAI: gpt-4o → gpt-5.2, gpt-4o-mini → gpt-5.2-mini
  - Anthropic: Claude model dates updated to 20251101 (Opus 4.5, Sonnet 4.5, Haiku 4.5)
  - Meta: llama3.2 → llama3.3
  - Google: Gemini 2.5 → Gemini 3
  - xAI: Grok 3 → Grok 4

- **Framework Updates**:
  - Next.js 16: Cache Components with `"use cache"` directive, async params/searchParams
  - Tailwind CSS v4: CSS-first configuration with `@theme {}`, no tailwind.config.js needed
  - LangGraph 1.0: `create_react_agent` → `create_agent`, `prompt=` → `system_prompt=`
  - Redis 8.4: Built-in Search/JSON modules, FT.HYBRID with RRF fusion
  - Vite 8: Rolldown bundler with `advancedChunks` API
  - CrewAI 1.8.x: Flows architecture with `@start()`, `@listen()`, `@router()` decorators
  - Playwright 1.58: Agents workflow with `init-agents`, planner/generator/healer pattern

### Added

- **New reference files**:
  - `cache-components.md` — Next.js 16 Cache Components comprehensive guide
  - `nextjs-16-upgrade.md` — Breaking changes and migration path
  - `gpt-5-2-codex.md` — GPT-5.2-Codex agentic coding model documentation
  - Redis 8 FT.HYBRID comparison added to `pgvector-search` skill
  - CrewAI 1.8.x Flows patterns added to `crewai-patterns.md`

- **Updated skills** (193 skills updated with current best practices):
  - `react-server-components-framework` — v1.4.0 with Cache Components
  - `vite-advanced` — Rolldown bundler patterns
  - `e2e-testing` — Playwright Agents workflow
  - `semantic-caching` — Redis 8 built-in modules
  - `rag-retrieval` — LangGraph 1.0 API updates
  - `alternative-agent-frameworks` — OpenAI Agents SDK 0.7.0, CrewAI 1.8.x

### Fixed

- `memory/SKILL.md` — Renamed "Quick Start" to "Usage" for test validation
- `implement/SKILL.md` — Reduced from 527 to 474 lines (under 500 limit)
- `data.js` — Regenerated with correct version 5.7.0
- `session-tracking.test.ts` — Fixed TEST_PROJECT_DIR initialization

---

## [5.6.2] - 2026-02-02

### Fixed

- **Critical**: Remove `"deps"` key from marketplace.json that caused "Invalid schema: Unrecognized key: deps" errors on all 26 plugins when installing via `/plugin`
- Remove dependency propagation from build script (deps stay in manifests for internal use only)
- Upgrade marketplace schema test from denylist to allowlist validation to catch any future unrecognized keys

---


## [5.6.1] - 2026-02-02

### Fixed

- Build script syncs all marketplace.json plugin versions to the project version (eliminates version drift)
- Build script propagates `dependencies` from manifests into marketplace.json `deps` fields
- Version bump script now updates all 26 manifests (prevents build from overwriting bumped versions)

---


## [5.6.0] - 2026-02-01

### Added

- **Memory health check library** (`memory-health.ts`) — Validates JSONL integrity, tier status, queue depths, and file analysis for `/ork:doctor`
- **Memory metrics collector** (`memory-metrics.ts`) — Counts decisions by category/type, queue depths, completed flows; appends timestamped snapshots to `memory-metrics.jsonl`
- **Memory metrics lifecycle hook** (`memory-metrics-collector.ts`) — SessionStart hook that collects and persists memory metrics on every session
