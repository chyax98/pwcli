.PHONY: install build lint test check ci smoke e2e pack clean

install:
	pnpm install

build:
	pnpm build

lint:
	pnpm lint

test:
	pnpm test

smoke:
	pnpm smoke

e2e:
	pnpm test:e2e

check:
	pnpm check

ci:
	pnpm check

pack:
	pnpm pack:check

clean:
	pnpm clean
