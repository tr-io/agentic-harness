.PHONY: build test lint typecheck release-patch release-minor release-major \
        _release-guard _release-finish

# ── Dev ───────────────────────────────────────────────────────────────────────

build:
	npm run build

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

# ── Release ───────────────────────────────────────────────────────────────────
# Usage:
#   make release-patch   # 0.1.0 → 0.1.1
#   make release-minor   # 0.1.0 → 0.2.0
#   make release-major   # 0.1.0 → 1.0.0
#
# What it does:
#   1. Bumps version in package.json
#   2. Rebuilds dist/
#   3. Repacks tr-io-harness-X.Y.Z.tgz
#   4. Updates README install URL
#   5. Commits everything and tags

release-patch: _release-guard
	npm version patch --no-git-tag-version
	$(MAKE) _release-finish

release-minor: _release-guard
	npm version minor --no-git-tag-version
	$(MAKE) _release-finish

release-major: _release-guard
	npm version major --no-git-tag-version
	$(MAKE) _release-finish

_release-guard:
	@git diff --quiet && git diff --cached --quiet || \
		(echo "\nERROR: Working tree is dirty. Commit or stash changes first.\n" && exit 1)

_release-finish:
	$(eval V := $(shell node -p "require('./package.json').version"))
	npm run build
	rm -f tr-io-harness-*.tgz
	npm pack
	sed -i '' 's|tr-io-harness-[0-9]*\.[0-9]*\.[0-9]*\.tgz|tr-io-harness-$(V).tgz|g' README.md
	git add dist/ tr-io-harness-$(V).tgz package.json package-lock.json README.md
	git commit -m "release: v$(V)"
	git tag v$(V)
	@echo ""
	@echo "Released v$(V). Push with:"
	@echo "  git push && git push --tags"
