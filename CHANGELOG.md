# Changelog

All notable changes to the OrchestKit Claude Code Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.0](https://github.com/yonatangross/orchestkit/compare/v6.1.1...v7.0.0) (2026-02-20)


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
* CC 2.1.47 full adoption (Milestone [#75](https://github.com/yonatangross/orchestkit/issues/75)) ([#737](https://github.com/yonatangross/orchestkit/issues/737)) ([92fa34e](https://github.com/yonatangross/orchestkit/commit/92fa34eeba178bc8fbf09baf55c15d63a948a3ac))
* CC 2.1.49 full adoption — hooks, agents, MCP overhaul ([#780](https://github.com/yonatangross/orchestkit/issues/780)) ([1234c46](https://github.com/yonatangross/orchestkit/commit/1234c462436aafcfa9027b08d93324db407219e2))
* **cc217:** implement CC 2.1.7 compatibility improvements ([#38](https://github.com/yonatangross/orchestkit/issues/38)) ([fb4f8c5](https://github.com/yonatangross/orchestkit/commit/fb4f8c5a07974d9e3e3886ff2c80956c0db51efd))
* **ci:** cross-platform CI with Node 20/22/24 matrix ([#244](https://github.com/yonatangross/orchestkit/issues/244)) ([e32f6dd](https://github.com/yonatangross/orchestkit/commit/e32f6dd0a13a4522cd115522c435f65001c00e4c))
* close 15 issues across 4 near-complete milestones — v6.0.7 ([#589](https://github.com/yonatangross/orchestkit/issues/589)) ([cb5973e](https://github.com/yonatangross/orchestkit/commit/cb5973e11d7b91aefc63ea337f77524ab98e54ac))
* comprehensive plugin improvements ([#60](https://github.com/yonatangross/orchestkit/issues/60), [#62](https://github.com/yonatangross/orchestkit/issues/62), [#63](https://github.com/yonatangross/orchestkit/issues/63), [#64](https://github.com/yonatangross/orchestkit/issues/64)) ([a0e2e20](https://github.com/yonatangross/orchestkit/commit/a0e2e205fa3376cebffd2615b9e2c4eef83be165))
* **config:** add OrchestKit-branded spinner verbs (CC 2.1.23) ([#288](https://github.com/yonatangross/orchestkit/issues/288)) ([6d09c6b](https://github.com/yonatangross/orchestkit/commit/6d09c6b8fef3fc89defa58782418a1369404fa69)), closes [#287](https://github.com/yonatangross/orchestkit/issues/287)
* **docs:** hooks documentation — architecture guide, spotlights, enriched tables ([#643](https://github.com/yonatangross/orchestkit/issues/643)) ([c1fb086](https://github.com/yonatangross/orchestkit/commit/c1fb086ad6f016a8f372e8684e831cb7e2112b9a))
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
* integrate agentation UI annotation tool ([#640](https://github.com/yonatangross/orchestkit/issues/640)) ([22d7e70](https://github.com/yonatangross/orchestkit/commit/22d7e70cd51770183f3174e1899fd584ad58d757))
* **mcp:** complete MCP Modernization milestone (Feb 2026 Spec Alignment) ([#619](https://github.com/yonatangross/orchestkit/issues/619)) ([1ff1667](https://github.com/yonatangross/orchestkit/commit/1ff1667f48707c2de729c81b2efce7cfeb06292f))
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
* **skills:** add testability to brainstorming + enforce tests in implement ([#630](https://github.com/yonatangross/orchestkit/issues/630)) ([8607440](https://github.com/yonatangross/orchestkit/commit/860744041b194d2f27e6e77ccea3973cc8eba8a9))
* **skills:** CC 2.1.7 skills migration - flat structure ([46a25b2](https://github.com/yonatangross/orchestkit/commit/46a25b20fc866b4072436565ebb9e21b668484e3))
* **skills:** update to February 2026 best practices (v5.7.0) ([#280](https://github.com/yonatangross/orchestkit/issues/280)) ([f594215](https://github.com/yonatangross/orchestkit/commit/f5942150ae324a2d25033646f50c2959fe23b1e6))
* static analysis pipeline ([#517](https://github.com/yonatangross/orchestkit/issues/517)) ([#633](https://github.com/yonatangross/orchestkit/issues/633)) ([6ddd079](https://github.com/yonatangross/orchestkit/commit/6ddd079e152695476113cc811df29ecf918e2dd1))
* Tavily MCP integration, BrightData removal, MCP package fixes ([#614](https://github.com/yonatangross/orchestkit/issues/614)) ([0f1d8eb](https://github.com/yonatangross/orchestkit/commit/0f1d8ebbf96f184b21365cadb3915c00c106bc4f))
* **tests:** functional skill tests for rule traceability and eval completeness ([#631](https://github.com/yonatangross/orchestkit/issues/631)) ([173856a](https://github.com/yonatangross/orchestkit/commit/173856a96b08ffef5c33d1f4a1d1cf39a10b38cc))
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
* analytics noise, agent casing, memory capture, skill nudges (v6.0.22) ([#709](https://github.com/yonatangross/orchestkit/issues/709)) ([5610bcb](https://github.com/yonatangross/orchestkit/commit/5610bcb94f3c18571253ec80b1a123d2b6bc2d55))
* **build:** sync marketplace versions and propagate deps ([#273](https://github.com/yonatangross/orchestkit/issues/273)) ([a22ec94](https://github.com/yonatangross/orchestkit/commit/a22ec94551be8034e1b65814248d57df53581f9a))
* **ci:** Add CHANGELOG 4.20.0 entry and update version references ([9cd5980](https://github.com/yonatangross/orchestkit/commit/9cd5980a4dd67640e2c55e4eb89471c5651bdf86))
* **ci:** comprehensive test coverage and CC 2.1.7 path fixes [v4.15.2] ([924e98e](https://github.com/yonatangross/orchestkit/commit/924e98e48a44e712dcb6ff1c866495ad402eead6))
* **ci:** Correct hook counts and add missing user-invocable fields ([20ce45c](https://github.com/yonatangross/orchestkit/commit/20ce45c228144525dc0cc885699c081e4c826612))
* **ci:** eliminate 12 CI sugarcoating issues, raise coverage thresholds — v6.0.6 ([#558](https://github.com/yonatangross/orchestkit/issues/558)) ([c0d84cd](https://github.com/yonatangross/orchestkit/commit/c0d84cdfdae75819102e41c16b6713e88ff444aa))
* **ci:** Resolve 9 CI failures with count updates and missing files ([20482b6](https://github.com/yonatangross/orchestkit/commit/20482b62cea641f2ffb2f1a6592c6e7a0dbbd3ca))
* **ci:** skip version check for Dependabot PRs ([#758](https://github.com/yonatangross/orchestkit/issues/758)) ([45c850f](https://github.com/yonatangross/orchestkit/commit/45c850fe890ad0a9900361baba8a6ad18c44fadf))
* **ci:** use PAT for release-please to trigger CI on release PRs ([#760](https://github.com/yonatangross/orchestkit/issues/760)) ([5e8c700](https://github.com/yonatangross/orchestkit/commit/5e8c700d3a0d666a13c8f9aba9eb58e9371d7103))
* **ci:** YAML workflows, git-validator, mem0 dedup, pre-push hook — v6.0.3 ([#411](https://github.com/yonatangross/orchestkit/issues/411)) ([ba4b3a8](https://github.com/yonatangross/orchestkit/commit/ba4b3a820fb55e96ee78fb0e0efff928ff83a18a))
* close 11 bugs, prune CLAUDE.md, consolidate PostToolUse hooks — v6.0.5 ([#557](https://github.com/yonatangross/orchestkit/issues/557)) ([b13d685](https://github.com/yonatangross/orchestkit/commit/b13d6859dc1b03b80a25dc6868d308d535e65ccb))
* Complete skill validation and handoff system fixes ([2b830ee](https://github.com/yonatangross/orchestkit/commit/2b830ee32b180d653cbb95c9edd251196f70340e))
* Config system validation and test coverage ([e9213c7](https://github.com/yonatangross/orchestkit/commit/e9213c786e887edebd2798209b76cc90aa5cee16))
* Coordination hook JSON output + dynamic component counting ([#20](https://github.com/yonatangross/orchestkit/issues/20)) ([999939c](https://github.com/yonatangross/orchestkit/commit/999939c1684185536c2a16e8d6fc99f022dd5c97))
* Correct hooks count from 92 to 90 ([#18](https://github.com/yonatangross/orchestkit/issues/18)) ([17c7d65](https://github.com/yonatangross/orchestkit/commit/17c7d659a1db1b29f10698fcc074af0525613218))
* Correct security test filename in CI workflow ([ab9bfe3](https://github.com/yonatangross/orchestkit/commit/ab9bfe3020a829e88dc0fd5d4a2063254795887b))
* **docs:** auto-generate banner counts from shared-data.ts ([#617](https://github.com/yonatangross/orchestkit/issues/617)) ([229c963](https://github.com/yonatangross/orchestkit/commit/229c963bb90bab4d28a29f21b3273c998c968282))
* **docs:** read version from manifest instead of hardcoding ([#592](https://github.com/yonatangross/orchestkit/issues/592)) ([b25005f](https://github.com/yonatangross/orchestkit/commit/b25005f16d1b2de81a07fdff85406eb3d4aaa554))
* **docs:** remove all Mem0 Cloud references, update to 3-tier memory ([#629](https://github.com/yonatangross/orchestkit/issues/629)) ([dd59f64](https://github.com/yonatangross/orchestkit/commit/dd59f64c937cde99305fd06e1af3e1b7ec94ce08))
* **docs:** update stale counts to v6.0.6 — 61 skills, 44 orkl, 36 agents ([#588](https://github.com/yonatangross/orchestkit/issues/588)) ([0a122f6](https://github.com/yonatangross/orchestkit/commit/0a122f64d3507afdacdd981320b3de534b8adfdf))
* eliminate 91 CodeQL alerts + fix 30 pre-existing test failures ([#782](https://github.com/yonatangross/orchestkit/issues/782)) ([ca47641](https://github.com/yonatangross/orchestkit/commit/ca476416b81c217998af5e9b5305b44a4b6ffa8a))
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
* **hooks:** Windows-safe spawning — stop console flashing + ENAMETOOLONG ([#645](https://github.com/yonatangross/orchestkit/issues/645)) ([45372c7](https://github.com/yonatangross/orchestkit/commit/45372c7408fda4d40fba8ba93d2b7eaa8afef16c))
* Include built plugins/ in git for marketplace distribution ([#230](https://github.com/yonatangross/orchestkit/issues/230)) ([449721b](https://github.com/yonatangross/orchestkit/commit/449721bf4b7d3c7a985c0a0082f5d869d6f0f8b1))
* Make all pretool hooks CC 2.1.2 compliant ([b72fd0d](https://github.com/yonatangross/orchestkit/commit/b72fd0dc3280dfec0069045b38108d0d693aca6d))
* Make hooks silent on success, only show errors/warnings ([#24](https://github.com/yonatangross/orchestkit/issues/24)) ([5c352e3](https://github.com/yonatangross/orchestkit/commit/5c352e3310e13a6f96edea8105fe96d2b443cb90))
* Marketplace schema compatibility + cleanup runtime artifacts ([#21](https://github.com/yonatangross/orchestkit/issues/21)) ([dbf16c0](https://github.com/yonatangross/orchestkit/commit/dbf16c0036f69e182c72b612d671dbf0a28c7762))
* **marketplace:** remove deps key rejected by Claude Code schema ([#279](https://github.com/yonatangross/orchestkit/issues/279)) ([a4f36c2](https://github.com/yonatangross/orchestkit/commit/a4f36c2482d1b8774c049639825ee736864677ed))
* **paths:** complete migration to flat skill structure ([8f12814](https://github.com/yonatangross/orchestkit/commit/8f1281487402ececafb2399f8c759e49c03243a9))
* Prevent marketplace auto-install by restructuring plugin architecture ([#227](https://github.com/yonatangross/orchestkit/issues/227)) ([b998f97](https://github.com/yonatangross/orchestkit/commit/b998f97d78fd4db24c3a259baef80a49e41b49f0))
* **recall:** Rename Flags section to Advanced Flags ([7394d47](https://github.com/yonatangross/orchestkit/commit/7394d4750101369ca545c79314a81b1f02cb343d))
* **release:** rewrite release-please for v4 manifest mode ([#752](https://github.com/yonatangross/orchestkit/issues/752)) ([e388c3e](https://github.com/yonatangross/orchestkit/commit/e388c3e87d9616fc50039f50a1e2774ba0a525f9))
* **release:** sync package.json to v6.0.17, fix changelog links ([#641](https://github.com/yonatangross/orchestkit/issues/641)) ([780376e](https://github.com/yonatangross/orchestkit/commit/780376e9f761c0a5959df4d2a67d8a7defd80197))
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
* sync all counts — hooks 86→89, orkl 44→45, ork 61→62, version 6.0.6→6.0.8 ([#615](https://github.com/yonatangross/orchestkit/issues/615)) ([5bc4282](https://github.com/yonatangross/orchestkit/commit/5bc4282120c19e99713415c1d7673b783676353e))
* sync all stale counts and versions to v6.0.13 ([#623](https://github.com/yonatangross/orchestkit/issues/623)) ([f55dc7c](https://github.com/yonatangross/orchestkit/commit/f55dc7cb14c890ec23be3cfbdac0436ff33535c5))
* Sync marketplace.json version to 4.17.2 ([4e29f1b](https://github.com/yonatangross/orchestkit/commit/4e29f1b122d6df65b49765816efb6be23e81b9f1))
* Sync plugin.json with actual .claude structure ([57a0bd1](https://github.com/yonatangross/orchestkit/commit/57a0bd1c67f787f1cef9671eecc9b9b9d4245018))
* Sync plugin.json with actual .claude structure ([204d4f5](https://github.com/yonatangross/orchestkit/commit/204d4f558b795bac20bef02b7b6260f4c63163ee))
* **tests:** --lint flag no longer runs skill/subagent tests ([1ff1667](https://github.com/yonatangross/orchestkit/commit/1ff1667f48707c2de729c81b2efce7cfeb06292f))
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


### Miscellaneous

* Add .claude/session/* to gitignore ([67de2bf](https://github.com/yonatangross/orchestkit/commit/67de2bf9e3d55e65cf2cf2454616f82c1a6faa9e))
* add MCP configuration templates ([a843ec0](https://github.com/yonatangross/orchestkit/commit/a843ec0caafe5ff8a49dea46517e3e086f130f4e))
* Add Python 3.13 config and fix hook stdin handling ([07aa200](https://github.com/yonatangross/orchestkit/commit/07aa2004e8bbc3852aafc19afda59268b8a63718))
* bump to v6.0.1 ([6550953](https://github.com/yonatangross/orchestkit/commit/6550953c0e3138d2df4e1bcbfcc3a185d429cfad))
* bump version to 4.11.1 ([43a7753](https://github.com/yonatangross/orchestkit/commit/43a77533344821c4a15f7380e073d4af1c818ed7))
* Bump version to 4.6.7 ([#28](https://github.com/yonatangross/orchestkit/issues/28)) ([2afefc5](https://github.com/yonatangross/orchestkit/commit/2afefc5a02fc363f209320643740a78b8080fc8b))
* bump version to 4.7.2 and fix version alignment ([#33](https://github.com/yonatangross/orchestkit/issues/33)) ([70585ba](https://github.com/yonatangross/orchestkit/commit/70585bafef63355cedfdafefc6209dbb5b13863b))
* **cleanup:** remove capabilities.json and progressive loading remnants ([1f1f5f9](https://github.com/yonatangross/orchestkit/commit/1f1f5f9088648feb7fda79e9c3da4bdb5cc95de0))
* **deps-dev:** bump hono ([#761](https://github.com/yonatangross/orchestkit/issues/761)) ([fdc6f69](https://github.com/yonatangross/orchestkit/commit/fdc6f6916abebe40ef923a531b85d31c8b72b8dd))
* Ignore satisfaction counter (runtime state) ([6d8d497](https://github.com/yonatangross/orchestkit/commit/6d8d497276ee6bbfa48cc6e20f4924f092a4ab50))
* **main:** release 6.0.25 ([#762](https://github.com/yonatangross/orchestkit/issues/762)) ([fcf29d4](https://github.com/yonatangross/orchestkit/commit/fcf29d4f8b33b14d386a883267a5519cf0227326))
* **main:** release 6.0.26 ([#763](https://github.com/yonatangross/orchestkit/issues/763)) ([c2992b7](https://github.com/yonatangross/orchestkit/commit/c2992b786d2dc0235b3b2c445b268d5174bd1583))
* **main:** release 6.1.0 ([#781](https://github.com/yonatangross/orchestkit/issues/781)) ([9ba1d5d](https://github.com/yonatangross/orchestkit/commit/9ba1d5d2f53235a7d1e0ef0dbdcf132aa190b950))
* remove deprecated files and symlinks ([#31](https://github.com/yonatangross/orchestkit/issues/31)) ([ec33094](https://github.com/yonatangross/orchestkit/commit/ec33094c450300599f6b3c74356e07b1cefc4ae3))
* Remove redundant design docs ([28cb19a](https://github.com/yonatangross/orchestkit/commit/28cb19ab583a474fa5348a493dc0c329b3cda282))
* sync generated plugins/ with source changes ([30dd262](https://github.com/yonatangross/orchestkit/commit/30dd2628af1954c7bfc40d3b968d0cee460a63a0))
* Untrack satisfaction counter file ([875fd12](https://github.com/yonatangross/orchestkit/commit/875fd129320323a032b7719b2eb2fd1b3e56e7c1))
* Update agent token limits and register new hooks ([ef9a928](https://github.com/yonatangross/orchestkit/commit/ef9a9288a2f0d8923040f656b9656685555c63e4))


### Documentation

* Add configuration system to README ([#16](https://github.com/yonatangross/orchestkit/issues/16)) ([c099ba8](https://github.com/yonatangross/orchestkit/commit/c099ba8acecab12e38f38e61158d15523b3d3af2))
* Add marketplace submission badges to README ([d301842](https://github.com/yonatangross/orchestkit/commit/d301842fca92c71c0e3cecd266b096643c601974))
* Add Tier 3 reference files for LangGraph skills ([ecf2cb0](https://github.com/yonatangross/orchestkit/commit/ecf2cb074780e9f83737f5d9cef8b8b66c727c27))
* Add Tier 3 references for security and architecture skills ([99640fc](https://github.com/yonatangross/orchestkit/commit/99640fcd5ecc263e55b824f3abf8dcef6d5e0979))
* Add Tier 3/4 files for AI and data skills ([991fc21](https://github.com/yonatangross/orchestkit/commit/991fc2100af80c39465f2580da8266bc349b1ba6))
* Add Tier 3/4 files for testing skills ([0130be1](https://github.com/yonatangross/orchestkit/commit/0130be1358071d302d6dbc951f4d2e9926dc2de0))
* add troubleshooting FAQ for plugin installation issues ([21d1974](https://github.com/yonatangross/orchestkit/commit/21d1974850030bd88a70ed343fa129ebc43abb66))
* Add v4.6.2 to CHANGELOG.md with CC 2.1.2 and 138 tests ([425a42d](https://github.com/yonatangross/orchestkit/commit/425a42dfe162ce3c1af9ae3b3bba918ea3e13ca5))
* fix plugin installation commands ([#35](https://github.com/yonatangross/orchestkit/issues/35)) ([7e240b0](https://github.com/yonatangross/orchestkit/commit/7e240b0bb90ef0d50ac173f0b0a0ba28f24a836f))
* **readme:** add animated Playgrounds demo GIF ([1214fa0](https://github.com/yonatangross/orchestkit/commit/1214fa05d7a4aead96923e3429d792b675819d88))
* **readme:** add Playgrounds preview image ([9da6534](https://github.com/yonatangross/orchestkit/commit/9da6534eda35f6014cb7cc24200e1be25f46b14d))
* **readme:** Complete overhaul for clarity and accuracy ([#172](https://github.com/yonatangross/orchestkit/issues/172)) ([0275afd](https://github.com/yonatangross/orchestkit/commit/0275afdca33b1bb621dd1c309271322e8dcf9a38))
* **readme:** update counts and add playgrounds for v5.5.0 ([#268](https://github.com/yonatangross/orchestkit/issues/268)) ([f7f0f06](https://github.com/yonatangross/orchestkit/commit/f7f0f060ae38d7d9e3aa1d4c51307ff1128f04bf))
* **readme:** update to v4.15.2 with 105 hooks, 88 CI tests ([0af134f](https://github.com/yonatangross/orchestkit/commit/0af134f57100440ee1e5c92a0f36fc484a76ab3c))
* **readme:** update to v4.17.0 with CC 2.1.9 features ([#67](https://github.com/yonatangross/orchestkit/issues/67)) ([7d79169](https://github.com/yonatangross/orchestkit/commit/7d791696c3dc6e5da0d93399b41f4c8c71a329fd))
* Replace external logo with local image ([1a17bbf](https://github.com/yonatangross/orchestkit/commit/1a17bbfe1a96a42c2a71ea3b6e6a72854fb7358c))
* Replace external logo with local image ([86d8ea7](https://github.com/yonatangross/orchestkit/commit/86d8ea7278c3d0375bebe051e81f5241926dc8d0))
* slim README, fix Playgrounds data & logo, add CI tests ([#269](https://github.com/yonatangross/orchestkit/issues/269)) ([7d1c580](https://github.com/yonatangross/orchestkit/commit/7d1c580b3bc5a04c66ca2ad167d2012b395588e1))
* sync documentation counts to 197 skills, 36 agents, 117 hooks ([a644070](https://github.com/yonatangross/orchestkit/commit/a644070e16ee46d1a3a219bbb6ed39dd96f10947))
* Update CLAUDE.md counts to match actual (72 skills, 89 hooks) ([1415bd1](https://github.com/yonatangross/orchestkit/commit/1415bd1e1f3e8ad25be5c41f6b3863070b8ad779))
* update hook architecture for CC 2.1.7 refactoring ([52f21bd](https://github.com/yonatangross/orchestkit/commit/52f21bdf5653ea1afc1871ea8f84e3938b4451a4))
* Update hook count to 92 in README ([bb53269](https://github.com/yonatangross/orchestkit/commit/bb53269f46cc762f6b1ef2a6d08abefafca46ac9))
* Update hook count to 92 in README ([045eef8](https://github.com/yonatangross/orchestkit/commit/045eef87c74b0a4a63cb63067cab05475f42878c))
* Update marketplace status and fix counts ([fff1eff](https://github.com/yonatangross/orchestkit/commit/fff1eff788e63f0cc4386d71e33c0532b4e27665))
* Update plugin.json to PostgreSQL 18+ ([0801ae7](https://github.com/yonatangross/orchestkit/commit/0801ae733ac44af8caccf56cb61e7db27bfb3133))
* Update plugin.json to PostgreSQL 18+ ([d29964a](https://github.com/yonatangross/orchestkit/commit/d29964abdd44f65f4abff92635b897a437951d79))
* Update README for reorganized skill structure ([f2116fb](https://github.com/yonatangross/orchestkit/commit/f2116fbe228dea9383459d2deaa192a4ee04c86b))
* Update README for reorganized skill structure ([15c6e8c](https://github.com/yonatangross/orchestkit/commit/15c6e8cf1bb3b6f7b04446297af16083a24d0110))
* update README hook count 144 → 149 ([52940a4](https://github.com/yonatangross/orchestkit/commit/52940a471d6efcc34920fc77583bca82041d6bd9))
* update README marketplace screenshot for v6.0.0 ([5cff0d4](https://github.com/yonatangross/orchestkit/commit/5cff0d41c005e9e8c91c14509bc8ef4fa4c1f45f))
* Update skill count to 115 after Backend Skills 2026 milestone ([5ae959e](https://github.com/yonatangross/orchestkit/commit/5ae959e3f1bc20044052ceaa83f39fb303a4b3bd))
* Update skill counts to 134 (129→134) ([4fc2852](https://github.com/yonatangross/orchestkit/commit/4fc285240075af127087a046e6b71b37d75e48b7))


### Code Refactoring

* **agents:** CC 2.1.7 compliance - fix dead hooks, improve routing ([646b50a](https://github.com/yonatangross/orchestkit/commit/646b50abac03fb58cd66f30b5eb79dd9f7ca6770))
* Consolidate plugin to single source of truth ([a6a87da](https://github.com/yonatangross/orchestkit/commit/a6a87dabf9ee189db1af918a2118ba15f385a4c4))
* **hooks:** CC 2.1.7 hook architecture overhaul ([#65](https://github.com/yonatangross/orchestkit/issues/65)) ([d0bcce5](https://github.com/yonatangross/orchestkit/commit/d0bcce576c9af330e64f1157e488bd195303377e))
* **hooks:** complete CC 2.1.7 dispatcher elimination ([16ed73d](https://github.com/yonatangross/orchestkit/commit/16ed73d612049a8f4f4b29b949647545206797bb))
* **hooks:** consolidate to 24 hooks + v4.11.0 ([#36](https://github.com/yonatangross/orchestkit/issues/36)) ([e844b4b](https://github.com/yonatangross/orchestkit/commit/e844b4b25d0da25b3cd635d5573690a05ec0a2d9))
* **hooks:** remove SessionEnd/Stop dispatchers for CC 2.1.7 ([fb989c1](https://github.com/yonatangross/orchestkit/commit/fb989c1bcad18a7c2c28abd9ef90ce9e95392cb4))
* **hooks:** remove SessionStart/UserPromptSubmit dispatchers ([39bd499](https://github.com/yonatangross/orchestkit/commit/39bd49996b250dd4684e607fda9c34352259517e))
* **mem0:** Implement Memory Fabric v2.1 graph-first architecture ([a88b545](https://github.com/yonatangross/orchestkit/commit/a88b54519f66f5461f0f7a0ee8a34582639e8fa0))
* migrate commands to CC 2.1.6 skill format ([#49](https://github.com/yonatangross/orchestkit/issues/49)) ([39129af](https://github.com/yonatangross/orchestkit/commit/39129af90258579cb126b63c2d0d3b1673227d5b))
* Reorganize .claude skills from skillforge ([279c9e5](https://github.com/yonatangross/orchestkit/commit/279c9e528a9f614954c64720fea3a01a5c9e1c95))
* **skills:** CC 2.1.7 compliance - remove dead hooks, add evaluations ([203c48c](https://github.com/yonatangross/orchestkit/commit/203c48cc3c293898a5e8bad74b58757fcf4fac3e))
* **skills:** extract inline content from 5 bloated SKILL.md files ([#621](https://github.com/yonatangross/orchestkit/issues/621)) ([967c493](https://github.com/yonatangross/orchestkit/commit/967c493d8d14242bb05fd049013c0731489c0efb))
* **skills:** Optimize Phase 2 skills for CC 2.1.7 token budget ([6172120](https://github.com/yonatangross/orchestkit/commit/6172120c62bd2c465f93c39fb1960e98b1244209))
* **skills:** split 14 verbose skills to comply with CC 2.1.7 &lt;500 line limit ([d9204dd](https://github.com/yonatangross/orchestkit/commit/d9204dde585b3980e4a686d15120dc296a6d15b8))
* **structure:** CC 2.1.7 compliance - flatten skills, remove redundant context ([99bd80d](https://github.com/yonatangross/orchestkit/commit/99bd80d3228b9c21abc97064fccccf75e7bb0d25))


### Performance

* **#200:** Complete lifecycle hooks TS delegation + remove _lib ([#201](https://github.com/yonatangross/orchestkit/issues/201)) ([1c84339](https://github.com/yonatangross/orchestkit/commit/1c843397d3648d5cfce21fe0d7e240018260e2a9))
* **hooks:** optimize SessionStart and PromptSubmit latency ([09fb786](https://github.com/yonatangross/orchestkit/commit/09fb78631e09d011518f57e89ea9ee23eedab961))
* **hooks:** parallelize all major dispatchers for 2-3x faster execution ([d4097b5](https://github.com/yonatangross/orchestkit/commit/d4097b58c94a3f1f05847d03ea73f21007120229))
* **hooks:** TypeScript/ESM migration for 2-5x performance ([#196](https://github.com/yonatangross/orchestkit/issues/196)) ([#186](https://github.com/yonatangross/orchestkit/issues/186)) ([741fccb](https://github.com/yonatangross/orchestkit/commit/741fccbf6f088c33f2e4d7715a9d5e09a22573b3))


### CI/CD

* 2026 best practices — permissions, CodeQL, SLSA, merge queue ([57ca595](https://github.com/yonatangross/orchestkit/commit/57ca595f27295787c33ed47bbb35e7472d7db88d))
* Add centralized CI setup and release-please automation ([0017333](https://github.com/yonatangross/orchestkit/commit/0017333562e577ac1dc4b3d14c666f496959a49f))
* bump actions/download-artifact from 5.0.0 to 7.0.0 ([#755](https://github.com/yonatangross/orchestkit/issues/755)) ([c28f49b](https://github.com/yonatangross/orchestkit/commit/c28f49b0b8a7c7dc7ee80a3cfeb969f79d8fb387))
* bump actions/upload-artifact from 5.0.0 to 6.0.0 ([#753](https://github.com/yonatangross/orchestkit/issues/753)) ([4a4f9e0](https://github.com/yonatangross/orchestkit/commit/4a4f9e0d8eb1a56f3c6551798695cc8422ad61ce))
* bump gitleaks/gitleaks-action ([#756](https://github.com/yonatangross/orchestkit/issues/756)) ([b929e1b](https://github.com/yonatangross/orchestkit/commit/b929e1b872268f02b64a42a5e75bf9b5b60e4f86))
* bump googleapis/release-please-action ([#754](https://github.com/yonatangross/orchestkit/issues/754)) ([8028579](https://github.com/yonatangross/orchestkit/commit/8028579b5178e18d08c9278fcce575e32e332d9d))
* comprehensive CI/CD improvements for Feb 2026 ([#289](https://github.com/yonatangross/orchestkit/issues/289)) ([56cb775](https://github.com/yonatangross/orchestkit/commit/56cb775fba5e758b0911963bd78fd3eeefc6b94b))

## [6.1.1] - 2026-02-20

### Fixed

- TODO: Describe your changes here

---


## [6.1.0](https://github.com/yonatangross/orchestkit/compare/v6.0.26...v6.1.0) (2026-02-20)


### Features

* CC 2.1.49 full adoption — hooks, agents, MCP overhaul ([#780](https://github.com/yonatangross/orchestkit/issues/780)) ([1234c46](https://github.com/yonatangross/orchestkit/commit/1234c462436aafcfa9027b08d93324db407219e2))

## [6.0.27] - 2026-02-20

### Security

- Eliminate 30 CodeQL ReDoS vulnerabilities (js/polynomial-redos) across 12 hook files
- Replace polynomial-time regex patterns with O(n) string operations
- Dismiss 1 Dependabot alert (ajv ReDoS in demo project — tolerable risk)

## [6.0.26](https://github.com/yonatangross/orchestkit/compare/v6.0.25...v6.0.26) (2026-02-20)


### Miscellaneous

* **deps-dev:** bump hono ([#761](https://github.com/yonatangross/orchestkit/issues/761)) ([fdc6f69](https://github.com/yonatangross/orchestkit/commit/fdc6f6916abebe40ef923a531b85d31c8b72b8dd))


### CI/CD

* 2026 best practices — permissions, CodeQL, SLSA, merge queue ([57ca595](https://github.com/yonatangross/orchestkit/commit/57ca595f27295787c33ed47bbb35e7472d7db88d))

## [6.0.25](https://github.com/yonatangross/orchestkit/compare/v6.0.24...v6.0.25) (2026-02-19)


### Bug Fixes

* **ci:** skip version check for Dependabot PRs ([#758](https://github.com/yonatangross/orchestkit/issues/758)) ([45c850f](https://github.com/yonatangross/orchestkit/commit/45c850fe890ad0a9900361baba8a6ad18c44fadf))
* **ci:** use PAT for release-please to trigger CI on release PRs ([#760](https://github.com/yonatangross/orchestkit/issues/760)) ([5e8c700](https://github.com/yonatangross/orchestkit/commit/5e8c700d3a0d666a13c8f9aba9eb58e9371d7103))


### CI/CD

* bump actions/download-artifact from 5.0.0 to 7.0.0 ([#755](https://github.com/yonatangross/orchestkit/issues/755)) ([c28f49b](https://github.com/yonatangross/orchestkit/commit/c28f49b0b8a7c7dc7ee80a3cfeb969f79d8fb387))
* bump actions/upload-artifact from 5.0.0 to 6.0.0 ([#753](https://github.com/yonatangross/orchestkit/issues/753)) ([4a4f9e0](https://github.com/yonatangross/orchestkit/commit/4a4f9e0d8eb1a56f3c6551798695cc8422ad61ce))
* bump gitleaks/gitleaks-action ([#756](https://github.com/yonatangross/orchestkit/issues/756)) ([b929e1b](https://github.com/yonatangross/orchestkit/commit/b929e1b872268f02b64a42a5e75bf9b5b60e4f86))
* bump googleapis/release-please-action ([#754](https://github.com/yonatangross/orchestkit/issues/754)) ([8028579](https://github.com/yonatangross/orchestkit/commit/8028579b5178e18d08c9278fcce575e32e332d9d))

## [6.0.24] - 2026-02-19

### Fixed

- **Release automation** — rewrite release-please for v4 manifest mode; was failing on every push to main since v6.0.17 due to invalid inline params (`package-name`, `changelog-types`, `extra-files` silently ignored by v4)
- **Version sync** — create `version.txt` + `.release-please-config.json` with jsonpath for `package.json` and `marketplace.json` auto-update
- **Version drift** — sync package.json 6.0.20 and manifest 4.27.5 to match CHANGELOG 6.0.23
- **version-check** — skip validation for release-please automated PRs

---


## [6.0.23] - 2026-02-19

### Added

- **CC 2.1.47 Full Adoption** — Milestone #75 (19 issues: #710–#728)
- **`cc-version-matrix.ts`** — runtime feature compatibility matrix for 18 CC 2.1.47 features (`last_assistant_message`, `added_dirs`, deferred SessionStart, agent model in teams, worktree discovery, etc.)
- **`added_dirs` support** — `session-tracking`, `session-cleanup`, `session-context-loader`, `memory-capture`, and `monorepo-detector` hooks now read and log the new `added_dirs` hook input field
- **`last_assistant_message` support** — `memory-capture` uses `classifySessionOutcome()` for richer analytics; `session-cleanup` and `unified-dispatcher` log `last_msg_len`
- **Prefill-guard caching** — scan results cached for 24 hours with `CACHE_VERSION` invalidation, skipping expensive filesystem scans on repeat sessions
- **Worktree discovery tests** — 15 vitest path-resolution tests + 17 shell tests with real `git worktree add` creation/cleanup
- **Agent model field validation** — shell test validates all 37 agents have valid `model:` field for CC 2.1.47 team spawns
- **`hook-input-fields.test.ts`** — validates `added_dirs` type contract and confirms `enabledPlugins` is NOT a hook field
- **`configure` skill** — documents `added_dirs`, clarifies `enabledPlugins` is CC-internal (not hook-accessible)
- **`help` skill** — CC 2.1.47 keyboard shortcuts section (Ctrl+F, Shift+Down)
- **`upgrade-assessment`** — CC 2.1.47 upgrade guide reference

### Fixed

- **Cross-platform `/tmp` hardcode** — 13 hook source files migrated from `/tmp/claude-*` to `paths.ts` helpers using `os.tmpdir()` and `path.join()` (#720)
- **`ork:` prefix standardization** — ~120 violations fixed across 60 skill files for consistent cross-referencing (#716)
- **Test assertions** — 8 test files updated for `os.tmpdir()` compatibility (macOS `/var/folders/.../T/` vs Linux `/tmp`)
- **`node:path` mock** — test files now include proper default export when mocking `node:path`
- **User-invocable count** — `EXPECTED_USER_INVOCABLE` updated 24→28 in skill validation test

---


## [6.0.22] - 2026-02-18

### Added

- **Hook: `memory-capture`** — new Stop hook that auto-captures session summaries to `~/.claude/memory/decisions.jsonl` for sessions with >20 tool calls; nudges `/ork:remember` for sessions with >50 tool calls (#708)
- **Hook: `skill-nudge` (PostToolUse/Bash)** — nudges `/ork:create-pr` after a successful `git push` (#705)
- **Hook: `skill-nudge` (UserPromptSubmit)** — nudges `/ork:fix-issue` when a GitHub issue URL is detected in the prompt (#705)
- **Hook: `task-agent-advisor`** — PreToolUse[Task] hook that suggests curated ork agents for 14 common ad-hoc agent names and corrects 4 built-in casing errors (#704 #706)

### Fixed

- **Analytics: zero-tool sessions** — session-cleanup no longer writes to `session-summary.jsonl` when `total_tools == 0`, eliminating 57% noise from short/failed sessions (#707)
- **Cross-platform: `/tmp` hardcode** — session-cleanup and memory-capture now use `getMetricsFile()` (via `os.tmpdir()`) instead of hardcoded `/tmp/claude-session-metrics.json` (#704)
- **Analytics: jq-queries** — session count query now filters `total_tools > 0` to match corrected analytics data (#707)
- **Tests: agent casing** — `tests/unit/test-pretool-all-hooks.sh` corrected `"explore"` → `"Explore"` per CC 2.1.45 built-in naming spec (#704)

---


## [6.0.20] - 2026-02-18

### Added

- **Hook: `mcp-health-check`** — new SessionStart hook that silently detects MCP misconfigurations at session start: warns if Tavily is enabled but `TAVILY_API_KEY` is unset, or if agentation is enabled but `agentation-mcp` package is not installed. Respects `ORCHESTKIT_SKIP_SLOW_HOOKS=1`.
- **Skill: `github-operations`** — new `references/cli-vs-api-identifiers.md` mapping gh CLI identifiers (NAME) to REST API identifiers (NUMBER/node_id) for milestones, issues, PRs, and Projects v2 (#701)
- **Static analysis: Section E** — `scripts/eval/static-analysis.sh` now enforces CLI-vs-API identifier documentation for any skill mixing `--milestone` CLI flags with REST API milestone paths

### Fixed

- **Windows: console flashing** — fix fire-and-forget hooks spawning visible `cmd.exe` windows (`detached: true` → `detached: false` + `unref()`) (#644)
- **Windows: ENAMETOOLONG** — use `os.tmpdir()` for hook work files instead of deep project-dir paths (79 errors/session eliminated)
- **MCP defaults** — Tavily and agentation are now `"disabled": true` in `.mcp.json`; users opt in explicitly to avoid surprise API costs
- **MCP docs** — configure skill, doctor skill, installation.mdx, configuration.mdx, faq.mdx all updated to reflect accurate MCP status and setup instructions (#702)
- **github-operations: `--milestone` footgun** — explicit warning that `gh issue edit --milestone` takes a NAME (string), not a number; REST API uses NUMBER (#699)
- **issue-progress-tracking: close-on-merge rule** — added as Common Mistake #5; issues close only via `Closes #N` in PR body on merge, never via `gh issue close` directly

### Improved

- **Skill: `github-operations`** — batch issue creation pattern with array-driven loop and captured issue number (#700); Best Practice #9 (never close issues directly)
- **Skill: `issue-progress-tracking`** — close-on-merge workflow documented in Common Mistakes
- **Extract `spawn-worker.mjs`** — shared helper reduces 7 duplicated entry points (7 × 57 → 7 × 17 lines)
- **Cursor compat note** — `marketplace.json` documents why Cursor misreads `author` field as MCP server (#698)

---


## [6.0.19] - 2026-02-17

### Fixed

- **Hook: `memory-capture`** — new Stop hook that auto-captures session summaries to `~/.claude/memory/decisions.jsonl` for sessions with >20 tool calls; nudges `/ork:remember` for sessions with >50 tool calls (#708)
- **Hook: `skill-nudge` (PostToolUse/Bash)** — nudges `/ork:create-pr` after a successful `git push` (#705)
- **Hook: `skill-nudge` (UserPromptSubmit)** — nudges `/ork:fix-issue` when a GitHub issue URL is detected in the prompt (#705)
- **Hook: `task-agent-advisor`** — PreToolUse[Task] hook that suggests curated ork agents for 14 common ad-hoc agent names and corrects 4 built-in casing errors (#704 #706)

### Fixed

- **Analytics: zero-tool sessions** — session-cleanup no longer writes to `session-summary.jsonl` when `total_tools == 0`, eliminating 57% noise from short/failed sessions (#707)
- **Cross-platform: `/tmp` hardcode** — session-cleanup and memory-capture now use `getMetricsFile()` (via `os.tmpdir()`) instead of hardcoded `/tmp/claude-session-metrics.json` (#704)
- **Analytics: jq-queries** — session count query now filters `total_tools > 0` to match corrected analytics data (#707)
- **Tests: agent casing** — `tests/unit/test-pretool-all-hooks.sh` corrected `"explore"` → `"Explore"` per CC 2.1.45 built-in naming spec (#704)

---


## [6.0.18] - 2026-02-17

### Fixed

- Sync `package.json` version from 6.0.12 to 6.0.18 (was drifted from manifests)
- Create 19 missing git tags for all historical versions (v5.2.4 through v6.0.17)
- Fix all changelog compare links to resolve to valid tag comparisons
- Update `[Unreleased]` link to point to `v6.0.18...HEAD`

---


## [6.0.17] - 2026-02-17

### Added

- CI: Add `manifest-schema-tests` job (manifests, schemas, hooks, indexes)
- CI: Add `eval-static` job running `npm run eval:static` with artifact upload
- CI: Add build drift detection (`git diff --quiet plugins/`) to `build-plugins` job

### Fixed

- Rename `validate-evaluations.sh` → `test-validate-evaluations.sh` so CI test discovery (`test-*.sh` pattern) finds it
- Fix `test-agent-categories.sh`: add `research` to valid categories list
- Fix `test-category-grouping.sh`: update stale agent name, add missing agent/category mappings, fix category order

### Removed

- Delete stale `test-json-output-compliance.sh` (hooks migrated to TypeScript, tested via vitest)
- Delete stale `test-build-marketplace-sync.sh` (marketplace sync logic removed from build script)

---

## [6.0.16] - 2026-02-16

### Added

- Add `impactDescription` and `tags` metadata to 98 rule files across 9 skills
- Add `**Incorrect**`/`**Correct**` code example pairs to all 258 rules missing them
- Rule example coverage now 412/412 (100%)

### Fixed

- Fix 5 skill structure warnings (missing Overview/Related Skills sections)
- Resolve all 459 skill test warnings (196 metadata + 258 code examples + 5 structure)

---


## [6.0.15] - 2026-02-16

### Added

- Rule traceability test: validates test case → rule file → content chain across 28 skills
- Eval completeness test: validates consistency between test-cases.json and .eval.json formats
- Skill efficiency scorecard: JSON metrics (rule count, imperative instructions, code examples, specificity ratio) for all 62 skills
- `npm run test:skills:functional` script for running functional tests

### Fixed

- Corrected rule field mappings in 8 test-cases.json files (39 broken references → actual rule filenames or null)

---


## [6.0.14] - 2026-02-16

### Fixed

- Remove all Mem0 Cloud references from 24 docs files — 4-tier → 3-tier memory architecture
- Delete leftover mem0 artifacts (.claude/mem0-webhooks.json, mem0-queue.jsonl, logs)
- Clean .gitignore and mypy.ini of mem0 entries
- Fix stale hook count in choosing-a-plugin.mdx (86 → 89)

---


## [6.0.13] - 2026-02-15

### Fixed

- **Version sync**: package.json 6.0.9 → 6.0.13 to match manifests/pyproject.toml
- **CLAUDE.md**: version 6.0.8 → 6.0.13, hook bundles 11 → 12
- **marketplace.json**: engine >=2.1.33 → >=2.1.34
- **README**: orkl skill count 62 → 45, ork-creative 62 → 3
- **CONTRIBUTING**: orkl 44 → 45 skills, hooks 98 → 89, bundles 11 → 12
- **Doctor skill**: version 5.4.0 → 6.0.13, CC min 2.1.16 → 2.1.34, hooks 22 → 66 entries, bundles 11 → 12, agents 35 → 36, skills 186 → 62, all reference files updated
- **Hooks README**: 93 → 89 hooks, 11 → 12 bundles, CC 2.1.33 → 2.1.34
- **Docs site**: installation orkl 44 → 45, command-skills 23 → 24, troubleshooting bundles 11 → 12
- **Demo files**: all 6 component files updated with current counts (62 skills, 36 agents, 89 hooks)

---


## [6.0.11] - 2026-02-15

### Fixed

- Guard against image paste killing context window — 3-layer defense: stdin cap (512KB), prompt length guard (50K), image/binary detection ([#620](https://github.com/yonatangross/orchestkit/issues/620))
- Correct orkl skill count in marketplace.json (62 → 45)

### Changed

- Rewrote `mcp-patterns` SKILL.md for 2025-11-25 MCP spec + AAIF governance ([#613](https://github.com/yonatangross/orchestkit/issues/613))
- Updated `_sections.md` with 7 categories (14 rules) and priority levels
- Updated agent skill-indexes for ai-safety-auditor, llm-integrator, security-auditor
- Regenerated docs site pages and generated data files

---


## [6.0.9] - 2026-02-15

### Fixed

- Sync all component counts across docs, README, CLAUDE.md, marketplace.json, and tests
- Hook count 86→89 (3 new hooks from issue-driven git workflow)
- Plugin skill counts: orkl 44→45, ork 61→62
- Version reference 6.0.6→6.0.9 in CLAUDE.md
- Fix "0 hooks" in README and CLAUDE.md hero line
- Update docs-data.test.ts hardcoded assertions to match current counts
- Close milestones [#56](https://github.com/yonatangross/orchestkit/milestone/56) (Documentation Site) and [#68](https://github.com/yonatangross/orchestkit/milestone/68) (Issue-Driven Git)

---


## [6.0.7] - 2026-02-14

### Added

- 9 test-cases.json files for orchestration skills (commit, review-pr, fix-issue, implement, explore, create-pr, verify, assess, git-workflow) — 39 test cases total ([#563](https://github.com/yonatangross/orchestkit/issues/563))
- Skill triggering test suite with trigger-cases.yaml + keyword overlap scoring ([#571](https://github.com/yonatangross/orchestkit/issues/571))
- Rule validation test for YAML frontmatter compliance ([#543](https://github.com/yonatangross/orchestkit/issues/543))
- "When NOT to Use" tier matrices for architecture-patterns, DDD, distributed-systems ([#532](https://github.com/yonatangross/orchestkit/issues/532))
- Interview/take-home mode (STEP 0c) in implement skill ([#533](https://github.com/yonatangross/orchestkit/issues/533))
- 5 new scripts: validate-conventional.sh, check-plugin-health.sh, scaffold-test.sh, scan-vulnerabilities.sh, run-lint-check.sh ([#565](https://github.com/yonatangross/orchestkit/issues/565))
- Edit > Write memory pattern in memory + remember skills ([#546](https://github.com/yonatangross/orchestkit/issues/546))
- Lazy loading wrappers for SkillBrowser, DemoGallery, AgentSelector ([#438](https://github.com/yonatangross/orchestkit/issues/438))
- Docs CI workflow for auto-rebuild on src/ changes ([#402](https://github.com/yonatangross/orchestkit/issues/402))
- Shared category-colors.ts palette for consistent UI ([#439](https://github.com/yonatangross/orchestkit/issues/439))
- Database selection rule + 4 references in database-patterns ([#535](https://github.com/yonatangross/orchestkit/issues/535))
- Railway deployment rule + 3 references in devops-deployment ([#550](https://github.com/yonatangross/orchestkit/issues/550))
- Messaging integrations rule + 3 references in api-design ([#551](https://github.com/yonatangross/orchestkit/issues/551))
- Payload CMS rule + 3 references in api-design ([#552](https://github.com/yonatangross/orchestkit/issues/552))

### Fixed

- Replaced ~50 hardcoded hex colors with fd-* design tokens in docs site ([#440](https://github.com/yonatangross/orchestkit/issues/440))
- Fixed category color inconsistencies: ai (emerald→cyan), devops (violet→orange), research (indigo→teal) ([#439](https://github.com/yonatangross/orchestkit/issues/439))
- Added aria-live="polite" on copy button feedback ([#440](https://github.com/yonatangross/orchestkit/issues/440))

---


## [6.0.6] - 2026-02-14

### Added

- **Hooks**: Add type-error-indexer SessionStart hook — caches `tsc --noEmit` errors for agent awareness ([#304](https://github.com/yonatangross/orchestkit/issues/304))
- **Skills**: Extract 27 rules from 7 reference-only tech skills ([#559](https://github.com/yonatangross/orchestkit/issues/559))
- **Skills**: Add YAGNI gate to quality-gates, context-aware architecture-patterns ([#530](https://github.com/yonatangross/orchestkit/issues/530), [#531](https://github.com/yonatangross/orchestkit/issues/531))
- **Skills**: Add scope-appropriate-architecture skill ([#528](https://github.com/yonatangross/orchestkit/issues/528), [#529](https://github.com/yonatangross/orchestkit/issues/529))

### Changed

- **Agents**: Rename performance-engineer → frontend-performance-engineer to avoid confusion with python-performance-engineer ([#587](https://github.com/yonatangross/orchestkit/issues/587))
- **CLAUDE.md**: Update CC format reference from 2.1.6 to 2.1.34 ([#515](https://github.com/yonatangross/orchestkit/issues/515))

### Fixed

- **CI**: Raise vitest coverage thresholds (40/45/30/40 → 70/72/65/70), target 80%
- **CI**: Raise hook coverage threshold (20% → 75%), fix detection to match .js imports
- **CI**: Pin 6 unpinned actions in eval-index-effectiveness.yml to SHA
- **CI**: Fix version-check.yml to detect manifest/workflow file changes
- **CI**: Add graduated coverage penalties and skip/lint penalties to CI report scoring
- **CI**: Fix Job Summary to render ci-report.md inline
- **CI**: Include dispatchers in hook coverage count
- **Tests**: Delete dead test-hooks-unit.sh (all 6 hooks migrated to TS, every test SKIPped)
- **Tests**: Remove 21 aspirational test.skip blocks from user-tracking-wiring.test.ts
- **Tests**: Delete unused parallel mode from run-tests.sh (had bug assuming 100% pass)
- **Tests**: Report vitest pass/fail/skip counts in run-all-tests.sh
- **Docs**: Fix CLAUDE.md hook count (65 → 63 global, matches hooks.json)
- **Docs**: Fix markdownlint warnings in golden-dataset and release-management skills
- **Docs**: Replace unsupported gitattributes language with text for Shiki

---


## [6.0.5] - 2026-02-13

### Fixed

- **Bugs**: Close 11 open issues ([#417](https://github.com/yonatangross/orchestkit/issues/417), [#418](https://github.com/yonatangross/orchestkit/issues/418), [#437](https://github.com/yonatangross/orchestkit/issues/437), [#450](https://github.com/yonatangross/orchestkit/issues/450), [#451](https://github.com/yonatangross/orchestkit/issues/451), [#452](https://github.com/yonatangross/orchestkit/issues/452), [#453](https://github.com/yonatangross/orchestkit/issues/453), [#454](https://github.com/yonatangross/orchestkit/issues/454), [#455](https://github.com/yonatangross/orchestkit/issues/455), [#456](https://github.com/yonatangross/orchestkit/issues/456), [#534](https://github.com/yonatangross/orchestkit/issues/534))
- **Skills**: Fix doctor "health diagnostics for health diagnostics" redundancy ([#456](https://github.com/yonatangross/orchestkit/issues/456))
- **Skills**: Add skill name to explore description for semantic discovery ([#456](https://github.com/yonatangross/orchestkit/issues/456))
- **Tests**: Rewrite MCP pretool hook tests for TypeScript — removes 14 dead skip() calls ([#417](https://github.com/yonatangross/orchestkit/issues/417))
- **Tests**: Rewrite hook timing tests to measure TypeScript hooks via run-hook.mjs ([#455](https://github.com/yonatangross/orchestkit/issues/455))

### Changed

- **CLAUDE.md**: Prune from 275 to 75 lines, link to docs instead of inline ([#452](https://github.com/yonatangross/orchestkit/issues/452))
- **Hooks**: Consolidate 4 PostToolUse Write|Edit hooks into unified-write-quality-dispatcher ([#453](https://github.com/yonatangross/orchestkit/issues/453))
  - auto-lint, readme-sync, merge-conflict-predictor, coverage-predictor → 1 dispatcher
  - Hook count: 88 → 86 (63 global + 22 agent + 1 skill)
- **README**: Fix stale counts (200→60 skills, 98→86 hooks), remove playground-demo.gif
- **GitHub**: Update repo description with accurate component counts

## [6.0.4] - 2026-02-13

### Fixed

- **CI**: Remove deleted `evidence-verification` skill from `test-specific-skills.sh` ([#555](https://github.com/yonatangross/orchestkit/issues/555) aftermath)
- **CI**: Add missing `version` field and `checklists/` directory to `mcp-patterns` skill for `test-ai-ml-skills.sh`

## [Unreleased]

### Changed

- **Skill Consolidation** ([#536](https://github.com/yonatangross/orchestkit/issues/536)): Restructured 200 skills into 103 through 16 consolidation batches
  - **Batches 1-6**: LangGraph (10→1), RAG (9→1), Testing (13→1), Caching (4→1), Performance (6→1), Video (14→1)
  - **Batches 7-16**: Event-Driven (3→1), Golden-Dataset (3→1), Accessibility (3→1), Database-Patterns (4→1), LLM-Integration (7→1), API-Design (3→1), Distributed-Systems (4→1), Agent-Orchestration (3→1), Security-Patterns (6→1), Product-Frameworks (5→1)
  - **Additional groups**: Monitoring-Observability (2→1), Frontend-Animation (3→1), UI-Components (4→1), Data-Visualization (2→1), Python-Backend (5→1), Architecture-Patterns (2→1), Browser-Tools (2→1), Context-Optimization (2→1), Async-Jobs (2→1)
  - Total: 200 → 103 skills (76 internal, 27 user-invocable)
  - ork-creative: 16 → 3 skills (demo-producer, video-production, ascii-visualizer)
  - Updated 33 agents, hooks, manifests, tests, and CLAUDE.md with corrected counts
  - Hook count corrected: 93 → 88 (65 global + 22 agent + 1 skill)

### Added

- **TLDR-Lite File Summaries** ([#463](https://github.com/yonatangross/orchestkit/issues/463)): New `PreToolUse[Read]` hook injects structural summaries for large files (>500 lines or >2000 tokens)
  - Regex-based extractors for TypeScript/JS, Python, Go, Rust, Shell, Markdown
  - Extracts imports, functions, classes, types, exports as a navigation roadmap
  - ~500 token summary injected as `additionalContext` alongside full file content
  - 7 guard conditions: skip targeted reads, unsupported extensions, small files, >2MB files
  - 42 new tests (25 library + 17 hook)
  - Hook count: 97 → 98 (70 global + 22 agent + 6 skill)
  - pretool bundle: 57.42 → 63.36 KB (+10%)

### Fixed

- **Docs**: Corrected stale component counts across README, marketplace.json, CONTRIBUTING.md, Fumadocs site pages, and skill references (199→200 skills, 119→98 hooks)

---

## [6.0.3] - 2026-02-07

### Added

- **Langfuse v3 Rewrite** (Milestone [#58](https://github.com/yonatangross/orchestkit/milestone/58)): Complete rewrite of `langfuse-observability` skill from deprecated SDK v2 to v3/v4 (OTEL-native)
  - SKILL.md bumped to v2.0.0 with 3 new capability sections (agent-graphs, mcp-prompt-management, framework-integrations)
  - 3 new reference files: `agent-observability.md`, `framework-integrations.md`, `migration-v2-v3.md`
  - 7 existing reference files rewritten with v3 imports (`from langfuse import observe, get_client`)
  - All `langfuse_context` → `get_client()`, all `langfuse.decorators` → `langfuse` imports
  - New coverage: Agent Graphs, MCP Server, Experiment Runner SDK, dataset versioning, spend alerts, natural language filtering, evaluator execution tracing
  - 18 tracking issues ([#419](https://github.com/yonatangross/orchestkit/issues/419)-[#436](https://github.com/yonatangross/orchestkit/issues/436)) under Milestone [#58](https://github.com/yonatangross/orchestkit/milestone/58)

### Fixed

- **Mem0**: Add `--no-infer` flag to `add-memory.py` — passes `infer=False` to mem0's `client.add()`, disabling semantic dedup in batch tests (Test 6, Test 18) so counts are deterministic across parallel CI runners
- **CI**: Quote workflow names containing colons (`Validate: Plugins`, `Validate: Version`, `Eval: Agent Routing`, `Visualize: Memory`) — unquoted colons caused YAML parse errors resulting in 0 jobs
- **CI**: Fix `test-git-enforcement-hooks.sh` failing on `main` by setting `ORCHESTKIT_BRANCH` env override so git-validator hook doesn't block test commits on protected branches
- **CI**: Rewrite `test-hook-chains.sh` to read from committed `hooks.json` instead of gitignored `settings.json`

---


## [6.0.2] - 2026-02-06

### Added

- **[#328](https://github.com/yonatangross/orchestkit/issues/328) (P1-C)**: `complexity: low|medium|high` field added to all 199 skill frontmatters for Opus 4.6 adaptive thinking alignment
- **[#337](https://github.com/yonatangross/orchestkit/issues/337) (P2-E)**: New `upgrade-assessment` user-invocable skill — 6-phase readiness evaluation with structured JSON scoring across 6 dimensions
- **[#338](https://github.com/yonatangross/orchestkit/issues/338) (P2-F)**: New `platform-upgrade-knowledge` reference skill with scoring rubrics and compatibility matrices
- **[#333](https://github.com/yonatangross/orchestkit/issues/333) (P2-D)**: 128K output token guidance added to implement skill, context-engineering, and 3 agent definitions
- **[#331](https://github.com/yonatangross/orchestkit/issues/331) (P2-B)**: New `model-cost-advisor` SubagentStart hook — analyzes task complexity and recommends optimal model for cost savings
- **[#325](https://github.com/yonatangross/orchestkit/issues/325) (P0-B)**: Prefill-guard SessionStart hook warns about Opus 4.6 breaking change (prefilled assistant messages return 400 errors)
- **[#346](https://github.com/yonatangross/orchestkit/issues/346) (P1-E)**: Agent `memory` frontmatter — all 36 agents (31 `project` scope, 5 `local` scope) (CC 2.1.33)
- **[#347](https://github.com/yonatangross/orchestkit/issues/347) (P1-F)**: New `TeammateIdle` and `TaskCompleted` hook events with progress-reporter and completion-tracker handlers (CC 2.1.33)
- **[#335](https://github.com/yonatangross/orchestkit/issues/335) (P3-B)**: New `/ork:audit-full` user-invocable skill — single-pass whole-codebase audit (security, architecture, dependencies) leveraging 1M context window with 4 references, 2 assets, 1 checklist, 1 script
- Batch script `scripts/add-complexity.mjs` for applying complexity classifications
- **[#334](https://github.com/yonatangross/orchestkit/issues/334) (P3-A)**: Agent Teams dual-mode orchestration — `/ork:implement` and 5 other user-invocable skills (assess, brainstorm, explore, fix-issue, review-pr, verify) support both Task tool (star topology) and Agent Teams (mesh topology) via `ORCHESTKIT_PREFER_TEAMS` env var
- **[#405](https://github.com/yonatangross/orchestkit/issues/405)**: TeamCreate, SendMessage, TeamDelete tools added to all 36 agents
- **[#406](https://github.com/yonatangross/orchestkit/issues/406)**: task-dependency-patterns skill updated with Agent Teams coordination patterns
- **[#407](https://github.com/yonatangross/orchestkit/issues/407)**: multi-agent-orchestration skill updated with mesh topology patterns
- **[#362](https://github.com/yonatangross/orchestkit/issues/362)**: 4 Agent Teams lifecycle hooks (team-formation-advisor, teammate-progress-reporter, teammate-completion-tracker, team-coordination-advisor)
- **[#391](https://github.com/yonatangross/orchestkit/issues/391) (P2-B)**: Interactive Agent Selector playground with search, category/task filters, quiz wizard, and 10 scenario suggestions
- **Fumadocs site scaffold** (Milestone [#56](https://github.com/yonatangross/orchestkit/milestone/56)): Fumadocs v16.5 + Next.js + MDX + Orama search, reference pages auto-generated for all 199 skills, 36 agents, 15 hook categories

- **Tavily Integration**: 3-tier web research workflow (WebFetch → Tavily → agent-browser) with curl patterns for search/extract/map APIs, graceful degradation when `TAVILY_API_KEY` is unset
- **Tavily Site Discovery**: competitive-monitoring skill gains Tavily map+extract pre-step for competitor URL enumeration
- **Tavily Agent Awareness**: web-research-analyst, market-intelligence, and product-strategist agents updated with Tavily directives

### Fixed

- **SEC-001**: SQL injection prevention — `multi-instance-cleanup` and `cleanup-instance` now validate instance IDs with `/^[a-zA-Z0-9_\-.:]+$/` before SQLite interpolation
- **SEC-003**: Atomic file writes — `multi-instance-lock` uses write-to-temp + `renameSync` to prevent TOCTOU race conditions in lock files
- README.md hook count corrected (120 → 119)

### Changed

- **[#348](https://github.com/yonatangross/orchestkit/issues/348) (P2-G)**: `Task(agent_type)` restrictions on python-performance-engineer and demo-producer (CC 2.1.33)
- **[#349](https://github.com/yonatangross/orchestkit/issues/349) (P1-G)**: CC minimum version bumped to >= 2.1.33 (from 2.1.32) for agent memory and new hook events
- **[#330](https://github.com/yonatangross/orchestkit/issues/330) (P2-A)**: 13 agents migrated from `mcp__sequential-thinking` to Opus 4.6 native adaptive thinking
- **[#329](https://github.com/yonatangross/orchestkit/issues/329) (P1-D)**: TOKEN_BUDGETS now scale dynamically with `CLAUDE_MAX_CONTEXT` (2% of context window per CC 2.1.32)
- **[#332](https://github.com/yonatangross/orchestkit/issues/332) (P2-C)**: Enhanced `pre-compact-saver` v2.0 — preserves decision logs, memory tier snapshots, compaction frequency analytics
- **[#324](https://github.com/yonatangross/orchestkit/issues/324) (P0-A)**: Replace hardcoded model string in multi-instance-init.ts with dynamic `detectModel()`
- **[#326](https://github.com/yonatangross/orchestkit/issues/326) (P1-A)**: Memory context tier limits expanded (1200→3000 chars memory, 800→1200 chars profile)
- **[#327](https://github.com/yonatangross/orchestkit/issues/327) (P1-B)**: CC minimum version updated to >= 2.1.33 across CLAUDE.md, README, hooks README, marketplace
- MCP configuration docs updated with Opus 4.6 sequential-thinking deprecation note
- CI workflow renames for clarity and pipeline parallelism
- Skill count: 197 → 200 (added upgrade-assessment, platform-upgrade-knowledge, audit-full)
- Hook count: 117 → 119 (91 global + 22 agent + 6 skill-scoped)
- Opus 4.6 callouts added to top 5 user-invocable skills (verify, review-pr, fix-issue, implement, explore)
- Agent `memory` frontmatter expanded from 22 to all 36 agents

### Removed

- Deprecated `sequential-thinking-auto` pretool hook (Opus 4.6 native adaptive thinking replaces MCP sequential-thinking)
- **[#362](https://github.com/yonatangross/orchestkit/issues/362)**: 6 coordination hooks removed as redundant with CC native Agent Teams (team-formation-hook, team-coordinator, teammate-monitor, team-cleanup, team-health-check, team-context-share)

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

---

[6.0.18]: https://github.com/yonatangross/orchestkit/compare/v6.0.17...v6.0.18
[6.0.17]: https://github.com/yonatangross/orchestkit/compare/v6.0.16...v6.0.17
[6.0.16]: https://github.com/yonatangross/orchestkit/compare/v6.0.15...v6.0.16
[6.0.15]: https://github.com/yonatangross/orchestkit/compare/v6.0.14...v6.0.15
[6.0.14]: https://github.com/yonatangross/orchestkit/compare/v6.0.13...v6.0.14
[6.0.13]: https://github.com/yonatangross/orchestkit/compare/v6.0.12...v6.0.13
[6.0.12]: https://github.com/yonatangross/orchestkit/compare/v6.0.11...v6.0.12
[6.0.11]: https://github.com/yonatangross/orchestkit/compare/v6.0.9...v6.0.11
[6.0.9]: https://github.com/yonatangross/orchestkit/compare/v6.0.8...v6.0.9
[6.0.8]: https://github.com/yonatangross/orchestkit/compare/v6.0.7...v6.0.8
[6.0.7]: https://github.com/yonatangross/orchestkit/compare/v6.0.6...v6.0.7
[6.0.6]: https://github.com/yonatangross/orchestkit/compare/v6.0.5...v6.0.6
[6.0.5]: https://github.com/yonatangross/orchestkit/compare/v6.0.4...v6.0.5
[6.0.4]: https://github.com/yonatangross/orchestkit/compare/v6.0.2...v6.0.4
[6.0.2]: https://github.com/yonatangross/orchestkit/compare/v6.0.0...v6.0.2
[6.0.0]: https://github.com/yonatangross/orchestkit/compare/v5.7.1...v6.0.0
[Unreleased]: https://github.com/yonatangross/orchestkit/compare/v6.0.18...HEAD
[6.0.3]: https://github.com/yonatangross/orchestkit/compare/v6.0.2...v6.0.3
[6.0.1]: https://github.com/yonatangross/orchestkit/compare/v6.0.0...v6.0.1
[5.7.5]: https://github.com/yonatangross/orchestkit/compare/v5.7.1...v5.7.5
[5.7.3]: https://github.com/yonatangross/orchestkit/compare/v5.7.2...v5.7.3
[5.7.2]: https://github.com/yonatangross/orchestkit/compare/v5.7.1...v5.7.2
[5.7.1]: https://github.com/yonatangross/orchestkit/compare/v5.7.0...v5.7.1
[5.7.0]: https://github.com/yonatangross/orchestkit/compare/v5.5.0...v5.7.0
[5.6.2]: https://github.com/yonatangross/orchestkit/compare/v5.6.1...v5.6.2
[5.6.1]: https://github.com/yonatangross/orchestkit/compare/v5.6.0...v5.6.1
[5.6.0]: https://github.com/yonatangross/orchestkit/releases/tag/v5.6.0
[5.5.0]: https://github.com/yonatangross/orchestkit/releases/tag/v5.5.0
[5.2.4]: https://github.com/yonatangross/orchestkit/releases/tag/v5.2.4
