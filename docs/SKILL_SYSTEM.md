# Skill system and token budget

## Purpose

This project uses four project-local skills for provider safety, data truthfulness, policy compliance, and release verification. Shared Hermes skills are loaded only when their task trigger applies.

## Project skill map

| Task | Project skill | Shared skills to load |
|---|---|---|
| Provider API, authentication, cache, URL, or normalization | `stay-provider-integration` | `test-driven-development`, `systematic-debugging` on failures |
| Data merge, deduplication, filtering, ranking, or enrichment | `stay-data-quality` | `test-driven-development` |
| Images, descriptions, reviews, ratings, terms, privacy, or attribution | `stay-policy-compliance` | `grounded-citations` |
| Final verification, handoff, commit, or push | `stay-release-gate` | `dogfood`, `requesting-code-review` |
| Main/sub-screen design | — | `claude-design`; use `popular-web-designs` only for a named reference vocabulary |
| GitHub repository, commit, push, or PR | — | `github-auth`, `github-repo-management`, `github-pr-workflow` as applicable |
| Multi-file planning without immediate implementation | — | `plan` |

Each project skill also declares its related shared skills in `metadata.hermes.related_skills`. Sessions started inside this trusted Git repository discover the four skills from `.hermes/skills/`.

## Token model

Hermes uses progressive disclosure:

1. At session start, the skill index contributes only each skill's name and short description.
2. A full `SKILL.md` enters context only when `skill_view` loads it.
3. Linked references enter context only when separately requested.

The estimates below use `characters / 4`. This is a planning approximation, not a provider billing measurement; the active model tokenizer can differ.

### Project-local skills

| Skill | Characters | Words | Estimated full-load tokens | Estimated index tokens |
|---|---:|---:|---:|---:|
| `stay-provider-integration` | 4,543 | 640 | 1,136 | 21 |
| `stay-data-quality` | 4,824 | 654 | 1,206 | 19 |
| `stay-policy-compliance` | 4,877 | 649 | 1,219 | 21 |
| `stay-release-gate` | 4,912 | 700 | 1,228 | 19 |
| **Total** | **19,156** | **2,643** | **4,789** | **80** |

The persistent cost added to a new project session is therefore approximately **80 tokens**, while loading all four full skills in one task costs approximately **4,789 tokens**. The index estimate includes a small bullet/label formatting allowance.

### Shared skill groups

| Group | Skills | Estimated full-load tokens |
|---|---|---:|
| Core development | TDD, systematic debugging, code review, dogfood, grounded citations | 12,541 |
| UI design | Claude Design, Popular Web Designs | 8,681 |
| GitHub | auth, repository management, PR workflow | 8,906 |

Loading every project and shared skill at once would cost approximately **34,917 tokens**, so that is explicitly avoided.

## Loading policy

- Normal provider feature: load provider + policy + TDD, usually about 6,900 estimated tokens including shared TDD.
- Data-only change: load data quality + TDD, usually about 3,770 estimated tokens.
- Bug investigation: load systematic debugging first; load TDD only when implementing the confirmed fix.
- UI iteration: load Claude Design. Load Popular Web Designs only when its concrete reference tokens are needed.
- Final gate: load release gate plus code review and dogfood; load policy/data skills only if those areas changed.
- GitHub skills load only at verified milestone boundaries, not during every code-edit turn.

This selective policy preserves quality while preventing the full 34,917-token skill set from entering every task.

## Operational constraints

- NAVER Local Search does not provide star ratings. A request to pre-filter by high NAVER rating cannot be implemented truthfully with this endpoint alone.
- Rating-based selection requires an authorized rating source, an operator-curated score with provenance, or a different documented proxy such as query relevance. Proxies must not be labeled as NAVER ratings.
- Secrets remain in `.env`, which is ignored by Git. Skill documents and reports must never contain their values.
